# WORLDGPZ extended-provider forensic scan

Date: 2026-08-11
Scope: initial full-stack audit of the provider integrations, server
configuration, API surface, frontend wiring, security headers, and tests.

> Superseded for live production findings and the 13-provider implementation by
> [`PRODUCTION_FORENSIC_SCAN_2026-08-11.md`](PRODUCTION_FORENSIC_SCAN_2026-08-11.md).

## Scan method

1. Mapped every provider credential named in `docs/API_KEYS_AND_LIVE_MEDIA.md`
   to its consumer in code.
2. Verified each provider's current API contract against primary
   documentation (OpenSky OAuth2, Cloudflare Radar v2 paths, ACLED OAuth
   password grant, Windy v3 header auth, NASA FIRMS CSV area feed, Finnhub
   quote, EIA v2, FRED observations).
3. Checked `.env.example`, `render.yaml`, `config.js`, `app.js`, CSP, and the
   client bundle for wiring gaps, key leakage, and quota hazards.
4. Exercised every path with automated tests (mocked providers), then live
   smoke-tested the real server with no keys and with invalid keys.

## Findings and resolutions

### Critical

| #   | Finding                                                                                                                                                                                                                                                                                  | Resolution                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 9 of 12 keys had **no consumer at all**: placing them on Render changed nothing. `WINDY_API_KEY`, `FINNHUB_API_KEY`, `NASA_FIRMS_API_KEY`, ACLED credentials, `AISSTREAM_API_KEY`, OpenSky credentials, `CLOUDFLARE_API_TOKEN`, `EIA_API_KEY`, `FRED_API_KEY` were undocumented-in-code. | Built `server/src/services/providers/` with 9 adapters, a shared `ProviderBase` (timeout, TTL cache, safe errors), and a `ProviderRegistry`. All 12 keys now have live consumers.                         |
| 2   | No way to verify key health after deployment.                                                                                                                                                                                                                                            | Added `GET /api/v1/providers` returning status for all 12 providers (operational / degraded / connecting / pending / not-configured) with zero secret exposure, plus status chips on the Operations page. |
| 3   | CSP blocked Windy webcam images and embeds.                                                                                                                                                                                                                                              | Added `https://*.windy.com` to `imgSrc` and `https://webcams.windy.com` to `frameSrc`.                                                                                                                    |
| 4   | Registry method/property name collision (`markets()` vs `this.markets`) would 500 on 6 endpoints.                                                                                                                                                                                        | Renamed service instances (`marketsService`, etc.); caught by tests.                                                                                                                                      |
| 5   | Test fixture CSV had 15 columns vs. FIRMS' real 14-column schema, hiding a mapping bug.                                                                                                                                                                                                  | Corrected fixtures; parser is now pinned by tests.                                                                                                                                                        |

### High

| #   | Finding                                                                                                 | Resolution                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | AISStream needs a durable relay; a browser key is unsafe and a plain request loop misses the stream.    | Server-side WebSocket relay: global bbox subscription, 500-vessel in-memory ring, exponential-backoff reconnect (2s→30s), lazy start, graceful shutdown.      |
| 7   | OpenSky moved to OAuth2 client-credentials (required for new accounts); username/password auth is dead. | Token exchange at the OpenID Connect endpoint with form-encoded `grant_type=client_credentials`, bearer caching until near expiry, bounded regional snapshot. |
| 8   | ACLED auth is OAuth password grant, not a static header key.                                            | `ACLED_ACCESS_TOKEN` direct mode + `ACLED_EMAIL`/`ACLED_PASSWORD` exchange mode with 24h token caching.                                                       |
| 9   | FIRMS `world` CSV can be tens of thousands of rows.                                                     | Ranked by FRP, capped at 250 detections, 1-hour cache, configurable sources/area.                                                                             |
| 10  | Windy image URLs are signed and expire in 10 minutes (free tier).                                       | Webcam cache reduced to 60 s so page loads always get fresh tokens; attribution included.                                                                     |
| 11  | No per-provider quota protection.                                                                       | TTL caches per provider (60 s–3 h) plus 120 s failure hold; documented in the deployment guide.                                                               |

### Medium

| #   | Finding                                                    | Resolution                                                                                                                                                                         |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | Dashboard did not include provider events.                 | FIRMS fires and ACLED conflicts are merged into `/api/v1/dashboard` events and render on the Operations map (categories `natural` / `conflict`).                                   |
| 13  | AI provider health was invisible.                          | IntelligenceService records `lastSuccessAt`; the providers registry reports AI as operational after the first successful brief.                                                    |
| 14  | Frontend had no surfaces for the new data.                 | Added Webcams, Markets, Energy & macro, and Live tracking (ships/flights/outages) panels, each with loading / not-configured / degraded / operational states and 5-minute refresh. |
| 15  | `render.yaml` and `.env.example` lacked the new variables. | All 12 credentials plus tuning knobs (`FIRMS_SOURCES`, `FIRMS_AREA`, `OPENSKY_BBOX`) declared.                                                                                     |

## Verification

- 38 server tests + 2 client tests pass (`npm run test`).
- Production client build passes (`npm run build`).
- Live server, no keys: all 9 provider endpoints return 200 with
  `not-configured`; providers endpoint lists 12 entries; zero secrets in any
  response; CSP headers include Windy allowances.
- Live server, invalid keys: every provider transitions to `degraded` with a
  safe generic reason; zero unhandled errors in the server log; all endpoints
  remain 200; AISStream relay enters backoff instead of crashing.
- `npm audit`: 0 vulnerabilities.
- Sandbox note: this workspace has no outbound internet, so real-provider
  success was verified via contract-level mocked tests; on Render (which has
  outbound access) `GET /api/v1/providers` is the single verification point.

## Residual risks

- Free-tier quotas can still be exhausted (YouTube search, NewsAPI plan,
  FIRMS transactions, Finnhub rate, OpenSky daily calls) — the provider chips
  surface this immediately as `degraded`.
- ACLED and UCDP data carry redistribution terms; review before public
  display.
- Multi-instance deployments share no cache (in-memory per instance) — Redis
  remains the documented next step for horizontal scaling.
