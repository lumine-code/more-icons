"use strict";

const { CompositeDisposable, Icon } = require("lumine");
const Stylesheet = require("./stylesheet");
const setLoader = require("./set-loader");

let disposables = null;
let stylesheet = null;
let set = null;
let setReady = false;
let activationGeneration = 0;
let pendingInitialization = null;
let mode = "dark";
let coloured = true;

function currentMode() {
  return lumine.themes.isDarkThemeMode() ? "dark" : "light";
}

async function initializeSet(request) {
  const { owner, name, custom } = request;
  const isCurrent = () =>
    stylesheet === owner &&
    pendingInitialization === request &&
    disposables &&
    activationGeneration === request.generation;
  let next = await setLoader.load(name);
  if (!isCurrent()) return false;

  if (next.load) {
    try {
      next.load(custom || undefined);
    } catch (error) {
      lumine.notifications.addError("Could not load the icon theme", {
        detail: error.message,
        dismissable: true,
      });
      // Fall back to the set that needs no external files.
      next = await setLoader.load("file-icons");
      if (!isCurrent()) return false;
    }
  }

  if (!isCurrent()) return false;
  if (set !== next) set?.unload?.();
  set = next;
  mode = currentMode();
  coloured = lumine.config.get("more-icons.coloured");
  owner.attach();
  owner.reset(set, mode);
  setReady = true;
  emitDidChange();
  return true;
}

function scheduleSetInitialization(force = false) {
  if (!stylesheet) return Promise.resolve(false);
  if (!force && pendingInitialization) return pendingInitialization.promise;
  const configured = lumine.config.get("more-icons.set");
  const request = {
    owner: stylesheet,
    generation: activationGeneration,
    name: configured === "seti" ? "seti" : "file-icons",
    custom: lumine.config.get("more-icons.customThemePath"),
  };
  pendingInitialization = request;
  request.promise = initializeSet(request)
    .catch((error) => {
      if (pendingInitialization === request && stylesheet === request.owner) {
        lumine.notifications.addError("Could not initialize the icon set", {
          detail: error.message,
          dismissable: true,
        });
      }
      return false;
    })
    .finally(() => {
      if (pendingInitialization === request) pendingInitialization = null;
    });
  return request.promise;
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
        scheduleSetInitialization(true);
      }),
      lumine.config.onDidChange("more-icons.customThemePath", () => {
        scheduleSetInitialization(true);
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
    pendingInitialization = null;
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
