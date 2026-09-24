import { config, validateProductionConfig } from "./config.js";
import { Store } from "./store.js";
import { MongoStore } from "./store.mongo.js";
import { LiveSourcesService } from "./services/liveSources.js";
import { IntelligenceService } from "./services/intelligence.js";
import { MediaService } from "./services/media.js";
import { ProviderRegistry } from "./services/providers/registry.js";
import { GridPulse } from "./services/pulse.js";
import { createApp } from "./app.js";

validateProductionConfig();

const store = config.mongodbUri
  ? await new MongoStore({
      uri: config.mongodbUri,
      database: config.mongodbDb,
      admin: config.admin,
    }).init()
  : await new Store({
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

/**
 * Autonomous grid pulse — GOD'S EYE never sleeps. A background loop
 * continuously re-acquires every configured feed, keeps caches hot
 * (critical on serverless cold starts), and records a heartbeat that
 * the public /api/v1/pulse endpoint and the HUD report.
 */
const pulse = new GridPulse({ config, liveSources, providers, media });
pulse.start();

const app = createApp({
  config,
  store,
  liveSources,
  intelligence,
  media,
  providers,
  pulse,
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "WORLDGPZ GOD'S EYE listening",
      port: config.port,
      environment: config.env,
      database: config.mongodbUri
        ? `mongodb-atlas:${config.mongodbDb}`
        : "local-json",
      autonomous: "engaged",
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
    pulse.stop();
    providers.close();
    await store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
