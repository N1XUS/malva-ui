# Rule: Accessibility

All components in this codebase **must** pass AXE checks and meet **WCAG 2.1 AA** minimums. This document defines the patterns for keyboard navigation, tabindex management, ARIA attributes, focus management, and group navigation.

---

## Core Requirements

- **AXE clean** — zero violations from a **full** axe sweep, asserted through the shared helper. See _Asserting It_ below; enforced by `scripts/check-axe-coverage.mjs`.
- **WCAG 2.1 AA** — color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components.
- **Keyboard accessible** — every interactive element reachable and operable via keyboard alone.
- **Semantic HTML first** — use native elements (`<button>`, `<a>`, `<input>`, `<select>`) before adding ARIA. ARIA never overrides native semantics unless intentional.

---

## Asserting It

One helper, one call shape, everywhere:

```ts
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

it('has no axe violations', async () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
});
```

| Export                               | Use                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `expectNoAxeViolations(root, opts?)` | The assertion. Full sweep, every rule minus the two disabled below                       |
| `runAxe(root, opts?)`                | Raw result — only when the spec asserts a violation **is** raised, or needs `incomplete` |
| `formatAxeViolations(violations)`    | The report string, for a spec that builds its own assertion                              |
| `AXE_JSDOM_DISABLED_RULES`           | The centrally disabled rules                                                             |

### What a new component must ship

