# API keys and live-media deployment guide

Updated: 2026-08-10

## What the two requested keys enable

### `YOUTUBE_API_KEY`

WORLDGPZ uses the official YouTube Data API v3 **only on the server** to find the current live broadcast for seven curated public channels. The browser receives sanitized video metadata and a video ID, never the key.

At runtime:

1. The server resolves each configured channel handle with `channels.list`.
2. It requests the channel's current broadcast with `search.list`, `eventType=live`, and `type=video`.
3. The shared result is cached for three hours by default.
4. The browser displays a poster and does not load YouTube until the visitor presses Play.
5. Playback uses YouTube's privacy-enhanced IFrame Player API.
6. Channel changes reuse the player interface.
7. Playback starts muted for browser autoplay compatibility.
8. The player pauses when the tab is hidden or after five minutes without activity.
9. If no broadcast is available, the channel is shown as offline instead of embedding an unrelated video.

The three-hour cache is deliberate. Seven channel searches every three hours use approximately 56 live-search calls per full day on a continuously running instance. This leaves room under the default YouTube search-request allocation, although container restarts and manual cache invalidation can increase usage.

#### Google Cloud setup

1. Create or select a Google Cloud project.
2. Open **APIs & Services → Library**.
3. Enable **YouTube Data API v3**.
4. Open **Credentials → Create credentials → API key**.
5. Restrict the key to **YouTube Data API v3**.
6. Add it to Render as `YOUTUBE_API_KEY`.
7. Keep `YOUTUBE_CACHE_SECONDS=10800` unless you have approved additional quota.
8. Do not use a `VITE_` prefix and do not paste the key into frontend source.

A browser-referrer restriction is not appropriate for this server-side request path. If your Render plan provides fixed outbound IP addresses, an IP restriction can be added; otherwise use API-level restrictions, quota alerts, and key rotation.

The YouTube IFrame Player itself does not need an API key. The key is needed to discover which video is live.

### `NEWS_API_KEY`

WORLDGPZ calls NewsAPI from the server, caches the combined dashboard response, and falls back to ReliefWeb when NewsAPI is missing or unavailable.

Important licensing limitation: NewsAPI's free Developer plan is for development/testing only, has delayed articles, and is not permitted for staging or production. A production Render deployment needs an eligible NewsAPI subscription or a production-licensed alternative. Server-side proxying does not remove this contractual restriction.

Set the key in Render as `NEWS_API_KEY`. Never expose it as `VITE_NEWS_API_KEY`.

## Keys needed to approach the broader reference feature set

These are not all required for the current WORLDGPZ build. Add providers only after reviewing pricing, licensing, geographic coverage, attribution, retention, and redistribution terms.

### Highest priority

| Variable                                  | Provider                   | Enables                                                  | Current WORLDGPZ status                                     |
| ----------------------------------------- | -------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `AI_API_KEY`                              | OpenAI-compatible provider | Source-grounded intelligence briefing                    | Implemented; rules fallback works without it                |
| `WINDY_API_KEY`                           | Windy Webcams API v3       | Global webcam locations, preview images, and player URLs | Recommended next feature; not yet integrated                |
| `FINNHUB_API_KEY`                         | Finnhub                    | Equities and market quotes                               | Recommended for finance panel                               |
| `ACLED_ACCESS_TOKEN` or OAuth credentials | ACLED                      | Conflict and protest events                              | Recommended; token and usage terms require review           |
| `NASA_FIRMS_API_KEY`                      | NASA FIRMS                 | Satellite thermal/fire detections                        | Recommended; NASA EONET is already integrated without a key |

### Advanced operations

| Variable                                      | Provider         | Enables                               | Infrastructure note                                                                 |
| --------------------------------------------- | ---------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `AISSTREAM_API_KEY`                           | AISStream        | Live vessel positions                 | Requires a durable WebSocket relay and fan-out cache; not suitable as a browser key |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | OpenSky          | Aircraft tracking                     | Requires a server relay, caching, and rate shaping                                  |
| `CLOUDFLARE_API_TOKEN`                        | Cloudflare Radar | Internet outage signals               | Server-only; cache responses                                                        |
| `EIA_API_KEY`                                 | U.S. EIA         | Oil prices, production, and inventory | Server-side scheduled collection recommended                                        |
| `FRED_API_KEY`                                | Federal Reserve  | Macro indicators and rates            | Server-side caching recommended                                                     |
| `WINGBITS_API_KEY`                            | Wingbits         | Aircraft owner/operator enrichment    | Optional after OpenSky integration                                                  |
| `UCDP_ACCESS_TOKEN`                           | UCDP             | Conflict dataset                      | Review research/commercial terms                                                    |

### Infrastructure and reliability

| Variable                  | Service           | Purpose                                                            |
| ------------------------- | ----------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`            | Render PostgreSQL | Users, curated events, and audit history; already supported        |
| Upstash/Redis credentials | Managed Redis     | Shared provider caches, job state, and multi-instance rate budgets |
| `SENTRY_DSN`              | Sentry            | Production errors and frontend performance monitoring              |

## Why API keys alone are not enough

Some reference capabilities need infrastructure in addition to credentials:

- AIS and aircraft tracking are continuous streams and need a long-running relay.
- Webcam maps need scheduled metadata seeding, geospatial indexing, short-lived image URL caching, and required provider attribution.
- Hundreds of RSS feeds need source admission, parsing, deduplication, circuit breakers, bias metadata, and corrections.
- Alerts need corroboration, cooldowns, notification preferences, and delivery infrastructure.
- Live video needs embed permission checks, user-initiated playback, idle cleanup, geographic restrictions, and fallback behavior.
- Scores need published methodology and cannot be presented as authoritative predictions.

## Render configuration

In **Render → worldgpz → Environment**, set:

```dotenv
NEWS_API_KEY=<your eligible NewsAPI key>
YOUTUBE_API_KEY=<your restricted YouTube Data API v3 key>
YOUTUBE_CACHE_SECONDS=10800
```

For AI briefing:

```dotenv
AI_API_KEY=<private provider key>
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Then redeploy and test:

```bash
curl -fsS https://<your-service>.onrender.com/api/v1/media/channels
curl -fsS https://<your-service>.onrender.com/api/v1/news
```

Expected media response when configured:

- `configured: true`
- overall `status` is `operational`, `no-live-streams`, or `degraded`
- each channel reports `live`, `offline`, `not-found`, `degraded`, or `quota-or-key-error`
- no API key appears in the JSON response

## Troubleshooting

### All channels say `quota-or-key-error`

Verify that YouTube Data API v3 is enabled, the key has that API restriction, the project has remaining search quota, and Render is using the newest environment value.

### Channel is offline but its YouTube page looks live

The shared discovery cache may still contain the earlier state. Wait for the cache interval or restart once during setup. Do not repeatedly restart production to force refreshes because each cold discovery consumes search quota.

### YouTube player error 101/150

The video owner has disabled embedding. Open the linked YouTube page instead. WORLDGPZ does not attempt to bypass embed restrictions.

### YouTube player error 153

Confirm the deployed site sends a referrer. WORLDGPZ uses `strict-origin-when-cross-origin` and includes the site origin in the player configuration.

### NewsAPI works locally but fails on Render

The NewsAPI Developer plan is not licensed for production. Upgrade or use a production-licensed news provider. ReliefWeb remains available as the built-in fallback.
