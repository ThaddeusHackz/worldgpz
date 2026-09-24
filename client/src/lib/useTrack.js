import { useEffect, useMemo, useRef, useState } from "react";
import { twoline2satrec, propagate, gstime, eciToGeodetic } from "satellite.js";

const degrees = (radians) => (radians * 180) / Math.PI;

/**
 * Live satellite constellation — genuine SGP4 orbital propagation of real
 * CelesTrak two-line element sets (ISS, Tiangong, Hubble, Terra, Aqua,
 * NOAA, Suomi NPP, Sentinel, Landsat). Positions update every 5 seconds.
 */
export function useTrack() {
  const [catalogue, setCatalogue] = useState(null);
  const [status, setStatus] = useState("acquiring");
  const [fixes, setFixes] = useState([]);
  const recsRef = useRef([]);
  const satelliteNames = useMemo(
    () => catalogue?.satellites?.map((item) => item.name) || [],
    [catalogue],
  );

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/v1/track", { signal: AbortSignal.timeout(15_000) })
        .then((response) => response.json())
        .then((payload) => {
          if (!alive || !payload?.data) return;
          setCatalogue(payload.data);
          setStatus(
            payload.data.status === "operational"
              ? "locked"
              : payload.data.status,
          );
          recsRef.current = (payload.data.satellites || [])
            .map((item) => {
              try {
                return {
                  name: item.name,
                  rec: twoline2satrec(item.line1, item.line2),
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean);
        })
        .catch(() => alive && setStatus("degraded"));
    load();
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!recsRef.current.length) return undefined;
    const update = () => {
      const now = new Date();
      const gmst = gstime(now);
      const next = [];
      for (const { name, rec } of recsRef.current) {
        try {
          const result = propagate(rec, now);
          if (!result?.position) continue;
          const geo = eciToGeodetic(result.position, gmst);
          const velocity = result.velocity;
          next.push({
            name,
            latitude: degrees(geo.latitude),
            longitude: degrees(geo.longitude),
            altitudeKm: geo.height,
            speedKmH: velocity
              ? Math.hypot(velocity.x, velocity.y, velocity.z) * 3600
              : null,
          });
        } catch {
          /* skip a bad epoch */
        }
      }
      setFixes(next);
    };
    update();
    const interval = setInterval(update, 5_000);
    return () => clearInterval(interval);
  }, [satelliteNames.length]);

  return { fixes, status, catalogue };
}
