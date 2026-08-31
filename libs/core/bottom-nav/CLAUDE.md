# @malva-ui/bottom-nav

All navigation overflow controls explicitly use `type="button"` to remain
form-safe.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

**Path:** `libs/core/bottom-nav`
**Import path:** `@malva-ui/core/bottom-nav`
**Selector:** `mlv-bottom-nav`

Fixed bottom navigation bar for mobile contexts. Renders up to 5 navigation items as icon + label links. When more than 5 items are provided, the first 4 are shown and the fifth slot becomes a "More" button that opens a menu with the overflow items. Supports two activation modes: router-based (default, uses `routerLink`/`routerLinkActive`) and managed (via `activeIndex` input + `itemClick` output). Items can be individually disabled. Typically paired with `*mlvBreakpointDown="'md'"` to show only on small viewports.

---

## Public API

| Export                        | Kind      | Description                                             |
| ----------------------------- | --------- | ------------------------------------------------------- |
| `MlvBottomNav`                | Component | Mobile bottom navigation bar (`mlv-bottom-nav`)         |
| `MlvBottomNavStacking`        | Type      | `'vertical' \| 'horizontal'` — item layout direction    |
| `MlvBottomNavLabelVisibility` | Type      | `'always' \| 'active-only'` — label visibility strategy |

---

## Components

### `MlvBottomNav`

**File:** `libs/core/bottom-nav/src/lib/bottom-nav/bottom-nav.ts`

- **Selector:** `mlv-bottom-nav`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** `libs/core/bottom-nav/src/lib/bottom-nav/bottom-nav.html`
- **Styles:** `libs/core/bottom-nav/src/lib/bottom-nav/bottom-nav.scss`
- **Host class:** `mlv-bottom-nav`
- **Host role:** `navigation`

#### Inputs

| Name              | Type                          | Required | Default               | Description                                                                                                                                                        |
| ----------------- | ----------------------------- | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `items`           | `MlvNavItem[]`                | ✅       | —                     | Navigation items to display. Up to 5 shown; if more than 5 are provided, first 4 are rendered and a "More" button opens a menu with the overflow items.            |
| `ariaLabel`       | `string`                      |          | `"Bottom navigation"` | Accessible label for the `navigation` landmark.                                                                                                                    |
| `stacking`        | `MlvBottomNavStacking`        |          | `'vertical'`          | Layout direction for icon and label: `'vertical'` (icon above text) or `'horizontal'` (icon beside text, vertically centered).                                     |
| `labelVisibility` | `MlvBottomNavLabelVisibility` |          | `'always'`            | When labels are visible: `'always'` (all items) or `'active-only'` (hidden by default, smoothly revealed on the active item). The "More" label is always visible.  |
| `activeIndex`     | `number`                      |          | `undefined`           | Index of the active item. When provided, activates managed mode: items render as `<button>` instead of `<a routerLink>`, and active class is driven by this index. |

#### Outputs

| Name        | Type                | Description                                                                          |
| ----------- | ------------------- | ------------------------------------------------------------------------------------ |
| `itemClick` | `OutputRef<number>` | Emits the index of the clicked item in managed mode. Not emitted for disabled items. |

#### Protected Properties

| Property         | Type                           | Description                                                          |
| ---------------- | ------------------------------ | -------------------------------------------------------------------- |
| `_isManaged`     | `computed(() => boolean)`      | Whether the component is in managed (non-router) mode.               |
| `_displayItems`  | `computed(() => MlvNavItem[])` | Items rendered as direct nav links. All if ≤ 5, first 4 if overflow. |
| `_overflowItems` | `computed(() => MlvNavItem[])` | Items shown in the "More" menu. Empty if ≤ 5, items 5+ if overflow.  |
| `_hasOverflow`   | `computed(() => boolean)`      | Whether there are overflow items requiring the "More" button.        |

#### Protected Methods

| Method                                        | Description                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `_onItemClick(index: number)`                 | Emits the clicked item's index on `itemClick` (managed mode).                    |
| `_onOverflowItemClick(overflowIndex: number)` | Handles overflow menu item click — emits on `itemClick` or navigates via router. |

#### Host Bindings

| Binding                                     | Value                                  |
| ------------------------------------------- | -------------------------------------- |
| `class`                                     | `mlv-bottom-nav` (always)              |
| `[class.mlv-bottom-nav--horizontal]`        | `stacking() === "horizontal"`          |
| `[class.mlv-bottom-nav--label-active-only]` | `labelVisibility() === "active-only"`  |
| `role`                                      | `navigation`                           |
| `[attr.aria-label]`                         | `ariaLabel() \|\| "Bottom navigation"` |

---

## Template Structure

