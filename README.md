# WORLDGPZ — God's Eye

### Real-time global signal intelligence dashboard by ThaddeusTechz

**Every signal. One eye on the world.**

WORLDGPZ combines public geospatial feeds, configurable server-side data providers, market and economic indicators, live news, and optional AI summaries in a responsive map-first dashboard. The application degrades gracefully: providers without credentials are identified as **unconfigured**, not represented as live.

## Features

- Dark CARTO/Leaflet map with toggles for earthquakes, natural events, conflict reports, satellite fire detections, weather, flights, ships, ISS, and editorial watchpoints.
- Optional 3D orbital view, live news wire, event stream, country-risk estimates, chokepoints, market quotes, and provider health.
- Server-side provider integrations for USGS, NASA EONET/FIRMS, Open-Meteo/OpenWeather, NewsAPI, GDELT, NOAA SWPC, ReliefWeb, ACLED, OpenSky, AISStream, Finnhub, EIA, FRED, YouTube, Windy, and OpenAI.
- Server-Sent Events for shared snapshots and live connection status.
- Admin sign-in, provider refresh, and API credential management. Stored credentials use AES-256-GCM; PostgreSQL is used when configured. Without a database, credential storage is memory-only and does not survive restart.
- Express serves the built Vite application in production; the client only calls same-origin `/api` routes.

## Run locally

Requirements: Node.js 20+ (22 recommended) and npm.

```sh
npm install
npm --prefix client install
cp .env.example .env
# Edit .env with your own credentials and generated secrets.
npm run dev
# In another terminal:
npm run dev:client
```

Open `http://localhost:5173`. The Vite proxy forwards `/api` requests to the Express server on port 3000. Build production assets with `npm run build`; run tests with `npm test`.

## Configuration and security

- No API key, admin password, JWT secret, or database credential is committed. Use the variable names in `.env.example` or Render's secret environment settings.
- Admin sign-in is disabled until `ADMIN_EMAIL`, `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`), and a strong `JWT_SECRET` are configured. Generate new unique secrets for your own deployment.
- Set `API_KEY_ENCRYPTION_SECRET` to a separate random secret to encrypt admin-managed provider credentials. Losing it makes previously stored credentials unreadable.
- For persistence, configure PostgreSQL through `DATABASE_URL`. If it is not configured, the public dashboard still runs, but admin-managed keys are held only in process memory.
- Keys supplied in a conversation, issue, repository, or public prompt should be considered exposed: rotate them with their provider before production use. This repository intentionally does not copy any of those values.
- The admin panel never returns full key values. Environment-managed values remain the active credential when an environment variable is present.
- Provider coverage depends on valid credentials, subscription permissions, API quotas, upstream availability, and provider terms. A successful integration does not guarantee that every provider account has access to every endpoint or that feeds contain data at every moment.

## Deployment

`render.yaml` defines the Node web service and PostgreSQL database. Review the selected Render plan and configure secrets in the Render dashboard before deploying. Use a bcrypt hash in `ADMIN_PASSWORD_HASH` for production; for example, generate one locally with a trusted password manager/CLI and never commit the plaintext password.

## Data notes

Country-risk scores and chokepoint status are heuristic indicators derived from available feeds and explicitly identified as estimates. They are not official risk assessments, vessel traffic telemetry, or operational advice. Editorial watchpoints are static context markers, not claims of current events.

## Attribution

WORLDGPZ God's Eye is developed by **ThaddeusTechz**.

© 2026 ThaddeusTechz. All rights reserved.
