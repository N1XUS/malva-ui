---
# Library: radio

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Radio library (`@malva-ui/core/radio`) provides accessible radio button components following WAI-ARIA patterns. Includes individual radio buttons and a group component that manages selection state, keyboard navigation (arrow keys), and reactive forms integration.

> **Host `aria-label` / `aria-labelledby` forwarding** — a consumer writing
> `<mlv-radio aria-label="Select row" />` (e.g. a radio with no projected text)
> would otherwise leave the attribute on the role-less host element, which ARIA
> prohibits (axe `aria-prohibited-attr`). `MlvRadio` captures a **static**
> host `aria-label`/`aria-labelledby` via `HostAttributeToken` in its constructor,
> imperatively removes it from the host (`Renderer2.removeAttribute`), and forwards
> it onto the inner `<input type="radio">` — the real accessible-name target —
> through the `[attr.aria-label]` / `[attr.aria-labelledby]` template bindings
> (`_ariaLabel` / `_ariaLabelledBy` signals). When no host ARIA attribute is
> supplied the signals stay `null`, so no empty `aria-label` is emitted on the
> input and any group-provided labelling mechanism is left untouched. For
> **dynamic** labels use the `ariaLabel` / `ariaLabelledBy` **inputs** (they win
> over a captured static attribute via the
> `_resolvedAriaLabel`/`_resolvedAriaLabelledBy` computeds) — never bind
> `[attr.aria-label]` on the host, which Angular writes straight onto the host
> element where it cannot be intercepted. Same pattern as `mlv-checkbox` and
> `mlv-switch`.

## Public API

Exported from `libs/forms/radio/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvRadio` | Component | Radio button — `mlv-radio` |
| `MlvRadioGroup` | Component | Group container — `mlv-radio-group` |
| `MlvRadioGroupState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` |

---

## Components

### `MlvRadio`

**File:** `libs/forms/radio/src/lib/radio/radio.ts`
**Styles:** `libs/forms/radio/src/lib/radio/radio.scss`

- **Selector:** `mlv-radio`
- **Change Detection:** `OnPush`
- **Focus management:** `MlvRadioGroup` adapts radio instances to `FocusKeyManager` and uses `disabled()` as the skip predicate, preserving `[disabled]` as a signal input.

#### Inputs

| Name             | Type                  | Default     |
| ---------------- | --------------------- | ----------- |
| `value`          | `unknown`             | `undefined` |
| `ariaLabel`      | `string \| undefined` | `undefined` |
| `ariaLabelledBy` | `string \| undefined` | `undefined` |
| `disabled`       | `boolean`             | `false`     |

#### Internal Signals

- `checked: signal(false)` — managed by parent group
- `name: signal('')` — set by parent group

#### Host Bindings

```ts
host: {
  'class': 'mlv-radio',
  '[class.mlv-radio--checked]': 'checked()',
  '[class.mlv-radio--disabled]': 'disabled()',
}
```

The host is **not** focusable. The single focus target is the visually-hidden
native `<input type="radio">` (kept in the a11y tree via the clip-path pattern,
which restores native radio grouping and Space selection). The host is
`position: relative` so that absolutely positioned input is contained by the
radio — otherwise, in a drawer or dialog body, it lands in the scrollbar host
outside the scroll viewport and a click on the label scrolls the
`overflow: hidden` body to it. Its `tabindex` is the
roving tabindex (`tabIndex` signal) managed by `MlvRadioGroup`.

#### Key Methods

- `focus()` — CDK `FocusableOption`; focuses the native input (not the host)

#### Internal methods (`@internal`, template-facing)

- `onFocus()` — Notifies parent group
- `onSelect()` — Native selection (click, Space, arrow keys); calls `group.selectRadio(this)` if not disabled
- `_onNativeClick(event)` (`protected`) — cancels the native click while `group.canSelect()` is `false` (readonly or disabled group). A cancelled click on a radio makes the browser restore the previously checked radio and fire no `change` (HTML legacy-canceled-activation steps; verified in headless Chrome 153 for a pointer click, a label click and Space).
- `_restoreNativeChecked()` (`@internal`) — writes `checked()` back onto the native input; the group calls it on every radio when it refuses a selection.
- `_nativeDisabled` (`protected` computed) — `disabled() || group.computedDisabled()`, bound to the native `[disabled]`. A disabled group therefore takes every radio out of the tab order and makes Space inert; before #298 only CSS (`pointer-events: none`) blocked the mouse, and Tab / Space still reached and flipped the radios. The host `mlv-radio--disabled` class still follows the radio's own `disabled()` only, so the group's dimming is not compounded.

#### Keyboard & Focus

