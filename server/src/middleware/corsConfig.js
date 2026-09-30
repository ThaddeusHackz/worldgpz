// The dashboard and API are served from one origin. No permissive CORS policy is required.
// If a separate client origin is intentionally deployed, add an explicit allowlist there.
export function sameOriginOnly(_req, _res, next) { next(); }
