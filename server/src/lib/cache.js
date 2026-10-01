export class LRUCache {
  constructor(maxSize = 50, defaultTtlMs = 300_000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this.entries = new Map();
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) { this.entries.delete(key); return null; }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key, value, ttlMs = this.defaultTtlMs) {
    this.entries.delete(key);
    while (this.entries.size >= this.maxSize) this.entries.delete(this.entries.keys().next().value);
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  delete(key) { this.entries.delete(key); }
  clear() { this.entries.clear(); }
  get size() { return this.entries.size; }
}
