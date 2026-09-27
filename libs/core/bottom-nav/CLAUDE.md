# @malva-ui/bottom-nav

All navigation overflow controls explicitly use `type="button"` to remain
form-safe.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

**Path:** `libs/core/bottom-nav`
**Import path:** `@malva-ui/core/bottom-nav`
**Selector:** `mlv-bottom-nav`

Fixed bottom navigation bar for mobile contexts. Renders up to 5 navigation items as icon + label links. When more than 5 items are provided, the first 4 are shown and the fifth slot becomes a "More" button that opens a menu with the overflow items. Supports two activation modes: router-based (default, uses `routerLink`/`routerLinkActive`) and managed (via `activeIndex` input + `itemClick` output). Items can be individually disabled. Typically paired with `*mlvBreakpointDown="'md'"` to show only on small viewports.

**Overflow parity (#343).** An item moved into the "More" menu keeps the bar's contract:

- `disabled` → the row is a disabled `mlvMenuItem` (`aria-disabled="true"`, skipped by the key manager); no navigation, no `itemClick`.
- `route` → resolved like a bar `routerLink`: `createUrlTree([route], { relativeTo: ActivatedRoute })`, so a relative route resolves under the host's route, `''` is the host's own route, a leading `/` stays absolute, and a `?` / `#` in the string is encoded as a path character, as on a bar link. A failed navigation goes to `ErrorHandler`, as `RouterLink`'s does. `ActivatedRoute` is injected **optionally**: only `provideRouter()` / `RouterModule.forRoot()` provide it (`Router` is root-provided), and managed mode must render with no router providers; `null` resolves from the root.
- current destination → router mode: enabled item whose tree `isActive()` under the bar's own match options (`_activeMatchOptions` — paths + query exact, fragment + matrix ignored), only after the first successful navigation; managed mode: global index `=== activeIndex()`. Then the row carries `aria-current="page"` and the "More" trigger gets `.mlv-bottom-nav__item--active` + `aria-current="true"` (not `"page"` — More is not the page).
- Remaining divergence: rows are `menuitem`s, not links — no `href`, no Ctrl/middle-click new tab (needs an anchor form of `mlvMenuItem`; follow-up).

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

| Name        | Type                | Description                                                                                                                                                           |
| ----------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `itemClick` | `OutputRef<number>` | Managed mode only: emits the clicked item's index in `items` — a "More" row emits its global index. Not emitted for disabled items, in the bar or in the "More" menu. |

#### Protected Properties

| Property              | Type                                 | Description                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_isManaged`          | `computed(() => boolean)`            | Whether the component is in managed (non-router) mode.                                                                                                                                                                           |
| `_displayItems`       | `computed(() => MlvNavItem[])`       | Items rendered as direct nav links. All if ≤ 5, first 4 if overflow.                                                                                                                                                             |
| `_overflowItems`      | `computed(() => MlvNavItem[])`       | Items shown in the "More" menu. Empty if ≤ 5, items 5+ if overflow.                                                                                                                                                              |
| `_hasOverflow`        | `computed(() => boolean)`            | Whether there are overflow items requiring the "More" button.                                                                                                                                                                    |
| `_activeMatchOptions` | `IsActiveMatchOptions`               | `{ paths: 'exact', queryParams: 'exact', fragment: 'ignored', matrixParams: 'ignored' }` — what `{ exact: true }` resolves to; read by the bar's `routerLinkActiveOptions` and by `_overflowActive`, so the two cannot disagree. |
| `_overflowActive`     | `computed(() => readonly boolean[])` | Per overflow item, whether it is the current destination (router: enabled + `isActive()`, after the first successful navigation, trees rebuilt per navigation; managed: global index `=== activeIndex()`).                       |
| `_moreActive`         | `computed(() => boolean)`            | `_overflowActive()` contains `true` — drives More's `--active` + `aria-current="true"`.                                                                                                                                          |

#### Protected Methods

| Method                                        | Description                                                                                                                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_onItemClick(index: number)`                 | Emits the clicked item's index on `itemClick` (managed mode).                                                                                                                                                                                      |
| `_onOverflowItemClick(overflowIndex: number)` | Overflow row activation. Disabled item → nothing. Managed → emits the global index on `itemClick`. Router → `navigateByUrl` of the tree a bar `routerLink` builds (relative to the injected `ActivatedRoute`); a rejection goes to `ErrorHandler`. |

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
  @for (item of _displayItems(); track item.label; let i = $index) {
    @if (!_isManaged() && !item.disabled) {
      <a class="mlv-bottom-nav__item" [routerLink]="item.route"
         routerLinkActive="mlv-bottom-nav__item--active"
         ariaCurrentWhenActive="page"
         [routerLinkActiveOptions]="_activeMatchOptions">
        <svg class="mlv-bottom-nav__icon" [lucideIcon]="item.icon" ... />
        <span class="mlv-bottom-nav__label">{{ item.label }}</span>
      </a>
    } @else {
      <button type="button" class="mlv-bottom-nav__item"
              [class.mlv-bottom-nav__item--active]="_isManaged() && i === activeIndex()"
              [class.mlv-bottom-nav__item--disabled]="!!item.disabled"
              [disabled]="item.disabled || null" ...
              (click)="_onItemClick(i)"> … </button>
    }
  }

  @if (_hasOverflow()) {
    <button type="button" class="mlv-bottom-nav__item mlv-bottom-nav__more"
            [class.mlv-bottom-nav__item--active]="_moreActive()"
            [attr.aria-current]="_moreActive() ? 'true' : null"
            [mlvMenuTrigger]="overflowMenu" [attr.aria-label]="_i18n().moreOptions">
      <svg class="mlv-bottom-nav__icon" lucideIcon="ellipsis" ... />
      <span class="mlv-bottom-nav__label mlv-bottom-nav__label--always">{{ _i18n().more }}</span>
    </button>

    <mlv-menu #overflowMenu [label]="_i18n().moreMenu">
      @for (item of _overflowItems(); track item.label; let j = $index) {
        <mlv-list-item mlvMenuItem
                       [disabled]="!!item.disabled"
                       [attr.aria-current]="_overflowActive()[j] ? 'page' : null"
                       (itemClick)="_onOverflowItemClick(j)">
          <svg mlvListItemPrefix [lucideIcon]="item.icon" ... />
          {{ item.label }}
        </mlv-list-item>
      }
    </mlv-menu>
  }
</div>
```

- The single navigation landmark is the host element (`role="navigation"`). The inner bar is a plain `<div class="mlv-bottom-nav__bar">` — **not** a `<nav>` — to avoid duplicate nested landmarks.
- Regular items are `<a>` elements with `routerLink` and `routerLinkActive`; `ariaCurrentWhenActive="page"` sets `aria-current="page"` on the active route link. Disabled items and every managed-mode item render as `<button type="button">`.
- The "More" button is a `<button>` with `[mlvMenuTrigger]` that opens a `mlv-menu`; it carries `--active` + `aria-current="true"` while the current destination is one of its rows.
- Overflow menu items use `mlv-list-item[mlvMenuItem]`: `[disabled]` from the item, `aria-current="page"` on the current row, activation through `_onOverflowItemClick` (see _Overflow parity_ above).
- Icons use `LucideDynamicIcon` (`[lucideIcon]`) with `aria-hidden="true"`.

---

## CSS Classes (BEM)

| Class                                | Description                                                                                                                                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.mlv-bottom-nav`                    | Host element — fixed bar at bottom of viewport                                                                                                                                                                                                        |
| `.mlv-bottom-nav--horizontal`        | Modifier: horizontal stacking (items in row layout instead of column)                                                                                                                                                                                 |
| `.mlv-bottom-nav--label-active-only` | Modifier: labels hidden by default, revealed on the active item with smooth animation                                                                                                                                                                 |
| `.mlv-bottom-nav__bar`               | Inner flex row (`display: flex; justify-content: space-around`)                                                                                                                                                                                       |
| `.mlv-bottom-nav__item`              | Individual navigation link or button (flex column by default, flex row when horizontal)                                                                                                                                                               |
| `.mlv-bottom-nav__item--active`      | Applied by `routerLinkActive` (router mode) or `activeIndex` match (managed mode); on the "More" button while the current destination is an overflow row                                                                                              |
| `.mlv-bottom-nav__item--disabled`    | Visually muted (`--mlv-disabled-opacity`) and non-interactive (`pointer-events: none`)                                                                                                                                                                |
| `.mlv-bottom-nav__more`              | Additional class on the "More" overflow button                                                                                                                                                                                                        |
| `.mlv-bottom-nav__icon`              | Icon wrapper (`display: flex; align-items: center`)                                                                                                                                                                                                   |
| `.mlv-bottom-nav__label`             | Text label (xs font size, no wrap); animated via `max-height`/`max-width` + `opacity` in active-only mode                                                                                                                                             |
| `.mlv-bottom-nav__label--always`     | Label that stays visible in `label-active-only` mode (the "More" label): the active-only hide rules exclude it with `:not(.mlv-bottom-nav__label--always)`. Before #343 a later override rule lost on specificity, so it was hidden in both stackings |

---

## Interactive States

| State            | Visual feedback                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `:hover`         | `--mlv-background-subtle` background, `--mlv-text-primary` color                                            |
| `:active`        | `--mlv-background-subtle` background, `scale(0.95)` transform                                               |
| `--active`       | `--mlv-text-action` color (via `routerLinkActive`, `activeIndex`, or on "More" for an overflow destination) |
| `:focus-visible` | `--mlv-border-focus` outline ring                                                                           |

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
| `--mlv-duration-fast`          | Label reveal animation duration          |
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
- The active item is marked with `aria-current="page"`: router-mode links use `RouterLinkActive`'s `ariaCurrentWhenActive="page"`; managed-mode buttons bind `[attr.aria-current]="i === activeIndex() ? 'page' : null"`; an overflow row binds it from `_overflowActive()`. While that row is the current one, the "More" trigger carries `aria-current="true"` (current item in this set — not `"page"`, since More is not the page; `aria-current` is a global attribute, allowed on a `button`).
- A disabled item is disabled in the "More" menu too: `aria-disabled="true"` on the `menuitem`, skipped by the menu's key manager, no activation. Chromium 153's AX tree exposes it as `disabled: true` (CDP `Accessibility.getFullAXTree`); CDP has no `current` property, so `aria-current` is asserted on the DOM.
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
- `@angular/router` — `Router`, `ActivatedRoute` (optional), `RouterLink`, `RouterLinkActive`, `isActive`, `IsActiveMatchOptions`. Managed mode needs no router providers.
- `@lucide/angular` — `LucideDynamicIcon`
- `@malva-ui/cdk/utils` — `MlvNavItem` interface
- `@malva-ui/core/menu` — `MlvMenu`, `MlvMenuItem`, `MlvMenuTrigger`
- `@malva-ui/core/list` — `MlvListItem`, `MlvListItemPrefix`
- `@malva-ui/styles` — design tokens
