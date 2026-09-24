# WORLDGPZ // GOD'S EYE 3.0

**Every signal. One eye on the world.**

A cinematic, production-grade global signal-intelligence grid — a live "situation room" styled after the tactical systems you see in the movies, built on real, working public data infrastructure: orbital telemetry, seismic networks, weather models, natural-event satellites, and humanitarian feeds.

![WORLDGPZ social card](client/public/og-worldgpz.svg)

## What is inside

- **Cinematic GOD'S EYE interface** — power-on boot sequence, radar-sweep acquisition map, target-lock reticles, mouse-tracking coordinate readout, intercept console with live signal log, and a broadcast-style news ticker.
- **Live ISS orbital tracking** — the International Space Station's real position, speed, and altitude are acquired client-side every 5 seconds and plotted on the map (`/api/v1` stays key-free; this layer works everywhere, always).
- **Global scan mode** — one click sweeps the grid with an intensified radar pass and reports how many targets are being tracked.
- **3D ORBITAL GLOBE** — an interactive, draggable holographic globe (in the spirit of [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)) rendering live signals, target locks, HQ intercept traces, and the ISS over a Natural Earth land mask — flip to it with the `3D ORBIT` toggle on the command map or the `3D` button in tactical ops.
- **Autonomous grid pulse** — a server-side heartbeat continuously re-acquires every configured feed, keeps caches hot, and publishes `/api/v1/pulse`; the HUD shows the live heartbeat and the grid auto-sweeps on its own.
- **GDELT 2.0 world-news layer** — real geolocated global news attention (65 languages, 24-hour window) with volume-scaled severity, plus a new _Civil unrest_ lane.
- **NOAA space weather** — live planetary K-index and solar-wind speed from the Space Weather Prediction Center; real geomagnetic storms automatically become grid signals.
- **Realtime SSE stream** — `/api/v1/stream` pushes heartbeats and freshly intercepted signals; the HUD raises "NEW SIGNAL INTERCEPTED" toasts and hot-refreshes the grid without reloads.
- **Live satellite constellation** — genuine SGP4 propagation of CelesTrak TLEs (ISS, Tiangong, Hubble, Terra, Aqua, NOAA, Suomi NPP, Sentinel, Landsat) with real positions, altitudes, and velocities every 5 seconds.
- **DIRECT UPLINK — multi-path acquisition** — the browser itself connects straight to USGS, Open-Meteo, NASA EONET, NOAA SWPC, and GDELT (CORS-enabled public feeds), dedupes against the server relay, and shows the true path per source: **DIRECT / RELAY / OFFLINE**. The grid is provably alive even if the server's outbound network is restricted.
- **Honest analytics** — the signal-velocity chart is a real 24-hour histogram of actual signal timestamps, and the composite watch index breaks down into four measured domains (security, natural, human, systems). Curated baseline rows are explicitly labeled as baseline watches, never passed off as live reports.
- **Command center** (`/`) — animated metric counters, composite watch index, severity filters, signal velocity chart, source health, and AI-assisted (or deterministic fallback) briefings.
- **Tactical ops room** (`/operations`) — full-bleed operational map, time windows, region sectors, independent data layers, command palette (⌘K), live channels, webcams, tracking panels, convergence engine, and mobile command bar.
- **Live source adapters** — USGS M4.5+ earthquakes, Open-Meteo observations, NASA EONET natural events, ReliefWeb reports, and optional NewsAPI — all cached, all attributable.
- **Full admin console** (`/login` → `/admin`) — authenticated event creation, editing, deletion, source health, overview statistics, and a complete audit trail.
- **Persistent data** — MongoDB Atlas in production (`MONGODB_URI`); atomic local JSON storage for development. The Render PostgreSQL database has been fully removed.
- **Security defaults** — server-side secrets, bcrypt password hashes, expiring JWT sessions, role authorization, strict validation, rate limiting, CSP/Helmet headers, parameterized SQL, and generic authentication failures.
- **One-service deployment** — Express serves the API and the optimized React build, avoiding production CORS and cross-service configuration problems.

> GOD'S EYE is a decision-support interface with a movie-grade skin, not an emergency service or an authoritative intelligence source. Consequential claims must be checked against the linked primary source.

## Stack

| Layer      | Technology                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Frontend   | React 19, Vite 8, React Router, React Leaflet, Recharts, Lucide, Orbitron/Rajdhani/Share Tech Mono (self-hosted via Fontsource) |
| Backend    | Node.js 22, Express 5, Zod, JWT, bcrypt                                                                                         |
| Data       | MongoDB Atlas in production; local JSON in development                                                                          |
| Deployment | Render Blueprint (`render.yaml`)                                                                                                |
| Tests      | Vitest + Supertest (API), Vitest + jsdom render smoke tests (UI)                                                                |

## Quick start

Requirements: Node.js 22+ and npm 10+.

```bash
npm install
cp .env.example .env
```

Edit `.env`. At minimum, set unique values for:

```dotenv
JWT_SECRET=<at-least-32-random-characters>
ADMIN_EMAIL=<your-private-admin-email>
ADMIN_PASSWORD=<a-unique-password-with-at-least-12-characters>
```

Generate a JWT secret with:

```bash
openssl rand -base64 48
```

Start both development servers:

```bash
npm run dev
```

- Command center: `http://localhost:5173`
- Tactical ops room: `http://localhost:5173/operations`
- API: `http://localhost:4000/api/health`
- Admin: `http://localhost:5173/login`

For the production-shaped local build:

```bash
npm run build
npm start
# Open http://localhost:4000
```

