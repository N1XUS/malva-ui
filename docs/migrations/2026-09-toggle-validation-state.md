# 2026-09 — toggles show their validation state, and controls reference the field's error

Applies to `@malva-ui/core/form-utils` (`MlvFormField`,
`MlvSignalFormUiControlBase`), `@malva-ui/core/checkbox` (`MlvCheckbox`),
`@malva-ui/core/switch` (`MlvSwitch`), `@malva-ui/core/radio`
(`MlvRadioGroup`), `@malva-ui/core/rating` (`MlvRating`) and
`@malva-ui/core/slider` (`MlvSlider`). Fixes #320 (audit C026, findings FC-08
and FC-09, owner decision D21).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
model, injection token or i18n key was renamed, removed or retyped. Additive
surface: an **optional** `errorMessageId?` on `MlvFormFieldAccessor` (optional
because a required member on an exported token's value is its own major,
`VERSIONING.md` § 3 row 104), a public `MlvFormField.errorMessageId` signal,
the BEM elements `.mlv-{checkbox,switch,slider}__description` /
`__message` and the `mlv-slider--state-<state>` / `mlv-slider--has-text` host
modifiers (row 114).

The major is row 112 — _"Changed **default behaviour** at an unchanged API —
… ARIA, what a value means"_: `aria-invalid` and a new `aria-describedby` token
appear on controls whose markup did not change, and `state="error"` on a
switch, checkbox or slider now paints and announces something. The checkbox and
switch half of `description` / `message` rendering is row 117 on its own —
their docs always said both rendered — but it ships in the same commit. On the
`0.x` line the `!` releases as `0.2.0` (§ 7).

---

## 1. FC-08 — the toggles rendered no validation state

Every control extending `MlvSignalFormUiControlBase` computes
`resolvedState()` — an explicit non-default `state` wins, otherwise a touched
field with errors is `error`. The text controls consumed it; the toggles did
not:

| Control           | Visual before                                    | `aria-invalid` before | `description` / `message` before |
| ----------------- | ------------------------------------------------ | --------------------- | -------------------------------- |
| `mlv-checkbox`    | swatch class from `state()`, **no rule** for any | none                  | accepted, **not rendered**       |
| `mlv-switch`      | track class from `state()`, **no rule** for any  | none                  | accepted, **not rendered**       |
| `mlv-slider`      | nothing                                          | none                  | accepted, **not rendered**       |
| `mlv-radio-group` | unchanged by this ticket (FC-18 is its own)      | none                  | rendered, referenced             |
| `mlv-rating`      | unchanged by this ticket (FC-18 is its own)      | none                  | not rendered (unchanged)         |

So a touched, invalid `required()` checkbox under `[formField]` looked and
announced exactly like a valid one. After:

| Control           | Visual (only `error` paints — SF-R6)                                            | `aria-invalid="true"` on         | `description` / `message`                |
| ----------------- | ------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------- |
| `mlv-checkbox`    | `.mlv-checkbox__visual--error`: swatch border `--mlv-border-error`              | the native input                 | rendered after the `<label>`, referenced |
| `mlv-switch`      | `.mlv-switch__track--error`: inset `--mlv-stroke-width-medium` ring, same token | the native `role="switch"` input | rendered after the `<label>`, referenced |
| `mlv-slider`      | `.mlv-slider--state-error .mlv-slider__track`: unfilled rail in the same token  | **every** `role="slider"` thumb  | rendered under the track, referenced     |
| `mlv-radio-group` | —                                                                               | the `role="radiogroup"` host     | as before                                |
| `mlv-rating`      | —                                                                               | the `role="group"` host          | still not rendered (follow-up)           |

- The checkbox swatch and switch track now read `resolvedState()`, not
  `state()`. `success` / `warning` / `info` still emit their class and still
  have **no rule**: their meaning lives in `mlv-message`, not in the control.
- `aria-invalid` is `true` or **absent** — never `"false"`. It follows the
  control's own `resolvedState()`, so an explicit `state="error"` sets it and
  `state="success"` over an invalid field clears it, as the visual does.
