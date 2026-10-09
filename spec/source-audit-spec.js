const path = require("node:path");

describe("icon mapping source contracts", () => {
  let service;
  let container;

  beforeEach(async () => {
    await lumine.packages.deactivatePackage("more-icons");
    if (lumine.packages.getLoadedPackage("more-icons")) {
      await lumine.packages.unloadPackage("more-icons");
    }
    lumine.config.set("more-icons.set", "file-icons");
    lumine.config.set("more-icons.customThemePath", "");
    lumine.config.set("more-icons.coloured", true);
    const pack = await lumine.packages.activatePackage("more-icons");
    service = pack.mainModule.provideIcons();
    await Promise.resolve();
    container = document.createElement("div");
    container.style.color = "rgb(17, 23, 29)";
    document.body.appendChild(container);
  });

  afterEach(async () => {
    container.remove();
    await lumine.packages.deactivatePackage("more-icons");
    lumine.config.unset("more-icons.set");
    lumine.config.unset("more-icons.customThemePath");
    lumine.config.unset("more-icons.coloured");
  });

  it("keeps Mirah glyphs independent of earlier filenames and cache resets", () => {
    const fileIcons = require("../lib/set-file-icons");
    for (const extension of ["mirah", "druby"]) {
      for (const name of ["one", "two", "three", "four"]) {
        const target = { path: path.join("owned-icons", `${name}.${extension}`), hints: {} };
        expect(service.iconFor(target)?.classes).toContain("mi-g-mirah-icon");
        fileIcons.clearCache();
        expect(service.iconFor(target)?.classes).toContain("mi-g-mirah-icon");
      }
    }
    expect(service.iconFor({ path: "ordinary.js", hints: {} }).classes).toContain("mi-g-js-icon");
  });

  it("uses text colour for Seti glyphs when colouring is disabled and restores it", () => {
    lumine.config.set("more-icons.set", "seti");
    const target = { path: "owned-icons/example.apex", hints: {} };
    const element = document.createElement("span");
    const update = () => {
      element.className = ["icon", ...service.iconFor(target).classes].join(" ");
    };
    update();
    container.appendChild(element);
    const coloured = getComputedStyle(element, "::before").color;
    const text = getComputedStyle(container).color;
    expect(coloured).not.toBe(text);

    lumine.config.set("more-icons.coloured", false);
    update();
    expect(getComputedStyle(element, "::before").color).toBe(text);

    lumine.config.set("more-icons.coloured", true);
    update();
    expect(getComputedStyle(element, "::before").color).toBe(coloured);
  });
});
