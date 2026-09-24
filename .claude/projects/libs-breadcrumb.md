---
# Library: breadcrumb

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

`@malva-ui/core/breadcrumb` provides a navigation breadcrumb component (`nav[mlvBreadcrumb]`) with configurable separator, overflow truncation for long paths, and Angular Router integration.

Selector: `nav[mlvBreadcrumb]` — enhances the native `<nav>` element for proper landmark semantics and accessibility.

**Two usage modes:**
1. **Data-driven** — pass `MlvBreadcrumbEntry[]` via `[items]` input
2. **Projected** — nest `<mlv-breadcrumb-item>` elements (or native `<li mlvBreadcrumbItem>`s) directly inside the `<nav>`; never wrap them in an `<ol>` of your own

---

## Public API

### `MlvBreadcrumb`

**File:** `libs/core/breadcrumb/src/lib/breadcrumb/breadcrumb.ts`
**Selector:** `nav[mlvBreadcrumb]`
**Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name                             | Type                      | Default     | Description                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`                          | `MlvBreadcrumbEntry[]`    | `[]`        | Data-driven list of breadcrumb items. Last item is automatically marked as current.                                                                                                                                          |
| `maxItems`                       | `number`                  | `0`         | Max items to display before truncating, the ellipsis counting as one. `0` = no truncation. Middle items collapse to `…` in trail order — see _Truncation_. Data-driven mode only.                                            |
| `mlvDensity`                     | `MlvDensity \| undefined` | `undefined` | Density for the overflow popover's item list. Forwarded to the overflow `mlv-popup`, which stamps `mlv--{density}` on the detached overlay panel (outside the page's density cascade). Omitted → global `MlvDensityService`. |
| `hideSeparatorFromScreenReaders` | `BooleanInput`            | `true`      | When true, adds `aria-hidden="true"` to separators.                                                                                                                                                                          |

There is **no `separator` input**. The separator is a projected template:
`<ng-template mlvSeparator>` (`MlvBreadcrumbSeparator`) replaces the default
`LucideChevronRight` icon for every gap.

#### Truncation

Collapses when `maxItems > 0` and `items.length > max(maxItems, 2)`. One private
`_split` computed yields both halves (`_visibleItems` / `_hiddenItems` read it),
so the trail and the menu cannot disagree about the cut.

- Trail: first item → `…` → the `maxItems - 3` items just before the current
  page → current page. Nearest ancestors stay visible (likeliest "up" target).
- Menu: the contiguous run between the first item and the first crumb after
  `…`, in trail order. Putting it back where `…` sits restores `items`.
- Floor: first + last always show, so `maxItems` 1–3 all collapse to
  `first › … › last`; `maxItems="1"` with two items shows both.
- Non-integer budgets: slots are whole, so a fractional `maxItems` never shows
  more than it allows (`4.5` → 4 slots); `NaN` truncates nothing.
- Docs example 3 (6 items), `maxItems="4"`: `Home › … › Frontend › Components`,
  menu Organization, Projects, Web Platform. `maxItems="3"`:
  `Home › … › Components`, menu holds the other four.
- Changed in #316 (patch). Two parallel copies of the arithmetic took the
  visible middle from the head and emitted it **after** `…`, so from
  `maxItems="4"` up the trail read out of order:
  `Home › … › Organization › Components`, menu Projects, Web Platform, Frontend.
  Consumer-visible for `maxItems ≥ 4`: the same input now shows different
  crumbs and a different menu (visible middle was the items right after the
  first; now the items right before the current page), and the menu's first
  entry, which takes focus on open, changes with it (Projects → Organization
  in the 6-item example). `maxItems` ≤ 3 is unchanged. Pinned by `breadcrumb.spec.ts` § _collapsed trail order_, over
  `maxItems` −1…8 (plus 3.5, 4.5, 5.5, `NaN`) × length 1…7.
- `maxItems` has no effect in projected mode.

#### Host

| Attribute    | Value            |
| ------------ | ---------------- |
| `class`      | `mlv-breadcrumb` |
| `aria-label` | `'Breadcrumb'`   |

---

### `MlvBreadcrumbItem`

**File:** `libs/core/breadcrumb/src/lib/breadcrumb/breadcrumb-item.ts`
**Selector:** `mlv-breadcrumb-item`
**Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name         | Type                         | Default | Description                                                                                                                                                                                           |
| ------------ | ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routerLink` | `string \| string[] \| null` | `null`  | Angular router link for navigation.                                                                                                                                                                   |
| `href`       | `string \| null`             | `null`  | Raw href for anchor navigation.                                                                                                                                                                       |
| `current`    | `BooleanInput`               | `false` | Marks item as current page; renders as `<span>` with `aria-current="page"`.                                                                                                                           |
| `disabled`   | `BooleanInput`               | `false` | Marks a destination that exists but is **switched off** for this user; renders as a `<span>` with `mlv-breadcrumb__link--disabled`. Not for link-less ancestors — see _Non-interactive crumb states_. |

