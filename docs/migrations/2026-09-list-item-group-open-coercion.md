# 2026-09 — `mlv-list-item-group`: `open` coerces, and `variant="inset"` renders no toggler

**Packages:** `@malva-ui/core/list` (`MlvListItemGroup`, and `MlvList` which now provides the internal `MLV_LIST` token).
**Kind:** breaking. One **retype** (`open` moves from a `model()` to a coerced `input()` + `openChange` `output()`), one **default-behaviour** change (the bare `open` attribute now expands), one **DOM/BEM** change inside `variant="inset"` (the `<button class="mlv-list-item-group__toggler">` is not rendered; `.mlv-list-item-group__label` takes its place, and `.mlv-list-item-group--pinned` is a new modifier). **No exported symbol was renamed or removed**, and the `@malva-ui/core/list` barrel is unchanged. Resolves #220.

---

## Why

Two defects that cancelled each other out on screen, which is why neither was noticed.

**1. `open` never coerced.** It was `model<BooleanInput>(false)` with no `coerceBooleanProperty` transform — the only `model<BooleanInput>` in the workspace, against 189 `input<boolean, BooleanInput>(false, { transform: coerceBooleanProperty })` siblings. The form the library documents everywhere else, `<mlv-list-item-group open>`, therefore bound the empty string:

```
open()          → ''      (falsy)
aria-expanded   → "false"
--toggled class → absent
```

It also broke `toggle()`: `!''` is `true`, so the first click on a group written with the bare attribute **opened** it rather than closing it.

**2. `variant="inset"` pinned the content open regardless.** `list-item-group.scss` held `.mlv-list--inset .mlv-list-item-group__content` at `grid-template-rows: 1fr` with `opacity: 1; overflow: visible`, with no dependency on the `--toggled` class, and hid the chevron. So the content was on screen and in the tab order while the toggler above it reported `aria-expanded="false"` and did nothing visible when pressed — a live WCAG 4.1.2 (Name, Role, Value) and 1.3.1 defect on two shipped `apps/docs` pages (list examples 5 and 8). Defect 1 kept the state falsy; defect 2 made the rendering ignore the state; the page looked right.

Fixing either alone is wrong: coercing `open` on its own only changes the announcement, and hiding the chevron harder leaves a tab stop lying about content it does not control.

---

## 1. `open` is a coerced input, not a model

`model()` takes **no `transform`** — `ModelOptions` carries only `alias` and `debugName`, and `ModelSignal<T>` reads and writes the same `T`. There is no way to coerce a `model`. So the pair is written out:

