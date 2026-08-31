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
| `state`          | `MlvSwitchState`      | `'default'`                 | Semantic state for track color                                                                                                                                                                                                                                                                                               |
| `label`          | `string`              | `''`                        | **Visible** label text, rendered inside the `<label>` when nothing is projected into `<mlv-switch>`. Projected content always wins (CSS `display: none`-s the fallback), so the accessible name never duplicates. Inherited from the signal base                                                                             |
| `required`       | `boolean` (coerced)   | `false`                     | Sets `aria-required` on the native input; also a signal-forms field binding. Inherited from the signal base                                                                                                                                                                                                                  |
| `ariaLabel`      | `string \| null`      | `null`                      | Accessible name applied to the inner native input; wins over a captured static host `aria-label`. Inherited from the signal base since 2026-08 (was a switch-local input)                                                                                                                                                    |
| `ariaLabelledBy` | `string \| undefined` | `undefined`                 | Id reference(s) naming the inner native input; same precedence as `ariaLabel`                                                                                                                                                                                                                                                |

#### Inputs (inherited from `MlvSignalFormUiControlBase`)

| Name          | Type                                               | Default                    | Description                                                                      |
| ------------- | -------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| `readonly`    | `boolean`                                          | `false`                    | Read-only control; also a signal-forms field binding.                            |
| `loading`     | `boolean`                                          | `false`                    | Shows the loading affordance.                                                    |
| `clearable`   | `boolean`                                          | `false`                    | Renders the clear affordance while the control has a value (On counts as one).   |
| `pill`        | `boolean`                                          | `false`                    | Fully rounded (stadium) control container.                                       |
| `errors`      | `readonly ValidationError.WithOptionalFieldTree[]` | `[]`                       | Signal-forms field binding: current validation errors.                           |
| `touched`     | `boolean`                                          | `false`                    | Signal-forms field binding: whether the bound field is touched.                  |
| `dirty`       | `boolean`                                          | `false`                    | Signal-forms field binding: whether the bound field is dirty.                    |
| `id`          | `string`                                           | `mlvNextId('mlv-control')` | HTML id applied to the control's focus target.                                   |
| `hint`        | `string`                                           | `''`                       | Hint text rendered inside the label.                                             |
| `description` | `string`                                           | `''`                       | Persistent help text rendered below the control (`<mlv-description>` slot wins). |
| `message`     | `string`                                           | `''`                       | Validation/status message rendered below the control.                            |

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
clip-path pattern). Its `tabindex` is the roving tabindex managed by
`MlvSwitchGroup` (`tabIndex` signal: 0 for active, -1 for others).

#### Key Methods

- `focus()` — CDK `FocusableOption`; focuses the native input (not the host)
- `toggle()` — Flip checked state (no-op if disabled)
- `onInputChange(event)` — Reflects the native `change` event onto the `checked` model
- `setFocused(focused)` — Inherited from the signal base; updates the focus signal driving the wrapper state.

The control is a signal-forms field, not a `ControlValueAccessor` — there is no
`writeValue`/`setDisabledState` pair.

#### Internal methods (`@internal`, template-facing)

- `onEnter(event)` — Enter-key toggle (Space is handled natively by the input)
- `onFocus()` — Notify parent group via `SWITCH_GROUP` token
- `onBlur()` — Emits the signal-forms `touch` output when focus leaves the input

#### Keyboard & Focus

- **Single tab stop:** the native input carries the roving tabindex; the host is not tabbable.
- **Space** toggles natively (fires `change`); **Enter** toggles via `onEnter`.
- **`:focus-visible`** ring is promoted from the hidden input onto `.mlv-switch__track` using `--mlv-border-focus`.

#### Template Summary

`<label>` wrapping:

- Visually-hidden (clip-path) `<input #nativeInput type="checkbox" role="switch" [attr.tabindex]="tabIndex()" [attr.aria-checked] [attr.aria-required]>`
- `.mlv-switch__track.mlv-switch__track--{state}` (visual track + thumb)
- `.mlv-switch__text`, holding `.mlv-switch__content` (`<ng-content>`) followed by the `.mlv-switch__label-text` fallback rendered from the `label` input

A dev-mode `console.warn` fires once per instance when a switch has no projected text, no `label`, and no `ariaLabel`/`ariaLabelledBy` — i.e. no accessible name at all.

#### Styles

Track is a stadium (`--mlv-radius-full`) at every step; the thumb is a circle
inset by `--mlv-switch-thumb-inset` (`0.125rem`, constant). Colors:
`--mlv-background-neutral-1` (off) → `--mlv-background-accent-1` (on),
thumb `--mlv-elevation-bg-5` + `--mlv-shadow-1`, focus ring `--mlv-border-focus`
promoted from the hidden input onto `.mlv-switch__track`.

**2026-08-26:** in dark theme `--mlv-elevation-bg-5` follows the general
elevation ladder (lightened grey, `color-mix` toward white off
`--mlv-palette-neutral-700`, ≈`#707070`) — muddy against the off-track
(≈`#262626`) and near-unreadable (≈1.07:1) against the accent-1 on-track
(`#5770cb`). `switch.scss` shadows the token locally under
`[mlvTheme='dark'] .mlv-switch` to `--mlv-palette-neutral-50` (≈`#fafafa`,
same invariant near-white in every theme) so the thumb reads as a crisp knob
in both states (14.5:1 off-track, 4.45:1 on-track). Light is untouched — it
already resolved `--mlv-elevation-bg-5` → `--mlv-background-raised` →
`#ffffff`. No other `--mlv-elevation-bg-5` consumer exists, so the shadowed
override is switch-local by construction.

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

| Method                            | Description                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `onChildFocus(child)`             | Marks the focused child active in the `FocusKeyManager` (roving tabindex).         |
| `onKeydown(event: KeyboardEvent)` | Forwards arrow/Home/End keys to the `FocusKeyManager`, skipping disabled children. |

#### Keyboard Navigation

`FocusKeyManager` (from `MlvFocusableGroupBase`) — arrow up/down navigates between switches, skips disabled via `computedDisabled()`. Initial tab stop on the first switch; the base's `change`-sub then keeps the roving `tabindex=0` on the **focused** switch. Bug fix: this sync was previously missing, so Tab-out/Tab-in returned focus to the wrong switch — now ported from checkbox-group and covered by `switch-group.spec.ts`.

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

---

## Usage Examples

```html
<!-- Standalone -->
<mlv-switch [(checked)]="darkMode">Dark Mode</mlv-switch>

<!-- State-based styling -->
<mlv-switch [(checked)]="isOnline" [state]="isOnline() ? 'success' : 'error'">Status</mlv-switch>

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
- `@malva-ui/core/form-utils` — `MlvLabel`
- `@malva-ui/styles` — design tokens, `_mixins.scss`, `_density.scss`
