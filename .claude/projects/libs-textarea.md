---
# Library: textarea

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/textarea` provides a multi-line text input form control (`mlv-textarea`). It extends `MlvSignalFormControlBase<string>` (from `@malva-ui/core/form-utils`) and is a signal-forms `FormValueControl<string>` — reactive (`[formControl]`/`formControlName`), template-driven (`ngModel`), and signal (`[formField]`) bindings all bind the `value` model directly (migrated 2026-07-22, slice 2 of docs/plans/signal-forms-migration.md). It supports optional auto-resize behaviour (textarea grows with content), a character counter with warning/error states, and a custom `mlv-scrollbar` overlay for a consistent cross-browser scrollbar appearance. The scrollbar **decorates** the `<textarea>` (`[scroller]`) rather than wrapping it — see [Visible scrollbar track](#visible-scrollbar-track-2026-09-issue-90).

The component wraps the native `<textarea>` inside `mlv-form-control-wrapper`, giving it the same label/hint/message/clear infrastructure as `mlv-input`.

---

## Public API

| Export        | Kind      | Description                            |
| ------------- | --------- | -------------------------------------- |
| `MlvTextarea` | Component | Multi-line text input — `mlv-textarea` |

---

## Components

### `MlvTextarea`

**File:** `libs/core/textarea/src/lib/textarea/textarea.ts`
**Selector:** `mlv-textarea`
**Change Detection:** `OnPush`
**Encapsulation:** `ViewEncapsulation.None`
**Extends:** `MlvSignalFormControlBase<string>` (signal-forms `FormValueControl<string>`)
**Implements:** `MlvFormControl`

#### Providers

| Token              | Value         |
| ------------------ | ------------- |
| `MLV_FORM_CONTROL` | `MlvTextarea` |

> `NG_VALUE_ACCESSOR` is intentionally **not** provided — a signal-forms `FormValueControl` must not also implement `ControlValueAccessor`. Angular's reactive/ngModel compat binds the `value` model directly.

#### Host Bindings

| Binding                             | Value                                                 |
| ----------------------------------- | ----------------------------------------------------- |
| `class`                             | `'mlv-textarea'` (static)                             |
| `[class]`                           | State modifier classes derived from `resolvedState()` |
| `[class.mlv-textarea--disabled]`    | `computedDisabled()`                                  |
| `[class.mlv-textarea--focused]`     | `focused()`                                           |
| `[class.mlv-textarea--auto-resize]` | `autoResize()`                                        |

#### Inputs (own)

| Name          | Type                     | Default     | Description                                                                                |
| ------------- | ------------------------ | ----------- | ------------------------------------------------------------------------------------------ |
| `placeholder` | `string`                 | `''`        | Placeholder text shown when the textarea is empty.                                         |
| `rows`        | `number`                 | `3`         | Number of visible text rows; sets the default height.                                      |
| `minRows`     | `number \| undefined`    | `undefined` | Minimum row count when `autoResize` is active.                                             |
| `maxRows`     | `number \| undefined`    | `undefined` | Maximum row count when `autoResize` is active.                                             |
| `autoResize`  | `BooleanInput → boolean` | `false`     | When true, the textarea grows vertically to fit its content. Respects `minRows`/`maxRows`. |
| `maxLength`   | `number \| undefined`    | `undefined` | Maximum number of characters allowed. When set, a character counter is displayed.          |

#### Model

| Name    | Type                  | Default | Description                                                                                                                                                                                 |
| ------- | --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` | `ModelSignal<string>` | `''`    | The `FormValueControl` value model — replaces the former `internalValue` signal + CVA transport. Bound directly by `[formControl]`/`ngModel`/`[formField]`. Two-way bindable (`[(value)]`). |

#### Inputs (inherited from `MlvSignalFormControlBase<string>`)

