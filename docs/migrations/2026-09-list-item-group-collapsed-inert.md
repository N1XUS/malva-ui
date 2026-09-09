# 2026-09 — `mlv-list-item-group`: collapsed content leaves the tab order and the accessibility tree

**Packages:** `@malva-ui/core/list` (`MlvListItemGroup`).
**Kind:** breaking, **behaviour only**. Nothing renamed, removed or retyped: no exported symbol, selector, `exportAs`, input, output, injection token, i18n key, `--mlv-*` token or BEM class changes, the `@malva-ui/core/list` barrel is untouched, and no stylesheet declaration is added, removed or altered. One attribute — `inert` — now appears on `.mlv-list-item-group__content` while the group's content is off screen. Resolves #221.

---

## Why

The group collapses entirely in CSS, and always did:

```scss
// libs/core/list/src/lib/list-item-group/list-item-group.scss:45-69
&__content {
  display: grid;
  grid-template-rows: 0fr; // collapsed
  > div {
    overflow: hidden;
    opacity: 0;
  }
}
```

**None of those three removes anything from the accessibility tree.** There was no `display: none`, no `visibility: hidden`, no `hidden` attribute and no `inert` anywhere in the component. A zero-height, `overflow: hidden` box still computes `visibility: visible`, so:

- assistive technology kept exposing every row inside a collapsed group, under a toggler announcing `aria-expanded="false"`;
- sequential focus navigation kept reaching every interactive descendant. A keyboard user tabbing past a collapsed "Privacy" section on a settings page landed on a link inside it **with no focus ring anywhere on screen** — the focused element is clipped to zero height. WCAG 2.4.3 (Focus Order), 2.4.7 (Focus Visible) and 1.3.1.

Corroborated independently during #202 batch 2 (#219): ablating the content region's `role="list"` made axe report `#mlv-list-group-content-1 > div > div > mlv-list-item` — a row inside the **collapsed** group — as a live node in the flattened tree.

### An axe sweep cannot see this, measured — before _or_ after

Worth recording, because the obvious instinct is to add one. `core-list` already owns four axe sweeps (`list.spec.ts`, `list-item-group.spec.ts`), and a collapsed group holding a focusable `<a href>` was measured through `runAxe` in all three configurations:

| Configuration                                                    | axe violations | axe incomplete |
| ---------------------------------------------------------------- | -------------- | -------------- |
| Collapsed group, no `inert` (the defect)                         | `[]`           | `[]`           |
| Collapsed group, `inert` applied (the fix)                       | `[]`           | `[]`           |
| **Visible** pinned group wrongly marked `inert` (the trap below) | `[]`           | —              |

axe has no rule of the form "content the author collapsed must leave the tree" — it evaluates the tree it is given, and the tree it was given was correct-looking and wrong. The third row is the important one: a full sweep stays green even when the fix is written with the wrong predicate and takes live controls out of the tab order. So no sweep is added here, the four existing ones are kept (they pass unchanged with `inert` present, which is itself the check that dropping a `role="list"` region out of the tree raises no `aria-required-children` / `aria-required-parent` / `aria-valid-attr-value` fallout), and the guard is an explicit four-state attribute contract instead.

---

## What changed

One binding, on the content region:

```html
<!-- libs/core/list/src/lib/list-item-group/list-item-group.html -->
<div class="mlv-list-item-group__content" role="list" [id]="_contentId" [attr.aria-labelledby]="_pinnedOpen() ? _labelId : null" [attr.inert]="_contentVisible() ? null : ''"></div>
```

| State                                     | `_expanded()` | `_pinnedOpen()` | `inert`     |
| ----------------------------------------- | ------------- | --------------- | ----------- |
| Collapsed (plain list, or no list at all) | `false`       | `false`         | **present** |
| Expanded by `open` or by the toggler      | `true`        | `false`         | absent      |
| Pinned by `variant="inset"`, no `open`    | `false`       | `true`          | absent      |
| Pinned by `variant="inset"`, with `open`  | `true`        | `true`          | absent      |

