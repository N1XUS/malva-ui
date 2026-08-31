# Library: accordion

The internal disclosure trigger explicitly uses `type="button"` to remain
form-safe.

> **Keep this file up to date.** Update this file whenever you change any component, directive, public API, template, styling, or dependency wiring in this library.

## Overview

`@malva-ui/core/accordion` provides a vertically stacked, expandable-section
component built on the **`@angular/aria`** accordion headless pattern
(`AccordionGroup` / `AccordionTrigger` / `AccordionPanel` / `AccordionContent`)
and wrapping the existing **`mlv-expand`** component for the open/close
animation. `mlv-expand` stays standalone — the accordion consumes it, it is not
edited.

- **Leaf project (Nx):** `core-accordion` at `libs/core/accordion`
- **Secondary entry point:** `@malva-ui/core/accordion` (also re-exported from the grouped `@malva-ui/core` barrel)
- **Package tag:** `scope:ui`

## Public API

Exported from `libs/core/accordion/src/index.ts`:

| Symbol               | Kind      | Selector               | Description                                        |
| -------------------- | --------- | ---------------------- | -------------------------------------------------- |
| `MlvAccordion`       | Component | `mlv-accordion`        | Container / group. Coordinates items.              |
| `MlvAccordionItem`   | Component | `mlv-accordion-item`   | A single expandable section (header + panel).      |
| `MlvAccordionHeader` | Directive | `[mlvAccordionHeader]` | Marks projected rich-header content (icons, etc.). |

## Components

### `MlvAccordion` — `mlv-accordion`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Host directive:** `@angular/aria` `AccordionGroup` (applied via `hostDirectives`). This is required so the `ACCORDION_GROUP` DI token the group provides is on the `<mlv-accordion>` host-element injector, where the triggers rendered inside projected `mlv-accordion-item` children can inject it. (Applying the aria group to an inner template element would break that projection DI — verified.)
- **Template:** `<ng-content />` (projects `mlv-accordion-item` children).

#### Inputs (re-exposed verbatim from the aria `AccordionGroup`)

These are forwarded through `hostDirectives` input aliasing — the aria directive owns the roles, keyboard listeners, roving/tab wiring, and `aria-*` attributes; the wrapper does not redeclare them (this avoids the Angular NG0950 "cannot set a host directive's input from host metadata" constraint hit elsewhere in the migration).

| Input             | Type      | aria default | Description                                                                                                             |
| ----------------- | --------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `multiExpandable` | `boolean` | `true`       | Allow multiple panels open at once. `false` = single-expand.                                                            |
| `disabled`        | `boolean` | `false`      | Disable the whole group.                                                                                                |
| `softDisabled`    | `boolean` | `true`       | When `true`, disabled items stay keyboard-focusable but inert; `false` skips them in navigation and hard-disables them. |
| `wrap`            | `boolean` | `false`      | Wrap Arrow navigation from last header to first and vice-versa.                                                         |

#### Methods

| Method          | Description                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `expandAll()`   | Expand every item (only effective when `multiExpandable` is `true`). Delegates to the aria group. |
| `collapseAll()` | Collapse every item.                                                                              |

### `MlvAccordionItem` — `mlv-accordion-item`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Template:** `accordion-item.html`
- **Imports:** aria `AccordionTrigger`/`AccordionPanel`/`AccordionContent`, `MlvExpand` (`@malva-ui/core/expand`), `LucideChevronDown`.

#### Inputs

| Input      | Type                | Default | Description                                                                                                                    |
| ---------- | ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `header`   | `string`            | `''`    | Plain-text header. For rich content, project `[mlvAccordionHeader]` instead.                                                   |
| `disabled` | `boolean` (coerced) | `false` | Disable this item's trigger (`aria-disabled`). Focusability governed by the group's `softDisabled`. Supports attribute syntax. |

#### Model (two-way)

| Model      | Type      | Default | Description                                                                               |
| ---------- | --------- | ------- | ----------------------------------------------------------------------------------------- |
| `expanded` | `boolean` | `false` | `[(expanded)]` two-way; kept in sync with the aria trigger model. Emits `expandedChange`. |

#### Content slots

- **Default slot** → panel content (lazily rendered, see below).
- **`[mlvAccordionHeader]`** → rich header content, rendered inside the trigger button alongside/instead of `header`.

### `MlvAccordionHeader` — `[mlvAccordionHeader]`

Marker directive for projected rich-header content. Exported for consumer import/discoverability; the `<ng-content select="[mlvAccordionHeader]">` slot projects by attribute regardless.

## Key design notes

- **aria + `mlv-expand` composition (reuses the tree-migration learning).** The panel is `<div ngAccordionPanel [preserveContent]="true">` containing `<ng-template ngAccordionContent>` whose body is `<mlv-expand [opened]="expanded()">`. aria's `DeferredContent` renders the template lazily on first expand; `preserveContent=true` (exposed by the panel's `DeferredContentAware` host directive) then keeps it mounted so `mlv-expand`'s grid-row animation is never torn down mid-transition. Collapse hides content through `mlv-expand`'s own `@if (opened())`, not by unmounting the aria panel. Before the first expand, nothing is instantiated (true lazy).
- **Not roving-single-tabbable.** aria's accordion computes each trigger's `tabindex` from `isFocusable` (not the active item), so **every** enabled header is Tab-reachable (`tabindex="0"`); Arrow Up/Down/Home/End provide additional navigation and move DOM focus. This is intentional per the aria pattern (differs from listbox/tabs roving).
- **aria owns** `role="button"` (trigger) / `role="region"` (panel), `aria-expanded`, `aria-controls` ↔ `aria-labelledby` linkage, `inert` on collapsed panels, `aria-disabled`, and the group keydown/click/focusin handling. Single- vs multi-expand is aria's `multiExpandable`.
- **`orientation` is fixed to `vertical`** by the aria accordion group (no horizontal accordion).

## Styling

- BEM blocks `.mlv-accordion` (bordered card container) and `.mlv-accordion-item` (heading button + panel). Chevron rotates 180° via the `.mlv-accordion-item--open` state class. All values use `--mlv-*` tokens; `prefers-reduced-motion` disables the chevron transition.

## Dependencies

- `@angular/aria/accordion` — headless pattern
- `@angular/cdk/coercion` — `coerceBooleanProperty`
- `@lucide/angular` — `LucideChevronDown`
- `@malva-ui/core/expand` — the animated body (consumed, not modified)
- `@malva-ui/styles` — SCSS mixins/tokens

## Tests

`accordion.spec.ts` (13 specs): trigger roles, `aria-controls`/`aria-labelledby` linkage, collapsed/inert + lazy content, click-to-expand + two-way model reflection, single vs multi expand, disabled non-toggle, every-header-tabbable, ArrowDown focus movement, Space/Enter toggle, `expandAll()`/`collapseAll()`, and rich-header (`mlvAccordionHeader`) slot projection.
