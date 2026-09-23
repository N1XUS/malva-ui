---
# Library: link

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/link` provides a styled hyperlink component applied as an attribute selector on native `<a>` elements. It supports three visual variants (`default`, `subtle`, `emphasized`), a disabled state with full accessibility (ARIA attributes, tab-order removal, a capture-phase activation guard that also stops `routerLink`), and uses `ViewEncapsulation.None` with BEM classes for styling.

## Public API

| Export | Kind | Description |
|--------|------|-------------|
| `MlvLink` | Component | Styled link applied via `a[mlvLink]` attribute selector. |
| `MlvLinkVariant` | Type alias | `'default' \| 'subtle' \| 'emphasized'` |

---

## Components

### `MlvLink`

**File:** `libs/core/link/src/lib/link/link.ts`
**Selector:** `a[mlvLink]`
**Change Detection:** `ChangeDetectionStrategy.OnPush`
**Encapsulation:** `ViewEncapsulation.None`
**Template:** Inline — single `<ng-content />` slot. All visual rendering is done via host bindings on the native `<a>` element.
**Stylesheet:** `libs/core/link/src/lib/link/link.scss`

#### Inputs

| Name       | Type             | Default     | Description                                                                                                                                                          |
| ---------- | ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`  | `MlvLinkVariant` | `'default'` | Visual style variant: `'default'` (action color), `'subtle'` (secondary text color), `'emphasized'` (bold + underline).                                              |
| `disabled` | `boolean`        | `false`     | When `true`, blocks activation (see _Disabled activation guard_), sets `aria-disabled="true"`, removes from tab order, and applies disabled opacity. `href` is kept. |

#### Outputs

None.

#### Host Bindings

| Binding                      | Expression                  | Description                                                             |
| ---------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `class`                      | `'mlv-link'`                | Static base BEM block class always applied.                             |
| `[class]`                    | `'"mlv-link--" + variant()` | Applies the variant modifier, e.g. `mlv-link--default`.                 |
| `[class.mlv-link--disabled]` | `disabled()`                | Adds disabled modifier when `disabled` is `true`.                       |
| `[attr.aria-disabled]`       | `disabled() \|\| null`      | Sets `aria-disabled="true"` when disabled; removes attribute otherwise. |
| `[attr.tabindex]`            | `disabled() ? -1 : null`    | Removes element from tab order when disabled.                           |

