# Deploy WORLDGPZ on Render

## One service, one origin

The Node web service serves both the API and the compiled React application. Do not deploy the client as a separate static site unless you deliberately configure a separate API origin. Render supplies `PORT`; the application listens on `0.0.0.0`.

1. Merge the release into `main` and create a Render Blueprint from this repository.
2. Review the service and database plans in `render.yaml` before accepting. These are paid resources; Tasklet credits do not pay Render hosting costs.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`. Generate a fresh bcrypt hash locally:

   ```sh
   # Prompts on your machine; the password is not placed in shell command history.
   node --input-type=module -e 'import bcrypt from "bcryptjs"; import readline from "node:readline/promises"; const r=readline.createInterface({input:process.stdin,output:process.stdout}); const p=await r.question("New admin password (visible on this terminal): "); console.log(await bcrypt.hash(p,12)); r.close();'
   ```

   Use a private terminal. The input is visible; do not screen-share it. Paste only the generated hash into Render.
4. The Blueprint generates independent JWT and API-key-encryption secrets. Preserve the encryption secret across redeployments: changing it makes stored credentials unreadable.
5. Add rotated provider credentials as **server-side environment variables**. Never use `VITE_` variables for private keys. Do not paste keys into GitHub files, workflow logs, or the client bundle.
6. The Blueprint attaches the database URL. `DATABASE_SSL=false` is for Render's internal database URL. If you use an external database, configure SSL according to that provider's requirements instead.
7. Deploy. The build installs the locked dependencies, runs the tests, and compiles the client. A failing test stops the release.
8. Confirm `/api/health` responds, open the dashboard, and inspect source health. A healthy web process is not proof that every upstream provider works.
9. Sign in at `/login`. Verify PostgreSQL persistence before saving keys in the administrator console. Test only providers you intend to use and monitor their quotas.

## AI configuration

Choose a provider/model that actually exists in your provider account. `AI_MODEL` is an external API model identifier, not a Tasklet model-profile name. A model advertised inside Tasklet does not establish its availability through OpenAI or OpenRouter.

AI is optional. Missing or unavailable AI should leave the public monitoring feeds and explicitly labelled local briefings usable. Provider terms, account eligibility, quotas, and permissions apply independently of WORLDGPZ.

For OpenRouter, set `OPENROUTER_API_KEY`, leave `AI_API_KEY` and `OPENAI_API_KEY` blank, and leave the endpoint/model overrides blank to use `openai/gpt-4o-mini`. Do not put `gpt-6-luna` into a provider model field solely because it is a Tasklet profile name. Check `generativeAvailable` in source health and the briefing's fallback diagnostics after deployment. An accepted metadata request does not establish generation access.

Add `TAVILY_API_KEY` to enable the authenticated administrator research panel. It is deliberately not part of automatic background refresh or public analyst questions. Its credential Test button checks configuration only; a submitted research query performs a bounded paid search.

## Verification commands

```sh
npm ci
npm --prefix client ci
npm run check
npm run providers:check
```

`check` runs the automated tests, the production build, and a real-process production smoke test. The smoke test strips paid-provider credentials and uses a local ephemeral port. `providers:check` performs read-only public USGS, NASA EONET, Open-Meteo, and ISS checks; upstream outages are reported rather than invented away. GitHub release checks also audit production dependencies.

To run the same fixture-based browser workflow tests used on GitHub:

```sh
npm ci --include=dev
npx playwright install --with-deps chromium
npm run build
npm run test:browser
```

These tests check UI behavior, not live provider credentials. Production hosting does not need Chromium or the browser-test dependency.

## Know what is not guaranteed

- This release does not create a Render account or verify a live Render deployment. Inspect your deployment logs and service health after you deploy.
- Public-source verification does not validate private API keys, payment accounts, Cloudflare tokens, or database credentials.
- Database persistence currently supports the PostgreSQL-backed key vault. It is not a historical event warehouse or a MongoDB adapter.
- Saved watchlists are local to the browser; exports are snapshots, not continuously updated feeds.
- The default map uses public OpenStreetMap tiles for bounded interactive viewing. Follow [the OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/): retain attribution, do not bulk-download or prefetch, and arrange an appropriate hosted/self-hosted basemap before high-traffic use. Public tile capacity is not an enterprise SLA.
- Data and generated analysis may be incomplete or delayed. Do not use this dashboard as the sole authority for emergency, military, navigation, investment, or other high-stakes decisions.
- Credentials shared in a prompt should be rotated. This repository deliberately does not contain them.

## Troubleshooting

**Build failed:** inspect the first failing test/build step; use Node 22 and both committed lockfiles.

**Blank dashboard:** confirm Render ran the build command and that `/assets/…` returns JavaScript, not an HTML fallback.

**Unavailable provider:** check source health, the credential name, provider subscription, and API entitlement. Do not repeatedly force-refresh a throttled source.

**Admin login disabled:** configure the email, bcrypt hash, and a strong JWT secret. Do not reuse passwords exposed in a chat.

**Credential vault resets:** confirm PostgreSQL is connected and its encryption secret has not changed. In-memory mode is explicitly volatile.
