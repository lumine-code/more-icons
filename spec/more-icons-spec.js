const path = require("path");

const glyphs = require("../sets/file-icons/glyphs.json");
const fonts = require("../sets/file-icons/fonts.json");
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

    it("carries a font default for every family a glyph names", () => {
      const families = new Set(Object.values(glyphs).map((glyph) => glyph.font));
      for (const family of families) {
        const font = fonts[family];
        expect(font).toBeDefined();
        expect(font.size).toBeGreaterThanOrEqual(13);
        expect(font.size).toBeLessThanOrEqual(16);
        expect(font.top).toBeGreaterThanOrEqual(0);
        expect(font.top).toBeLessThanOrEqual(3);
        expect(typeof font.nudge).toBe("number");
      }
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

    // Contract-mode emission: every glyph resolves to its upstream absolute
    // size (per-font default from fonts.json unless the glyph recorded a
    // deviation), emitted as a ratio of the contract box; only the deviation
    // from the font's own `top` survives as a translate — the base is what the
    // box's content-area centring replaces.
    describe("under the icon contract", () => {
      it("emits the font's default size as a box ratio", () => {
        // js-icon is Mfizz (14px default) with no size of its own.
        const rule = fileIcons.ruleFor("mi-g-js-icon", true);
        expect(rule).toContain("font-size: calc(var(--component-icon-size, 16px) * 14 / 16);");
        expect(rule).not.toContain("top:");
      });

      it("keeps a glyph's own size deviation", () => {
        // bootstrap-icon deviates from Devicons' 16px default down to 15px.
        const rule = fileIcons.ruleFor("mi-g-bootstrap-icon", true);
        expect(rule).toContain("* 15 / 16");
      });

      it("adds the calibrated font nudge to the glyph's top deviation", () => {
        // js-icon: top 1 on a Mfizz default of 0, Mfizz nudge 0 → 1px down.
        expect(fileIcons.ruleFor("mi-g-js-icon", true)).toContain("translate: 0px 1px;");
        // agda-icon: top 2 on a file-icons default of 0, nudge -1 → 1px down.
        expect(fileIcons.ruleFor("mi-g-agda-icon", true)).toContain("translate: 0px 1px;");
        // bootstrap-icon: top 2 on a Devicons default of 3, nudge +1 → even.
        expect(fileIcons.ruleFor("mi-g-bootstrap-icon", true)).not.toContain("translate:");
        // angular-icon: Devicons defaults, so just the +1 calibration nudge.
        expect(fileIcons.ruleFor("mi-g-angular-icon", true)).toContain("translate: 0px 1px;");
      });

      it("emits no translate for a glyph its font already centres", () => {
        // database-icon: octicons defaults, octicons nudge 0.
        expect(fileIcons.ruleFor("mi-g-database-icon", true)).toContain("* 16 / 16");
        expect(fileIcons.ruleFor("mi-g-database-icon", true)).not.toContain("translate:");
      });

      it("keeps horizontal offsets", () => {
        // swift-icon carries left: -1 and no top (Devicons nudge +1).
        expect(fileIcons.ruleFor("mi-g-swift-icon", true)).toContain("translate: -1px 1px;");
      });

      it("leaves colour classes alone", () => {
        expect(fileIcons.ruleFor("mi-c-medium-yellow", true)).toBe(
          "color: var(--mi-medium-yellow);",
        );
      });
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

    it("keeps the manifest's designed size under the icon contract", () => {
      // Seti's 150% is row-relative by design (the VS Code manifest declares
      // it); the contract centres the oversized ink instead of scaling it.
      const rule = seti.ruleFor("mi-s-_javascript", true);
      expect(rule).toContain("font-size: 150%;");
      // The calibrated set-wide nudge down to the octicon reference position.
      expect(rule).toContain("translate: 0px 1px;");
    });

    it("rejects a folder with no manifest", () => {
      expect(() => seti.load(path.join(__dirname, "fixtures"))).toThrow();
    });
  });
});
