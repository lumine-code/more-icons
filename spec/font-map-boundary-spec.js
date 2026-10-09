const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Independently authored square glyph: its cmap owns the two absent private
// codepoints, so a native fallback is distinct from the intended icon font.
const SENTINEL_FONT =
  "AAEAAAAKAIAAAwAgT1MvMi3nQT4AAAEoAAAAYGNtYXDry9UqAAABkAAAAERnbHlmI9FXlwAAAdwAAAAaaGVhZDB1/FoAAACsAAAANmhoZWEF3gROAAAA5AAAACRobXR4A+gAAAAAAYgAAAAGbG9jYQANAAAAAAHUAAAABm1heHAABAAGAAABCAAAACBuYW1l+UTFYQAAAfgAAAHvcG9zdNTZ6NwAAAPoAAAALwABAAAAAQAAGbhfjV8PPPUAAQPoAAAAAObu3F8AAAAA5u7cXwBkAAADIAK8AAAAAwACAAAAAAAAAAEAAAMg/zgAAAPoAAABLAK8AAEAAAAAAAAAAAAAAAAAAAABAAEAAAACAAQAAQAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwPoAZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAPz8/PwAA6QfrugMg/zgAAAMgAMgAAAAAAAAAAAAAAAAAAAAgAAAD6AAAAAAAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQAMAAAAAgACAACAADpB+u467r//wAA6QfruOu6//8W+hRJFEcAAQAAAAAAAAAAAAAAAAANAAAAAQBkAAADIAK8AAMAADMRIRFkArwCvP1EAAAAAAAACgB+AAEAAAAAAAEAGQAAAAEAAAAAAAIABwAZAAEAAAAAAAMAHAAgAAEAAAAAAAQAIQA8AAEAAAAAAAYAHgBdAAMAAQQJAAEAMgB7AAMAAQQJAAIADgCtAAMAAQQJAAMAOAC7AAMAAQQJAAQAQgDzAAMAAQQJAAYAPAE1T3duZWQgSWNvbiBBdWRpdCBTZW50aW5lbFJlZ3VsYXJMdW1pbmVPd25lZEljb25BdWRpdFNlbnRpbmVsT3duZWQgSWNvbiBBdWRpdCBTZW50aW5lbCBSZWd1bGFyT3duZWRJY29uQXVkaXRTZW50aW5lbC1SZWd1bGFyAE8AdwBuAGUAZAAgAEkAYwBvAG4AIABBAHUAZABpAHQAIABTAGUAbgB0AGkAbgBlAGwAUgBlAGcAdQBsAGEAcgBMAHUAbQBpAG4AZQBPAHcAbgBlAGQASQBjAG8AbgBBAHUAZABpAHQAUwBlAG4AdABpAG4AZQBsAE8AdwBuAGUAZAAgAEkAYwBvAG4AIABBAHUAZABpAHQAIABTAGUAbgB0AGkAbgBlAGwAIABSAGUAZwB1AGwAYQByAE8AdwBuAGUAZABJAGMAbwBuAEEAdQBkAGkAdABTAGUAbgB0AGkAbgBlAGwALQBSAGUAZwB1AGwAYQByAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAECCHNlbnRpbmVsAA==";

describe("More Icons native font map boundary", () => {
  let root, face, icon, resource;

  beforeEach(async () => {
    jasmine.useRealClock();
    for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"])
      spyOn(lumine.shell, method).and.returnValue(Promise.resolve());
    spyOn(lumine.application, "openWindow").and.returnValue(Promise.resolve());
    lumine.config.set("more-icons.set", "file-icons");
    lumine.config.set("more-icons.customThemePath", "");
    root = fs.mkdtempSync(path.join(os.tmpdir(), "more-icons-font-map-"));
    for (const file of [".env", "design.figma", "data.json"])
      fs.writeFileSync(path.join(root, file), "");
    face = new FontFace("OwnedIconSentinel", Buffer.from(SENTINEL_FONT, "base64"));
    await face.load();
    document.fonts.add(face);
    await lumine.packages.activatePackage("more-icons");
    icon = document.createElement("span");
    icon.className = "icon";
    jasmine.attachToDOM(icon);
  });

  afterEach(async () => {
    resource?.dispose();
    icon?.remove();
    document.fonts.delete(face);
    if (lumine.packages.isPackageActive("more-icons"))
      await lumine.packages.deactivatePackage("more-icons");
    if (lumine.packages.isPackageLoaded("more-icons"))
      await lumine.packages.unloadPackage("more-icons");
    const temporary = fs.realpathSync(os.tmpdir());
    const target = fs.realpathSync(root);
    const relative = path.relative(temporary, target);
    if (
      !relative ||
      path.isAbsolute(relative) ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`)
    )
      throw new Error("Fixture cleanup escaped the private temporary directory.");
    for (const file of [".env", "design.figma", "data.json"])
      fs.unlinkSync(path.join(target, file));
    fs.rmdirSync(target);
    root = face = icon = resource = null;
  });

  function raster(text, font) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    context.font = font;
    context.fillText(text, 8, 72);
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  }

  for (const [file, glyph, codepoint] of [
    [".env", "dotenv-icon", 0xebb8],
    ["design.figma", "figma-icon", 0xebba],
    ["data.json", "json-icon", 0xeabe],
  ]) {
    it(`renders the current ${glyph} through its primary packaged font`, async () => {
      resource = lumine.icons.applyTo(
        icon,
        { path: path.join(root, file), context: "owned-font-map", hints: { directory: false } },
        { setData: false },
      );
      const deadline = Date.now() + 10000;
      while (!icon.classList.contains(`mi-g-${glyph}`)) {
        if (Date.now() > deadline) throw new Error("Current Core icon provider did not publish.");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const style = getComputedStyle(icon, "::before");
      const character = String.fromCodePoint(codepoint);
      expect(style.fontFamily).toContain("file-icons");
      expect(style.content.slice(1, -1)).toBe(character);
      await document.fonts.load(`64px ${style.fontFamily}`, character);
      const actual = raster(character, `64px ${style.fontFamily}, OwnedIconSentinel`);
      const fallback = raster(character, "64px OwnedIconSentinel");
      expect(actual.some((byte) => byte !== 0)).toBeTrue();
      expect(actual.some((byte, index) => byte !== fallback[index])).toBeTrue();
    });
  }
});
