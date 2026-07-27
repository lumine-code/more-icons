"use strict";

// Owns the package's single <style> element.
//
// Rules are written lazily: a tree view showing fifty distinct file types
// needs fifty rules, not the 929 the file-icons set could produce. This
// mirrors the approach `native-icons` already uses for its generated rules.

// Three classes beat a theme's own `.icon::before`, so no !important is needed.
const SELECTOR = (className) => `.icon.${className}::before`;

class Stylesheet {
  constructor() {
    this.element = null;
    this.written = new Set();
    this.contract = false;
  }

  attach() {
    if (this.element) return;
    // Editors with the icon geometry contract declare this token in their base
    // variables; glyph rules are then emitted against the contract's fixed box
    // (size ratios and translate nudges). Without it, the legacy self-contained
    // geometry is emitted instead, byte-for-byte what this package always
    // shipped.
    this.contract =
      getComputedStyle(document.documentElement).getPropertyValue("--icon-contract").trim() ===
      "box";
    this.element = document.createElement("style");
    this.element.dataset.moreIcons = "true";
    document.head.appendChild(this.element);
  }

  detach() {
    if (this.element) this.element.remove();
    this.element = null;
    this.written.clear();
  }

  get sheet() {
    return this.element && this.element.sheet;
  }

  // Called on every set or theme-mode change: the generated rules embed both.
  reset(set, mode) {
    const { sheet } = this;
    if (!sheet) return;

    while (sheet.cssRules.length) sheet.deleteRule(0);
    this.written.clear();

    for (const face of set.fontFaces()) {
      this.insert(
        `@font-face { font-family: "${face.family}"; font-weight: normal; font-style: normal; ` +
          `src: url("data:font/${face.format};charset=utf-8;base64,${face.data}") format("${face.format}"); }`,
      );
    }

    // Shared geometry for every glyph this package renders. Kept off the six
    // core octicon classes the file-icons table passes through, which the
    // editor's own stylesheet already sizes.
    if (this.contract) {
      // Restates the contract box (minus font-size, which every glyph rule
      // carries itself) so a theme that still ships the old one-dark icon
      // block cannot pull these glyphs out of the contract frame. Under the
      // bundled themes this is value-identical duplication.
      this.insert(
        ".icon.mi-icon::before { display: inline-block; " +
          "width: var(--component-icon-size, 16px); height: var(--component-icon-size, 16px); " +
          "line-height: var(--component-icon-size, 16px); text-align: center; " +
          "vertical-align: text-bottom; font-weight: normal; font-style: normal; " +
          "-webkit-font-smoothing: antialiased; }",
      );
    } else {
      this.insert(
        ".icon.mi-icon::before { display: inline-block; width: 16px; position: relative; " +
          "text-align: center; line-height: 1; font-weight: normal; font-style: normal; " +
          "-webkit-font-smoothing: antialiased; }",
      );
    }

    const declarations = set.rootDeclarations(mode);
    if (declarations) this.insert(`:root { ${declarations} }`);
  }

  insert(rule) {
    try {
      this.sheet.insertRule(rule, this.sheet.cssRules.length);
      return true;
    } catch {
      // A malformed glyph in a third-party manifest should cost that one icon,
      // not the whole stylesheet.
      return false;
    }
  }

  // Ensure every class in `classes` has a rule, generating it on first use.
  ensure(set, classes) {
    if (!this.sheet) return;
    for (const className of classes) {
      if (this.written.has(className)) continue;
      this.written.add(className);
      const declarations = set.ruleFor(className, this.contract);
      if (declarations) this.insert(`${SELECTOR(className)} { ${declarations} }`);
    }
  }
}

module.exports = Stylesheet;
