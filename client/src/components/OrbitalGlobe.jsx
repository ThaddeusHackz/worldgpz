import { useEffect, useMemo, useRef, useState } from "react";
import { isLand, LAND_MASK_HEIGHT, LAND_MASK_WIDTH } from "../lib/landmask.js";
import { useIss } from "../lib/useIss.js";
import { titleCase } from "../lib/format.js";

const SEVERITY_COLORS = {
  critical: "#ff2e4d",
  high: "#ffb020",
  medium: "#58b6ff",
  low: "#46f0a0",
};

const HQ = { latitude: 20, longitude: 0 };

/** Unit vector for a lat/lon pair (radians). */
function toVector(latitude, longitude) {
  const phi = (latitude * Math.PI) / 180;
  const lambda = (longitude * Math.PI) / 180;
  return {
    x: Math.cos(phi) * Math.sin(lambda),
    y: Math.sin(phi),
    z: Math.cos(phi) * Math.cos(lambda),
  };
}

/** Great-circle slerp between two lat/lon points. */
function greatCircle(from, to, segments = 40) {
  const a = toVector(from.latitude, from.longitude);
  const b = toVector(to.latitude, to.longitude);
  const dot = Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return [from, to];
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const ka = Math.sin((1 - t) * omega) / Math.sin(omega);
    const kb = Math.sin(t * omega) / Math.sin(omega);
    const x = a.x * ka + b.x * kb;
    const y = a.y * ka + b.y * kb;
    const z = a.z * ka + b.z * kb;
    points.push({
      latitude: (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI,
      longitude: (Math.atan2(x, z) * 180) / Math.PI,
    });
  }
  return points;
}

/** Precompute the thinned land-dot cloud (geographic coordinates). */
function buildLandDots() {
  const dots = [];
  for (let row = 0; row < LAND_MASK_HEIGHT; row += 1) {
    for (let col = 0; col < LAND_MASK_WIDTH; col += 1) {
      if ((row & 1) !== (col & 1)) continue; // thin to half density
      const index = row * LAND_MASK_WIDTH + col;
      const byte = Math.floor(index / 8);
      void byte;
      if (!isLand(90 - row - 0.5, col - 180 + 0.5)) continue;
      dots.push({ latitude: 90 - row - 0.5, longitude: col - 180 + 0.5 });
    }
  }
  return dots;
}

