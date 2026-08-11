import { config, validateProductionConfig } from "./config.js";
import { Store } from "./store.js";
import { LiveSourcesService } from "./services/liveSources.js";
import { IntelligenceService } from "./services/intelligence.js";
import { MediaService } from "./services/media.js";
import { ProviderRegistry } from "./services/providers/registry.js";
import { createApp } from "./app.js";

validateProductionConfig();

const store = await new Store({
  databaseUrl: config.databaseUrl,
  databaseSsl: config.databaseSsl,
  localDataFile: config.localDataFile,
  admin: config.admin,
}).init();

const liveSources = new LiveSourcesService(config);
const intelligence = new IntelligenceService(config);
const media = new MediaService(config);
const providers = new ProviderRegistry(config, {
  media,
  liveSources,
  intelligence,
});
const app = createApp({
  config,
  store,
  liveSources,
  intelligence,
  media,
  providers,
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "WORLDGPZ server listening",
      port: config.port,
      environment: config.env,
      database: config.databaseUrl ? "postgresql" : "local",
    }),
  );
});

async function shutdown(signal) {
  console.log(
    JSON.stringify({
      level: "info",
      message: `${signal} received; shutting down`,
    }),
  );
  server.close(async () => {
    providers.close();
    await store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