| Name          | Type                         | Default                | Description                                                                                                                                                      |
| ------------- | ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`       | `MlvFormState`               | `'default'`            | Explicit visual state: `'default'` \| `'success'` \| `'info'` \| `'warning'` \| `'error'`. A non-default value takes precedence over automatic validation state. |
| `readonly`    | `boolean`                    | `false`                | Makes the textarea read-only. Also a signal-forms field binding (`[formField]` sets it).                                                                         |
| `disabled`    | `boolean`                    | `false`                | Disables the control. Signal-forms field binding — the bound field's disabled state drives it.                                                                   |
| `loading`     | `BooleanInput → boolean`     | `false`                | Shows a loading indicator (handled by form wrapper).                                                                                                             |
| `clearable`   | `BooleanInput → boolean`     | `false`                | Shows a clear (×) button that calls `clearValue()`.                                                                                                              |
| `errors`      | `readonly ValidationError[]` | `[]`                   | Signal-forms field binding — current validation errors of the bound field.                                                                                       |
| `touched`     | `boolean`                    | `false`                | Signal-forms field binding — whether the bound field is touched.                                                                                                 |
| `dirty`       | `boolean`                    | `false`                | Signal-forms field binding — whether the bound field is dirty.                                                                                                   |
| `id`          | `string`                     | auto (`mlv-control-N`) | ID applied to the native `<textarea>` element.                                                                                                                   |
| `label`       | `string`                     | `''`                   | Label text rendered in `mlv-label`.                                                                                                                              |
| `hint`        | `string`                     | `''`                   | Hint text rendered inside `mlv-hint` (nested in label).                                                                                                          |
| `description` | `string`                     | `''`                   | Persistent help text rendered in `mlv-description` below the control, in front of `message`. Referenced by `aria-describedby`.                                   |
| `message`     | `string`                     | `''`                   | Validation message rendered in `mlv-message`.                                                                                                                    |
| `required`    | `boolean` (coerced)          | `false`                | Renders the required marker in `mlv-label` and sets `aria-required` on the native `<textarea>`. Also a signal-forms field binding.                               |
| `ariaLabel`   | `string \| null`             | `null`                 | `aria-label` on the native `<textarea>` — use when no visible `mlv-label` is rendered.                                                                           |
| `pill`        | `boolean` (coerced)          | `false`                | Fully rounded (stadium) control container. Shared by every control extending the signal base.                                                                    |

> `maxLength` (`number | undefined`) doubles as the signal-forms `FormUiControl.maxLength` constraint member — its read/write type already matches the contract (`InputSignal<number | undefined>`), so no widening was needed (unlike `mlv-input`).

#### Outputs

| Name          | Type             | Description                                                                                                                                                                   |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `touch`       | `output<void>`   | Inherited from the base — emitted on blur (via `_markTouched`), the signal-forms replacement for CVA `onTouched`. `[formField]` subscribes and marks the bound field touched. |
| `valueChange` | `output<string>` | The `value` model's change output.                                                                                                                                            |

#### Signals & Computed Properties

| Name               | Kind              | Description                                                                                                         |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `focused`          | `signal(boolean)` | Whether the textarea currently has focus.                                                                           |
| `charCount`        | `computed`        | Current character count (`(value() ?? '').length`).                                                                 |
| `isCountWarning`   | `computed`        | `true` when char count is ≥ 90 % of `maxLength`.                                                                    |
| `isCountError`     | `computed`        | `true` when char count has reached `maxLength`.                                                                     |
| `hasValue`         | `computed`        | `(value() ?? '').length > 0` — drives the wrapper's clear-button visibility.                                        |
| `minHeightStyle`   | `computed`        | CSS string for `min-height` of the scrollbar wrapper (derived from `rows`/`minRows`).                               |
| `maxHeightStyle`   | `computed`        | CSS string for `max-height` of the scrollbar wrapper (derived from `maxRows`), or `undefined`.                      |
| `computedDisabled` | `computed`        | `disabled()` — effective disabled state (no CVA `setDisabledState` side channel in the signal base).                |
| `resolvedState`    | `computed`        | Explicit non-default `state()`; otherwise `'error'` when the bound field has errors and is touched, or `'default'`. |

#### View Children

| Name            | Type                                                       | Description                                                                                 |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `_textareaRef`  | `viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl')` | Reference to the native `<textarea>` element, used by `_runAutoResize()`.                   |
| `_scrollbarRef` | `viewChild(MlvScrollbar)`                                  | The scrollbar decorating the field; `remeasure()` is called on it whenever `value` changes. |

#### Content Slots

| Selector               | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `[mlvTextareaPrepend]` | Arbitrary content projected before the form wrapper. |
| `[mlvTextareaAppend]`  | Arbitrary content projected after the form wrapper.  |

#### Public Methods

