# API keys and live-media deployment guide

Updated: 2026-08-11

All 13 configured provider integrations are now wired into WORLDGPZ. Each
adapter is server-side, quota-conscious (cached), and degrades gracefully to a
`not-configured` or `degraded` state when the key is missing or failing — the
application never crashes because of a provider.

## Provider status at a glance

`GET /api/v1/providers` (public) reports every provider with `id`, `name`,
`group`, `configured`, and `status` — one of:

- `operational` — last collection succeeded
- `degraded` — key present but the provider failed (check the key/limits)
- `connecting` — live relay is establishing a connection (AISStream)
- `pending` — key present, first collection in progress
- `not-configured` — no key set

The Operations page shows all providers as status chips under the situation
bar. Never paste a real key into chat, commits, or client code.

| Provider      | Variable(s)                                              | Status | Endpoint                          |
| ------------- | -------------------------------------------------------- | ------ | --------------------------------- |
| NewsAPI       | `NEWS_API_KEY`                                           | Live   | `/api/v1/news`                    |
| OpenWeather   | `OPENWEATHER_API_KEY`                                    | Live   | `/api/v1/weather`                 |
| YouTube Live  | `YOUTUBE_API_KEY`                                        | Live   | `/api/v1/media/channels`          |
| AI Briefing   | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`                  | Live   | `POST /api/v1/intelligence/brief` |
| Windy Webcams | `WINDY_API_KEY`                                          | Live   | `/api/v1/webcams`                 |
| Finnhub       | `FINNHUB_API_KEY`                                        | Live   | `/api/v1/markets`                 |
| NASA FIRMS    | `NASA_FIRMS_API_KEY`                                     | Live   | `/api/v1/fires`                   |
| ACLED         | `ACLED_ACCESS_TOKEN` or `ACLED_EMAIL` + `ACLED_PASSWORD` | Live   | `/api/v1/conflicts`               |
| AISStream     | `AISSTREAM_API_KEY`                                      | Live   | `/api/v1/ships`                   |
| OpenSky       | `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`             | Live   | `/api/v1/flights`                 |
| Cloudflare    | `CLOUDFLARE_API_TOKEN`                                   | Live   | `/api/v1/outages`                 |
| EIA           | `EIA_API_KEY`                                            | Live   | `/api/v1/energy`                  |
| FRED          | `FRED_API_KEY`                                           | Live   | `/api/v1/macro`                   |

Fires, conflict events, and OpenWeather observations are also merged into the
dashboard feed (`/api/v1/dashboard`) and plotted on the Operations map.

## Key-by-key setup

### 1. `YOUTUBE_API_KEY` — live channels

1. Google Cloud Console → enable **YouTube Data API v3**.
2. Credentials → Create credentials → API key.
3. Restrict the key to YouTube Data API v3.
4. Set `YOUTUBE_API_KEY` and keep `YOUTUBE_CACHE_SECONDS=10800` (3 hours).
5. The key is only used server-side to discover the current live broadcast for
   seven curated channels. The IFrame Player itself needs no key.

Quota: seven `search.list` calls per refresh ≈ 56/day at the 3-hour cadence.
Do not lower the cache without approved quota.

### 2. `NEWS_API_KEY` — headlines

Set `NEWS_API_KEY` on the server. The free Developer plan is development-only;
a published Render deployment needs a production-eligible subscription.
WORLDGPZ falls back to ReliefWeb automatically when NewsAPI is missing or
failing.

### `OPENWEATHER_API_KEY` — global current weather

Create a key in the OpenWeather console and enable the free Current Weather API.
WORLDGPZ calls `/data/2.5/weather` for eight globally distributed watch points,
caches observations for 10 minutes, displays them in the Operations room, and
adds source-attributed climate observations to the map. This does not require a
One Call 3.0 subscription. The key remains server-side; Open-Meteo continues as
the keyless baseline source.

### 3. `AI_API_KEY` — intelligence brief

One OpenAI-compatible provider:

```dotenv
AI_API_KEY=<private key>
AI_BASE_URL=https://api.openai.com/v1     # or https://api.groq.com/openai/v1
AI_MODEL=gpt-4o-mini                       # or the model available in your console
```

Without a key the brief uses the rules engine with `generatedBy: "WORLDGPZ
rules engine"`. Provider status for AI flips to `operational` after the first
successful generated brief.

### 4. `WINDY_API_KEY` — webcams

