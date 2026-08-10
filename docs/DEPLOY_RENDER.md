# Deploy WORLDGPZ on Render

The project is designed to deploy as one Node web service plus one PostgreSQL database through the repository's `render.yaml` Blueprint.

## 1. Rotate previously exposed credentials

Before deployment, revoke the old NewsAPI and YouTube keys that appeared in the previous tracked documentation. Do not reuse them. Create fresh provider keys only if you need those optional integrations.

## 2. Prepare private production values

Create these values in a password manager:

- `ADMIN_EMAIL` — an email only the site owner controls.
- `ADMIN_PASSWORD` — a unique password of at least 16 characters.

Render generates `JWT_SECRET` automatically from the Blueprint. Never put any of these values in Git, the README, a screenshot, or a `VITE_*` variable.

## 3. Create the Blueprint

1. Push this branch and merge it into the GitHub branch you want Render to deploy.
2. Sign in to [Render](https://render.com/).
3. Choose **New → Blueprint**.
4. Connect the `ThaddeusHackz/worldgpz` repository.
5. Select the repository branch containing this rebuild.
6. Render detects `render.yaml` and proposes:
   - `worldgpz` Node web service
   - `worldgpz-db` PostgreSQL database
7. Enter the values marked **sync: false**:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - optional production-eligible `NEWS_API_KEY`
   - optional restricted `YOUTUBE_API_KEY`
   - optional `OPENWEATHER_API_KEY`
   - optional `AI_API_KEY`
8. Apply the Blueprint and wait for the first deployment.

If the `free` database plan is unavailable for your account or region, choose Render's current lowest-cost PostgreSQL plan and update the `plan` value in `render.yaml` before applying the Blueprint.

## 4. Verify the deployment

Replace `<service>` with your Render hostname:

```bash
curl -fsS https://<service>.onrender.com/api/health
```

Expected shape:

```json
{
  "status": "ok",
  "service": "worldgpz",
  "version": "2.0.0",
  "database": "postgresql"
}
```

Then verify manually:

1. Open `https://<service>.onrender.com/`.
2. Confirm the map, metrics, filters, and source health cards load.
3. Open `https://<service>.onrender.com/login`.
4. Sign in using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` entered in Render.
5. Create a harmless test signal, edit it, then delete it.
6. Confirm those operations appear in **Admin → Audit trail**.
7. Confirm no secret appears in browser DevTools, page source, or network responses.

## 5. Optional AI briefing

The integration expects an OpenAI-compatible chat-completions endpoint:

```dotenv
AI_API_KEY=<private-key>
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Set these in **Render → worldgpz → Environment**, then redeploy. If the provider is missing or unavailable, the app automatically uses its rules-based briefing engine.

## 6. Custom domain

1. In the web service, open **Settings → Custom Domains**.
2. Add the domain.
3. Add the DNS records Render provides.
4. Wait for Render's managed TLS certificate.
5. Set `APP_URL` to the final `https://` domain if you use it in future integrations.

No `VITE_API_URL` is required because the browser uses same-origin `/api` URLs.

## 7. Ongoing operations

- Enable GitHub branch protection and dependency update alerts.
- Review Render deploy logs after each release.
- Run `npm run verify` before pushing.
- Back up PostgreSQL before schema or bulk-content changes.
- Rotate the admin password and API keys periodically.
- Keep the source disclaimer visible; external provider availability is not guaranteed.

## Troubleshooting

### Deploy fails with “Invalid production configuration”

One of `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, or `DATABASE_URL` is missing or invalid. Check the service environment. The Blueprint should inject the database URL and generate the JWT secret.

### Admin password changed in Render but login still uses the old value

The environment password only bootstraps a missing admin account. It intentionally does not overwrite an existing password at every restart. Use a controlled PostgreSQL credential reset or a future password-reset route.

### Public sources show “degraded”

The dashboard remains available with curated baseline records. Check Render outbound connectivity and provider status. USGS, Open-Meteo, and ReliefWeb can be temporarily unavailable or rate limited.

### Render service sleeps or starts slowly

This can happen on entry-level plans. The health endpoint is `/api/health`; configure an appropriate paid plan when consistent latency is required.
