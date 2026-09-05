---
# Library: stepper

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/stepper` provides a multi-step workflow UI with a stepper header (indicator circles + connector lines) and managed content panels. It supports both horizontal and vertical orientations, optional linear navigation enforcement, deviative steps (alternate/warning path), optional steps, step-level error states, and full keyboard + ARIA accessibility.

Key features:
- Horizontal layout: step headers in a row with connector lines; shared content panel below
- Vertical layout: each step renders its own content inline below the header using a smooth `grid-template-rows` expand/collapse animation
- Linear mode: forward navigation is blocked until steps are completed in order
- Step states: `pending`, `active`, `completed`, `error` (auto-derived or explicitly overridden)
- Deviative steps: warning-colored label/connector/badge overlay for alternate-path tracking
- Deviation resolved: reverts connector to normal style when deviation is addressed
- Mobile-responsive: at ≤640px the horizontal header row is hidden and replaced by a compact `Step N of M: <label>` counter
- Parent→child communication via `MLV_STEPPER` injection token (`MlvStepperAccessor` interface)

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

| Input          | Type                                  | Default        | Description                                                                                                                                                    |
| -------------- | ------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientation`  | `MlvStepperOrientation`               | `'horizontal'` | `'horizontal'` renders step headers side-by-side with a connector line. `'vertical'` stacks each step header and its content in a column.                      |
| `linear`       | `BooleanInput` (coerced to `boolean`) | `false`        | When `true`, users must complete steps in order. Only completed steps and the next pending step are clickable. Allows attribute usage: `<mlv-stepper linear>`. |
| `initialIndex` | `number`                              | `0`            | Zero-based index of the initially active step. Applied once in `ngAfterContentInit`.                                                                           |
| `ariaLabel`    | `string \| undefined`                 | `undefined`    | Accessible label for the stepper container, announced by screen readers via `aria-label` on the host.                                                          |

#### Outputs

| Output              | Type                       | Description                                                                                             |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `activeIndexChange` | `OutputEmitterRef<number>` | Emits the new zero-based active step index after any navigation (next, previous, or direct selectStep). |

#### Host Bindings

| Binding             | Value                                                                       |
| ------------------- | --------------------------------------------------------------------------- | --- | ----- |
| `class`             | `'mlv-stepper'` (static)                                                    |
| `[class]`           | `_hostClasses()` → `'mlv-stepper--horizontal'` or `'mlv-stepper--vertical'` |
| `[attr.aria-label]` | `ariaLabel()                                                                |     | null` |

#### Content Children

| Query    | Type                       | Description                        |
| -------- | -------------------------- | ---------------------------------- |
| `_steps` | `contentChildren(MlvStep)` | All projected `mlv-step` children. |

#### Computed / Derived State

| Member         | Description                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `activeIndex`  | `signal(0)` — current zero-based active step index (internal, but readable on the component instance). |
| `_stepList`    | `computed(() => this._steps())` — iterable array for the template `@for` loop.                         |
| `_hostClasses` | `computed(...)` — builds orientation modifier class string.                                            |

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
    grid row via `[style.grid-row]="step._index + 1"`, so the connector stays
    aligned with the label and the active (expanded) panel pushes the following
    step down — preserving the interleaved appearance. Inactive panels use
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
  the active step's `ngTemplateOutlet` inside
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

| Input               | Type                        | Default      | Description                                                                                                                                                                                                                  |
| ------------------- | --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`             | `string`                    | **required** | Step label displayed in the step header.                                                                                                                                                                                     |
| `description`       | `string \| undefined`       | `undefined`  | Optional sub-label shown below the main label.                                                                                                                                                                               |
| `state`             | `MlvStepState \| undefined` | `undefined`  | Explicit state override. When provided, takes precedence over the derived state from the stepper's `activeIndex`.                                                                                                            |
| `optional`          | `BooleanInput` (coerced)    | `false`      | When `true`, shows an "Optional" tag below the label. In linear mode, optional steps can be skipped. Allows attribute usage: `<mlv-step optional>`.                                                                          |
| `deviative`         | `BooleanInput` (coerced)    | `false`      | When `true`, marks this step as a deviative/alternate path. Renders a warning-colored triangle badge on the indicator and a dashed warning connector after the step. Allows attribute usage: `<mlv-step deviative>`.         |
| `deviationResolved` | `BooleanInput` (coerced)    | `false`      | When `true` (and `deviative` is also true), the connector after this step reverts to its normal (solid, neutral) style, indicating the deviation has been addressed. Allows attribute usage: `<mlv-step deviationResolved>`. |

#### Outputs

None.

#### Internal API

| Member       | Type                                                     | Description                                                                                                                                                       |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_index`     | `number`                                                 | Zero-based index assigned by `MlvStepper.ngAfterContentInit`. Do not set this from outside the stepper.                                                           |
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

