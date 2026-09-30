# WORLDGPZ — God’s Eye

### Real-time global signal intelligence dashboard by ThaddeusTechz

**Every signal. One eye on the world.**

WORLDGPZ combines public geospatial feeds, configurable server-side provider adapters, market and economic indicators, live news, and optional AI-assisted analysis in a responsive map-led dashboard. Integrations are proxied by Express; the browser calls same-origin `/api` routes and never receives provider credentials. When a source is unavailable or unconfigured, the interface reports its state rather than presenting fabricated live data.

## Features

- Responsive dark dashboard with a Leaflet/CARTO 2D map, optional Three.js orbital globe, searchable locations, selectable signal layers, live event stream, and keyboard shortcuts.
- Event, news, weather, aviation, maritime, ISS, satellite-fire, market, energy, macroeconomic, webcam and AI-briefing panels.
- Server-Sent Events for shared provider snapshots, provider health, and connection status.
- Provider caching, request timeouts, stale/partial-data handling, and per-source health reporting.
- Admin sign-in with HTTP-only session cookies, provider refresh/test tools, an in-memory operational log, and API-key management. Admin-managed keys are encrypted with AES-256-GCM before storage; PostgreSQL-backed storage is enabled by the Render blueprint.
- Express serves the built Vite application in production; no cross-origin client API calls are required.

## Provider coverage

The application registers 18 server-side sources. Availability depends on provider access, credentials, terms, quotas, and upstream status.

| Source | Dashboard role | Configuration |
|---|---|---|
| USGS | Earthquakes | Public feed |
| NASA EONET | Natural events | Public feed |
| GDELT | News fallback / intelligence | Public feed |
| NOAA SWPC | Space weather | Public feed |
| ReliefWeb | Humanitarian reports | Public feed |
| Open-Meteo / OpenWeather | Global weather | Open-Meteo public; `OPENWEATHER_API_KEY` optional |
| NewsAPI | News wire | `NEWS_API_KEY`; GDELT fallback |
| ACLED | Conflict reports | `ACLED_EMAIL`, `ACLED_PASSWORD` and eligible API access |
| OpenSky | Aircraft positions | `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` |
| AISStream | Vessel positions | `AISSTREAM_API_KEY` and an active WebSocket entitlement |
| NASA FIRMS | Satellite fire detections | `NASA_FIRMS_API_KEY` |
| Finnhub | Market quotes / FX | `FINNHUB_API_KEY` |
| U.S. EIA | Energy series | `EIA_API_KEY` |
| FRED | Economic series | `FRED_API_KEY` |
| Windy | Webcam metadata | `WINDY_API_KEY` |
| YouTube Data API | Search for public live streams | `YOUTUBE_API_KEY` |
| OpenAI-compatible API | Optional news briefing | `AI_API_KEY`; configurable base URL and model |
| Where The ISS At | ISS position | Public feed |

The newsroom can use GDELT when NewsAPI is absent or unavailable; weather uses Open-Meteo when OpenWeather is absent or fails; the briefing uses a clearly labelled local headline digest without an AI key. These fallbacks do not imply that data is complete or verified.

## Run locally

Requirements: Node.js 20+ (Node 22 recommended) and npm.

```sh
npm ci
npm --prefix client ci
cp .env.example .env
# Add only credentials you control to the server-side .env file.
npm start
```

In a second terminal, run the Vite development client:

```sh
npm --prefix client run dev
```

Open `http://localhost:5173`; Vite forwards `/api` to Express on port 3000. For production-like local serving, run `npm run build` and then `npm start` to serve `client/dist` through Express. Run the automated suite with `npm test`.

## Configuration and security

- No real API key, admin password, JWT secret, or database credential is committed. `.env.example` contains names and blank placeholders only.
- Admin sign-in stays disabled until `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (recommended) or `ADMIN_PASSWORD`, and a unique `JWT_SECRET` of at least 32 characters are configured.
- Set a separate, unique `API_KEY_ENCRYPTION_SECRET` for admin-managed keys. Keep it safe and backed up: losing it makes encrypted database values unreadable.
- Set `DATABASE_URL` to PostgreSQL for credentials to persist across restarts. Without it, keys saved through the panel are encrypted in process memory only and will be lost on restart.
- Deployment environment variables override admin-stored values. Full credential values are never returned by the admin API; the panel displays only a mask.
- Treat credentials pasted into chats, issues, logs, or public prompts as exposed. Revoke and rotate them with each provider before using this deployment. This repository does not copy credentials from a prompt.
- API-key entry and authentication are server-side. Logs intentionally omit request bodies, headers, cookies, query strings, and credential values.

## Render deployment

`render.yaml` defines the Node web service and a PostgreSQL database. It uses Render's current `0.5c-512mb` web-service and `0.1c-256mb` Postgres plan IDs; review the selected plans, region, and billing before creating the blueprint because these plans may incur charges ([Render compute-plan reference](https://render.com/docs/compute-plans)).

1. Create the Blueprint from the intended repository branch and review the service/database plan.
2. In the Render dashboard, set the unsynchronized values: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, and `API_KEY_ENCRYPTION_SECRET`. Add optional provider credentials only when available.
3. Use a newly generated bcrypt password hash for `ADMIN_PASSWORD_HASH`; do not enter or commit a production plaintext password. Use distinct random values for the JWT and key-encryption secrets.
4. Confirm `DATABASE_URL` is attached by the blueprint and inspect `/api/health` and `/api/providers/health` after the deploy.
5. Open `/login`, sign in, and verify the admin console reports PostgreSQL storage before saving provider credentials.

The repository includes the Render blueprint and production build command, but a deployment and live upstream-provider verification have **not** been performed from this workspace. A green application health check only confirms the web process responds; provider availability is shown separately.

## HTTP endpoints

- `GET /api/health`, `GET /api/providers/health`
- `GET /api/events` and `/api/events/{seismic,natural,conflicts,fires}`
- `GET /api/news`, `GET /api/news/headlines`, `GET /api/intel`, `/api/intel/briefing`, `/api/intel/sentiment`, `/api/intel/focal-points`
- `GET /api/weather`, `/api/weather/:city`, `/api/flights`, `/api/flights/military`, `/api/ships`, `/api/iss`
- `GET /api/markets`, `/api/markets/forex`, `/api/energy`, `/api/economics`, `/api/media/webcams` and `/api/media/webcams/:region`
- `GET /api/situational`, `/api/situational/countries`, `/api/situational/chokepoints`, `/api/situational/risk`
- `GET /api/stream` (Server-Sent Events)
- `/api/admin/*` and `/api/auth/*` are protected by server-side authentication where applicable.

## Data notes

Country-risk scores and strategic-risk/chokepoint statuses are heuristic indicators derived from available feeds and editorial baselines. They are not official risk assessments, verified forecasts, vessel-traffic telemetry, closure notices, or operational advice. Context watchpoints are static markers, not current event reports. Provider records may be delayed, incomplete, rate-limited, or unavailable.

## Attribution

WORLDGPZ God’s Eye is developed by **ThaddeusTechz**.

© 2026 ThaddeusTechz. All rights reserved.
