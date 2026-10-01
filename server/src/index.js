import 'dotenv/config';
import http from 'node:http';
import { Store } from './lib/store.js';
import { KeyVault } from './services/keyVault.js';
import { ProviderRegistry } from './services/providers/registry.js';
import { PulseEngine } from './services/pulse.js';
import { createApp } from './app.js';

const startedAt = Date.now();
const store = new Store();
try {
  await store.initialize();
  if (store.persistent) console.info('[WORLDGPZ] PostgreSQL schema ready.');
  else console.info('[WORLDGPZ] DATABASE_URL not set; database-backed persistence is disabled.');
} catch (error) {
  console.warn(`[WORLDGPZ] PostgreSQL unavailable; continuing with volatile storage: ${error.message}`);
}

const vault = new KeyVault(store);
const loadedKeys = await vault.load();
if (loadedKeys) console.info(`[WORLDGPZ] Loaded ${loadedKeys} encrypted credential(s) from storage.`);
const registry = ProviderRegistry.createDefault({ secretResolver: (key) => vault.get(key) });
const pulse = new PulseEngine(registry);
pulse.start();
registry.startRefreshCycles();
const app = createApp({ registry, store, vault, pulse, startedAt });
const server = http.createServer(app);
const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';

server.listen(port, host, () => {
  console.info(`[WORLDGPZ] God's Eye v2.0 listening on ${host}:${port} — by ThaddeusTechz`);
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
    console.warn('[WORLDGPZ] Admin sign-in is disabled until ADMIN_EMAIL and an admin password/hash are configured.');
  }
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[WORLDGPZ] ${signal} received; shutting down gracefully.`);
  pulse.stop();
  registry.stop();
  server.close(async () => {
    await store.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
