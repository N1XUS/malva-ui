# Rule: Accessibility

All components in this codebase **must** pass AXE checks and meet **WCAG 2.1 AA** minimums. This document defines the patterns for keyboard navigation, tabindex management, ARIA attributes, focus management, and group navigation.

---

## Core Requirements

- **AXE clean** — zero violations in automated AXE tests for every component.
- **WCAG 2.1 AA** — color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components.
- **Keyboard accessible** — every interactive element reachable and operable via keyboard alone.
- **Semantic HTML first** — use native elements (`<button>`, `<a>`, `<input>`, `<select>`) before adding ARIA. ARIA never overrides native semantics unless intentional.

---

## Keyboard Navigation Patterns

### Activation (buttons, options, checkboxes, switches, links)

| Key      | Action                                                                     |
| -------- | -------------------------------------------------------------------------- |
| `Enter`  | Activate: click, submit, follow link, select option                        |
| `Space`  | Activate: toggle checkbox/switch, open dropdown, select option (not links) |
| `Escape` | Cancel, close overlay, clear search                                        |

```ts
host: {
  '(keydown.enter)': '!disabled() && activate.emit()',
  '(keydown.space)': '!disabled() && activate.emit(); $event.preventDefault()',
  // Prevent page scroll on Space
}
```

### Tab Navigation

| Key         | Action                                   |
| ----------- | ---------------------------------------- |
| `Tab`       | Move focus to next focusable element     |
| `Shift+Tab` | Move focus to previous focusable element |

Tab navigation moves **between** widgets. Use the roving tabindex pattern (see below) for navigation **within** composite widgets (tabs, radio groups, lists, menus).

### Arrow Key Navigation

Use arrow keys to move focus **within** a composite widget:

| Widget                | Keys                                         | CDK Helper                                          |
| --------------------- | -------------------------------------------- | --------------------------------------------------- |
| Radio group           | `ArrowUp` / `ArrowDown`                      | `FocusKeyManager`                                   |
| Checkbox group        | `ArrowUp` / `ArrowDown`                      | `FocusKeyManager`                                   |
| Switch group          | `ArrowUp` / `ArrowDown`                      | `FocusKeyManager`                                   |
| Tab list (horizontal) | `ArrowLeft` / `ArrowRight` (mirrored in RTL) | Manual via `normalizeArrowKey` or `FocusKeyManager` |
| Tab list (vertical)   | `ArrowUp` / `ArrowDown`                      | Manual or `FocusKeyManager`                         |
| Listbox / dropdown    | `ArrowUp` / `ArrowDown`                      | `CdkListbox`                                        |
| Menu                  | `ArrowUp` / `ArrowDown`                      | `FocusKeyManager`                                   |

For `Home` / `End`: jump to first / last item.

Horizontal arrows are **logical**. In RTL, `ArrowLeft` means _next_ and `ArrowRight` means _previous_; vertical arrows, text-caret movement and `aria-keyshortcuts` strings never change. Manual handlers switch on `MlvRtlService.normalizeArrowKey(event)` (`@malva-ui/cdk/utils` — returns CDK key-code constants with the horizontal pair swapped in RTL). A horizontal `FocusKeyManager` reads raw key codes internally, so it gets `.withHorizontalOrientation(direction)` and is rebuilt when the direction changes. Full contract: `.claude/rules/rtl.md`.

---

## Tabindex Management

### Rules

| Tabindex | When to use                                      |
| -------- | ------------------------------------------------ |
| `0`      | Add element to natural tab order                 |
| `-1`     | Focusable programmatically, but not in tab order |
| `> 0`    | **Never** — do not use positive tabindex values  |

### Roving Tabindex Pattern

For composite widgets (radio groups, tab lists, listboxes), only **one item** is in the tab order at a time. All other items have `tabindex="-1"`. This is the **roving tabindex** pattern.

```ts
// MlvTabItem — only the active tab is tabbable
host: {
  '[attr.tabindex]': 'active() ? 0 : -1',
}

// MlvCheckbox — tabIndex managed by parent FocusKeyManager
host: {
  '[attr.tabindex]': 'tabIndex',   // set by FocusKeyManager: 0 for focused item, -1 for others
}
```

### Disabled Elements

For disabled interactive elements:

- Set `tabindex="-1"` to remove from tab order.
- Set `aria-disabled="true"` (not just the native `disabled` attribute for non-form elements, since native `disabled` on `<div>` etc. has no effect).
- For native `<button>` / `<input>`: set both the native `disabled` attribute AND `aria-disabled`.

```ts
host: {
  '[attr.tabindex]': 'disabled() ? -1 : 0',
  '[attr.disabled]': 'disabled() || null',         // native — removes from form submission
  '[attr.aria-disabled]': 'disabled()',              // ARIA — communicated to screen readers
}
```

