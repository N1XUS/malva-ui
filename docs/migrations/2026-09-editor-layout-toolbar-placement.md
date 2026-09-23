# `mlv-editor`: an uncapped editor grows without scrolling; layout inputs

Date: 2026-09-23. Issue: [#416](https://github.com/N1XUS/malva-ui/issues/416).

Applies to **`@malva-ui/editor`** only: `MlvEditor` (`mlv-editor`) and its
stylesheet. **No exported symbol was renamed or removed.** Six inputs and two
unions are added (`MlvEditorToolbarPosition`, `MlvEditorToolbarAppearance`).

- **Why it is breaking:** a changed **default behaviour** at an unchanged API
  ([VERSIONING.md](../../VERSIONING.md) §3). An editor with neither `height`
  nor `maxHeight` — every editor before this change — is no longer a scroll
  container. Zoom now reflows it instead of scrolling it. The toolbar root
  moves one element deeper, and BEM class names are public API.

## Before / after

| Surface                                                    | Before                                                                                                                                                                                                          | After                                                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.mlv-editor__viewport`, no `height` / `maxHeight`         | `overflow: auto; overscroll-behavior: contain` in every configuration. It is a scroll container even with nothing to scroll, and in Chromium a wheel over the editor stops there instead of scrolling the page. | No `overflow`, no `overscroll-behavior`. There is never a scrollbar, and a wheel, touch or key scroll reaches the page.                                                     |
| `.mlv-editor__viewport`, `height` or `maxHeight` set       | — (the inputs did not exist)                                                                                                                                                                                    | `.mlv-editor--capped`: `overflow: auto; overscroll-behavior: contain`                                                                                                       |
| Zoom (`zoom` signal, `--mlv-editor-zoom`)                  | `transform: scale()` from the physical top-left (`transform-origin: left top`), with a `--mlv-duration-fast` (100ms) transition. A zoomed document scrolled the viewport on both axes.                          | CSS `zoom`. Uncapped, it **reflows**: the text rewraps and the editor grows. Capped, it **magnifies** inside the scroller, as before. **No transition.** It mirrors in RTL. |
| `MlvEditorZoom` opt-in `fitToContainer`, uncapped          | Picked the level at which the natural width fits                                                                                                                                                                | Keeps the current level for reflowable content. It still shrinks content that cannot wrap. The Fit option stays in the list.                                                |
| `.mlv-editor .mlv-form-control-wrapper__control-container` | `overflow: hidden`                                                                                                                                                                                              | `overflow: clip`: it clips the same, but it is not a scroll container                                                                                                       |
| Toolbar DOM                                                | `.mlv-editor__surface > .mlv-editor__toolbar`                                                                                                                                                                   | `.mlv-editor__surface > .mlv-editor__toolbar-band > .mlv-editor__toolbar`                                                                                                   |
| Toolbar hairline                                           | `border-bottom`                                                                                                                                                                                                 | `border-block-end`: the same pixels. A bottom toolbar draws `border-block-start` instead.                                                                                   |
| Narrow toolbar cut-over (640px)                            | Measured the toolbar root's content box, which excludes the root's inline padding (2 × 0.5rem)                                                                                                                  | Measures `.mlv-editor__surface`. The threshold is unchanged, but the measured box is 16px wider, so a surface 640–655px wide now keeps the wide toolbar.                    |

## New public surface

- **Inputs** on `mlv-editor`: `height`, `minHeight`, `maxHeight`
  (`number | string | undefined`: a number is px, a string passes through
  verbatim once trimmed, `undefined` writes nothing), `toolbarPosition`
  (`'top' | 'bottom'`, default `'top'`), `toolbarAppearance`
  (`'bar' | 'floating'`, default `'bar'`) and `toolbarSticky` (boolean, default
  `false`).
- **BEM classes:** `.mlv-editor__toolbar-band` (the wrapper that carries every
  placement concern), `.mlv-editor--capped`, and
  `.mlv-editor--toolbar-{top,bottom,bar,floating,sticky}`.
- **Custom properties.** The inputs write `--mlv-editor-height`,
  `--mlv-editor-min-height` and `--mlv-editor-max-height` on the host.
  `--mlv-editor-toolbar-sticky-offset` is read with a fallback of `0` and never
  declared, so an app sets it once on any ancestor.
  `--mlv-editor-toolbar-block-size` is declared on `.mlv-editor` as
  `calc(var(--mlv-height-s) + 2 * var(--mlv-spacing-1))` (2.75rem). It is
  the same at every density, because every built-in toolbar control pins the
  `tight` size.
- **Cap versus floor.** Under a cap the cap wins. The capped viewport has no
  floor (`min-block-size: 0`), so a `height` / `maxHeight` below the toolbar
  plus the floor (about 181px by default) shrinks the viewport instead of
  pushing it, or a bottom toolbar, out through the control container's clip.
  The floor moves to `.mlv-editor__content`, inside the scroller, divided by
  the zoom so that zooming a short capped editor does not resize it. A
  `minHeight` above what the cap leaves the content (`maxHeight` minus the
  toolbar band and the 1rem viewport padding, so about 69px under the cap for
  a top bar) therefore scrolls an empty document; the surface never exceeds
  the cap. For a fixed-size editor set `height`, not `minHeight` equal to
  `maxHeight`. Uncapped, the viewport keeps the floor as before.

## Who is affected

- **Everyone who renders `<mlv-editor>` without `height` / `maxHeight`.** The
  layout is the same, because an uncapped editor already grew with its
  content. What changes: scrolling over it now scrolls the page, zoom above
  100% rewraps the text instead of adding scrollbars, and the zoom animation
  is gone.
- CSS that caps `.mlv-editor__viewport` itself (`max-block-size`, `height`):
  the viewport no longer scrolls, and content past the cap is clipped by the
  control container. None exists in this repository.
- CSS that sets `--mlv-editor-height` or `--mlv-editor-max-height` and expects
  a scroller: those properties do nothing without the matching input, because
  only the inputs set `.mlv-editor--capped`.
- Selectors written against `.mlv-editor__surface > .mlv-editor__toolbar`
  (the band sits between them) or against the viewport's `overflow` /
  `overscroll-behavior`.
- Consumers of the opt-in `MlvEditorZoom` `fitToContainer` in an uncapped
  editor.

## Who is not affected

- Serialization, selection, history, the model, forms integration, i18n keys,
  tokens in `libs/styles/tokens.md`, and every exported TypeScript symbol.
- `MlvEditorToolbar`, the standalone shell a consumer places itself. It keeps
  measuring its own root.
- Print output: the print rules reset zoom and remove the cap, as they reset
  the transform before.
- Wide tables (`.tableWrapper`) keep their own horizontal scroll.
- `floating.backdrop()` in `@malva-ui/cdk/floating-container` gains a
  `$direction` parameter. Its default, `180deg`, compiles byte-identical CSS
  for both existing consumers. The mixin is SCSS source, which does not ship.

## What consumers change

- An editor that must scroll inside a fixed box: set `height` (fixed) or
  `maxHeight` (grow up to a cap). A number is px, and a string is any CSS
  length. Writing `--mlv-editor-height` / `--mlv-editor-max-height` in CSS
  alone does nothing.
- Retarget `.mlv-editor__surface > .mlv-editor__toolbar` selectors to
  `.mlv-editor__toolbar`.
- If zoom must magnify with scrollbars (the old look), cap the editor with
  `height` / `maxHeight`.
- Custom toolbar controls taller than 36px in a floating toolbar: override
  `--mlv-editor-toolbar-block-size` on the editor.
- A sticky toolbar under a fixed app header: set
  `--mlv-editor-toolbar-sticky-offset` on any ancestor, for example `:root`.
  Also check that no ancestor between the editor and the scroller is
  `overflow: hidden` or `auto`. Use `clip` instead: `hidden` is a scroll
  container, and sticky pins against it rather than the page.
- A compact capped editor, such as a comment box with `maxHeight` 120: also set
  a smaller `minHeight`. The default `8rem` floor stays on the content inside
  the scroller, so an empty document would scroll.

## Known limitations

- **Caret margin at every scroll ancestor.** The Focus Not Obscured margin
  (WCAG 2.2 SC 2.4.11) is one ProseMirror `scrollMargin`, and ProseMirror
  applies it at every scroll ancestor. A capped editor with a sticky toolbar
  keeps the caret `offset + band` px from its own viewport edge. A capped
  editor with a floating toolbar keeps it about one band height (44–52px) from
  the page edge on the toolbar's side whenever the page has to scroll to
  reveal it, although the band covers only the viewport. Both err toward
  visibility, and nothing is hidden.
- **Corner clipping needs Safari 16.** Older Safari drops `overflow: clip` and
  computes `visible`, so content is not clipped to the control container's
  rounded corners. There is deliberately no `overflow: hidden` fallback: it
  would make the container a scroll container again and capture sticky.
