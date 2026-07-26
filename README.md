# file-icon-themes

Show file-type icons in the tree view, tabs, and search results.

Ships two icon sets and one runtime. Both are glyph fonts, so icons take their size from the surrounding text and stay crisp at any zoom level.

## Features

- **file-icons set**: roughly 900 glyphs with per-language colours, from the long-running `file-icons` project.
- **Seti set**: the icon set Visual Studio Code ships by default.
- **Light and dark**: each set carries a second palette, swapped when the interface theme changes.
- **Custom themes**: point the package at any folder holding a Visual Studio Code file-icon-theme manifest.
- **Lazily generated CSS**: a rule is written the first time an icon is actually shown, not for all 900 up front.
- **Grammar-aware**: files whose extension no set recognises are matched through the grammar the editor picked for them.

## Installation

To install `file-icon-themes` search for _file-icon-themes_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/file-icon-themes`.

## Usage

Pick a set under Settings. `file-icons` has the wider coverage and colours icons by language family; `seti` matches Visual Studio Code.

Only files get icons. Directories keep the tree view's own folder, repository, submodule, and symlink icons, because neither set defines folder glyphs.

To use a different Visual Studio Code icon theme, select the `seti` set and set **Custom theme folder** to a directory containing a `*-icon-theme.json` file and the fonts it references. Themes whose icons are SVG rather than font glyphs are not supported.

`native-icons` composes with this package: leave it in its default `support` mode and its greenlisted extensions will override the glyphs shown here.

## Services

- **atom.file-icons** (`1.0.0`): provided to icon consumers (tree view, tabs, search panel, fuzzy finders, archive view); exposes `iconClassForPath(filePath)` returning an array of CSS class names, and `onDidChange(callback)` which fires when the set or the interface theme changes.

## Attribution

The icon fonts and mapping tables under `sets/` come from the `file-icons` project, Seti UI, and Visual Studio Code. See `NOTICE` for the full list and their licences.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
