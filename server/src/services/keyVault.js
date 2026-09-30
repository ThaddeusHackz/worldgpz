import { encryptSecret, decryptSecret } from '../lib/vaultCrypto.js';

export class KeyVault {
  constructor(store) {
    this.store = store;
    this.encryptedMemory = new Map();
    this.metadata = new Map();
  }

  get(keyName) {
    // Explicit deployment configuration remains authoritative over database-managed secrets.
    const environmentValue = process.env[keyName];
    if (environmentValue) return environmentValue;
    const encrypted = this.encryptedMemory.get(keyName);
    if (!encrypted) return undefined;
    try { return decryptSecret(encrypted); } catch { return undefined; }
  }

  source(keyName) {
    if (process.env[keyName]) return 'environment';
    return this.encryptedMemory.has(keyName) ? 'stored' : 'missing';
  }

  async load() {
    if (!this.store?.persistent) return 0;
    try {
      const { rows } = await this.store.query('SELECT key_name, key_value, status, last_tested_at, last_test_result, latency_ms, error_message FROM api_keys');
      let loaded = 0;
      for (const row of rows) {
        this.encryptedMemory.set(row.key_name, row.key_value);
        this.metadata.set(row.key_name, {
          status: row.status || 'pending', lastTestedAt: row.last_tested_at,
          lastTestResult: row.last_test_result || {}, latencyMs: row.latency_ms || 0,
          errorMessage: row.error_message || null,
        });
        loaded += 1;
      }
      return loaded;
    } catch (error) {
      console.warn('[KeyVault] Could not load stored credentials:', error.message);
      return 0;
    }
  }

  async save(definition, value) {
    const encrypted = encryptSecret(value);
    if (this.store?.persistent) await this.store.saveApiKey(definition, encrypted);
    this.encryptedMemory.set(definition.keyName, encrypted);
    this.metadata.set(definition.keyName, { status: 'pending', lastTestedAt: null, lastTestResult: {}, latencyMs: 0, errorMessage: null });
  }

  async delete(definition) {
    if (this.store?.persistent) await this.store.deleteApiKey(definition.keyName);
    this.encryptedMemory.delete(definition.keyName);
    this.metadata.delete(definition.keyName);
  }

  async setTestResult(definition, result) {
    this.metadata.set(definition.keyName, {
      status: result.status, lastTestedAt: new Date().toISOString(),
      lastTestResult: result, latencyMs: result.latencyMs || 0, errorMessage: result.error || null,
    });
    if (this.store?.persistent) await this.store.updateKeyStatus(definition, result);
  }

  getMetadata(keyName) {
    return this.metadata.get(keyName) || { status: 'pending', lastTestedAt: null, lastTestResult: {}, latencyMs: 0, errorMessage: null };
  }

  get persistenceMode() {
    return this.store?.persistent ? 'postgresql' : 'memory';
  }
}
