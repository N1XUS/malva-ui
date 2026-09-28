---
# Library: expand

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Expand library (`@malva-ui/core/expand`) provides a **headless** `mlv-expand` element component for animated expand/collapse panels. It has no built-in trigger — the consumer provides the button/header and controls the open state via the `[(opened)]` model binding or the `toggle()` method on a template reference variable.

> **Migration (breaking, pre-1.0):** the two-way model was renamed **`open` → `opened`** (and its output **`openChange` → `openedChange`**) for consistency with the other open/close surfaces (`mlv-dialog`, `mlv-drawer`, `mlv-popup`). Update every binding: `[(open)]` → `[(opened)]`, `[open]` → `[opened]`, `(openChange)` → `(openedChange)`, and `templateRef.open()` → `templateRef.opened()`. No deprecated alias is kept. `toggle()` and the `disabled` input are unchanged. The CSS modifier class `mlv-expand--open` is unchanged (only the bound expression changed to `opened()`).

The library supports two content initialization modes:
- **Eager** (default): Content is projected via `ng-content`. It is instantiated with the parent's view, whether or not the panel ever opens.
- **Lazy**: Content is wrapped in `<ng-template mlvExpandContent>`. Nothing inside is constructed until the panel first opens, keeping heavy child components (charts, tables, complex forms) from being initialized until needed.

In **both** modes the body element itself is rendered by `@if (opened())`, so the projected content is attached on open and detached on close — the lazy template is re-instantiated on every open, not cached after the first. The difference between the modes is *when the content is first constructed*, not how long it lives.

Animation uses `animate.enter` / `animate.leave` with CSS `@keyframes` that animate `grid-template-rows: 0fr → 1fr` — no `@angular/animations`, no JS height calculations.

## Public API

Exported from `libs/core/expand/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvExpand` | Component | `mlv-expand` — headless animated panel |
| `MlvExpandContent` | Directive | `[mlvExpandContent]` — marks `<ng-template>` for lazy content |

---

## Components

### `MlvExpand`

**File:** `libs/core/expand/src/lib/expand/expand.ts`
**Selector:** `mlv-expand` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name             | Type                  | Default     | Description                                                                                                                                               |
| ---------------- | --------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opened`         | `model<boolean>`      | `false`     | Two-way bindable open/closed state. Use `[(opened)]="mySignal"` or `[opened]="value"`. Renamed from `open` — see the migration note above.                |
| `disabled`       | `BooleanInput`        | `false`     | When true, `toggle()` is a no-op and the host gets `mlv-expand--disabled`. Supports attribute syntax.                                                     |
| `ariaLabel`      | `string \| undefined` | `undefined` | Accessible name for the body region. When set (or `ariaLabelledBy` is), the body gets `role="region"` plus `aria-label`.                                  |
| `ariaLabelledBy` | `string \| undefined` | `undefined` | Id of a visible element that labels the body region. Preferred over `ariaLabel` when such an element exists; applies `role="region"` + `aria-labelledby`. |

There is **no** `label` input — `mlv-expand` renders no header. The trigger and
its text are entirely the consumer's.

`role="region"` is applied **only** when `ariaLabel` or `ariaLabelledBy` is set:
a region without an accessible name is an axe violation, so the role and its
name are emitted together or not at all.

#### Outputs

| Name           | Type                 | Description                                                                                                      |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `openedChange` | `OutputRef<boolean>` | The `model`'s change output — emits on every state change. Renamed from `openChange`. Not a separate `output()`. |

#### Host Bindings

```ts
host: {
  class: 'mlv-expand',
  '[class.mlv-expand--open]': 'opened()',
  '[class.mlv-expand--disabled]': 'disabled()',
}
```

#### Methods

| Method     | Description                                          |
| ---------- | ---------------------------------------------------- |
| `toggle()` | Toggles open state. No-op when `disabled()` is true. |

#### Template (body)

When `opened()` is true the body is rendered with `animate.enter="mlv-expand__body--enter"` and `animate.leave="mlv-expand__body--leave"`:

```html
@if (opened()) {
<div class="mlv-expand__body" animate.enter="..." animate.leave="..." [attr.inert]="opened() ? null : ''" [attr.role]="ariaLabel() || ariaLabelledBy() ? 'region' : null" [attr.aria-label]="ariaLabel() || null" [attr.aria-labelledby]="ariaLabelledBy() || null">
  <div class="mlv-expand__body-inner">
    @if (_lazyContent(); as lazy) {
    <ng-template [ngTemplateOutlet]="lazy.templateRef" />
    } @else {
    <ng-content />
    }
  </div>
</div>
}
```

**Accessibility — collapsed content is not focusable:** when closed, the body is
removed from the DOM by `@if (opened())`, so its focusable content leaves the tab
order entirely.

> **The `[attr.inert]` binding above is dead code — see [#263](https://github.com/N1XUS/malva-ui/issues/263).** This
> paragraph used to claim that it marks the body `inert` the moment `opened()`
> becomes `false`, covering the `animate.leave` window. It cannot: the binding
> sits inside `@if (opened())`, so its ternary only ever evaluates with
> `opened()` true and the attribute is never written. `animate.leave` does not
> rescue it either — once the `@if` stops matching the embedded view is
> destroyed and stops updating bindings, so the lingering node keeps its last
> value, which was "no attribute". `expand.spec.ts:65` and `:102` assert
> `hasAttribute('inert') === false` **while open**, which passes identically
> with the binding deleted, so nothing gates it today. Whether the leave window
> is reachable at all, and therefore whether the fix is to delete the binding or
> to make the intent work, is #263. Do not cite this as `inert` precedent — the
> real ones are `mlv-sidebar-item`, `mlv-sidebar-group` and `mlv-stepper`.

---

## Directives

### `MlvExpandContent`

**File:** `libs/core/expand/src/lib/expand/expand-content.ts`
**Selector:** `[mlvExpandContent]`

Marks an `<ng-template>` as the lazy content slot. `MlvExpand` detects it via `contentChild(MlvExpandContent)` and renders the template with `ngTemplateOutlet` only while open. Exposes `templateRef: TemplateRef` (injected). No inputs, no outputs, no template context — `mlvExpandContent` takes no value.

---

## Usage Examples

```html
<!-- Template reference + toggle() -->
<button type="button" [attr.aria-expanded]="panel.opened()" (click)="panel.toggle()">Details</button>
<mlv-expand #panel>
  <p>Content</p>
