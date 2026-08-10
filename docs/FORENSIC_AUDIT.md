# WORLDGPZ forensic audit and rebuild report

Audit date: 2026-08-10

Audited base: `a94368744029256e418af97acccc4ee0edf6d79a`

## Executive summary

The inherited project compiled, but it was a prototype rather than a safe, operational full-stack product. The public interface was one 991-line React component with overlapping absolute-position panels, much of the “live” information was hardcoded, the frontend did not consume most of the backend, and authentication used an in-memory user with a hardcoded weak password. Two real provider keys were also committed in multiple Markdown files.

The repository was rebuilt from an empty working tree into a cohesive React/Express/PostgreSQL application. No original visual image assets were present to inspect; the only image references pointed to files that did not exist. New SVG brand assets were created and the geospatial experience uses live map tiles.

## Findings in the inherited repository

### Critical — exposed provider credentials

Two provider keys were present in tracked update guides. Their values are intentionally not repeated here. Because the base commit remains in Git history and may exist in clones or caches, deletion from the current tree does not make those credentials safe.

**Required owner action:** revoke both old keys at NewsAPI/Google Cloud, inspect provider usage logs, create new restricted keys only if needed, and store them exclusively in Render environment variables.

### High — hardcoded weak administrator access

The server created an in-memory administrator with a predictable password. The user database disappeared on restart, refresh tokens were held in process memory, production had an insecure fallback JWT secret, and several advertised authentication routes were placeholders.

**Remediation:** bcrypt-hashed bootstrap administrator in PostgreSQL/local storage, production configuration validation, signed expiring JWTs, generic login failures, login rate limits, role authorization, and protected admin routes.

### High — vulnerable dependency sets

The old lockfiles reported multiple known vulnerabilities, including high-severity issues across Axios, Vite/dev tooling, Socket.IO-related packages, PostCSS, `ws`, `form-data`, and YAML/brace-expansion transitive dependencies.

**Remediation:** replaced both dependency graphs, removed unused packages, upgraded to current compatible major versions, and generated a single workspace lockfile. The rebuilt graph reported zero known npm-audit vulnerabilities at rebuild time.

### High — misleading “real-time” and AI claims

The interface displayed simulated breaking-news items, casualty counts, military activity, and high-confidence AI predictions as if they were current. The API analytics used random values. This creates substantial trust and misinformation risk.

**Remediation:** external records now identify their source and link; curated records are labelled as a WORLDGPZ baseline; live source degradation is visible; no casualty figures or unsupported predictions are generated; the AI prompt prohibits invented facts; and the UI contains a decision-support disclaimer.

### Medium — frontend/backend disconnect

The frontend imported Axios but mostly used local mock arrays. Its API configuration object contained placeholder keys and the UI did not rely on authenticated backend state. The single component architecture also made change control difficult.

**Remediation:** same-origin API client, route-based code splitting, separated pages/components/libraries, real dashboard aggregation, and a complete admin workflow.

### Medium — layout and accessibility risk

Most panels were absolutely positioned over a full-screen map, creating collisions at smaller widths. Several controls had no meaningful behavior or labels. The bundle was about 863 KB before gzip and emitted a chunk-size warning.

**Remediation:** responsive document-flow grids, mobile drawers, visible focus styles, semantic buttons/labels, reduced-motion handling, route-level lazy loading, and dedicated map/chart chunks.

### Medium — production and persistence gaps

The README claimed PostgreSQL and Redis, but no production database workflow was connected. Render instructions described separate services and manual CORS wiring without a Blueprint.

**Remediation:** dual PostgreSQL/local store, automatic schema initialization, one-service frontend/API architecture, strict production configuration checks, and a `render.yaml` Blueprint with managed PostgreSQL.

### Low — missing referenced assets

The HTML referenced favicon, social image, and Apple touch assets that were absent. No uploaded photographs, mockups, screenshots, or other image files existed in the repository.

**Remediation:** created a favicon and social card as lightweight SVG assets. No source image could be “scanned” because none was provided.

## Rebuilt controls

- Secrets are loaded only by the server.
- `.env` and runtime data are ignored by Git.
- PostgreSQL queries are parameterized.
- Event writes are schema validated.
- Admin routes require both a valid token and admin role.
- Passwords are hashed with bcrypt cost 12.
- JWT issuer and audience are checked.
- Login, general API, and AI briefing routes have separate limits.
- Request bodies are capped at 100 KB.
- Helmet provides CSP, HSTS, MIME sniffing prevention, frame protections, and referrer policy.
- CORS uses an explicit allowlist for split-host development.
- Audit entries cover login, logout, create, update, and delete actions.
- Production startup fails closed when critical secrets or PostgreSQL are missing.
- Source failures degrade gracefully instead of fabricating live information.

## Validation completed

- JavaScript syntax checks for server modules.
- Server integration tests: health, public aggregation, authentication failures/success, role protection, schema rejection, event create/update/delete.
- Client unit tests for shared formatting.
- Optimized production build.
- Health, SPA fallback, login, current-user, and protected overview smoke tests against the running server.
- Full npm dependency audit.

## Remaining owner responsibilities

1. Revoke the credentials exposed in the historical commit.
2. Keep the private admin password outside source control.
3. Review licensing and terms for every external provider before commercial launch.
4. Establish editorial verification and correction policies for curated signals.
5. Add automated database backups and production monitoring on an appropriate Render plan.
6. Consider rewriting Git history only after all collaborators coordinate; revocation is still mandatory because history rewriting cannot retract copied secrets.