#### Host

| Attribute | Value                  |
| --------- | ---------------------- |
| `class`   | `mlv-breadcrumb__item` |
| `role`    | `listitem`             |

`role="listitem"` is what keeps the breadcrumb `<ol>` a list in **projected**
mode: the element is projected through the `<ng-content />` that sits inside
that `<ol>`, so its DOM parent is always the list, and without the role the
`<ol>` has non-`<li>` children and stops being exposed as a list at all (axe
`list`, serious, WCAG 1.3.1). `[mlvBreadcrumbItem]` (`MlvBreadcrumbItemHost`)
sets **no** role — it also goes on the `<a>` inside an `<li>`.

#### Separator (#325)

Inside `nav[mlvBreadcrumb]`, every item but the last renders the breadcrumb's
separator after its link, inside its own `listitem` — the same place the
data-driven `<li>` puts it. Before #325 projected mode rendered **none** and
the trail read as one run-on word (`HomeDocumentationBreadcrumb`).

- One template, both modes: `breadcrumb.html` declares `#separator` once
  (`<span class="mlv-breadcrumb__separator">` around the `[mlvSeparator]`
  template or the default chevron, honouring `hideSeparatorFromScreenReaders`);
  the data-driven `@for` and each projected item stamp it.
- Reached through the **internal** `MLV_BREADCRUMB` token
  (`breadcrumb-token.ts`, not exported): `_separatorTemplate` (the
  `viewChild`) and `_lastProjectedItem` (last entry of
  `contentChildren(MlvBreadcrumbItem)`). The item renders the template unless
  it is that last entry.
- Last-ness follows `@for` / `@if` / `<ng-container>` changes: the trailing
  gap moves when the last crumb does.
- Last-ness is **page order**, not creation order: a `track`ed `@for` that
  moves existing crumbs moves the gap with them.
- Lexical: only items **declared directly in the nav's content** — in the same
  template as `<nav mlvBreadcrumb>` — get a separator. Anything else resolves
  no token and is invisible to the content query, so it renders none:
  - an item rendered outside a breadcrumb;
  - one declared elsewhere and stamped in through `ngTemplateOutlet`;
  - **unsupported:** a consumer wrapper component whose template holds the
    `<nav>` and re-projects items through its own `<ng-content>` — those items
    belong to the wrapper's parent template, so the trail renders **zero**
    separators (measured). Give the wrapper an `[items]` input and forward it
    to the data-driven mode, or keep the `<nav mlvBreadcrumb>` in the template
    that declares the items.
- **One shape per trail.** Separators go between `<mlv-breadcrumb-item>`s only
  (the query sees no `<li mlvBreadcrumbItem>`), so an `<li>` after them is not
  separated from the last one (measured: `Home ›`, `Products`, `Leaf`).
