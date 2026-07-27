"use strict";

// Regenerates sets/file-icons/glyphs.json and palette.json from a checkout of
// the upstream file-icons package:
//
//   npm run build:glyphs -- path/to/file-icons
//
// Reads only `styles/icons.less` from that checkout. The palette is not read
// from `styles/colours.less` — its base16 hues and per-class mixins are
// transcribed into the constants below, because the Less mixins branch on the
// theme's own background lightness and cannot be evaluated standalone.
//
// Nothing here runs at package load, and no Less is kept in this repository:
// the generated JSON is committed and is what the runtime reads.

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "sets", "file-icons");

const USAGE =
  "Usage: npm run build:glyphs -- <path to a file-icons checkout>\n" +
  "  e.g. npm run build:glyphs -- ../../file-icons-upstream";

function upstreamStylesheet() {
  const checkout = process.argv[2];
  if (!checkout) throw new Error(USAGE);

  // Accept either the repository root or its styles/ directory.
  for (const candidate of [
    path.join(checkout, "styles", "icons.less"),
    path.join(checkout, "icons.less"),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`No styles/icons.less under ${checkout}\n${USAGE}`);
}

// -----------------------------------------------------------------------------
// Less colour functions, reimplemented so the palette can be precomputed.
// Less operates on HSL with percentage-point addition, clamped to [0, 1].
// -----------------------------------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function rgbToHex([r, g, b]) {
  const c = (v) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}

const clamp = (v) => Math.min(1, Math.max(0, v));

function adjust(hex, channel, delta) {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl[channel] = clamp(hsl[channel] + delta);
  return rgbToHex(hslToRgb(hsl));
}

const lighten = (hex, pct) => adjust(hex, 2, pct / 100);
const darken = (hex, pct) => adjust(hex, 2, -pct / 100);
const saturate = (hex, pct) => adjust(hex, 1, pct / 100);

// -----------------------------------------------------------------------------
// Palette
// -----------------------------------------------------------------------------

// Base16 hues, transcribed from the PALETTE block of upstream's
// styles/colours.less.
const HUES = {
  red: "#ac4142",
  green: "#90a959",
  yellow: "#f4bf75",
  blue: "#6a9fb5",
  maroon: "#8f5536",
  purple: "#aa759f",
  orange: "#d28445",
  cyan: "#75b5aa",
  pink: "#ff00cc",
  grey: "#7f7f7f",
};

const ADJUST_TONE = 15;

// The CSS CLASSES block of upstream's styles/colours.less, transcribed. Each
// entry is the conditional mixin applied to the tone, or `null` for a plain
// `color:`.
//   brighten -> only applies on dark themes: saturate(lighten(c, n), n)
//   darken   -> only applies on light themes: darken(c, n)
//   greyish  -> only applies on dark themes: lighten(c, n), and emits
//               NO declaration on light themes (upstream defines no guard
//               for that branch, so Less drops the rule entirely).
const CLASS_RULES = {
  "light-red": null,
  "medium-red": null,
  "dark-red": ["brighten", 15],
  "light-green": ["darken", 5],
  "medium-green": null,
  "dark-green": null,
  "light-yellow": ["darken", 23],
  "medium-yellow": ["darken", 15],
  "dark-yellow": ["darken", 10],
  "light-blue": ["darken", 18],
  "medium-blue": null,
  "dark-blue": null,
  "light-maroon": null,
  "medium-maroon": null,
  "dark-maroon": ["brighten", 8],
  "light-purple": null,
  "medium-purple": null,
  "dark-purple": null,
  "light-orange": ["darken", 8],
  "medium-orange": null,
  "dark-orange": null,
  "light-cyan": ["darken", 18],
  "medium-cyan": null,
  "dark-cyan": null,
  "light-pink": null,
  "medium-pink": null,
  "dark-pink": ["brighten", 5],
  "light-grey": null,
  "medium-grey": null,
  "dark-grey": ["greyish", 15],
};

function toneValue(name) {
  const [tone, hue] = name.split("-");
  const base = HUES[hue];
  if (!base) throw new Error(`unknown hue in ${name}`);
  if (tone === "medium") return base;
  if (tone === "light") return lighten(base, ADJUST_TONE);
  if (tone === "dark") return darken(base, ADJUST_TONE);
  throw new Error(`unknown tone in ${name}`);
}

function buildPalette() {
  const dark = {};
  const light = {};
  for (const [name, rule] of Object.entries(CLASS_RULES)) {
    const base = toneValue(name);
    if (!rule) {
      dark[name] = base;
      light[name] = base;
      continue;
    }
    const [kind, amount] = rule;
    if (kind === "brighten") {
      dark[name] = saturate(lighten(base, amount), amount);
      light[name] = base;
    } else if (kind === "darken") {
      dark[name] = base;
      light[name] = darken(base, amount);
    } else if (kind === "greyish") {
      dark[name] = lighten(base, amount);
      // No light-theme branch upstream; fall back to the unadjusted tone
      // rather than leaving the colour undefined.
      light[name] = base;
    }
  }
  return { dark, light };
}

// -----------------------------------------------------------------------------
// Glyphs
// -----------------------------------------------------------------------------