It goes on `__content` rather than an inner wrapper so that the region `aria-controls` names is exactly the region `aria-expanded="false"` is a claim about.

### The predicate is `_expanded() || _pinnedOpen()`, and `!_expanded()` is not a synonym

This is the whole difficulty of the ticket, and it is not the one the issue anticipated. `variant="inset"` pins a group's content open through the `--pinned` modifier, **independently** of `--toggled` (#220 moved it there deliberately, so DI and DOM cannot disagree). So a pinned group renders its rows on screen with `_expanded()` false, and the obvious `[attr.inert]="!_expanded()"` would mark the **visible** rows of every inset section inert — dropping, among other things, every `mlv-switch` in `apps/docs`' list example 8 out of the tab order.

It fails in the direction that hides itself. Since #220 `open` coerces, so an inset group written `<mlv-list-item-group open>` carries `--toggled` _and_ `--pinned` — and both shipped docs examples (5 and 8) write the bare `open` attribute. A regression spec written against them would have passed while `list.spec.ts`'s `InsetListGroupsHost` (inset, **no** `open`) broke. The predicate is named `_contentVisible` and carries this warning in its JSDoc; `list-item-group.spec.ts` covers all four states above, and `list.spec.ts`'s inset sweep asserts the un-`open`ed pinned shape stays interactive.

Both odd arrangements #220 documented resolve correctly and unchanged:

- a group merely **projected** into an inset list resolves no `MLV_LIST`, so it is genuinely collapsible and its collapsed content is genuinely inert;
- a group declared lexically inside an inset list but **rendered elsewhere** gets `--pinned` from DI, so its content is pinned open and never inert.

---

## Why `inert`, and not the three things the issue proposed

The issue frames this as a timing problem — "each has to be timed against the `grid-template-rows` transition, and the reduced-motion path has to stay correct". That is true of two of the three candidates and **false of `inert`**, which is what makes the fix one binding rather than a CSS timing dance.

**`inert` is not a rendering property.** Per the HTML Standard's _Inert subtrees_, an inert node is untargetable by pointer events, excluded from sequential focus navigation and non-editable, and "user agents should not expose inert nodes to accessibility APIs" — while rendering is untouched. There is therefore no frame at which flipping it can interrupt an animation: it is applied the moment the content stops being on screen and lifted the moment it starts, and the `grid-template-rows` transition runs underneath either way. It needs no `transition-delay`, and consequently no reduced-motion path of its own.

This is settled precedent in this library, not a new idea — three shipped components already flip `inert` immediately alongside a running CSS animation, and `mlv-sidebar-item`'s own comment states the reasoning verbatim ("The label stays mounted for an interruptible CSS fade, but becomes inert and clipped immediately"): `sidebar-item.html:18`, `sidebar-group.html:13`, `stepper.html:174`. `inert` is Baseline Widely Available (Chrome 102, Safari 15.5, Firefox 112).