- The rendered description and message sit **outside** the `<label>`, so
  neither joins the accessible name, and are indented to the label text (logical
  padding, mirrors in RTL; measured 0px offset at every density, Chromium and
  WebKit).

## 2. FC-09 — nothing referenced the field's error message

`mlv-form-field` renders its auto error as `<mlv-message state="error">` —
`role="alert"`, announced once when it appears. It had **no id**, so no control
could point at it: returning to the control later announced no error at all
(WCAG 1.3.1 / 3.3.1). Now:

```html
<!-- before: a touched, empty required email field -->
<input id="mlv-control-7" aria-invalid="true" />
<mlv-message role="alert">Required</mlv-message>

<!-- after -->
<input id="mlv-control-7" aria-invalid="true" aria-describedby="mlv-form-field-3-error" />
<mlv-message id="mlv-form-field-3-error" role="alert">Required</mlv-message>
```

- `MlvFormField.errorMessageId` is the id while the message renders and `null`
  otherwise, so no dangling IDREF is ever emitted.
- `_describedBy()` (base class) is now **own description → own message →
  field error**, space-separated. Every control that binds it picks the token up
  with no template change: `mlv-input`, `mlv-textarea` (before its counter),
  `mlv-number-input`, `mlv-select`, `mlv-combobox`, `mlv-tokenizer`,
  `mlv-pin-input`, the three date / time pickers, `mlv-segmented`,
  `mlv-color-picker-popup`, `mlv-radio-group`, and now `mlv-checkbox`,
  `mlv-switch`, `mlv-slider`. `mlv-rating` binds the field error id alone.
- The id is unique per field (`mlvNextId('mlv-form-field')`), so two fields on
  one page never share it.

## 3. Who is affected, and what to do

**(a) `state` used as a status colour.** `[state]="online ? 'success' : 'error'"`
— the switch documentation's own old usage example — now rings an "off" switch
red and tells a screen reader it is **invalid**.
**Do:** keep `state` for validation. Show status in the label text, a
`mlv-status-indicator` or a `mlv-badge`.

**(b) A spec that asserts a control's exact `aria-describedby` inside a field
while its error shows.** The value gains the field's error id at the end.
**Do:** assert on tokens (`attr.split(' ')`) or include
`field.errorMessageId()` in the expected value. Snapshots that recorded
generated ids move too: `mlvNextId()` keeps one counter for every prefix and
each field now takes one id, so every auto id created after a field
(`mlv-control-N`, …) is one higher. The ids are not public, stay stable per
instance and still match between server and client — **do:** re-record, or
select by role / name rather than id.

**(c) A spec that asserts `aria-invalid` is absent on an invalid toggle, or
reads the `mlv-checkbox__visual--*` / `mlv-switch__track--*` class for the raw
`state` input.** Both now follow `resolvedState()`.
**Do:** assert the resolved state; set an explicit `state` when the test is
about the input.

**(d) A consumer who rendered their own help or error text beside a checkbox,
switch or slider _and_ set its `description` / `message` input.** The input was
inert before; both now render.
**Do:** delete one — prefer the input, which is also wired into
`aria-describedby`.

**(e) `mlv-input` with an explicit `ariaDescribedBy`.** It still replaces the
whole value (`ariaDescribedBy() ?? _describedBy()`), so the field's error is
**not** added — a consumer who writes the attribute owns it.
**Do:** append the field's id yourself: `viewChild(MlvFormField)` →
`errorMessageId()`.

**(f) CSS that restyles the slider host's layout.** `mlv-slider` is now a
one-column grid, no longer a flex row: the track owns row 1 and the thumbs and
tooltips are positioned against that grid area. Overriding the host's `display`
detaches the thumbs once a description or message renders (with no text, a
`display: flex` override measures identical to before; `flex-direction` does
nothing on a grid).
**Do:** size the host (`width`, `height`, `min-height`) and leave `display`
alone. With no text rendered, host size, track size and thumb position are
identical to before at any `--mlv-slider-thumb-size` — the thumb-tall row
minimum applies only under `mlv-slider--has-text` — except that a vertical
compact slider's thumbs now sit on the rail (measured, § 5).

