# 2026-09 — Disabled is a declared surface; only error tints (#366)

Applies to `@malva-ui/core` (checkbox, switch, radio, rating, slider,
form-utils and every text field built on it, number-input, combobox,
date-range-picker, color-picker, tokenizer, file-upload, filter, accordion,
list, tabs, bottom-nav, segmented, link, copy-to-clipboard, calendar,
swipe-actions, button) and `@malva-ui/editor`. Fixes #366 (audit slices H-09,
FC-13, LN-21, FC-18) and #568, and resolves #458 § 5.

- **Breaking, behaviour only.** No exported symbol, selector, `exportAs`,
  input, output, token, BEM class or i18n key renamed, removed or retyped;
  every `--mlv-*` token keeps its value. On the `0.x` line the `!` releases as
  `0.2.0` (VERSIONING.md § 7).
  - **SF-R6 half — row 112** (_"default behaviour at an unchanged API … what a
    value means"_), the mirror of #320: `state="success" | "warning" | "info"`
    on `mlv-radio-group`, `mlv-rating` and `mlv-date-range-picker` stops
    painting. Their docs described the tints (`libs-radio.md`: "an inline-start
    accent"; `libs-date-range-picker.md`: "State variants … success, warning"),
    so this takes documented rendering away. The `--state-*` classes are still
    stamped.
  - **SF-R4 half — visual at unchanged tokens** (VERSIONING.md § 3 _Not covered
    by the matrix_): every disabled control composes different existing tokens
    instead of an opacity multiply. No markup, ARIA or focus change.
  - **#568 — row 117** (restores documented behaviour): a disabled
    `mlv-file-upload` no longer removes files. Each row's remove button is
    natively disabled, and `removeFile()` is a no-op while disabled.
  - **Additive — row 115**: two optional inputs, `MlvButtonClose.disabled` and
    `MlvFileUploadItem.disabled` (both default `false`).
- Two rules of the 2026-08 visual harmonization, applied everywhere they were
  still missed:
  - **SF-R4** — disabled paints `--mlv-background-disabled` +
    `--mlv-text-disabled`, the `mlvButton` treatment. Never `opacity`: a
    multiply composites over whatever sits behind the control (a tone fill lets
    the row bleed through), follows no theme, and **stacks**. A disabled
    segmented group drew its labels at 0.4 × 0.4 = 16 % alpha, and a disabled
    radio group dimmed each disabled radio a second time.
  - **SF-R6** — `--state-error` is the only validation state that paints a
    control. `success` / `warning` / `info` carry their meaning in
    `mlv-message`; the control declares nothing for them.
- Guarded by the new `yarn nx run styles:check-disabled-surface`
  (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency like
  `check-padding-tokens`; spec `scripts/check-disabled-surface.spec.mjs` in
  `styles:test`). Rule text and the guard's blind spots:
  `.claude/rules/bem-scss.md` § _Disabled is a declared surface_.

## 1. What changes, per control

| Control                                       | Before                                                                                     | After                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mlv-checkbox`                                | host `opacity: 0.4`                                                                        | box `--mlv-background-disabled` + `--mlv-border-normal` (checked too), glyph + label `--mlv-text-disabled`                                                              |
| `mlv-switch`                                  | host literal `opacity: 0.5`                                                                | track `--mlv-background-disabled`, thumb `--mlv-text-disabled` (no shadow), label `--mlv-text-disabled`                                                                 |
| `mlv-radio`, `mlv-radio-group`                | radio 0.4 **and** group `__content` 0.4; success/warning/info inline-start accent + indent | one surface (a disabled group reaches its radios through `.mlv-radio-group--disabled .mlv-radio`); only error draws the accent                                          |
| `mlv-rating`                                  | success/warning/info empty-star tints                                                      | filled stars `--mlv-text-disabled` when disabled; only error tints                                                                                                      |
| `mlv-slider`                                  | `opacity: var(--mlv-disabled-opacity, 0.56)`                                               | fill + thumbs `--mlv-text-disabled`, thumbs flat, `cursor: not-allowed`                                                                                                 |
| `mlv-form-control-wrapper` (every text field) | `--mlv-background-sunken`, value at full ink (16.4:1), placeholder `--mlv-text-tertiary`   | `--mlv-background-disabled`; value, placeholder, side and action content `--mlv-text-disabled` (the box remaps `--mlv-text-{primary,secondary,tertiary}`)               |
| `mlv-number-input`, `mlv-combobox`            | stepper / arrow opacity                                                                    | stepper glyph `--mlv-text-disabled`; combobox arrow keeps its ink (like `mlv-select`)                                                                                   |
| `mlv-date-range-picker`                       | host opacity; success/warning/info trigger text tints                                      | the trigger field's surface; only error tints                                                                                                                           |
| `mlv-color-picker`, `mlv-color-picker-popup`  | whole picker / popup at 0.4                                                                | labels + format tabs `--mlv-text-disabled`; colour data (plane, strips, swatch) keeps `var(--mlv-disabled-opacity)` (allow-listed)                                      |
| `mlv-token` (in `mlv-tokenizer`)              | muted chip × 0.4                                                                           | chip `--mlv-background-disabled` + `--mlv-text-disabled`                                                                                                                |
| `mlv-file-upload`                             | host 0.4 (rows and projected actions included); remove buttons live to the keyboard        | zone surface + ink; rows `--mlv-text-disabled`; cover image, row thumbnails and projected actions keep the token opacity (allow-listed); remove buttons disabled (#568) |
| `mlv-smart-filter-bar`                        | bar 0.4 over already-disabled controls                                                     | no bar opacity — each control declares its own surface                                                                                                                  |
| `mlv-accordion-item`                          | item 0.4 (open content included)                                                           | header + chevron `--mlv-text-disabled`; open content undimmed                                                                                                           |
| `mlv-list-item`                               | row 0.4, selection fill kept                                                               | transparent row, `--mlv-text-disabled` ink and accent bar; beats selection                                                                                              |
| `mlv-tab-item`, `mlv-bottom-nav` item         | literal 0.5 / token opacity                                                                | `--mlv-text-disabled`, after `--active` (a boxed group's active tab included)                                                                                           |
| `mlv-segmented`                               | track 0.4 × item 0.4                                                                       | track `--mlv-background-disabled`, neutral flat pill (`--mlv-elevation-bg-4`), labels `--mlv-text-disabled`                                                             |
| `a[mlvLink]`, `mlv-copy-to-clipboard`         | token opacity                                                                              | `--mlv-text-disabled` ink                                                                                                                                               |
| `mlv-calendar`                                | disabled day 0.4 on top of the disabled button; picker 0.45                                | the disabled `mlvButton` surface alone; picker buttons `--mlv-text-disabled`                                                                                            |
| `mlv-swipe-actions` block action              | 0.4 over the tone fill                                                                     | `--mlv-background-disabled` fill (rest / hover / press) + `--mlv-text-disabled`                                                                                         |
| `mlv-editor`                                  | host 0.4; toolbar 0.4 again                                                                | wrapper / surface / toolbar `--mlv-background-disabled`, theme text in the content `--mlv-text-disabled` (authored colours are content, kept)                           |
| `mlv-icon-toggle`, `mlv-expand`               | token opacity                                                                              | unchanged — chromeless / headless, no surface to declare (allow-listed)                                                                                                 |

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
| Input placeholder on field          | 2.31 → 3.76  | 4.18 → 3.44  | 10.31 → 3.72  |
| Checkbox box / switch track vs page | 1.68 → 1.21  | 1.63 → 1.10  | 2.59 → 1.54   |

- Ink pairs rise to the `mlvButton` disabled pair everywhere except two:
  - the dark selected segmented label, 2.19 (`#737373` on the `#404040` pill) —
    up from 1.57, still low;
  - the placeholder in dark and high contrast, which drops to the value's ink.
    It used to be `--mlv-text-tertiary` on `--mlv-background-sunken`
    (`#737373` on `#0a0a0a` dark, `#333333` on `#e8e8e8` HC). A disabled field
    now draws its placeholder and its value alike.
- Disabled UI is exempt from WCAG 1.4.3 / 1.4.11.
- Surfaces vs page drop to the button's disabled surface (1.21 / 1.10 / 1.54):
  a disabled control reads as one flat surface, like a disabled button. The
  disabled field value is now dimmed where it used to read exactly like an
  enabled one.

## 3. Consumer actions

Each shape names what breaks and what to do.

- **`state="success" | "warning" | "info"` as a visible cue** on
  `mlv-radio-group`, `mlv-rating` or `mlv-date-range-picker` — the tint is
  gone.
  - **Do:** render the meaning in text: the control's own `message`, or a
    projected `mlv-message`. To keep a bespoke tint, write your own rule on the
    still-stamped `--state-*` class.
- **A non-error `mlv-radio-group` state moves the radios** — the accent came
  with a `border-inline-start` + `padding-inline-start: var(--mlv-spacing-3)`
  on `__content`, so the radios shift toward inline-start by `--mlv-spacing-3`
  plus the removed `--mlv-stroke-width` border.
  - **Do:** update visual baselines. If the indent mattered, pad your own
    wrapper.
- **Specs reading `opacity`** on a disabled host (`getComputedStyle(el).opacity`
  `'0.4'` / `'0.5'`) now read `'1'`.
  - **Do:** assert the `--disabled` modifier class or the colour.
- **CSS that undid the dim** (`.mlv-checkbox--disabled { opacity: 1 }`) is now
  a no-op.
  - **Do:** restyle through `--mlv-background-disabled` / `--mlv-text-disabled`
    on a `[mlvTheme]` scope, or through the component's own custom properties.
- **Removing files from a disabled `mlv-file-upload`** — the remove buttons are
  disabled and `removeFile()` returns without emitting `filesChange` (#568).
  In-repo, the editor's image upload dialog disables its upload while one is in
  flight, so its remove button is now disabled then too.
  - **Do:** to clear files while disabled, write `value` or the form model.
- **Visual baselines** — every disabled control in § 1 renders differently.
  - **Do:** re-baseline. Nothing to change in code.

### Projected content

The host multiply used to dim consumer content for free. Now each Malva part
declares its own disabled look, and content the consumer projects keeps its own
unless it is disabled too.

- **A `mlvLink` or other control in a disabled checkbox / radio / switch
  label** keeps action ink beside the grey label.
  - **Do:** bind `[disabled]` on the projected control, or render plain text
    while the toggle is disabled.
- **Controls projected into a disabled `mlv-list-item`** (`[mlvListItemActions]`,
  a switch or button in the row) keep their own surfaces. The row remaps
  `--mlv-text-primary` / `-secondary`, so projected text reading those tokens
  greys out; filled surfaces do not.
  - **Do:** bind the projected control's `disabled` from the same state.
- **`mlv-editor` toolbar slot content** (`[mlvEditorToolbarStart]` /
  `[mlvEditorToolbarEnd]`, a `[mlvEditorToolbar]` replacement) is no longer
  dimmed, while the built-in groups show their disabled buttons.
  - **Do:** bind each projected control's `disabled` to the editor's disabled
    state.
- **Content inside an open, disabled `mlv-accordion-item`** is no longer dimmed
  — only the header is disabled.
  - **Do:** disable the controls inside if they must not be used, or apply
    `opacity: var(--mlv-disabled-opacity)` to the content yourself.
- **`mlv-file-upload` projected `[mlvFileUploadAction]` controls** keep the
  token opacity (allow-listed, like `mlv-expand`), but the host still never
  writes `disabled` onto them; `pointer-events: none` blocks only the pointer.
  - **Do:** bind `[disabled]` on them so the keyboard is blocked too.

## 4. Unchanged

- Every input, `aria-disabled` / native `disabled`, focusability and
  `pointer-events` — except the file-upload remove buttons (#568, § 3): they
  are now natively disabled while the upload is, so one that holds focus when
  the upload turns disabled loses it to `<body>`, like every disabled button.
- `mlvButton` (the reference), `mlv-tree` (already SF-R4), `--state-error`
  visuals, every token value.
- Known gaps, filed separately:
  - `mlv-page-shell`'s chrome remap
    (`.mlv-page-shell__topbar:not([mlvTheme]) .mlv-form-control-wrapper`)
    outranks the field's disabled surface in a topbar / sidebar (the ink remap
    still applies);
  - the dark selected segmented label;
  - field labels stay at primary ink while the control is disabled;
  - `mlv-color-picker`'s format tabs stay operable while the picker is
    disabled.
