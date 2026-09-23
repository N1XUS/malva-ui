# 2026-09 — `mlv-list-item-group`: ARIA roles derived from the enclosing list's `listRole`

**Packages:** `@malva-ui/core/list` (`MlvListItemGroup`, `MlvListAccessor`).
**Kind:** breaking, **behaviour only**. Nothing renamed, removed or retyped in the public API: no exported symbol, selector, `exportAs`, input, output, i18n key or `--mlv-*` token changes, and the `@malva-ui/core/list` barrel is untouched. What changes is the ARIA the component _renders_ — `role` on the group host, `role` and `aria-labelledby` on `.mlv-list-item-group__content`, and whether `.mlv-list-item-group__toggler` exists at all — which [`VERSIONING.md`](../../VERSIONING.md) §3 classes as a **major**: _"Changed **default behaviour** at an unchanged API — ordering, timing, emitted events, focus, ARIA, what a value means"_. One non-exported internal type, `MlvListAccessor`, gains a member. Two BEM-scoped SCSS changes: a new `.mlv-list-item-group__label` block outside the inset scope, and a block-padding pair added to `.mlv-list-item-group--pinned`'s content rule; nothing is removed, and the inset rendering is byte-identical. Resolves #224.

---

## Why

`MlvList.listRole` is `input<string>('list')` ([`list.ts`](../../libs/core/list/src/lib/list/list.ts) — line 61 before this change, 63 after it; #224 cited `:54`, which is `export class MlvList {`, and `:51` is the `'[attr.role]': 'listRole()'` host binding), and its JSDoc points explicitly at `role="menu"` contexts. **Five** sites in `libs/` already override it — `tabs.html:59` (`menu`), `dropdown-panel.html:35` (`listbox`), `drawer-sections.html:16` (`menu`), `menu.ts:119` (`menu`), `breadcrumb.html:77` (`menu`) — plus **four** more in `apps/docs` (`support-inbox.html:378` and `list/examples/2` and `/11`, all `listbox`; `popup/examples/5`, `menu`); four further `apps/docs` sites write the default `listRole="list"` explicitly, and a separate set of sites overrides `itemRole` instead. #224 says "Six production sites" and then lists five; the real number is nine non-default `listRole` sites across `libs/` and `apps/`, five of them in `libs/`.

#219 gave `MlvListItemGroup` a `role="listitem"` host and a `role="list"` content region, which fixed a real `aria-required-children` on `mlv-list`. Both were **hardcoded**, and a hardcoded container role is a claim about a container the component never looked at.

### Measured, on the tree as it shipped

axe-core 4.12.1, full sweep rooted at the `mlv-list` (a sweep rooted at the group never evaluates the parent's owned-children rule). **Every group below is `open`**, which the counts depend on: since #221 a collapsed group's content region carries `inert`, and axe drops an inert subtree wholesale, so the two rows failing ×2/×2 fail ×1/×1 collapsed — the region's own violation and its rows' both disappear, leaving only the two on the `mlv-list` and the group host. A "same total, just moved" claim is only readable if the state is stated, so it is.

| staged composition                                                                        | result                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<mlv-list>` (default) + group + `mlv-list-item`                                          | clean                                                                                                                                                                                                                                                                                      |
| `<mlv-list listRole="menu">` + **expanded** group + `mlv-list-item itemRole="menuitem"`   | `aria-required-children` ×2 (`mlv-list`: _children which are not allowed: `[role=listitem]`_; `#…-content`: _not allowed: `[role=menuitem]`_) **and** `aria-required-parent` ×2 (`mlv-list-item-group`: _required parent role not present: list_; `mlv-list-item`: _menu, menubar, group_) |
| …the same, **collapsed**                                                                  | `aria-required-children` ×1 (`mlv-list`) and `aria-required-parent` ×1 (`mlv-list-item-group`) — `inert` hides the region and its rows from the sweep                                                                                                                                      |
| `<mlv-list listRole="listbox">` + **expanded** group + `itemRole="option"`                | the same four, with `option`/`listbox` substituted                                                                                                                                                                                                                                         |
| group with **no enclosing list at all** (the `libs/core/src/ssr-smoke.spec.ts:583` shape) | `aria-required-parent` (`mlv-list-item-group`: _required parent role not present: list_) — the one row that is state-independent, since the violation is on the group **host**, which `inert` never covers                                                                                 |
| `<mlv-list variant="inset">` + pinned group                                               | clean                                                                                                                                                                                                                                                                                      |

The fifth row is the half the ticket does not mention and the one that was **already shipping**: `listitem`'s ARIA required context is `list`, so an unconditional `role="listitem"` is a dangling required parent the moment the group is used outside a list — which `ssr-smoke.spec.ts` does, and which the component's own JSDoc explicitly permitted. No sweep caught it because the only spec mounting a standalone group asserted the toggler and never ran axe.

---

## What changes

Every role is now derived from the enclosing list's `listRole`, read through the internal `MLV_LIST` token.

#224 defers itself on the grounds that deriving the roles "requires injecting the parent `MlvList` (a new DI edge)". That was true when the ticket was filed and is not true now: #253 introduced `MLV_LIST` (`libs/core/list/src/lib/list/list-token.ts`), `MlvList` provides it, and `MlvListItemGroup` already injected it `{ optional: true }` to resolve `_pinnedOpen()`. The edge exists. What was actually needed is a one-member widening of `MlvListAccessor`, which until now carried **only** `variant` behind a JSDoc paragraph explaining why — that paragraph is rewritten here, and the token stays unexported. The table:

| enclosing `listRole`                                                                                                             | host role  | `__content` role | toggler | `aria-labelledby` on `__content` |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------- | ------- | -------------------------------- |
| `'list'` — the default                                                                                                           | `listitem` | `list`           | yes     | only when `variant="inset"`      |
| _no enclosing list_                                                                                                              | — none —   | `list`           | yes     | no                               |
| `'menu'`, `'menubar'`, `'listbox'`, `'tree'`                                                                                     | — none —   | `group`          | **no**  | yes                              |
| the other child-requiring roles: `'feed'`, `'grid'`, `'row'`, `'rowgroup'`, `'suggestion'`, `'table'`, `'tablist'`, `'treegrid'` | — none —   | — none —         | **no**  | no                               |
| anything else — `'toolbar'`, `'radiogroup'`, `'region'`, `'group'`, an unknown or misspelt value                                 | — none —   | — none —         | **yes** | no                               |

Rows 3–5 are clean **only when `itemRole` is also a role the container owns**. `MlvListItem.itemRole` defaults to `'listitem'` whatever container it sits in, and nothing in this change touches that — see _[The gap this does not close](#the-gap-this-does-not-close)_ below. Row 1 needs nothing: `listitem` is exactly what a `role="list"` wants.

### Justifying each row

**Row 1 is unchanged**, byte for byte, and it is the only row anything in this repository renders. Every `mlv-list-item-group` in `libs/` and `apps/` (`apps/docs/.../pages/list/examples/5` and `/8`) sits in a default `role="list"`.

**Row 2** drops the dangling `listitem`. The content region keeps `role="list"`, because the group's documented content is `mlv-list-item` rows and those need a `list` context of their own; a standalone group is simply a labelled list.

**Row 3 — the four `group`-owning roles are exhaustive.** Read off the WAI-ARIA required-owned-elements table, which axe-core 4.12.1 ships as `ariaRoles[<role>].requiredOwned`:

```
list      → ['listitem']
listbox   → ['group', 'option']
menu      → ['group', 'menuitemradio', 'menuitem', 'menuitemcheckbox', 'menu', 'separator']
menubar   → (the same list as menu)
tree      → ['group', 'treeitem']
tablist   → ['tab']
table / grid / treegrid → ['rowgroup', 'row']
row → ['cell', 'columnheader', 'gridcell', 'rowheader']   rowgroup → ['row']
feed → ['article']                                        suggestion → ['insertion', 'deletion']
```

`group` — not a nested `menu` or `listbox`. A nested `role="menu"` is a _submenu_: a pattern `mlv-menu` already owns, needing a controlling `menuitem` with `aria-haspopup`. `group` is what these containers actually list as their sectioning child, and it is what `mlv-menu-group` (`role="group"` + `aria-labelledby`) and `mlv-dropdown-panel`'s own APG listbox groups already render for the identical job.

**Row 3's missing toggler — and why the role sits on the content region rather than the host.** axe **flattens** a `role="group"` child when the container requires one: `getOwnedRoles` pushes its children back onto the queue instead of recording the group, so a `group` shields nothing. Measured, both `host=group` and `host=none` under `listRole="menu"` with a toggler rendered fail identically:

```
aria-required-children [critical]
    mlv-list — Element has children which are not allowed: button[aria-controls]
```

Only `listitem` under `role="list"` is a role the container records and stops at, which is exactly what keeps row 1's toggler out of the list's owned-children set. So under every other container the group is pinned open the way `variant="inset"` already pins it — `mlv-list-item-group--pinned` on the host, `.mlv-list-item-group__label` instead of `.mlv-list-item-group__toggler` — which is also what `mlv-menu-group`, the library's existing menu section component, has always done.

**Row 4 — and why `aria-labelledby` goes with the role.** `tablist` owns `tab` and nothing else: there is no role the group could claim, so it claims none and is transparent, and the rows are evaluated directly against the container. Keeping `aria-labelledby` on a **roleless** region would put the violation straight back, because it is a _global_ ARIA attribute and axe counts a roleless element carrying one as an owned child in its own right:

```
aria-required-children [critical]
    mlv-list — Element has children which are not allowed: div[aria-labelledby]
```

The label element still renders; it simply names nothing in that row. Nothing is lost by that: the region is roleless, so it maps to `generic`, which prohibits naming — an `aria-labelledby` there is inert even where it is not a violation (measured: adding it under `role="toolbar"`, which owns nothing, is axe-clean and still exposes no name). The same holds for the one shape where `variant="inset"` pins a group inside such a container: the section is visible and labelled on screen, and the label is simply not wired to a region that could carry a name.

**Row 5 — the suppression is a closed-set test, and the closed set is the child-requiring one.** Rows 3 and 4 remove the toggler because the container would own it and disallow it. Under a container that requires **no** particular children there is nothing to disallow: `ariaRequiredChildrenEvaluate` calls `requiredOwned(role)`, which returns `null` for any role declaring no `requiredOwned` array, and returns `true` before it inspects a single child. So `toolbar`, `radiogroup`, `region`, `group` and every unrecognised value keep a working disclosure. Measured — a `role="toolbar"` list containing the group's `<button aria-expanded aria-controls>` sweeps **clean**, and a typo'd `listRole="lst"` raises only `aria-roles` about the invalid name, nothing about the button.

Reading row 4 as a catch-all instead — "any `listRole` other than `list`" — is what an earlier draft of this change did, on the stated grounds that `listRole` is an open `string` so the alternative would be enumerating every role that owns _no_ children, an open set. That reasoning is backwards. The child-requiring side is the **closed** one: exactly thirteen roles carry a `requiredOwned` list in axe-core 4.12.1 —

```
feed, grid, list, listbox, menu, menubar, row, rowgroup, suggestion, table, tablist, tree, treegrid
```

— which is `Object.entries(axe.utils.getStandards().ariaRoles).filter(([, d]) => Array.isArray(d.requiredOwned))`, and it is the complement that cannot be enumerated. `list` is handled by row 1, leaving the twelve of `CHILD_REQUIRING_CONTAINER_ROLES`. The catch-all was not conservative but lossy: it removed a provably legal control, so a consumer who wrote `listRole="toolbar"` — or fat-fingered `listRole="lst"` — silently lost the toggler on **every** group in that list, leaving the sections permanently expanded with `toggle()` and `[(open)]` inert and no dev warning. The list is a snapshot of ARIA and can drift, and drift is graceful in the safe direction: a role that later gains required children and is missing from the set renders a toggler that a sweep catches as `aria-required-children`, rather than removing a control nobody asked to lose.

### Naming

`_pinnedOpen()` is now `_alwaysOpen()`. It stopped meaning "the _variant_ pins it" and started meaning "no toggler is rendered, so nothing can ever close it" — a disjunction of the inset variant and rows 3/4's container check. Both are `@protected` internals, so this is a readability change, not an API one; the `--pinned` BEM modifier and `_contentVisible()` keep their names and their contract (`_expanded() || _alwaysOpen()`; `!_expanded()` is still **not** "collapsed").

### Two stylesheet changes

**A `.mlv-list-item-group__label` block outside the inset scope.** It had no declarations there, because inset was the only way to reach it. Rows 3 and 4 render it in a plain list, so it now takes the toggler's own box — `padding: var(--mlv-padding-s)`, `font-size: var(--mlv-font-size-l)`, `color: var(--mlv-list-color, var(--mlv-text-primary))`, `pointer-events: none` — so a section band keeps its **height** when the disclosure disappears. Its **indent does not match**, and deliberately: the toggler is a flex row of a 1rem chevron plus a 0.25rem gap, so its text starts 1.25rem further in (measured, plain variant: toggler text at x=32, `__label` text at x=12). Reproducing that offset would indent inert text against an empty gutter, and the two shapes never render side by side — `_alwaysOpen()` reads the enclosing list, so every group in one list renders the same one. Every declaration in the new block is re-declared by the existing `.mlv-list--inset .mlv-list-item-group__label` rule, which both outranks it (specificity 0,2,0 against 0,1,0) and comes later in the sheet, so **the inset section label renders exactly as before**.

**Block padding on `.mlv-list-item-group--pinned`'s content wrapper.** `--pinned` supplied `grid-template-rows: 1fr`, `opacity: 1` and `overflow: visible` but no padding, because the collapsed base rule zeroes the block half (`padding: 0 var(--mlv-spacing-3)`, so only that half animates) and `--toggled` re-adds it. That was invisible while `--pinned` was reachable only inside an inset list, whose own `.mlv-list--inset … > div { padding: 0 }` supplies the missing value on purpose. Rows 3 and 4 make it reachable in a plain list, where the rows then rendered flush against the section label: measured, `0px 12px 0px 24px` against `--toggled`'s `6px 12px 6px 24px`. `--pinned` now writes the same pair `--toggled` does. The inset rendering is unchanged — the two rules have identical specificity (0,2,1) and the inset one comes later, so it still wins; `MlvListItemGroup pinned content padding` in `list-item-group.spec.ts` pins all three states through the real compiled sheet.

---

## Consumer impact

**Nothing in this repository renders any row but the first**, so no shipped surface moves. Three shapes are affected:

1. **A group inside a `listRole` that requires owned children** — rows 3 and 4, the twelve of `CHILD_REQUIRING_CONTAINER_ROLES`. It stops being collapsible and renders a static section label. If you need a disclosure inside a menu, that is a submenu: use `mlv-menu`'s nested-menu support. If you need one inside a listbox, the option groups `mlv-dropdown-panel` renders are the supported shape. A group under any **other** non-default `listRole` (row 5 — `toolbar`, `radiogroup`, an unknown value) keeps its toggler and is unaffected.
2. **CSS or a DOM query written against the group's roles** — `mlv-list-item-group[role="listitem"]`, `.mlv-list-item-group__content[role="list"]`, `[role="listitem"] > .mlv-list-item-group__toggler`. Under a non-default `listRole` those match nothing now. Target the BEM classes, which are unchanged and are the documented override handle.
3. **A test asserting the old roles.** `expect(group.getAttribute('role')).toBe('listitem')` holds under `listRole="list"` and fails everywhere else, including with no list at all — where `expect(group.hasAttribute('role')).toBe(false)` is the assertion that holds.

---

## The gap this does not close

**`MlvListItem.itemRole` still defaults to `'listitem'` in every container.** So rows 3–5 are clean only for a consumer who also sets a container-matching `itemRole`, and

```html
<mlv-list listRole="menu">
  <mlv-list-item-group label="Account">
    <mlv-list-item>Profile</mlv-list-item>
  </mlv-list-item-group>
</mlv-list>
```

still raises `aria-required-children` on `mlv-list` (_children which are not allowed: `[role=listitem]`_) and `aria-required-parent` on `mlv-list-item` (_menu, menubar, group_).

**Net against the shipped tree is zero** — the same composition raised two violations before this change too, on `mlv-list` and on the group host; the failing node moves rather than disappearing. So this is not a regression, but it is not the "clean" the table would imply if it were read without this section either. Every other sweep in `list-item-group.spec.ts` hand-picks a container-matching `itemRole`, which is the named-harness hazard in role form; `leaves a default itemRole under a non-list container failing, unchanged` sweeps the **default** with `runAxe` and asserts exactly those two ids on exactly those two nodes, so the gap is pinned rather than papered over, and closing it turns that spec red on purpose.

Changing the default is out of scope here: `itemRole` is a public input and its default is public behaviour, so it is a breaking change of its own, and it is not derivable from `MLV_LIST` without the same closed-set reasoning applied to a second, larger question (what each container role wants its **rows** to be, not merely whether it requires any). Tracked as #273.

## Not fixed here either, and not a regression

A `role="list"` whose children are **all** `role="none"` fails `aria-required-children` with _"Required ARIA child role not present: listitem"_. Because a group under the default `listRole` renders a second `role="list"`, the same consumer error can be made one level deeper: `<mlv-list-item-group><mlv-list-item itemRole="none">` with no other row.

The ticket filed this as its "half 2", citing `breadcrumb.html:85`'s `itemRole="none"` idiom and describing it as a `role="none"` row being an _unallowed_ child of the group's `role="list"`. Measured, that diagnosis is wrong twice over and the composition is not a group defect:

- `role="none"` is **presentational**, so `getOwnedRoles` resolves it to `null` and flattens it. It is never "unallowed". The failure is the opposite one — the `list` ends up with **no** required child.
- It is not group-specific. `<mlv-list><mlv-list-item itemRole="none"></mlv-list>` fails identically with no group present, as does a bare `<div role="list"><div role="none">`. The same shape is why an _expanded standalone_ group holding non-row content (`<p>…`) fails: it is a `list` with no `listitem`.
- `breadcrumb.html` contains no `mlv-list-item-group` at all, and the composition it actually ships — `listRole="menu"` + `itemRole="none"`, no group — sweeps **clean**. Under a `menu` parent the group's content region is now `role="group"`, which has no required children, so even the group-wrapped version of that idiom is clean after this change.

The residual — a group under the default `listRole` whose only rows are presentational — is the consumer's: a list of purely presentational rows is not a list. It is unchanged by this migration in either direction.
