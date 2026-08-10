const path = require("path");

const PACKAGE_ROOT = path.join(__dirname, "..");

function styleElement() {
  return document.head.querySelector("style[data-more-icons]");
}

function ruleTexts() {
  const element = styleElement();
  return Array.from(element.sheet.cssRules).map((rule) => rule.cssText);
}

describe("activation", () => {
  let service;

  // The registry hands providers a normalized target; these specs exercise the
  // service directly, so they build one.
  const iconFor = (filePath, hints = {}) => service.iconFor({ path: filePath, hints });
  const classesFor = (filePath, hints) => iconFor(filePath, hints);

  beforeEach(async () => {
    // The colour classes and the Seti definitions both differ by interface
    // mode, and the spec runner's default is light. Pin it so the expectations
    // below name one palette rather than whichever the runner happened to use.
    lumine.config.set("theme.mode", "dark");

    // Seti routes mainstream languages through `languageIds`, resolved from the
    // grammar the editor picks for the path.
    await lumine.packages.activatePackage("language-javascript");

    lumine.packages.loadPackage(PACKAGE_ROOT);
    await lumine.packages.activatePackage("more-icons");

    service = lumine.packages.getActivePackage("more-icons").mainModule.provideIcons();
  });

  afterEach(async () => {
    await lumine.packages.deactivatePackage("more-icons");
  });

  it("installs a single stylesheet holding the fonts and shared geometry", () => {
    expect(styleElement()).not.toBe(null);

    const fontFaces = ruleTexts().filter((rule) => rule.startsWith("@font-face"));
    // The file-icons set ships four fonts; Octicons comes from the editor.
    expect(fontFaces.length).toBe(4);
    for (const rule of fontFaces) {
      expect(rule).toContain("data:font/woff2;charset=utf-8;base64,");
    }

    expect(ruleTexts().some((rule) => rule.includes(".icon.mi-icon::before"))).toBe(true);
  });

  it("detects the editor's icon contract and emits against its box", () => {
    // The editor declares --icon-contract: box in its base variables, so the
    // shared rule restates the contract frame and glyph rules size themselves
    // as ratios of the contract box instead of absolute pixels.
    const shared = ruleTexts().find((rule) => rule.includes(".icon.mi-icon::before"));
    expect(shared).toContain("vertical-align: text-bottom");

    expect(classesFor("/p/script.py")).toContain("mi-g-python-icon");
    const glyph = ruleTexts().find((rule) => rule.includes("mi-g-python-icon"));
    expect(glyph).toContain("calc(var(--component-icon-size, 16px)");
    expect(glyph).not.toContain("top:");
  });

  it("exposes the colour palette as custom properties", () => {
    const root = ruleTexts().find((rule) => rule.startsWith(":root"));
    expect(root).toContain("--mi-medium-yellow:");
    expect(root).toContain("--mi-dark-blue:");
  });

  it("writes a glyph rule the first time a path needs one", () => {
    const before = ruleTexts().length;
    expect(ruleTexts().some((rule) => rule.includes("mi-g-python-icon"))).toBe(false);

    expect(classesFor("/p/script.py")).toContain("mi-g-python-icon");

    expect(ruleTexts().length).toBeGreaterThan(before);
    expect(ruleTexts().some((rule) => rule.includes("mi-g-python-icon"))).toBe(true);
  });

  it("writes each rule only once", () => {
    classesFor("/p/a.py");
    const afterFirst = ruleTexts().length;
    classesFor("/p/b.py");
    expect(ruleTexts().length).toBe(afterFirst);
  });

  it("ignores paths that are not strings", () => {
    expect(iconFor(null)).toBe(null);
    expect(iconFor(undefined)).toBe(null);
  });

  it("only answers for path targets", () => {
    expect(service.handles).toEqual(["path"]);
  });

  // The file-icons set carries a directory table; Seti's manifest defines no
  // folder glyphs at all, so it declines and the editor's own icon answers.
  it("answers for directories on the file-icons set", () => {
    expect(classesFor("/p/node_modules", { directory: true })).toContain("mi-icon");
  });

  it("declines directories on the seti set", () => {
    lumine.config.set("more-icons.set", "seti");
    expect(iconFor("/p/node_modules", { directory: true })).toBe(null);
  });

  // Nothing here has a glyph saying "this folder is a repository", so these
  // three are left to the editor rather than flattened into a plain folder.
  it("declines the directories that carry their own meaning", () => {
    expect(iconFor("/p/thing", { directory: true, repositoryRoot: true })).toBe(null);
    expect(iconFor("/p/thing", { directory: true, submodule: true })).toBe(null);
    expect(iconFor("/p/thing", { directory: true, symlink: true })).toBe(null);
  });

  it("drops the colour class when colouring is turned off", () => {
    expect(classesFor("/p/main.js")).toContain("mi-c-medium-yellow");

    lumine.config.set("more-icons.coloured", false);
    const classes = classesFor("/p/main.js");
    expect(classes).toContain("mi-g-js-icon");
    expect(classes.some((name) => name.startsWith("mi-c-"))).toBe(false);
  });

  it("rebuilds the stylesheet when the set changes", () => {
    expect(classesFor("/p/main.js")).toContain("mi-g-js-icon");

    lumine.config.set("more-icons.set", "seti");

    expect(ruleTexts().some((rule) => rule.includes("mi-g-js-icon"))).toBe(false);
    // Seti ships one font, so the previous four @font-face rules are gone too.
    expect(ruleTexts().filter((rule) => rule.startsWith("@font-face")).length).toBe(1);
    expect(classesFor("/p/main.js")).toContain("mi-s-_javascript");
  });

  it("notifies consumers when its answers change", () => {
    const callback = jasmine.createSpy("onDidChange");
    const subscription = service.onDidChange(callback);

    lumine.config.set("more-icons.coloured", false);
    expect(callback.calls.count()).toBe(1);

    lumine.config.set("more-icons.set", "seti");
    expect(callback.calls.count()).toBe(2);

    subscription.dispose();
    lumine.config.set("more-icons.coloured", true);
    expect(callback.calls.count()).toBe(2);
  });

  it("warns and keeps working when a custom theme folder is unusable", () => {
    spyOn(lumine.notifications, "addError");

    lumine.config.set("more-icons.set", "seti");
    lumine.config.set("more-icons.customThemePath", path.join(__dirname, "fixtures"));

    expect(lumine.notifications.addError).toHaveBeenCalled();
    // Falls back to the set that needs no external files.
    expect(classesFor("/p/main.js")).toContain("mi-g-js-icon");
  });

  it("removes its stylesheet on deactivation", async () => {
    await lumine.packages.deactivatePackage("more-icons");
    expect(styleElement()).toBe(null);
  });
});
