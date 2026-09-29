# 2026-09 — editor text styles: new default controls, keybindings and loaded styles

Date: 2026-09-29. Issue: [#514](https://github.com/N1XUS/malva-ui/issues/514)
(editor expansion N1: text styles, block IDs and heading links).

Applies to **`@malva-ui/editor`** only: the formatting preset
(`mlvEditorFormattingExtensions()`, and so `mlvEditorDefaultExtensions()`),
`MlvEditor`'s default toolbar (docked bar and selection bubble) and the
standalone `MlvEditorToolbar` (`mlv-editor-toolbar [context]`).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
token, i18n key or BEM class was renamed, removed or retyped. Four things
change at an unchanged API, each under [VERSIONING.md](../../VERSIONING.md)
§ 3 row 112 (_changed default behaviour at an unchanged API — focus, ARIA,
what a value means_):

- **(a)** the default toolbar gains seven controls, and narrow mode's
  _More formatting_ menu gains their rows;
- **(b)** the preset claims `Mod-,` and `Mod-.`;
- **(c)** stored or pasted HTML carrying inline font styles, block line
  height, a painted background or sub / superscript now loads as formatting
  where it used to be rejected or stripped;
- **(d)** a consumer extension named `subscript`, `superscript`, `fontFamily`
  or `fontSize` composed with the preset is now a duplicate.

Everything else is additive — new exported extensions, controls, tokens and
commands (row 114), two opt-in `MlvEditor` inputs, preset options and 14
optional `MlvEditorI18n` keys with shipped defaults (row 115). One adjacent
patch rides along under row 117: a strict load now accepts the colour spans
the editor itself writes (§ 1, last table). On the `0.x` line this is a `!`
commit, which `nx release` demotes to a minor: `0.2.0` → `0.3.0`.

## 1. Before / after

**Toolbar.** The docked bar, the selection bubble and the standalone shell
render one shared declaration, so all three move together. A control whose
command the extension set lacks stays hidden, as before.

| Surface                                                    | Before                                                                                                                      | After                                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default controls, in order                                 | undo / redo, zoom, heading, list, inline marks, text colour, highlight, alignment, link, table, block inserts, image upload | undo / redo, zoom, heading, list, **font family, font size**, inline marks, text colour, highlight, **Clear formatting**, alignment, **line height**, link, table, block inserts, image upload |
| Inline marks                                               | bold, italic, strike, underline                                                                                             | bold, italic, strike, underline, **inline code, subscript, superscript** (code shows whenever the schema has StarterKit's `code` mark)                                                         |
| Roving toolbar sequence and ARIA nodes                     | the controls above                                                                                                          | seven more tab-sequence members; the three menus are `aria-haspopup="menu"` buttons named through the new `styleValue` key (e.g. "Font size: 16")                                              |
| Narrow mode (< 640px), _More formatting_                   | bold, italic, strike, underline, the four alignments, blockquote, code block, horizontal rule                               | **Font ›, Font size ›**, bold, italic, strike, underline, **code, subscript, superscript, Clear formatting**, the four alignments, **Line height ›**, blockquote, code block, horizontal rule  |
| Consumer toolbar (`[mlvEditorToolbar]`, start / end slots) | —                                                                                                                           | unchanged: nothing is added to it, and its controls never hide for narrow mode                                                                                                                 |

**Keyboard.** `Mod-,` toggles subscript and `Mod-.` superscript (`Mod` is ⌘
on macOS, Ctrl elsewhere). ProseMirror `preventDefault()`s a key it handles,
so the chord no longer reaches the browser's default, and an application
shortcut that honours `defaultPrevented` no longer fires while focus is in
the editor. Every existing binding is unchanged.

**Loading** — what a value containing the markup does, with the default
preset:

| Markup                                                          | Before, strict load (`MlvEditor` value)                                                   | Before, non-strict (paste, a headless `Editor`) | After, either path                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `<span style="font-family: …">`, `<span style="font-size: …">`  | `editorError` `{ code: 'parse' }`; value restored to the last valid one (`null` at first) | reduced to plain text                           | loads as `textStyle` `fontFamily` / `fontSize`, renders, re-serializes (Markdown: one inline `<span style>`) |
| `<sub>`, `<sup>`, `<span style="vertical-align: sub \| super">` | as above                                                                                  | reduced to plain text                           | loads as the `subscript` / `superscript` mark (Markdown: inline `<sub>` / `<sup>`)                           |
| `<span style="background-color: …">` whose background paints    | as above                                                                                  | no highlight                                    | loads as a coloured `highlight`                                                                              |
| the same span with `transparent`, a CSS-wide keyword or alpha 0 | as above                                                                                  | no highlight                                    | **no highlight** — Google Docs writes `background-color: transparent` on every run it copies                 |
| `<p style="line-height: …">`, the same on a heading             | loaded; the line height dropped                                                           | line height dropped                             | kept as the block's `lineHeight` (Markdown: the block falls back to whole-node HTML)                         |
| `<span style="color: …">` — **row 117, adjacent patch**         | `editorError` `{ code: 'parse' }`, although the editor writes exactly this span           | loaded                                          | loads                                                                                                        |

A span declaring anything the schema cannot store (`letter-spacing`, say),
or carrying an attribute besides `style`, still fails a strict load, so
nothing is dropped silently.

**Duplicate names.** With the preset plus a consumer extension of the same
name, Tiptap warns "Duplicate extension names found", the schema takes the
definition listed last, and both stay registered — commands, keyboard
shortcuts and plugins from each (probed on the `subscript` / `superscript`
/ `fontFamily` / `fontSize` pairs).

**Unchanged:** every selector, input, output, token, BEM class and existing
i18n key; values without these styles load and serialize byte-identically;
block IDs and heading anchors are off unless `blockIds` / `headingAnchors`
turn them on; consumer toolbars and slot content; the Markdown tokenizer
allowlist; every keyboard binding other than the two above.

## 2. Mechanism

- The built-in groups are declared once, in an internal component the
  docked bar, the bubble's pane and the standalone shell all stamp. Each new
  control gates on its command (`setFontFamily`, `setFontSize`,
  `setBlockLineHeight`, `resetFormatting`, `toggleCode`, `toggleSubscript`,
  `toggleSuperscript`), so an extension set without it hides it.
- The preset adds Tiptap's `FontFamily` / `FontSize`,
  `MlvEditorBlockLineHeight` (`blockLineHeight`), `MlvEditorSubscript` /
  `MlvEditorSuperscript` (with the two keybindings) and
  `MlvEditorResetFormatting` (`resetFormatting`).
- Two span rules run before upstream's text-style rule: one consumes a span
  whose whole inline style the schema stores, one skips a span whose style
  only other marks store. That is what lets a strict load accept the spans —
  the colour span of row 117 included — while an unstored declaration still
  reaches Tiptap's content check.
- Highlight gains a non-consuming `span[style*="background-color"]` rule
  whose `getAttrs` rejects a background that paints nothing: empty,
  `transparent`, a CSS-wide keyword, or alpha 0 in `#RGBA` / `#RRGGBBAA` or
  a colour function.

## 3. What to do

- **(a) You want the old toolbar.** Two routes, each keeping a different
  half of it.

  **Do, for the old control set:** compose it yourself through
  `[mlvEditorToolbar]` from the exported controls; a consumer toolbar gains
  nothing when the defaults change. This keeps the old **controls, not the
  old layout**: a composed toolbar replaces the whole default bar, so it has
  no dividers between groups, no scroll fade, and no narrow-mode _More
  formatting_ overflow — its controls never hide for narrow mode.

  ```html
  <mlv-editor label="Body" [(value)]="body">
    <ng-template mlvEditorToolbar>
      <mlv-editor-undo-redo />
      <mlv-editor-zoom />
      <mlv-editor-heading />
      <mlv-editor-list />
      <mlv-editor-inline-marks />
      <mlv-editor-text-color />
      <mlv-editor-highlight />
      <mlv-editor-alignment />
      <mlv-editor-link />
      <mlv-editor-table />
      <mlv-editor-block-insert />
      <mlv-editor-image-upload />
    </ng-template>
  </mlv-editor>
  ```

  `mlv-editor-inline-marks` shows inline code, subscript and superscript
  whenever the extension set supports them; for exactly the old four marks,
  write your own `button[mlvButton][mlvEditorToolbarWidget]`s against the
  template's context (`let-ctx`, then
  `ctx.run((e) => e.chain().focus().toggleBold().run())`).

  **Do, for the old layout:** keep the default bar and filter the new
  extensions out of the preset by name — the `ADDED` filter in (c). The bar
  keeps its dividers, scroll fade and narrow mode, and a control whose
  command the extension set lacks hides, so six of the seven new controls
  disappear: subscript, superscript, font family, font size, line height and
  Clear formatting. Inline code stays new, because StarterKit brings the
  `code` mark. The same filter also makes a strict load reject those styles
  again and paste strip them, as (c) describes — take this route only if that
  is acceptable.

  Specs, snapshots or ARIA baselines counting toolbar buttons or walking the
  roving sequence: expect the seven new members (one, inline code, on the
  filter route), or compose the bar.

- **(b) You rely on `Mod-,` / `Mod-.`** — an application shortcut, or the
  browser default for the chord. **Do:** rebind or remove them through the
  extension:

  ```ts
  readonly extensions = mlvEditorDefaultExtensions().map((extension) =>
    extension.name === 'subscript' || extension.name === 'superscript'
      ? extension.extend({ addKeyboardShortcuts: () => ({}) })
      : extension,
  );
  ```

  `<mlv-editor [extensions]="extensions">` then leaves both chords unhandled
  while `toggleSubscript` / `toggleSuperscript` and the buttons keep
  working; return your own map from `addKeyboardShortcuts` to move them.

- **(c) Stored or pasted HTML must stay stripped** — a CMS import whose
  inline styles you never meant to keep, a pipeline that treated a strict
  `parse` error as "reject this value". **Do:** sanitize inline styles and
  `<sub>` / `<sup>` before handing the value to the editor, or drop the
  extensions that store them:

  ```ts
  const ADDED = new Set(['fontFamily', 'fontSize', 'blockLineHeight',
    'subscript', 'superscript', 'resetFormatting']);
  readonly extensions = mlvEditorDefaultExtensions().filter(
    (extension) => !ADDED.has(extension.name),
  );
  ```

  That restores the old load behaviour for those styles — a strict load
  rejects them again, paste strips them — except the colour span (row 117),
  which loads either way. A painted `background-color` span now becomes a
  highlight; to keep it out, drop the background before loading.

- **(d) You add your own `Subscript`, `Superscript`, `FontFamily` or
  `FontSize`** to the preset. **Do:** drop yours and use the preset's
  (`@malva-ui/editor` exports `MlvEditorSubscript` / `MlvEditorSuperscript`;
  font family and size are Tiptap's own), or filter the preset's out by name
  as above before appending yours. Leaving both in registers both — their
  commands and shortcuts included — with the schema taking the one listed
  last.

## 4. Verification

- **Toolbar:** `editor-toolbar-groups.spec.ts` pins the order, the same
  control set in the standalone shell, the three new inline marks and an axe
  sweep with the new controls on the row; `editor-toolbar-narrow.spec.ts`
  pins the overflow rows and submenus in toolbar order, the rows an extension
  set without the commands omits, the selection bubble and axe with the
  overflow open; `editor-toolbar-hidden-owner.spec.ts` pins that an
  unsupported control stays hidden across a narrow → wide change (red on the
  pre-review code for all four menu / alignment hosts).
- **Keyboard:** `editor-script.spec.ts` pins that `Mod-,` / `Mod-.` are
  claimed by the script marks alone, and the swap over the other script mark.
- **Loading:** `editor-text-style.spec.ts` covers the loading table in HTML,
  JSON and Markdown — a strict `MlvEditor` load of each span shape, paste,
  block line height — and the exact Google Docs run shape: no highlight in
  any format, `isActive('highlight') === false`, and the zero-alpha forms,
  red before the `paintsBackground` guard.
- **Duplicates and the Dos:** probed, then removed — Tiptap's duplicate
  warning and last-wins schema for the four names; the `.extend()` map
  leaving `Mod-,` unhandled with `toggleSubscript` still defined; the name
  filter hiding the six controls while inline code stays.
