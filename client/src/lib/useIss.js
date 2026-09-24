import { useEffect, useState } from "react";

/**
 * Client-side orbital asset tracker (ISS).
 * Fetches live telemetry straight from the browser so the satellite layer
 * works in any deployment without server-side keys. Falls back to a
 * secondary public API, then reports `offline` (the HUD hides gracefully).
 */
const PRIMARY = "https://api.wheretheiss.at/v1/satellites/25544";
const FALLBACK = "https://api.open-notify.org/iss-now.json";

export function useIss(pollMs = 5000) {
  const [fix, setFix] = useState(null); // { latitude, longitude, velocity, altitude }
  const [status, setStatus] = useState("acquiring");

  useEffect(() => {
    let alive = true;
    let timer;

    async function acquire() {
      try {
        const response = await fetch(PRIMARY, {
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        if (!alive) return;
        setFix({
          latitude: data.latitude,
          longitude: data.longitude,
          velocity: data.velocity,
          altitude: data.altitude,
        });
        setStatus("locked");
      } catch {
        try {
          const response = await fetch(FALLBACK, {
            signal: AbortSignal.timeout(6000),
          });
          const data = await response.json();
          const position = data?.iss_position;
          if (!alive || !position) throw new Error("no fix");
          setFix({
            latitude: Number(position.latitude),
            longitude: Number(position.longitude),
          });
          setStatus("locked");
        } catch {
          if (alive) setStatus("offline");
        }
      } finally {
        if (alive) timer = setTimeout(acquire, pollMs);
      }
    }

    acquire();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [pollMs]);

  return { fix, status };
}
