---
# Library: empty-state

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/empty-state` provides a placeholder component (`mlv-empty-state`) for displaying when there is no content to show. It is a pure content-projection component with four named slots: icon/illustration, title, description, and actions. All slots are optional — compose only the ones required for a given use-case. Slots that receive no content automatically collapse via `:empty { display: none }`.

Package import path: `@malva-ui/core/empty-state`

---

## Public API

| Export          | Kind      | Description                                                                     |
| --------------- | --------- | ------------------------------------------------------------------------------- |
| `MlvEmptyState` | Component | Placeholder panel (`mlv-empty-state`) with four named content-projection slots. |

---

## Components

### `MlvEmptyState`

**File:** `libs/core/empty-state/src/lib/empty-state/empty-state.ts`

| Property           | Value              |
| ------------------ | ------------------ |
| Selector           | `mlv-empty-state`  |
| Change Detection   | `OnPush`           |
| View Encapsulation | `None`             |
| Template           | `empty-state.html` |
| Styles             | `empty-state.scss` |

#### Inputs

None. The component is entirely driven by content projection.

#### Outputs

None.

#### Host Bindings

| Binding | Value                                                          |
| ------- | -------------------------------------------------------------- |
| `class` | `'mlv-empty-state'` (static block class)                       |
| `role`  | `'status'` (announces the empty state to assistive technology) |

#### Content Projection Slots

| Attribute selector           | Wrapper element                    | Description                                                                                           |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `[mlvEmptyStateIcon]`        | `div.mlv-empty-state__icon`        | Icon or illustration rendered above the text body. Use Lucide icons or any `<img>` / `<svg>` element. |
| `[mlvEmptyStateTitle]`       | `div.mlv-empty-state__title`       | Short heading text for the empty state.                                                               |
| `[mlvEmptyStateDescription]` | `div.mlv-empty-state__description` | Supporting description text (max-width 28rem, capped for readability).                                |
| `[mlvEmptyStateActions]`     | `div.mlv-empty-state__actions`     | One or more action buttons (e.g. `button[mlvButton]`). Wraps with `flex-wrap`.                        |

Each slot wrapper hides itself with `display: none` when empty, so unused slots do not contribute layout gaps.

The description is **meaningful instructional copy**, so it reads `--mlv-text-secondary` (7.17:1 light / 13.36:1 dark on `--mlv-background-sunken`), not `--mlv-text-tertiary` (2.31:1 / 4.18:1 — both below the 4.5:1 AA floor, and forbidden for meaningful text by `.claude/rules/accessibility.md`). `--mlv-text-tertiary` survives on the icon slot alone, which is decorative. `empty-state.spec.ts` asserts the token and recomputes both ratios from `libs/styles/src/lib/theme.scss`.

#### Template Summary

```html
<div class="mlv-empty-state__icon">
  <ng-content select="[mlvEmptyStateIcon]" />
</div>

<div class="mlv-empty-state__body">
  <div class="mlv-empty-state__title">
    <ng-content select="[mlvEmptyStateTitle]" />
  </div>
  <div class="mlv-empty-state__description">
    <ng-content select="[mlvEmptyStateDescription]" />
  </div>
</div>

<div class="mlv-empty-state__actions">
  <ng-content select="[mlvEmptyStateActions]" />
</div>
```

#### SCSS Structure

```
.mlv-empty-state              — block: flex column, centered, gap 1rem, padding 2rem, text-align center
  &__icon                      — flex center; color: --mlv-text-tertiary; :empty → display:none
  &__body                      — flex column, center, gap 0.5rem; :empty → display:none
  &__title                     — h4-sized heading, font-weight 600, color --mlv-text-secondary; :empty → display:none
  &__description               — body text, color --mlv-text-secondary, max-width 28rem; :empty → display:none
  &__actions                   — flex wrap, centered, gap 0.5rem; :empty → display:none
```

**Design tokens used:**

| Token                          | Where used                        |
| ------------------------------ | --------------------------------- |
| `--mlv-text-tertiary`          | Icon color (decorative only)      |
| `--mlv-text-secondary`         | Title and description color       |
| `--mlv-typography-family-text` | Title and description font family |
| `--mlv-typography-heading-h4`  | Title font size                   |
| `--mlv-font-size-m`            | Description font size             |

---

## Usage Examples

### Minimal — icon and title only

```html
<mlv-empty-state>
  <ng-container mlvEmptyStateIcon>
    <svg lucideInbox [size]="48" />
  </ng-container>
  <span mlvEmptyStateTitle>No items found</span>
</mlv-empty-state>
```

### Full — icon, title, description, and action

```html
<mlv-empty-state>
  <ng-container mlvEmptyStateIcon>
    <svg lucideFolder [size]="48" />
  </ng-container>
  <span mlvEmptyStateTitle>No projects yet</span>
  <span mlvEmptyStateDescription> Create your first project to get started. Projects let you organise your work. </span>
  <ng-container mlvEmptyStateActions>
    <button mlvButton>Create project</button>
    <button mlvButton variant="secondary">Import</button>
  </ng-container>
</mlv-empty-state>
```

### Search / filter empty state

```html
<mlv-empty-state>
  <ng-container mlvEmptyStateIcon>
    <svg lucideSearch [size]="48" />
  </ng-container>
  <span mlvEmptyStateTitle>No results for "{{ searchQuery }}"</span>
  <span mlvEmptyStateDescription>Try different keywords or clear the filter.</span>
  <ng-container mlvEmptyStateActions>
    <button mlvButton variant="secondary" (click)="clearSearch()">Clear search</button>
  </ng-container>
</mlv-empty-state>
```

### Title and actions only (no icon or description)

```html
<mlv-empty-state>
  <span mlvEmptyStateTitle>Nothing here</span>
  <ng-container mlvEmptyStateActions>
    <button mlvButton>Add item</button>
  </ng-container>
</mlv-empty-state>
```

---

## Dependencies

### Angular / third-party

- `@angular/core`

### Internal

- `@malva-ui/styles` (SCSS design tokens referenced in `empty-state.scss`)
- `@malva-ui/core/button` (recommended for action slot content, not a hard dependency)
