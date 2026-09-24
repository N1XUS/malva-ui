---
# Library: stepper

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/stepper` provides a multi-step workflow UI with a stepper header (indicator circles + connector lines) and managed content panels. It supports both horizontal and vertical orientations, optional linear navigation enforcement, deviative steps (alternate/warning path), optional steps, step-level error states, and full keyboard + ARIA accessibility.

Key features:
- Horizontal layout: step headers in a row with connector lines; shared content panel below
- Vertical layout: each step renders its own content inline below the header using a smooth `grid-template-rows` expand/collapse animation
- Linear mode: forward navigation is blocked until steps are completed in order
- Step states: `pending`, `active`, `completed`, `error` — derived from `activeIndex`, or set per step as indicator decoration; selection always follows `activeIndex` alone (see _Explicit `state` is decoration_)
- Deviative steps: warning-colored label/connector/badge overlay for alternate-path tracking
- Deviation resolved: reverts connector to normal style when deviation is addressed
- Mobile-responsive: at ≤640px the horizontal header row is hidden and replaced by a compact `Step N of M: <label>` counter
- Parent→child communication via `MLV_STEPPER` injection token (`MlvStepperAccessor` interface)
- Dynamic steps: a step projected or removed after init (`@if` / `@for`) is renumbered, selected and navigated by its live position; the active step is followed by identity (see _Dynamic steps_)

---

## Public API

| Export                  | Kind                                 | Description                                                     |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------- | ----------- | ----------- | -------- |
| `MlvStepper`            | Component                            | Multi-step workflow container. Selector: `mlv-stepper`.         |
| `MlvStep`               | Component                            | Individual step definition. Selector: `mlv-step`.               |
| `MLV_STEPPER`           | `InjectionToken<MlvStepperAccessor>` | Token through which `MlvStepper` exposes itself to child steps. |
| `MlvStepperAccessor`    | Interface                            | Contract provided by `MlvStepper` via `MLV_STEPPER`.            |
| `MlvStepState`          | Type alias                           | `'pending'                                                      | 'active'    | 'completed' | 'error'` |
| `MlvStepperOrientation` | Type alias                           | `'horizontal'                                                   | 'vertical'` |

---

## Components

### `MlvStepper`

```
Selector:          mlv-stepper
Template:          stepper.html (external)
Change Detection:  OnPush
Encapsulation:     None (BEM scoping)
Providers:         [{ provide: MLV_STEPPER, useExisting: MlvStepper }]
Imports:           NgTemplateOutlet
```

#### Inputs

| Input          | Type                                  | Default        | Description                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orientation`  | `MlvStepperOrientation`               | `'horizontal'` | `'horizontal'` renders step headers side-by-side with a connector line. `'vertical'` stacks each step header and its content in a column.                                                                                                                    |
| `linear`       | `BooleanInput` (coerced to `boolean`) | `false`        | When `true`, users must complete steps in order. Only completed steps and the next pending step are clickable. Allows attribute usage: `<mlv-stepper linear>`.                                                                                               |
| `initialIndex` | `number`                              | `0`            | Zero-based index of the initially active step. Applied once in `ngAfterContentInit`. An index past the steps projected by then is kept, so steps that arrive later open on it, clamped to the last — see _Dynamic steps_.                                    |
| `ariaLabel`    | `string \| undefined`                 | `undefined`    | Accessible name of the step list: `aria-label` on the `role="tablist"` element (both orientations), never on the roleless host. Wins over a static host `aria-label` / `aria-labelledby`, which are moved there too. An empty string counts as unset (#326). |

#### Outputs

| Output              | Type                       | Description                                                                                                                                                                                                                           |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeIndexChange` | `OutputEmitterRef<number>` | Emits the new zero-based active step index after any navigation (next, previous, or direct selectStep). A re-index caused by the consumer changing the projected steps is **not** navigation and emits nothing — see _Dynamic steps_. |

#### Host Bindings

| Binding   | Value                                                                       |
| --------- | --------------------------------------------------------------------------- |
| `class`   | `'mlv-stepper'` (static)                                                    |
| `[class]` | `_hostClasses()` → `'mlv-stepper--horizontal'` or `'mlv-stepper--vertical'` |

No `aria-label` / `aria-labelledby` on the host: it is a roleless custom element, where ARIA prohibits both (axe `aria-prohibited-attr`, reported only as `incomplete`, so sweeps never caught it). A static host `aria-label` or `aria-labelledby` is captured through `HostAttributeToken`, stripped from the host in the constructor (the `mlv-checkbox` pattern) and moved to both tablists — see `_tablistLabel` / `_tablistLabelledBy`. One naming attribute on the tablist: `ariaLabel` → static `aria-labelledby` → static `aria-label`.

Residual: `HostAttributeToken` is `null` for a `createComponent(MlvStepper, { hostElement })` root host, so a pre-set `aria-label` / `aria-labelledby` there is neither moved nor stripped — it stays on the host and names nothing (before #326 the `null` binding removed a pre-set `aria-label`). No DOM-read fallback (it would re-capture a server-written bound value on hydration); pass `setInput('ariaLabel', …)`. A **bound** `[attr.aria-label]` / `[attr.aria-labelledby]` is not moved either — bind `[ariaLabel]`. Migration: `docs/migrations/2026-09-accessible-name-sources.md`.

#### Content Children

| Query    | Type                       | Description                        |
| -------- | -------------------------- | ---------------------------------- |
| `_steps` | `contentChildren(MlvStep)` | All projected `mlv-step` children. |

#### Computed / Derived State

| Member               | Description                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeIndex`        | `linkedSignal` over `_steps` — the active step's zero-based position once the steps have rendered (public and writable, but derive from it rather than set it, and never mirror it from `activeIndexChange`). Seeded from `initialIndex` in `ngAfterContentInit`; re-resolved by identity whenever the projected steps change. An out-of-range value is kept, with no step active, until the steps next change (see _Dynamic steps_). |
| `_positions`         | `computed(...)` — `Map<MlvStep, number>` of every projected step's live position; `_stateFor` / `_isSelected` / `_isClickable` read it.                                                                                                                                                                                                                                                                                               |
| `_isSelected`        | `(step) => boolean` — position `=== activeIndex()`. The **only** source of `aria-selected`, the rendered horizontal panel and the open (`--active`, non-`inert`) vertical panel. Never reads `step.state()` (#312).                                                                                                                                                                                                                   |
| `_stateFor`          | `(step) => MlvStepState` — the step's explicit `state`, else derived (`completed` before `activeIndex`, `active` at it, `pending` after). Feeds the indicator, the step-header / vertical-label modifiers and the connector `--completed` — decoration only, never selection.                                                                                                                                                         |
| `_stepList`          | `computed(() => this._steps())` — iterable array for the template `@for` loops, which `track step` by identity and read `$index` for numbering, `grid-row` and `selectStep`.                                                                                                                                                                                                                                                          |
| `_hostClasses`       | `computed(...)` — builds orientation modifier class string.                                                                                                                                                                                                                                                                                                                                                                           |
| `_tablistLabel`      | `computed(...)` — `ariaLabel() \|\| (static host aria-labelledby ? null : static host aria-label) \|\| null`; bound as `[attr.aria-label]` on both `role="tablist"` elements.                                                                                                                                                                                                                                                         |
| `_tablistLabelledBy` | `computed(...)` — `ariaLabel() ? null : static host aria-labelledby \|\| null`; bound as `[attr.aria-labelledby]` on both `role="tablist"` elements (#326).                                                                                                                                                                                                                                                                           |

#### Public Methods

| Method         | Signature               | Description                                                                                                             |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `next()`       | `(): void`              | Navigate to the next step. No-op if already at the last step.                                                           |
| `previous()`   | `(): void`              | Navigate to the previous step. No-op if already at the first step.                                                      |
| `selectStep()` | `(index: number): void` | Navigate directly to the step at `index`. In linear mode, forward navigation beyond the current active step is blocked. |

#### Template Summary (`stepper.html`)

The template **branches at the top level** on `orientation()` — the vertical and
horizontal layouts are two separate subtrees rather than an `@if` inside a
single `@for`. In **both** orientations the `role="tablist"` element's only
accessible children are the `role="tab"` triggers, and every `role="tabpanel"`
lives **outside** the tablist's accessible subtree (a tabpanel is not a
permitted tablist child — see the axe note under _Accessibility_).

- **Vertical layout** (`orientation() === 'vertical'`): a single two-column CSS
  grid (`div.mlv-stepper__vgrid`) hosts every step.
  - The `role="tablist"` header (`div.mlv-stepper__header`) uses
    `display: contents`, so its per-step **indicator columns**
    (`div.mlv-stepper__indicator-col`, `role="presentation"`) become grid items
    of `__vgrid` directly. Each indicator column holds the step trigger
    (`mlv-stepper__step-header`, `role="tab"`, `[attr.aria-label]="step.label()"`
    — the indicator itself is `aria-hidden`, so the label gives the tab its
    accessible name) and, below it, the `mlv-stepper__vertical-connector`
    (`aria-hidden`). The `role="presentation"` on the indicator column bridges it
    so the tab is a direct accessible child of the tablist.
  - A **sibling** container (`div.mlv-stepper__bodies`, `role="presentation"`,
    also `display: contents`) holds the per-step **body columns**
    (`div.mlv-stepper__body-col`, `role="presentation"`): the label group
    (label, optional tag, description) and the inline content panel
    (`mlv-stepper__content-panel`, `role="tabpanel"`, labelled via `aria-label`)
    that expands/collapses via a `grid-template-rows` animation. Because the
    bodies container is a sibling of the tablist (not a descendant), the
    tabpanels are **not** owned by the tablist.
  - Each indicator column and its matching body column are pinned to the same
    grid row via `[style.grid-row]="$index + 1"`, so the connector stays
    aligned with the label and the active (expanded) panel pushes the following
    step down — preserving the interleaved appearance. Every panel but the
    selected step's (`_isSelected`) uses
    `[attr.inert]` (not bare `aria-hidden`) so their still-rendered focusable
    content is removed from both the a11y tree and the tab order (axe
    `aria-hidden-focus`).
- **Horizontal layout**: the `role="tablist"` header
  (`div.mlv-stepper__header`) renders a `mlv-stepper__header-item` per step,
  each containing a step trigger (`mlv-stepper__step-header`, `role="tab"`,
  `[attr.aria-label]="step.label()"`) with indicator and label group, plus a
  `mlv-stepper__connector` line (`aria-hidden`, hidden for last step). The
  **mobile counter** (`div.mlv-stepper__mobile-counter`, `aria-hidden="true"`,
  `Step N of M: <label>`, visible only at ≤40rem via CSS) and the **shared
  content panel** are siblings _below_ the tablist: an `@for` loop renders only
  the selected step's (`_isSelected`) `ngTemplateOutlet` inside
  `div.mlv-stepper__content-panel.mlv-stepper__content-panel--active`
  (`role="tabpanel"`, `[attr.aria-label]="step.label()"`).

##### State class matrix for step headers

| State       | `.mlv-stepper__step-header--*` modifier | Indicator appearance                                               |
| ----------- | --------------------------------------- | ------------------------------------------------------------------ |
| `active`    | `--active`                              | Solid accent background + white text                               |
| `completed` | `--completed`                           | Solid accent background + checkmark SVG                            |
| `error`     | `--error`                               | Negative-pale background + error-icon SVG + negative-colored label |
| `pending`   | `--pending`                             | Neutral border + step number + secondary-colored label             |
| deviative   | `--deviative`                           | Warning-colored label + warning-triangle badge overlay             |

The matrix is the **indicator**, not the selection. The four state modifiers
follow `_stateFor`, so an explicit `state` moves them: the selected step can
carry `--error`, `--completed` or `--pending`, and a step with
`state="active"` carries `--active` without being selected. Selection is
`aria-selected` on the tab plus the rendered / `--active` content panel, all
from `_isSelected` — no step-header modifier means "selected".

##### Connector state classes

| Condition                                 | Class on `mlv-stepper__connector` / `mlv-stepper__vertical-connector` |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Step completed                            | `--completed` → accent-colored solid line                             |
| Step deviative and deviation not resolved | `--deviative` → dashed warning-colored line                           |
| Otherwise                                 | Default neutral border color                                          |

---

### `MlvStep`

```
Selector:          mlv-step
Template:          inline — <ng-template #contentTpl><ng-content /></ng-template>
Change Detection:  OnPush
Encapsulation:     None (BEM scoping)
Host class:        mlv-step
```

Each `mlv-step` wraps its projected content inside an `<ng-template>`. The parent `MlvStepper` renders the template via `NgTemplateOutlet` inside the appropriate content panel — this defers DOM creation for non-active steps.

#### Inputs

| Input               | Type                        | Default      | Description                                                                                                                                                                                                                      |
| ------------------- | --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`             | `string`                    | **required** | Step label displayed in the step header.                                                                                                                                                                                         |
| `description`       | `string \| undefined`       | `undefined`  | Optional sub-label shown below the main label.                                                                                                                                                                                   |
| `state`             | `MlvStepState \| undefined` | `undefined`  | Explicit **indicator** state: replaces the derived one for this step's indicator, label and connector. Decoration only — never selects; the open step is always the one at `activeIndex` (see _Explicit `state` is decoration_). |
| `optional`          | `BooleanInput` (coerced)    | `false`      | When `true`, shows an "Optional" tag below the label. In linear mode, optional steps can be skipped. Allows attribute usage: `<mlv-step optional>`.                                                                              |
| `deviative`         | `BooleanInput` (coerced)    | `false`      | When `true`, marks this step as a deviative/alternate path. Renders a warning-colored triangle badge on the indicator and a dashed warning connector after the step. Allows attribute usage: `<mlv-step deviative>`.             |
| `deviationResolved` | `BooleanInput` (coerced)    | `false`      | When `true` (and `deviative` is also true), the connector after this step reverts to its normal (solid, neutral) style, indicating the deviation has been addressed. Allows attribute usage: `<mlv-step deviationResolved>`.     |

#### Outputs

None.

#### Internal API

A step carries no index of its own: `MlvStepper` derives every step's position from its live `contentChildren` query (`_positions`, `$index`). The former `_index` field, stamped once at content init, is gone (#311).

| Member       | Type                                                     | Description                                                                                                                                                       |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contentTpl` | `viewChild.required<TemplateRef<unknown>>('contentTpl')` | Template reference holding the step's projected content. Accessed by `MlvStepper` via `step.contentTpl()` to render into content panels using `NgTemplateOutlet`. |

---

## Injection Token

### `MLV_STEPPER`

```ts
const MLV_STEPPER = new InjectionToken<MlvStepperAccessor>('MLV_STEPPER');
```

Provided by `MlvStepper` as `useExisting`, making the stepper instance injectable into its child step components without a direct class reference.

### `MlvStepperAccessor` Interface

```ts
interface MlvStepperAccessor {
  readonly activeIndex: () => number;
  readonly orientation: () => MlvStepperOrientation;
  selectStep(index: number): void;
}
```

| Member              | Description                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| `activeIndex`       | Signal getter — returns the current zero-based active step index.                 |
| `orientation`       | Signal getter — returns the current orientation (`'horizontal'` or `'vertical'`). |
| `selectStep(index)` | Programmatically navigate to a step by index.                                     |

---

## Interfaces & Types

### `MlvStepState`

```ts
type MlvStepState = 'pending' | 'active' | 'completed' | 'error';
```

| Value         | Meaning                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `'pending'`   | Derived for steps after `activeIndex`. Neutral styling.                     |
| `'active'`    | Derived for the step at `activeIndex`. Accent-filled indicator, bold label. |
| `'completed'` | Derived for steps before `activeIndex`. Checkmark icon in indicator.        |
| `'error'`     | Never derived — only set explicitly. Error-colored indicator and label.     |

Any value can also be set explicitly through `MlvStep.state`, and then only
changes how that step looks. The type describes an indicator, never a
selection — see _Explicit `state` is decoration_.

### `MlvStepperOrientation`

```ts
type MlvStepperOrientation = 'horizontal' | 'vertical';
```

---

## Usage Examples

### Basic horizontal stepper

```html
<mlv-stepper (activeIndexChange)="onStepChange($event)">
  <mlv-step label="Account">
    <p>Account setup content</p>
    <button mlvButton (click)="stepper.next()">Next</button>
  </mlv-step>
  <mlv-step label="Profile">
    <p>Profile content</p>
    <button mlvButton variant="ghost" (click)="stepper.previous()">Back</button>
    <button mlvButton (click)="stepper.next()">Next</button>
  </mlv-step>
  <mlv-step label="Review">
    <p>Review and submit</p>
    <button mlvButton (click)="stepper.previous()">Back</button>
    <button mlvButton (click)="submit()">Submit</button>
  </mlv-step>
</mlv-stepper>
```

### Linear stepper (enforced order)

```html
<mlv-stepper linear #stepper (activeIndexChange)="currentStep = $event">
  <mlv-step label="Personal Info">
    <p>Fill in your details</p>
    <button mlvButton (click)="stepper.next()">Continue</button>
  </mlv-step>
  <mlv-step label="Payment" description="Secure checkout">
    <p>Enter payment details</p>
    <button mlvButton (click)="stepper.next()">Pay</button>
  </mlv-step>
  <mlv-step label="Confirmation">
    <p>Order confirmed!</p>
  </mlv-step>
</mlv-stepper>
```

### Vertical stepper

```html
<!-- initialIndex opens "Processing"; the steps before it derive `completed`. -->
<mlv-stepper orientation="vertical" ariaLabel="Order processing steps" [initialIndex]="1">
  <mlv-step label="Order placed">
    <p>Your order was received on Jan 10.</p>
  </mlv-step>
  <mlv-step label="Processing">
    <p>We are preparing your shipment.</p>
  </mlv-step>
  <mlv-step label="Shipped">
    <p>Awaiting shipment.</p>
  </mlv-step>
  <mlv-step label="Delivered">
    <p>Awaiting delivery.</p>
  </mlv-step>
</mlv-stepper>
```

### Deviative step with deviation resolved

```html
<mlv-stepper>
  <mlv-step label="Start">
    <p>Initial step</p>
  </mlv-step>
  <mlv-step label="Alternative path" deviative [deviationResolved]="isResolved()">
    <p>This step follows an alternate route. The connector is dashed/warning until resolved.</p>
  </mlv-step>
  <mlv-step label="End">
    <p>Final step</p>
  </mlv-step>
</mlv-stepper>
```

### With optional step

```html
<mlv-stepper linear>
  <mlv-step label="Basic Info">...</mlv-step>
  <mlv-step label="Advanced Settings" optional description="You can skip this">...</mlv-step>
  <mlv-step label="Submit">...</mlv-step>
</mlv-stepper>
```

### Programmatic control from component class

```ts
import { MlvStepper, MlvStep } from '@malva-ui/core/stepper';

@Component({
  imports: [MlvStepper, MlvStep],
  template: `
    <mlv-stepper #stepper [linear]="isLinear()" (activeIndexChange)="onStep($event)">
      <mlv-step label="Step 1">...</mlv-step>
      <mlv-step label="Step 2">...</mlv-step>
    </mlv-stepper>
    <button mlvButton (click)="stepper.next()">Next</button>
    <button mlvButton variant="ghost" (click)="stepper.previous()">Back</button>
  `,
})
export class WizardComponent {
  readonly isLinear = signal(true);
  onStep(index: number): void {
    console.log('Active step:', index);
  }
}
```

### Conditional steps

Derive the index from the stepper; do not copy `(activeIndexChange)` into a
signal of your own. Toggling `needsShipping()` moves Payment from 1 to 2
without emitting, so a copied `step()` would stay at `1`.

```ts
@Component({
  imports: [MlvStepper, MlvStep],
  template: `
    <mlv-stepper #wizard>
      <mlv-step label="Cart">...</mlv-step>
      @if (needsShipping()) {
        <mlv-step label="Shipping">...</mlv-step>
      }
      <mlv-step label="Payment">...</mlv-step>
    </mlv-stepper>
    <p>Step {{ wizard.activeIndex() + 1 }}</p>
  `,
})
export class CheckoutComponent {
  readonly needsShipping = signal(false);
  private readonly _wizard = viewChild(MlvStepper);
  /** Derived, so a re-index is never missed. */
  readonly onFirstStep = computed(() => (this._wizard()?.activeIndex() ?? 0) === 0);
}
```

---

## Dynamic steps

Steps may be projected or removed after init through `@if` / `@for`. Every
position is derived from the live `contentChildren` query, never stamped once,
so numbering, `aria-selected`, the rendered / non-`inert` panel, the roving
tabindex, the vertical `grid-row`, the mobile `Step N of M` counter and
`next()` / `previous()` / `selectStep()` all follow the rendered list.
Before #311 a step inserted after init kept index `0`: two steps were active at
once and the `@for` track keys collided (NG0955).

`activeIndex` follows the **active step by identity** (a `linkedSignal` over the
query):

| Content change                                  | Active step afterwards                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Step inserted / removed / reordered elsewhere   | The same step; `activeIndex` moves with it                                                           |
| Active step removed                             | The step now in its slot (the one after its nearest surviving predecessor), clamped to the last step |
| Active step replaced in place (`@if` / `@else`) | The replacement                                                                                      |
| Active step and every step before it removed    | The new first step — the survivor that followed it is not skipped                                    |

- **Not navigation.** The consumer changed the steps, so no `activeIndexChange`
  is emitted even when the number changes (the `model()` convention: a
  `…Change` output reports what the component did, not what its parent did).
- **Derive the index, don't mirror it.** Read `activeIndex()` through a
  template reference (`<mlv-stepper #wizard>` → `{{ wizard.activeIndex() }}`)
  or a `computed()` over `viewChild(MlvStepper)` — see _Conditional steps_. A
  copy kept from `(activeIndexChange)` goes stale on the first re-index. So
  does a read in the same handler that changes the steps: the step query
  refreshes during change detection, and until then `activeIndex()` still
  returns the old position.
- **Navigate after the new steps render.** `next()`, `previous()`,
  `selectStep()` and `activeIndex.set()` called in the same tick as a step
  change act on the old list, and the re-index that follows moves the index
  again without emitting: `labels.set(['A', 'X', 'B', 'C'])` then
  `selectStep(1)` emits `1` but ends on B, not X. Defer the call —
  `afterNextRender(() => stepper.selectStep(1), { injector })`.
- **Derived states.** Steps before the active one derive `completed`, so a
  step inserted **before** the active one shows the checkmark without having
  been visited. In `linear` mode it is therefore clickable — the user can step
  back into it — while steps after the active one stay locked. Pinned by
  `stepper.spec.ts` → _projected steps change after init (#311)_.
- **`initialIndex`** is still applied once, at content init. An index past the
  steps projected by then is kept (no step is active) and applied when steps
  arrive, clamped to the last — a `@for` over data that loads later opens on
  it. An out-of-range `activeIndex.set()` behaves the same way. A list emptied
  and refilled starts on its first step, because the active step was removed
  with no step before it.

---

## Explicit `state` is decoration

`MlvStep.state` changes how one step **looks**; it never selects (owner
ruling D9, #312). Selection — `aria-selected`, the rendered horizontal panel,
the open (`--active`, non-`inert`) vertical panel — is `_isSelected(step)`:
the step's live position `=== activeIndex()`. The indicator, the step-header
and vertical-label state modifiers and the connector `--completed` come from
`_stateFor(step)`: the explicit `state` if set, else the derived one.

| Arrangement                                                  | Selected / open                           | Indicator                                               |
| ------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------- |
| Step at `activeIndex` with `state="error"`                   | that step                                 | `error`                                                 |
| Step at `activeIndex` with `state="completed"` / `"pending"` | that step                                 | `completed` / `pending` — no bold `--active` label      |
| `state="active"` on a step **not** at `activeIndex`          | the step at `activeIndex`                 | both show `active`                                      |
| `state` set on the step the user is on (a failed validation) | unchanged; no `activeIndexChange` emitted | the new state                                           |
| No `state` anywhere                                          | the step at `activeIndex`                 | derived — `completed` / `active` / `pending`, unchanged |

- **Choose the open step with `initialIndex` / `activeIndex`**, never with
  `state="active"`. Initially: `[initialIndex]`. Later: `selectStep(i)` (emits,
  moves the roving tab stop, refuses forward moves in `linear` mode) or
  `activeIndex.set(i)` (ignores `linear`, emits nothing, and the roving tab
  stop does not follow it — #459).
- **Selection has no header look of its own.** The step header's appearance is
  `_stateFor` alone, so a selected step carrying an explicit non-`active`
  state is told apart in the header row only by `aria-selected`: vertically
  its panel opens under its own label; a horizontal stepper at ≤40rem names it
  in the counter; at desktop width a horizontal row shows no selection cue on
  that step. Adding one is left open as #480, not part of #312.
- **Before #312** one string drove both: `_stateFor(step) === 'active'`
  decided `aria-selected`, the panel and `inert`. An explicit state on the
  step at `activeIndex` therefore left no tab selected and a blank content
  area (docs examples 3 and 5), and `state="active"` on another step opened a
  second panel. Migration: `docs/migrations/2026-09-stepper-state-decoration.md`.
  Pinned by `stepper.spec.ts` → _explicit step state is decoration (#312)_.

---

## Accessibility

- **Direction (RTL): scoped, not per-document.** A horizontal stepper's `FocusKeyManager` takes `withHorizontalOrientation(this._direction())`, where `_direction` is `elementDirection(host)` — not the global `direction()` — and the manager is rebuilt when it flips. So step headers inside a `[dir="rtl"]` subtree step with `ArrowLeft` = next while the document stays LTR, and an LTR island under an RTL document does not mirror. A vertical stepper takes `withVerticalOrientation()` and is unaffected. `Home` / `End` mean first / last in both directions. Regressions in `stepper.spec.ts` → _scoped [dir] keyboard mirroring_.
- **`aria-required-children` (tablist ⊃ tabs only)** — the `role="tablist"` element's accessible children must all be `role="tab"`; a `role="tabpanel"` is **not** a permitted tablist child (axe flags it as an "unallowed" owned child, a critical `aria-required-children` violation). This is enforced in both orientations:
  - _Horizontal_: the tabpanel is a sibling rendered below the tablist, so it was never inside it.
  - _Vertical_: the tabpanels are rendered in the sibling `div.mlv-stepper__bodies` container (not a descendant of the tablist). The tablist itself uses `display: contents` and directly contains only the per-step indicator columns (bridged with `role="presentation"`) that wrap the tabs. Note plain role-less wrapper divs already "descend transparently" in axe's algorithm — the previous violation was caused solely by the tabpanels being owned by the tablist, which this structure fixes. See the vertical spec (`stepper.spec.ts`) for the axe `aria-required-children` assertion and the structural checks (only tabs owned; no tabpanel inside the tablist; presentation bridges).
- The header container has `role="tablist"`, `tabindex="-1"`, `[attr.aria-orientation]="orientation()"` and `[attr.aria-label]="_tablistLabel()"` / `[attr.aria-labelledby]="_tablistLabelledBy()"` — the stepper's accessible name lives here, not on the roleless host (#326; measured in Chromium's native AX tree: the vertical tablist is named despite `display: contents`). It carries the `(keydown)` handler (`_onHeaderKeydown`) that drives arrow navigation. Regressions in `stepper.spec.ts` → _accessible name lands on the tablist (#326)_.
- Each step header trigger has `role="tab"`, `[attr.aria-selected]`, `[attr.aria-disabled]`, and a **roving** `[attr.tabindex]` (see below). `aria-current` is intentionally **not** set — the tablist model uses `aria-selected` as the single source of active-step truth. `aria-selected` follows `activeIndex` only (`_isSelected`), never a step's explicit `state`.
- **Roving tabindex + arrow-key navigation** (implements the WAI-ARIA tablist pattern):
  - Each `.mlv-stepper__step-header` carries the `[mlvStepHeader]` directive (`MlvStepHeader`, `exportAs: 'mlvStepHeader'`), which implements CDK `FocusableOption` (exposes `focus()`, a `disabled` getter from the `isDisabled` input, and a `tabIndex` signal). The template binds `[attr.tabindex]="sh.tabIndex()"`.
  - `MlvStepper` queries the headers via `viewChildren(MlvStepHeader)` and drives a `FocusKeyManager` (`.withWrap()`, `.withHomeAndEnd()`, `.skipPredicate(h => h.disabled)`, plus `withHorizontalOrientation(direction)` — the scoped `elementDirection(host)` — or `withVerticalOrientation()` depending on `orientation()`). The manager is rebuilt in an `effect()` when the headers, the orientation or the direction change and torn down via `DestroyRef`.
  - Only the focused/active header has `tabindex="0"`; all others are `-1`. Arrow keys (Left/Right when horizontal, Up/Down when vertical) move focus and the roving tabindex; `Home`/`End` jump to first/last; navigation **wraps**; non-clickable steps (future steps in linear mode) are skipped.
  - Navigation uses **manual activation**: arrows move focus only. `Enter`/`Space` on a focused header call `selectStep()` (`Space` also `preventDefault()`s page scroll). Selecting a step moves the roving tabindex to it via `_keyManager.updateActiveItem()`.
- Content panels have `role="tabpanel"` and `[attr.aria-label]`; every vertical panel but the selected step's stays rendered and carries `[attr.inert]`.
- Step indicator circles and grip visuals are `aria-hidden="true"` — decorative.
- `:focus-visible` ring uses `--mlv-border-focus` with `outline-offset: 0.125rem`.
- Mobile counter (`div.mlv-stepper__mobile-counter`) is `aria-hidden="true"` since the actual header content is still in the DOM (just hidden via CSS at narrow viewports).

---

## Dependencies

### Angular / third-party

- `@angular/core` — `Component`, `Directive`, `contentChildren`, `viewChildren`, `viewChild`, `signal`, `computed`, `effect`, `untracked`, `input`, `output`, `inject`, `DestroyRef`
- `@angular/common` — `NgTemplateOutlet`
- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption` (step-header keyboard navigation)

### Internal Malva UI packages

- `@malva-ui/styles` — CSS design tokens via `--mlv-*` custom properties