| Method       | Signature                  | Description                                                                                |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `onInput`    | `(event: Event): void`     | Handles the native `input` event; sets the `value` model (propagates to the bound field).  |
| `onBlur`     | `(): void`                 | Clears focused state and emits `touch` (via `_markTouched`).                               |
| `clearValue` | `(): void`                 | Resets the `value` model to `''` and marks the field touched (`_markTouched`).             |
| `setFocused` | `(focused: boolean): void` | Inherited from the base; updates the focus signal that drives the wrapper's focused state. |

#### Template Summary

1. Optional `[mlvTextareaPrepend]` slot.
2. `mlv-form-control-wrapper` (clearable, state, focused, disabled wired via inherited signals):
   - `mlv-label` (rendered when `label()` or `hint()` is set), with optional nested `mlv-hint`.
   - `mlv-scrollbar` whose `min-height`/`max-height` are bound inline and whose `[scroller]` points at the `<textarea>` below it, so the field stays the scroll box and the scrollbar contributes only the overlay tracks. It is **never** `disabled` and carries no `ariaLabel` / `viewportTabIndex` — in `[scroller]` mode the component emits no `tabindex`, `role` or `aria-label` of its own, and the field owns its semantics.
   - Native `<textarea #textareaEl>` with `aria-invalid`, `aria-label`, `aria-required`, `aria-describedby` (`_textareaDescribedBy()` — the base's description/message ids plus the counter id, `null` when none apply), and standard form bindings.
   - `mlv-description` (shown when `description()` is non-empty), carrying `_descriptionId()`.
   - `mlv-message` (shown when `message()` is non-empty), carrying `_messageId()`.
   - Character counter `<div mlvFormControlWrapperAside>` (shown when `maxLength` is set) with `aria-live="polite"` and `--warning` / `--error` class modifiers. **The `mlvFormControlWrapperAside` marker is required** — before 2026-08 the counter was a plain child of `mlv-form-control-wrapper`, matched no projection slot, and never reached the DOM (leaving `aria-describedby` pointing at a missing id).
3. Optional `[mlvTextareaAppend]` slot.

#### SCSS

BEM block: `.mlv-textarea`

| Class                           | Description                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `.mlv-textarea`                 | Block root                                                                                               |
| `.mlv-textarea__scrollbar`      | `mlv-scrollbar` decorating the field; `flex: 1 1 auto`                                                   |
| `.mlv-textarea__field`          | Native `<textarea>` — the scroll box; no border/outline; native bar hidden in favour of the themed track |
| `.mlv-textarea__count`          | Character counter; `text-align: right`; `--mlv-typography-ui-s`                                          |
| `.mlv-textarea__count--warning` | Color: `--mlv-text-warning`                                                                              |
| `.mlv-textarea__count--error`   | Color: `--mlv-text-negative`                                                                             |
| `.mlv-textarea--auto-resize`    | Applied when `autoResize()` is true; allows free height growth                                           |
| `.mlv-textarea--disabled`       | Applied when `computedDisabled()` is true                                                                |
| `.mlv-textarea--focused`        | Applied when `focused()` is true                                                                         |
| `.mlv-textarea--{state}`        | Applied for `resolvedState()` (e.g., `--error`, `--success`)                                             |

Key style decisions:

- Overrides `.mlv-form-control-wrapper__control-container` to `height: auto` so the textarea can grow.
- The clear button is repositioned with `margin-top`/`margin-inline-end` to align with the first text row.
- `.mlv-textarea__field` keeps `overflow: auto` + `scrollbar-width: none` + `-ms-overflow-style: none` + `::-webkit-scrollbar { display: none }`. That is only truthful because the field is decorated by `[scroller]`; removing the binding without also removing these declarations is what left the control with **no** visible scrollbar (issue #90).
- The overlay tracks' containing block is `.mlv-textarea__scrollbar` itself — `.mlv-scrollbar` is already `position: relative`, so nothing extra is declared here, and nothing may clip it either.

---

## Interfaces & Types

`MlvTextarea` relies on types from `@malva-ui/core/form-utils`:

| Type           | Values                                                     | Description             |
| -------------- | ---------------------------------------------------------- | ----------------------- |
| `MlvFormState` | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` | Visual validation state |

---

## Usage Examples

### Basic textarea with label

```html
<mlv-textarea label="Description" placeholder="Enter a description…" />
```

### Reactive form with validation message

```typescript
// component.ts
readonly descCtrl = new FormControl('', Validators.required);
```

```html
<mlv-textarea label="Description" hint="Maximum 500 characters" [maxLength]="500" [formControl]="descCtrl" [message]="descCtrl.invalid && descCtrl.touched ? 'Description is required' : ''" [state]="descCtrl.invalid && descCtrl.touched ? 'error' : 'default'" />
```

### Auto-resize with row constraints

```html
<mlv-textarea label="Notes" autoResize [minRows]="2" [maxRows]="8" placeholder="Type your notes…" />
```

### Clearable textarea in a reactive form

```html
<mlv-textarea label="Bio" clearable [rows]="5" [formControl]="bioCtrl" />
```

### Read-only textarea

```html
<mlv-textarea label="Summary" readonly [value]="summary()" />
```

### With prepend and append content slots

```html
<mlv-textarea label="Message">
  <div mlvTextareaPrepend>Prefix content</div>
  <div mlvTextareaAppend>Append content</div>
</mlv-textarea>
```

---

## Dependencies

### Angular / third-party

| Package                 | Usage                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@angular/core`         | `Component`, `model`, `computed`, `effect`, `viewChild`, `input`, `ViewEncapsulation`, `ChangeDetectionStrategy` |
| `@angular/cdk/coercion` | `BooleanInput`, `coerceBooleanProperty`                                                                          |

### Internal (`@malva-ui/*`)

| Package                     | Exports used                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@malva-ui/core/form-utils` | `MlvSignalFormControlBase`, `MlvFormControlWrapper`, `MlvFormControlWrapperControl`, `MlvLabel`, `MlvHint`, `MlvMessage`, `MLV_FORM_CONTROL`, `MlvFormControl` |
| `@malva-ui/core/scrollbar`  | `MlvScrollbar`                                                                                                                                                 |
| `@malva-ui/styles`          | CSS custom properties (`--mlv-*` tokens), `mixins.base()`                                                                                                      |

---

## Signal-forms cutover (2026-07-22, slice 2)

- **Base swap:** `FormControlBase<string>` → `MlvSignalFormControlBase<string>`; dropped `implements ControlValueAccessor` and the `NG_VALUE_ACCESSOR` provider (kept `MLV_FORM_CONTROL`). A control may not implement both CVA and `FormValueControl`.
- **`value = model<string>('')`** replaces the former `internalValue` signal + CVA plumbing (`writeValue` removed; there is no `onChange`/`registerOn*`/`setDisabledState`). `charCount`/`isCountWarning`/`isCountError`/`hasValue` and the auto-resize effect all read `value()`; template renders `[value]="value() ?? ''"` defensively.
- **Touch:** blur emits the base `touch` output via `_markTouched()` (was CVA `onTouched`). `clearValue()` now does `value.set('')` + `_markTouched()` (preserves the old clear-marks-touched behaviour).
- **No constraint collisions:** the only `FormUiControl` same-named input is `maxLength` (`number | undefined`), whose type already matches the contract — no widening needed.
- **Matrix spec:** `textarea-binding-matrix.spec.ts` runs `verifyFormsBinding` green in all three modes (`[formControl]`, `ngModel`, `[formField]`). Existing `textarea.spec.ts` updated off removed CVA APIs (`internalValue` → `value`, `writeValue` → `value.set`, added `touch`-output + `clearValue` assertions).

---

## Auto-resize measurement (2026-09, issue #9)

`_runAutoResize()` runs from a `value` effect. The height it applies is unchanged
— it is always the true content height clamped to the row window — but how it is
obtained is not.

- **SSR:** the effect ran on the server too and called `getComputedStyle` there,
  throwing on every server render. Angular routes an `effect` exception to the
  `ErrorHandler` and keeps rendering, so the markup was always fine and the error
  silent. Now guarded by `isPlatformBrowser` (`_isBrowser`). Covered by
  `libs/core/src/ssr-smoke.spec.ts`, which asserts an **empty `ErrorHandler`
  collection** — the markup assertions alone never caught it.
- **One computed style read per resize, on every path.** `lineHeight` /
  `paddingTop` / `paddingBottom` came from three separate `getComputedStyle(el)`
  calls; they now come off one declaration in `_readMetrics()`. This was never
  "3 style recalculations": no write separates the three reads, so the first
  flushed style and the other two were served from it — 1 recalculation, 3
  property reads.
- **The `height: auto` reset is skipped on a safe append.** The reset exists for
  _shrinking_ — with an explicit height applied `scrollHeight` saturates at it.
  The fast path is taken only when the new value extends the old one **and**
  contains no joining-script character **and** the content-box width, the
  resolved font metrics and `minRows`/`maxRows` are all unchanged. Then an
  unchanged height writes nothing, and growth writes once (and not at all when
  the clamp maps it back to the height already applied — at the `maxRows`
  ceiling `scrollHeight` runs ahead forever, so without that check the branch
  would rewrite the same value on every keystroke). Every other edit takes the
  reset path, where the single write precedes _all_ reads so one recalculation
  serves them.
- **The font metrics are compared, not cached.** `heightPx` is a number derived
  from the line height and padding, so reusing it is trusting them. `clientWidth`
  cannot notice them moving: the field is `width: 100%; box-sizing: border-box`,
  so it reports the _container_ width and does not budge on a font-size or
  padding change. The fast path therefore re-reads the metrics and compares them
  against `AutoResizeState.metrics`, bailing to the reset path on any mismatch.
  Without this a `MlvDensityService` flip on `--form-ctrl-font-size`, a theme
  swap, a root font-size change or a web font finishing load would leave the
  height latched at the old value — silently violating `minRows`, with the
  overflow scrolling behind `scrollbar-width: none`.
- **Joining scripts bypass the fast path entirely.** The append premise ("text
  added at the end never moves where the earlier lines break") is false for
  cursive scripts: appending a joining letter switches the _preceding_ letter to
  a narrower medial form, which can pull a line back. Measured in Chrome 145 at
  220px, `'wwwww ' + 'ب'×26` occupies two lines and appending one `'ه'` returns
  it to one. `JOINING_SCRIPT_PATTERN` is content-based, not keyed off
  `direction`, because Arabic-script text appears in `dir="ltr"` fields too. It
  covers Arabic and its supplements, Syriac, Thaana, N'Ko, Mongolian, Adlam,
  Mandaic, Hanifi Rohingya, Manichaean, Psalter Pahlavi, Sogdian, Chorasmian and
  Old Uyghur. Over-matching is harmless — it only routes a resize down the
  always-correct reset path.
- **A measurement taken while the element is not laid out is used but never
  stored** (`clientWidth === 0`). Only a **detached** element resolves empty
  longhands and drives the `|| 24` / `|| 0` fallbacks; a `display: none` element
  still in the document resolves real values in Chrome. This store guard is now
  belt-and-braces: the fast path's width comparison already refuses such a state,
  since reusing it would require the current width to be 0 as well.

### Known cosmetic deviation

`lineHeightPx` is the unitless `1.5` resolved against the font size, so the
clamp it produces is routinely fractional while `scrollHeight` is an integer.
At the `maxRows` ceiling the integer can round just past the clamp, firing the
grow branch once and writing e.g. `93px` where the previous implementation wrote
`92.8px`. It is self-limiting — the next measurement re-derives from the clamp,
not from the rounded value — and invisible at one device pixel.

### Measurements

Chrome 145, one keystroke per animation frame, `minRows=2` / `maxRows=8`,
counting `UpdateLayoutTree` and `Layout` trace events over 150 keystrokes:

| Workload                                                               | HEAD      | After     | Change |
| ---------------------------------------------------------------------- | --------- | --------- | ------ |
| A — 150 monotone appends (the fast path's best case)                   | 299 / 299 | 152 / 152 | −49%   |
| B — 150 mixed edits (70% append, 18% backspace, 12% mid-string splice) | 299 / 299 | 197 / 197 | −34%   |

HEAD costs ~2 of each per keystroke: one forced synchronously by the
`scrollHeight` read after `height: auto`, one at frame time from the trailing
write. Workload B is lower-bounded by its deletions and splices, which still run
the reset path in full — the win is confined to appends.

The metrics re-read added for the invalidation fix costs nothing measurable: the
fast path reads `clientWidth` / `scrollHeight` _before_ `getComputedStyle`, and
forcing layout settles style on the way, so the style read is served from the
same clean pass.

Equivalence is checked two ways. In real Chrome, 400 appends and 800 mixed edits
produced byte-identical heights to the previous implementation. In the spec,
`textarea.spec.ts` runs five seeded 120-step fuzzes (appends, truncations,
mid-string splices, joining-script insertions, width changes, font-metric
changes and clamp changes) asserting after **every** step that the applied height
equals the reference — the true content height clamped to the row window, which
is exactly what the previous implementation computed. Dropping the font-metrics
comparison fails 3 of the 5 seeds; the joining-script defect is not reachable by
the fuzz (jsdom does not shape text) and is covered by dedicated tests using the
measured Chrome string.

`field-sizing: content` was evaluated and rejected as the primary path: it only
became Baseline "newly available" in June 2026 (Firefox 152), so the JS path has
to stay for a large installed base, and duplicating the `minRows`/`maxRows`
semantics in CSS would create two clamping implementations that can disagree. It
remains a reasonable later enhancement behind `@supports`.

---

## Visible scrollbar track (2026-09, issue #90)

The control shipped with **no visible scrollbar in any configuration**: content
scrolled (wheel, caret keys) with neither a custom track nor a native bar.

**Cause.** `mlv-scrollbar` _wrapped_ the `<textarea>`, and the field suppressed
its own native bar under the comment "mlv-scrollbar provides the custom one".
That premise never held. A `<textarea>` is itself an `overflow: auto` box sized
by `rows` (or by the auto-resize clamp), so it absorbs its overflow internally
and the viewport wrapping it never overflows. Measured in Chrome on `main`, 40
lines in a `rows`-sized demo: field `scrollHeight`/`clientHeight` 848/92 —
scrolls; viewport 107/107 — does not. Both tracks `--hidden`, 0px box. The
`[disabled]="autoResize()"` binding was a red herring: the track could not
appear in either mode.

**Fix — decorate, don't wrap.** The field stays the scroller and
`[scroller]="textareaEl"` points the scrollbar at it. Same shape as Taiga UI's
`TuiTextareaContent`, which renders a sibling `tui-scroll-controls` aimed at the
textarea; here it is a signal input rather than a DI-token override, because the
target is a template reference variable in the same template.

Consequences:

- `[disabled]="$any(autoResize())"` is gone — the track now works in both modes.
  Not a visible behaviour change: it never rendered in either.
- The `&.mlv-scrollbar--disabled { overflow: visible; }` rule in `textarea.scss`
  became dead and was removed. The equivalent is now the scrollbar's own
  `mlv-scrollbar--external` modifier, which is unconditional here.
- The `ariaLabel="Text area content"` on the wrapper is gone. In `[scroller]`
  mode `mlv-scrollbar` emits no `tabindex`, `role` or `aria-label` on its
  viewport at all — a second named, tabbable region around a labelled form
  control is an a11y regression, not an addition.
- The misleading `scrollbar-width: none` comment was rewritten; the three
  declarations stay, and are now true.

**The stale-track trap.** `MlvScrollbar`'s `ResizeObserver` cannot see a
textarea's content grow: the element's border box does not change when a line of
text is added, and it has no child to observe. Typing moves `scrollHeight` with
no `scroll` event and no observer callback. `MlvTextarea` therefore calls the
scrollbar's new public `remeasure()` from an `afterRenderEffect` on `value`.

`afterRenderEffect`, not a plain `effect`: a component `effect` runs _before_
the template's update pass writes `[value]` into the DOM, so a
programmatically-set value would be measured against the previous text — the
shape of issue #78. It also never runs on the server, so no DOM read escapes a
browser guard. (The jsdom spec cannot discriminate the two hooks — it stubs
`scrollHeight` — so this rests on ordering, not on an assertion.)

Every _height_ change is still covered by the observer: `rows`, the inline
height `_runAutoResize()` writes, and container resizes all resize something it
watches.

Cost: one forced layout + one style recalculation per keystroke (`remeasure()`
drops the track-metric cache), on an element whose layout the keystroke already
invalidated. In `autoResize` mode `_runAutoResize()` already forces one.

**Regression coverage.** `textarea-scrollbar.spec.ts` asserts on **rendered**
state — the vertical track losing `mlv-scrollbar__track--hidden` and the thumb's
inline geometry becoming non-zero — because every unit test on the measurement
path passed while the affordance was missing. It types (sets the element's value
and fires `input`) with stubbed metrics, covers `autoResize` true and false and a
programmatic `value` set, and dispatches its scroll events at the `<textarea>`;
a negative case dispatches at the `mlv-scrollbar` host and asserts nothing
happens, since `scroll` does not bubble and a host-aimed dispatch would pass
vacuously (that is what hid issue #73).