- Pinned by `breadcrumb.spec.ts` § _projected separators_.

---

### `MlvBreadcrumbItemHost`

**File:** `libs/core/breadcrumb/src/lib/breadcrumb/breadcrumb-item-host.ts`
**Selector:** `[mlvBreadcrumbItem]`

Stamps `mlv-breadcrumb__item` on a native element; renders nothing, sets no
role. For crumbs whose markup must stay the consumer's own.

- Put it on `<li>`s projected **straight into** `nav[mlvBreadcrumb]`. The
  component renders the `<ol>`; a consumer `<ol>` nests `ol > ol` (axe
  `list`, serious). The old JSDoc and docs example 4 taught that nesting —
  both fixed in #325.
- No automatic separator: the `<li>`'s content is the consumer's, so it
  writes its own `aria-hidden` `.mlv-breadcrumb__separator`.
- One shape per trail — do not follow `<mlv-breadcrumb-item>`s with an `<li>`
  (see § Separator).

```html
<nav mlvBreadcrumb>
  <li mlvBreadcrumbItem>
    <a class="mlv-breadcrumb__link" href="/">Home</a>
    <span class="mlv-breadcrumb__separator" aria-hidden="true">›</span>
  </li>
  <li mlvBreadcrumbItem>
    <span class="mlv-breadcrumb__link mlv-breadcrumb__link--current" aria-current="page">Products</span>
  </li>
</nav>
```

---

### `MlvBreadcrumbEntry` (interface)

**File:** `libs/core/breadcrumb/src/lib/breadcrumb/breadcrumb.types.ts`

```ts
interface MlvBreadcrumbEntry {
  label: string;
  routerLink?: string | string[];
  href?: string;
  disabled?: boolean;
}
```

`disabled` means a destination that exists but is currently unavailable to this
user. An ancestor step that simply has nowhere to navigate to is **not**
disabled — omit `routerLink`, `href` and `disabled`, and it renders as a plain
crumb. See _Non-interactive crumb states_.

---

## CSS Classes

| Class                             | Description                                        |
| --------------------------------- | -------------------------------------------------- |
| `.mlv-breadcrumb`                 | Root block on `<nav>`                              |
| `.mlv-breadcrumb__list`           | The `<ol>` ordered list wrapper                    |
| `.mlv-breadcrumb__item`           | Each crumb: `<li>` / `<mlv-breadcrumb-item>`       |
| `.mlv-breadcrumb__link`           | Link or span inside each item                      |
| `.mlv-breadcrumb__link--current`  | Applied to the current/last item (non-interactive) |
| `.mlv-breadcrumb__link--plain`    | Applied to a link-less, non-current ancestor crumb |
| `.mlv-breadcrumb__link--disabled` | Applied to disabled items                          |
| `.mlv-breadcrumb__separator`      | Separator after every crumb but the last           |
| `.mlv-breadcrumb__ellipsis`       | Ellipsis shown during overflow truncation          |

---

## Non-interactive crumb states

Three states render as text rather than a link, and they are **not**
interchangeable:

| State    | How to express it                                   | Class                             | Meaning                                                      |
| -------- | --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| current  | last `items` entry, or `[current]="true"`           | `.mlv-breadcrumb__link--current`  | The page being viewed. Carries `aria-current="page"`.        |
| plain    | omit `routerLink`, `href`, `current` and `disabled` | `.mlv-breadcrumb__link--plain`    | A grouping ancestor with nowhere to navigate to.             |
| disabled | `disabled: true` / `[disabled]="true"`              | `.mlv-breadcrumb__link--disabled` | A destination that exists but is switched off for this user. |

A plain crumb is deliberately **not** styled as a link: it reads
`--mlv-text-secondary` with no hover underline and no accent colour, because an
accent-coloured, underlining crumb promises a navigation that never happens.

Reaching for `disabled` to express a plain ancestor is the common misuse — it
tells assistive technology the step was switched off, and opts the crumb into
the disabled colour ramp.

