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

    /**
     * Only accept a fix whose coordinates are real, finite, in-range numbers.
     *
     * A 200 response with an unexpected body (rate-limit notice, proxy error
     * page, upstream schema change) previously produced
     * `{ latitude: undefined }` and still flipped status to "locked", which
     * then crashed the map at `fix.latitude.toFixed(2)`.
     */
    const validFix = (latitude, longitude) =>
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180;

    async function acquire() {
      try {
        const response = await fetch(PRIMARY, {
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        if (!alive) return;
        const latitude = Number(data.latitude);
        const longitude = Number(data.longitude);
        if (!validFix(latitude, longitude)) throw new Error("invalid fix");
        setFix({
          latitude,
          longitude,
          velocity: Number(data.velocity) || 0,
          altitude: Number(data.altitude) || 0,
        });
        setStatus("locked");
      } catch {
        try {
          const response = await fetch(FALLBACK, {
            signal: AbortSignal.timeout(6000),
          });
          if (!response.ok) throw new Error(String(response.status));
          const data = await response.json();
          const position = data?.iss_position;
          if (!alive || !position) throw new Error("no fix");
          const latitude = Number(position.latitude);
          const longitude = Number(position.longitude);
          if (!validFix(latitude, longitude)) throw new Error("invalid fix");
          setFix({ latitude, longitude });
          setStatus("locked");
        } catch {
          if (alive) {
            setFix(null);
            setStatus("offline");
          }
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
