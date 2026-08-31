---
# Library: link

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/link` provides a styled hyperlink component applied as an attribute selector on native `<a>` elements. It supports three visual variants (`default`, `subtle`, `emphasized`), a disabled state with full accessibility (ARIA attributes, tab-order removal, click prevention), and uses `ViewEncapsulation.None` with BEM classes for styling.

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

| Name       | Type             | Default     | Description                                                                                                             |
| ---------- | ---------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `variant`  | `MlvLinkVariant` | `'default'` | Visual style variant: `'default'` (action color), `'subtle'` (secondary text color), `'emphasized'` (bold + underline). |
| `disabled` | `boolean`        | `false`     | When `true`, prevents navigation, sets `aria-disabled="true"`, removes from tab order, and applies disabled opacity.    |

#### Outputs

None.

#### Host Bindings

| Binding                      | Expression                              | Description                                                             |
| ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `class`                      | `'mlv-link'`                            | Static base BEM block class always applied.                             |
| `[class]`                    | `'"mlv-link--" + variant()`             | Applies the variant modifier, e.g. `mlv-link--default`.                 |
| `[class.mlv-link--disabled]` | `disabled()`                            | Adds disabled modifier when `disabled` is `true`.                       |
| `[attr.aria-disabled]`       | `disabled() \|\| null`                  | Sets `aria-disabled="true"` when disabled; removes attribute otherwise. |
| `[attr.tabindex]`            | `disabled() ? -1 : null`                | Removes element from tab order when disabled.                           |
| `(click)`                    | `disabled() && $event.preventDefault()` | Prevents browser navigation when disabled.                              |

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

| Dependency         | Source          | Usage                                                                |
| ------------------ | --------------- | -------------------------------------------------------------------- |
| `@angular/core`    | External (peer) | `Component`, `ChangeDetectionStrategy`, `ViewEncapsulation`, `input` |
| `@malva-ui/styles` | Workspace lib   | SCSS mixins (`mixins.base()`) and design tokens                      |
