# Deploying WORLDGPZ // GOD'S EYE on Render

The project deploys as **one Node web service** (Express serves the API and the built React app) plus **MongoDB Atlas** for persistence. The old Render PostgreSQL database (`worldgpz-db`) has been removed from `render.yaml` and the codebase entirely.

## Blueprint deploy

1. In Render, choose **New → Blueprint** and point it at this repository.
2. Render reads `render.yaml` and creates:
   - the `worldgpz` Node web service (health check `/api/health`)
3. Fill in the marked environment variables when prompted:
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — bootstrap administrator
   - `MONGODB_URI` — your Atlas connection string (below)
   - optionally every provider key you use (`NEWS_API_KEY`, `YOUTUBE_API_KEY`, `AI_API_KEY`, `WINDY_API_KEY`, `FINNHUB_API_KEY`, `NASA_FIRMS_API_KEY`, `ACLED_*`, `AISSTREAM_API_KEY`, `OPENSKY_*`, `CLOUDFLARE_API_TOKEN`, `EIA_API_KEY`, `FRED_API_KEY`)
4. Deploy. Collections, indexes, and the bootstrap admin are created automatically on first boot.

## MongoDB Atlas setup

1. Create a free M0 cluster (any region) at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. **Database Access**: create a database user (username + password).
3. **Network Access**: add Render's outbound IPs — easiest is `0.0.0.0/0` (Atlas is credentials-protected), or restrict to Render's static outbound IPs if on a paid plan.
4. **Connect → Drivers** and copy the SRV string, then set:

```dotenv
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=worldgpz
```

URL-encode special characters in the password. The service fails fast at boot if `MONGODB_URI` is missing in production — intentional, so a misconfiguration never silently runs without persistence.

## Health and heartbeat

- `GET /api/health` → `{"status":"ok","codename":"gods-eye","version":"3.1.0","autonomous":true,"database":"mongodb-atlas"}`
- `GET /api/v1/pulse` → autonomous heartbeat: beat count, cadence, live feed counts (public-safe).

## AI briefings (optional)

Set `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` to any OpenAI-compatible provider. If the provider errors, times out, or rejects the key, the deterministic rules engine takes over automatically — briefs never break.

## Operations

- Deploys are automatic on push (`autoDeploy: true`).
- Rotate `ADMIN_PASSWORD` in Render and redeploy to invalidate the old password (the bootstrap account reconciles at startup).
- Back up the Atlas cluster before schema or bulk-content changes (Atlas continuous backup / snapshots).