No host listeners — deliberately (#309):

- No `(click)`: a host listener cannot stop `RouterLink` (Angular coalesces every host/template listener for one event on one element into one native listener and walks the chain unconditionally), and an expression evaluating to `false` makes Angular `preventDefault()` the event. The old `disabled() && $event.preventDefault()` did both: it let a disabled `routerLink` navigate, and — evaluating to `false` while enabled — `preventDefault()`ed every click, Enter and Space keydown on an **enabled** link, so a plain `href` never followed on click and Enter activated no link at all, `routerLink` included.
- No `(keydown.enter)` / `(keydown.space)`: the host is a native `<a>`. With an `href` the browser turns Enter into the `click` the guard sees; without one Enter activates nothing. Space is not link activation (it scrolls, disabled or not). See `.claude/rules/angular-directive.md` (#299).
- Shipped as breaking behaviour (`fix(link)!`): an enabled link now follows its `href` on click and Enter, so an `href="#"` pseudo-button navigates to `#`. Consumer shapes and the **Do:** for each: [docs/migrations/2026-09-link-native-activation.md](../../docs/migrations/2026-09-link-native-activation.md). Use `button[mlvButton]` for an action.

#### Disabled activation guard

A `fromEvent(host, 'click', { capture: true })` stream, subscribed in the constructor, released by `takeUntilDestroyed()`. While `disabled()` (read per click) it calls `preventDefault()` + `stopImmediatePropagation()`.

- Capture at `AT_TARGET` runs before every bubble listener on the anchor whatever the registration order, and before the target for a click on the inner text span. Same pattern as the `mlv-segmented` link item.
- Blocks: native `href` navigation (plain, `target="_blank"`, Ctrl/Shift/Meta + click or Enter), `RouterLink.onClick` (which never reads `defaultPrevented`), the consumer's own `(click)`, a co-hosted `[mlvClick]`'s **click** emission, and bubble-phase click listeners on ancestors. Ancestor **capture** listeners (CDK/popup click-outside) run before it and are unaffected.
- Does not block: keydown listeners (a co-hosted `[mlvClick]` still emits on Enter / Space for an `href`-less link — gate in the handler, as `mlv-filter`'s clear link does), and the browser **context menu** — "Open in new tab" / "Copy link address" read `href` and dispatch no `click`. By pointer the menu and middle-click (`auxclick`) are stopped by `pointer-events: none`. But a link focused **before** it became disabled keeps focus (`tabindex="-1"` does not blur), and the Menu key or Shift+F10 opens its context menu; so do screen-reader context-menu commands, on any disabled link. Closing that needs `href` gone — see the last bullet.
- Pointer clicks never reach the anchor anyway (`.mlv-link--disabled` sets `pointer-events: none`); the guard is for screen-reader activation, `el.click()`, and Enter on a link that holds focus (focused before it was disabled, or programmatically).
- **`href` is kept while disabled**, measured (#309). The deciding reason is `RouterLink`'s own `[attr.href]` host binding: host bindings on one element have no fixed precedence — the last **changed** value wins — so an `[attr.href]` removal from `MlvLink` won the first render, then `RouterLink` rewrote the attribute on the next URL change (measured with a relative `queryParamsHandling="preserve"` link), leaving a disabled link holding an `href` the component believed removed. That is also why `role="link"` on an `href`-less disabled anchor was considered and **rejected**: it is correct only while the removal holds, and `RouterLink` undoes it. Dropping `href` would not stop the router either (`RouterLink.onClick` navigates without one), and one behaviour for every disabled link beats a split keyed on whether `routerLink` is co-hosted. axe does not decide it: axe-core 4.12.1 raises 0 violations with or without `href` (it treats `aria-disabled` as global).

#### Content Children / View Children

None.

#### Key Methods

None — the component is purely declarative.

---

## Directives

None.

---

## Services

None.

---

## Interfaces & Types

### `MlvLinkVariant`

```typescript
export type MlvLinkVariant = 'default' | 'subtle' | 'emphasized';
```

| Value          | Description                                             |
| -------------- | ------------------------------------------------------- |
| `'default'`    | Standard action-color link using `--mlv-text-action`.   |
| `'subtle'`     | Muted secondary-text link using `--mlv-text-secondary`. |
| `'emphasized'` | Bold + underlined link inheriting action color.         |

---

## Injection Tokens

None.

---

## Styles

**File:** `libs/core/link/src/lib/link/link.scss`

Uses `ViewEncapsulation.None` — BEM class names provide style isolation. Imports `@malva-ui/styles` mixins via `@use "../../../../styles/src/lib/mixins" as mixins`.

| BEM Class                 | Description                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `.mlv-link`               | Block — base styles: `color: var(--mlv-text-action)`, no underline, pointer cursor, color transition. Applies `mixins.base()`. |
| `.mlv-link:hover`         | Hover state — `color: var(--mlv-text-action-hover)`, underline applied.                                                        |
| `.mlv-link:focus-visible` | Focus-visible state — same as hover (color + underline).                                                                       |
| `.mlv-link--default`      | Modifier — default variant (inherits block color).                                                                             |
| `.mlv-link--subtle`       | Modifier — `color: var(--mlv-text-secondary)`; hover uses `var(--mlv-link-subtle-hover-color, #333)`.                          |
| `.mlv-link--emphasized`   | Modifier — `font-weight: 600`, `text-decoration: underline`.                                                                   |
| `.mlv-link--disabled`     | Modifier — `cursor: not-allowed`, `pointer-events: none`, `opacity: var(--mlv-disabled-opacity)`.                              |

**CSS custom properties consumed:**

| Token                           | Usage                                         |
| ------------------------------- | --------------------------------------------- |
| `--mlv-text-action`             | Base link color.                              |
| `--mlv-text-action-hover`       | Hover/focus-visible link color.               |
| `--mlv-text-secondary`          | Subtle variant color.                         |
| `--mlv-link-subtle-hover-color` | Subtle variant hover color (fallback `#333`). |
| `--mlv-disabled-opacity`        | Opacity for disabled state.                   |
| `--mlv-duration-normal`         | Transition duration.                          |
| `--mlv-ease-default`            | Transition easing function.                   |

---

## Usage Examples

### Import

```typescript
import { MlvLink } from '@malva-ui/core/link';
import type { MlvLinkVariant } from '@malva-ui/core/link';
```

### Basic usage

```html
<!-- Default variant -->
<a mlvLink href="/docs">Read the docs</a>

<!-- Subtle variant -->
<a mlvLink href="/about" [variant]="'subtle'">About us</a>

<!-- Emphasized variant -->
<a mlvLink href="/signup" [variant]="'emphasized'">Sign up free</a>

<!-- Disabled -->
<a mlvLink href="/premium" [disabled]="true">Premium (unavailable)</a>
```

### In a component

```typescript
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvLink } from '@malva-ui/core/link';
import type { MlvLinkVariant } from '@malva-ui/core/link';

@Component({
  selector: 'my-component',
  imports: [MlvLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a mlvLink href="/home">Home</a>
    <a mlvLink href="/settings" [variant]="linkVariant()" [disabled]="disabled()">Settings</a>
  `,
})
export class MyComponent {
  linkVariant = signal<MlvLinkVariant>('emphasized');
  disabled = signal(false);
}
```

### Router link

```html
<a mlvLink routerLink="/dashboard" [variant]="'subtle'">Dashboard</a>
```

---

## Dependencies

| Dependency         | Source          | Usage                                                                                                                                                |
| ------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@angular/core`    | External (peer) | `Component`, `ChangeDetectionStrategy`, `ViewEncapsulation`, `input`, `inject`, `ElementRef`; `takeUntilDestroyed` from `@angular/core/rxjs-interop` |
| `rxjs`             | External (peer) | `fromEvent` + `filter` for the disabled activation guard                                                                                             |
| `@malva-ui/styles` | Workspace lib   | SCSS mixins (`mixins.base()`) and design tokens                                                                                                      |
