import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";
import { createSeedEvents } from "./data/seed.js";

const { Pool } = pg;

const toEvent = (row) => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  category: row.category,
  severity: row.severity,
  status: row.status,
  region: row.region,
  country: row.country,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  sourceName: row.source_name ?? row.sourceName,
  sourceUrl: row.source_url ?? row.sourceUrl ?? "",
  publishedAt: row.published_at ?? row.publishedAt,
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
});

const toPublicUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  lastLogin: row.last_login ?? row.lastLogin ?? null,
  createdAt: row.created_at ?? row.createdAt,
});

export class Store {
  constructor(options) {
    this.databaseUrl = options.databaseUrl;
    this.databaseSsl = options.databaseSsl;
    this.localDataFile = options.localDataFile;
    this.admin = options.admin;
    this.pool = null;
    this.memoryOnly = this.localDataFile === ":memory:";
    this.data = { users: [], events: [], audits: [] };
  }

  async init() {
    if (this.databaseUrl) {
      this.pool = new Pool({
        connectionString: this.databaseUrl,
        ssl: this.databaseSsl ? { rejectUnauthorized: false } : false,
        max: 8,
        idleTimeoutMillis: 30_000,
      });
      await this.#initPostgres();
    } else {
      await this.#initLocal();
    }
    await this.#seed();
    return this;
  }

  async close() {
    if (this.pool) await this.pool.end();
  }