</mlv-expand>

<!-- Two-way binding -->
<button (click)="isOpen.update(v => !v)">Toggle</button>
<mlv-expand [(opened)]="isOpen">
  <p>Content</p>
</mlv-expand>

<!-- Lazy content -->
<button (click)="isOpen.update(v => !v)">Open</button>
<mlv-expand [(opened)]="isOpen">
  <ng-template mlvExpandContent>
    <heavy-chart-component />
  </ng-template>
</mlv-expand>

<!-- Disabled -->
<button disabled>Locked</button>
<mlv-expand disabled>
  <p>Restricted content</p>
</mlv-expand>

<!-- Named body region (role="region" only appears when one of these is set) -->
<h3 id="billing-heading">Billing</h3>
<button type="button" [attr.aria-expanded]="panel.opened()" (click)="panel.toggle()">Details</button>
<mlv-expand #panel ariaLabelledBy="billing-heading">
  <p>Content</p>
</mlv-expand>
```

---

## CSS Animation Technique

The expand/collapse animation uses `grid-template-rows` keyframe interpolation,
with a `translateY` lead-in and **offset timing** so the two properties do not
finish together: on enter the row expands by 70% while the opacity keeps
climbing to 100%; on leave the opacity is gone by 70% while the row keeps
collapsing to 100%. Content therefore never fades in against a still-growing
box, and never disappears while the box has already snapped shut.

```scss
@keyframes mlv-expand--enter {
  0% {
    transform: translateY(-1rem);
    grid-template-rows: 0fr;
    opacity: 0;
  }
  70% {
    transform: translateY(0);
    grid-template-rows: 1fr;
    // opacity unspecified → interpolates 0→1 across the full 100%
  }
  100% {
    grid-template-rows: 1fr;
    opacity: 1;
  }
}

@keyframes mlv-expand--leave {
  0% {
    transform: translateY(0);
    grid-template-rows: 1fr;
    opacity: 1;
  }
  70% {
    transform: translateY(-1rem);
    opacity: 0;
    // grid-template-rows unspecified → interpolates 1fr→0fr across the full 100%
  }
  100% {
    grid-template-rows: 0fr;
    opacity: 0;
  }
}

.mlv-expand__body {
  display: grid;
  overflow: hidden;
  will-change: opacity, grid-template-rows;

  &--enter {
    animation: mlv-expand--enter var(--mlv-duration-slow) var(--mlv-ease-default) forwards;
  }
  &--leave {
    animation: mlv-expand--leave var(--mlv-duration-slow) var(--mlv-ease-default) forwards;
  }

  // Reduced motion: open/close instantly, no height or opacity animation.
  @media (prefers-reduced-motion: reduce) {
    &--enter,
    &--leave {
      animation: none;
    }
  }
}

.mlv-expand__body-inner {
  overflow: hidden;
  min-height: 0; // required for 0fr collapse
}
```

`.mlv-expand--disabled` sets `pointer-events: none` and
`opacity: var(--mlv-disabled-opacity)` — kept on purpose: a headless container
has no surface or ink of its own, only consumer content. Listed on
`OPACITY_ALLOWED` in `scripts/check-disabled-surface.mjs` (#366).

---

## Dependencies

| Package                 | Version   | Role                                    |
| ----------------------- | --------- | --------------------------------------- |
| `@angular/core`         | `^22.0.0` | Signals, DI, component                  |
| `@angular/common`       | `^22.0.0` | `NgTemplateOutlet`                      |
| `@angular/cdk/coercion` | `^22.0.0` | `BooleanInput`, `coerceBooleanProperty` |

---

## File Structure

```
libs/core/expand/src/
  index.ts                                — public API barrel
  lib/
    expand/
      expand.ts                          — MlvExpand
      expand.html                        — template
      expand.scss                        — BEM styles + @keyframes
      expand-content.ts        — MlvExpandContent (lazy mode)
      expand.spec.ts                     — unit tests
```
