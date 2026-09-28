# Density resolves from the nearest scope

**Packages:** `@malva-ui/cdk/density`, `@malva-ui/core` (form-utils, checkbox,
radio, list, tabs, segmented, form, page, sidebar, slider, popup, menu,
autocomplete)
**Issue:** #364 (owner decision D2, option (a)); settles #239

**No exported symbol, selector, `exportAs`, input, output, i18n key or BEM
class was renamed or removed.** One exported token's value type is
**widened** (`MLV_DENSITY_CONTEXT`, § 4.2), which fails to compile for code
that reads it into a `MlvDensity`. Everything else is behaviour: which density
level sizes a component when more than one density scope sits above it.

VERSIONING § 3: row 112 (_default behaviour — what a value means_) for the
resolution change; the widened token value breaks every reader the way row 109
(_narrowed … token value_) breaks every provider — row 115's "widened input
type" is minor because a consumer **writes** an input, while a token's value is
**read** — so it is classed as major with row 109; the new
`mlv-<block>--<density>` modifiers are row 114 and the five new optional
`mlvDensity` inputs row 115. `!` on `0.x`, so `0.2.0` → `0.3.0`.

---

## 1. What was wrong

The density mixins in `@malva-ui/styles` emit one rule per level shaped
`[class*='--x'] .block:not(<the other four>), .block[class*='--x']`. A block
that stamps its own modifier (`mlv-button--compact`) matches the second branch
and ignores its ancestors. A block that stamps nothing matches the first
branch against **every** ancestor carrying a `--x` substring — and with two
density ancestors, both rules match at equal specificity, so **stylesheet
source order** decides (tight < compact < spacious < airy), not DOM proximity.
There is no comfortable block, so a nested comfortable scope never applied.

Ten blocks stamped nothing: `mlv-form-control-wrapper` (every signal-form
field — input, textarea, select, combobox, number-input, the pickers,
search-field, tokenizer, color-picker popup), `mlv-label`, `mlv-checkbox`,
`mlv-radio`, `mlv-list-item`, `mlv-tab-item`, `mlv-segmented-item`,
`mlvFieldset`, `main[mlvPage]` and `mlv-sidebar`. Measured in Chromium on the
compiled CSS, with the real components (outer scope > inner scope):

| Ancestors              | Field height before | after (= wanted) | Checkbox / radio font before → after | Button (already scoped) |
| ---------------------- | ------------------- | ---------------- | ------------------------------------ | ----------------------- |
| spacious > compact     | 3.25rem             | **2.25rem**      | 16px → **14px**                      | 36px, unchanged         |
| compact > tight        | 2.25rem             | **1.75rem**      | 14px → **12px**                      | 28px, unchanged         |
| spacious > comfortable | 3.25rem             | **2.75rem**      | 16px → **14px**                      | 44px, unchanged         |
| compact > spacious     | 3.25rem             | 3.25rem          | 16px → 16px                          | 52px, unchanged         |

So inside `<form mlvForm mlvDensity="compact">` under a spacious app, buttons
and switches went compact while inputs, selects, checkboxes and radios stayed
spacious. The last row was right by source-order accident.

## 2. What changed

