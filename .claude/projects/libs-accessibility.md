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

Attaches to any element and unifies mouse click, Enter and Space into a single `mlvClick` output — **one emission per activation** (three documented exceptions under _Activation rule_). This is useful for making non-interactive elements (e.g., `<div>`, `<span>`) behave like buttons for keyboard users without wrapping them in an actual `<button>`.

- **Native hosts: bind `(click)`, not `(mlvClick)`.** A `<button>` already turns Enter and Space into a `click`, an `<a href>` turns Enter into one; the directive adds nothing there but a redundant `role` / `tabindex`.

#### Inputs

| Name       | Type                                  | Default    | Description                                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disabled` | `BooleanInput` (coerced to `boolean`) | `false`    | When `true`, sets `tabindex="-1"` so the element is removed from the tab order. The `mlvClick` output is not suppressed by this flag at the directive level — consumer should gate logic if needed.                                                                                             |
| `hostRole` | `string \| null`                      | `'button'` | ARIA role written to the host. A non-`button` role goes **through this input**, never into a `role` attribute beside the directive. `null` emits no attribute — for a host whose semantics are already native (`<a href>`). A `<button>` should not carry the directive at all: bind `(click)`. |

#### Outputs

| Name       | Type                                            | Description                                                                                                                                                                                       |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mlvClick` | `OutputEmitterRef<MouseEvent \| KeyboardEvent>` | Emits **once** per pointer click, Enter or Space (no modifier). Payload is the browser's `click` where the browser synthesises one from the key, else the `KeyboardEvent` — see _Activation rule_ |

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

#### Activation rule (#299)

- Per keydown the directive reads the element the key was **pressed on** — `event.composedPath()[0]`: the focused element, i.e. the host or a descendant the key bubbled out of — which is where the browser runs activation behaviour except in the three shapes under _Still two emissions_. Not `event.target`: a shadow root retargets that to its host for every outside listener, so a `<button>` inside a web component or a `ViewEncapsulation.ShadowDom` child read as the component (measured: two emissions). An **open** root exposes the real element through `composedPath()`; a closed one does not.
- That element turns the key into its own `click` → the click is the emission; the keydown is left untouched (cancelling it would cancel the browser's activation). Otherwise → the directive emits the `KeyboardEvent`.
- Which targets click is **measured** (Chrome 153, one trusted press per kind): `<button>` Enter + Space (Space on keyup); `input[type=button|submit|reset|image|file|color]` Enter + Space; `input[type=checkbox|radio]` Space only; `<a href>` / `<area href>` Enter only; a `<details>`' first `<summary>` Enter + Space. Nothing else — `<a>` / `<area>` without `href`, the second `<summary>` of an open `<details>`, an orphan `<summary>`, text fields, `<select>`, `<textarea>`, `contenteditable`, `<div>` / `<span>`.
- **Still two emissions** (measured, documented on the class, not handled):
  - a focusable element **inside** a `<button>` host — Chromium activates the button ancestor, not the focused element, so the keydown emits and the button's click emits; Space also scrolls. Invalid markup: a button's content model forbids interactive / `tabindex` descendants.
  - Enter in a text field of a `<form>` wrapped by the host — the keydown emits, then implicit submission clicks the form's submit button and that click bubbles to the host.
  - a native control inside a **closed** shadow root below the host — the root hides its tree from `composedPath()` as well, so the directive sees only the shadow host, emits for the keydown, and the control's click emits again. Pinned by a `click.spec.ts` row that goes red if a change ever sees through it.
- **No emission where the browser clicks nothing:** a native host whose keydown another listener cancels (`preventDefault()` on the target or a bubbling ancestor suppresses activation), and a focused `<button>` that became `disabled`.
- Keyboard-synthesised click payload on a native host: a `PointerEvent` with `detail === 0` (Chromium; a pointer click has `detail >= 1`). `event instanceof KeyboardEvent || event.detail === 0` detects keyboard **or programmatic** origin — a script `el.click()` also carries `detail === 0` (measured). Add `event.isTrusted` to the `detail` test to exclude script clicks: the browser's keyboard click is trusted, `el.click()` is not.
- Read per key press, so a bound `href` / `type` is honoured the moment it changes.
- Space the directive emits for is `preventDefault()`ed — activation must not also scroll the nearest scroller — but only when the element the key was pressed on **is the host** and the host does not own Space (`input`, `textarea`, `select`, `contenteditable`). A descendant's own Space (typing into a nested field, one in the host's own shadow root included) is never cancelled.
- Enter / Space with any modifier (Alt, Ctrl, Meta, Shift) emits nothing — the match the former `keydown.enter` / `keydown.space` listeners got from Angular's key plugin, now `hasModifierKey` from `@angular/cdk/keycodes`.
- Before #299 the directive emitted for the keydown **and** for the click the browser synthesised from it: two emissions per Enter / Space on a native host (pagination Next skipped a page, notification actions ran twice), and Space on a `<div>` host also scrolled. **Breaking, behaviour only** — six consumer-visible shapes with a _Do_ each: [docs/migrations/2026-09-mlv-click-single-activation.md](../../docs/migrations/2026-09-mlv-click-single-activation.md).
- **Unit specs:** jsdom synthesises no click from a key, and neither does a real browser for a script-dispatched (untrusted) keydown. A spec that simulates keyboard activation of a native host must therefore dispatch the `click` itself, as a browser would — see `press()` in `click.spec.ts`.

#### Implementation Notes

- One `fromEvent(host, 'keydown')` stream (filter key + modifiers → filter native activation → cancel consumed Space) merged with `fromEvent(host, 'click')`; `takeUntilDestroyed()` releases both.
- `activatesNatively()` / `ownsSpace()` / `keyOrigin()` are module-private helpers in `click.ts`, not exported.

#### Usage Example

```html
<div mlvClick (mlvClick)="handleAction($event)" [disabled]="disabled">Click or press Enter/Space</div>
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
| `@angular/cdk/keycodes` | (workspace) | `hasModifierKey` used in `MlvClick`                        |
| `rxjs`                  | (workspace) | `fromEvent`, `merge`, `filter`, `tap` used in `MlvClick`   |

This library does **not** depend on any other `@malva-ui/*` library.