```
<!-- Inner container is a plain <div>: the host already provides the
     role="navigation" landmark, so a nested <nav> would duplicate it. -->
<div class="mlv-bottom-nav__bar">
  @for (item of _displayItems(); track item.label) {
    <a class="mlv-bottom-nav__item" [routerLink]="item.route"
       routerLinkActive="mlv-bottom-nav__item--active"
       ariaCurrentWhenActive="page" ...>
      <svg class="mlv-bottom-nav__icon" [lucideIcon]="item.icon" ... />
      <span class="mlv-bottom-nav__label">{{ item.label }}</span>
    </a>
  }

  @if (_hasOverflow()) {
    <button class="mlv-bottom-nav__item mlv-bottom-nav__more"
            [mlvMenuTrigger]="overflowMenu" ...>
      <svg class="mlv-bottom-nav__icon" lucideIcon="ellipsis" ... />
      <span class="mlv-bottom-nav__label">More</span>
    </button>

    <mlv-menu #overflowMenu label="More navigation">
      @for (item of _overflowItems(); track item.label) {
        <mlv-list-item mlvMenuItem (itemClick)="_navigateTo(item.route)">
          <svg mlvListItemPrefix [lucideIcon]="item.icon" ... />
          {{ item.label }}
        </mlv-list-item>
      }
    </mlv-menu>
  }
</nav>
```

- The single navigation landmark is the host element (`role="navigation"`). The inner bar is a plain `<div class="mlv-bottom-nav__bar">` — **not** a `<nav>` — to avoid duplicate nested landmarks.
- Regular items are `<a>` elements with `routerLink` and `routerLinkActive`; `ariaCurrentWhenActive="page"` sets `aria-current="page"` on the active route link.
- The "More" button is a `<button>` with `[mlvMenuTrigger]` that opens a `mlv-menu`.
- Overflow menu items use `mlv-list-item[mlvMenuItem]` with programmatic navigation on click.
- Icons use `LucideDynamicIcon` (`[lucideIcon]`) with `aria-hidden="true"`.

---

## CSS Classes (BEM)

| Class                                | Description                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `.mlv-bottom-nav`                    | Host element — fixed bar at bottom of viewport                                                            |
| `.mlv-bottom-nav--horizontal`        | Modifier: horizontal stacking (items in row layout instead of column)                                     |
| `.mlv-bottom-nav--label-active-only` | Modifier: labels hidden by default, revealed on the active item with smooth animation                     |
| `.mlv-bottom-nav__bar`               | Inner flex row (`display: flex; justify-content: space-around`)                                           |
| `.mlv-bottom-nav__item`              | Individual navigation link or button (flex column by default, flex row when horizontal)                   |
| `.mlv-bottom-nav__item--active`      | Applied by `routerLinkActive` (router mode) or `activeIndex` match (managed mode)                         |
| `.mlv-bottom-nav__item--disabled`    | Visually muted (`--mlv-disabled-opacity`) and non-interactive (`pointer-events: none`)                    |
| `.mlv-bottom-nav__more`              | Additional class on the "More" overflow button                                                            |
| `.mlv-bottom-nav__icon`              | Icon wrapper (`display: flex; align-items: center`)                                                       |
| `.mlv-bottom-nav__label`             | Text label (xs font size, no wrap); animated via `max-height`/`max-width` + `opacity` in active-only mode |
| `.mlv-bottom-nav__label--always`     | Forces label to stay visible regardless of `label-active-only` mode (used on "More" button)               |

---

## Interactive States

| State            | Visual feedback                                                  |
| ---------------- | ---------------------------------------------------------------- |
| `:hover`         | `--mlv-background-subtle` background, `--mlv-text-primary` color |
| `:active`        | `--mlv-background-subtle` background, `scale(0.95)` transform    |
| `--active`       | `--mlv-text-action` color (via `routerLinkActive`)               |
| `:focus-visible` | `--mlv-border-focus` outline ring                                |

---

## Design Tokens Used

| Token                          | Usage                                    |
| ------------------------------ | ---------------------------------------- |
| `--mlv-background-raised`      | Bar background                           |
| `--mlv-background-subtle`      | Item hover/pressed background            |
| `--mlv-border-subtle`          | Top border                               |
| `--mlv-stroke-width`           | Top border width                         |
| `--mlv-z-sticky` (`200`)       | Z-index so the bar overlays page content |
| `--mlv-text-secondary`         | Default item color                       |
| `--mlv-text-primary`           | Hovered item color                       |
| `--mlv-text-action`            | Active item color                        |
| `--mlv-radius-m`               | Item border radius (focus/hover shape)   |
| `--mlv-duration-fast`          | Color/background/transform transition    |
| `--mlv-duration-s`             | Label reveal animation duration          |
| `--mlv-ease-default`           | Transition easing                        |
| `--mlv-stroke-width-medium`    | Focus ring width                         |
| `--mlv-border-focus`           | Focus ring color                         |
| `--mlv-font-size-xs`           | Label font size                          |
| `--mlv-line-height-tight`      | Label line height                        |
| `--mlv-typography-family-text` | Font family (via `mixins.base()`)        |
| `--mlv-font-size-m`            | Base font size (via `mixins.base()`)     |
| `--mlv-disabled-opacity`       | Opacity for disabled items               |

