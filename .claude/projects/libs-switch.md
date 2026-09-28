---
# Library: switch

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Switch library (`@malva-ui/core/switch`) provides accessible toggle switch components implementing the WAI-ARIA switch pattern. Supports grouped switches with keyboard navigation, signal-forms integration, and the shared five-level density system (`tight` / `compact` / `comfortable` / `spacious` / `airy`) from `@malva-ui/cdk/density`.

> **Host `aria-label` / `aria-labelledby` forwarding** — a consumer writing
> `<mlv-switch aria-label="Enable feature" />` (a switch with no projected text)
> would otherwise leave the attribute on the role-less host element, which ARIA
> prohibits (axe `aria-prohibited-attr`). `MlvSwitch` captures a **static**
> host `aria-label`/`aria-labelledby` via `HostAttributeToken` in its constructor,
> imperatively removes it from the host (`Renderer2.removeAttribute`), and forwards
> it onto the inner `<input type="checkbox" role="switch">` — the real
> accessible-name target — through the `[attr.aria-label]` / `[attr.aria-labelledby]`
> template bindings (`_ariaLabel` / `_ariaLabelledBy` signals). When no host ARIA
> attribute is supplied the signals stay `null`, so no empty `aria-label` is emitted
> on the input. For **dynamic** labels use the `ariaLabel` / `ariaLabelledBy`
> **inputs** (they win over a captured static attribute via the
> `_resolvedAriaLabel`/`_resolvedAriaLabelledBy` computeds) — never bind
> `[attr.aria-label]` on the host, which Angular writes straight onto the host
> element where it cannot be intercepted. Same pattern as `mlv-checkbox` and
> `mlv-radio`.

## Public API

Exported from `libs/forms/switch/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvSwitch` | Component | Toggle switch — `mlv-switch` |
| `MlvSwitchState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` (alias of `MlvFormState`) |
| `MlvSwitchGroup` | Component | Group container — `mlv-switch-group` |
| `MlvSwitchGroupState` | Type | Same values as `MlvSwitchState` (alias of `MlvFormState`) |

---

## Components

### `MlvSwitch`

**File:** `libs/core/switch/src/lib/switch/switch.ts`
**Template:** `libs/core/switch/src/lib/switch/switch.html`
**Styles:** `libs/core/switch/src/lib/switch/switch.scss`

- **Selector:** `mlv-switch`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Extends:** `MlvSignalCheckboxControlBase` from `@malva-ui/core/form-utils` (signal forms — no `ControlValueAccessor`)
- **Focus management:** `MlvSwitchGroup` adapts switch instances to `FocusKeyManager` and uses `computedDisabled()` as the skip predicate, preserving `[disabled]` as a signal input.

#### Model (two-way binding)

| Name      | Type      | Default |
| --------- | --------- | ------- |
| `checked` | `boolean` | `false` |

#### Inputs