| Before                                                                                                                          | After                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The ten blocks above had no density directive and followed ancestor `--x` classes by source order                               | Each carries `MlvDensityDirective` as a host directive with its own `MLV_DENSITY_ELEMENT` and stamps `mlv-<block>--<density>`, resolved through DI                                      |
| Only `form[mlvForm]`, `mlv-tile`, `[mlvActionBar]` and `mlv-switch-group` provided `MLV_DENSITY_CONTEXT`                        | **Every** density directive provides it: its explicit `mlvDensity`, else the scope it inherited, else `undefined` (no opinion — transparent). Those four still pin their resolved level |
| The directive wrote its modifier from one `effect()` per host (5 × `removeClass` + 1 × `addClass`)                              | A host `[class]` binding over a `computed()` — Angular merges it with static and template classes and removes the previous modifier                                                     |
| `MLV_DENSITY_ELEMENT` was injected without `self`, so a bare `[mlvDensity]` borrowed an enclosing component's block name (#239) | Read from the directive's own element only; a bare `[mlvDensity]` stamps the region class `mlv--<density>` while it has an explicit value, nothing otherwise                            |
| `mlv-popup` / `mlv-menu` / `[mlvAutocomplete]` sized their rows only through the `mlv--<density>` class on the detached panel   | The panel class stays, and the explicit density also reaches the content through DI — the rows now stamp their own modifier, which shuts the panel class out                            |
| The slider's compact tick and the fieldset's dense legend matched an **ancestor** `--compact` / `--tight`                       | Keyed on the block's own modifier (`.mlv-slider[class*='--compact'] .mlv-slider__tick`, `.mlv-fieldset[class*='--compact'] > legend`)                                                   |

Resolution, everywhere: own `mlvDensity` → nearest density scope
(`MLV_DENSITY_CONTEXT`) → nearest `MlvDensityService`. A density scope is any
element carrying a density directive — `form[mlvForm]`, `mlvFieldset`,
`main[mlvPage]`, `mlv-sidebar`, `mlv-tab-group`, `mlv-segmented`,
`mlv-data-table`, a plain `<div mlvDensity="compact">`, … — plus `mlv-popup`,
`mlv-menu` and the autocomplete panel. `mlvDensityRoot` is **not** a scope
(§ 4.9).

Five blocks gained a public `mlvDensity` input with the directive:
`mlv-checkbox`, `mlv-radio`, `main[mlvPage]`, `mlv-sidebar`, `mlvFieldset`.
The other five (`mlv-form-control-wrapper`, `mlv-label`, `mlv-list-item`,
`mlv-tab-item`, `mlv-segmented-item`) take none and follow their scope.

## 3. Performance

The host binding also retires the per-instance effect. `zz-perf` probe (jsdom,
zoneless TestBed, one directive-backed leaf per row; a bare component as the
floor):

| n    | create before | create after | density flip before | flip after | bare create |
| ---- | ------------- | ------------ | ------------------- | ---------- | ----------- |
| 500  | 21.8 ms       | 16.9 ms      | 4.6 ms              | 3.8 ms     | 9.8 ms      |
| 2000 | 111.9 ms      | 94.9 ms      | 15.6 ms             | 13.7 ms    | 67.4 ms     |

(After: median of three runs; before: one run. jsdom has no layout — read the
ratio, not the milliseconds.) Ten more components now carry the directive, so
a page of plain inputs pays one `computed` and one host binding per wrapper
and label where it paid nothing; the table is the per-instance price.

## 4. Who is affected

### 4.1 A hand-written ancestor density class

`<div class="mlv--compact">`, a consumer class ending in `--compact`
(`card--compact` matched too — the rule is a substring match), or a class
toggled on `<body>`: none of these sizes a library component any more, because
every density-aware component now stamps its own modifier and that modifier
excludes the ancestor branch. They still size **plain markup** styled with the
same class.

**Do:** put the level on a density scope — `<div mlvDensity="compact">` (a
**static** attribute, and import `MlvDensityDirective`: the directive's
selector matches static values only, so `[mlvDensity]="x"` on a plain element
matches nothing), or `mlvDensity` on the nearest scoping component
(`form[mlvForm]`, `mlvFieldset`, `main[mlvPage]`, `mlv-sidebar`, …). For the
whole app, set `MlvDensityService`.

### 4.2 Code that reads `MLV_DENSITY_CONTEXT`

The token is now `InjectionToken<Signal<MlvDensity | undefined>>` (was
`Signal<MlvDensity>`): a scope with no opinion provides `undefined`, so that a
component-scoped `MlvDensityService` below it still applies.
`const d: MlvDensity = inject(MLV_DENSITY_CONTEXT)()` fails with TS2322.