---

## ARIA Attributes

### Common Patterns

```ts
// Buttons
host: {
  'role': 'button',
  '[attr.aria-pressed]': 'pressed()',              // toggle buttons
  '[attr.aria-expanded]': 'isOpen()',              // triggers with panel
  '[attr.aria-haspopup]': '"listbox"',             // triggers that open a list
  '[attr.aria-controls]': 'panelId()',             // links trigger to panel
}

// Tab
host: {
  'role': 'tab',
  '[attr.aria-selected]': 'active()',
  '[attr.aria-disabled]': 'disabled() || null',
  '[attr.tabindex]': 'active() ? 0 : -1',
}

// Tabpanel
host: {
  'role': 'tabpanel',
}

// Tablist
// Applied in the template:
// <div role="tablist" [attr.aria-orientation]="orientation()">

// Radiogroup + radio
// <div role="radiogroup" [attr.aria-label]="label()">
//   <input type="radio" [attr.aria-checked]="checked()">

// Listbox + option
// <ul role="listbox"> — use CdkListbox which handles this automatically
//   <li role="option" [attr.aria-selected]="isSelected()">

// Combobox
host: {
  'role': 'combobox',
  '[attr.aria-expanded]': 'isOpen()',
  '[attr.aria-haspopup]': '"listbox"',
  '[attr.aria-autocomplete]': '"list"',
}

// Dialog
host: {
  'role': 'dialog',
  '[attr.aria-modal]': 'true',
  '[attr.aria-labelledby]': 'titleId()',
}

// Progressbar (MlvLoader)
host: {
  'role': 'progressbar',
  '[attr.aria-valuenow]': 'determinate() ? value() : null',
  '[attr.aria-valuemin]': 'determinate() ? 0 : null',
  '[attr.aria-valuemax]': 'determinate() ? max() : null',
  '[attr.aria-label]': 'ariaLabel()',
}
```

### `aria-label` vs `aria-labelledby`

- `aria-label`: inline string label. Use when there is no visible label element.
- `aria-labelledby`: references another element by ID. Use when a visible label element exists.
- Never use both on the same element — `aria-labelledby` takes precedence.

```html
<!-- When no visible label -->
<button mlvButton shape="circle" aria-label="Close dialog">
  <svg lucideX [size]="16" />
</button>

<!-- When a visible heading labels the dialog -->
<div role="dialog" [attr.aria-labelledby]="titleId()">
  <h2 [attr.id]="titleId()">Confirm Delete</h2>
</div>
```

### `aria-live` for Dynamic Content

```html
<!-- Assertive: interrupt screen reader immediately (errors, alerts) -->
<div role="alert" aria-live="assertive">{{ errorMessage() }}</div>

<!-- Polite: announce after user finishes current task (notifications, toasts) -->
<div aria-live="polite">{{ statusMessage() }}</div>
```

---

## FocusKeyManager (CDK)

Use `FocusKeyManager` from `@angular/cdk/a11y` for groups with arrow-key navigation (radio groups, checkbox groups, switch groups, menus).

```ts
import { FocusKeyManager } from '@angular/cdk/a11y';
import { contentChildren, AfterContentInit } from '@angular/core';

// The child component must implement FocusableOption
export class ChildComponent implements FocusableOption {
  tabIndex = -1;
  focus(): void {
    this.elementRef.nativeElement.focus();
  }
}

// The group component sets up FocusKeyManager
export class GroupComponent implements AfterContentInit {
  private readonly items = contentChildren(ChildComponent);
  private _keyManager!: FocusKeyManager<ChildComponent>;

  ngAfterContentInit(): void {
    this._keyManager = new FocusKeyManager(this.items())
      .withVerticalOrientation() // arrow up/down
      .withWrap(); // wraps from last to first

    // Set first item as tabbable (roving tabindex)
    this._keyManager.setFirstItemActive();
  }

  onKeydown(event: KeyboardEvent): void {
    this._keyManager.onKeydown(event);
  }

  // Notify manager when a child receives focus
  onChildFocus(child: ChildComponent): void {
    this._keyManager.setActiveItem(child);
  }
}
```

```html
<!-- Group template — handles keydown events -->
<div role="group" [attr.aria-label]="label()" (keydown)="onKeydown($event)">
  <ng-content />
</div>
```

### Key Combinations to Wire

| Modifier method                   | What it enables                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `.withVerticalOrientation()`      | Arrow Up/Down                                                                             |
| `.withHorizontalOrientation(dir)` | Arrow Left/Right — `dir` from `MlvRtlService`, never a literal `'ltr'`; rebuild on change |
| `.withWrap()`                     | Wrap from last item to first (and vice versa)                                             |
| `.withHomeAndEnd()`               | Home jumps to first, End jumps to last                                                    |
| `.withTypeAhead()`                | Letter keys jump to first item starting with that letter                                  |
| `.skipPredicate(fn)`              | Skip disabled items                                                                       |

