# 2026-09 — the submenu safe triangle covers the diagonal, on either side

Applies to `@malva-ui/core/menu` — every submenu opened on hover:
`[mlvMenuTrigger][isSubmenuTrigger]` and the rows a `mlv-menu [dataSource]`
generates for an item with `children`. Fixes #345 (audit C052 / OVERLAYS-12).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
token, i18n key or BEM class was added, renamed, removed or retyped; the
changed code (`submenu-aim.ts`, `MlvMenuOverlayController`) is internal and in
no barrel. What moves is the timing of hover intent at an unchanged API —
VERSIONING §3 row 112 (_default behaviour … timing, ordering_): a pointer on
another row of the parent menu no longer always closes the submenu at once,
and a sibling submenu trigger no longer always opens on `mouseenter`. The half
that restores what the trigger documented — "keeps it open while the cursor
moves diagonally toward it" — is row 117. The issue cites row 111, which is
the _default value_ row; no default value changes. On `0.x` the `!` releases
as `0.2.0` → `0.3.0` (VERSIONING §7).

## 1. What changed

**Before.** The rule that was meant to be a safe triangle protected nothing it
existed for, for four independent reasons:

- The trajectory test compared the slope of each step with the slopes to the
  panel's top and bottom corners, all measured from the previous point. That
  reduces to "is the pointer's y inside the panel's y range" — a horizontal
  **band** the height of the panel, not a triangle. A step toward a lower
  submenu row that dipped below the band, or any slow step under 2px of
  horizontal progress, read as "not heading".
- A pointer over another row of the parent menu closed the submenu **before**
  the trajectory test ran — and the diagonal from the parent row to a lower
  submenu row always crosses the rows below the parent. Opening "Appearance ▸"
  and aiming at its third entry closed it on the first pixel over "Language".
- The side was hard-coded to the right. A submenu that opened to the left —
  CDK's `left-start` fallback near the viewport's right edge, or any submenu
  inside a `[dir="rtl"]` scope, where `SUBMENU_POSITIONS` mirrors — read every
  step toward it as moving away, so even a path clear of every sibling closed
  after 150 ms.
- The first step was measured from `(0, 0)`.

**After.** The apex is the last pointer position seen on the parent row
(re-based on every move over it; the exit point if the pointer left before
any move reached the tracker), and the base is the **whole** panel edge facing
the apex, top corner to bottom corner, inclusive. The facing edge comes from
the measured geometry — the panel's left edge when the apex lies to its left,
its right edge when it lies to its right — so both placements and both
directions get the right side with no direction read; the pane is measured at
each decision.

| Pointer is over                                     | Before                                         | After                                                                                   |
| --------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| The parent row                                      | stays open                                     | stays open; the apex follows the pointer                                                |
| Another row of the parent menu, inside the triangle | **closes at once**                             | stays open while the pointer keeps moving; a **150 ms rest** on the row closes it       |
| The gap, inside the triangle                        | open only if the band test passed (right side) | stays open, either side                                                                 |
| Another row, outside the triangle                   | closes at once                                 | closes at once (unchanged)                                                              |
| Anything else, outside the triangle                 | closes after 150 ms                            | closes after 150 ms (unchanged)                                                         |
| A **sibling submenu trigger**, inside the triangle  | opens its submenu at once, over the open one   | waits: opens after a 150 ms rest on its row, or at once when a move leaves the triangle |

The sibling hand-off always starts closing the open submenu before it opens the
held one; the closing panel's leave animation may overlap the new panel's
entry, so two panes can be in the DOM while it plays. Moving off the held row,
reaching the open panel, or any other close drops it. Keyboard navigation,
click, `openMenu()` and a submenu trigger hovered with no sibling submenu open
are unchanged; a submenu opened from the keyboard follows the rules above once
the pointer moves. In a nested menu each level aims within its own parent
panel, so a third-level submenu holds second-level sibling triggers only.

## 2. Who is affected

- **Specs that hover across rows with coordinates.** A synthetic `mousemove`
  on a sibling row still closes the submenu at once when it lies outside the
  triangle — a move with no earlier move over the parent row (no apex), or one
  straight down the row column. One that lands inside it, after moves over the
  parent row set an apex, now leaves the submenu open for 150 ms.
  **Do:** move outside the triangle (straight down from the last point on the
  parent row), or wait 150 ms without further moves before asserting the close.
- **Specs or code expecting a sibling submenu trigger's `mouseenter` to open
  its submenu at once** while another submenu of the same menu is open.
  **Do:** follow the `mouseenter` with a `mousemove` outside the open
  submenu's triangle, or wait 150 ms; or open it through `openMenu()` / the
  keyboard, which never wait.
- **Users.** A diagonal to a lower (or upper) submenu entry across the rows in
  between no longer closes the submenu, on either side and in RTL. Resting on
  another row still hands it the hover, 150 ms later instead of at once; the
  row's own `:hover` paint shows while the pointer crosses it.

Not affected: `mlv-menubar` top-level hover-follow, context menus
(`[mlvContextMenuTrigger]` opens at the pointer, its submenus follow the rules
above), every non-submenu trigger. In-repo, no spec or docs example relied on
the old timing: `menu.spec.ts`'s _closes when the cursor moves onto a sibling
item of the same menu_ moves with no apex and still closes at once.