Get a Webcams API key at <https://api.windy.com/keys>. The adapter calls
`/webcams/api/v3/webcams` with the `x-windy-api-key` header and keeps only
active, popular cams. Image URLs from Windy are signed and expire quickly
(10 minutes on the free tier), so this adapter deliberately caches for only
60 seconds and refreshes on page load. Attribution (`Powered by Windy.com`)
is shown in the panel. Webcam embeds load only after the user presses play.

### 5. `FINNHUB_API_KEY` — markets

Register at <https://finnhub.io/register>. The adapter quotes a fixed
watchlist of explicitly labelled liquid ETF proxies (S&P 500, Nasdaq 100, Dow,
United Kingdom, Germany, Japan, WTI) plus BTC/USD, with `token` as the query
parameter. This avoids unsupported caret-prefixed index symbols on the free
quote plan. Responses are cached 2 minutes (free tier ≈ 60 calls/minute).

### 6. `NASA_FIRMS_API_KEY` — fires

Request the free MAP key at
<https://firms2.modaps.eosdis.nasa.gov/api/map_key/> (emailed to you). The
adapter downloads the CSV area feed for the configured sources, parses it,
ranks detections by fire radiative power, and caps the payload at 250
detections.

Tuning variables:

```dotenv
FIRMS_SOURCES=VIIRS_SNPP_NRT,MODIS_NRT
FIRMS_AREA=world            # or "minLon,minLat,maxLon,maxLat"
FIRMS_CACHE_SECONDS=3600
```

The one-hour cache keeps MAP-key transactions low.

### 7. ACLED — conflict events

Two credential modes:

```dotenv
# Option A: a direct access token
ACLED_ACCESS_TOKEN=<token>
# Option B: account credentials (exchanged for a 24h OAuth token server-side)
ACLED_EMAIL=<account-email>
ACLED_PASSWORD=<account-password>
```

The adapter requests up to 100 events from the last 30 days, maps event types to
categories (Battles/Explosions/Violence against civilians → conflict;
Protests/Riots → diplomacy), and derives severity from fatalities. Display
ACLED data in accordance with their redistribution terms.

### 8. `AISSTREAM_API_KEY` — live ships

Generate a key at <https://aisstream.io/authenticate>. WORLDGPZ runs a single
server-side WebSocket relay (`wss://stream.aisstream.io/v0/stream`) that
subscribes to the global bounding box, keeps the latest 500 vessels in
memory, and reconnects with exponential backoff (2s → 30s) after drops. The
key never leaves the server. The relay starts lazily on first use and shuts
down cleanly on SIGTERM. AISStream had open upstream WebSocket/TLS outage
reports in August 2026; WORLDGPZ reports those as `degraded` and deliberately
does not disable TLS verification.

### 9. OpenSky — aircraft

Create an API client on your OpenSky account page to get
`OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET`. The server exchanges them at
the OpenID Connect token endpoint (client-credentials grant), caches the
access token until near expiry, and takes a bounded snapshot of the region
every 60 seconds:

```dotenv
OPENSKY_BBOX=-10,-30,70,60   # minLat,minLon,maxLat,maxLon
OPENSKY_TIMEOUT_MS=20000
```

A very large box that times out is retried once with an explicitly labelled
regional window so the panel can remain useful without claiming global
coverage.

### 10. `CLOUDFLARE_API_TOKEN` — internet outages

Create a token at <https://dash.cloudflare.com/profile/api-tokens> with at
least **User Details Read**, which the current Radar endpoints require. The adapter reads
`/radar/annotations/outages/locations` and `/radar/traffic_anomalies/locations`
with a Bearer token; if one endpoint fails the other still reports.

### 11. `EIA_API_KEY` — energy

Register at <https://www.eia.gov/opendata/register.php>. The adapter reads
WTI (Cushing), Brent (Europe), and Henry Hub natural gas series through the
EIA v2 API with a 30-minute cache.

### 12. `FRED_API_KEY` — macro

Request a key at <https://fred.stlouisfed.org/docs/api/api_key.html>. The
adapter reads fed funds, 2Y/10Y treasury yields, CPI, unemployment, and VIX
with a one-hour cache.

## Cache and quota summary

