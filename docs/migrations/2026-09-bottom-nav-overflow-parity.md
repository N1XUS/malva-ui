# 2026-09 — `mlv-bottom-nav` "More" items keep the bar's routing, disabled and active state

Applies to `@malva-ui/core/bottom-nav` (`MlvBottomNav`). Fixes #343.

**Breaking, behaviour only.** No exported symbol, selector, input, output,
injection token, BEM class or i18n key was renamed, removed or retyped.
`MlvNavItem`, `items`, `activeIndex`, `itemClick`, `stacking` and
`labelVisibility` keep their names, types and defaults, and every BEM class
(`.mlv-bottom-nav__label--always` included) is still rendered. What moves is
how an item behaves once it overflows into the "More" menu — past five items,
the bar shows four and puts the rest there.

Split across `VERSIONING.md` § 3:

- **Row 117** (_bug fix that restores documented behaviour_, patch) for three
  halves. `itemClick`'s JSDoc says it is "not emitted for disabled items", and
  `MlvNavItem.disabled` says "non-interactive" — a disabled "More" row emitted
  and navigated. `labelVisibility`'s JSDoc says "The 'More' button label is
  always visible regardless of this setting" — it was hidden in both
  stackings. And the library notes say "the active item is marked with
  `aria-current="page"`" — an active "More" row was not.
- **Row 112** (_changed default behaviour at an unchanged API — ARIA, what a
  value means_, major) for the rest: a "More" row now resolves `route` like a
  bar `routerLink` (relative to the host's route, `''` included, `?` / `#`
  encoded) where it used to call `navigateByUrl(route)`; the "More" trigger
  gains `aria-current="true"` and `.mlv-bottom-nav__item--active` while the
  current destination is one of its rows; and a failed "More" navigation is
  reported to `ErrorHandler` instead of rejecting unhandled.

On the `0.x` line a `!` commit is demoted to a minor: **`0.2.0` → `0.3.0`**
(§ 7). The issue called the change non-breaking; the row-112 halves are
observable at an unchanged API, the split ruled for #329, #323, #216 and #334.

## 1. What changed

Before, the template rendered every overflow item as a plain
`<mlv-list-item mlvMenuItem (itemClick)="…">` and the handler was:

```ts
if (this._isManaged()) {
  this.itemClick.emit(this._displayItems().length + overflowIndex);
} else if (item?.route) {
  this._router.navigateByUrl(item.route);
}
```

So a "More" row ignored `disabled`, parsed `route` as a root-absolute URL
string (the bar's `routerLink` resolves it relative to the host's route), and
had no current state; the "More" trigger never showed that the current page
was behind it. Separately, `bottom-nav.scss` hid labels in `active-only` mode
with `…:not(.mlv-bottom-nav--horizontal) .mlv-bottom-nav__label` — `:not()`
counts its argument, so specificity (0,3,0) — and tried to keep the "More"
label visible with a later `.mlv-bottom-nav--label-active-only
.mlv-bottom-nav__label--always` at (0,2,0), which lost in every browser.

Now:

- **Disabled.** The row binds `[disabled]="!!item.disabled"` on
  `mlvMenuItem`, which renders `aria-disabled="true"`, `tabindex="-1"`, skips
  it in the menu's key manager and emits nothing; `_onOverflowItemClick`
  returns early on a disabled item too.
- **Route.** `_onOverflowItemClick` navigates to
  `router.createUrlTree([item.route], { relativeTo: this._route })`
  — the tree `RouterLink` builds from the same injector — and sends a rejected
  navigation to `ErrorHandler`, as `RouterLink` does. The `ActivatedRoute`
  inject is optional: only `provideRouter()` provides it, and managed mode
  still renders in an app with no router providers (a `null` route resolves
  from the root).
- **Current state.** `_overflowActive` answers, per row, what the bar answers
  for its own items. Router mode: an **enabled** item whose tree
  `isActive()` under the bar's own match options (`_activeMatchOptions`, the
  object `{ exact: true }` resolves to, now shared by both), once the router
  has navigated. Managed mode: the row's global index equals `activeIndex`.
  The current row gets `aria-current="page"`; the "More" trigger gets
  `.mlv-bottom-nav__item--active` and `aria-current="true"` — "current item
  in this set", not `"page"`, because More is not the page.
- **"More" label.** The two hide rules exclude it
  (`.mlv-bottom-nav__label:not(.mlv-bottom-nav__label--always)`) instead of a
  later rule overriding them; the dead override rule is deleted, the class
  stays on the element.

Measured, Chromium 153.0.8010.12, computed style of the "More" label with
`labelVisibility="active-only"` (compiled `bottom-nav.scss`):

| Stacking     | Before                                    | After                                         |
| ------------ | ----------------------------------------- | --------------------------------------------- |
| `vertical`   | `opacity: 0`, `max-height: 0px`, 0px tall | `opacity: 1`, `max-height: none`, 18px tall   |
| `horizontal` | `opacity: 0`, `max-width: 0px`, 0px wide  | `opacity: 1`, `max-width: none`, 34.66px wide |

Inactive and active item labels read the same before and after in both
stackings. jsdom cannot show this — its cascade applies matching rules in
source order and ignores specificity, so the old override read as the winner
there; `bottom-nav-overflow.spec.ts` asserts instead that no collapsing rule
**matches** the "More" label.

