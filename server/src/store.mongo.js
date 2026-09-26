import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { createSeedEvents } from "./data/seed.js";
import { toPublicUser } from "./store.js";

const toDoc = (input) => ({
  id: input.id,
  title: input.title,
  summary: input.summary,
  category: input.category,
  severity: input.severity,
  status: input.status,
  region: input.region,
  country: input.country,
  latitude: Number(input.latitude),
  longitude: Number(input.longitude),
  sourceName: input.sourceName,
  sourceUrl: input.sourceUrl || "",
  publishedAt: input.publishedAt,
  createdAt: input.createdAt,
  updatedAt: input.updatedAt,
});

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * MongoDB Atlas store — production persistence for GOD'S EYE.
 * Same contract as the local JSON store: the REST layer never knows
 * which backend is active. Collections: users, events, audit_logs.
 */
export class MongoStore {
  constructor({ uri, database = "worldgpz", admin }) {
    this.uri = uri;
    this.databaseName = database;
    this.admin = admin;
    this.client = null;
    this.db = null;
    /** Identifies the backend for the console's durability report. */
    this.kind = "mongodb";
  }

  async init() {
    this.client = new MongoClient(this.uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 8,
      appName: "worldgpz-gods-eye",
    });
    await this.client.connect();
    this.db = this.client.db(this.databaseName);
    await this.#initCollections();
    await this.#seed();
    return this;
  }

  async close() {
    if (this.client) await this.client.close();
  }

  async #initCollections() {
    await this.db
      .collection("events")
      .createIndexes([
        { key: { publishedAt: -1 } },
        { key: { category: 1 } },
        { key: { severity: 1 } },
      ]);
    await this.db.collection("audit_logs").createIndex({ createdAt: -1 });
    await this.db
      .collection("users")
      .createIndex({ email: 1 }, { unique: true });
    await this.db.collection("users").createIndex({ username: 1 });
    await this.db.collection("settings").createIndex({ updatedAt: -1 });
  }

  async #seed() {
    const defaultUsername = this.admin.username || "admin";
    const users = this.db.collection("users");
    const existingUser = await users.findOne({
      email: this.admin.email.toLowerCase(),
    });
    if (!existingUser) {
      await users.insertOne({
        _id: randomUUID(),
        id: null,
        email: this.admin.email.toLowerCase(),
        username: defaultUsername,
        name: this.admin.name,
        passwordHash: await bcrypt.hash(this.admin.password, 12),
        role: "admin",
        lastLogin: null,
        createdAt: new Date().toISOString(),
      });
    } else {
      // The deployment environment is the bootstrap administrator's source of
      // truth. Reconcile a rotated password/name/username at startup.
      const passwordMatches = await bcrypt.compare(
        this.admin.password,
        existingUser.passwordHash,
      );
      const nameMatches = existingUser.name === this.admin.name;
      const usernameMatches = existingUser.username === defaultUsername;
      if (!passwordMatches || !nameMatches || !usernameMatches) {
        const passwordHash = passwordMatches
          ? existingUser.passwordHash
          : await bcrypt.hash(this.admin.password, 12);
        await users.updateOne(
          { _id: existingUser._id },
          {
            $set: {
              name: this.admin.name,
              username: defaultUsername,
              passwordHash,
            },
          },
        );
      }
    }

    if ((await this.listEvents({ limit: 1 })).items.length === 0) {
      for (const event of createSeedEvents()) await this.createEvent(event);
    }
  }

  async getUserByEmail(email) {
    const user = await this.db
      .collection("users")
      .findOne({ email: String(email).toLowerCase() });
    if (!user) return null;
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLogin: user.lastLogin ?? null,
      createdAt: user.createdAt,
      password_hash: user.passwordHash,
    };
  }

  /** Resolve an operator identifier: email address or plain username. */
  async findUser(identifier) {
    const needle = String(identifier || "")
      .trim()
      .toLowerCase();
    if (!needle) return null;
    const user = await this.db.collection("users").findOne({
      $or: [{ email: needle }, { username: needle }],
    });
    if (!user) return null;
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLogin: user.lastLogin ?? null,
      createdAt: user.createdAt,
      password_hash: user.passwordHash,
    };
  }

  /** Durable admin-panel configuration (API keys and provider settings). */
  async getSettings() {
    const docs = await this.db
      .collection("settings")
      .find({}, { projection: { _id: 1, value: 1 } })
      .toArray();
    return Object.fromEntries(
      docs
        .filter((doc) => typeof doc.value === "string")
        .map((doc) => [doc._id, doc.value]),
    );
  }

  /** Replace the persisted settings namespace with the provided map. */
  async saveSettings(settings) {
    const collection = this.db.collection("settings");
    const keep = new Set(Object.keys(settings));
    const existing = await collection
      .find({}, { projection: { _id: 1 } })
      .toArray();
    const removals = existing
      .map((doc) => doc._id)
      .filter((id) => !keep.has(id));
    if (removals.length)
      await collection.deleteMany({ _id: { $in: removals } });
    const now = new Date().toISOString();
    for (const [id, value] of Object.entries(settings)) {
      await collection.replaceOne(
        { _id: id },
        { _id: id, value, updatedAt: now },
        { upsert: true },
      );
    }
    return this.getSettings();
  }

  async getUserById(id) {
    const user = await this.db.collection("users").findOne({ _id: id });
    return user ? toPublicUser({ ...user, id: user._id }) : null;
  }

  async recordLogin(id) {
    await this.db
      .collection("users")
      .updateOne(
        { _id: id },
        { $set: { lastLogin: new Date().toISOString() } },
      );
  }

  async listEvents({ category, severity, query, limit = 50 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const filter = {};
    if (category && category !== "all") filter.category = category;
    if (severity && severity !== "all") filter.severity = severity;
    if (query) {
      const pattern = new RegExp(escapeRegex(query), "i");
      filter.$or = [
        { title: pattern },
        { summary: pattern },
        { region: pattern },
      ];
    }
    const items = await this.db
      .collection("events")
      .find(filter, { projection: { _id: 0 } })
      .sort({ publishedAt: -1 })
      .limit(safeLimit)
      .toArray();
    const total = await this.db.collection("events").countDocuments(filter);
    return { items: items.map(toDoc), total };
  }

  async createEvent(input) {
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
    await this.db
      .collection("events")
      .insertOne({ ...toDoc(event), _id: event.id });
    return toDoc(event);
  }

  async updateEvent(id, input) {
    const existing = await this.db.collection("events").findOne({ _id: id });
    if (!existing) return null;
    const merged = {
      ...toDoc({ ...existing, ...input }),
      id,
      updatedAt: new Date().toISOString(),
    };
    await this.db.collection("events").updateOne({ _id: id }, { $set: merged });
    return merged;
  }

  async deleteEvent(id) {
    const result = await this.db.collection("events").deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async addAudit({
    actorEmail,
    action,
    entityType,
    entityId = null,
    metadata = {},
  }) {
    const audit = {
      _id: randomUUID(),
      actorEmail,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    };
    await this.db.collection("audit_logs").insertOne(audit);
    return { ...audit, id: audit._id };
  }

  async listAudits(limit = 50) {
    const safeLimit = Math.min(Number(limit) || 50, 100);
    const items = await this.db
      .collection("audit_logs")
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .toArray();
    return items.map((item) => ({ ...item, id: item.id ?? item._id }));
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
