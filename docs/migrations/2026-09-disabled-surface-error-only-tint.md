# 2026-09 — Disabled is a declared surface; only error tints (#366)

- **Visual change, not breaking — patch.** No exported symbol, selector,
  `exportAs`, input, output, token, BEM class or i18n key added, renamed or
  removed; no markup, ARIA, focus or event change. Every change is a component
  reading different **existing** `--mlv-*` tokens (VERSIONING.md § 3 row 119,
  "visual change within an existing token", and § 3 _Not covered by the
  matrix_, "visual output at unchanged tokens"). Pixels move for every disabled
  control, and for `success` / `warning` / `info` validation states, in light,
  dark and high contrast — review visual baselines.
- Two rules of the 2026-08 visual harmonization, applied everywhere they were
  still missed (audit slices H-09, FC-13, LN-21, FC-18):
  - **SF-R4** — disabled paints `--mlv-background-disabled` +
    `--mlv-text-disabled`, the `mlvButton` treatment. Never `opacity`: a multiply
    composites over whatever sits behind the control (a tone fill lets the row
    bleed through), follows no theme, and **stacks** — a disabled segmented
    group drew its labels at 0.4 × 0.4 = 16 % alpha, a disabled radio group
    dimmed each disabled radio a second time.
  - **SF-R6** — `--state-error` is the only validation state that paints a
    control. `success` / `warning` / `info` carry their meaning in
    `mlv-message`; the control declares nothing for them.
- Guarded by the new `yarn nx run styles:check-disabled-surface`
  (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency like
  `check-padding-tokens`, spec `scripts/check-disabled-surface.spec.mjs` in
  `styles:test`). Rule text: `.claude/rules/bem-scss.md` § _Disabled is a
  declared surface_.

## 1. What changes, per control (`@malva-ui/core`, `@malva-ui/editor`)

| Control                                       | Before                                                        | After                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `mlv-checkbox`                                | host `opacity: 0.4`                                           | box `--mlv-background-disabled` + `--mlv-border-normal` (checked too), glyph + label `--mlv-text-disabled`                                    |
| `mlv-switch`                                  | host literal `opacity: 0.5`                                   | track `--mlv-background-disabled`, thumb `--mlv-text-disabled` (no shadow), label `--mlv-text-disabled`                                       |
| `mlv-radio`, `mlv-radio-group`                | radio 0.4 **and** group `__content` 0.4; success/warning/info | one surface (a disabled group reaches its radios through `.mlv-radio-group--disabled .mlv-radio`); only error tints                           |
| `mlv-rating`                                  | success/warning/info tints                                    | filled stars `--mlv-text-disabled` when disabled; only error tints                                                                            |
| `mlv-slider`                                  | `opacity: var(--mlv-disabled-opacity, 0.56)`                  | fill + thumbs `--mlv-text-disabled`, thumbs flat, `cursor: not-allowed`                                                                       |
| `mlv-form-control-wrapper` (every text field) | `--mlv-background-sunken`, value at full ink (16.4:1)         | `--mlv-background-disabled`, value / placeholder / side / action content `--mlv-text-disabled`                                                |
| `mlv-number-input`, `mlv-combobox`            | stepper / arrow opacity                                       | stepper glyph `--mlv-text-disabled`; combobox arrow keeps its ink (like `mlv-select`)                                                         |
| `mlv-date-range-picker`                       | host opacity; success/warning/info trigger tints              | the trigger field's surface; only error tints                                                                                                 |
| `mlv-color-picker`, `mlv-color-picker-popup`  | whole picker / popup at 0.4                                   | labels + format tabs `--mlv-text-disabled`; colour data (plane, strips, swatch) keeps `var(--mlv-disabled-opacity)` (allow-listed)            |
| `mlv-token` (in `mlv-tokenizer`)              | muted chip × 0.4                                              | chip `--mlv-background-disabled` + `--mlv-text-disabled`                                                                                      |
| `mlv-file-upload`                             | host 0.4 (projected actions included)                         | zone surface + ink; cover image keeps the token opacity; **projected actions no longer dimmed** (§ 3)                                         |
| `mlv-smart-filter-bar`                        | bar 0.4 over already-disabled controls                        | no bar opacity — each control declares its own surface                                                                                        |
| `mlv-accordion-item`                          | item 0.4 (open content included)                              | header + chevron `--mlv-text-disabled`; open content undimmed                                                                                 |
| `mlv-list-item`                               | row 0.4, selection fill kept                                  | transparent row, `--mlv-text-disabled` ink and accent bar; beats selection                                                                    |
| `mlv-tab-item`, `mlv-bottom-nav` item         | literal 0.5 / token opacity                                   | `--mlv-text-disabled`, after `--active`                                                                                                       |
| `mlv-segmented`                               | track 0.4 × item 0.4                                          | track `--mlv-background-disabled`, neutral flat pill (`--mlv-elevation-bg-4`), labels `--mlv-text-disabled`                                   |
| `a[mlvLink]`, `mlv-copy-to-clipboard`         | token opacity                                                 | `--mlv-text-disabled` ink                                                                                                                     |
| `mlv-calendar`                                | disabled day 0.4 on top of the disabled button; picker 0.45   | the disabled `mlvButton` surface alone; picker buttons `--mlv-text-disabled`                                                                  |
| `mlv-swipe-actions` block action              | 0.4 over the tone fill                                        | `--mlv-background-disabled` fill (rest / hover / press) + `--mlv-text-disabled`                                                               |
| `mlv-editor`                                  | host 0.4; toolbar 0.4 again                                   | wrapper / surface / toolbar `--mlv-background-disabled`, theme text in the content `--mlv-text-disabled` (authored colours are content, kept) |
| `mlv-icon-toggle`, `mlv-expand`               | token opacity                                                 | unchanged — chromeless / headless, no surface to declare (allow-listed)                                                                       |