**Do:** fall back explicitly —
`inject(MLV_DENSITY_CONTEXT, { optional: true })?.() ?? inject(MlvDensityService).density()`.
Providing the token is unaffected: a `Signal<MlvDensity>` still assigns, and
`provideMlvDensityContext()` keeps its signature. A provider **pins** its
subtree (the four library pins above do this on purpose); a subtree that must
follow a nearer service should get no provider.

### 4.3 Controls inside a scoping component follow it

Every density directive is a scope now, so an explicit `mlvDensity` on a
directive-backed host reaches the density-aware components declared inside
it. Before, only the four pinning containers reached directive-backed
children, and cascade-only children followed whichever ancestor class won the
source-order tie. Visible shapes: buttons, chips or checkboxes in a
`mlv-data-table mlvDensity="compact"` cell template, controls inside
`<mlv-sidebar mlvDensity="compact">`, `main[mlvPage] mlvDensity="compact">`,
`mlv-tab-group` / `mlv-segmented` items (unchanged level, now through DI), and
a `mlvFieldset mlvDensity="compact"` inside a spacious form (its fields,
labels, checkboxes and radios go compact — before, only its switches did).

**Do:** nothing where that is what you meant. To keep one control at another
level, give it its own `mlvDensity` (buttons, chips, badges, checkboxes,
radios, switches and the scoping components all take one); for a field whose
component has no scoping input, wrap it in `<div mlvDensity="…">`.

### 4.4 A component-scoped `MlvDensityService` under an opinionated scope

A scope with an opinion beats every service. `providers: [MlvDensityService]`
on a component inside `form[mlvForm]` (which always pins), inside a
`[mlvDensity]` element, or inside any scope with an explicit value, no longer
sizes its fields — before, the fields followed the service's `mlvDensityRoot`
class while the buttons already followed the form.

**Do:** drive a local density switch through a nearer scope instead —
`<form mlvForm [mlvDensity]="density()">` binds, because `mlvDensity` is a
host-directive input there. The docs input / select / combobox density
examples moved to exactly this.

### 4.5 A bare `[mlvDensity]` element inside a component (#239)

