# WORLDGPZ production forensic scan — 2026-08-11

Target: `https://worldgpz.onrender.com/`

Scope: non-destructive public-route inspection, provider contract review against
current primary documentation, comparison with the public World Monitor product
architecture, source/security review, automated tests, production build, and
secret-leak checks. No intrusive traffic, credential guessing, access-control
bypass, or destructive testing was performed.

> This report intentionally contains no credential values. Any credential ever
> pasted into chat, a ticket, a screenshot, or Git must be rotated before the
> final demonstration.

## Executive result

The Render service and PostgreSQL connection were healthy. The claim that only
NewsAPI worked was not accurate: the live provider registry showed Finnhub,
EIA, and FRED operational as well. The principal problem was a combination of
four stale API contracts, one unused key, an oversized OpenSky query, ambiguous
provider-health semantics, account/key permission failures, and a current
third-party AISStream outage.

The code in this branch corrects every repository-controlled issue and adds a
repeatable production scanner. Credentials and upstream service outages remain
owner/provider responsibilities and cannot safely be bypassed in application
code.

## Live observations before remediation

| Surface             | Observed production state                 | Finding                                                                                              |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/api/health`       | HTTP 200, PostgreSQL, service healthy     | Core Render deployment worked                                                                        |
| `/api/v1/dashboard` | HTTP 200 with current USGS/EONET records  | Main aggregation worked                                                                              |
| NewsAPI             | Operational                               | Key and endpoint worked                                                                              |
| Finnhub             | Operational (USO and BTC quotes returned) | Provider worked; some index symbols were unavailable on the plan                                     |
| EIA                 | Operational (one series returned)         | Provider worked partially                                                                            |
| FRED                | Operational (six series returned)         | Provider worked                                                                                      |
| Windy               | Degraded, HTTP 400                        | Invalid v3 `include=status` plus stale v2 response mapping                                           |
| NASA FIRMS          | Degraded, “no detections”                 | Error/plain-text responses were being mistaken for empty CSV data                                    |
| ACLED               | Degraded, HTTP 401                        | Authentication rejected; bot-facing UA/token lifecycle also needed hardening                         |
| Cloudflare Radar    | Degraded, HTTP 400                        | Stale response mapping and token/permission validation needed                                        |
| OpenSky             | Degraded, 8-second timeout                | Continent-scale box needed a provider-specific timeout and bounded retry                             |
| AISStream           | Could not establish WebSocket             | Upstream service/TLS incidents were open on 2026-08-11; not key-specific                             |
| YouTube             | Key accepted, zero live results           | Zero live content was incorrectly displayed as provider failure; channel-search fallback was missing |
| AI                  | Pending                                   | Provider had never been exercised; fallback hid failure state                                        |
| OpenWeather         | No status and no endpoint                 | Environment key was read but never consumed                                                          |

## Repository-controlled fixes

### Production request path and provider reliability foundation

- Permits the deployed same origin dynamically from the request host while
  continuing to reject unrelated browser origins. This fixes
  same-origin login/AI POST failures when `CORS_ORIGINS` was not explicitly set.
- Uses Render's `RENDER_EXTERNAL_URL` as the automatic application URL fallback.
- Coalesces concurrent provider refreshes to prevent quota-amplifying request
  stampedes.
- Adds per-provider timeout support, stable public-safe error codes, bounded
  error caching, invalid-JSON detection, and compact registry responses.
- Separates provider health from content availability (for example, a healthy
  YouTube API with no active stream is still operational).
- Keeps upstream response bodies and all credentials out of public responses.

### Windy Webcams v3

- Removed invalid `status` from `include`.
- Added valid `urls` part.
- Migrated `id` to `webcamId`, v2 `properties` to `player.live`, and mapped the
  current v3 player/image/detail URL shapes.
- Retained the short signed-image cache and Windy attribution.

### NASA FIRMS

- Detects 200-status text diagnostics such as invalid MAP key and transaction
  errors instead of reporting “no detections.”
- Accepts real CSV row variations, uses a 20-second data timeout, and tries
  NOAA-20 only when configured global feeds return valid but empty CSV.
- Still caps/ranks map output to protect the response and provider quota.

### ACLED

- Uses the current OAuth password grant with `client_id=acled`, a browser-like
  UA consistent with ACLED's maintained clients, a 30-day event window, token
  caching, and one safe re-authentication attempt after an expired token.
- Prefers renewable account credentials over an expiring pasted access token.
- A continuing 401 means the account/password or ACLED account entitlement is
  invalid; application code cannot manufacture provider access.

### Cloudflare Radar

- Correctly maps `result.annotations` and `result.trafficAnomalies`.
- Uses a valid seven-day query, allows either half of the feed to remain live,
  and treats a valid empty result as successful.
- The token must be a Cloudflare API token with at least **User Details Read**
  permission, as required by the current Radar endpoint documentation.

### OpenSky

- Raises the provider timeout to 20 seconds.
- Validates bounding boxes and retries an explicitly labelled regional box only
  when a very large configured box times out.
- Keeps OAuth tokens cached and never exposes client credentials.

### AISStream

- Correctly reports a failed handshake as `degraded` rather than remaining
  indefinitely on `connecting`.
- Preserves strict TLS verification; it does not use the dangerous
  `rejectUnauthorized=false` workaround.
- Keeps exponential reconnect and exposes a safe upstream-unavailable notice.
  The upstream service must repair its endpoint before live ship data can flow.

### YouTube

- Pins known channel IDs, avoiding unnecessary channel-lookup calls.
- Keeps Data API `eventType=live` discovery and adds a canonical
  `/@handle/live` fallback for active 24/7 streams omitted by channel-filtered
  search.
- Reports API health separately from `no-live-streams` availability.
- Keeps click-to-play, idle pause, and owner-controlled embed restrictions.

### Finnhub and EIA partial-feed fixes

- Replaced unsupported caret-prefixed index symbols with clearly labelled,
  liquid ETF proxies that work on Finnhub's free quote endpoint.
- Corrected WTI and Brent from stale `petroleum/prio/*` routes to EIA v2's
  `petroleum/pri/spt/data` route; Henry Hub remains on its working route.

### OpenWeather and AI

- Added a real server-side OpenWeather adapter, `/api/v1/weather`, provider
  status, an Operations panel, and source-attributed map observations from eight
  global watch points.
- AI now reports credential, quota, timeout, or provider failure after an
  attempted brief while continuing to return the safe rules-engine fallback.

## Reference product review

The public World Monitor project was reviewed for general architecture and
failure-handling patterns: source-specific adapters, short/long cache tiers,
server-side ACLED token refresh, bounded OpenSky relays, server-mediated
YouTube fallback, status visibility, and provider-seeded data. WORLDGPZ remains
an independent implementation with its own code, visual identity, smaller
scope, and source attribution. The reference repository is AGPL-3.0; blindly
copying it or presenting its work as ThaddeusTechz's would create licensing and
academic-integrity risks.

## Verification in this branch

- 46 automated tests pass (44 server + 2 client).
- Production Vite build passes.
- Prettier check passes.
- `npm audit --omit=dev --audit-level=high`: zero known vulnerabilities.
- All 15 public scanner routes return JSON locally.
- The built browser bundle contains no tested API-key, OpenAI-key, Cloudflare
  token, or PostgreSQL URL patterns.
- Homepage security headers include CSP, HSTS, no-sniffing, frame controls, and
  strict referrer policy.

Run the repeatable scan after Render deploys this commit:

```bash
npm run scan:live -- https://worldgpz.onrender.com
npm run scan:live -- https://worldgpz.onrender.com --include-ai
```

The AI flag makes one billable/provider call, so use it deliberately.

## Mandatory owner actions before professor review

1. **Rotate every secret shared outside Render**, including the administrator
   password, database password/URL, JWT secret, all API keys, OAuth client
   secret, and the AI key. Update Render with the new values and redeploy.
2. ACLED: confirm the account can sign in to myACLED and has API access. A 401
   after this deployment is an account/credential issue.
3. Cloudflare: create a proper scoped API token with **User Details Read**.
4. NASA FIRMS: confirm the value is a FIRMS **MAP key**, not an Earthdata token,
   and check its transaction status.
5. Google Cloud: enable YouTube Data API v3 and use API restrictions compatible
   with a server-side Render request (HTTP referrer-only restrictions fail on
   server calls).
6. OpenAI-compatible provider: confirm project billing/quota and model access,
   then press **Generate brief** once and recheck `/api/v1/providers`.
7. Treat an AISStream outage as an external dependency incident. Demonstrate
   that WORLDGPZ identifies it safely rather than weakening TLS or fabricating
   ship positions.
8. Run `npm run verify`, deploy, run `npm run scan:live`, and save the
   non-secret output for the assessment evidence.

## Success criterion

A successful production review means the core site stays healthy, every valid
configured provider is operational, expected empty-content states are labelled
correctly, external failures degrade without crashing or fabricating data, and
no credential reaches the browser. It does **not** mean falsely marking invalid
keys or an upstream outage as operational.