| Before                              | After                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `open = model<BooleanInput>(false)` | `open = input<boolean, BooleanInput>(false, { transform: coerceBooleanProperty })` |
| (the model's implicit `openChange`) | `openChange = output<boolean>()`                                                   |
| —                                   | internal `linkedSignal(() => this.open())` holds the resolved state                |

The `linkedSignal` is what preserves `model()`'s semantics: the component keeps a writable copy that is re-seeded whenever `open` changes, so a user toggle is not thrown away when a consumer binds `open` one-way.

| Call site                     | Before                      | After             | Action                                                |
| ----------------------------- | --------------------------- | ----------------- | ----------------------------------------------------- |
| `<mlv-list-item-group open>`  | collapsed (`open()` = `''`) | **expanded**      | none, if you meant expanded — otherwise drop `open`   |
| `[open]="true"`               | expanded                    | expanded          | none                                                  |
| `[open]="'yes'"` / any string | truthy string → expanded    | expanded          | none — `coerceBooleanProperty` accepts the same input |
| `[(open)]="flag"`             | two-way                     | two-way           | none — `[open]` + `(openChange)` is what `[(…)]` is   |
| `(openChange)="…"`            | emits `BooleanInput`        | emits `boolean`   | none, unless you were forwarding the raw value on     |
| `groupRef.open.set(v)` in TS  | worked (`ModelSignal`)      | **compile error** | bind `[open]` from your own signal instead            |
| `groupRef.open()` in TS       | `BooleanInput`              | `boolean`         | none — narrower, so every existing use still compiles |

`toggle()` is unchanged in name and signature, and now emits `openChange`.

---

## 2. Inside `variant="inset"`, no toggler is rendered

An inset list is a stack of always-expanded sections — that was already the intent of the stylesheet. It is now the intent of the markup too.

`MlvList` provides a new **internal** injection token, `MLV_LIST` (`libs/core/list/src/lib/list/list-token.ts`), carrying its `variant` signal. It is deliberately **not** exported from `@malva-ui/core/list`: it is an implementation detail between the list and its own children, and carries no compatibility promise. `MlvListItemGroup` injects it `{ optional: true }` — a group outside any list keeps working, as `libs/core/src/ssr-smoke.spec.ts` renders one.

| Rendering                                       | Before                                                    | After                                                   |
| ----------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| `<button class="mlv-list-item-group__toggler">` | rendered, `aria-expanded="false"`, `pointer-events: none` | **not rendered**                                        |
| Section label                                   | the button's own text                                     | `<div class="mlv-list-item-group__label">` — inert text |
| `.mlv-list-item-group__arrow`                   | rendered, hidden by `display: none`                       | not rendered (it lives inside the toggler)              |
| Host classes                                    | `mlv-list-item-group`                                     | `mlv-list-item-group mlv-list-item-group--pinned`       |
| Content region                                  | `role="list"`, unnamed                                    | `role="list"` + `aria-labelledby` pointing at the label |
| Tab stops per group                             | 1 (the inert button)                                      | 0                                                       |

Geometry is unchanged, and **the section label changes typeface**. `--pinned` carries the same `grid-template-rows: 1fr; opacity: 1; overflow: visible` the `.mlv-list--inset` descendant rules carried, and the `.mlv-list--inset .mlv-list-item-group__label` rule is the old `__toggler` rule verbatim (including its `pointer-events: none`, so a row scrolled under the sticky band hit-tests exactly as before). The rule is verbatim; the **inherited** font is not:

| Property                                                                                                           | old `<button class="__toggler">`                                    | new `<div class="__label">`                |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| `font-family`                                                                                                      | the UA button font (`Arial` on Chrome/macOS)                        | `var(--mlv-typography-family-text)`        |
| `text-align`                                                                                                       | `center` — inert: the base rule makes the toggler a `display: flex` | `start` — also inert, single text run      |
| `display`                                                                                                          | `flex`                                                              | `block` (both stretch as column flex item) |
| size, weight, line-height, letter-spacing, colour, padding, sticky offset, `z-index`, background, `pointer-events` | authored on both rules                                              | identical                                  |

Cause: there is **no** global `button { font: inherit }` reset in `libs/styles` — the workspace writes `font: inherit` per component, roughly twenty times, and `__toggler` never did. `mixins.base()` puts `font-family` on the `.mlv-list-item-group` host; a `<div>` inherits it and a `<button>` overrides it from the UA sheet. Block size is pinned by the authored `line-height`, so nothing reflows and no row shifts. The label now renders in the brand face like every other label in the library, which is the intended look — but it is a real, visible delta, and inset section headings should be eyeballed once rather than assumed pixel-identical.

### Who this breaks

- **CSS written against `.mlv-list--inset .mlv-list-item-group__toggler`** — the element no longer exists there. Retarget to `.mlv-list--inset .mlv-list-item-group__label`. The class `.mlv-list-item-group__toggler` itself is **not removed**; it is still the collapsible toggler in every non-inset list.
- **Anything that clicked or focused that button** — a test, a tour, a deep link. There is nothing to click; the section is already open.
- **A group _projected_ into an inset list from another component** — the one case where DOM descent and DI disagree, and the only one whose rendering changes. Four rules left the `.mlv-list--inset` scope, not one: besides the `__toggler` → `__label` rename, `.mlv-list--inset .mlv-list-item-group__content { grid-template-rows: 1fr }` and `.mlv-list--inset .mlv-list-item-group__content > div { opacity: 1; overflow: visible }` now live on `--pinned`, and `.mlv-list--inset .mlv-list-item-group__arrow { display: none }` is deleted outright. A wrapper whose template is `<mlv-list variant="inset"><ng-content /></mlv-list>`, consumed as `<my-wrapper><mlv-list-item-group label="X">…</mlv-list-item-group></my-wrapper>`, puts the group **inside** `.mlv-list--inset` in the DOM while its element injector finds no list — so `--pinned` is not stamped and a toggler _is_ rendered. Before: sticky uppercase band, content pinned open. After: the **plain-variant** toggler (`font-size: var(--mlv-font-size-l)`, hover background, `cursor: pointer`, a now-visible chevron) sitting in an iOS-settings card stack, with the card collapsed to zero height until the user opens it. That is the design — see _Why `--pinned`_ below, where it is genuinely collapsible instead of lying — but it is a rendering change, and the section chrome does not come with it. **Zero such consumers in this repository**; this is forward-facing only. Set `open` on the group, or move it inside the `<mlv-list>` lexically, to keep it expanded.
- **CSS written against `--toggled` inside an inset list** — a surface note, not a rendering bug. `--toggled` is a public BEM class, and `.mlv-list--inset .mlv-list-item-group--toggled` now matches for the first time: `open` coerces, so the bare attribute in docs examples 5 and 8 finally stamps it. Before this diff no shipped markup could produce that selector. The library's own cascade is unaffected — `--toggled`'s `__content > div` padding ties on specificity (0,2,1) with the `.mlv-list--inset` rule and loses on source order, which is the behaviour that was already there for `[open]="true"` — but a consumer who styles `--toggled` gains a new match.
- **Nobody else.** `.mlv-list-item-group`, `__content` and `__arrow` are unchanged as class names, and `--pinned` is additive.

### Why `--pinned` rather than `.mlv-list--inset …`

The token resolves through Angular's **element injector**, which is lexical; the old CSS matched **DOM** descent. They agree for a group written inside `<mlv-list>`, which is every shipped consumer, but not otherwise. Keying the open-state CSS on the `--pinned` class the template branches on means both halves read the same fact, so the markup and the rendering can never contradict each other the way they did before.

The two halves can still disagree with each other, in both directions. Neither has a consumer in this repository:

- **DOM yes, DI no** — a group _projected_ into an inset list (above). No `--pinned`, so it keeps its toggler and stays genuinely collapsible, which is the point. The purely visual inset rules that key on the group and its rows (section card, flattened row radii) still match it as a `.mlv-list--inset` descendant, so it wears the card. The sticky label chrome does not follow: that rule now selects `__label`, and a group with a toggler renders no `__label` — so the heading is the plain-variant toggler, and the old `.mlv-list--inset … __toggler` rule that used to dress it is gone.
- **DI yes, DOM no** — a group written _lexically_ inside `<mlv-list variant="inset">` but rendered elsewhere: an `<ng-template>` pulled out through `ngTemplateOutlet`, or a CDK portal. It gets `--pinned` and renders `__label`, with **no** `.mlv-list--inset` ancestor in the DOM. `.mlv-list-item-group__label` is declared only under that ancestor, so the label renders as unstyled body text rather than a sticky uppercase band. In that arrangement `--toggled`'s `padding: var(--mlv-padding-s); padding-inline-start: var(--mlv-spacing-6)` on `__content > div` is genuinely **not** overridden either, since the `.mlv-list--inset … { padding: 0 }` rule is what normally beats it. Style the label yourself, or render the group where it is declared.

---

## Affected consumers in this repository

Every `mlv-list-item-group` in the workspace is inside `variant="inset"`, so **no rendering changes** — the content was already on screen, and only the inert button disappears from it.

| Consumer                                                    | Variant | Binding      | Change                                                      |
| ----------------------------------------------------------- | ------- | ------------ | ----------------------------------------------------------- |
| `apps/docs/.../pages/list/examples/5/index.html` — 3 groups | inset   | bare `open`  | 3 inert `aria-expanded="false"` buttons gone; content as-is |
| `apps/docs/.../pages/list/examples/8/index.html` — 3 groups | inset   | bare `open`  | same                                                        |
| `libs/core/src/ssr-smoke.spec.ts`                           | no list | none         | none — no `MLV_LIST`, so still collapsible                  |
| `libs/core/dropdown/.../dropdown-panel-stacking.spec.ts`    | —       | CSS selector | reads `__label`'s `z-index` instead of `__toggler`'s        |

There is **no** non-inset consumer of `open` in the workspace, so the "three docs sections flip from collapsed to expanded" the issue anticipated does not occur here. It is still the change an external consumer on a plain list will see, which is what makes this a major.

---

## The mechanical edit

Most consumers make none. If you have one of these:

```html
<!-- You wrote the bare attribute meaning "collapsed", relying on the bug -->
- <mlv-list-item-group label="Network" open> + <mlv-list-item-group label="Network"></mlv-list-item-group></mlv-list-item-group>
```

```ts
// You drove the group imperatively through the model
- this.group().open.set(true);
+ // bind it instead: <mlv-list-item-group [open]="expanded()" (openChange)="expanded.set($event)">
```

```scss
/* You styled the inset section label */
- .mlv-list--inset .mlv-list-item-group__toggler { … }
+ .mlv-list--inset .mlv-list-item-group__label { … }
```
