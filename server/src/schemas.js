export function isCoordinate(latitude, longitude) {
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    && Number(latitude) >= -90 && Number(latitude) <= 90
    && Number(longitude) >= -180 && Number(longitude) <= 180;
}

export function boundedInteger(value, { min = 1, max = 500, fallback = 100 } = {}) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