| Provider    | Cache                   | Why                                      |
| ----------- | ----------------------- | ---------------------------------------- |
| YouTube     | 3 h                     | search quota (~56 calls/day at cadence)  |
| NewsAPI     | 5 min (shared snapshot) | free tier 100 calls/day                  |
| OpenWeather | 10 min                  | eight current-condition watch points     |
| Windy       | 60 s                    | signed image URLs expire (10 min free)   |
| Finnhub     | 2 min                   | free tier 60 calls/minute                |
| FIRMS       | 1 h                     | MAP-key transaction budget               |
| ACLED       | 15 min                  | data updated daily; token cached 24 h    |
| OpenSky     | 60 s                    | authenticated call budget (4000/day)     |
| Cloudflare  | 10 min                  | Radar API budget                         |
| EIA         | 30 min                  | weekly/daily series cadence              |
| FRED        | 1 h                     | mostly daily series cadence              |
| AISStream   | live relay              | continuous stream; in-memory 500 vessels |

Failures are cached for at most 120 seconds so providers recover quickly.

## Render configuration

Add the variables you hold in **Render → worldgpz → Environment** (all are
declared in `.env.example` and `render.yaml`):

```dotenv
NEWS_API_KEY=
YOUTUBE_API_KEY=
YOUTUBE_CACHE_SECONDS=10800

AI_API_KEY=
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.3-70b-versatile

WINDY_API_KEY=
OPENWEATHER_API_KEY=
FINNHUB_API_KEY=
NASA_FIRMS_API_KEY=
ACLED_ACCESS_TOKEN=
ACLED_EMAIL=
ACLED_PASSWORD=
AISSTREAM_API_KEY=
OPENSKY_CLIENT_ID=
OPENSKY_CLIENT_SECRET=
OPENSKY_TIMEOUT_MS=20000
CLOUDFLARE_API_TOKEN=
EIA_API_KEY=
FRED_API_KEY=
```

Then redeploy and verify every key at once:

```bash
npm run scan:live -- https://<your-service>.onrender.com
curl -fsS https://<your-service>.onrender.com/api/v1/providers
```

Configured request/response providers should move from `pending` to
`operational` after their first collection. A provider on `degraded` can mean
invalid credentials, missing account permission, quota exhaustion, timeout, or
an upstream outage. Use the public-safe `errorCode` and Render logs; never add
raw credentials to diagnostic output.

Individual endpoints:

```bash
curl -fsS https://<your-service>.onrender.com/api/v1/webcams
curl -fsS https://<your-service>.onrender.com/api/v1/weather
curl -fsS https://<your-service>.onrender.com/api/v1/markets
curl -fsS https://<your-service>.onrender.com/api/v1/fires
curl -fsS https://<your-service>.onrender.com/api/v1/conflicts
curl -fsS https://<your-service>.onrender.com/api/v1/ships
curl -fsS https://<your-service>.onrender.com/api/v1/flights
curl -fsS https://<your-service>.onrender.com/api/v1/outages
curl -fsS https://<your-service>.onrender.com/api/v1/energy
curl -fsS https://<your-service>.onrender.com/api/v1/macro
```

## Troubleshooting

### Provider shows `degraded` after adding the key

1. Confirm the exact variable name (no `VITE_` prefix) and that you redeployed.
2. Check the provider console for an enabled API / issued key.
3. Check quotas: YouTube search quota, NewsAPI plan, FIRMS transactions,
   Finnhub rate limit, OpenSky daily calls.
4. For ACLED: an account may need API access enabled; use a fresh token.
5. For AISStream: the sandbox/network must allow outbound WebSockets.

### All YouTube channels say `quota-or-key-error`

Verify the API is enabled, the key is restricted to YouTube Data API v3, and
search quota remains. Do not repeatedly restart production to force refreshes
— each cold discovery consumes quota.

### Webcam images return 401

Signed Windy image URLs expire. WORLDGPZ refreshes them on page load; if a
panel has been open for a long time, reload the page.

### YouTube player error 101/150

The video owner disabled embedding. Open the linked YouTube page instead.
WORLDGPZ does not bypass embed restrictions.

### NewsAPI works locally but fails on Render

The free Developer plan is not licensed for production. Upgrade to an
eligible plan; ReliefWeb remains the built-in fallback.

### Planned (not yet integrated)

`WINGBITS_API_KEY` (aircraft owner/operator enrichment) and
`UCDP_ACCESS_TOKEN` (additional conflict dataset) are documented but not yet
wired. Add the environment variables only after their adapters ship.

## Security rules

- Keys are read only in `server/src/config.js` and used only server-side.
- No key, token, or bearer value ever appears in API responses.
- The frontend fetches sanitized data only (`/api/v1/*`).
- CSP allows `*.windy.com` images and `webcams.windy.com` embeds; YouTube
  remains privacy-enhanced (`youtube-nocookie.com`).
- Rate limiting applies to all `/api` routes; provider calls are further
  throttled by per-provider caches.
