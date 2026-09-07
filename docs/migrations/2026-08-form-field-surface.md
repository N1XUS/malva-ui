# 2026-08 — shared field surface: `required`, `description`, `ariaLabel`

Three inputs moved onto `MlvSignalFormUiControlBase`, so every control that extends it
(`mlv-input`, `mlv-textarea`, `mlv-number-input`, `mlv-select`, `mlv-combobox`,
`mlv-tokenizer`, `mlv-day-picker`, `mlv-date-range-picker`, `mlv-time-picker`,
`mlv-pin-input`, `mlv-rating`, `mlv-slider`, `mlv-color-picker-popup`, `mlv-radio-group`,
`mlv-checkbox`, `mlv-switch`, `mlv-file-upload`, `mlv-title`, `mlv-editor`) inherits them.

No consumer-facing input was renamed or removed. The breaking changes are limited to
internal id helpers and duplicate declarations described below.

## Added

| Input         | Type                                | Default | Effect                                                                                                                                                                                                                                                        |
| ------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `required`    | `boolean` (`coerceBooleanProperty`) | `false` | Renders the `*` marker plus a visually hidden translated "required" word in `mlv-label`, and sets `aria-required` on the element that actually receives focus. Also a signal-forms field binding: a `required()` schema rule drives it through `[formField]`. |
| `description` | `string`                            | `''`    | Persistent help text rendered **below** the control as `<mlv-description>`, in front of the validation `message`. Both stay visible together, and both are referenced from the control's `aria-describedby`.                                                  |
| `ariaLabel`   | `string \| null`                    | `null`  | Accessible name for the focus target. Previously declared per control, so `[ariaLabel]` was inert on the controls that lacked it (`mlv-textarea`, `mlv-number-input`, …).                                                                                     |

New public API in `@malva-ui/core/form-utils`:

- `MlvDescription` (`mlv-description`) — the help-text component.
- `MlvLabel.required` — the marker, usable standalone (`<mlv-label required>`).
- `MlvFormControlWrapper` projects `mlv-description` and `[mlvFormControlWrapperAside]`
  next to the existing `mlv-message` slot.

New in `@malva-ui/core/input`:

- `MlvInput.ariaDescribedBy` (`string | null`) — an explicit `aria-describedby` override
  used by composite controls that render their own description/message chrome.

## Breaking

1. **Per-control `messageId` helpers removed.** `mlv-input`, `mlv-textarea`,
   `mlv-tokenizer`, `mlv-number-input`, `mlv-day-picker`, `mlv-date-range-picker` and
   `mlv-time-picker` each exposed a public `messageId` (a plain string on some, a
   `computed` on others). They now use the base's protected `_messageId()`. Two of the
   plain-string variants were also wrong: they captured the auto-generated id at field
   initialisation, so a consumer-supplied `[id]` produced a dangling `aria-describedby`.
   `MlvTextarea.countId` changed from a `string` field to a `Signal<string>` for the same
   reason. Nothing in the workspace referenced these outside the components themselves.

2. **Duplicate `ariaLabel` declarations removed** from `MlvInput`, `MlvSelect`,
   `MlvCheckbox`, `MlvSwitch`, `MlvTimePicker`, `MlvColorPickerPopup` and `MlvEditor`.
   The inherited input replaces them. Where a control declared `string | undefined`, the
   type is now `string | null`; the default changes from `undefined` to `null` and both
   render no attribute, so behaviour is unchanged.

3. **`mlv-radio-group` now renders its `message`.** The input existed on the base and was
   silently ignored; setting it now produces a visible status line below the radios.

4. **`mlv-checkbox` / `mlv-switch` now render their `label` input** as visible text (see
   the section below).

## `label` on checkbox and switch

Both controls inherited `label` from the base but never rendered it, so
`<mlv-switch label="Enable alerts" />` produced an unlabelled toggle with no accessible
name at all. `label` now renders inside the wrapping `<label>`. Projected content still
wins: the fallback stays in the DOM but is `display: none`-d by
`.mlv-checkbox__content:not(:empty) + .mlv-checkbox__label-text`, which also keeps it out
of the accessible name. A dev-mode `console.warn` fires when a control ends up with no
projected text, no `label`, and no `ariaLabel`/`ariaLabelledBy`.

**Action required:** if you set both `label` and projected content expecting the label to
be ignored, nothing changes. If you set `label` expecting it to act as an `aria-label`,
switch to `ariaLabel` — `label` is now visible text.

## `mlv-textarea` character counter

The counter was a plain child of `mlv-form-control-wrapper`, matched none of the wrapper's
projection slots, and was dropped from the DOM — while `aria-describedby` still pointed at
its id. It now uses the wrapper's `[mlvFormControlWrapperAside]` slot and the textarea
composes `aria-describedby` from the ids that actually render.

## `mlv-form-field` unmapped validator keys

`autoErrorMessage` no longer falls back to the literal `Validation error: <key>`. Unknown
validator keys resolve to the translated `formUtils.invalidValue` ("This value is
invalid"), and a dev-mode `console.warn` names the missing key once per application run so
the author can supply one through `[errorMessages]`.

## Controls with no ARIA effect

`required` is only emitted where ARIA allows it. It has no ARIA effect on:

- `mlv-rating` and `mlv-file-upload` — their focus targets are `<button>`s, and
  `aria-required` is not allowed on `role="button"`.
- `mlv-slider` — `aria-required` is not allowed on `role="slider"`.

`description` has no effect on `mlv-title` and `mlv-color-picker` (the panel body), which
render no below-control chrome. Wrap them in `mlv-form-field` when a field description is
needed.

## New i18n keys

`formUtils.required`, `formUtils.invalidValue`, and — for the newly translated file-upload
rejection messages — `fileUpload.errorSingleFile`, `fileUpload.errorFileType` (`{name}`),
`fileUpload.errorFileSize` (`{name}`, `{size}`). All fourteen shipped language packs carry
them.
