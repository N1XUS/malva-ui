---
# Library: accessibility

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The `accessibility` library (`@malva-ui/cdk/accessibility`) provides low-level building blocks for making interactive UI elements accessible. It contains two main exports:

1. `MlvClick` — makes non-button elements respond to keyboard activation (Enter and Space) in addition to mouse clicks, and manages `tabindex` based on a `disabled` state.
2. `MlvTabbableElementService` — a utility service that traverses a DOM subtree to find the first (or last) focusable and tabbable element.

This library is a foundational dependency for other UI libraries that need keyboard interaction or programmatic focus management.

---

## Public API

Exported from `libs/cdk/accessibility/src/index.ts`:

| Export                      | Kind      | Description                                                                      |
| --------------------------- | --------- | -------------------------------------------------------------------------------- |
| `MlvClick`                  | Directive | Adds keyboard click support (Enter/Space) and tabindex management to any element |
| `MlvTabbableElementService` | Service   | Finds the first/last tabbable element in a DOM subtree                           |

---

## Directives

### `MlvClick`

**File:** `libs/cdk/accessibility/src/lib/click.ts`

**Selector:** `[mlvClick]`

Attaches to any element and unifies mouse click, Enter keydown, and Space keydown into a single `mlvClick` output. This is useful for making non-interactive elements (e.g., `<div>`, `<span>`) behave like buttons for keyboard users without wrapping them in an actual `<button>`.

#### Inputs

| Name       | Type                                  | Default    | Description                                                                                                                                                                                                                             |
| ---------- | ------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled` | `BooleanInput` (coerced to `boolean`) | `false`    | When `true`, sets `tabindex="-1"` so the element is removed from the tab order. The `mlvClick` output is not suppressed by this flag at the directive level — consumer should gate logic if needed.                                     |
| `hostRole` | `string \| null`                      | `'button'` | ARIA role written to the host. A non-`button` role goes **through this input**, never into a `role` attribute beside the directive. `null` emits no attribute — for a host whose semantics are already native (`<a href>`, `<button>`). |

#### Outputs

| Name       | Type                                            | Description                                            |
| ---------- | ----------------------------------------------- | ------------------------------------------------------ |
| `mlvClick` | `OutputEmitterRef<MouseEvent \| KeyboardEvent>` | Emits on native click, Enter keydown, or Space keydown |

#### Host Bindings

```ts
host: {
  '[attr.tabindex]': 'disabled() ? -1 : 0',
  '[attr.role]': 'hostRole() || null',
}
```

- `tabindex` is dynamically set to `0` (focusable) when not disabled, or `-1` (removed from tab order) when disabled.
- `role` comes from `hostRole` and **beats a static `role` attribute** written beside the directive.
- Against a **component's own `[attr.role]`** on the same host there is no fixed precedence. Each host binding is dirty-checked against its own previous value and writes only on a pass where that value changed; the directive's bindings merely run after the component's, so `hostRole` wins a same-pass **tie**. First render is always such a tie — which is why the `'button'` default silently replaces the component's role, and why `[hostRole]="null"` _removes_ the attribute rather than handing the role back. On a later pass where only the component's expression changed, the component writes and the **component** wins (`MlvSidebarItem._hostRole` is a `computed()` that flips `null` / `'menuitem'` / `'button'` — exactly that shape).
- So: co-hosting on a component that owns `[attr.role]` means writing the same role through **both** bindings, the only arrangement that is order- and timing-independent. `mlv-drawer-sections` needs `itemRole="menuitem" [hostRole]="'menuitem'"` on its `mlv-list-item` rows, because `itemRole` alone resolved to `role="button"` inside a `role="menu"` list (#223). Pinned by `click.spec.ts`, whose fourth row changes the component's role after first render.

#### Implementation Notes

- Uses `Renderer2` to attach `keydown.enter` and `keydown.space` listeners (Angular's shorthand key event syntax), which are cleaned up via `DestroyRef.onDestroy`.
- Uses `fromEvent` for the native click stream and merges all three streams with RxJS `merge`.
- Cleans up subscriptions and completes Subjects on destroy.

#### Usage Example

```html
<div [mlvClick] (mlvClick)="handleAction($event)" [disabled]="disabled">Click or press Enter/Space</div>
```

---

## Services

### `MlvTabbableElementService`

**File:** `libs/cdk/accessibility/src/lib/tabbable-element.service.ts`

**Provided in:** `root` (singleton)

A utility service for finding focusable/tabbable elements within a DOM subtree. Used internally by other libraries (e.g., dialog, drawer, popup) for focus trapping and focus restoration.

#### Dependencies (injected)

| Token                                        | Description                                            |
| -------------------------------------------- | ------------------------------------------------------ |
| `InteractivityChecker` (`@angular/cdk/a11y`) | Checks whether an element is focusable and tabbable    |
| `DOCUMENT`                                   | Injected optionally for `ELEMENT_NODE` constant access |

#### Public Methods

##### `getTabbableElement(root, focusLastElement?, skipSelf?): HTMLElement | null`

Traverses a DOM subtree in DOM order (or reverse order when `focusLastElement` is `true`) and returns the first element that is both focusable and tabbable according to `InteractivityChecker`.

| Parameter          | Type          | Default | Description                                                                          |
| ------------------ | ------------- | ------- | ------------------------------------------------------------------------------------ |
| `root`             | `HTMLElement` | —       | The root element from which to begin the search                                      |
| `focusLastElement` | `boolean`     | `false` | When `true`, traverses children in reverse order to find the _last_ tabbable element |
| `skipSelf`         | `boolean`     | `false` | When `true`, skips checking `root` itself and only checks its descendants            |

**Returns:** The first (or last) tabbable `HTMLElement` found, or `null` if none exists.

#### Usage Example

```ts
import { MlvTabbableElementService } from '@malva-ui/cdk/accessibility';

@Component({ ... })
export class MyComponent {
  private tabbable = inject(MlvTabbableElementService);

  focusFirstInPanel(panelEl: HTMLElement): void {
    const el = this.tabbable.getTabbableElement(panelEl, false, true);
    el?.focus();
  }
}
```

---

## Dependencies

| Dependency              | Version     | Notes                                                      |
| ----------------------- | ----------- | ---------------------------------------------------------- |
| `@angular/core`         | ^22.0.0     | peer dependency                                            |
| `@angular/common`       | ^22.0.0     | peer dependency                                            |
| `@angular/cdk/a11y`     | (workspace) | `InteractivityChecker` used in `MlvTabbableElementService` |
| `@angular/cdk/coercion` | (workspace) | `BooleanInput`, `coerceBooleanProperty` used in `MlvClick` |
| `rxjs`                  | (workspace) | `fromEvent`, `merge`, `Subject` used in `MlvClick`         |

This library does **not** depend on any other `@malva-ui/*` library.