---

## CdkListbox (List Selection)

For selectable lists (`mlv-list[selectable]`), use Angular CDK's `CdkListbox` which handles:

- `role="listbox"` + `role="option"` on items
- `aria-selected`
- Arrow key navigation
- Home / End
- Type-ahead

Import `CdkListbox` and `CdkOption` from `@angular/cdk/listbox`.

---

## Focus Management in Overlays

### Opening an overlay (dialog, drawer, popup)

When an overlay opens, move focus inside it:

```ts
// After overlay is rendered:
const firstFocusable = this.tabbableService.getTabbableElement(panelEl, false, true);
firstFocusable?.focus();
```

Use `MlvTabbableElementService` from `@malva-ui/accessibility`.

### Direction of an overlay

A CDK overlay pane is portaled to `<body>`, so it inherits no `[dir]` scope the trigger sits in. Pass `direction: rtlService.resolveDirection(trigger)` on the overlay config, use `start` / `end` (never `left` / `right`) in `ConnectedPosition`s, and for long-lived imperative panes re-mirror with `rtlService.watchDirection(trigger, …)`. See `.claude/rules/rtl.md`.

### Closing an overlay

When an overlay closes, **return focus** to the element that triggered it:

```ts
private _triggerEl: HTMLElement | null = null;

open(trigger: HTMLElement): void {
  this._triggerEl = trigger;
  // ... show overlay, then focus first element inside
}

close(): void {
  // ... hide overlay
  this._triggerEl?.focus();
  this._triggerEl = null;
}
```

### Focus Trapping

Modal dialogs and drawers must trap focus — Tab and Shift+Tab cycle only through focusable elements inside the overlay. Use `MlvTabbableElementService.getTabbableElement()` on keydown to find the first/last tabbable element and redirect focus.

---

## Escape Key for Overlays

Every overlay (dialog, drawer, popup, combobox, dropdown) must close on `Escape`:

```ts
host: {
  '(keydown.escape)': 'close()',
}
// or in template:
// (keydown.escape)="onEscape()"
```

---

## Focus Visible

Never hide `:focus-visible` styles. Use the `--mlv-border-focus` token for focus rings:

```scss
.mlv-my-component {
  &:focus-visible {
    outline: var(--mlv-stroke-width) solid var(--mlv-border-focus);
    outline-offset: 0.125rem;
  }
}
```

Do not use `:focus` alone — `:focus-visible` only shows the ring for keyboard navigation, not mouse clicks. See existing components (button, tab-item, link) for reference.

---

## Icon Buttons and Ambiguous Controls

Every interactive element without visible text label must have an accessible name:

```html
<!-- aria-label on icon buttons -->
<button mlvButton shape="circle" aria-label="Close">
  <ng-template mlvButtonBefore><svg lucideX [size]="16" /></ng-template>
</button>

<!-- aria-label on icon-only inputs -->
<button class="mlv-select__arrow" aria-label="Open options">
  <svg lucideChevronDown [size]="16" />
</button>
```

---

## Color and Contrast

- Normal text (< 18px / < 14px bold): minimum contrast ratio **4.5:1**.
- Large text (≥ 18px / ≥ 14px bold): minimum contrast ratio **3:1**.
- UI components (borders, icons, focus rings): minimum contrast ratio **3:1**.
- Use only `--mlv-*` color tokens — they are pre-validated for contrast in both light and dark themes.
- Never use `--mlv-text-tertiary` (placeholder/disabled text) for meaningful text content.

---

## Semantic HTML Checklist

- Interactive elements: always `<button>` (not `<div>`) for actions, `<a>` for navigation.
- Form fields: always `<input>`, `<select>`, `<textarea>` with associated `<label for="id">`.
- Lists: use `<ul>`/`<ol>` + `<li>` for lists of items.
- Headings: use `<h1>`–`<h6>` hierarchy — do not skip levels.
- Images: `<img>` must have `alt="description"` (or `alt=""` for decorative images).
- Use `<ng-template>` trick only when an extra wrapper element would break semantics.

---

## Accessibility Anti-Patterns to Avoid

```html
<!-- Wrong — div as a button -->
<div class="my-btn" (click)="action()">Click me</div>

<!-- Wrong — missing aria-label on icon button -->
<button (click)="close()"><svg lucideX /></button>

<!-- Wrong — role on wrong element -->
<span role="heading">Title</span>
<!-- use <h2> instead -->

<!-- Wrong — positive tabindex -->
<div tabindex="2">...</div>

<!-- Wrong — suppressing focus styles -->
button:focus { outline: none; }

<!-- Wrong — aria-hidden on focusable element -->
<button aria-hidden="true">Click</button>
```