## 2. Contrast, before → after

Opacity composited over `--mlv-background-base`; after read straight from the
tokens. HC dark resolves to the HC values.

| Pair                                | Light        | Dark         | High contrast |
| ----------------------------------- | ------------ | ------------ | ------------- |
| Checkbox glyph on checked box       | 1.71 → 3.76  | 2.34 → 3.44  | 2.59 → 3.72   |
| Checkbox / radio / switch label     | 2.53 → 4.54  | 3.82 → 3.78  | 2.85 → 5.74   |
| Switch thumb on track (on)          | 1.98 → 3.76  | 2.69 → 3.44  | 3.44 → 3.72   |
| Switch thumb on track (off)         | 1.04 → 3.76  | 4.71 → 3.44  | 1.10 → 3.72   |
| Segmented idle label on track       | 1.27 → 3.76  | 1.46 → 3.44  | 1.36 → 3.72   |
| Segmented selected label on pill    | 1.40 → 4.74  | 1.57 → 2.19  | 1.45 → 5.74   |
| Swipe action label on fill (danger) | 1.95 → 3.76  | 1.80 → 3.44  | 2.20 → 3.72   |
| Accordion disabled header           | 1.67 → 4.54  | 1.62 → 3.78  | 1.78 → 5.74   |
| Input value on field                | 16.44 → 3.76 | 19.80 → 3.44 | 17.14 → 3.72  |
| Checkbox box / switch track vs page | 1.68 → 1.21  | 1.63 → 1.10  | 2.59 → 1.54   |

- Ink pairs rise to the `mlvButton` disabled pair everywhere except the dark
  selected segmented label (2.19: `#737373` on the `#404040` pill) — up from
  1.57, still low; disabled UI is exempt from WCAG 1.4.3 / 1.4.11.
- Surfaces vs page drop to the button's disabled surface (1.21 / 1.10 / 1.54):
  a disabled control reads as one flat surface, like a disabled button. The
  disabled field value is now dimmed where it used to read exactly like an
  enabled one.

## 3. Consumer actions

- **Visual baselines**: every disabled control above, and any
  `state="success" | "warning" | "info"` on `mlv-radio-group`, `mlv-rating`
  and `mlv-date-range-picker`, renders differently. Nothing to change in code.
- **Specs reading `opacity`** on a disabled host (`getComputedStyle(el).opacity`
  `'0.4'` / `'0.5'`) now read `'1'` — assert the modifier class, or the colour.
- **CSS that undid the dim** (`.mlv-checkbox--disabled { opacity: 1 }`) is now
  a no-op; restyle through `--mlv-background-disabled` / `--mlv-text-disabled`
  on a `[mlvTheme]` scope, or the component's own custom properties.
- **`mlv-file-upload` actions**: projected `[mlvFileUploadAction]` controls
  are no longer dimmed by the host. Bind `[disabled]` on them (the host never
  wrote it — `pointer-events: none` on the host still blocks the pointer).
- **Success / warning / info styling on those three controls** — if the tint
  was the only signal, render an `mlv-message` (the field's own `message`).

## 4. Unchanged

- Every input, `aria-disabled` / native `disabled`, focusability and
  `pointer-events`; `mlvButton` (the reference); `mlv-tree` (already SF-R4);
  `--state-error` visuals; every token value.
- Known gaps, filed separately: `mlv-page-shell`'s chrome remap
  (`.mlv-page-shell__topbar:not([mlvTheme]) .mlv-form-control-wrapper`)
  outranks the field's disabled surface in a topbar / sidebar (the ink remap
  still applies); the dark selected segmented label; field labels stay at
  primary ink while the control is disabled.