- **Single tab stop:** the native input carries the roving tabindex; the host is not tabbable.
- **Space** selects natively; **ArrowUp/ArrowLeft** and **ArrowDown/ArrowRight** move+select within the group (via `FocusKeyManager`, skipping disabled radios, wrapping).
- **`:focus-visible`** ring is promoted from the hidden input onto `.mlv-radio__visual` using `--mlv-border-focus`.

#### Template Summary

Visually-hidden (clip-path) native `<input #nativeInput type="radio" [attr.tabindex]="tabIndex()">` with `aria-checked` + visual circle indicator (`.mlv-radio__visual::before` for inner dot with CSS transition) + `<ng-content>` for label.

---

### `MlvRadioGroup`

**File:** `libs/forms/radio/src/lib/radio-group/radio-group.ts`

- **Selector:** `mlv-radio-group`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<unknown>` from `@malva-ui/core/form-utils`
- **Implements:** `FormValueControl<unknown>`, `MlvRadioGroupAccessor`
- **Provides:** `RADIO_GROUP`, `MLV_FORM_CONTROL` tokens

#### Model (two-way binding)

| Name    | Type      |
| ------- | --------- |
| `value` | `unknown` |

#### Inputs

| Name       | Type                                    | Default            | Description                                                                                                        |
| ---------- | --------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `name`     | `string`                                | auto-generated     | Group name for native radios                                                                                       |
| `disabled` | `boolean`                               | `false`            | _(inherited)_ Disable all radios; also settable via `FormControl.disable()` (merged into `computedDisabled()`)     |
| `readonly` | `boolean`                               | `false`            | _(inherited)_ Locks selection while keeping the group legible/focusable; reflected as `mlv-radio-group--readonly`  |
| `state`    | `MlvRadioGroupState` (`= MlvFormState`) | `'default'`        | _(inherited)_ Validation state; reflected as `mlv-radio-group--state-*` with an inline-start accent on the content |
| `label`    | `string`                                | `''`               | _(inherited)_ Group label (rendered via `mlv-label`)                                                               |
| `id`       | `string`                                | auto (`mlvNextId`) | _(inherited)_ Bound to the host `id` attribute                                                                     |

> `MlvRadioGroupState` remains exported as a public type alias for backwards compatibility; it is now defined as `MlvFormState` from `@malva-ui/core/form-utils`.

#### Keyboard Navigation

`FocusKeyManager` (vertical, wrapping) — Arrow Up/Down moves focus, skips disabled radios via `disabled()`, and auto-selects the focused radio.

`_onKeydown` answers **all four** arrows for WAI-ARIA radiogroup semantics (`ArrowUp`/`ArrowLeft` → previous, `ArrowDown`/`ArrowRight` → next), so the group **is** horizontal-sensitive despite the vertical key manager. The horizontal pair resolves its direction from the group's own host — a cached `elementDirection(host)` signal passed to `normalizeArrowKey(event, direction)` (#147) — so it mirrors inside a `[dir="rtl"]` subtree while the document stays LTR, and inside an overlay pane (CDK stamps `dir` on every one), not only on a document-wide flip. The vertical pair never mirrors.

#### Readonly / disabled (#298)

- `selectRadio(radio)` writes through `_write()`; a refusal puts **every** native input back to the group value via `_restoreNativeChecked()`. Before #298 the refusal left the DOM alone, but a native click had already checked the new radio and the `[checked]` bindings held an unchanged value, so Angular never re-wrote it — the page and the accessibility tree showed B while `aria-checked` and the value said A.
- Clicks are cancelled up front by each radio's `_onNativeClick` (via the internal `canSelect()`), so in a browser the DOM never moves; the restore is the backstop for a `change` that arrives anyway.
- `_onKeydown` still `preventDefault()`s every arrow (so native radio navigation cannot move the checked state).
  - **Readonly: arrows move focus, not selection.** ARIA 1.2 `aria-readonly`: authors SHOULD NOT restrict navigation. The key manager moves and focuses the next radio; `selectRadio` refuses the write, restores the natives and leaves focus where the manager put it.
  - **Disabled: returns before the key manager moves** (gated on `computedDisabled()`, not `_canWrite()`). The radios are natively disabled and cannot take focus, so moving the manager would drift its active item from the focused element.
- Readonly keeps the radios enabled and focusable; disabled disables every native radio (see `MlvRadio._nativeDisabled`).
- `aria-readonly="true"` on the `role="radiogroup"` host while readonly (the radiogroup role supports it; `radio` does not, so nothing goes on the inputs).
- Covered by `radio-group-readonly.spec.ts` — incl. readonly arrows moving focus (two steps, selection pinned on A, no key-manager drift) and disabled arrows moving neither. One jsdom gap is recorded there: jsdom's cancelled-click steps revert only the clicked radio and do not re-check the previous one, so the readonly click tests assert the value, `aria-checked`, `defaultPrevented` and the clicked radio, and the full DOM snapshot is asserted where no activation runs (disabled, stray `change`).

#### Tab Management

Only the checked radio (or first radio if none checked) has `tabIndex=0`. All others are `-1`.

> **Does not use `MlvFocusableGroupBase`** (deliberate). That base is _focus-driven_ roving, whereas radio's tab stop is _selection-driven_ and its arrows couple selection, radio names, and the forms value in the same effect. Adopting the focus-only base would change behavior, so radio keeps its own manager.

#### Template Summary

`div[role="radiogroup"][aria-label]` + optional `mlv-label` + `<ng-content>` + `(keydown)` handler.

#### ARIA

- `role="radiogroup"` on container
- `aria-readonly="true"` on the container while readonly
- `[attr.aria-checked]` on native inputs
- Only active radio is tabbable (`tabIndex=0`)

---

## Internal Token

```ts
export const RADIO_GROUP = new InjectionToken<MlvRadioGroupAccessor>('RADIO_GROUP');

