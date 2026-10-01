export function getConfig(env = process.env) {
  const port = Number(env.PORT) || 3000;
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port,
    host: '0.0.0.0',
    trustProxy: env.TRUST_PROXY === '1',
    databaseUrl: env.DATABASE_URL || null,
    providerTimeoutMs: Number(env.PROVIDER_TIMEOUT_MS) || 12_000,
  };
}