**(g) A touch pan that starts on a slider's help text or message.** The host
keeps `touch-action: none` so a drag anywhere on the 2.75rem control moves the
thumb instead of scrolling; the effective value intersects down the tree, so
the new text rows inherit it and a vertical swipe that starts on them does not
scroll the page (from the CSS spec, not measured on a device). The text itself
selects and shows a text cursor, and a press on it moves no thumb.
**Do:** nothing is needed for short help text. Where a long description must
scroll the page under a finger, render it outside the slider, as your own
text next to the field.

**(h) A custom `MlvFormFieldAccessor` provided under `MLV_FORM_FIELD`.**
Nothing to do — `errorMessageId` is optional. Implement it to have controls
reference your error element.

Nothing in `libs/` or `apps/docs` needed a markup change. The docs checkbox
states example (`/checkbox` example 2) sets `state="error"` on purpose and now
shows it.

## 4. Deliberately not changed

- **`hint`** is still not rendered by the toggles, and `mlv-rating` still
  renders no description or message.
- **`mlv-select`, `mlv-segmented` and the three date / time pickers** reference
  the field error but still emit no `aria-invalid` of their own.
- **A consumer `<mlv-message>`** projected into a field, or rendered outside
  one, is not associated — only the message the field renders itself is.
- **No identity check** on who takes the field's id: any base-class control
  whose injector reaches the field does, as with `labelId`. The checkboxes of a
  `mlv-checkbox-group` in a field each reference the field error, and so do
  inner `mlv-input`s a composite renders without forwarding `ariaDescribedBy`
  (`mlv-color-picker`'s HEX / RGB fields, `mlv-select`'s search field).
- **Group state visuals** (`mlv-checkbox-group` / `mlv-switch-group` `state`)
  and **FC-18** (radio / rating success, warning and info tints) are separate
  tickets.

## 5. Measured — the slider's layout change

Real Chromium and WebKit (Playwright), the slider's DOM rendered with `main`'s
stylesheet and with this one, 20rem wide, thumb at 40%, LTR and RTL. Each
no-text row holds for the default thumb (1.25rem) and for
`--mlv-slider-thumb-size: 2rem` / `1.75rem`:

| Case                              | Host size, `main` → now | Thumb cross-axis offset from track centre | Thumb position along track          |
| --------------------------------- | ----------------------- | ----------------------------------------- | ----------------------------------- |
| horizontal                        | 320×44 → 320×44         | 0 → 0                                     | 0.4 → 0.4                           |
| horizontal compact                | 320×32 → 320×32         | 0 → 0                                     | 0.4 → 0.4                           |
| vertical (12rem)                  | 320×192 → 320×192       | 0 → 0                                     | 0.4 → 0.4                           |
| vertical compact (12rem)          | 320×192 → 320×192       | 0 → 0                                     | **0.391 → 0.4** (thumb now on rail) |
| horizontal + description, message | — → 320×88 (2rem: 100)  | 0                                         | 0.4                                 |
| vertical + description, message   | — → 320×192             | 0 (track 192 → 138px, text below)         | 0.4                                 |

- **Vertical compact is the one no-text change, and it is a fix.** The
  density's `padding-block: 0.5rem` wins over the vertical `padding-block: 0`,
  so the rail is 176px in a 192px host. On `main` the thumbs resolved `bottom`
  against the host's padding box, 8px beyond each rail end, while the pointer
  maths reads the rail — a press and the thumb it moved disagreed by up to
  8px. The grid area now puts both on the rail.
- **With text** the thumb stays on the track and clears the first text row by
  `--mlv-spacing-1` at values 0, 40 and 100 (all 144 cases: both engines, both
  densities, default and 2rem thumb, one or two text rows). A vertical rail
  gives the text half a thumb of extra room at its bottom end, where a thumb at
  the minimum overhangs.
- **All four grid lines are load-bearing.** An absolutely positioned grid child
  resolves an `auto` end line to the padding edge, so the two-line
  `grid-area: 1 / 1` puts the thumb 10px off the track with no text, 17px with
  one text row and 28px with two (both engines). A compiled-CSS spec pins the
  four lines on the track, thumbs and tooltips.
