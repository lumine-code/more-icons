const path = require("path");

const glyphs = require("../sets/file-icons/glyphs.json");
const palette = require("../sets/file-icons/palette.json");
const iconTable = require("../lib/icon-table");
const fileIcons = require("../lib/set-file-icons");
const seti = require("../lib/set-seti");

describe("file-icons", () => {
  describe("the vendored data", () => {
    it("carries every glyph rule the upstream stylesheet defined", () => {
      // 929 = .fi 804 + .devicons 51 + .fa 33 + .mf 21 + .octicons 20. If a
      // refresh changes this, re-run `npm run build:glyphs` and check the diff.
      expect(Object.keys(glyphs).length).toBe(929);
    });

    it("gives every glyph a font and a codepoint", () => {
      const broken = Object.entries(glyphs).filter(
        ([, glyph]) => !glyph.font || !/^[0-9a-f]+$/.test(glyph.char),
      );
      expect(broken).toEqual([]);
    });

    it("has a light and a dark value for all thirty colours", () => {
      expect(Object.keys(palette.dark).length).toBe(30);
      expect(Object.keys(palette.light).length).toBe(30);
      const notHex = Object.values(palette.dark)
        .concat(Object.values(palette.light))
        .filter((value) => !/^#[0-9a-f]{6}$/.test(value));
      expect(notHex).toEqual([]);
    });

    it("decodes the match table into its six indexes", () => {
      expect(iconTable.files.byName.length).toBeGreaterThan(2000);
      expect(iconTable.files.byPath.length).toBeGreaterThan(0);
      expect(iconTable.directories.byName.length).toBeGreaterThan(0);
      for (const icon of iconTable.files.byName) {
        expect(icon.match instanceof RegExp).toBe(true);
      }
    });

    it("resolves every icon class to a glyph or a core octicon class", () => {
      const unresolved = iconTable.files.byName
        .map((icon) => icon.icon)
        .filter((name) => !Object.hasOwn(glyphs, name) && !name.startsWith("icon-"));
      expect(unresolved).toEqual([]);
    });
  });

  describe("the file-icons set", () => {
    it("matches by extension", () => {
      expect(fileIcons.resolve("/p/main.js")).toContain("mi-g-js-icon");
      expect(fileIcons.resolve("/p/script.py")).toContain("mi-g-python-icon");
      expect(fileIcons.resolve("/p/main.rs")).toContain("mi-g-rust-icon");
    });

    it("matches by exact filename ahead of extension", () => {
      expect(fileIcons.resolve("/p/Gemfile")).toContain("mi-g-bundler-icon");
      expect(fileIcons.resolve("/p/.gitignore")).toContain("mi-g-git-icon");
    });

    it("ignores template and backup suffixes", () => {
      expect(fileIcons.resolve("/p/main.js.tpl")).toContain("mi-g-js-icon");
      expect(fileIcons.resolve("/p/config.json~orig")).toContain("mi-g-json-icon");
    });

    it("passes core octicon classes through untouched", () => {
      const classes = fileIcons.resolve("/p/notes.txt");
      expect(classes).toContain("icon-file-text");
      expect(classes).not.toContain("mi-icon");
    });

    it("picks the colour that matches the interface theme", () => {
      // 203 file rules name a different tone per mode; bower is one of them.
      expect(fileIcons.resolve("/p/bower.json", { mode: "dark" })).toContain("mi-c-medium-yellow");
      expect(fileIcons.resolve("/p/bower.json", { mode: "light" })).toContain("mi-c-medium-orange");
    });

    it("builds a declaration for every class it hands out", () => {
      for (const className of fileIcons.resolve("/p/main.js")) {
        if (className === "mi-icon") continue;
        expect(fileIcons.ruleFor(className)).toBeTruthy();
      }
      expect(fileIcons.ruleFor("mi-g-js-icon")).toContain('content: "\\f129"');
      expect(fileIcons.ruleFor("mi-c-medium-yellow")).toBe("color: var(--mi-medium-yellow);");
    });

    it("returns null for a class it does not own", () => {
      expect(fileIcons.ruleFor("icon-file-text")).toBe(null);
      expect(fileIcons.ruleFor("mi-g-not-a-real-icon")).toBe(null);
    });
  });

  describe("the seti set", () => {
    beforeEach(() => {
      seti.load();
      // Seti routes mainstream languages through `languageIds`, which is
      // resolved from the grammar the editor picks. The spec runner starts
      // with no language packages active, so activate the two used below.
      waitsForPromise(() => atom.packages.activatePackage("language-javascript"));
      waitsForPromise(() => atom.packages.activatePackage("language-python"));
    });

    afterEach(() => seti.unload());

    it("matches the longest extension first", () => {
      // `apex` is one of the few extensions Seti maps directly rather than
      // routing through a language id.
      expect(seti.resolve("/p/thing.apex")).toContain("mi-s-_salesforce");
    });

    it("routes mainstream languages through languageIds", () => {
      // Seti has no `js` or `py` entry under fileExtensions at all — these only
      // resolve because the grammar lookup supplies a language id.
      expect(seti.resolve("/p/main.js")).toContain("mi-s-_javascript");
      expect(seti.resolve("/p/script.py")).toContain("mi-s-_python");
    });

    it("falls back to the default icon", () => {
      expect(seti.resolve("/p/unknown.zzzz")).toContain("mi-s-_default");
    });

    it("uses the light definitions on a light interface theme", () => {
      expect(seti.resolve("/p/main.js", { mode: "light" })).toContain("mi-s-_javascript_light");
    });

    it("leaves directories alone", () => {
      expect(seti.resolve("/p/src", { directory: true })).toBe(null);
    });

    it("builds a font declaration from the manifest", () => {
      const rule = seti.ruleFor("mi-s-_javascript");
      expect(rule).toContain("font-family: seti;");
      expect(rule).toContain("font-size: 150%;");
      expect(rule).toMatch(/content: "\\E[0-9A-F]+";/);
      expect(rule).toMatch(/color: #[0-9a-f]{6};/);
    });

    it("rejects a folder with no manifest", () => {
      expect(() => seti.load(path.join(__dirname, "fixtures"))).toThrow();
    });
  });
});
