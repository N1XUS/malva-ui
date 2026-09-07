# `mlv-sidebar-trigger` → `[mlvSidebarTrigger]`

**Date:** 2026-09-07
**Status:** breaking

`MlvSidebarTrigger` was a component that rendered its own glyph-only button.
It is now an attribute **directive** that renders nothing: the host element is
the control, so inside the rail the collapse toggle is an ordinary
`mlv-sidebar-item` with an icon and a label like every other row, and outside it
is whatever button the consumer already uses.

The class keeps its name, its file (`sidebar-trigger/sidebar-trigger.ts`) and
its export from `@malva-ui/core/sidebar`. Only the way it is applied changes —
plus the accessible-name contract and the focus-target types below. There is no
deprecated alias: `<mlv-sidebar-trigger />` no longer matches anything and fails
template type-checking.

## Why

Three separate problems, all downstream of the component owning its own chrome:

- **It read as a foreign element.** A glyph-only 36px button sat in a list of
  icon-plus-label rows, with no text at any width, so the one control that
  changes the sidebar's shape was the only one that never said what it does.
- **It could not participate in the row surface.** Hover fill, the active pill,
  density, tooltips, badges, the shared `--mlv-sidebar-row-height` rhythm and
  the container's arrow-key navigation all live on `mlv-sidebar-item`;
  `.mlv-sidebar-trigger__btn` re-derived a subset by hand and drifted.
- **Consumers had to reach through it.** Sizing the button for a touch target
  meant `::ng-deep .mlv-sidebar-trigger__btn` from the page's own stylesheet
  (two showcases did exactly that), because the button lived in a template the
  consumer did not own.

## What changed

| Before                                                                                   | After                                                                                                                              |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `@Component({ selector: 'mlv-sidebar-trigger' })`                                        | `@Directive({ selector: '[mlvSidebarTrigger]', exportAs: 'mlvSidebarTrigger' })`                                                   |
| Rendered `<button class="mlv-sidebar-trigger__btn">` + an icon                           | Renders nothing; the host element is the control                                                                                   |
| Wrote its own `aria-label` from `MLV_SIDEBAR_I18N`                                       | Exposes the same string as `label()`; the **call site** binds it                                                                   |
| `sidebar-trigger.scss` (`.mlv-sidebar-trigger`, `--hidden`, `--menu`, `__btn`, `__icon`) | Deleted — no stylesheet at all                                                                                                     |
| Hidden in `fixed` mode via `.mlv-sidebar-trigger--hidden`                                | Hidden via an inline `style="display: none"` on the host                                                                           |
| `focusTarget: Signal<HTMLButtonElement \| null>`                                         | `focusTarget: Signal<HTMLElement>` — the host, which always exists                                                                 |
| `offcanvasFocusTarget(): HTMLButtonElement \| null`                                      | `offcanvasFocusTarget(): HTMLElement \| null`                                                                                      |
| `restoreFocusResolver: () => true \| HTMLButtonElement`                                  | `restoreFocusResolver: () => true \| HTMLElement`                                                                                  |
| `_collapsed` / `_isDrawerTrigger` / `_isHidden` (protected)                              | Public `collapsed()` / `isDrawerTrigger()` / `isHidden()`, plus `label()` — the call site needs them to pick its own icon and text |

Unchanged: the `sidebar` input, `toggle()` on click, `aria-expanded` on the
host, the fixed-mode hiding _behaviour_, the responsive `collapseBelow`
override, and the four i18n keys (`expand`, `collapse`, `openNavigation`,
`closeNavigation`). Their `MLV_SIDEBAR_I18N_CONTEXT` metadata now reads
`component: '[mlvSidebarTrigger]'` / `usage: 'label'`, because the string is
visible row text in the rail and only an `aria-label` on an icon-only button.

### The name is the call site's now

The directive deliberately does **not** write `aria-label`. Its host is an
element the consumer owns and that usually has its own naming mechanism —
`mlv-sidebar-item` binds `aria-label` from its required `label` input — and two
directives writing the same host attribute is decided by matching order, not by
intent. `label()` hands over the localized string so the visible text and the
accessible name are the same read.

## Migrating

### Inside the sidebar — an ordinary row

```html
<!-- before -->
<mlv-sidebar-trigger />

<!-- after -->
<mlv-sidebar-item mlvSidebarTrigger #collapseTrigger="mlvSidebarTrigger" [label]="collapseTrigger.label()">
  <ng-template mlvSidebarItemIcon>
    @if (collapseTrigger.collapsed()) {
    <svg lucidePanelLeftOpen size="20" />
    } @else {
    <svg lucidePanelLeftClose size="20" />
    }
  </ng-template>
</mlv-sidebar-item>
```

Add `LucidePanelLeftOpen` / `LucidePanelLeftClose` to the component's `imports`
— the directive no longer ships icons.

### Outside the sidebar — the offcanvas menu button

```html
<!-- before -->
<mlv-sidebar-trigger [sidebar]="nav" />

<!-- after -->
<button mlvButton variant="transparent" shape="square" mlvSidebarTrigger #navTrigger="mlvSidebarTrigger" [sidebar]="nav" [attr.aria-label]="navTrigger.label()">
  @if (navTrigger.collapsed()) {
  <svg lucideMenu [size]="20" />
  } @else {
  <svg lucideX [size]="20" />
  }
</button>
```

A sidebar that is a rail at one width and a drawer at another (`mode="icon"` +
`collapseBelow`) branches on `isDrawerTrigger()` to pick between the
hamburger/close pair and the panel pair. A `mode="fixed"` + `collapseBelow`
sidebar does not need the branch: the trigger is hidden above the breakpoint, so
only the drawer form is ever visible.

### Stylesheet overrides

`::ng-deep .mlv-sidebar-trigger__btn` has nothing to select. The host is the
button, so write the rule on the class you put on it:

```scss
// before
&__rail-trigger {
  ::ng-deep .mlv-sidebar-trigger__btn {
    min-inline-size: 2.75rem;
    min-block-size: 2.75rem;
  }
}

// after
&__rail-trigger {
  min-inline-size: 2.75rem;
  min-block-size: 2.75rem;
}
```

### Tests

`querySelector('mlv-sidebar-trigger')` and the `--hidden` / `--menu` class
assertions have no equivalent. Read the host directly:

```ts
expect(trigger.style.display).toBe('none'); // was `--hidden`
expect(directive.isDrawerTrigger()).toBe(true); // was `--menu`
```
