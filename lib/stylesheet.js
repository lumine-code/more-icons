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
  }

  attach() {
    if (this.element) return;
    this.element = document.createElement("style");
    this.element.dataset.fileIcons = "true";
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
    this.insert(
      ".icon.fi-icon::before { display: inline-block; width: 16px; position: relative; " +
        "text-align: center; line-height: 1; font-weight: normal; font-style: normal; " +
        "-webkit-font-smoothing: antialiased; }",
    );

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
      const declarations = set.ruleFor(className);
      if (declarations) this.insert(`${SELECTOR(className)} { ${declarations} }`);
    }
  }
}

module.exports = Stylesheet;
