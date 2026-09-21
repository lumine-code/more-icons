"use strict";

const { CompositeDisposable, Icon } = require("lumine");
const Stylesheet = require("./stylesheet");

const SETS = {
  "file-icons": () => require("./set-file-icons"),
  seti: () => require("./set-seti"),
};

let disposables = null;
let stylesheet = null;
let set = null;
let setReady = false;
let mode = "dark";
let coloured = true;

function currentMode() {
  return lumine.themes.isDarkThemeMode() ? "dark" : "light";
}

function activateSet() {
  const name = lumine.config.get("more-icons.set");
  const factory = SETS[name] || SETS["file-icons"];
  const next = factory();

  if (next.load) {
    const custom = lumine.config.get("more-icons.customThemePath");
    try {
      next.load(custom || undefined);
    } catch (error) {
      lumine.notifications.addError("Could not load the icon theme", {
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

function ensureSet() {
  if (setReady) return;
  activateSet();
  mode = currentMode();
  coloured = lumine.config.get("more-icons.coloured");
  stylesheet.reset(set, mode);
  setReady = true;
}

function rebuild() {
  if (!stylesheet || !setReady) return;
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

function iconFor(target) {
  const filePath = target.path;
  if (typeof filePath !== "string" || !stylesheet) return null;
  ensureSet();

  const { directory, symlink, submodule, repositoryRoot } = target.hints;

  // A repository root, a submodule and a symlinked directory each read as
  // themselves before they read as a folder, and neither set has a glyph
  // saying so. Declining lets the editor's own folder icons answer.
  if (directory && (symlink || submodule || repositoryRoot)) return null;

  const classes = set.resolve(filePath, { directory: !!directory, mode });
  if (!classes) return null;

  stylesheet.ensure(set, classes);

  if (!coloured) {
    return Icon.classes(classes.filter((className) => !className.startsWith("mi-c-")));
  }
  return Icon.classes(classes);
}

module.exports = {
  activate() {
    disposables = new CompositeDisposable();
    stylesheet = new Stylesheet();
    stylesheet.attach();
    mode = currentMode();
    coloured = lumine.config.get("more-icons.coloured");
    setReady = false;

    // Font files and the large icon manifest are not needed to register the
    // provider or create its style element. Warm them after the activation
    // stopwatch, while `iconFor` still provides a synchronous first-use path.
    queueMicrotask(() => {
      if (disposables) ensureSet();
    });

    disposables.add(
      lumine.config.onDidChange("more-icons.set", () => {
        ensureSet();
        activateSet();
        rebuild();
      }),
      lumine.config.onDidChange("more-icons.customThemePath", () => {
        ensureSet();
        activateSet();
        rebuild();
      }),
      lumine.config.onDidChange("more-icons.coloured", ({ newValue }) => {
        coloured = newValue;
        emitDidChange();
      }),
      lumine.themes.onDidChangeActiveThemes(() => {
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
    setReady = false;
  },

  // Above a default-priority provider but below one that answers for a narrow
  // slice of paths, such as native OS icons for executables.
  provideIcons() {
    return {
      id: "more-icons",
      priority: 50,
      handles: ["path"],
      iconFor,
      onDidChange(callback) {
        changeCallbacks.add(callback);
        return { dispose: () => changeCallbacks.delete(callback) };
      },
    };
  },
};
