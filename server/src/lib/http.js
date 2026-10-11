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

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function readResponseText(response, maxBytes = 8 * 1024 * 1024) {
  const timeout = responseTimeouts.get(response);
  const reader = response.body?.getReader();
  try {
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Upstream response exceeded size limit');
    if (!reader) return '';
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await abortable(reader.read(), timeout.signal);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Upstream response exceeded size limit');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    reader?.cancel().catch(() => {});
    if (timeout?.signal.aborted) throw new Error(`Upstream request timed out after ${timeout.timeoutMs}ms`);
    throw error;
  }
}

export async function fetchResponse(url, options = {}, requestedTimeoutMs = DEFAULT_TIMEOUT) {
  const timeoutMs = Math.min(120_000, Math.max(1, Math.floor(Number(requestedTimeoutMs) || DEFAULT_TIMEOUT)));
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = combineSignals(options.signal, timeoutSignal);
  try {
    const response = await abortable(fetch(url, { ...options, signal }), signal);
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
    responseTimeouts.set(response, { signal, timeoutMs });
    return response;
  } catch (error) {
    if (timeoutSignal.aborted) throw new Error(`Upstream request timed out after ${timeoutMs}ms`);
    throw error;
  }
}

export async function fetchJson(url, options = {}, timeoutMs, maxBytes = 8 * 1024 * 1024) {
  const response = await fetchResponse(url, options, timeoutMs);
  const text = await readResponseText(response, maxBytes);
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
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function validCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
