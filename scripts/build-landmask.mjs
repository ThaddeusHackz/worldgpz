#!/usr/bin/env node
/**
 * Generates client/src/lib/landmask.js — a 1°-resolution bit-packed land
 * mask (360 × 180) rasterized from Natural Earth land-110m, used by the
 * GOD'S EYE 3D orbital globe. The output is committed, so this script only
 * needs to run when the underlying dataset is refreshed:
 *
 *   node scripts/build-landmask.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const land = require(
  path.join(root, "node_modules/world-atlas/land-110m.json"),
);
const { feature } = require("topojson-client");

const WIDTH = 360;
const HEIGHT = 180;

const geo = feature(land, land.objects.land);
const rings = [];
for (const polygon of geo.features
  ? geo.features.map((f) => f.geometry)
  : [geo.geometry]) {
  const polygons =
    polygon.type === "Polygon" ? [polygon.coordinates] : polygon.coordinates;
  for (const coordinates of polygons) rings.push(...coordinates);
}

// Even-odd scanline fill per ring. XOR across rings resolves holes
// (e.g. the Caspian Sea) automatically.
const mask = new Uint8Array(WIDTH * HEIGHT);
for (const ring of rings) {
  const lats = ring.map((point) => point[1]);
  const minLat = Math.max(-90, Math.floor(Math.min(...lats)));
  const maxLat = Math.min(89, Math.ceil(Math.max(...lats)));
  for (let lat = minLat; lat <= maxLat; lat += 1) {
    const row = 90 - lat - 1; // lat 90 -> row 0 ... lat -90 -> row 179
    const yc = lat + 0.5;
    const crossings = [];
    for (let i = 0; i < ring.length; i += 1) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      if (y1 === y2) continue;
      if (yc >= Math.min(y1, y2) && yc < Math.max(y1, y2)) {
        crossings.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let c = 0; c + 1 < crossings.length; c += 2) {
      const startLon = Math.ceil(crossings[c] - 0.5);
      const endLon = Math.floor(crossings[c + 1] - 0.5);
      for (let lon = startLon; lon <= endLon; lon += 1) {
        const col = ((Math.round(lon) % WIDTH) + WIDTH) % WIDTH;
        const index = row * WIDTH + col;
        mask[index] ^= 1;
      }
    }
  }
}

// Bit-pack rows and emit as base64.
const byteLength = Math.ceil((WIDTH * HEIGHT) / 8);
const packed = Buffer.alloc(byteLength);
for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
  if (mask[i]) packed[i >> 3] |= 1 << (i & 7);
}

let landCells = 0;
for (const bit of mask) landCells += bit;

const output = `/**
 * GOD'S EYE land mask — 1° resolution (360 × 180), bit-packed row-major from
 * latitude 90 to -90, longitude -180 to 179. Generated from Natural Earth
 * land-110m by scripts/build-landmask.mjs. ${landCells} land cells.
 */
export const LAND_MASK_WIDTH = ${WIDTH};
export const LAND_MASK_HEIGHT = ${HEIGHT};
export const LAND_MASK_BITS = "${packed.toString("base64")}";

const bytes = Uint8Array.from(atob(LAND_MASK_BITS), (char) =>
  char.charCodeAt(0),
);

export function isLand(latitude, longitude) {
  const row = Math.floor(90 - latitude);
  const col = ((Math.round(longitude) % ${WIDTH}) + ${WIDTH}) % ${WIDTH};
  if (row < 0 || row >= ${HEIGHT} || Number.isNaN(col)) return false;
  const index = row * ${WIDTH} + col;
  return Boolean((bytes[index >> 3] >> (index & 7)) & 1);
}
`;

fs.writeFileSync(path.join(root, "client/src/lib/landmask.js"), output);
console.log(
  `landmask.js written: ${landCells}/64800 land cells, ${packed.length} bytes`,
);