---

## Styling contract

| Custom property                   | Default                     | Notes                                                                            |
| --------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `--mlv-breadcrumb-disabled-color` | `var(--mlv-text-secondary)` | Foreground of `--disabled` crumbs, in the trail and in the overflow popup alike. |

Two colour choices are load-bearing for WCAG 2.1 AA and are guarded by
`breadcrumb.spec.ts`:

- **The separator reads `--mlv-text-secondary`, not `--mlv-text-tertiary`.** It
  is a non-text UI element and owes 3:1. Tertiary clears that only in dark
  (3.78:1) and fails in light (2.42:1 on `--mlv-background-base`); secondary
  clears it in both (7.49:1 light / 12.09:1 dark).
- **Disabled crumbs do not read `--mlv-text-disabled`.** That global ramp sits
  at 1.42:1 in light and 2.29:1 in dark against `--mlv-background-base` —
  technically exempt from the contrast minimum as an inactive control, but
  unreadable in a navigation trail. `--mlv-breadcrumb-disabled-color` is the
  escape hatch for an application that deliberately wants the fainter ramp back.

The overflow popup is portaled to the CDK overlay container, outside this
block's DOM subtree, so `--mlv-breadcrumb-disabled-color` cannot cascade into
it — `.mlv-breadcrumb__overflow-link--disabled` repeats the accessible default
as a `var()` fallback.

---

## Accessibility