The bar uses `padding-bottom: env(safe-area-inset-bottom)` to account for notched devices (iPhone home indicator area).

---

## Usage Examples

```ts
import { MlvBottomNav } from '@malva-ui/core/bottom-nav';
import { MlvBreakpointDown } from '@malva-ui/cdk/utils';
import type { MlvNavItem } from '@malva-ui/cdk/utils';

@Component({
  imports: [MlvBottomNav, MlvBreakpointDown],
})
export class AppShellComponent {
  readonly navItems: MlvNavItem[] = [
    { icon: 'home', label: 'Home', route: '/home' },
    { icon: 'search', label: 'Search', route: '/search' },
    { icon: 'bell', label: 'Alerts', route: '/alerts', badge: 3 },
    { icon: 'settings', label: 'Settings', route: '/settings' },
  ];
}
```

```html
<!-- Show only below md breakpoint (tablet + desktop use sidebar instead) -->
<mlv-bottom-nav *mlvBreakpointDown="'md'" [items]="navItems" ariaLabel="Main navigation" />
```

### Managed mode (no router)

```ts
readonly activeIndex = signal(0);

readonly navItems: MlvNavItem[] = [
  { icon: 'home',     label: 'Home',     route: '' },
  { icon: 'search',   label: 'Search',   route: '' },
  { icon: 'bell',     label: 'Alerts',   route: '', disabled: true },
  { icon: 'settings', label: 'Settings', route: '' },
];
```

```html
<mlv-bottom-nav [items]="navItems" [activeIndex]="activeIndex()" (itemClick)="activeIndex.set($event)" />
```

### Horizontal stacking with active-only labels

```html
<mlv-bottom-nav [items]="navItems" stacking="horizontal" labelVisibility="active-only" />
```

### Overflow (more than 5 items)

```ts
readonly navItems: MlvNavItem[] = [
  { icon: 'home',     label: 'Home',     route: '/home' },
  { icon: 'search',   label: 'Search',   route: '/search' },
  { icon: 'inbox',    label: 'Inbox',    route: '/inbox' },
  { icon: 'calendar', label: 'Calendar', route: '/calendar' },
  { icon: 'bell',     label: 'Alerts',   route: '/alerts' },
  { icon: 'settings', label: 'Settings', route: '/settings' },
  // 6 items → first 4 shown, "More" button opens menu with Alerts + Settings
];
```

---

## Accessibility

- The host element is the sole `role="navigation"` landmark. The inner bar is a `<div>` (not a `<nav>`) so there is exactly one navigation landmark — nested `<nav>` inside a `role="navigation"` host would be a duplicate landmark.
- `aria-label` defaults to `"Bottom navigation"` and can be customized via the `ariaLabel` input.
- The active item is marked with `aria-current="page"`: router-mode links use `RouterLinkActive`'s `ariaCurrentWhenActive="page"`; managed-mode buttons bind `[attr.aria-current]="i === activeIndex() ? 'page' : null"`.
- All icons have `aria-hidden="true"` — the visible `<span>` label provides the accessible name.
- Items have `:hover`, `:active`, and `:focus-visible` visual states for interactive feedback.
- The "More" button has `aria-haspopup="menu"` and `aria-expanded` (via `MlvMenuTrigger`).
- The overflow menu uses `role="menu"` with `mlv-list-item[mlvMenuItem]` (`role="menuitem"`) and full keyboard navigation via `FocusKeyManager`.
- Active state is communicated visually via `--mlv-text-action` color; `RouterLinkActive` also reflects the current route in the link's DOM state.

---

## Internationalization (i18n)

Strings resolve through `MLV_BOTTOM_NAV_I18N` (`@malva-ui/i18n`): `navigation` (landmark `aria-label` fallback when the `ariaLabel` input is unset), `moreOptions` (overflow trigger `aria-label`), `more` (visible overflow-trigger label), and `moreMenu` (overflow `mlv-menu` accessible label). Provide `provideMlvI18nTesting()` in specs.

## Dependencies

- `@angular/core`
- `@angular/router` — `Router`, `RouterLink`, `RouterLinkActive`
- `@lucide/angular` — `LucideDynamicIcon`
- `@malva-ui/cdk/utils` — `MlvNavItem` interface
- `@malva-ui/core/menu` — `MlvMenu`, `MlvMenuItem`, `MlvMenuTrigger`
- `@malva-ui/core/list` — `MlvListItem`, `MlvListItemPrefix`
- `@malva-ui/styles` — design tokens
