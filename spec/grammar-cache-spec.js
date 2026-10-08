const path = require("path");

describe("Seti grammar-dependent icon ownership", () => {
  let main, service, subscriptions;
  const classesFor = (filePath) => service.iconFor({ path: filePath, hints: {} }).classes;

  beforeEach(async () => {
    lumine.config.set("theme.mode", "dark");
    await lumine.packages.activatePackage("language-python");
    await lumine.packages.activatePackage("language-javascript");
    lumine.config.set("more-icons.set", "seti");
    await lumine.packages.activatePackage(path.join(__dirname, ".."));
    main = lumine.packages.getActivePackage("more-icons").mainModule;
    service = main.provideIcons();
    subscriptions = [];
  });

  afterEach(async () => {
    for (const subscription of subscriptions) subscription.dispose();
    await lumine.packages.deactivatePackage("more-icons");
  });

  const iconElement = (filePath) => {
    const element = document.createElement("span");
    subscriptions.push(
      lumine.icons.applyTo(element, { path: filePath, context: "spec", hints: {} }),
    );
    return element;
  };

  it("keeps path-specific grammar icons separate for the same basename", () => {
    lumine.config.set("core.customFileTypes", {
      "source.python": ["python/entry.auditicon"],
      "source.js": ["javascript/entry.auditicon"],
    });

    expect(classesFor("/p/python/entry.auditicon")).toContain("mi-s-_python");
    expect(classesFor("/p/javascript/entry.auditicon")).toContain("mi-s-_javascript");
  });

  it("refreshes the actual provider and DOM after custom file types change", async () => {
    const file = "/p/entry.auditicon";
    lumine.config.set("core.customFileTypes", { "source.python": ["auditicon"] });
    const element = iconElement(file);
    await flushMicrotasks();
    expect(element.classList.contains("mi-s-_python")).toBe(true);
    const changed = jasmine.createSpy("icon answers changed");
    subscriptions.push(service.onDidChange(changed));

    lumine.config.set("core.customFileTypes", { "source.js": ["auditicon"] });

    expect(classesFor(file)).toContain("mi-s-_javascript");
    expect(changed).toHaveBeenCalled();
    await flushMicrotasks();
    expect(element.classList.contains("mi-s-_javascript")).toBe(true);
    expect(element.classList.contains("mi-s-_python")).toBe(false);
  });

  it("refreshes cached fallback icons when a grammar is registered", async () => {
    await lumine.packages.deactivatePackage("language-javascript");
    const file = "/p/entry.auditicon";
    lumine.config.set("core.customFileTypes", { "source.js": ["auditicon"] });
    const element = iconElement(file);
    await flushMicrotasks();
    expect(element.classList.contains("mi-s-_default")).toBe(true);
    const changed = jasmine.createSpy("grammar added repaint");
    subscriptions.push(service.onDidChange(changed));

    await lumine.packages.activatePackage("language-javascript");

    expect(classesFor(file)).toContain("mi-s-_javascript");
    expect(changed).toHaveBeenCalled();
    await flushMicrotasks();
    expect(element.classList.contains("mi-s-_javascript")).toBe(true);
  });

  it("refreshes icons when their grammar is removed", async () => {
    const file = "/p/entry.auditicon";
    lumine.config.set("core.customFileTypes", { "source.js": ["auditicon"] });
    const element = iconElement(file);
    await flushMicrotasks();
    expect(element.classList.contains("mi-s-_javascript")).toBe(true);
    const changed = jasmine.createSpy("grammar removed repaint");
    subscriptions.push(service.onDidChange(changed));

    await lumine.packages.deactivatePackage("language-javascript");

    expect(classesFor(file)).toContain("mi-s-_default");
    expect(changed).toHaveBeenCalled();
    await flushMicrotasks();
    expect(element.classList.contains("mi-s-_default")).toBe(true);
  });

  it("keeps static name and extension matches ahead of grammar selection", () => {
    const select = spyOn(lumine.grammars, "selectGrammar").and.callThrough();
    const seti = require("../lib/set-seti");

    expect(seti.resolve("/p/file.apex")).toContain("mi-s-_salesforce");
    expect(select.calls.allArgs().filter(([file]) => file === "/p/file.apex")).toEqual([]);
  });

  it("preserves the style and font lifetime during grammar invalidation", async () => {
    const style = document.head.querySelector("style[data-more-icons]");
    const font = Array.from(style.sheet.cssRules).find(
      (rule) => rule.type === CSSRule.FONT_FACE_RULE,
    );
    classesFor("/p/script.py");
    const ruleCount = style.sheet.cssRules.length;
    lumine.config.set("core.customFileTypes", { "source.python": ["auditicon"] });
    await lumine.packages.deactivatePackage("language-javascript");

    expect(document.head.querySelector("style[data-more-icons]")).toBe(style);
    expect(Array.from(style.sheet.cssRules)).toContain(font);
    expect(style.sheet.cssRules.length).toBe(ruleCount);
  });

  it("releases grammar and config listeners when the provider deactivates", async () => {
    const seti = require("../lib/set-seti");
    const clear = spyOn(seti, "clearCache").and.callThrough();
    await lumine.packages.deactivatePackage("more-icons");
    lumine.config.set("core.customFileTypes", { "source.js": ["auditicon"] });
    await lumine.packages.deactivatePackage("language-javascript");
    await lumine.packages.activatePackage("language-javascript");

    expect(clear).not.toHaveBeenCalled();
    expect(document.head.querySelector("style[data-more-icons]")).toBe(null);
  });
});