export default function OrbitalGlobe({
  events,
  focusedEvent,
  onFocus,
  scanning = false,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stateRef = useRef({
    yaw: -0.6,
    pitch: 0.42,
    dragging: false,
    lastX: 0,
    lastY: 0,
    moved: 0,
    autoRotate: true,
  });
  const [subpoint, setSubpoint] = useState({ lat: 0, lon: 0 });
  const { fix: issFix } = useIss(10_000);
  const issRef = useRef(null);
  issRef.current = issFix;

  const landDots = useMemo(buildLandDots, []);
  const mappable = useMemo(
    () =>
      events.filter(
        (item) =>
          Number.isFinite(Number(item.latitude)) &&
          Number.isFinite(Number(item.longitude)),
      ),
    [events],
  );
  const trace = useMemo(
    () =>
      focusedEvent && Number.isFinite(Number(focusedEvent.latitude))
        ? greatCircle(HQ, {
            latitude: Number(focusedEvent.latitude),
            longitude: Number(focusedEvent.longitude),
          })
        : null,
    [focusedEvent],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const context = canvas.getContext("2d");
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let frame = 0;
    let last = performance.now();
    let subTick = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    const project = (latitude, longitude, yaw, pitch, radius, cx, cy) => {
      const phi = (latitude * Math.PI) / 180;
      const lambda = (longitude * Math.PI) / 180 + yaw;
      const x0 = Math.cos(phi) * Math.sin(lambda);
      const y0 = Math.sin(phi);
      const z0 = Math.cos(phi) * Math.cos(lambda);
      const y1 = y0 * Math.cos(pitch) - z0 * Math.sin(pitch);
      const z1 = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);
      return { x: cx + x0 * radius, y: cy - y1 * radius, z: z1 };
    };

    const render = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const state = stateRef.current;
      if (state.autoRotate && !state.dragging && !reduced)
        state.yaw += dt * (scanning ? 0.22 : 0.055);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.42;
      context.clearRect(0, 0, width, height);

      // Deep-space sphere body
      const body = context.createRadialGradient(
        cx - radius * 0.25,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius,
      );
      body.addColorStop(0, "rgba(0, 60, 92, 0.5)");
      body.addColorStop(0.7, "rgba(2, 14, 26, 0.82)");
      body.addColorStop(1, "rgba(1, 6, 12, 0.95)");
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fillStyle = body;
      context.fill();

      // Atmosphere rim
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.strokeStyle = `rgba(0, 229, 255, ${scanning ? 0.75 : 0.4})`;
      context.lineWidth = 1.4;
      context.shadowColor = "rgba(0, 229, 255, 0.7)";
      context.shadowBlur = scanning ? 26 : 14;
      context.stroke();
      context.shadowBlur = 0;

      // Graticule (every 30°)
      context.strokeStyle = "rgba(0, 229, 255, 0.1)";
      context.lineWidth = 1;
      for (let latDelta = -60; latDelta <= 60; latDelta += 30) {
        context.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 3) {
          const point = project(
            latDelta,
            lon,
            state.yaw,
            state.pitch,
            radius,
            cx,
            cy,
          );
          if (point.z >= 0) {
            if (!started) {
              context.moveTo(point.x, point.y);
              started = true;
            } else context.lineTo(point.x, point.y);
          } else started = false;
        }
        context.stroke();
      }
      for (let lonDelta = -180; lonDelta < 180; lonDelta += 30) {
        context.beginPath();
        let started = false;
        for (let lat = -88; lat <= 88; lat += 3) {
          const point = project(
            lat,
            lonDelta,
            state.yaw,
            state.pitch,
            radius,
            cx,
            cy,
          );
          if (point.z >= 0) {
            if (!started) {
              context.moveTo(point.x, point.y);
              started = true;
            } else context.lineTo(point.x, point.y);
          } else started = false;
        }
        context.stroke();
      }

      // Land dots
      for (const dot of landDots) {
        const point = project(
          dot.latitude,
          dot.longitude,
          state.yaw,
          state.pitch,
          radius,
          cx,
          cy,
        );
        if (point.z <= 0.02) continue;
        const shade = 0.16 + point.z * 0.6;
        context.fillStyle = `rgba(0, 229, 255, ${shade.toFixed(3)})`;
        context.fillRect(point.x - 0.9, point.y - 0.9, 1.8, 1.8);
      }

      // HQ → target trace
      if (trace) {
        context.setLineDash([3, 5]);
        context.strokeStyle = "rgba(0, 229, 255, 0.75)";
        context.lineWidth = 1.2;
        context.beginPath();
        let started = false;
        for (const point of trace) {
          const p = project(
            point.latitude,
            point.longitude,
            state.yaw,
            state.pitch,
            radius,
            cx,
            cy,
          );
          if (p.z >= 0) {
            if (!started) {
              context.moveTo(p.x, p.y);
              started = true;
            } else context.lineTo(p.x, p.y);
          } else started = false;
        }
        context.stroke();
        context.setLineDash([]);
      }

      // Signal markers
      const t = now / 1000;
      mappable.forEach((event, index) => {
        const point = project(
          Number(event.latitude),
          Number(event.longitude),
          state.yaw,
          state.pitch,
          radius,
          cx,
          cy,
        );
        if (point.z <= 0.01) return;
        const color = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.low;
        const phase = (t * (scanning ? 1.6 : 0.7) + index * 0.37) % 1;
        // Ping ring
        context.beginPath();
        context.arc(point.x, point.y, 3 + phase * 14, 0, Math.PI * 2);
        context.strokeStyle = color;
        context.globalAlpha = (1 - phase) * 0.7;
        context.lineWidth = 1;
        context.stroke();
        context.globalAlpha = 1;
        // Core
        context.save();
        context.translate(point.x, point.y);
        context.rotate(Math.PI / 4);
        context.fillStyle = color;
        context.shadowColor = color;
        context.shadowBlur = 8;
        const size = focusedEvent?.id === event.id ? 5 : 3.4;
        context.fillRect(-size / 2, -size / 2, size, size);
        context.restore();
        context.shadowBlur = 0;
        if (focusedEvent?.id === event.id) {
          context.beginPath();
          context.arc(point.x, point.y, 9, 0, Math.PI * 2);
          context.strokeStyle = "#00e5ff";
          context.lineWidth = 1.4;
          context.stroke();
        }
      });

      // ISS orbital asset
      const iss = issRef.current;
      if (iss) {
        const point = project(
          iss.latitude,
          iss.longitude,
          state.yaw,
          state.pitch,
          radius,
          cx,
          cy,
        );
        if (point.z > -0.15) {
          const alpha = point.z > 0 ? 1 : 0.35;
          context.globalAlpha = alpha;
          context.save();
          context.translate(point.x, point.y);
          context.rotate(Math.PI / 4);
          context.fillStyle = "#46f0a0";
          context.shadowColor = "#46f0a0";
          context.shadowBlur = 12;
          context.fillRect(-2.6, -2.6, 5.2, 5.2);
          context.restore();
          context.shadowBlur = 0;
          context.fillStyle = "rgba(70, 240, 160, 0.9)";
          context.font = "9px 'Share Tech Mono', monospace";
          context.fillText("ISS", point.x + 8, point.y - 6);
          context.globalAlpha = 1;
        }
      }

      // Sub-point readout (twice a second)
      subTick += dt;
      if (subTick > 0.5) {
        subTick = 0;
        const lat = ((state.pitch * 180) / Math.PI).toFixed(1);
        let lon = ((-state.yaw * 180) / Math.PI) % 360;
        if (lon > 180) lon -= 360;
        if (lon < -180) lon += 360;
        setSubpoint({ lat: Number(lat), lon: Math.round(lon) });
      }

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [landDots, mappable, trace, focusedEvent, scanning]);

  // Pointer interaction: drag to rotate, tap to lock a target.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const pick = (clientX, clientY) => {
      const wrap = wrapRef.current;
      const rect = wrap.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.42;
      const state = stateRef.current;
      let best = null;
      let bestDistance = 18;
      for (const event of mappable) {
        const phi = (Number(event.latitude) * Math.PI) / 180;
        const lambda = (Number(event.longitude) * Math.PI) / 180 + state.yaw;
        const x0 = Math.cos(phi) * Math.sin(lambda);
        const y0 = Math.sin(phi);
        const z0 = Math.cos(phi) * Math.cos(lambda);
        const y1 = y0 * Math.cos(state.pitch) - z0 * Math.sin(state.pitch);
        const z1 = y0 * Math.sin(state.pitch) + z0 * Math.cos(state.pitch);
        if (z1 <= 0.01) continue;
        const sx = cx + x0 * radius;
        const sy = cy - y1 * radius;
        const distance = Math.hypot(
          sx + rect.left - clientX,
          sy + rect.top - clientY,
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          best = event;
        }
      }
      if (best) onFocus?.(best);
    };

    const onDown = (event) => {
      const state = stateRef.current;
      state.dragging = true;
      state.moved = 0;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onMove = (event) => {
      const state = stateRef.current;
      if (!state.dragging) return;
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      state.moved += Math.abs(dx) + Math.abs(dy);
      state.yaw += dx * 0.005;
      state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch + dy * 0.005));
      state.lastX = event.clientX;
      state.lastY = event.clientY;
    };
    const onUp = (event) => {
      const state = stateRef.current;
      state.dragging = false;
      if (state.moved < 6) pick(event.clientX, event.clientY);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [mappable, onFocus]);

  const latHemi = subpoint.lat >= 0 ? "N" : "S";
  const lonHemi = subpoint.lon >= 0 ? "E" : "W";

  return (
    <div
      ref={wrapRef}
      className="orbital-globe"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        cursor: "grab",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
        }}
        role="img"
        aria-label="Interactive 3D orbital globe showing live signals"
      />
      <div className="globe-hud globe-hud-tl">ORBITAL VIEW · LIVE</div>
      <div className="globe-hud globe-hud-tr">
        SUBPTL {Math.abs(subpoint.lat).toFixed(1)}°{latHemi}{" "}
        {Math.abs(subpoint.lon)}°{lonHemi}
      </div>
      <div className="globe-hud globe-hud-bl">
        {mappable.length} TARGETS · DRAG TO SLEW · TAP TO LOCK
      </div>
      {focusedEvent && (
        <div className="globe-hud globe-hud-br">
          LOCK ▸ {titleCase(focusedEvent.category)} ·{" "}
          {Math.abs(Number(focusedEvent.latitude)).toFixed(1)}°
          {Number(focusedEvent.latitude) >= 0 ? "N" : "S"}{" "}
          {Math.abs(Number(focusedEvent.longitude)).toFixed(1)}°
          {Number(focusedEvent.longitude) >= 0 ? "E" : "W"}
        </div>
      )}
    </div>
  );
}
