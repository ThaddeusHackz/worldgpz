import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAuthMiddleware } from "./middleware/auth.js";
import { layerCatalog } from "./data/seed.js";
import {
  eventSchema,
  loginSchema,
  parse,
  partialEventSchema,
} from "./schemas.js";

const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  lastLogin: user.last_login ?? user.lastLogin ?? null,
  createdAt: user.created_at ?? user.createdAt,
});

const trend = (total, critical) =>
  Array.from({ length: 12 }, (_, index) => ({
    label: `${String(index * 2).padStart(2, "0")}:00`,
    signals: Math.max(1, Math.round(total * (0.58 + ((index * 7) % 10) / 25))),
    priority: Math.max(
      0,
      Math.round(critical * (0.45 + ((index * 3) % 8) / 18)),
    ),
  }));

const buildOperationalPicture = (events) => {
  const layers = layerCatalog.map((layer) => ({
    ...layer,
    count: events.filter((event) => event.category === layer.id).length,
  }));
  const grouped = new Map();
  for (const event of events) {
    const region =
      event.region === "Global" ? event.country || "Global" : event.region;
    const current = grouped.get(region) || {
      region,
      count: 0,
      weight: 0,
      categories: new Set(),
    };
    current.count += 1;
    current.weight += severityWeight[event.severity] || 1;
    current.categories.add(event.category);
    grouped.set(region, current);
  }
  const regions = [...grouped.values()]
    .map((item) => ({
      region: item.region,
      count: item.count,
      score: Math.min(
        99,
        Math.round(
          (item.weight / Math.max(item.count, 1)) * 21 + item.count * 2,
        ),
      ),
      categories: [...item.categories],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const correlations = regions
    .filter((item) => item.categories.length > 1)
    .slice(0, 5)
    .map((item) => ({
      id: `correlation-${item.region.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      region: item.region,
      score: item.score,
      signalCount: item.count,
      categories: item.categories,
      statement: `${item.categories.length} independent signal categories are active in the same operational area.`,
    }));
  return { layers, regions, correlations };
};

export function createApp({ config, store, liveSources, intelligence }) {
  const app = express();
  const { authenticate, adminOnly } = createAuthMiddleware(config);

  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    req.id = req.get("x-request-id") || randomUUID();
    res.set("x-request-id", req.id);
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https://*.basemaps.cartocdn.com",
            "https://*.tile.openstreetmap.org",
          ],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin))
          return callback(null, true);
        return callback(new Error("Origin not permitted"));
      },
      credentials: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "100kb", strict: true }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.env === "test" ? 10_000 : 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: "Request limit reached. Try again shortly.",
    },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.env === "test" ? 10_000 : 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      success: false,
      error: "Too many login attempts. Try again in 15 minutes.",
    },
  });
  const briefLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.env === "test" ? 10_000 : 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: "Briefing limit reached. Try again shortly.",
    },
  });
  app.use("/api", apiLimiter);

  app.get("/api/health", async (_req, res) => {
    res.set("cache-control", "no-store").json({
      status: "ok",
      service: "worldgpz",
      version: "2.0.0",
      time: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database: config.databaseUrl ? "postgresql" : "local",
    });
  });

  app.get("/api/v1/dashboard", async (_req, res, next) => {
    try {
      const [{ items: curated }, snapshot] = await Promise.all([
        store.listEvents({ limit: 100 }),
        liveSources.snapshot(),
      ]);
      const events = [
        ...curated,
        ...(snapshot.earthquakes || []),
        ...(snapshot.weather || []),
        ...(snapshot.natural || []),
      ].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      const critical = events.filter(
        (event) => event.severity === "critical",
      ).length;
      const high = events.filter((event) => event.severity === "high").length;
      const weight = events.reduce(
        (sum, event) => sum + (severityWeight[event.severity] || 1),
        0,
      );
      const riskScore = Math.min(
        99,
        Math.max(
          18,
          Math.round((weight / Math.max(events.length, 1)) * 19 + critical * 2),
        ),
      );
      const onlineSources = snapshot.sourceStatus.filter(
        (source) => source.status === "operational",
      ).length;
      const operationalPicture = buildOperationalPicture(events);
      res
        .set("cache-control", "public, max-age=60, stale-while-revalidate=240")
        .json({
          success: true,
          data: {
            metrics: {
              activeSignals: events.length,
              criticalSignals: critical,
              seismic24h: snapshot.earthquakes.length,
              sourcesOnline: onlineSources,
              sourcesTotal: snapshot.sourceStatus.length,
              riskScore,
              highPriority: high + critical,
            },
            events: events.slice(0, 40),
            news: snapshot.news,
            sourceStatus: snapshot.sourceStatus,
            trend: trend(events.length, critical + high),
            layers: operationalPicture.layers,
            regions: operationalPicture.regions,
            correlations: operationalPicture.correlations,
            generatedAt: snapshot.fetchedAt,
            mode: "live-plus-curated",
          },
        });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/events", async (req, res, next) => {
    try {
      const result = await store.listEvents({
        category: req.query.category,
        severity: req.query.severity,
        query: String(req.query.q || "").slice(0, 100),
        limit: req.query.limit,
      });
      res.json({
        success: true,
        data: result.items,
        meta: { total: result.total },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/sources", async (_req, res, next) => {
    try {
      const snapshot = await liveSources.snapshot();
      res.json({
        success: true,
        data: snapshot.sourceStatus,
        generatedAt: snapshot.fetchedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/news", async (_req, res, next) => {
    try {
      const snapshot = await liveSources.snapshot();
      res.json({
        success: true,
        data: snapshot.news,
        generatedAt: snapshot.fetchedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/v1/intelligence/brief",
    briefLimiter,
    async (_req, res, next) => {
      try {
        const [{ items }, snapshot] = await Promise.all([
          store.listEvents({ limit: 40 }),
          liveSources.snapshot(),
        ]);
        const brief = await intelligence.generate(
          [
            ...items,
            ...(snapshot.earthquakes || []),
            ...(snapshot.weather || []),
            ...(snapshot.natural || []),
          ].slice(0, 40),
          snapshot,
        );
        res.set("cache-control", "no-store").json({
          success: true,
          data: brief,
          generatedAt: new Date().toISOString(),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post("/api/auth/login", authLimiter, async (req, res, next) => {
    try {
      const result = parse(loginSchema, req.body);
      if (result.error)
        return res.status(400).json({
          success: false,
          error: "Invalid login request",
          details: result.error,
        });
      const user = await store.getUserByEmail(result.data.email);
      const valid =
        user &&
        (await bcrypt.compare(result.data.password, user.password_hash));
      if (!valid)
        return res
          .status(401)
          .json({ success: false, error: "Email or password is incorrect" });
      await store.recordLogin(user.id);
      const token = jwt.sign(
        { sub: user.id, email: user.email, role: user.role, name: user.name },
        config.jwtSecret,
        {
          expiresIn: config.jwtExpiresIn,
          issuer: "worldgpz",
          audience: "worldgpz-admin",
        },
      );
      await store.addAudit({
        actorEmail: user.email,
        action: "auth.login",
        entityType: "session",
        metadata: { requestId: req.id },
      });
      return res.json({
        success: true,
        token,
        user: publicUser(user),
        expiresIn: config.jwtExpiresIn,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/auth/me", authenticate, async (req, res, next) => {
    try {
      const user = await store.getUserById(req.user.sub);
      if (!user)
        return res
          .status(401)
          .json({ success: false, error: "Account no longer exists" });
      return res.set("cache-control", "no-store").json({ success: true, user });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/logout", authenticate, async (req, res, next) => {
    try {
      await store.addAudit({
        actorEmail: req.user.email,
        action: "auth.logout",
        entityType: "session",
        metadata: { requestId: req.id },
      });
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });

  app.get(
    "/api/admin/overview",
    authenticate,
    adminOnly,
    async (_req, res, next) => {
      try {
        const [stats, audits] = await Promise.all([
          store.getStats(),
          store.listAudits(8),
        ]);
        res
          .set("cache-control", "no-store")
          .json({ success: true, data: { stats, audits } });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/api/admin/events",
    authenticate,
    adminOnly,
    async (req, res, next) => {
      try {
        const result = await store.listEvents({
          query: String(req.query.q || "").slice(0, 100),
          limit: 200,
        });
        res.set("cache-control", "no-store").json({
          success: true,
          data: result.items,
          meta: { total: result.total },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/admin/events",
    authenticate,
    adminOnly,
    async (req, res, next) => {
      try {
        const result = parse(eventSchema, req.body);
        if (result.error)
          return res.status(400).json({
            success: false,
            error: "Event validation failed",
            details: result.error,
          });
        const event = await store.createEvent(result.data);
        await store.addAudit({
          actorEmail: req.user.email,
          action: "event.create",
          entityType: "event",
          entityId: event.id,
          metadata: { title: event.title },
        });
        return res.status(201).json({ success: true, data: event });
      } catch (error) {
        return next(error);
      }
    },
  );

  app.patch(
    "/api/admin/events/:id",
    authenticate,
    adminOnly,
    async (req, res, next) => {
      try {
        const result = parse(partialEventSchema, req.body);
        if (result.error)
          return res.status(400).json({
            success: false,
            error: "Event validation failed",
            details: result.error,
          });
        const event = await store.updateEvent(req.params.id, result.data);
        if (!event)
          return res
            .status(404)
            .json({ success: false, error: "Event not found" });
        await store.addAudit({
          actorEmail: req.user.email,
          action: "event.update",
          entityType: "event",
          entityId: event.id,
          metadata: { title: event.title },
        });
        return res.json({ success: true, data: event });
      } catch (error) {
        return next(error);
      }
    },
  );

  app.delete(
    "/api/admin/events/:id",
    authenticate,
    adminOnly,
    async (req, res, next) => {
      try {
        const deleted = await store.deleteEvent(req.params.id);
        if (!deleted)
          return res
            .status(404)
            .json({ success: false, error: "Event not found" });
        await store.addAudit({
          actorEmail: req.user.email,
          action: "event.delete",
          entityType: "event",
          entityId: req.params.id,
        });
        return res.json({ success: true });
      } catch (error) {
        return next(error);
      }
    },
  );

  app.get(
    "/api/admin/audit",
    authenticate,
    adminOnly,
    async (req, res, next) => {
      try {
        const items = await store.listAudits(req.query.limit);
        res
          .set("cache-control", "no-store")
          .json({ success: true, data: items });
      } catch (error) {
        next(error);
      }
    },
  );

  const clientDist = path.join(config.root, "client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(
      express.static(clientDist, {
        maxAge: config.env === "production" ? "1y" : 0,
        index: false,
      }),
    );
    app.get(/^(?!\/api).*/, (_req, res) =>
      res.sendFile(path.join(clientDist, "index.html")),
    );
  }

  app.use("/api", (_req, res) =>
    res.status(404).json({ success: false, error: "API route not found" }),
  );

  app.use((error, req, res, _next) => {
    const status =
      error.type === "entity.too.large"
        ? 413
        : error.message === "Origin not permitted"
          ? 403
          : 500;
    if (config.env !== "test") {
      console.error(
        JSON.stringify({
          level: "error",
          requestId: req.id,
          method: req.method,
          path: req.path,
          message: error.message,
        }),
      );
    }
    res.status(status).json({
      success: false,
      error:
        status === 500 ? "An unexpected server error occurred" : error.message,
      requestId: req.id,
    });
  });

  return app;
}
