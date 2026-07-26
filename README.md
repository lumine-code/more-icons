# more-icons

Show file-type icons in the tree view, tabs, and search results.

Ships two icon sets and one runtime. Both are glyph fonts, so icons take their size from the surrounding text and stay crisp at any zoom level.

## Features

- **file-icons set**: roughly 900 glyphs with per-language colours, from the long-running `file-icons` project.
- **Seti set**: the icon set Visual Studio Code ships by default.
- **Light and dark**: each set carries a second palette, swapped when the interface theme changes.
- **Custom themes**: on the `seti` set, point the package at any folder holding a Visual Studio Code file-icon-theme manifest.
- **Lazily generated CSS**: a rule is written the first time an icon is actually shown, not for all 900 up front.
- **Grammar-aware**: on the `seti` set, files whose name and extension the manifest does not list are matched through the grammar the editor picked for them.

## Installation

To install `more-icons` search for _more-icons_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/more-icons`.

## Usage

Pick a set under Settings. `file-icons` has the wider coverage and colours icons by language family; `seti` matches Visual Studio Code.

The `file-icons` set draws folders it recognises by name, such as `.github` and `node_modules`; `seti` has no folder glyphs and leaves every directory to the editor. Either set leaves a directory alone when it is a symlink, a submodule, or a repository root, because that says more about it than its name does.

To use a different Visual Studio Code icon theme, select the `seti` set and set **Custom theme folder** to a directory containing a `*-icon-theme.json` file and the fonts it references. Themes whose icons are SVG rather than font glyphs are not supported.

`native-icons` composes with this package: it claims nothing until you add patterns to its greenlist, and the files you list there then take the operating system's icon instead of the glyphs shown here.

## Services

- **[icons.provider](https://lumine-code.github.io/docs.html#services/icons.provider)** (`1.0.0`): provided to the editor's icon registry; answers files, and the directories the active set recognises, with that set's glyph classes; declines everything else so another provider can answer, and reports through `onDidChange` when the set or the interface theme changes.

## Attribution

The icon fonts and mapping tables under `sets/` come from the `file-icons` project, Seti UI, and Visual Studio Code. See `NOTICE` for the full list and their licences.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