## Environment variables

All provider credentials belong in the **server environment**. Never prefix private values with `VITE_`; Vite variables are compiled into the public browser bundle. The deployment you already run keeps its existing keys — every adapter below activates automatically when its key is present and degrades silently when it is not.

| Variable                                      | Required            | Purpose                                                                      |
| --------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `JWT_SECRET`                                  | Production          | Signs administrator sessions; 32+ random characters                          |
| `ADMIN_EMAIL`                                 | Production          | Bootstrap administrator email                                                |
| `ADMIN_PASSWORD`                              | Production          | Bootstrap password; 12+ characters                                           |
| `MONGODB_URI`                                 | Production          | MongoDB Atlas connection string (`mongodb+srv://user:pass@cluster/db`)       |
| `MONGODB_DB`                                  | No                  | Database name inside the cluster; defaults to `worldgpz`                     |
| `NEWS_API_KEY`                                | No                  | Adds NewsAPI headlines; ReliefWeb remains the fallback                       |
| `YOUTUBE_API_KEY`                             | No                  | Discovers current live broadcasts; remains server-side                       |
| `YOUTUBE_CACHE_SECONDS`                       | No                  | Live-discovery cache; defaults to 10,800 seconds (3 hours)                   |
| `OPENWEATHER_API_KEY`                         | No                  | Adds eight global current-weather watch points; Open-Meteo remains available |
| `AI_API_KEY`                                  | No                  | Enables an OpenAI-compatible briefing provider                               |
| `AI_BASE_URL`                                 | No                  | Defaults to `https://api.openai.com/v1`                                      |
| `AI_MODEL`                                    | No                  | Defaults to `gpt-4o-mini`                                                    |
| `CORS_ORIGINS`                                | Local/split hosting | Comma-separated allowed browser origins                                      |
| `WINDY_API_KEY`                               | No                  | Global webcam network for the ops room                                       |
| `FINNHUB_API_KEY`                             | No                  | Equities, indices, and crypto quotes                                         |
| `NASA_FIRMS_API_KEY`                          | No                  | Satellite fire/thermal detections                                            |
| `ACLED_ACCESS_TOKEN`                          | No                  | Conflict and protest events                                                  |
| `AISSTREAM_API_KEY`                           | No                  | Live ship positions                                                          |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | No                  | Aircraft tracking                                                            |
| `CLOUDFLARE_API_TOKEN`                        | No                  | Internet outages and traffic anomalies                                       |
| `EIA_API_KEY` / `FRED_API_KEY`                | No                  | Energy prices and macro indicators                                           |

See `.env.example` for the complete list and tuning knobs.

The production database is MongoDB Atlas: set `MONGODB_URI` (and optionally `MONGODB_DB`) in the Render environment and redeploy. Collections (`users`, `events`, `audit_logs`) and indexes are created automatically on first boot; the bootstrap admin is created when its email does not exist. On later starts, the configured `ADMIN_NAME` and `ADMIN_PASSWORD` are reconciled to that bootstrap account, so rotating the password in Render and redeploying invalidates the previous password.

## Scripts

```bash
npm run dev          # API + Vite development servers
npm run build        # Optimized frontend build
npm start            # Express API + built frontend
npm test             # Server API tests + client unit/render tests
npm run verify       # tests + build + production dependency audit
npm run scan:live    # forensic smoke scan against a running deployment
npm run format:check # prettier
```

Example forensic scan:

```bash
npm run scan:live                                # scans https://worldgpz.onrender.com
node scripts/forensic-scan.mjs http://localhost:4000
```

## God's Eye feature map

| Feature            | Where               | How it works                                                               |
| ------------------ | ------------------- | -------------------------------------------------------------------------- |
| Boot sequence      | `BootSequence.jsx`  | Plays once per session, skippable, honors `prefers-reduced-motion`         |
| Radar-sweep map    | `WorldMap.jsx`      | CSS conic sweep + range rings over Leaflet, plus tactical reticle markers  |
| Target locks       | `WorldMap.jsx`      | Click a reticle: dashed HQ→target trace + rotating lock brackets           |
| Orbital tracking   | `useIss.js`         | Live ISS telemetry via `wheretheiss.at` (open-notify fallback)             |
| 3D orbital globe   | `OrbitalGlobe.jsx`  | Canvas dot-globe over a Natural Earth land mask; drag to slew, tap to lock |
| World-news layer   | `parsers.js`        | GDELT GEO 2.0 → geolocated news attention, classified into lanes           |
| Space weather      | `liveSources.js`    | NOAA SWPC Kp + solar wind; Kp ≥ 5 auto-generates a real storm signal       |
| Realtime stream    | `services/pulse.js` | SSE diff of each acquisition → browser toasts + hot refresh                |
| Satellite TLEs     | `services/track.js` | CelesTrak catalogue → client SGP4 (`satellite.js`) positions               |
| Intercept console  | `Dashboard.jsx`     | Live signal log with severity levels and blinking caret                    |
| Live ticker        | `Dashboard.jsx`     | Broadcast-style bottom ticker, pauses on hover, links to sources           |
| Global scan        | `Dashboard.jsx`     | Intensified sweep + system-log entry + target count                        |
| Coordinate readout | `WorldMap.jsx`      | Mouse-tracked lat/lon "TRK" readout                                        |
| Animated counters  | `Dashboard.jsx`     | rAF count-up hook on metric cards                                          |

## License / provenance

Data providers retain ownership of their data. WORLDGPZ presents it with attribution and links to every primary source.
