import { useCallback, useEffect, useRef, useState } from 'react';

const STREAM_EVENTS = ['connected', 'pulse', 'health', 'seismic', 'natural', 'conflict', 'fire', 'weather', 'flight', 'ship', 'news', 'market', 'briefing', 'iss', 'heartbeat', 'shutdown'];

export function useDirectUplink(onEvent, enabled = true) {
  const callbackRef = useRef(onEvent);
  const sourceRef = useRef(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => { callbackRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') {
      sourceRef.current?.close();
      sourceRef.current = null;
      setConnected(false);
      return undefined;
    }
    const source = new EventSource('/api/stream');
    sourceRef.current = source;
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false); // EventSource reconnects automatically.
    for (const type of STREAM_EVENTS) {
      source.addEventListener(type, (event) => {
        if (type === 'heartbeat') { setConnected(true); return; }
        try { callbackRef.current?.(type, JSON.parse(event.data)); }
        catch { /* Ignore malformed upstream stream frames and keep the connection alive. */ }
      });
    }
    return () => {
      source.close();
      if (sourceRef.current === source) sourceRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  const reconnect = useCallback(() => {
    sourceRef.current?.close();
    setConnected(false);
  }, []);
  return { connected, reconnect };
}