- **At least one full sweep** over its rendered output. `.claude/rules/angular-component.md`'s checklist is not complete without it.
- **One sweep per state that changes the markup** — open/closed, selected, error, disabled, RTL, a responsive variant. A default-state sweep is not coverage of a panel that only exists while open. If you sweep a project but cannot reach every state in that change, say what is left rather than retiring it: `{ project: 'core-x', owes: ['open panel'] }` (see _Coverage guard_ below) — whether the project is still on `ROLLOUT_PENDING` or already retired with a gap. The guard cannot tell a partial sweep from a complete one, so an unannotated sweep reads as "done".
- **Overlay content**: sweep `document.body` or `document.querySelector('.cdk-overlay-container')`. The pane is portaled out of the fixture, so `fixture.nativeElement` never contains it.
- **A named harness — once you have checked it is only the harness.** A component cannot invent its own name, so an unnamed `<input>` / `role="combobox"` in a test host is usually the host's defect: give it an `aria-label` rather than disabling `label` / `aria-input-field-name`. **Check before you name it.** Grep `apps/docs` and `libs/` for real consumers of the same control that also ship without a name; if any do, name the harness _and_ file the finding — the sweep found something true. Naming the harness without looking is how a live WCAG 4.1.2 defect becomes invisible.
  - Settled 2026-09 (#197), do not re-derive it: `MlvFormField` **does** associate a projected `<mlv-label>` with its control, and `<mlv-form-field><mlv-label>Country</mlv-label><mlv-select …/></mlv-form-field>` is named. The control chooses how, through `_externalLabelStrategy()`: `'native'` — the field resolves the label's `for` onto a labelable element (`mlv-input` unless `projectControl`, `mlv-textarea`, `mlv-number-input`, `mlv-combobox`, `mlv-tokenizer` while enabled, `mlv-color-picker-popup` in `field` presentation, `mlv-title` while `editable`, `mlv-select` while its native `<select>` is live); `'aria'` — the control points `aria-labelledby` at the label (`mlv-select`'s custom trigger, `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker`, `mlv-radio-group`); `'none'` — the base default, no association is emitted at all (never a dangling `for`) and the field warns in dev. Contract: `.claude/projects/libs-form-utils.md` § _`MlvFormField` → Accessible name_.
  - Two residual hazards a harness author still owns. **`'none'` controls** — `mlv-checkbox`, `mlv-switch`, `mlv-slider`, `mlv-pin-input`, `mlv-file-upload`, `mlv-color-picker`, `mlv-segmented`, `mlv-rating`, `mlv-editor` — take no name from a projected `<mlv-label>`, so a field wrapping one is still unnamed; that now warns in dev, and the fix is the control's own `label` / `ariaLabel`, not naming the harness. **Two labels**: a projected `<mlv-label>` plus the control's own `label` input renders both, and on a `'native'` control both `<label for>` point at one element, so the accessible name is their concatenation ("Start Meeting time"); that warns too. A sweep that trips over either has found something true.

### Never

- `expect(results.violations).toEqual([])` — each axe node holds a live `element`, so a failure pretty-prints the component and its injector graph (minutes of CPU). The helper asserts on a short string instead.
- `import axe from 'axe-core'` in a spec — `check-axe-coverage.mjs` fails on it, in `libs/**` and in `apps/**` alike. The one exception is a Playwright suite under a project's own top-level `e2e/`, which injects `axe.source` into a real browser page. A directory named `e2e` anywhere else is not an exception and buys nothing.
- `runOnly: { type: 'rule', values: [...] }` to get a suite green — it asserts nothing about every rule it omits while reading like full coverage.
- Disabling a rule that is failing, without a comment saying so.

### Disabled rules

Central, in `scripts/testing/axe.js`, each with its reason in the source. Only two, and neither is "jsdom limitation":

| Rule             | axe tags        | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color-contrast` | `wcag2aa`       | Never evaluates here — axe reports it **`inapplicable`** under jsdom, so it yields no violation, no pass and no `incomplete` (measured: enabling it leaves `core-table`, `core-select` and `scheduler` green). Off deliberately all the same: every colour in the library is a token and jsdom resolves no `var()`, so `getComputedStyle(el).color` is `''` — a jsdom that grew layout would switch the rule on for every component at once, on colours it still could not read. Checked in the browser pass instead. |
| `region`         | `best-practice` | Judges **page** structure. A spec mounts one component into an empty `<body>`; the landmark around it is the consuming shell's decision.                                                                                                                                                                                                                                                                                                                                                                              |

A third rule firing is a **real finding**. Fix it. Narrow at the call site only when you cannot, and then say which of the two reasons it is — a narrowing whose comment does not settle that is the thing this rule exists to stop:

```ts
await expectNoAxeViolations(root, {
  // NARROWED, not clean: `<rule>` fires on `<selector>` — <reason>.
  // Fixable, deferred: tracked in #NNN.
  rules: { '<rule>': { enabled: false } },
});
```

```ts
await expectNoAxeViolations(root, {
  // NARROWED, not clean: `<rule>` fires on `<selector>` — <reason>.
  // PERMANENT: <why the rule cannot pass a correct implementation>. No issue
  // is owed. (`mlv-scheduler`'s `empty-table-header` is the worked example:
  // the rule's whole check list is `any: ['has-visible-text']`, so a named
  // `columnheader` with an `aria-hidden` subtree can never satisfy it.)
  rules: { '<rule>': { enabled: false } },
});
```

Keep the narrowing no wider than its reason. A sweep parameterised over several states narrows only the states the reason names — see `scheduler.spec.ts`, where the month view has no time grid and sweeps unnarrowed.

### Coverage guard

`scripts/check-axe-coverage.mjs`, run by `nx run @malva-ui/source:test` and covered by `scripts/check-axe-coverage.spec.mjs`. It fails when:

| Finding                               | Meaning                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `uncovered`                           | A `libs/**` project declares an `@Component`/`@Directive` and no spec it owns asserts with axe                |
| `stale-rollout`                       | A `ROLLOUT_PENDING` entry stopped describing its project, names no project, or is malformed                   |
| `stale-exempt`                        | An `EXEMPT` entry gained a sweep, or its `rendersDom` no longer matches reality                               |
| `raw-axe-import`                      | A spec outside a project's own top-level `e2e/` imports `axe-core` directly                                   |
| `walk-error` / `no-sources` / `floor` | The walk saw nothing, so every answer above would be vacuously clean. Asserted before anything is reported OK |

- Coverage, `EXEMPT` and `ROLLOUT_PENDING` are asked of `libs/**` library projects — that is what the issue's acceptance is about. `raw-axe-import` is a rule about how a spec is written, so it is asked of `apps/**` too.
- `EXEMPT` — permanent. A project qualifies only when nothing it emits can change any axe rule's outcome: no element, no ARIA role/attribute/state, no accessible name, no focusability, no interactive semantics — only classes, custom properties, geometry or plain data. "It is a directive" is not a reason: `[mlvClick]` writes `role` and `tabindex`, so it is not exempt.
- `ROLLOUT_PENDING` — temporary (#47 phase 2). Only ever shrinks; **adding an unswept project to it is a regression**. An entry takes one of two shapes, because coverage is not a boolean (#257):
  - `'core-input'` — **nothing swept**. The project must assert with axe nowhere; a sweep appearing is `stale-rollout`.
  - `{ project: 'core-x', owes: ['open panel'] }` — **partially swept**. The author asserts that at least one sweep exists and that the named states have none. Only the first half is checked: the project must have a sweep _somewhere_, and an entry over a project with none is `stale-rollout` the other way. A malformed entry is reported rather than normalizing to nothing.

  **What `owes` does and does not buy.** The guard cannot see states, so it never reads the strings: over a project with at least one sweep, **any** `owes` list is accepted verbatim and forever, and one left behind after the states were swept silences that project permanently. The second direction only catches the case that needs no state knowledge — an `owes` entry over a project with no sweep at all. So `owes` is not verification. What it buys is that the project **stays on the list instead of leaving it**, the gap is named in the source of truth rather than in a doc no guard reads, and the retirement decision gets made later in front of the evidence instead of blind.

  Two moves are **not** the banned addition. Converting an existing entry from the bare shape to the `owes` shape is the same entry saying more, and is the right move whenever your first sweep leaves states unswept. Re-entering a project that already **retired while only partially swept** is also allowed, and must arrive with `owes` naming what is missing — `core-autocomplete` is the worked example (#222 swept four panel states and deleted its line; `.claude/projects/libs-autocomplete.md` recorded a fifth it did not reach). The boundary is the sweep count, not the history: **a project with zero sweeps may never be added, in either shape** — that is the case the ban is about, a covered project that lost its assertion or a new project shipped without one.

  Before #257 one `hasAxe` boolean drove both this rule and `uncovered`, so the **first** sweep forced the line to be deleted: a component whose interactive surface is portaled into a CDK overlay could buy permanent retirement with one closed-state sweep of `fixture.nativeElement`, and the coupling also deterred partial sweeps outright (`core-input`'s `input-native.spec.ts` says so in prose). Deleting the line is still correct once every state that changes the markup has a sweep.

- Coverage means an **import of the helper plus a call to it**, in a spec `nx test` runs — with comments stripped first, so a commented-out call is not a call. A comment mentioning the helper is not coverage, and a directory named `e2e` is not an exemption unless it is the project's own top-level one. Coverage stays a **boolean the guard cannot refine** — it cannot see states, so it counts sweeps and reports them rather than judging them: `node scripts/check-axe-coverage.mjs --json` lists every sweep per project with the root expression it was called with, and a `gained-sweep` finding names the count and roots inline. **The count is the signal; the root is only a hint** — 123 of the 176 sweeps in the workspace today report a bare local identifier (`host` ×64, `root` ×31, `body` ×10), which tells a reviewer nothing on its own. "1 sweep" is the cue to go and look; only a human can say whether a state went unswept. Note also that the count is of **call sites, not states**: one `it.each([...])` call site sweeps several states (`scheduler.spec.ts:770` is three states from two call sites), so it under-reports, which is the safe direction.

### "Full sweep" means every rule that can run here

`axe.getRules()` lists **105** rules in axe-core 4.12.1, of which **96** are enabled by default (9 are deprecated or experimental and ship off). This workspace turns 2 of those 96 off, so **94** are asked of every sweep. Of the 94, however many do not match the markup come back `inapplicable` — `color-contrast` always does, under jsdom. So read a green sweep as "every rule axe would apply to this markup in a default run", not as "all 105 rules pass".

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

| Widget                | Keys                                         | CDK Helper                                                            |
| --------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Radio group           | `ArrowUp` / `ArrowDown`                      | `FocusKeyManager`                                                     |
| Checkbox group        | `ArrowUp` / `ArrowDown`                      | `FocusKeyManager`                                                     |
| Switch group          | `ArrowUp` / `ArrowDown`                      | `FocusKeyManager`                                                     |
| Tab list (horizontal) | `ArrowLeft` / `ArrowRight` (mirrored in RTL) | Manual via `normalizeArrowKey(event, direction)` or `FocusKeyManager` |
| Tab list (vertical)   | `ArrowUp` / `ArrowDown`                      | Manual or `FocusKeyManager`                                           |
| Listbox / dropdown    | `ArrowUp` / `ArrowDown`                      | `CdkListbox`                                                          |
| Menu                  | `ArrowUp` / `ArrowDown`                      | `FocusKeyManager`                                                     |

For `Home` / `End`: jump to first / last item.

Horizontal arrows are **logical**. In RTL, `ArrowLeft` means _next_ and `ArrowRight` means _previous_; vertical arrows, text-caret movement and `aria-keyshortcuts` strings never change. Manual handlers switch on `MlvRtlService.normalizeArrowKey(event, this._direction())` (`@malva-ui/cdk/utils` — returns CDK key-code constants with the horizontal pair swapped in RTL; the second argument is a resolved `MlvDirection`, not an element). **Pass the component's own cached `elementDirection(host)` signal** whenever the handler branches on the horizontal pair: direction is scoped, and without it the helper reads the document — so a handler inside a `dir="rtl"` subtree, or inside a CDK overlay pane, mirrors its layout but not its keys. A horizontal `FocusKeyManager` reads raw key codes internally, so it gets `.withHorizontalOrientation(direction)` from `elementDirection(host)` and is rebuilt when the direction changes. Full contract: `.claude/rules/rtl.md`.

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
