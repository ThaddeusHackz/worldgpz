const TOKEN_KEY = "worldgpz.admin.session";
/** Pre-2.4 key. Migrated on first read, then removed. */
const LEGACY_TOKEN_KEY = "worldgpz.admin.session.legacy";

/**
 * Session persistence.
 *
 * Uses localStorage so an operator stays signed in across reloads, new tabs,
 * and browser restarts. sessionStorage was too aggressive: it dropped the
 * session the moment a tab closed, forcing a re-login on every new window.
 * Falls back to memory-only when storage is unavailable (private mode,
 * embedded webviews, storage disabled).
 */
const pick = () => {
  try {
    const probe = "__wgz_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    try {
      return sessionStorage;
    } catch {
      return null;
    }
  }
};

const backend = pick();
const memoryFallback = new Map();

const safeStorage = {
  get: () => {
    try {
      if (!backend) return memoryFallback.get(TOKEN_KEY) ?? null;
      // One-time migration from any legacy storage location.
      const legacy =
        sessionStorage?.getItem?.(LEGACY_TOKEN_KEY) ??
        sessionStorage?.getItem?.(TOKEN_KEY);
      if (legacy && !backend.getItem(TOKEN_KEY)) {
        backend.setItem(TOKEN_KEY, legacy);
        sessionStorage?.removeItem?.(LEGACY_TOKEN_KEY);
        sessionStorage?.removeItem?.(TOKEN_KEY);
      }
      return backend.getItem(TOKEN_KEY);
    } catch {
      return memoryFallback.get(TOKEN_KEY) ?? null;
    }
  },
  set: (token) => {
    try {
      if (!backend) {
        memoryFallback.set(TOKEN_KEY, token);
        return;
      }
      backend.setItem(TOKEN_KEY, token);
    } catch {
      memoryFallback.set(TOKEN_KEY, token);
    }
  },
  clear: () => {
    try {
      memoryFallback.delete(TOKEN_KEY);
      backend?.removeItem?.(TOKEN_KEY);
      sessionStorage?.removeItem?.(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const session = safeStorage;

export async function api(path, options = {}) {
  const token = session.get();
  const headers = { Accept: "application/json", ...options.headers };
  if (options.body && typeof options.body !== "string") {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    ...options,
    headers,
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  });
  const payload = await response.json().catch(() => ({
    success: false,
    error: "The server returned an invalid response",
  }));
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }
  return payload;
}
