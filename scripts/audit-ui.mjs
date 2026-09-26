/**
 * UI legibility and contrast audit.
 *
 * Parses client/src/styles.css and reports measurable readability violations
 * rather than relying on eyeballing:
 *   1. Text smaller than the 11px floor.
 *   2. Letter-spacing wide enough to smear glyphs (>0.18em).
 *   3. `color:` declarations that fail WCAG AA against the panel backdrop.
 *
 * Run: npm run audit:ui   (add --strict to exit non-zero on any violation)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = path.join(root, "client/src/styles.css");
const css = fs.readFileSync(cssPath, "utf8");
const strict = process.argv.includes("--strict");

const MIN_FONT_PX = 11;
const MAX_TRACKING_EM = 0.18;
const AA_BODY = 4.5;

/* ----------------------------------------------------------------- colour */
const hexToRgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const luminance = ([r, g, b]) => {
  const channel = [r, g, b].map((value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
};

const contrast = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** Composite an rgba foreground over an opaque backdrop. */
const over = (rgb, alpha, bg) =>
  rgb.map((value, index) =>
    Math.round(alpha * value + (1 - alpha) * bg[index]),
  );

/* ------------------------------------------------------------ block parse */
const blocks = [];
const blockRe = /([^{}]+)\{([^{}]*)\}/g;
let match;
while ((match = blockRe.exec(css))) {
  blocks.push({
    selector: match[1].trim().replace(/\s+/g, " "),
    body: match[2],
  });
}

const BACKDROP = hexToRgb("#111114"); // --panel-solid

const smallText = [];
const wideTracking = [];
const lowContrast = [];

for (const block of blocks) {
  const size = block.body.match(/(?:^|[{;\s])font-size:\s*([\d.]+)px/);
  if (size && parseFloat(size[1]) < MIN_FONT_PX)
    smallText.push({ selector: block.selector, value: `${size[1]}px` });

  const tracking = block.body.match(/letter-spacing:\s*([\d.]+)em/);
  if (tracking && parseFloat(tracking[1]) > MAX_TRACKING_EM)
    wideTracking.push({ selector: block.selector, value: `${tracking[1]}em` });

  // Only the `color` property — not border-color or scrollbar-color.
  const colour = block.body.match(
    /(?:^|[{;\s])color:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
  );
  if (colour) {
    const alpha = parseFloat(colour[4]);
    const composited = over(
      [+colour[1], +colour[2], +colour[3]],
      alpha,
      BACKDROP,
    );
    const ratio = contrast(composited, BACKDROP);
    if (ratio < AA_BODY)
      lowContrast.push({
        selector: block.selector,
        value: `${ratio.toFixed(2)}:1`,
      });
  }
}

/* ----------------------------------------------------------------- report */
const line = (label, items) => {
  const status = items.length === 0 ? "PASS" : "FAIL";
  console.log(`[${status}] ${label}: ${items.length}`);
  for (const item of items.slice(0, 20))
    console.log(
      `        ${item.value.padEnd(10)} ${item.selector.slice(0, 78)}`,
    );
};

console.log("UI legibility audit — client/src/styles.css\n");
line(`font-size below ${MIN_FONT_PX}px`, smallText);
line(`letter-spacing above ${MAX_TRACKING_EM}em`, wideTracking);
line(`text colour below WCAG AA ${AA_BODY}:1`, lowContrast);

const failures = smallText.length + wideTracking.length + lowContrast.length;
console.log(`\nTotal violations: ${failures}`);
if (strict && failures > 0) process.exit(1);
