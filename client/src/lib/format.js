const relativeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

export function relativeTime(value, now = Date.now()) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown time";
  const seconds = Math.round((timestamp - now) / 1000);
  if (Math.abs(seconds) < 60)
    return relativeFormatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60)
    return relativeFormatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  return relativeFormatter.format(days, "day");
}

export function formatUtc(value) {
  // Guard like relativeTime does: Intl throws RangeError("Invalid time value")
  // on a malformed timestamp, which would take down the whole page for one bad
  // field. null/"" are rejected explicitly because `new Date(null)` is epoch
  // and would otherwise render a meaningless "Jan 01, 00:00".
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function titleCase(value = "") {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function compactNumber(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}
