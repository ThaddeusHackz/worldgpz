const TOKEN_KEY = "worldgpz.admin.session";

export const session = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

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
