import { useEffect, useRef, useState } from "react";

/**
 * Live grid stream — server-sent events carrying autonomous heartbeats and
 * freshly intercepted signals the moment the grid acquires them. Native
 * EventSource reconnects automatically; callbacks stay stable via refs.
 */
export function useLiveStream({ onSignal, onPulse } = {}) {
  const [connected, setConnected] = useState(false);
  const handlers = useRef({ onSignal, onPulse });
  handlers.current = { onSignal, onPulse };

  useEffect(() => {
    if (typeof window === "undefined" || !window.EventSource) return undefined;
    const source = new EventSource("/api/v1/stream");

    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));
    // The server emits `signals` (plural) — GridPulse.#emit("signals", ...).
    // This previously listened for `signal`, so freshly intercepted events
    // never reached the browser and the live feed silently never updated.
    const onSignals = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const signals = Array.isArray(payload) ? payload : [payload];
        for (const signal of signals) handlers.current.onSignal?.(signal);
      } catch {
        /* malformed frame — ignore */
      }
    };
    source.addEventListener("signals", onSignals);
    source.addEventListener("pulse", (event) => {
      try {
        handlers.current.onPulse?.(JSON.parse(event.data));
      } catch {
        /* ignore */
      }
    });

    return () => {
      source.removeEventListener("signals", onSignals);
      source.close();
    };
  }, []);

  return { connected };
}