Behaviour, six items with Profile (disabled) and Help behind "More", measured
in `bottom-nav-overflow.spec.ts` (routes relative, bar in a component routed
at `/app`):

| Case                                                     | Before                            | After                                                                   |
| -------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Router mode, click Help (`route: 'help'`)                | navigates to `/help`              | navigates to `/app/help` (the bar's `href` for `'home'` is `/app/home`) |
| Router mode, click Profile (`disabled: true`)            | navigates to `/profile`           | nothing; row `aria-disabled="true"`                                     |
| Managed mode, click Profile                              | `itemClick` emits `4`             | nothing                                                                 |
| Router mode at `/app/help`                               | More plain, no row `aria-current` | More `--active` + `aria-current="true"`, Help row `aria-current="page"` |
| Managed mode, `activeIndex` 5                            | More plain, no row `aria-current` | same as above; still exactly one `--active` in the bar                  |
| Router mode at `/app/profile` (disabled item's URL)      | More plain                        | More plain — a disabled item is never router-active, as on the bar      |
| Router mode, "More" route matches no route               | unhandled rejection (`NG04002`)   | reported to `ErrorHandler`; URL unchanged                               |
| Bar in the **root** component, absolute routes (typical) | navigates to the route            | unchanged                                                               |

## 2. Who is affected, and what to do

Only bars with **more than five items** — nothing changes for five or fewer,
including a managed bar in an app with no router providers (pinned by
`bottom-nav-overflow.spec.ts` § _managed mode without router providers_).
In the repository: `apps/docs` bottom-nav example 2 (six items, absolute
routes, router mode) navigates exactly as before; no docs example combines
overflow with `labelVisibility="active-only"`; no `libs/` component renders a
bottom nav except `ssr-smoke.spec.ts` (four items).

**(a) A relative `route` on an item that overflows, with the bar inside a
routed child component.** It used to reach `/<route>` from "More" and
`/<parent>/<route>` from the bar; now both reach the latter. For a bar in the
root component the two resolutions agree and nothing moves.
**Do:** nothing, unless you relied on the root-absolute reading — then write
the route with a leading `/`, which both the bar and "More" keep absolute.

**(b) `route: ''` on an item that overflows, in router mode.** It was a no-op
from "More" (the empty string failed a truthiness guard) while the bar linked
it to the host's route; now "More" navigates there too (`/` for a bar in the
root component).
**Do:** use managed mode (`activeIndex` + `itemClick`) for items that should
not navigate, or give the item its real route.

**(c) A query string or fragment inside `route`** (`'search?q=x'`,
`'/help#faq'`). `navigateByUrl` parsed them from "More"; `routerLink` encodes
`?` and `#` as path characters (`/search%3Fq%3Dx`), and "More" now does the
same. The bar's link was already broken this way.
**Do:** `MlvNavItem.route` is a path; keep query parameters and fragments out
of it. For a destination that needs them, either give it a dedicated route
(`/search/recent` instead of `/search?q=recent`) that the component reads, or
switch the bar to managed mode (`[activeIndex]` + `(itemClick)`) and navigate
yourself: `router.navigate(['/search'], { queryParams: { q: 'x' }, fragment:
'faq' })`, keeping `activeIndex` in step with the router.

**(d) Specs or styles asserting the "More" trigger has no `aria-current` or no
`.mlv-bottom-nav__item--active`, or that no row has `aria-current`,** while
the current item is in the overflow. Both are set now.
**Do:** expect `aria-current="true"` + `--active` on
`.mlv-bottom-nav__more`, and `aria-current="page"` on the matching
`[role="menuitem"]`. A `.mlv-bottom-nav__item--active` count across the bar is
still one.

**(e) Code relying on a disabled overflow item** navigating or emitting
`itemClick` from "More". It no longer does, as it never did from the bar.
**Do:** enable the item, or act on it from somewhere other than the nav.

**(f) A global `unhandledrejection` handler that saw failed "More"
navigations.** They go to `ErrorHandler` now, like the bar's.
**Do:** handle `NavigationError` through the router's events or a custom
`ErrorHandler`.

**(g) Visual baselines of an overflowing bar.** Three things now paint
differently:

- In **every** `labelVisibility`, when the current destination is behind
  "More": the trigger takes the active colour (`--mlv-text-action`, from
  `.mlv-bottom-nav__item--active`), and in the open menu the current row's
  `aria-current="page"` is matched by `mlv-list-item`'s own
  `[aria-current]:not([aria-current='false'])` rule — the selected
  background / foreground pair and the revealed leading bar, as on any
  current list row.
- With `labelVisibility="active-only"`: the "More" label now renders under its
  icon (vertical) or beside it (horizontal), as documented.

Nothing to do beyond the baselines.

## 3. Not changed

- Bars of five items or fewer, and every item in the bar itself — its
  `routerLink`, `routerLinkActive` and managed-mode buttons render as before
  (`[routerLinkActiveOptions]` binds the same options, now through a shared
  constant). Managed mode still needs no router providers.
- The overflow rows are still `role="menuitem"` rows, not links: no `href`, so
  no Ctrl/middle-click into a new tab and no link context menu. An anchor form
  of `mlvMenuItem` is a follow-up.
- Managed-mode active state: a disabled item at `activeIndex` is still marked
  current, in the bar and now in "More".
- i18n keys, `MlvNavItem.badge` (still not rendered — a separate finding).