  async #initPostgres() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        region TEXT NOT NULL,
        country TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL DEFAULT '',
        published_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_email TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS events_published_at_idx ON events (published_at DESC);
      CREATE INDEX IF NOT EXISTS events_category_idx ON events (category);
      CREATE INDEX IF NOT EXISTS audit_created_at_idx ON audit_logs (created_at DESC);
    `);
  }

  async #initLocal() {
    if (this.memoryOnly) return;
    try {
      this.data = JSON.parse(await fs.readFile(this.localDataFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.#persist();
    }
  }

  async #seed() {
    const existingUser = await this.getUserByEmail(this.admin.email);
    if (!existingUser) {
      const user = {
        id: randomUUID(),
        email: this.admin.email,
        name: this.admin.name,
        passwordHash: await bcrypt.hash(this.admin.password, 12),
        role: "admin",
        lastLogin: null,
        createdAt: new Date().toISOString(),
      };
      if (this.pool) {
        await this.pool.query(
          "INSERT INTO users (id, email, name, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
          [user.id, user.email, user.name, user.passwordHash, user.role],
        );
      } else {
        this.data.users.push(user);
      }
    }

    if ((await this.listEvents({ limit: 1 })).items.length === 0) {
      for (const event of createSeedEvents())
        await this.createEvent(event, false);
    }
    if (!this.pool) await this.#persist();
  }

  async #persist() {
    if (this.pool || this.memoryOnly) return;
    await fs.mkdir(path.dirname(this.localDataFile), { recursive: true });
    const temporary = `${this.localDataFile}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(this.data, null, 2));
    await fs.rename(temporary, this.localDataFile);
  }

  async getUserByEmail(email) {
    if (this.pool) {
      const { rows } = await this.pool.query(
        "SELECT * FROM users WHERE email = $1 LIMIT 1",
        [email.toLowerCase()],
      );
      return rows[0] || null;
    }
    const user = this.data.users.find(
      (item) => item.email === email.toLowerCase(),
    );
    if (!user) return null;
    return { ...user, password_hash: user.passwordHash };
  }

  async getUserById(id) {
    if (this.pool) {
      const { rows } = await this.pool.query(
        "SELECT * FROM users WHERE id = $1 LIMIT 1",
        [id],
      );
      return rows[0] ? toPublicUser(rows[0]) : null;
    }
    const user = this.data.users.find((item) => item.id === id);
    return user ? toPublicUser(user) : null;
  }

  async recordLogin(id) {
    const now = new Date().toISOString();
    if (this.pool) {
      await this.pool.query("UPDATE users SET last_login = $1 WHERE id = $2", [
        now,
        id,
      ]);
    } else {
      const user = this.data.users.find((item) => item.id === id);
      if (user) user.lastLogin = now;
      await this.#persist();
    }
  }

  async listEvents({ category, severity, query, limit = 50 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    if (this.pool) {
      const values = [];
      const clauses = [];
      if (category && category !== "all") {
        values.push(category);
        clauses.push(`category = $${values.length}`);
      }
      if (severity && severity !== "all") {
        values.push(severity);
        clauses.push(`severity = $${values.length}`);
      }
      if (query) {
        values.push(`%${query}%`);
        clauses.push(
          `(title ILIKE $${values.length} OR summary ILIKE $${values.length} OR region ILIKE $${values.length})`,
        );
      }
      values.push(safeLimit);
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const { rows } = await this.pool.query(
        `SELECT * FROM events ${where} ORDER BY published_at DESC LIMIT $${values.length}`,
        values,
      );
      return { items: rows.map(toEvent), total: rows.length };
    }

    let items = this.data.events.map(toEvent);
    if (category && category !== "all")
      items = items.filter((item) => item.category === category);
    if (severity && severity !== "all")
      items = items.filter((item) => item.severity === severity);
    if (query) {
      const needle = query.toLowerCase();
      items = items.filter((item) =>
        `${item.title} ${item.summary} ${item.region}`
          .toLowerCase()
          .includes(needle),
      );
    }
    items.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return { items: items.slice(0, safeLimit), total: items.length };
  }

  async createEvent(input, persist = true) {
    const now = new Date().toISOString();
    const event = {
      id: input.id || randomUUID(),
      ...input,
      sourceName: input.sourceName || "WORLDGPZ Admin",
      sourceUrl: input.sourceUrl || "",
      publishedAt: input.publishedAt || now,
      createdAt: now,
      updatedAt: now,
    };
    if (this.pool) {
      const { rows } = await this.pool.query(
        `INSERT INTO events
          (id, title, summary, category, severity, status, region, country, latitude, longitude, source_name, source_url, published_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          event.id,
          event.title,
          event.summary,
          event.category,
          event.severity,
          event.status,
          event.region,
          event.country,
          event.latitude,
          event.longitude,
          event.sourceName,
          event.sourceUrl,
          event.publishedAt,
          now,
          now,
        ],
      );
      return toEvent(rows[0]);
    }
    this.data.events.push(event);
    if (persist) await this.#persist();
    return toEvent(event);
  }

  async updateEvent(id, input) {
    const existing = (await this.listEvents({ limit: 200 })).items.find(
      (item) => item.id === id,
    );
    if (!existing) return null;
    const event = {
      ...existing,
      ...input,
      id,
      updatedAt: new Date().toISOString(),
    };
    if (this.pool) {
      const { rows } = await this.pool.query(
        `UPDATE events SET title=$1, summary=$2, category=$3, severity=$4, status=$5, region=$6, country=$7,
          latitude=$8, longitude=$9, source_name=$10, source_url=$11, published_at=$12, updated_at=$13
         WHERE id=$14 RETURNING *`,
        [
          event.title,
          event.summary,
          event.category,
          event.severity,
          event.status,
          event.region,
          event.country,
          event.latitude,
          event.longitude,
          event.sourceName,
          event.sourceUrl,
          event.publishedAt,
          event.updatedAt,
          id,
        ],
      );
      return rows[0] ? toEvent(rows[0]) : null;
    }
    const index = this.data.events.findIndex((item) => item.id === id);
    this.data.events[index] = event;
    await this.#persist();
    return toEvent(event);
  }

  async deleteEvent(id) {
    if (this.pool) {
      const result = await this.pool.query("DELETE FROM events WHERE id = $1", [
        id,
      ]);
      return result.rowCount > 0;
    }
    const before = this.data.events.length;
    this.data.events = this.data.events.filter((item) => item.id !== id);
    await this.#persist();
    return this.data.events.length !== before;
  }

  async addAudit({
    actorEmail,
    action,
    entityType,
    entityId = null,
    metadata = {},
  }) {
    const audit = {
      id: randomUUID(),
      actorEmail,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    };
    if (this.pool) {
      await this.pool.query(
        "INSERT INTO audit_logs (id, actor_email, action, entity_type, entity_id, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          audit.id,
          audit.actorEmail,
          audit.action,
          audit.entityType,
          audit.entityId,
          audit.metadata,
          audit.createdAt,
        ],
      );
    } else {
      this.data.audits.unshift(audit);
      this.data.audits = this.data.audits.slice(0, 500);
      await this.#persist();
    }
    return audit;
  }

  async listAudits(limit = 50) {
    const safeLimit = Math.min(Number(limit) || 50, 100);
    if (this.pool) {
      const { rows } = await this.pool.query(
        "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1",
        [safeLimit],
      );
      return rows.map((row) => ({
        id: row.id,
        actorEmail: row.actor_email,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata,
        createdAt: row.created_at,
      }));
    }
    return this.data.audits.slice(0, safeLimit);
  }

  async getStats() {
    const { items } = await this.listEvents({ limit: 200 });
    const byCategory = items.reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + 1;
      return result;
    }, {});
    return {
      totalEvents: items.length,
      criticalEvents: items.filter((item) => item.severity === "critical")
        .length,
      highPriority: items.filter((item) =>
        ["critical", "high"].includes(item.severity),
      ).length,
      monitoredRegions: new Set(items.map((item) => item.region)).size,
      byCategory,
    };
  }
}
