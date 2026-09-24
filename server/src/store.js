import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createSeedEvents } from "./data/seed.js";

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

export const toPublicUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  lastLogin: row.last_login ?? row.lastLogin ?? null,
  createdAt: row.created_at ?? row.createdAt,
});

/**
 * Local JSON store — development and test persistence. Atomic writes,
 * zero external dependencies. Production uses MongoStore (MongoDB Atlas).
 */
export class Store {
  constructor(options) {
    this.localDataFile = options.localDataFile;
    this.admin = options.admin;
    this.memoryOnly = this.localDataFile === ":memory:";
    this.data = { users: [], events: [], audits: [], settings: {} };
    this.data.settings ??= {};
  }

  async init() {
    await this.#initLocal();
    await this.#seed();
    return this;
  }

  async close() {
    /* nothing to release */
  }

  async #initLocal() {
    if (this.memoryOnly) return;
    try {
      this.data = JSON.parse(await fs.readFile(this.localDataFile, "utf8"));
      this.data.settings ??= {};
      this.data.users ??= [];
      this.data.events ??= [];
      this.data.audits ??= [];
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.#persist();
    }
  }

  async #seed() {
    const defaultUsername = this.admin.username || "admin";
    const existingUser = await this.getUserByEmail(this.admin.email);
    if (!existingUser) {
      const user = {
        id: randomUUID(),
        email: this.admin.email,
        username: defaultUsername,
        name: this.admin.name,
        passwordHash: await bcrypt.hash(this.admin.password, 12),
        role: "admin",
        lastLogin: null,
        createdAt: new Date().toISOString(),
      };
      this.data.users.push(user);
    } else {
      // The deployment environment is the bootstrap administrator's source of
      // truth. Reconcile a rotated password/name at startup so an exposed old
      // password does not remain valid in an existing database.
      const passwordMatches = await bcrypt.compare(
        this.admin.password,
        existingUser.password_hash,
      );
      const nameMatches = existingUser.name === this.admin.name;
      const usernameMatches = existingUser.username === defaultUsername;
      if (!passwordMatches || !nameMatches || !usernameMatches) {
        const passwordHash = passwordMatches
          ? existingUser.password_hash
          : await bcrypt.hash(this.admin.password, 12);
        const user = this.data.users.find(
          (item) => item.id === existingUser.id,
        );
        if (user) {
          user.name = this.admin.name;
          user.username = defaultUsername;
          user.passwordHash = passwordHash;
        }
      }
    }

    if ((await this.listEvents({ limit: 1 })).items.length === 0) {
      for (const event of createSeedEvents())
        await this.createEvent(event, false);
    }
    await this.#persist();
  }

  async #persist() {
    if (this.memoryOnly) return;
    await fs.mkdir(path.dirname(this.localDataFile), { recursive: true });
    const temporary = `${this.localDataFile}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(this.data, null, 2));
    await fs.rename(temporary, this.localDataFile);
  }

  async getUserByEmail(email) {
    const user = this.data.users.find(
      (item) => item.email === email.toLowerCase(),
    );
    if (!user) return null;
    return { ...user, password_hash: user.passwordHash };
  }

  /** Resolve an operator identifier: email address or plain username. */
  async findUser(identifier) {
    const needle = String(identifier || "")
      .trim()
      .toLowerCase();
    if (!needle) return null;
    const user = this.data.users.find(
      (item) =>
        item.email === needle ||
        String(item.username || "").toLowerCase() === needle,
    );
    if (!user) return null;
    return { ...user, password_hash: user.passwordHash };
  }

  /** Durable admin-panel configuration (API keys and provider settings). */
  async getSettings() {
    return { ...(this.data.settings || {}) };
  }

  /** Replace the persisted settings namespace with the provided map. */
  async saveSettings(settings) {
    this.data.settings = { ...settings };
    await this.#persist();
    return this.getSettings();
  }

  async getUserById(id) {
    const user = this.data.users.find((item) => item.id === id);
    return user ? toPublicUser(user) : null;
  }

  async recordLogin(id) {
    const now = new Date().toISOString();
    const user = this.data.users.find((item) => item.id === id);
    if (user) user.lastLogin = now;
    await this.#persist();
  }

  async listEvents({ category, severity, query, limit = 50 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
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
    const index = this.data.events.findIndex((item) => item.id === id);
    this.data.events[index] = event;
    await this.#persist();
    return toEvent(event);
  }

  async deleteEvent(id) {
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
    this.data.audits.unshift(audit);
    this.data.audits = this.data.audits.slice(0, 500);
    await this.#persist();
    return audit;
  }

  async listAudits(limit = 50) {
    const safeLimit = Math.min(Number(limit) || 50, 100);
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
