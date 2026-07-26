const path = require("path");

const PACKAGE_ROOT = path.join(__dirname, "..");

function styleElement() {
  return document.head.querySelector("style[data-file-icons]");
}

function ruleTexts() {
  const element = styleElement();
  return Array.from(element.sheet.cssRules).map((rule) => rule.cssText);
}

describe("activation", () => {
  let service;

  beforeEach(() => {
    // The colour classes and the Seti definitions both differ by interface
    // mode, and the spec runner's default is light. Pin it so the expectations
    // below name one palette rather than whichever the runner happened to use.
    atom.config.set("theme.mode", "dark");

    // Seti routes mainstream languages through `languageIds`, resolved from the
    // grammar the editor picks for the path.
    waitsForPromise(() => atom.packages.activatePackage("language-javascript"));

    atom.packages.loadPackage(PACKAGE_ROOT);
    waitsForPromise(() => atom.packages.activatePackage("file-icons"));

    runs(() => {
      service = atom.packages.getActivePackage("file-icons").mainModule.provideFileIcons();
    });
  });

  afterEach(() => {
    waitsForPromise(() => atom.packages.deactivatePackage("file-icons"));
  });

  it("installs a single stylesheet holding the fonts and shared geometry", () => {
    expect(styleElement()).not.toBe(null);

    const fontFaces = ruleTexts().filter((rule) => rule.startsWith("@font-face"));
    // The file-icons set ships four fonts; Octicons comes from the editor.
    expect(fontFaces.length).toBe(4);
    for (const rule of fontFaces) {
      expect(rule).toContain("data:font/woff2;charset=utf-8;base64,");
    }

    expect(ruleTexts().some((rule) => rule.includes(".icon.fi-icon::before"))).toBe(true);
  });

  it("exposes the colour palette as custom properties", () => {
    const root = ruleTexts().find((rule) => rule.startsWith(":root"));
    expect(root).toContain("--fi-medium-yellow:");
    expect(root).toContain("--fi-dark-blue:");
  });

  it("writes a glyph rule the first time a path needs one", () => {
    const before = ruleTexts().length;
    expect(ruleTexts().some((rule) => rule.includes("fi-g-python-icon"))).toBe(false);

    expect(service.iconClassForPath("/p/script.py")).toContain("fi-g-python-icon");

    expect(ruleTexts().length).toBeGreaterThan(before);
    expect(ruleTexts().some((rule) => rule.includes("fi-g-python-icon"))).toBe(true);
  });

  it("writes each rule only once", () => {
    service.iconClassForPath("/p/a.py");
    const afterFirst = ruleTexts().length;
    service.iconClassForPath("/p/b.py");
    expect(ruleTexts().length).toBe(afterFirst);
  });

  it("ignores paths that are not strings", () => {
    expect(service.iconClassForPath(null)).toBe(null);
    expect(service.iconClassForPath(undefined)).toBe(null);
  });

  it("drops the colour class when colouring is turned off", () => {
    expect(service.iconClassForPath("/p/main.js")).toContain("fi-c-medium-yellow");

    atom.config.set("file-icons.coloured", false);
    const classes = service.iconClassForPath("/p/main.js");
    expect(classes).toContain("fi-g-js-icon");
    expect(classes.some((name) => name.startsWith("fi-c-"))).toBe(false);
  });

  it("rebuilds the stylesheet when the set changes", () => {
    expect(service.iconClassForPath("/p/main.js")).toContain("fi-g-js-icon");

    atom.config.set("file-icons.set", "seti");

    expect(ruleTexts().some((rule) => rule.includes("fi-g-js-icon"))).toBe(false);
    // Seti ships one font, so the previous four @font-face rules are gone too.
    expect(ruleTexts().filter((rule) => rule.startsWith("@font-face")).length).toBe(1);
    expect(service.iconClassForPath("/p/main.js")).toContain("fi-s-_javascript");
  });

  it("notifies consumers when its answers change", () => {
    const callback = jasmine.createSpy("onDidChange");
    const subscription = service.onDidChange(callback);

    atom.config.set("file-icons.coloured", false);
    expect(callback.calls.count()).toBe(1);

    atom.config.set("file-icons.set", "seti");
    expect(callback.calls.count()).toBe(2);

    subscription.dispose();
    atom.config.set("file-icons.coloured", true);
    expect(callback.calls.count()).toBe(2);
  });

  it("warns and keeps working when a custom theme folder is unusable", () => {
    spyOn(atom.notifications, "addError");

    atom.config.set("file-icons.set", "seti");
    atom.config.set("file-icons.customThemePath", path.join(__dirname, "fixtures"));

    expect(atom.notifications.addError).toHaveBeenCalled();
    // Falls back to the set that needs no external files.
    expect(service.iconClassForPath("/p/main.js")).toContain("fi-g-js-icon");
  });

  it("removes its stylesheet on deactivation", () => {
    waitsForPromise(() => atom.packages.deactivatePackage("file-icons"));
    runs(() => expect(styleElement()).toBe(null));
  });
});
