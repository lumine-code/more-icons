"use strict";

// Imports the auto-generated match database from a file-icons checkout while
// replacing the five live Atom paths and names with their Lumine equivalents.
//
//   npm run build:file-icons -- path/to/file-icons

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "sets", "file-icons", "icondb.js");

const USAGE =
  "Usage: npm run build:file-icons -- <path to a file-icons checkout>\n" +
  "  e.g. npm run build:file-icons -- ../../file-icons-upstream";

const REPLACEMENTS = [
  [
    '["atom-icon",["dark-green","dark-green"],/^\\.atom(?:-ci)?$/]',
    '["lumine-icon",["dark-green","dark-green"],/^\\.lumine(?:-ci)?$/]',
  ],
  [
    '["atom-icon",["dark-green","dark-green"],/\\.atomproject\\.[jc]son$/i,2]',
    '["lumine-icon",["dark-green","dark-green"],/\\.lumineproject\\.[jc]son$/i,2]',
  ],
  [
    '["tag-icon",["medium-green","medium-green"],/^\\.atom-socket-.+\\.\\d$/,2]',
    '["tag-icon",["medium-green","medium-green"],/^\\.lumine-socket-.+\\.\\d$/,2]',
  ],
  [
    '["atom-icon",["medium-green","medium-green"],/^\\.?apmrc$|\\.atomignore$/i]',
    '["lumine-icon",["medium-green","medium-green"],/^\\.?lpmrc$|\\.lumineignore$/i]',
  ],
  [
    '["git-commit-icon",["medium-red","medium-red"],/^(?:ATOM_)?COMMIT_EDITMSG$/]',
    '["git-commit-icon",["medium-red","medium-red"],/^(?:LUMINE_)?COMMIT_EDITMSG$/]',
  ],
];

const STALE_LIVE_NAMES = [
  "atom-icon",
  "atomproject",
  "atom-socket",
  "apmrc",
  "atomignore",
  "ATOM_",
];

function upstreamDatabase() {
  const checkout = process.argv[2];
  if (!checkout) throw new Error(USAGE);

  for (const candidate of [
    path.join(checkout, "lib", "icons", ".icondb.js"),
    path.join(checkout, ".icondb.js"),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`No lib/icons/.icondb.js under ${checkout}\n${USAGE}`);
}

function replaceExactlyOnce(source, from, to) {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`Expected one occurrence of ${from}, found ${count}`);
  }
  return source.replace(from, to);
}

function main() {
  let source = fs.readFileSync(upstreamDatabase(), "utf8");
  for (const [from, to] of REPLACEMENTS) {
    source = replaceExactlyOnce(source, from, to);
  }

  const stale = STALE_LIVE_NAMES.filter((name) => source.includes(name));
  if (stale.length) {
    throw new Error(`Unadapted live Atom names remain: ${stale.join(", ")}`);
  }

  fs.writeFileSync(OUT, source);
  console.log(`icondb.js    imported ${source.split("\n").length - 1} lines`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