| Name             | Type                  | Default                     | Description                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mlvDensity`     | `MlvDensity`          | inherited / `'comfortable'` | Density override for this switch (via the `MlvDensityDirective` host directive). All five levels scale track size, thumb size, thumb travel, label gap and label typography. Falls back to the nearest ancestor `MLV_DENSITY_CONTEXT` (e.g. an enclosing `mlv-switch-group` or `form[mlvForm]`), then to `MlvDensityService` |
| `disabled`       | `boolean`             | `false`                     | Component-level disabled                                                                                                                                                                                                                                                                                                     |
| `state`          | `MlvSwitchState`      | `'default'`                 | Validation state. Only `error` paints (an inset ring on the track) and sets `aria-invalid`; an explicit non-default value wins over the bound field's. Not a status colour — see _Validation state (#320)_                                                                                                                   |
| `label`          | `string`              | `''`                        | **Visible** label text, rendered inside the `<label>` when nothing is projected into `<mlv-switch>`. Projected content always wins (CSS `display: none`-s the fallback), so the accessible name never duplicates. Inherited from the signal base                                                                             |
| `required`       | `boolean` (coerced)   | `false`                     | Sets `aria-required` on the native input; also a signal-forms field binding. Inherited from the signal base                                                                                                                                                                                                                  |
| `ariaLabel`      | `string \| null`      | `null`                      | Accessible name applied to the inner native input; wins over a captured static host `aria-label`. Inherited from the signal base since 2026-08 (was a switch-local input)                                                                                                                                                    |
| `ariaLabelledBy` | `string \| undefined` | `undefined`                 | Id reference(s) naming the inner native input; same precedence as `ariaLabel`                                                                                                                                                                                                                                                |

#### Inputs (inherited from `MlvSignalFormUiControlBase`)

| Name          | Type                                               | Default                    | Description                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readonly`    | `boolean`                                          | `false`                    | Read-only control; also a signal-forms field binding.                                                                                                                                                                                                                                                                 |
| `loading`     | `boolean`                                          | `false`                    | Shows the loading affordance.                                                                                                                                                                                                                                                                                         |
| `clearable`   | `boolean`                                          | `false`                    | Renders the clear affordance while the control has a value (On counts as one).                                                                                                                                                                                                                                        |
| `pill`        | `boolean`                                          | `false`                    | Fully rounded (stadium) control container.                                                                                                                                                                                                                                                                            |
| `errors`      | `readonly ValidationError.WithOptionalFieldTree[]` | `[]`                       | Signal-forms field binding: current validation errors.                                                                                                                                                                                                                                                                |
| `touched`     | `boolean`                                          | `false`                    | Signal-forms field binding: whether the bound field is touched.                                                                                                                                                                                                                                                       |
| `dirty`       | `boolean`                                          | `false`                    | Signal-forms field binding: whether the bound field is dirty.                                                                                                                                                                                                                                                         |
| `id`          | `string`                                           | `mlvNextId('mlv-control')` | HTML id of the native `role="switch"` input (the focus target); `<id>-description` and `<id>-message` follow it. The own wrapping `<label>` names the input by containment and carries no `for`. Static or bound, tracked on change; a static host `id` attribute is moved off the host — see _Consumer `id` (#323)_. |
| `hint`        | `string`                                           | `''`                       | Inherited but **not rendered** by the switch (follow-up to #320).                                                                                                                                                                                                                                                     |
| `description` | `string`                                           | `''`                       | Help text rendered under the label text as `.mlv-switch__description`, outside the `<label>`, and referenced from the native input’s `aria-describedby` (#320; before, not rendered).                                                                                                                                 |
| `message`     | `string`                                           | `''`                       | Validation / status message rendered after the description as `.mlv-switch__message` (state follows `resolvedState()`), outside the `<label>`, and referenced from `aria-describedby` (#320; before, not rendered).                                                                                                   |

#### Outputs

| Name            | Type      | Description                                                                                 |
| --------------- | --------- | ------------------------------------------------------------------------------------------- |
| `checkedChange` | `boolean` | The `checked` model's change output.                                                        |
| `touch`         | `void`    | Inherited. Emitted on blur — the signal-forms replacement for the CVA `onTouched` callback. |

#### Host Bindings

```ts
hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'switch' }, /* … */],
host: {
  'class': 'mlv-switch',
  '[class.mlv-switch--disabled]': 'computedDisabled()',
  '[class.mlv-switch--checked]': 'checked()',
}
```

`MlvDensityDirective` additionally stamps exactly one of
`mlv-switch--tight | --compact | --comfortable | --spacious | --airy` on the host
(from `MLV_DENSITY_ELEMENT: 'switch'`). Consumers set `mlvDensity`, never the class.

The host is **not** focusable. The single focus target is the visually-hidden
native `<input type="checkbox" role="switch">` (kept in the a11y tree via the
clip-path pattern). The host is `position: relative` so that absolutely
positioned input is contained by the switch: with no positioned ancestor of
its own it lands in the coordinate space of whatever the page provides —
in a drawer or dialog body the scrollbar host outside the scroll viewport —
and a click on the label then scrolls the `overflow: hidden` body to it.
Its `tabindex` is the roving tabindex managed by
`MlvSwitchGroup` (`tabIndex` signal: 0 for active, -1 for others).

#### Key Methods

- `focus()` — CDK `FocusableOption`; focuses the native input (not the host)
- `toggle()` — Application API: flips the checked state; no-op while disabled. **Not** gated by `readonly` — readonly locks out the user, not the application's own code (owner ruling, #298), same as writing `checked`. The keyboard path is `onEnter`, which is gated.
- `onInputChange(event)` — Reflects the native `change` event onto the `checked` model; a refused write puts `input.checked` back to `checked()`
- `setFocused(focused)` — Inherited from the signal base; updates the focus signal driving the wrapper state.

The control is a signal-forms field, not a `ControlValueAccessor` — there is no
`writeValue`/`setDisabledState` pair.

#### Internal methods (`@internal`, template-facing)

- `onEnter(event)` — Enter-key toggle (Space is handled natively by the input). A user write: goes through `_write()`, refused while readonly or disabled; always `preventDefault()`s.
- `onFocus()` — Notify parent group via `SWITCH_GROUP` token
- `onBlur()` — Emits the signal-forms `touch` output when focus leaves the input

#### Keyboard & Focus

- **Single tab stop:** the native input carries the roving tabindex; the host is not tabbable.
- **Space** toggles natively (fires `change`); **Enter** toggles via `onEnter`.
- **Readonly** (#298): a native checkbox ignores the `readonly` attribute, so the component enforces it. The native input's `(click)` is `preventDefault()`ed while `!_canWrite()` — the browser then restores `checked` and fires no `change`, covering a click on the track, a click on the label and Space (a synthetic click). `onEnter()` / `onInputChange()` write through `_write()`; a stray `change` is rolled back in the DOM. `toggle()` is the app API and stays disabled-only. Pinned by `switch-readonly.spec.ts` (Enter refused; programmatic `toggle()` still flips while readonly; `toggle()` no-op while disabled). The input stays focusable. `aria-readonly="true"` on the `role="switch"` input while readonly (the switch role inherits it from checkbox); no attribute otherwise.
- **`:focus-visible`** ring is promoted from the hidden input onto `.mlv-switch__track` using `--mlv-border-focus`.

#### Template Summary

`<label>` wrapping:

- Visually-hidden (clip-path) `<input #nativeInput type="checkbox" role="switch" [attr.tabindex]="tabIndex()" [attr.aria-checked] [attr.aria-required] [attr.aria-readonly] [attr.aria-invalid] [attr.aria-describedby] (click)="_onNativeClick($event)">`
- `.mlv-switch__track.mlv-switch__track--{resolvedState}` (visual track + thumb)
- `.mlv-switch__text`, holding `.mlv-switch__content` (`<ng-content>`) followed by the `.mlv-switch__label-text` fallback rendered from the `label` input

After the `<label>`: `<mlv-description class="mlv-switch__description">` and `<mlv-message class="mlv-switch__message">` when their inputs are set (#320).

A dev-mode `console.warn` fires once per instance when a switch has no projected text, no `label`, and no `ariaLabel`/`ariaLabelledBy` — i.e. no accessible name at all.

#### Styles

Track is a stadium (`--mlv-radius-full`) at every step; the thumb is a circle
inset by `--mlv-switch-thumb-inset` (`0.125rem`, constant). Colors:
`--mlv-background-neutral-1` (off) → `--mlv-background-accent-1` (on),
thumb `--mlv-elevation-bg-5` + `--mlv-shadow-1`, focus ring `--mlv-border-focus`
promoted from the hidden input onto `.mlv-switch__track`.

The thumb is a near-white knob in every theme: `--mlv-elevation-bg-5` is
`#ffffff` in light and high contrast (`--mlv-background-raised`) and
`--mlv-palette-neutral-50` (`#fafafa`) in dark. **2026-08-26:** the general
dark elevation ladder had put rung 5 at a lightened grey (`color-mix` toward
white off `--mlv-palette-neutral-700`, ≈`#707070`) — muddy against the
off-track (≈`#262626`) and ≈1.07:1 against the accent-1 on-track — so
`switch.scss` shadowed the token under `[mlvTheme='dark'] .mlv-switch`.
**#454** moved that value into the dark theme scope in `theme.scss` and
deleted the switch rule (the switch is rung 5's only consumer, so no other
surface moves): a descendant rule reached light islands inside a dark page
(`#fafafa` where `#ffffff` belongs), kept the dark value under high contrast
on a dark `<html>`, and missed a switch that carries `mlvTheme` itself. Pure
light and dark resolve exactly as before. `switch.scss` declares no theme
selector and no `--mlv-elevation-bg-5`; every arrangement is pinned in
`libs/styles/src/lib/theme-scopes.spec.mjs`, and
`theme-attribute-selectors.spec.mjs` fails on any theme-attribute rule.

##### Density geometry ladder

Every level satisfies `thumb = track-height − 2 × inset` and
`travel = track-width − thumb − 2 × inset`, so the thumb never clips the track.
`comfortable` reproduces the pre-density rendering exactly.

| Level         | Track (w × h)       | Thumb      | Travel     | Label gap           | Label type                                         |
| ------------- | ------------------- | ---------- | ---------- | ------------------- | -------------------------------------------------- |
| `tight`       | `2rem × 1.125rem`   | `0.875rem` | `0.875rem` | `--mlv-spacing-1`   | `body-s` / `--mlv-line-height-tight`               |
| `compact`     | `2.25rem × 1.25rem` | `1rem`     | `1rem`     | `--mlv-spacing-1-5` | `body-m` / `--mlv-line-height-normal`              |
| `comfortable` | `2.5rem × 1.5rem`   | `1.25rem`  | `1rem`     | `--mlv-spacing-2`   | `body-m` / `--mlv-line-height-normal`              |
| `spacious`    | `3rem × 1.75rem`    | `1.5rem`   | `1.25rem`  | `--mlv-spacing-2-5` | `body-l` / `--mlv-line-height-normal`              |
| `airy`        | `3.5rem × 2rem`     | `1.75rem`  | `1.5rem`   | `--mlv-spacing-3`   | `--mlv-font-size-xl` / `--mlv-line-height-relaxed` |

The values live in component-scoped custom properties on `.mlv-switch`
(`--mlv-switch-track-width`, `--mlv-switch-track-height`, `--mlv-switch-thumb-size`,
`--mlv-switch-thumb-inset`, `--mlv-switch-thumb-travel`, `--mlv-switch-gap`,
`--mlv-switch-font-size`, `--mlv-switch-line-height`), redeclared inside the five
`density.density-*` mixin blocks.

**2026-08-26:** `compact` and `airy` previously read `body-s` / `body-l` —
one step below the shared control-text ramp (CH-R3), which put a switch
label at a different size than an input's text at those two densities.
Retuned to `body-m` (compact) and the primitive `--mlv-font-size-xl` (airy —
there is no `--mlv-typography-body-xl-size` alias) to match
`--form-ctrl-font-size`'s ramp in `mlv-form-control-wrapper`. `tight` /
`comfortable` / `spacious` were already correct. See
`.claude/projects/libs-form-utils.md` → _Control-text type & padding ramp_.

##### Accessibility floor

The pointer target is the wrapping `<label>`, not the track. `.mlv-switch__label`
carries an unconditional `min-block-size: 1.5rem; min-inline-size: 1.5rem`, so the
hit area never falls below **24 × 24 CSS px** (WCAG 2.2 SC 2.5.8, level AA) even
at `tight` / `compact`, where the _visible_ track is only 18px / 20px tall.
Label text uses `--mlv-text-primary` at every step, so contrast stays AA including
at the 12px `body-s` used by `tight` and `compact`.

---

### `MlvSwitchGroup`

**File:** `libs/core/switch/src/lib/switch-group/switch-group.ts`

- **Selector:** `mlv-switch-group`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Extends:** `MlvFocusableGroupBase<MlvSwitch>` from `@malva-ui/core/form-utils` — the shared roving-tabindex `FocusKeyManager` lifecycle lives in the base; the group only supplies `_items` (projected switches) + `_isDisabled` (`computedDisabled()`).
- **Implements:** `MlvSwitchGroupAccessor` (`onChildFocus` inherited from the base)

#### Inputs

| Name         | Type                  | Default                     | Description                                                                                                                                                                      |
| ------------ | --------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | `string`              | `''`                        | Accessible name + visible group label.                                                                                                                                           |
| `state`      | `MlvSwitchGroupState` | `'default'`                 | Visual/validation state applied to the group.                                                                                                                                    |
| `mlvDensity` | `MlvDensity`          | inherited / `'comfortable'` | Density for the group **and** every projected switch — see _Density projection_ below. Scales the group's inter-switch gap and is provided as `MLV_DENSITY_CONTEXT` to children. |

#### Methods (inherited from `MlvFocusableGroupBase`)

| Method                            | Description                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `onChildFocus(child)`             | Marks the focused child active in the `FocusKeyManager` (roving tabindex).       |
| `onKeydown(event: KeyboardEvent)` | Forwards ArrowUp/ArrowDown to the `FocusKeyManager`, skipping disabled children. |

#### Keyboard Navigation

`FocusKeyManager` (from `MlvFocusableGroupBase`) — arrow up/down navigates between switches, skips disabled via `computedDisabled()`. Initial tab stop on the first **enabled** switch; the base then keeps the roving `tabindex=0` on the **focused** switch. Bug fix: this sync was previously missing, so Tab-out/Tab-in returned focus to the wrong switch — now ported from checkbox-group and covered by `switch-group.spec.ts`.

- **Tab stop (#307):** never a disabled switch, which cannot take focus (a disabled first switch used to leave the group with no tab stop at all). The focused switch turning disabled hands the stop to the next enabled one after it (wrapping), not the first; adding/removing a switch keeps the user's stop and arrow position. Contract: `libs-form-utils.md` § _Focusable group base_. Covered by `switch-group.spec.ts` § _roving tab stop with disabled switches (#307)_, incl. the next-after-focused handoff and an axe sweep of the disabled-first state.

#### Density projection

```ts
hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
providers: [
  { provide: MLV_DENSITY_ELEMENT, useValue: 'switch-group' },
  provideMlvDensityContext(MlvDensityDirective),
],
```

- The host is stamped `mlv-switch-group--{density}`, which scales
  `--mlv-switch-group-gap` (`tight` `--mlv-spacing-1` → `airy` `--mlv-spacing-4`;
  `comfortable` keeps the historical `0.5rem`).
- `provideMlvDensityContext` publishes the group's resolved density as
  `MLV_DENSITY_CONTEXT`. Projected `<mlv-switch>` children resolve it through
  their declaration-site element injector (the same path `SWITCH_GROUP` uses), so
  they stamp the matching `mlv-switch--{density}` themselves — the density reaches
  them through DI, not only the CSS cascade.
- Resolution order in each child: its own `mlvDensity` input → the group's
  `MLV_DENSITY_CONTEXT` → `MlvDensityService`. An explicit `mlvDensity` on a
  single switch therefore overrides the group.

#### Template Summary

The **host** `<mlv-switch-group>` _is_ the group container: `class="mlv-switch-group"`,
`role="group"`, `[attr.aria-label]="label() || null"` and the `(keydown)` handler are
host bindings (the former inner wrapper `<div>` was removed so the BEM block and its
density modifier live on the same element). Template: optional `mlv-label` +
`<ng-content>`.

---

## Internal Token

```ts
export const SWITCH_GROUP = new InjectionToken<MlvSwitchGroupAccessor>('SWITCH_GROUP');

interface MlvSwitchGroupAccessor {
  onChildFocus(sw: MlvSwitch): void;
}
```

### `MlvSwitchGroup` is the control an `mlv-form-field` resolves (2026-09, #217)

The group also provides `MLV_FORM_CONTROL`, `useExisting` itself, and
`implements MlvFormControl`. Without it the field's
`contentChild(MLV_FORM_CONTROL)` — `descendants: true` by default — walked
past the group and resolved the **first projected `mlv-switch`** instead, so a
projected `<mlv-label>` could point its `for` at a nested control and the
group's own `<mlv-label>` (rendered from `label`) could borrow the field's
target from an unrelated sibling control. See
`.claude/projects/libs-form-utils.md` § _The field resolves the outermost
control_.

The group is a labelled region, not an editable control, so the **nine**
wrapper-facing halves of `MlvFormControl` it does not own — `focused`,
`disabled`, `readonly`, `loading`, `clearable`, `hasValue`, `prepend`,
`append`, `inset` — are constant, non-input signals. They exist so the
`implements` clause type-checks the contract: an `ExistingProvider`'s
`useExisting` is typed `any`, and `mlv-form-control-wrapper` calls several of
them unguarded. `state` and `label` are the group's real inputs and answer for
themselves.

They are public members on an exported class, and that has one consumer-visible
cost: `group.disabled()` on a `viewChild(MlvSwitchGroup)` **used to be a compile
error** and now compiles and always answers `false`. None of the nine is an
`input()`, so `[disabled]="…"` on the element still fails AOT with NG8002 — only
the TypeScript read changed, and it changed from loud to silent. Read
`computedDisabled()` on the individual `mlv-switch` children instead. Hiding
them is not available: `implements` requires public members, and widening
`MlvFormControl`'s own members to optional would break every consumer calling
`inject(MLV_FORM_CONTROL).focused()` under `strictNullChecks`.

### `MlvSwitchGroup` takes its accessible name from the field's label

`labelTarget` reports `{ id, labelable: false }`, `id` being the **component
host** — `mlv-switch-group` carries `role="group"` there, unlike
`mlv-checkbox-group`, which uses an inner `<div>`. `labelable: false` is what
makes `mlv-form-field` emit no `for`: a `<label for>` names only
`button`/`input`/`meter`/`output`/`progress`/`select`/`textarea`. The group
consumes the label through `aria-labelledby` instead, which is the association
WAI-ARIA prescribes for a group and the same shape `mlv-radio-group` ships:

```ts
'[attr.aria-labelledby]': 'label() ? _labelId : _fieldLabelId()',
```

A label written on the group wins over one projected beside it, because it is
the nearer, explicitly-authored name. The host `aria-label` binding is gone: it
duplicated the rendered `<mlv-label>`, and `aria-labelledby` outranks it anyway.
The host also gains an `id` attribute, which it did not carry before.

Pinned by `switch-group-field-label.spec.ts`, whose
`reports the element that carries role="group" as its label target` case fails
when the id is emitted anywhere but the host.

---

## Consumer `id` (2026-09, #323)

Identical to `mlv-checkbox` — see `libs-checkbox.md` § _Consumer `id` (#323)_; the logic is duplicated, not shared (FC-17).

- `[id]="id()"` on the native `role="switch"` input; the own wrapping `<label>` carries **no** `for` and names it by containment, so a duplicate or clashing consumer id cannot cross-wire it. `inputId` is a getter over `id()`. Before, `readonly inputId = this.id()` froze the generated default at construction.
- Static host `id` stripped in the constructor (`HostAttributeToken('id')`), so the consumer's id names one element — the focusable input — for `getElementById`, an external `<label for>` / `<mlv-label for>`, `aria-controls`. `labelTarget()` stays `null`.
- `_warnWhenUnlabelled` accepts an external `<label>` with text; still one-shot at first render.
- Spec: `switch-id.spec.ts` (mirrors `checkbox-id.spec.ts`); SSR payload pinned in `libs/core/src/ssr-smoke.spec.ts`. Migration: `docs/migrations/2026-09-checkbox-switch-consumer-id.md`.

## Validation state (2026-09, #320)

- **The track follows `resolvedState()`**, not `state()` — `.mlv-switch__track--<state>`. Before, a touched invalid `[formField]` showed nothing.
- **Only `error` paints**: `.mlv-switch__track--error` draws `box-shadow: inset 0 0 0 var(--mlv-stroke-width-medium) var(--mlv-border-error)`. A ring, not a fill, so on / off stays readable; inset, so it coexists with the `:focus-visible` outline. `success` / `warning` / `info` emit a class and no rule (SF-R6).
- **`state` is validation, not status.** `[state]="on ? 'success' : 'error'"` — the old usage example — now rings an "off" switch red and announces it as invalid. Show status in the label text or a `mlv-status-indicator` instead.
- **`aria-invalid="true"`** on the native `role="switch"` input while `resolvedState()` is `error`; no attribute otherwise.
- **`description` and `message` render**, after the `<label>` (outside the accessible name), indented past the track + label gap (both density-scaled, logical, mirrors in RTL).
- **`aria-describedby`** = `_describedBy()`: own description, own message, then the enclosing `mlv-form-field`'s error message id — see `libs-form-utils.md` § _Field error association and `aria-invalid`_.
- Spec: `switch-validation.spec.ts` (mirrors the checkbox one). `MlvSwitchGroup`'s `state` still paints nothing (follow-up).

---

## Usage Examples

```html
<!-- Standalone -->
<mlv-switch [(checked)]="darkMode">Dark Mode</mlv-switch>

<!-- Validation: a touched invalid field rings the track and sets aria-invalid -->
<mlv-switch [formField]="signup.terms" description="Required to create an account">Accept the terms</mlv-switch>

<!-- Group with keyboard navigation -->
<mlv-switch-group label="Permissions">
  <mlv-switch [(checked)]="canRead">Read</mlv-switch>
  <mlv-switch [(checked)]="canWrite">Write</mlv-switch>
  <mlv-switch [(checked)]="canDelete">Delete</mlv-switch>
</mlv-switch-group>

<!-- Reactive forms -->
<mlv-switch formControlName="enableNotifications">Notifications</mlv-switch>

<!-- Disabled -->
<mlv-switch [disabled]="true">Locked</mlv-switch>

<!-- Per-switch density -->
<mlv-switch mlvDensity="compact">Compact toggle</mlv-switch>

<!-- Group density, projected to every child; one child opts out -->
<mlv-switch-group mlvDensity="spacious" label="Notifications">
  <mlv-switch [(checked)]="email">Email</mlv-switch>
  <mlv-switch [(checked)]="sms" mlvDensity="tight">SMS</mlv-switch>
</mlv-switch-group>
```

---

## Dependencies

- `@angular/forms` — CVA
- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption`
- `@malva-ui/cdk/accessibility` — `MlvClick`
- `@malva-ui/cdk/density` — `MlvDensityDirective`, `MLV_DENSITY_ELEMENT`, `provideMlvDensityContext`
- `@malva-ui/core/form-utils` — `MlvSignalCheckboxControlBase`, `MlvDescription`, `MlvMessage`
- `@malva-ui/styles` — design tokens, `_mixins.scss`, `_density.scss`

## Disabled surface (2026-09, #366)

- The literal `opacity: 0.5` is gone (SF-R4): `--disabled &__track` → `--mlv-background-disabled`, `&__thumb` → `--mlv-text-disabled` with no shadow, `&__label` remaps `--mlv-text-primary` → `--mlv-text-disabled`; host keeps `pointer-events: none`.
- Thumb on track, before → after: on light 1.98 → 3.76, off light 1.04 → 3.76; dark on 2.69 → 3.44, dark off 4.71 → 3.44 (the one pair that drops, still ≥ 3:1).
- Spec: `switch-disabled-styles.spec.ts`.
- Guard: `styles:check-disabled-surface` (`scripts/check-disabled-surface.mjs`, a `styles:lint` dependency) fails any other disabled `opacity` and any `--state-success/warning/info` rule.