// The five font mixins, defined at icons.less:46,76,118,148,209. `octicons`
// is the editor's own bundled UI font, so those 20 glyphs need no vendored
// file — they render from whatever the active theme already loads.
const FONTS = {
  octicons: { family: '"Octicons Regular"', size: 16, top: 1, bundled: true },
  fa: { family: "FontAwesome", size: 13, top: 0 },
  mf: { family: "Mfizz", size: 14, top: 0 },
  devicons: { family: "Devicons", size: 16, top: 3 },
  fi: { family: "file-icons", size: 15, top: 0 },
};

const RULE = /^\.([A-Za-z0-9_-]+-icon):before\s*\{([^}]*)\}/;

// `content` is either a hex escape (`"\f129"`) or a literal character that
// happens to be mapped in the custom font (`"b"`, `"/"`, `"*"`).
function readContent(body) {
  const escaped = /content\s*:\s*"\\([0-9a-fA-F]+)"/.exec(body);
  if (escaped) return escaped[1].toLowerCase();

  const literal = /content\s*:\s*"(\\?[^"\\]|\\\\)"/.exec(body);
  if (literal) return literal[1].codePointAt(0).toString(16);

  return null;
}

function buildGlyphs() {
  const source = fs.readFileSync(upstreamStylesheet(), "utf8");
  const glyphs = {};
  const counts = { octicons: 0, fa: 0, mf: 0, devicons: 0, fi: 0 };
  let skipped = 0;

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(".") || !trimmed.includes(":before")) continue;

    const match = RULE.exec(trimmed);
    if (!match) {
      // Structural rules (`.icon:before`, `.tab > .icon:before`, ...) carry no
      // glyph. Count them so a malformed glyph rule cannot pass unnoticed.
      if (/content\s*:/.test(trimmed)) skipped++;
      continue;
    }

    const [, className, body] = match;
    const mixin = /\.(octicons|fa|mf|devicons|fi)\s*;/.exec(body);
    if (!mixin) {
      skipped++;
      continue;
    }

    const char = readContent(body);
    if (!char) {
      skipped++;
      continue;
    }

    const font = FONTS[mixin[1]];
    counts[mixin[1]]++;

    const entry = { font: font.family, char };

    // Only record metrics that differ from the mixin's own default, so the
    // stylesheet generator can fall back to a single per-font rule.
    const size = /font-size\s*:\s*(-?[\d.]+)px/.exec(body);
    if (size && Number(size[1]) !== font.size) entry.size = Number(size[1]);

    const top = /(?:^|;)\s*top\s*:\s*(-?[\d.]+)px/.exec(body);
    if (top && Number(top[1]) !== font.top) entry.top = Number(top[1]);

    const left = /(?:^|;)\s*left\s*:\s*(-?[\d.]+)px/.exec(body);
    if (left && Number(left[1])) entry.left = Number(left[1]);

    // Later rules win in CSS, so keep overwriting.
    glyphs[className] = entry;
  }

  return { glyphs, counts, skipped };
}

// -----------------------------------------------------------------------------

function main() {
  const { glyphs, counts, skipped } = buildGlyphs();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Regression guard: these counts are what upstream 2.1.47 contains. If a
  // refresh changes them, verify the diff is real before bumping the numbers.
  const EXPECTED = { octicons: 20, fa: 33, mf: 21, devicons: 51, fi: 804 };
  const mismatch = Object.entries(EXPECTED).filter(([k, v]) => counts[k] !== v);
  if (mismatch.length) {
    console.error("Font-mixin counts changed:", counts, "expected", EXPECTED);
    process.exitCode = 1;
  }
  if (skipped) {
    console.error(`${skipped} glyph-looking rule(s) were not parsed — inspect icons.less`);
    process.exitCode = 1;
  }

  const palette = buildPalette();

  // The per-font defaults the glyph deltas are recorded against, shipped so the
  // runtime can resolve every glyph to its upstream absolute size and top.
  // `nudge` is a hand-calibrated vertical correction for the icon contract's
  // content-area centring — measured, frozen, and preserved across rebuilds.
  const fontsPath = path.join(OUT, "fonts.json");
  const previous = fs.existsSync(fontsPath) ? JSON.parse(fs.readFileSync(fontsPath, "utf8")) : {};
  const fonts = {};
  for (const font of Object.values(FONTS)) {
    fonts[font.family] = {
      size: font.size,
      top: font.top,
      nudge: (previous[font.family] && previous[font.family].nudge) || 0,
    };
  }

  fs.writeFileSync(path.join(OUT, "glyphs.json"), JSON.stringify(glyphs, null, 0) + "\n");
  fs.writeFileSync(path.join(OUT, "palette.json"), JSON.stringify(palette, null, 2) + "\n");
  fs.writeFileSync(fontsPath, JSON.stringify(fonts, null, 2) + "\n");

  console.log(`glyphs.json  ${Object.keys(glyphs).length} classes from ${total} rules`, counts);
  console.log(`palette.json ${Object.keys(palette.dark).length} colours × 2 modes`);
  console.log(`fonts.json   ${Object.keys(fonts).length} font defaults`);
}

try {
  main();
} catch (error) {
  // A bad invocation should print the usage line, not a stack trace.
  console.error(error.message);
  process.exitCode = 2;
}
