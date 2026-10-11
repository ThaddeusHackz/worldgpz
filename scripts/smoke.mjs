import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import net from 'node:net';

// Validate the actual production entrypoint and built assets, without paid credentials.
const reservation = net.createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const env = { ...process.env, NODE_ENV: 'production', PORT: String(port), DATABASE_URL: '', ADMIN_EMAIL: '', ADMIN_PASSWORD: '', ADMIN_PASSWORD_HASH: '', JWT_SECRET: '' };
for (const key of Object.keys(env)) if (/(?:API_KEY|ACCESS_KEY|CLIENT_SECRET|ACLED_PASSWORD|ACLED_EMAIL|ENCRYPTION_SECRET)$/.test(key)) delete env[key];
const child = spawn(process.execPath, ['server/src/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let exited = false;
child.on('exit', () => { exited = true; });
// Never forward startup logs: provider errors can include credential-bearing URLs.
child.stdout.resume(); child.stderr.resume();
const origin = `http://127.0.0.1:${port}`;
const get = (path) => fetch(origin + path, { signal: AbortSignal.timeout(5000) });
try {
  let health;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (exited) throw new Error('Production server exited before readiness.');
    try { const response = await get('/api/health'); if (response.ok) { health = await response.json(); break; } } catch {}
    await delay(250);
  }
  assert.equal(health?.status, 'ok', 'Production health check must become ready');
  const home = await get('/');
  assert.equal(home.status, 200);
  const html = await home.text();
  const asset = html.match(/src="(\/assets\/[^" ]+\.js)"/);
  assert.ok(asset, 'Vite built entrypoint must be served');
  const bundle = await get(asset[1]);
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get('content-type'), /javascript/);
  assert.ok(home.headers.get('content-security-policy'));
  assert.equal((await get('/about')).status, 200, 'SPA deep links must work');
  assert.equal((await get('/api/not-a-real-route')).status, 404);
  assert.equal((await get('/api/admin')).status, 401);
  const config = await (await get('/api/config')).json();
  assert.equal(config.authConfigured, false, 'Unset admin secrets must disable login');
  console.log('Production smoke: health, built JS, security headers, SPA routing, API 404, admin access — PASS');
} finally {
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), delay(10_000).then(() => { if (!exited) child.kill('SIGKILL'); })]);
}
