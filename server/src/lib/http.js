const DEFAULT_TIMEOUT = Number(process.env.PROVIDER_TIMEOUT_MS) || 12_000;
const responseTimeouts = new WeakMap();

function combineSignals(requestSignal, timeoutSignal) {
  if (!requestSignal) return timeoutSignal;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([requestSignal, timeoutSignal]);
  const controller = new AbortController();
  for (const source of [requestSignal, timeoutSignal]) {
    if (source.aborted) {
      controller.abort(source.reason);
      break;
    }
    source.addEventListener('abort', () => controller.abort(source.reason), { once: true });
  }
  return controller.signal;
}

async function readResponseText(response) {
  try {
    return await response.text();
  } catch (error) {
    const timeout = responseTimeouts.get(response);
    if (timeout?.signal.aborted) throw new Error(`Upstream request timed out after ${timeout.timeoutMs}ms`);
    throw error;
  }
}

export async function fetchResponse(url, options = {}, requestedTimeoutMs = DEFAULT_TIMEOUT) {
  const timeoutMs = Math.min(120_000, Math.max(1, Math.floor(Number(requestedTimeoutMs) || DEFAULT_TIMEOUT)));
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = combineSignals(options.signal, timeoutSignal);
  try {
    const response = await fetch(url, { ...options, signal });
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
    responseTimeouts.set(response, { signal: timeoutSignal, timeoutMs });
    return response;
  } catch (error) {
    if (timeoutSignal.aborted) throw new Error(`Upstream request timed out after ${timeoutMs}ms`);
    throw error;
  }
}

export async function fetchJson(url, options = {}, timeoutMs) {
  const response = await fetchResponse(url, options, timeoutMs);
  const text = await readResponseText(response);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Upstream returned invalid JSON');
  }
}

export async function fetchText(url, options = {}, timeoutMs) {
  return readResponseText(await fetchResponse(url, options, timeoutMs));
}

export function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function validCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
