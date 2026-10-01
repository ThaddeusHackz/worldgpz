import { fetchResponse } from './http.js';

export async function fetchWithRetry(url, options = {}, retries = 2) {
  const timeout = options.timeout || Number(process.env.PROVIDER_TIMEOUT_MS) || 12_000;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchResponse(url, options, timeout);
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        const delay = Math.min(5_000, 500 * (2 ** attempt));
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      const rateLimited = /HTTP 429\b/.test(error.message);
      const clientError = /HTTP 4\d\d/.test(error.message) && !rateLimited;
      if (attempt < retries && !clientError) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(3_000, 350 * (2 ** attempt))));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('Request failed');
}
