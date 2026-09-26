# Forensic scan — 2026-09-24

Live runtime audit of the running service (not a static read). Every finding
below was reproduced against a booted server and re-verified after the fix.

## Method

1. Booted `server/src/server.js` on an ephemeral store with no provider keys.
2. Authenticated as `admin` / `admin12345` and called every public and admin
   route, recording status codes and response bodies.
3. Saved keys through the real `PUT /api/admin/keys` contract, then re-read
   provider status to confirm the keys actually took effect.
4. Restarted the process and re-seeded from an encrypted blob to test the
   durability claim the admin panel was making.
5. Parsed `client/src/styles.css` programmatically for legibility violations
   (font size, letter-spacing, composited text contrast).

---

## Finding 1 — CRITICAL: freshly saved keys reported `not-configured`

**Symptom.** Paste a working key, save, and the provider grid still shows
`not-configured`. This is the single most likely cause of "it looks fake".

**Reproduced.**

```
BEFORE:  news  configured=false  status=not-configured
save NEWS_API_KEY -> 200
AFTER:   news  configured=true   status=not-configured   <-- contradiction
(after 36s wait) news  configured=true  status=not-configured
```

**Root cause.** `ProviderRegistry.#newsView()` reads
`liveSources.cache.sourceStatus`, and `LiveSourcesService` caches its merged
snapshot for `sourceCacheSeconds` (300s). That cached entry was written
*before* the key existed, so it kept asserting `not-configured`. The PUT
handler called `providers.status()`, but `#kickOff()` is debounced by 30s and
never clears an existing cache — so the stale value outlived the new
credential by up to five minutes.

**Fix.**

- `LiveSourcesService.invalidate()`, `MediaService.invalidate()`,
  `ProviderRegistry.invalidate()` — hard cache reset that also clears the
  debounce clock.
- `PUT /api/admin/keys` now invalidates all three, then warms them
  (`snapshot({ fresh: true })`).
- `#newsView()` no longer lets a stale `not-configured` entry outrank live
  configuration.

**Verified.** Same scenario now returns `configured=true status=degraded`
within 3 seconds — `degraded` proves the key reached the wire and the upstream
call was actually attempted.

## Finding 2 — CRITICAL: the panel claimed durability it did not have

**Symptom.** Keys pasted in the admin panel vanished on the next redeploy.

**Root cause.** Without `MONGODB_URI`, the store is `server/data/worldgpz.json`
on an **ephemeral filesystem**. Render's free tier wipes it on every deploy.
`/api/health` honestly said `"persistence":"ephemeral"`, while the admin UI
told the operator the local JSON store was "durable on this host".

**Fix — durable vault without a database.** New `server/src/vaultCrypto.js`:
AES-256-GCM, scrypt-derived key, random salt + IV per export, versioned
`wgv1.` envelope.

- `WORLDGPZ_VAULT` env blob seeds the vault at boot (existing store values
  win, so an import can never clobber a working key).
- `GET /api/admin/keys/export` → one encrypted string for that env var.
- `POST /api/admin/keys/import` → restore on another machine.
- Secret defaults to `JWT_SECRET`, so no extra configuration is needed.
- `/api/health` and the admin panel now report the real tier
  (`durable` / `ephemeral`) with an explicit `EPHEMERAL` warning chip.

**Verified end-to-end.** Machine A saved 4 keys and exported a 254-character
blob (plaintext grep: 0 hits). Machine B booted with the disk wiped and only
`WORLDGPZ_VAULT` set:

```
persistence=durable  vaultBackend=encrypted-env
seededFromEnv = 4
NEWS_API_KEY  vault  ••••••••NE-A
providers: finnhub=degraded  nasa-firms=degraded  news=degraded
```

## Finding 3 — sessions died when a tab closed

**Root cause.** The JWT lived in `sessionStorage`, which is per-tab and is
cleared on close. Any new window forced a re-login.

**Fix.** `client/src/lib/api.js` uses `localStorage`, probing for availability
first and falling back to `sessionStorage`, then to in-memory. Legacy keys are
migrated once and removed.

## Finding 4 — text was genuinely hard to read

Measured, not assumed. Parsed every CSS rule:

| Violation                                    | Before | After |
| -------------------------------------------- | -----: | ----: |
| Rules with `font-size` under 10px            |     72 |     0 |
| Rules with `letter-spacing` over 0.18em      |     28 |     0 |
| Text tokens failing WCAG AA on the backdrop  |      0 |     0 |

Smallest text was **8.5px** (`.target-marker .tag`) and worst tracking was
**0.4em** (`.boot-title span`) — at 9px that tracking smears glyphs together.
Applied an 11px floor and a 0.16em tracking cap.

The base palette already passed WCAG AA everywhere (worst case `--red` at
5.64:1 on `--void`). An earlier note in this audit claiming 38 low-alpha
*text* declarations was wrong: those were `border-color` and
`scrollbar-color`. Exactly one `color: rgba(...)` declaration exists and it
passes.

## Not a bug (verified working)

- Admin credentials are already `admin` / `admin12345`, enforced by
  `validateProductionConfig()`, which fails boot if they drift.
- The client sends `{ keys }` for `PUT /api/admin/keys`, matching
  `settingsSchema`. Bare payloads are correctly rejected.
- No `process.env` reads anywhere under `server/src/services/` — every adapter
  reads `this.config`, which is why vault writes can take effect live.
- Plaintext keys never leave the server: masked to `••••••••` + last 4, and the
  encrypted export contains no plaintext (verified by grep).

## Test coverage added

- `server/test/vault.test.js` — 18 tests: crypto round-trip, wrong-secret and
  tamper rejection (tag and ciphertext), restart survival, cross-machine
  export/import, non-destructive import, env fallback on clear, persistence
  tiers.
- `server/test/app.test.js` — 4 tests: persistence metadata contract,
  encrypted export carries no plaintext, import restores on a second machine,
  import endpoint input guards.
- `client/src/pages/render.test.jsx` — vault panel renders the new contract and
  warns loudly when ephemeral.

Totals after this scan: **87 tests passing** (78 server, 9 client), production
build clean, Prettier clean.

## Sandbox limitation

This environment blocks most outbound HTTPS (`https://example.com` → curl exit
35), so live upstream providers return `degraded` here and the deployed
`worldgpz.onrender.com` could not be reached from the sandbox. `degraded` is
the correct response for an unreachable upstream. `https://api.github.com`
returned 200, confirming the block is a sandbox egress policy rather than a
fault in the fetch path.
