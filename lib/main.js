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
let activationGeneration = 0;
let scheduledGeneration = null;
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
  if (setReady || !stylesheet) return;
  activateSet();
  mode = currentMode();
  coloured = lumine.config.get("more-icons.coloured");
  stylesheet.attach();
  stylesheet.reset(set, mode);
  setReady = true;
}

function scheduleSetInitialization() {
  const generation = activationGeneration;
  if (scheduledGeneration === generation) return;
  scheduledGeneration = generation;

  queueMicrotask(() => {
    if (!disposables || activationGeneration !== generation) return;
    scheduledGeneration = null;
    ensureSet();
    emitDidChange();
  });
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

function invalidateGrammarIcons() {
  if (!stylesheet || !setReady || set.id !== "seti") return;
  set.clearCache();
  // Only selection changed. Keep the style element, fonts and already written
  // glyph rules; consumers will request any additional glyphs lazily.
  emitDidChange();
}

const changeCallbacks = new Set();

function emitDidChange() {
  for (const callback of changeCallbacks) callback();
}

function iconFor(target) {
  const filePath = target.path;
  if (typeof filePath !== "string" || !stylesheet) return null;
  if (!setReady) {
    scheduleSetInitialization();
    return null;
  }

  const { directory, symlink, submodule, repositoryRoot } = target.hints;

  // A repository root, a submodule and a symlinked directory each read as
  // themselves before they read as a folder, and neither set has a glyph
  // saying so. Declining lets the editor's own folder icons answer.
  if (directory && (symlink || submodule || repositoryRoot)) return null;

  const classes = set.resolve(filePath, { directory: !!directory, mode });
  if (!classes) return null;

  stylesheet.ensure(set, classes);

  if (!coloured) {
    return Icon.classes([
      ...classes.filter((className) => !className.startsWith("mi-c-")),
      "mi-uncoloured",
    ]);
  }
  return Icon.classes(classes);
}

module.exports = {
  activate() {
    activationGeneration++;
    disposables = new CompositeDisposable();
    stylesheet = new Stylesheet();
    mode = currentMode();
    coloured = lumine.config.get("more-icons.coloured");
    setReady = false;

    // Publishing the provider immediately repaints every icon already on
    // screen. Keep that service exchange cheap: the first pass falls through
    // to the core icon, then this warm-up publishes the real answer through
    // `onDidChange` after the activation batch has completed.
    scheduleSetInitialization();

    disposables.add(
      lumine.config.onDidChange("more-icons.set", () => {
        if (!setReady) return;
        activateSet();
        rebuild();
      }),
      lumine.config.onDidChange("more-icons.customThemePath", () => {
        if (!setReady) return;
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
      lumine.config.onDidChange("core.customFileTypes", invalidateGrammarIcons),
      lumine.grammars.onDidAddGrammar(invalidateGrammarIcons),
      lumine.grammars.onDidUpdateGrammar(invalidateGrammarIcons),
      lumine.grammars.onDidRemoveGrammar(invalidateGrammarIcons),
    );
  },

  deactivate() {
    activationGeneration++;
    scheduledGeneration = null;
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
      async: true,
      handles: ["path"],
      iconFor,
      onDidChange(callback) {
        changeCallbacks.add(callback);
        return { dispose: () => changeCallbacks.delete(callback) };
      },
    };
  },
};
