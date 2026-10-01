import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { ProviderRegistry } from '../src/services/providers/registry.js';
import { KeyVault } from '../src/services/keyVault.js';

function saveEnvironment() {
  const names = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH', 'ADMIN_NAME', 'JWT_SECRET', 'API_KEY_ENCRYPTION_SECRET', 'FINNHUB_API_KEY', 'NODE_ENV'];
  const prior = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  return () => names.forEach((name) => prior[name] === undefined ? delete process.env[name] : process.env[name] = prior[name]);
}

test('admin session uses an httpOnly cookie and provider credentials are masked', async (t) => {
  const restore = saveEnvironment();
  t.after(restore);
  process.env.ADMIN_EMAIL = 'operator@example.test';
  process.env.ADMIN_PASSWORD = 'unit-test-password-only';
  delete process.env.ADMIN_PASSWORD_HASH;
  process.env.ADMIN_NAME = 'Test Operator';
  process.env.JWT_SECRET = 'unit-test-jwt-signing-secret-at-least-32-characters';
  process.env.API_KEY_ENCRYPTION_SECRET = 'unit-test-api-encryption-secret-at-least-32-chars';
  delete process.env.FINNHUB_API_KEY;
  process.env.NODE_ENV = 'test';

  const registry = ProviderRegistry.createDefault({ secretResolver: () => undefined });
  const store = { persistent: false, initialized: false };
  const vault = new KeyVault(store);
  const app = createApp({ registry, store, vault, pulse: { addClient() {} }, startedAt: Date.now() });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const loginResponse = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'operator@example.test', password: 'unit-test-password-only' }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  const session = cookie.split(';')[0];
  const adminResponse = await fetch(`${base}/api/admin`, { headers: { Cookie: session } });
  assert.equal(adminResponse.status, 200);

  const saveResponse = await fetch(`${base}/api/admin/keys`, {
    method: 'POST', headers: { Cookie: session, 'content-type': 'application/json' },
    body: JSON.stringify({ keys: [{ keyName: 'FINNHUB_API_KEY', value: 'unit-test-financial-credential' }] }),
  });
  assert.equal(saveResponse.status, 200);
  assert.equal(vault.get('FINNHUB_API_KEY'), 'unit-test-financial-credential');
  const listResponse = await fetch(`${base}/api/admin/keys`, { headers: { Cookie: session } });
  const list = await listResponse.json();
  const key = list.keys.find((item) => item.keyName === 'FINNHUB_API_KEY');
  assert.equal(key.source, 'stored');
  assert.equal(key.hasValue, true);
  assert.notEqual(key.value, 'unit-test-financial-credential');
  assert.ok(key.value.includes('•'));
  assert.equal(list.persistence, 'memory');
  const logsResponse = await fetch(`${base}/api/admin/logs`, { headers: { Cookie: session } });
  const logsPayload = await logsResponse.json();
  assert.equal(logsResponse.status, 200);
  assert.ok(logsPayload.logs.some((entry) => entry.path === '/api/auth/login'));
  const serializedLogs = JSON.stringify(logsPayload);
  assert.equal(serializedLogs.includes('unit-test-password-only'), false);
  assert.equal(serializedLogs.includes('unit-test-financial-credential'), false);
  registry.stop();
});
