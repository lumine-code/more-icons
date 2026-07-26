"use strict";

const { CompositeDisposable } = require("atom");
const Stylesheet = require("./stylesheet");

const SETS = {
  "file-icons": () => require("./set-file-icons"),
  seti: () => require("./set-seti"),
};

let disposables = null;
let stylesheet = null;
let set = null;
let mode = "dark";
let coloured = true;

function currentMode() {
  return atom.themes.isDarkThemeMode() ? "dark" : "light";
}

function activateSet() {
  const name = atom.config.get("more-icons.set");
  const factory = SETS[name] || SETS["file-icons"];
  const next = factory();

  if (next.load) {
    const custom = atom.config.get("more-icons.customThemePath");
    try {
      next.load(custom || undefined);
    } catch (error) {
      atom.notifications.addError("Could not load the icon theme", {
        detail: error.message,
        dismissable: true,
      });
      // Fall back to the set that needs no external files.
      set = SETS["file-icons"]();
      return;
    }
  }

  set = next;
}

function rebuild() {
  if (!stylesheet) return;
  mode = currentMode();
  set.clearCache();
  stylesheet.reset(set, mode);
  // Consumers cache the classes they were handed, so they have to be told the
  // answer changed. They pick this up through the service's `onDidChange`.
  emitDidChange();
}

const changeCallbacks = new Set();

function emitDidChange() {
  for (const callback of changeCallbacks) callback();
}

function iconClassForPath(filePath) {
  if (typeof filePath !== "string" || !set) return null;

  const classes = set.resolve(filePath, { mode });
  if (!classes) return null;

  stylesheet.ensure(set, classes);

  if (!coloured) {
    return classes.filter((className) => !className.startsWith("mi-c-"));
  }
  return classes;
}

module.exports = {
  activate() {
    disposables = new CompositeDisposable();
    stylesheet = new Stylesheet();
    stylesheet.attach();

    activateSet();
    mode = currentMode();
    coloured = atom.config.get("more-icons.coloured");
    stylesheet.reset(set, mode);

    disposables.add(
      atom.config.onDidChange("more-icons.set", () => {
        activateSet();
        rebuild();
      }),
      atom.config.onDidChange("more-icons.customThemePath", () => {
        activateSet();
        rebuild();
      }),
      atom.config.onDidChange("more-icons.coloured", ({ newValue }) => {
        coloured = newValue;
        emitDidChange();
      }),
      atom.themes.onDidChangeActiveThemes(() => {
        if (currentMode() !== mode) rebuild();
      }),
    );
  },

  deactivate() {
    if (disposables) disposables.dispose();
    if (stylesheet) stylesheet.detach();
    if (set && set.unload) set.unload();
    changeCallbacks.clear();
    disposables = stylesheet = set = null;
  },

  // Only `icons.class` is provided. Registering `icons.element`
  // as well would take over directory icons too — and neither set defines
  // folder glyphs, so the tree view would lose its repo, submodule and symlink
  // icons. See get-icon-services.js in tree-view.
  provideIconsClass() {
    return {
      iconClassForPath,
      onDidChange(callback) {
        changeCallbacks.add(callback);
        return { dispose: () => changeCallbacks.delete(callback) };
      },
    };
  },
};
