# 2026-08 — `mlv-scrollbar` viewport tab stop is opt-in

**Packages:** `@malva-ui/core/scrollbar`
**Kind:** breaking. `MlvScrollbar.viewportTabIndex` changes default and narrows its type. No symbol was renamed or removed from the public API.

---

## Why

`mlv-scrollbar` used to decide for itself whether its viewport was a tab stop.
`viewportTabIndex` defaulted to `0`, and `0` did not mean "tabindex 0" — it meant
**auto**: a `MutationObserver` over all projected content re-ran
`querySelectorAll(FOCUSABLE_CANDIDATE_SELECTOR)` plus a CDK
`isFocusable`/`isTabbable` per candidate on every mutation, and the viewport got
`tabindex="0"` only while nothing inside it was tabbable.

The heuristic read the content and never the geometry — it never consulted
`_hasVerticalOverflow` / `_hasHorizontalOverflow`, which the component already
maintains for track visibility. Two defects follow directly:

- **Content that fits, with nothing focusable** → `tabindex="0"`, `role="group"`,
  `aria-label="Scrollable region"`. A tab stop and a screen-reader announcement
  on a region that cannot scroll.
- **Content that overflows, with one `<button>` at the top above a long
  passage** → `tabindex="-1"`. The passage is unreachable by keyboard: a
  **WCAG 2.1.1 failure produced by the focusable-content heuristic itself**.

"Is this scroller keyboard-reachable?" depends on the page around it, not on
what a `querySelectorAll` finds inside it. The mechanism is deleted rather than
repaired; the consumer, who knows the surrounding page, opts in.

---

## What changed

### 1. `viewportTabIndex` is a pure passthrough

|              | Before                                                            | After                                         |
| ------------ | ----------------------------------------------------------------- | --------------------------------------------- |
| Type         | `number`                                                          | `-1 \| 0 \| null`                             |
| Default      | `0`                                                               | `null`                                        |
| `0` means    | **auto** — tab stop only while the content holds nothing tabbable | literal `tabindex="0"`, always                |
| `null`       | n/a                                                               | **no `tabindex` attribute is emitted at all** |
| Other values | applied verbatim                                                  | do not compile                                |

The value is bound straight to the viewport's `[attr.tabindex]`. Nothing is
inspected: not the projected content, not the overflow state.

The type narrowing is deliberate. `.claude/rules/accessibility.md` forbids a
positive tabindex, so `[viewportTabIndex]="2"` is now a template type error
rather than a shipped bug. Bind the value (`[viewportTabIndex]="0"`) — the plain
attribute form `viewportTabIndex="0"` passes the _string_ `'0'`, which
`strictTemplates` rejects.

### 2. The tabbability machinery is gone

Deleted from `libs/core/scrollbar/src/lib/scrollbar/scrollbar.ts`:

- the `_hasTabbableContent` signal and `_updateTabbableContent()`;
- the `_contentObserver` `MutationObserver`, its `observe(...)` in
  `afterNextRender` and its `disconnect()` in `onDestroy`;
- the `FOCUSABLE_CANDIDATE_SELECTOR` constant;
- the `InteractivityChecker` injection — `@angular/cdk/a11y` is no longer a
  dependency of this library;
- the `_effectiveViewportTabIndex` computed.

`mlv-scrollbar` now constructs **no** `MutationObserver`. Its `ResizeObserver`,
`_updateGeometry`, overflow signals, thumb geometry, drag handling and
`_onScroll` are untouched.

### 3. Role and name follow the resolved tab index

Unchanged in behaviour, re-keyed onto the input:

| `viewportTabIndex` | `tabindex` | `role`  | `aria-label`              |
| ------------------ | ---------- | ------- | ------------------------- |
| `0`                | `0`        | `group` | resolved `ariaLabel`/i18n |
| `-1`               | `-1`       | absent  | absent                    |
| `null` (default)   | absent     | absent  | absent                    |

The invariant that motivated it still holds: a name is never emitted without a
role that permits it (WCAG 4.1.2, axe `aria-prohibited-attr`), and wrapping
content in `mlv-scrollbar` never injects a landmark. `_resolvedAriaLabel`
(explicit `ariaLabel` → i18n `scrollableRegion` → `'Scrollable region'`) is
unchanged.

---

## What you have to do

**If you relied on the old default** — that is, you wrote `<mlv-scrollbar>` and
expected a keyboard-reachable viewport — **pass `[viewportTabIndex]="0"`.**

```html
<!-- Before: an implicit, content-dependent tab stop. -->
<mlv-scrollbar style="height: 12rem">
  <p>Long prose…</p>
</mlv-scrollbar>

<!-- After: an explicit, guaranteed tab stop. -->
<mlv-scrollbar [viewportTabIndex]="0" ariaLabel="Release notes" style="height: 12rem">
  <p>Long prose…</p>
</mlv-scrollbar>
```

With **no** attribute (the new default), keyboard focusability of a
non-focusable overflowing scroller falls to the browser's own **native scroller
focusability** — Chrome 127+ and Firefox make a scroll container focusable
themselves, but **only when the scroller has no keyboard-focusable children**.
That is real coverage, and it is exactly the case the old heuristic handled
correctly; it is not universal. `0` is the way to guarantee it.

Conversely, `[viewportTabIndex]="0"` on a scroller that _does_ contain controls
adds a stop in front of them and announces the region. That is now your call to
make, with the page in front of you.

**If you already passed `-1`** — nothing to do. `-1` keeps meaning exactly what
it meant: programmatically focusable, never a tab stop.

**If you passed any other number** — it will not compile. Positive tabindex
values were never acceptable; pick `-1`, `0`, or `null`.

---

## Consumers inside the library

Both in-repo call sites already passed `-1` and are unchanged:

- `mlv-dropdown-panel` (`scrollMode="self"`) — the panel's listbox owns the
  keyboard model and scrolls the viewport through `aria-activedescendant`. `-1`
  rather than `null` is a positive statement, and it matters: under `null`, a
  panel in its loading / "no results" / skeleton state has no focusable children
  at all, which is precisely when a browser's native scroller focusability would
  insert the panel into the tab order in front of a combobox whose ARIA model
  expects focus to stay on the input.
- `apps/docs` support-inbox showcase — same reasoning, same value.

---

## Not changed

- Every other `MlvScrollbar` input, output and public property, including
  `viewportElement`.
- The `ResizeObserver`, overflow detection, thumb geometry and drag scrolling.
- The `scrollbar.scrollableRegion` i18n key in every locale.
- The `.mlv-scrollbar__viewport` entry in
  `MlvOverlayHostBase`'s `initialFocus: 'auto'` skip list — a viewport that a
  consumer opts into as a tab stop is still skipped when an overlay picks its
  first focus target.
