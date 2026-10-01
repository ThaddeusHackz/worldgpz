import pg from 'pg';

const { Pool } = pg;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20),
  title TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source VARCHAR(100),
  external_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_external ON events(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE TABLE IF NOT EXISTS provider_cache (
  provider VARCHAR(100) PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'online',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE TABLE IF NOT EXISTS ai_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  input_hash VARCHAR(64),
  model VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(100) NOT NULL,
  key_name VARCHAR(100) NOT NULL UNIQUE,
  key_value TEXT NOT NULL,
  display_label VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_tested_at TIMESTAMPTZ,
  last_test_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
`;

export class Store {
  constructor() {
    this.pool = process.env.DATABASE_URL
      ? new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 5,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
        })
      : null;
    this.initialized = false;
  }

  get persistent() {
    return Boolean(this.pool);
  }

  async initialize() {
    if (!this.pool) return false;
    await this.pool.query(SCHEMA);
    this.initialized = true;
    return true;
  }

  async query(text, values = []) {
    if (!this.pool) throw new Error('PostgreSQL is not configured');
    return this.pool.query(text, values);
  }

  async close() {
    if (this.pool) await this.pool.end();
  }

  async saveApiKey(definition, encryptedValue) {
    return this.query(
      `INSERT INTO api_keys (provider, key_name, key_value, display_label, category, description, is_required, sort_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       ON CONFLICT (key_name) DO UPDATE SET provider=EXCLUDED.provider, key_value=EXCLUDED.key_value,
         display_label=EXCLUDED.display_label, category=EXCLUDED.category, description=EXCLUDED.description,
         is_required=EXCLUDED.is_required, sort_order=EXCLUDED.sort_order, status='pending',
         error_message=NULL, updated_at=NOW()
       RETURNING key_name`,
      [definition.provider, definition.keyName, encryptedValue, definition.displayLabel,
        definition.category, definition.description, Boolean(definition.isRequired), definition.sortOrder],
    );
  }

  async deleteApiKey(keyName) {
    return this.query('DELETE FROM api_keys WHERE key_name = $1', [keyName]);
  }

  async updateKeyStatus(definition, result) {
    if (!this.pool) return;
    await this.query(
      `UPDATE api_keys SET status=$1, last_tested_at=NOW(), last_test_result=$2::jsonb,
       latency_ms=$3, error_message=$4, updated_at=NOW() WHERE key_name=$5`,
      [result.status, JSON.stringify(result), result.latencyMs || 0, result.error || null, definition.keyName],
    );
  }
}
