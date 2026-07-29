"use strict";

// The `file-icons` set: upstream's match table plus its four glyph fonts.
//
// Glyph and colour are separate classes because one glyph is reused with
// several colours (`apache-icon` alone appears in red, purple and green), which
// is also how upstream's Icon#getClass composes them.

const fs = require("fs");
const path = require("path");

const GLYPHS = require("../sets/file-icons/glyphs.json");
const FONTS = require("../sets/file-icons/fonts.json");
const PALETTE = require("../sets/file-icons/palette.json");
const table = require("./icon-table");

const DIR = path.join(__dirname, "..", "sets", "file-icons");

// `Octicons Regular` is the editor's own UI font and is deliberately absent —
// those 20 glyphs render from the stylesheet the active theme already loads.
const FONT_FILES = {
  "file-icons": "file-icons.woff2",
  Mfizz: "mfixx.woff2",
  Devicons: "devopicons.woff2",
  FontAwesome: "fontawesome.woff2",
};

const GLYPH_PREFIX = "mi-g-";
const COLOUR_PREFIX = "mi-c-";

exports.id = "file-icons";

exports.fontFaces = function fontFaces() {
  return Object.entries(FONT_FILES).map(([family, file]) => ({
    family,
    format: "woff2",
    data: fs.readFileSync(path.join(DIR, file)).toString("base64"),
  }));
};

exports.rootDeclarations = function rootDeclarations(mode) {
  const colours = PALETTE[mode] || PALETTE.dark;
  return Object.entries(colours)
    .map(([name, hex]) => `--mi-${name}: ${hex};`)
    .join("");
};

exports.resolve = function resolve(filePath, { directory = false, mode = "dark" } = {}) {
  const name = path.basename(filePath);
  const icon = table.match(filePath, name, directory);
  if (!icon) return null;

  const classes = [];

  // Six entries in the table point at core octicon classes the editor already
  // styles (`icon-file-pdf`, `icon-star`, …). Pass those straight through
  // rather than shadowing them with a rule of our own.
  if (Object.hasOwn(GLYPHS, icon.icon)) {
    classes.push("mi-icon", GLYPH_PREFIX + icon.icon);
  } else {
    classes.push(icon.icon);
  }

  // Each row carries two colour names — [dark, light] — and they are often
  // different tones, not the same tone rendered differently. The palette then
  // adjusts the chosen tone again for the active mode.
  const colour = icon.colour && icon.colour[mode === "light" ? 1 : 0];
  if (colour) classes.push(COLOUR_PREFIX + colour);

  return classes;
};

exports.ruleFor = function ruleFor(className, contract = false) {
  if (className.startsWith(COLOUR_PREFIX)) {
    const colour = className.slice(COLOUR_PREFIX.length);
    if (!Object.hasOwn(PALETTE.dark, colour)) return null;
    return `color: var(--mi-${colour});`;
  }

  if (!className.startsWith(GLYPH_PREFIX)) return null;

  const glyph = GLYPHS[className.slice(GLYPH_PREFIX.length)];
  if (!glyph) return null;

  if (!contract) {
    // Legacy emission for editors without the icon contract: the glyph's
    // recorded deviations as absolute pixels, riding the shared rule's
    // `position: relative` box.
    let declarations = `font-family: ${glyph.font}; content: "\\${glyph.char}";`;
    if (glyph.size) declarations += ` font-size: ${glyph.size}px;`;
    if (glyph.top) declarations += ` top: ${glyph.top}px;`;
    if (glyph.left) declarations += ` left: ${glyph.left}px;`;
    return declarations;
  }

  // Contract emission. glyphs.json records size only where a glyph deviates
  // from its font's upstream default (fonts.json), so resolve to the absolute
  // value first; the size is emitted as a ratio of the contract box so a
  // resized icon column scales the glyphs with it.
  //
  // Every upstream `top` is dropped, per-font base and per-glyph alike. Those
  // pushed a glyph around inside a baseline-aligned box; the contract centres
  // the glyph's own content area instead, which is the same correction applied
  // uniformly. Transplanting them re-introduced their spread — the file-icons
  // set alone ranges 0 to 5px — leaving the common values looking right and
  // outliers such as the TeX mark sitting 3px low. What remains is one
  // measured `nudge` per font, which places its ink where an octicon's sits.
  const font = FONTS[glyph.font] || { size: 16, nudge: 0 };
  const size = glyph.size ?? font.size;
  const dy = font.nudge;
  const dx = glyph.left || 0;

  let declarations =
    `font-family: ${glyph.font}; content: "\\${glyph.char}";` +
    ` font-size: calc(var(--component-icon-size, 16px) * ${size} / 16);`;
  if (dx || dy) declarations += ` translate: ${dx}px ${dy}px;`;
  return declarations;
};

exports.clearCache = table.clearCache;