- `<nav>` host uses native landmark semantics
- `aria-label="Breadcrumb"` on the host nav element
- Last/current item has `aria-current="page"`
- Separators are `aria-hidden="true"` by default, in both modes
- Disabled items are non-interactive `<span>` elements
- Link-less ancestor crumbs render as plain `<span>` elements with no link affordance — see _Non-interactive crumb states_
- Every crumb part clears WCAG 2.1 AA in both themes — see _Styling contract_
- All interactive links have `:focus-visible` outline using `--mlv-border-focus`
- One `<ol>` in both modes: data-driven stamps `<li>`s; projected `<mlv-breadcrumb-item>`s are `role="listitem"`; `<li mlvBreadcrumbItem>`s go straight into it, never inside a consumer `<ol>` (#325)
- Overflow popover focuses the first hidden link when opened
- Overflow popover supports Arrow Up/Down/Left/Right, Home, End, and Escape keyboard navigation
- The popover's horizontal arrows mirror in RTL and resolve their direction from the **breadcrumb's own host** — a cached `elementDirection(host)` signal passed to `normalizeArrowKey(event, direction)` (#147) — which matters twice: the menu renders in a CDK overlay pane portaled to `<body>` and stamped with its own `dir`, and the breadcrumb itself can sit in a `[dir="rtl"]` subtree while the document stays LTR. Arrow Up/Down, Home, End and Escape never mirror

> **`MlvBreadcrumbItem` content projection** — the item template exposes a
> single `<ng-content>` via a shared `#content` `ng-template` that is stamped
> into whichever `@if` branch (`current`/`disabled`/`routerLink`/`href`/plain)
> is active. Declaring a separate `<ng-content>` per branch left the active
> branch empty (Angular projects into the first-declared slot only), which
> rendered projected labels as empty links.
>
> **`list` in projected mode — resolved (#202).** The `<ol>` directly contains
> `<mlv-breadcrumb-item>` custom elements, and axe's `list` rule wants only
> `<li>` children. This was previously an accepted exception on the grounds
> that a standalone item outside a list would be an orphan `listitem`; that
> case is not supported usage: the item is documented and intended only as a
> projected child of `mlv-breadcrumb`, where its DOM parent is always that
> component's own `<ol>`. `MlvBreadcrumbItem` now claims `role="listitem"`,
> which `only-listitems` accepts (`axe-core/axe.js:25846`), and both modes
> sweep clean. Placed outside a list the item would now raise
> `aria-required-parent` instead — `listitem` declares
> `requiredContext: ['list']` (`axe-core/axe.js:14577`) — trading a violation
> that fired under correct use for one that fires only under misuse.

---

## Usage Examples

```html
<!-- Data-driven -->
<nav mlvBreadcrumb [items]="breadcrumbs"></nav>

<!-- Custom separator (both modes) -->
<nav mlvBreadcrumb [items]="breadcrumbs">
  <ng-template mlvSeparator>›</ng-template>
</nav>

<!-- With truncation -->
<nav mlvBreadcrumb [items]="longBreadcrumbs" [maxItems]="4"></nav>

<!-- Projected items with router -->
<nav mlvBreadcrumb>
  <mlv-breadcrumb-item [routerLink]="['/']">Home</mlv-breadcrumb-item>
  <mlv-breadcrumb-item [routerLink]="['/products']">Products</mlv-breadcrumb-item>
  <mlv-breadcrumb-item [current]="true">Widget Pro</mlv-breadcrumb-item>
</nav>

<!-- Grouping ancestors with nowhere to navigate to: omit href/routerLink,
     do NOT use `disabled` -->
<nav mlvBreadcrumb [items]="[{ label: 'Settings' }, { label: 'Personal' }, { label: 'Profile' }]"></nav>

<!-- Projected items with href and a custom separator -->
<nav mlvBreadcrumb>
  <ng-template mlvSeparator>→</ng-template>
  <mlv-breadcrumb-item href="/">Home</mlv-breadcrumb-item>
  <mlv-breadcrumb-item href="/docs">Docs</mlv-breadcrumb-item>
  <mlv-breadcrumb-item [current]="true">Getting Started</mlv-breadcrumb-item>
</nav>
```

---

## Internationalization (i18n)

Strings resolve through `MLV_BREADCRUMB_I18N` (`@malva-ui/i18n`): `label` (the `<nav>` landmark `aria-label`), `hiddenItems` (overflow list `aria-label`), and `showMore` — an ICU plural (`"{count, plural, one {Show # more breadcrumb item} other {Show # more breadcrumb items}}"`) resolved via `MlvI18nResolverService` and exposed as the `_showMoreLabel` computed. Provide `provideMlvI18nTesting()` in specs.

## Dependencies

| Package                 | Version   | Role                                    |
| ----------------------- | --------- | --------------------------------------- |
| `@angular/core`         | `^20.0.0` | Signals, DI, component                  |
| `@angular/router`       | `^20.0.0` | `RouterLink` for router integration     |
| `@angular/cdk/coercion` | `^20.0.0` | `BooleanInput`, `coerceBooleanProperty` |

---

## File Structure

```
libs/core/breadcrumb/src/
  index.ts                                   — public API barrel
  test-setup.ts                              — vitest test setup
  lib/
    breadcrumb/
      breadcrumb.ts               — MlvBreadcrumb (nav[mlvBreadcrumb])
      breadcrumb.html             — template
      breadcrumb.scss             — BEM styles
      breadcrumb-item.ts          — MlvBreadcrumbItem (mlv-breadcrumb-item)
      breadcrumb-item-host.ts     — MlvBreadcrumbItemHost ([mlvBreadcrumbItem])
      breadcrumb-separator.ts     — MlvBreadcrumbSeparator ([mlvSeparator])
      breadcrumb-token.ts         — MLV_BREADCRUMB (internal, not exported)
      breadcrumb.types.ts         — MlvBreadcrumbEntry interface
      breadcrumb.spec.ts          — unit tests
```

---

## Accessibility notes (updated)

- Host now sets an explicit `role="navigation"` (in addition to `aria-label="Breadcrumb"`).
- The overflow ellipsis trigger sets `[ariaHasPopup]="'menu'"` so `aria-haspopup` matches the `role="menu"` overflow list (the popup panel itself is roleless).