`MLV_DENSITY_ELEMENT` was read with a plain `inject`, so a
`<div mlvDensity="compact">` inside a component providing the token (the
issue's case: inside `<header mlvActionBar>`) stamped
`mlv-action-bar--compact` on the `div`; with no such component above, it
stamped **nothing** and provided no context — it was inert for every
component. It now reads the token from its own element only: a bare directive
stamps `mlv--compact` while it has an explicit value, nothing otherwise, and
is a density scope for its subtree either way. The same holds for any
component that carries the directive with no element name of its own
(`mlv-drawer-header` gains `mlv--compact` when given an explicit
`mlvDensity`).

**Do:** nothing, unless a stylesheet keyed on the borrowed class — key it on
`.mlv--compact`, or better on the component's own modifier. A
`<div mlvDensity="…">` that used to change nothing now sizes what is inside
it; delete it if that was never meant.

### 4.6 Class snapshots and selectors

The ten blocks gain a modifier: `mlv-form-control-wrapper--comfortable`,
`mlv-label--comfortable`, `mlv-checkbox--…`, `mlv-radio--…`,
`mlv-list-item--…`, `mlv-tab-item--…`, `mlv-segmented-item--…`,
`mlv-fieldset--…`, `mlv-page--…`, `mlv-sidebar--…`. A consumer's static,
`[class]` or `[class.x]` classes on the host survive and a density flip
removes the previous modifier (pinned in `density-scope.spec.ts`).

**Do:** update exact-`class` snapshots; select by the block class, not the
whole attribute.

### 4.7 Content rendered away from where it is declared

DI follows the **declaration** site, so a density-aware component resolves the
scope around the template that declares it, not the DOM it lands in: content
projected into a component resolves through that component's host; a
`<ng-template>` stamped elsewhere with `ngTemplateOutlet` resolves where it was
written; a `<mlv-drawer>` declared inside `main[mlvPage] mlvDensity="compact"`
renders its controls compact although the pane is portaled to `<body>` (it
used to take the service level there). For overlays:
`mlv-popup` hands its explicit `mlvDensity` to the content declared in its
`mlvPopupContent` template; `mlv-menu` hands its own to projected **and**
data-driven items (a projected `mlv-list-item` resolves through the menu host,
not the popup); `[mlvAutocomplete]` gives its panel a child injector carrying
`mlvAutocompleteDensity`. `mlv-select`, `mlv-combobox`, `mlv-pagination` and
`mlv-breadcrumb` render their rows in their own popup, so their `mlvDensity`
reaches the rows as before. Explicit density on any of these now also sizes
directive-backed content in the panel (a button in a popup), which used to
ignore it.

**Do:** set `mlvDensity` on the component whose template declares the
content, or on the content itself. A density-aware component inside a custom
`mlv-select` option template follows the select's **surrounding** scope, not
the panel density — give it its own `mlvDensity` there.

### 4.8 Server rendering

The modifier is a host binding, so the server payload already carries every
resolved `mlv-<block>--<density>` class — for the ten new blocks too — and
hydration writes the same value (`ssr-smoke.spec.ts` pins a
`mlvFieldset mlvDensity="compact"` inside a density-less form: its checkboxes
and radios render `--compact` on the server, the fields beside it
`--comfortable`). A server whose `MlvDensityService` resolves a different
level from the client re-stamps at hydration, as every directive-backed
component already did.

### 4.9 `mlvDensityRoot`

Unchanged: it writes `mlv--<service density>` and nothing else. It is **not**
a scope — it neither reads nor provides `MLV_DENSITY_CONTEXT`, because a root
publishing the global level would shadow every component-scoped
`MlvDensityService` below it. Since components resolve the service directly,
the root class now sizes only application markup keyed on `.mlv--<density>`.

**Do:** keep it for that markup; nothing to change.

## 5. Unchanged

- Every component that already stamped a modifier (button, button-close,
  badge, chip, icon-toggle, switch, switch-group, tile, action-bar, form,
  table, data-table, tab-group, segmented, chat, time-picker, number-input,
  slider, scheduler, taskboard) keeps it, its inputs and its level wherever
  only one scope was in play.
- A page with one density source (the service, or one scope) renders the same
  levels as before.
- `MlvDensityDirective.effectiveDensity`, `MLV_DENSITY_ELEMENT`,
  `provideMlvDensityContext`, `MlvDensityService` and the restricted variants
  keep their names and signatures; `drawer-header`'s compact pin still wins.
- `libs/styles` SCSS (the density mixins) is not public; the compiled CSS
  still ships every rule it did.
- `mlv-scrubber` was on the audit's list but has no density rule at all (its
  type ramp is the `--mlv-scrubber-font-size` custom property its consumer
  sets), so it gains nothing.

## 6. In-repo

- Docs `/input` example 4, `/select` example 5 and `/combobox` example 5
  switched density with a component-scoped `MlvDensityService`, which the
  docs example scope (always opinionated) now beats; they bind
  `<form mlvForm [mlvDensity]="density()">` instead.
- `density.scss`'s header said "the closest modifier in the DOM tree wins",
  which was false; it now says what the selectors do and why each component
  stamps its own modifier. `libs/styles/CLAUDE.md` keeps its (correct)
  "the later compiled rule wins" and adds the Angular half and the rule for a
  new block; `example-scope.ts` and the density / form-utils / form / list /
  popup / menu / autocomplete docs follow.
- Specs: `density-scope.spec.ts` (resolution, transparency, pins, host-class
  merge, #239, declaration-site caveat) and one `*-density.spec.ts` per new
  block (form-control-wrapper, checkbox, radio, list-item, tab-item,
  segmented-item, fieldset, page, sidebar), plus the popup / menu /
  autocomplete scope specs and the compiled-CSS pins for the slider tick and
  the fieldset legend — each red on `main` or with its fix ablated.