| Value         | Meaning                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `'pending'`   | Step not yet reached. Neutral styling.                                                              |
| `'active'`    | Currently selected step. Accent-filled indicator, bold label.                                       |
| `'completed'` | Step before the active index (auto-derived), or explicitly overridden. Checkmark icon in indicator. |
| `'error'`     | Explicitly set to indicate a step with an error. Error-colored indicator and label.                 |

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
<mlv-stepper orientation="vertical" aria-label="Order processing steps">
  <mlv-step label="Order placed" state="completed">
    <p>Your order was received on Jan 10.</p>
  </mlv-step>
  <mlv-step label="Processing" state="active">
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

---

## Accessibility

- **Direction (RTL): scoped, not per-document.** A horizontal stepper's `FocusKeyManager` takes `withHorizontalOrientation(this._direction())`, where `_direction` is `elementDirection(host)` — not the global `direction()` — and the manager is rebuilt when it flips. So step headers inside a `[dir="rtl"]` subtree step with `ArrowLeft` = next while the document stays LTR, and an LTR island under an RTL document does not mirror. A vertical stepper takes `withVerticalOrientation()` and is unaffected. `Home` / `End` mean first / last in both directions. Regressions in `stepper.spec.ts` → _scoped [dir] keyboard mirroring_.
- **`aria-required-children` (tablist ⊃ tabs only)** — the `role="tablist"` element's accessible children must all be `role="tab"`; a `role="tabpanel"` is **not** a permitted tablist child (axe flags it as an "unallowed" owned child, a critical `aria-required-children` violation). This is enforced in both orientations:
  - _Horizontal_: the tabpanel is a sibling rendered below the tablist, so it was never inside it.
  - _Vertical_: the tabpanels are rendered in the sibling `div.mlv-stepper__bodies` container (not a descendant of the tablist). The tablist itself uses `display: contents` and directly contains only the per-step indicator columns (bridged with `role="presentation"`) that wrap the tabs. Note plain role-less wrapper divs already "descend transparently" in axe's algorithm — the previous violation was caused solely by the tabpanels being owned by the tablist, which this structure fixes. See the vertical spec (`stepper.spec.ts`) for the axe `aria-required-children` assertion and the structural checks (only tabs owned; no tabpanel inside the tablist; presentation bridges).
- The header container has `role="tablist"`, `tabindex="-1"`, and `[attr.aria-orientation]="orientation()"`. It carries the `(keydown)` handler (`_onHeaderKeydown`) that drives arrow navigation.
- Each step header trigger has `role="tab"`, `[attr.aria-selected]`, `[attr.aria-disabled]`, and a **roving** `[attr.tabindex]` (see below). `aria-current` is intentionally **not** set — the tablist model uses `aria-selected` as the single source of active-step truth.
- **Roving tabindex + arrow-key navigation** (implements the WAI-ARIA tablist pattern):
  - Each `.mlv-stepper__step-header` carries the `[mlvStepHeader]` directive (`MlvStepHeader`, `exportAs: 'mlvStepHeader'`), which implements CDK `FocusableOption` (exposes `focus()`, a `disabled` getter from the `isDisabled` input, and a `tabIndex` signal). The template binds `[attr.tabindex]="sh.tabIndex()"`.
  - `MlvStepper` queries the headers via `viewChildren(MlvStepHeader)` and drives a `FocusKeyManager` (`.withWrap()`, `.withHomeAndEnd()`, `.skipPredicate(h => h.disabled)`, plus `withHorizontalOrientation('ltr')` or `withVerticalOrientation()` depending on `orientation()`). The manager is rebuilt in an `effect()` when the headers or orientation change and torn down via `DestroyRef`.
  - Only the focused/active header has `tabindex="0"`; all others are `-1`. Arrow keys (Left/Right when horizontal, Up/Down when vertical) move focus and the roving tabindex; `Home`/`End` jump to first/last; navigation **wraps**; non-clickable steps (future steps in linear mode) are skipped.
  - Navigation uses **manual activation**: arrows move focus only. `Enter`/`Space` on a focused header call `selectStep()` (`Space` also `preventDefault()`s page scroll). Selecting a step moves the roving tabindex to it via `_keyManager.updateActiveItem()`.
- Content panels have `role="tabpanel"` with `[attr.aria-label]` (horizontal) or `[attr.aria-hidden]` (vertical).
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
