"use strict";

// Decoder and matcher for the vendored file-icons match table.
//
// `sets/file-icons/icondb.js` is upstream's auto-generated database. Each row
// is [cssClass, [darkColour, lightColour], matchRegExp, priority, matchPath,
// interpreter, scope, lang, signature], and the accompanying index arrays hold
// offsets into that row list.
//
// Only `byName` and `byPath` are used today. The other four indexes back the
// hashbang / modeline / linguist / grammar-override strategies, which are not
// ported — they are decoded anyway so adding them later needs no re-vendoring.

const RAW = require("../sets/file-icons/icondb.js");

function decode(table) {
  const [rows, indexes] = table;

  const icons = rows.map((row, index) => ({
    index,
    icon: row[0],
    colour: row[1],
    match: row[2],
    priority: row[3] == null ? 1 : row[3],
    matchPath: row[4] || false,
    interpreter: row[5] || null,
    scope: row[6] || null,
    lang: row[7] || null,
    signature: row[8] || null,
  }));

  const [byInterpreter, byLanguage, byPath, byScope, bySignature] = indexes.map((index) =>
    index.map((offset) => icons[offset]),
  );

  return { byName: icons, byInterpreter, byLanguage, byPath, byScope, bySignature };
}

const directories = decode(RAW[0]);
const files = decode(RAW[1]);

// Rules for names Lumine itself invents. `sets/` is upstream verbatim (see
// NOTICE), so it cannot learn about them and they are registered here instead.
// The rule borrows an existing row's icon and colour rather than naming a glyph
// directly, so it cannot drift from upstream's styling for the same concept.
function addLocalNameRule(table, match, modelIcon) {
  const model = table.byName.find((icon) => icon.icon === modelIcon);
  if (model == null) return;
  // Unshift: `scan` takes the first match, and these are more specific than the
  // generic rules they sit in front of.
  table.byName.unshift({ ...model, match });
}

// git-panel writes the commit message it opens for editing to
// `.git/LUMINE_COMMIT_EDITMSG`; upstream knows only `COMMIT_EDITMSG` and the
// Atom-era `ATOM_COMMIT_EDITMSG`.
addLocalNameRule(files, /^LUMINE_COMMIT_EDITMSG$/, "git-commit-icon");

// Upstream's PathStrategy#filter: ignore backup and template suffixes so
// `main.js.tpl` and `config.json~orig` keep their real icons.
function filter(value) {
  return value
    .replace(/~(?:orig|previous)$/, "")
    .replace(/^([^.]*\.[^.]+)\.(?:inc?|dist|tm?pl|te?mp|ti?dy)$/i, "$1");
}

const caches = {
  name: new Map(),
  path: new Map(),
};

function scan(icons, subject) {
  for (let i = 0, l = icons.length; i < l; ++i) {
    if (icons[i].match.test(subject)) return icons[i];
  }
  return null;
}

function matchName(name, directory = false) {
  const table = directory ? directories : files;
  const key = directory ? `d:${name}` : `f:${name}`;
  if (caches.name.has(key)) return caches.name.get(key);
  const icon = scan(table.byName, name);
  caches.name.set(key, icon);
  return icon;
}

function matchPath(filePath, directory = false) {
  const table = directory ? directories : files;
  const key = directory ? `d:${filePath}` : `f:${filePath}`;
  if (caches.path.has(key)) return caches.path.get(key);
  const icon = scan(table.byPath, filePath);
  caches.path.set(key, icon);
  return icon;
}

// Path rules are the more specific of the two, so they win — this mirrors
// upstream PathStrategy#matchIcon.
function match(filePath, name, directory = false) {
  const filteredName = filter(name) || name;
  const filteredPath = filteredName === name ? filePath : filter(filePath);

  let icon = matchPath(filteredPath, directory) || matchName(filteredName, directory);

  // A filtered name that only matched a low-priority generic rule is worse
  // than matching the unfiltered name outright.
  if (filteredName !== name && (icon === null || icon.priority < 1)) {
    icon = matchName(name, directory) || icon;
  }

  return icon;
}

function clearCache() {
  caches.name.clear();
  caches.path.clear();
}

module.exports = { match, matchName, matchPath, clearCache, directories, files };
