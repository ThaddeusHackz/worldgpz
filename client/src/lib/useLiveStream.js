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
    source.addEventListener("signal", (event) => {
      try {
        const payload = JSON.parse(event.data);
        handlers.current.onSignal?.(payload);
      } catch {
        /* malformed frame — ignore */
      }
    });
    source.addEventListener("pulse", (event) => {
      try {
        handlers.current.onPulse?.(JSON.parse(event.data));
      } catch {
        /* ignore */
      }
    });

    return () => source.close();
  }, []);

  return { connected };
}