`mlv-expand` looks like a fourth and is **not**. Its `expand.html:6` writes `[attr.inert]="opened() ? null : ''"` from inside `@if (opened())`, so the ternary can only ever evaluate with `opened()` true and the attribute is never written — dead code, and `animate.leave` does not rescue it, because once the `@if` goes false the embedded view stops updating bindings and the lingering node keeps its last value, which was "no attribute". Do not cite it as precedent, and do not copy the pattern from it. Filed as [#263](https://github.com/N1XUS/malva-ui/issues/263), which also owns the `libs/core/expand/CLAUDE.md` paragraph that described the binding as live behaviour; this PR corrects that paragraph to say it is dead, and leaves the binding itself alone.

**Rejected — `aria-hidden="true"` alongside `inert`.** Worth stating explicitly, because two of the three precedents above (`sidebar-item.html:17-18`, `sidebar-group.html:12-13`) write both and only `stepper.html:174` writes `inert` alone — so the precedent is genuinely mixed. Unlike `visibility: hidden` it costs nothing: no transition, no `transition-delay`, no reduced-motion path. The case against it is purely that it is redundant, and that was checked rather than assumed. Measured in Chrome through the CDP accessibility tree: with `inert` present the content region, its `listitem` and its link collapse to a single `ignored` node; strip `inert` and the same snapshot exposes `link "Wi-Fi"` — a row inside the **collapsed** group — as a live node. The engine implements the exclusion, so a second attribute would only restate it. Two caveats carried honestly: this is **Chrome only** (Firefox and WebKit unmeasured), and the spec's AT clause is a SHOULD, which is presumably why the two sidebar components hedge. If an AT report ever shows an engine exposing an inert subtree, adding `aria-hidden` here is a one-line, non-breaking change — and it would not disturb the existing sweeps, because axe-core has exactly one `inert` site (`axe.js:13675`, v4.12.1) and `isVisibleToScreenReaders` short-circuits on `ariaHidden(vNode) || isInert(vNode)`, treating the two identically, so `aria-hidden-focus` cannot fire on a subtree that is already inert.

**Rejected — `visibility: hidden`, alone or as belt-and-braces alongside `inert`.** It is visual, so it does need the classic `transition: visibility 0s linear var(--mlv-duration-normal)` on collapse and `0s` on expand. The shared `mixins.reduced-motion($block)` (`libs/styles/src/lib/mixins.scss:148-164`) overrides `scroll-behavior`, `animation-duration`, `animation-iteration-count` and `transition-duration` — it does **not** touch `transition-delay`, so this component would have had to hand-author a reduced-motion delay reset that no other component in the library owns. It is also unassertable here: measured, `core-list`'s jsdom suite never sees the component stylesheet at all (`__content` computes `display: block`, and `grid-template-rows` / `opacity` come back empty), so the belt would have been untested belt. Against that cost it buys only an upgrade from the spec's SHOULD-level AT exclusion to a MUST-level one, on a behaviour every current engine implements, and nothing at all for the tab order.

**Rejected — `hidden="until-found"`.** It computes to `content-visibility: hidden`, which skips rendering the subtree entirely and therefore **destroys** the `0fr → 1fr` transition the issue asks to preserve — there is no laid-out content to grow from. It would also need a `beforematch` listener writing `open` back, i.e. new behaviour (Ctrl+F silently expands a section, desynchronising a one-way `[open]` binding), which is a feature request rather than this bug fix. Its baseline is also years behind `inert`'s (Firefox 139, 2025) and nothing in the workspace uses it.

---

## Who is affected

**Nobody in this repository**, and no rendering changes anywhere: `inert` paints nothing. `apps/docs`' only two consumers (list examples 5 and 8) are inset groups written with the bare `open` attribute, so they are pinned open and never inert; every other in-repo use is a spec fixture. Consumers of `mlv-list-item-group` gain the fix with no edit.

These shapes can observe the change. The first two are the fix working as intended, on content that was never visible; the rest are narrower, and the focus case below is the one place the change makes something worse.

| Shape                                                                      | Before                                      | After                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Tabbing through a page containing a collapsed group                        | Focus entered the collapsed rows, invisibly | Focus skips the collapsed region                           |
| A screen reader reading a page containing a collapsed group                | Collapsed rows were announced               | The collapsed region is not exposed                        |
| `.focus()` aimed at a control inside a collapsed group                     | Moved focus                                 | **Blocked** — `activeElement` does not change              |
| `.click()` / `dispatchEvent()` aimed at a control inside a collapsed group | Worked                                      | **Still works, unchanged** — see below                     |
| Find-in-page over a collapsed group                                        | Matched the text                            | Expected not to match — spec-level expectation, unmeasured |

**`inert` blocks hit-testing, not synthetic dispatch.** Rows three and four differ, and the difference matters to anyone updating a consumer test. Measured in Chrome against an inert subtree: `.focus()` is genuinely blocked (`activeElement` stayed `BODY`), but `.click()` ran the element's own handler, a following `dispatchEvent(new MouseEvent('click', { bubbles: true }))` ran it again, **both events bubbled out** of the inert subtree to an ancestor listener, and the `<a href="#wifi">`'s default activation behaviour **navigated the page**. So a consumer driving a control inside a collapsed group with `.click()` is not affected; one that calls `.focus()` first is. The mechanical edit for that case: set `open` first (`[open]="true"`, or call `toggle()`), then act on the control.

The find-in-page row is the HTML Standard's expectation, deliberately **not** presented as a measurement: the spec directs user agents to ignore inert subtrees when finding text, but its adjacent text-selection clause is demonstrably not reflected in Chrome (`user-select` computes `auto` on an inert subtree), so nothing here is assumed about what an engine actually does. A consumer's own e2e test asserting the old tab order should be updated to assert the new one — it was asserting the defect.

### Collapsing a group while focus is inside it drops focus to `<body>`

The one shape in which this change makes something worse, and the only one that is not "content that was never visible". When the region becomes inert with focus inside it, the engine runs the spec's unfocusing steps **asynchronously**. Measured in Chrome — focus survives the state change within the same task and is gone a frame or two later (the exact frame varies between runs; one run dropped at the first animation frame, another at the second, so do not encode a frame count):

```
t0: linkA | sync: linkA | raf1: BODY | +50ms: BODY | +500ms: BODY
```

The next Tab then restarts at the top of the document. Before this change focus stayed on the (invisible) link and Tab continued from there.

**The common path is safe.** The toggler is a _sibling_ of `__content` (`list-item-group.html:11-21` vs `:43`), not a descendant, so clicking or pressing Enter on it leaves focus outside the region that goes inert. Only two arrangements reach the drop: a **programmatic** close — the accordion-exclusive pattern `[open]="openId() === 'privacy'"` bound one-way across several groups, where activating a control in one group closes another (`_expanded` is a `linkedSignal(() => this.open())`, so it re-seeds and `_contentVisible()` goes false) — or a control **inside** the region calling `toggle()`.

**No focus restoration is wired, and that is deliberate — do not "fix" it.** There is no correct target. The toggler is the only candidate, and moving focus to it on a state change the user did not initiate at that element is its own WCAG 3.2.1 / 3.2.2 problem: a consumer closing a group programmatically has not asked for focus to move there. A consumer who does need it owns the decision, in the same handler that flips `open`. This is the same class of accepted quirk as the `variant`-flip focus drop already recorded in `.claude/projects/libs-list.md`.

### Two shapes outside the table

Neither has an instance in this repository, which is why they are listed here rather than above.

- **Consumer CSS that forces the region open is now also an inertness override.** BEM class names are public API (`VERSIONING.md` § "Public API is not just TypeScript") and `ViewEncapsulation.None` is mandatory, so a consumer may legitimately write `.mlv-list-item-group__content { grid-template-rows: 1fr }` — and `@media print` is the canonical place to do it, so that collapsed sections print. The predicate reads component state, not computed geometry, so such a region is **visible and inert**: on screen, unreachable by keyboard, absent from the accessibility tree. This is the same trap as the wrong predicate, arriving from the consumer's side instead. A consumer overriding the collapse geometry must drive `open` as well, not instead. No in-repo instance — `@media print` appears only in `taskboard.scss` and `editor.scss`.
- **`mlv-list[selectable]` containing a collapsed group** — reasoned, **not** measured, and no such combination exists here (docs examples 2 and 11 are `selectable` with zero groups). The `@angular/aria` listbox's key manager would try to focus an option inside an inert subtree; `.focus()` no-ops there (measured above), so DOM focus and the manager's active item would desynchronise. Unlike everything else on this page it is not "content that was never visible" — it is content whose interaction model changed. Worth a real test if a consumer ever combines the two.

Not affected: `variant="inset"` groups in any state, expanded groups, `open` / `openChange` / `[(open)]` / `toggle()` semantics, every `--mlv-*` token, every BEM class, and the stylesheet, which is byte-identical.
