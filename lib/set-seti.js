"use strict";

// The `seti` set: a loader for the Visual Studio Code file-icon-theme JSON
// format, shipping the Seti theme.
//
// The manifest supplies both the glyphs and the mapping, so nothing here is
// specific to Seti — pointing `customThemePath` at another theme folder works
// as long as its definitions are font-based. `iconPath` (SVG) definitions are
// parsed and kept, but cannot be rendered through the class-based service.
//
// `languageIds` is load-bearing, not a nicety: Seti routes every mainstream
// language through it, so `fileExtensions` holds no entry for `js`, `ts` or
// `py`. Without the grammar lookup below, most source files would fall through
// to `_default`.

const fs = require("fs");
const path = require("path");
const { parse } = require("jsonc-parser");

const PREFIX = "fit-s-";

// Grammar scopes whose language id cannot be derived from the scope segments
// or the grammar's display name.
const SCOPE_OVERRIDES = {
  "source.cs": "csharp",
  "source.csx": "csharp",
  "source.cake": "csharp",
  "source.gfm": "markdown",
  "source.objc": "objective-c",
  "source.objcpp": "objective-cpp",
  "source.litcoffee": "coffeescript",
  "text.tex.latex": "latex",
  "source.tasklist": "todo",
  "text.todo": "todo",
};

exports.id = "seti";
exports.defaultPath = path.join(__dirname, "..", "sets", "seti");

let theme = null;

function findManifest(dir) {
  const manifest = fs.readdirSync(dir).find((entry) => entry.endsWith("-icon-theme.json"));
  if (!manifest) throw new Error(`No *-icon-theme.json found in ${dir}`);
  return path.join(dir, manifest);
}

// Definition ids are author-chosen (`_js`, `_html`, `_default`). Keep the
// readable ones intact and escape anything that is not class-name safe.
function cssEscape(id) {
  return id.replace(/[^A-Za-z0-9_-]/g, (char) => `-${char.codePointAt(0).toString(16)}-`);
}

exports.load = function load(dir = exports.defaultPath) {
  const manifestPath = findManifest(dir);
  const errors = [];
  const raw = parse(fs.readFileSync(manifestPath, "utf8"), errors, { allowTrailingComma: true });
  if (errors.length) throw new Error(`${path.basename(manifestPath)} is not valid JSON`);

  const definitions = raw.iconDefinitions || {};

  theme = {
    dir,
    definitions,
    fonts: raw.fonts || [],
    // Reverse lookup so ruleFor is a map hit rather than a scan of ~400 ids.
    byClass: new Map(Object.keys(definitions).map((id) => [cssEscape(id), id])),
    base: {
      file: raw.file,
      fileExtensions: raw.fileExtensions || {},
      fileNames: raw.fileNames || {},
      languageIds: raw.languageIds || {},
    },
    light: raw.light || null,
    cache: new Map(),
  };
  return theme;
};

exports.unload = function unload() {
  theme = null;
};

function maps(mode) {
  const { base, light } = theme;
  if (mode !== "light" || !light) return base;
  return {
    file: light.file || base.file,
    fileExtensions: { ...base.fileExtensions, ...(light.fileExtensions || {}) },
    fileNames: { ...base.fileNames, ...(light.fileNames || {}) },
    languageIds: { ...base.languageIds, ...(light.languageIds || {}) },
  };
}

exports.fontFaces = function fontFaces() {
  return theme.fonts.flatMap((font) =>
    (font.src || []).map((src) => ({
      family: font.id,
      format: src.format || "woff",
      data: fs.readFileSync(path.resolve(theme.dir, src.path)).toString("base64"),
    })),
  );
};

exports.rootDeclarations = function rootDeclarations() {
  // Seti bakes a colour into every definition, so there is no palette here.
  return "";
};

// Candidate language ids for a file, most specific first. `source.css.less`
// yields ["less", "css", "less"]; `source.python.ipy` yields
// ["ipy", "python", "ipython"], so a dialect inherits its parent's icon.
function languageCandidates(scopeName, displayName) {
  const segments = scopeName.split(".");
  const candidates = [segments[segments.length - 1]];
  if (segments.length > 1) candidates.push(segments[1]);
  if (displayName) candidates.push(displayName.toLowerCase().replace(/[^a-z0-9+#-]/g, ""));
  return candidates;
}

function languageIdFor(filePath, languageIds) {
  const grammar = atom.grammars.selectGrammar(filePath);
  if (!grammar || !grammar.scopeName) return null;

  const override = SCOPE_OVERRIDES[grammar.scopeName];
  if (override) return Object.hasOwn(languageIds, override) ? override : null;

  for (const candidate of languageCandidates(grammar.scopeName, grammar.name)) {
    if (candidate && Object.hasOwn(languageIds, candidate)) return candidate;
  }
  return null;
}

exports.resolve = function resolve(filePath, { directory = false, mode = "dark" } = {}) {
  // The manifest defines no folder icons, so directories are left to the
  // consumer's own defaults.
  if (directory) return null;

  const name = path.basename(filePath).toLowerCase();
  const cacheKey = `${mode}:${name}`;
  if (theme.cache.has(cacheKey)) return theme.cache.get(cacheKey);

  const { file, fileExtensions, fileNames, languageIds } = maps(mode);

  let id = fileNames[name];

  if (!id) {
    // VS Code matches the longest extension first, so `foo.d.ts` tries `d.ts`
    // before falling back to `ts`.
    const segments = name.split(".");
    for (let i = 1; i < segments.length && !id; i++) {
      id = fileExtensions[segments.slice(i).join(".")];
    }
  }

  if (!id) {
    const language = languageIdFor(filePath, languageIds);
    if (language) id = languageIds[language];
  }

  if (!id) id = file;

  const classes = id && theme.definitions[id] ? ["fit-icon", PREFIX + cssEscape(id)] : null;
  theme.cache.set(cacheKey, classes);
  return classes;
};

exports.ruleFor = function ruleFor(className) {
  if (!className.startsWith(PREFIX)) return null;

  const id = theme.byClass.get(className.slice(PREFIX.length));
  const definition = id && theme.definitions[id];
  if (!definition || !definition.fontCharacter) return null;

  const font = theme.fonts.find((f) => f.id === definition.fontId) || theme.fonts[0];
  const size = definition.fontSize || (font && font.size);

  // `fontCharacter` is already a CSS escape once parsed — "\\E001" in the file
  // is the four-character sequence \E001 here, which drops straight into
  // `content`.
  let declarations = `content: "${definition.fontCharacter}";`;
  if (font) declarations += ` font-family: ${font.id};`;
  if (definition.fontColor) declarations += ` color: ${definition.fontColor};`;
  if (size) declarations += ` font-size: ${size};`;
  return declarations;
};

exports.clearCache = function clearCache() {
  if (theme) theme.cache.clear();
};