interface MlvRadioGroupAccessor {
  selectRadio(radio: MlvRadio): void;
  onChildFocus(radio: MlvRadio): void;
  readonly computedDisabled: Signal<boolean>; // #298 — radios disable their native input with it
  canSelect(): boolean; // #298 — false while readonly or disabled; radios cancel their click
}
```

---

## Usage Examples

```html
<!-- Basic group -->
<mlv-radio-group [(value)]="selected">
  <mlv-radio [value]="'a'">Option A</mlv-radio>
  <mlv-radio [value]="'b'">Option B</mlv-radio>
</mlv-radio-group>

<!-- With label -->
<mlv-radio-group label="Choose size" [(value)]="size">
  <mlv-radio [value]="'s'">Small</mlv-radio>
  <mlv-radio [value]="'m'">Medium</mlv-radio>
  <mlv-radio [value]="'l'">Large</mlv-radio>
</mlv-radio-group>

<!-- Disabled radio -->
<mlv-radio-group [(value)]="val">
  <mlv-radio [value]="1">One</mlv-radio>
  <mlv-radio [value]="2" [disabled]="true">Two (disabled)</mlv-radio>
</mlv-radio-group>

<!-- Reactive forms -->
<mlv-radio-group formControlName="option">
  <mlv-radio [value]="'yes'">Yes</mlv-radio>
  <mlv-radio [value]="'no'">No</mlv-radio>
</mlv-radio-group>
```

---

## Dependencies

- `@angular/forms/signals` — `FormValueControl` contract
- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption`
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MLV_FORM_CONTROL`, `MlvFormState`, `MlvLabel`
- `@malva-ui/cdk/utils` — `mlvNextId` (group `name` default)

---

## Field surface (2026-08)

- `MlvRadioGroup` now renders `<mlv-description>` (from the inherited `description` input) and `<mlv-message>` (from the inherited `message` input) below the projected radios. **`message` was previously accepted but never rendered** — setting it now produces a visible status line.
- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the `role="radiogroup"` host.
- The host `aria-label` is now `ariaLabel() ?? label()`, and `aria-describedby` is the base's `_describedBy()`.

## Label type scale (2026-08-26)

`.mlv-radio` now carries the shared control-text ramp (CH-R3) via
`density.density-*` mixins, mirroring `mlv-checkbox` — `--mlv-font-size-s`
(tight) / `-m` (compact, comfortable) / `-l` (spacious) / `-xl` (airy). It
previously had no type ramp at all. `&__label`'s `gap` also moved from the
raw literal `0.25rem` to `var(--mlv-spacing-1)` (same value, tokenized). See
`.claude/projects/libs-form-utils.md` → _Control-text type & padding ramp_.

## Naming from a projected `<mlv-label>` (2026-09, #197)

`MlvRadioGroup` reports `_externalLabelStrategy()` **`'aria'`**: `id()` sits on
the `role="radiogroup"` host, and a group is never labelable, so an
`<mlv-label>` projected beside it into `mlv-form-field` names it through
`aria-labelledby` — the association WAI-ARIA prescribes for a radiogroup. The
host binds `[attr.aria-labelledby]="label() ? labelId() : _fieldLabelId()"` and
suppresses `aria-label` whenever either resolves, so a field-composed group no
longer needs its own `label` input repeated beside the projected label. `labelId`
is a new public computed, `` `${id()}-label` ``, rendered on the group's own
`<mlv-label>`.

The group's own `label` therefore wins over the field's — and over `ariaLabel`,
which previously took precedence (`ariaLabel() ?? label()`). That matches
`mlv-select` / `mlv-day-picker`, and it means the announced name is the visible
label text rather than a string that may differ from it.

Full contract, the `'native'` vs `'aria'` split and the dev-mode warning:
`.claude/projects/libs-form-utils.md` → _`MlvFormField` → Accessible name_.
