# Malva UI — Visual Language Spec (harmonization 2026-08-24)

**Status:** awaiting owner approval. No sweep starts before an explicit yes.
**Consumes:** `docs/audits/harmonization-2026-08-24/AUDIT.md` (35 findings + 3 user exhibits), `user-exhibits.md`, `inventory.md`, `libs/styles/src/lib/theme.scss` (1177 lines).
**Produces:** the single source of truth every downstream SCSS sweep executes from.
**North star:** keep Malva identity, refine toward Taiga UI polish — token discipline, calm surfaces, confident density.

## How to read this document

- Each dimension section states its rules as `current → target (rationale)`. Every rule cites at least one AUDIT finding ID, or is explicitly labelled **preventive**.
- The **Token change list** is the complete set of `theme.scss` edits, both themes, with exact resolved hex values. Nothing outside that table changes in `theme.scss`.
- Each **Sweep worklist** gives `file:line` targets and the rule that applies. Line numbers are as of the current working tree; if a line has moved, match on the quoted declaration, not the number.
- Every value in this document was resolved through `libs/styles/src/lib/theme-contrast.mjs` (the same resolver `styles:test` uses) — the hex values and contrast ratios are computed, not estimated.
- Executors: do not substitute your own values. If a rule looks wrong, stop and report; do not improvise.

**Citation forms used here.** `SL-1` … `MO-5` are the AUDIT's dimension findings (its `### SL-1 · …` headings). `EX-A.1`, `EX-B.2`, `EX-C.4` are this document's shorthand for the AUDIT's user-exhibit sub-findings, which it heads as `### A.1`, `### B.2`, `### C.4` under `## User exhibit A/B/C`. To find `EX-A.3` in the AUDIT, look for `### A.3`.

## Owner's standing interpretations (from `user-exhibits.md`) — where they land

| Owner interpretation | Becomes rule |
| --- | --- |
| 1. Accent budget must cover repeated control clusters: routine per-row actions default to neutral/ghost; accent reserved for the single primary action of the view. | **AB-R1**, **AB-R2**, **AB-R3** |
| 2. Icon-button glyph-to-container ratio needs an explicit rule so composition contexts cannot drift. | **CH-R4** |
| 3. List/row recipe: boundaries via spacing + separators, not per-item bordered cards; muted secondary text; restrained avatar palette. | **SL-R5**, **AB-R6** |

## Rule index

| § | Rules | Findings covered |
| --- | --- | --- |
| 1 Surface ladder | SL-R1 … SL-R6 (6) | SL-1, SL-2, SL-3, SL-4, SL-5, SL-6, EX-A.1, EX-C.1, EX-C.3, EX-C.4 |
| 2 Radius roles | RR-R1 … RR-R5 (5) | RR-1, RR-2, RR-3, RR-4, RR-5, EX-B.1 |
| 3 Height rhythm | CH-R1 … CH-R6 (6) | CH-1, CH-2, CH-3, CH-4, CH-5, CH-6, EX-A.5, EX-B.2 |
| 4 Accent budget | AB-R1 … AB-R8 (8) | AB-1 … AB-7, EX-A.2, EX-A.3, EX-A.4, EX-C.2, EX-B.1, EX-B.2 |
| 5 State formula | SF-R1 … SF-R6 (6) | SF-1 … SF-6, EX-A.6, EX-B.1, EX-B.2 |
| 6 Motion | MO-R1 … MO-R5 (5) | MO-1, MO-2, MO-3, MO-4, MO-5 |

**36 rules total.**

**§7 · Composition recipes** carries no rules and no worklist entries. It is the showcase-layer instruction set derived from the six dimensions above, added after all six sweeps landed; the counts in this index and in the Self-check are unaffected by it.

---

# 1 · Surface ladder

## SL-R1 · The resting ladder has four distinct values in light, and `sunken` stops being a duplicate

**Current** — light has three distinct resting values across five tokens (`theme.scss:249-253`, `:302`): `raised` 255, `base` 250, and `subtle` = `sunken` = `neutral-1` = 245. Total spread 10 of 255 (3.9%). Dark spans 28.

**Target** — light spread becomes 26 of 255 (10.2%), matching dark:

| token | light | value |
| --- | ---: | --- |
| `--mlv-background-raised` | 255 | `#ffffff` (unchanged) |
| `--mlv-background-base` | 250 | `var(--mlv-palette-neutral-50)` `#fafafa` (unchanged) |
| `--mlv-background-subtle` | 245 | `var(--mlv-palette-neutral-100)` `#f5f5f5` (unchanged) |
| `--mlv-background-neutral-1` | 245 | `var(--mlv-palette-neutral-100)` `#f5f5f5` (unchanged) |
| **`--mlv-background-sunken`** | **229** | **`var(--mlv-palette-neutral-200)` `#e5e5e5`** — changed. **Owner override 2026-08-25: REVERTED to `neutral-100` `#f5f5f5`** (`7732fea9`); see "Post-implementation owner overrides" #8 below. Do not re-apply this row. |

`--mlv-background-neutral-1` deliberately keeps the same value as `--mlv-background-subtle`. They are the interactive and the structural spelling of one quiet neutral fill; that coincidence is intentional and is **not** drift. What was drift is `sunken` — the deepest well in the system — resolving to the same pixel as a quiet band. It now sits 16 values below.

> **Superseded in part (owner override #8, `7732fea9`).** `--mlv-background-sunken` shipped at `#e5e5e5` and was reverted to `#f5f5f5` the same day: it read too dark for static "recessed tray" zones and, because the data table borrowed it for row hover, made a hovered row read as pressed. **The light resting ladder therefore ships at 3 distinct values (245/250/255), not 4, and the spread is 10, not 26** — SL-2/SL-3's headline defect is answered by SL-R2's new elevation rung + SL-R3's shadow discipline + SL-R4's nesting rule, not by the `sunken` retune. Everything else in SL-R1 stands. A future sweep must not re-darken `sunken` from this rule.

**Rationale** — SL-2 ("the resting light ladder spans 4% of the value range"), SL-3 ("dark's spread is 2.8× light's"). Deepening `sunken` alone is the only move available: `base`, `subtle`, `raised` and `neutral-1` are all in `theme-contrast.spec.mjs`'s message-surface guard and cannot go below `#f5f5f5` without a foreground change; `sunken` is not, and its darkening is what gives the state ramp (SF-R5) a floor to land on.

**Also required by this rule:** `--mlv-text-positive` and `--mlv-text-warning` move one palette stop down in light (see Token change list). At `success-700` / `warning-700` they score 3.98 / 3.99 on the new `sunken` and 4.35 on the new hover fill — under AA. At `-800` they score 5.66 / 6.18. Dark is unchanged. *(After override #8 the `sunken` half of this dependency is moot — on `#f5f5f5` the `-700` values would have cleared AA. The `-800` move was accepted on its own merits at owner gate item 4 and ships regardless; the 4.35-on-hover figure still binds it.)*

## SL-R2 · In light, elevation above the raised surface is carried by shadow, not by fill; in dark, by fill

**Current** — `--mlv-elevation-bg-1` … `-5` all resolve to `var(--mlv-background-raised)` = `#ffffff` in light (`theme.scss:484-489`, comment: *"light mode — all point to raised surface"*), and to five distinct greys in dark (`theme.scss:1056-1065`). Nineteen stylesheets consume the rungs. A card, a popup and a form field are one pixel value in light.

**Target** — the light ladder gets one real rung and a declared role per rung:

| rung | role | light | dark (unchanged) |
| --- | --- | --- | --- |
| `--mlv-elevation-bg-1` | **flush** — sits at canvas level, separated by border only. Consumers: `mlv-tile` (`tile.scss:38`) and the `elevated` button variant's pressed fill (`button.scss:56`). | **`var(--mlv-background-base)` `#fafafa`** | `#1e1e1e` |
| `--mlv-elevation-bg-2` | **raised** — card, dialog, drawer, calendar, checkbox box, colour-picker, tiles drag ghost, button `elevated`. Depth vs rung 1 = fill step + `--mlv-shadow-raised`. | `var(--mlv-background-raised)` `#ffffff` | `#262626` |
| `--mlv-elevation-bg-3` | **floating** — popup, toast, notification, page-header, form-control container, editor chrome. Depth vs rung 2 = `--mlv-shadow-floating`, **not** fill. | `var(--mlv-background-raised)` `#ffffff` | `#333333` |
| `--mlv-elevation-bg-4` | **overlay** — drawers and side overlays. Depth = `--mlv-shadow-overlay`. | `var(--mlv-background-raised)` `#ffffff` | `#404040` |
| `--mlv-elevation-bg-5` | **switch track thumb only** — never behind text. | `var(--mlv-background-raised)` `#ffffff` | `#707070` |

Only rung 1 changes value. Rungs 2–5 keep `#ffffff` in light **by design**: white is the ceiling of the light range, so stacking more fills above it is impossible, and the reference solves the same problem with shadow (`taiga-refs/taiga-select.png`, `taiga-dialog.png` — overlay panels carry a soft drop shadow and no border). What changes is that the ladder now has a **declared** role per rung, which SL-R3 and SL-R4 then enforce.

**Rationale** — SL-1 (the ladder is a no-op in light), SL-3 (light/dark rung ordering is inverted). Rung 1 dropping to `#fafafa` is the single change that ends EX-A.1's "five concentric surfaces, one pixel value": a nested tile tree stops being a stack of white cards.

## SL-R3 · Overlay membership is expressed by the semantic shadow alias, never by a raw step and never by a literal

**Current** — the raw numbered scale outvotes the semantic aliases **27 uses to 13**. Counted in the working tree: `--mlv-shadow-1` ×12, `-3` ×8, `-2` ×5, `-4` ×1, `-0` ×1 against `floating` ×6, `raised` ×3, `overlay` ×2, `modal` ×1, `flat` ×1. (The AUDIT's 24/13 undercounts `-2` and `-3` by one each and omits the single `-0`.) `popup.scss:62` bypasses tokens entirely with `drop-shadow(0 0.75rem 1.75rem rgba(0, 0, 0, 0.12))`.

**Target** — every elevation shadow is one of exactly five aliases, chosen by role:

| surface role | shadow |
| --- | --- |
| flush / same-plane | `var(--mlv-shadow-flat)` |
| card, tile, raised panel, chip `floating` | `var(--mlv-shadow-raised)` |
| popup, dropdown, menu, select/combobox panel, tooltip, toast, notification | `var(--mlv-shadow-floating)` |
| drawer, side overlay, drag ghost | `var(--mlv-shadow-overlay)` |
| modal dialog | `var(--mlv-shadow-modal)` |

`--mlv-shadow-0` … `-5` remain declared but are **not** referenced outside `theme.scss`. A literal `box-shadow` / `drop-shadow` colour is permitted **only** where a `filter` function is required (it cannot accept a multi-layer list) — currently one site, `popup.scss:62`, which keeps its literal with the existing explanatory comment intact but must additionally set `box-shadow: var(--mlv-shadow-floating)` on the panel surface.

Inset rings (`box-shadow: inset …`) are **not** elevation and are out of scope for this rule.

**Rationale** — SL-5 ("the overlay layer does not lift off the page"; every panel in `menu--open.png`, `select--open.png`, `popup--open.png` reads as a bordered rectangle flush on the page).

## SL-R4 · Nesting depth ≥ 1 drops the surface: no fill, no border, no radius — one rail for the whole nested group

**Current** — `baseline/states/website-builder--page-layouts.png` shows **five concentric bordered surfaces**, all `#ffffff` in light and all `#1e1e1e` in dark, each drawn with the same 1px `--mlv-border-subtle` hairline. Depth is signalled only by the count of borders crossed, which the eye cannot integrate past about two.

**Target** — a `mlv-tiles` container at `depth > 0` renders its children flush and expresses containment with a single leading rail plus inset padding:

```scss
// libs/core/tile/src/lib/tiles/tiles.scss — TOP LEVEL, after the `.mlv-tiles`
// block's closing brace at :126. Not nested inside it: the rules below target
// `.mlv-tile`, which is a different block.
.mlv-tiles--nested {
  padding-inline-start: var(--mlv-spacing-4);
  border-inline-start: var(--mlv-stroke-width) solid var(--mlv-border-subtle);

  > .mlv-tiles__item-root > .mlv-tile,
  > .mlv-tiles__item-root.mlv-tile {
    background-color: transparent;
    border-color: transparent;
    border-radius: 0;
    box-shadow: none;
  }
}

// Control compaction (CH-R5 item 2). `.mlv-tile` declares
// `--mlv-tile-control-size` on ITSELF (tile.scss:26), so a declaration on the
// ancestor is shadowed and would never win — the selector must reach the tile.
// Doubled `.mlv-tiles.mlv-tiles--nested` takes this to (0,3,0), matching the
// specificity of `[class*='--tight'] .mlv-tile` density rules — a tie, so this
// block MUST live at the END of `tile.scss`, after all density blocks, to
// override them deterministically.
.mlv-tiles.mlv-tiles--nested .mlv-tile {
  --mlv-tile-control-size: var(--mlv-height-xs);
}
```

`mlv-tiles` already computes `depth` (`tiles.ts:198`) and already publishes it as `--mlv-tiles-depth` (`tiles.ts:100`). Add the class binding beside it:

```ts
'[class.mlv-tiles--nested]': 'depth > 0',
```

Result at the exhibit's deepest path: page canvas → one raised section card → three rails. **Two** bordered levels instead of six.

**Rationale** — SL-4 (nesting depth is communicated 100% by borders), SL-6, EX-A.1, EX-C.1. The second block above is CH-R5 item 2, delivered here because it shares the `--nested` hook.

## SL-R5 · List/row recipe — boundaries come from spacing and one hairline, never from a per-row card

**Current** — each row in `baseline/light/47-list.png` is its own bordered, rounded surface with an inter-row gap, nested inside an inset list container, itself inside the docs preview card: three bordered levels for one flat list. Because the boundary is a card, the whitespace that would make the list breathe lives **outside** the row, where it reads as separation rather than generosity. Measured pitch ~70px carrying a three-line text block — tight inside, separated outside.

**Target** — the row recipe, in this order:

1. **No per-row border, no per-row background at rest.** `--mlv-list-item-bg: transparent` (already correct at `list-item.scss:9`). A row acquires a fill only on hover, selection or focus.
2. **Distinctness comes from internal whitespace.** `--mlv-list-item-padding-block` steps up one notch at every density (see worklist), so the text block sits inside the row rather than filling it.
3. **One hairline between consecutive rows**, drawn by the container, never by the row: `border-top: var(--mlv-stroke-width) solid var(--mlv-border-subtle)` on `.mlv-list-item + .mlv-list-item`. `variant="inset"` already does exactly this (`list.css:57-76`) — it becomes the behaviour of the plain list too, and the inset variant keeps only its sunken tray and rounded caps.
4. **A bold title / muted subtitle pair carries hierarchy**: `--mlv-text-primary` + `--mlv-font-weight-medium` on `__title`, `--mlv-text-secondary` on `__byline`. **Already correct** — `list-item.scss:197-200` and `:210-212` ship exactly this. No sweep entry; stated so the recipe is complete and so no executor "fixes" it.
5. **At most one accent mark per row** — see AB-R1.

`taiga-refs/taiga-cell.png` ("Left side"): four rows, one white surface, no separator at all, a consistent leading media slot, a bold/muted type pair, and a large internal vertical gap.

**Rationale** — SL-6, EX-C.1, EX-C.3, EX-C.4; owner interpretation 3.

## SL-R6 · A component never redeclares a global surface token against a chrome whose polarity it cannot see

**Current** — `page-shell.scss:98-99, 129, 133` redeclare the form-control container's background and border with literal `rgb(255 255 255 / …)` values, so a field hosted in the shell chrome resolves a hardcoded **white** ramp no matter what colour the chrome actually is. `settings-access.html:29` sets `color="var(--mlv-background-base)"` — a near-white chrome — where a white-on-white fill is invisible.

**Target** — chrome remapping is permitted, but a remapped value must be a `color-mix` of `--mlv-page-shell-effective-foreground` **against `--mlv-page-shell-effective-background`** — never against `transparent`, never a literal `rgb(255 255 255 / …)`. The foreground is by construction the contrasting colour, so one formula is correct on a light chrome, a dark chrome and a brand chrome. Percentages: see the authoritative table in SF-R2.

**Explicit exception — a self-contained dark-scrim overlay is not chrome.** `mlv-search-field`'s overlay (`search-field.scss:69-148`) renders **into the CDK overlay container, outside `.mlv-page-shell`**, as the comment at `:67-68` states. `--mlv-page-shell-effective-*` therefore do not inherit there at all; a `color-mix` referencing them would be invalid-at-computed-value and would strip the panel's chrome entirely. The panel supplies its own reference: `search-field.scss:70` paints a `rgb(0 0 0 / 55%)` backdrop with a `0.5rem` blur, and the white ramp at `:132-147` is read **against that scrim**, not against the page. Both are correct as written and are **out of scope for every sweep in this document.** A component that owns its own backdrop owns its own polarity.

**Rationale** — SF-2 (the page-shell remap was calibrated for a blue chrome and produces rgb(190,190,190) on a light one), SL-2 (state fills overshoot the ladder).

---

## Sweep worklist — Dimension 1

| # | Target | Rule | Change |
| ---: | --- | --- | --- |
| 1.1 | `libs/styles/src/lib/theme.scss:253` | SL-R1 | ~~`--mlv-background-sunken: var(--mlv-palette-neutral-100)` → `var(--mlv-palette-neutral-200)`~~ **WITHDRAWN — owner override #8 (`7732fea9`). Ships at `neutral-100`; do not re-apply.** |
| 1.2 | `libs/styles/src/lib/theme.scss:440` | SL-R1 | `--mlv-text-positive: var(--mlv-palette-success-700)` → `var(--mlv-palette-success-800)` |
| 1.3 | `libs/styles/src/lib/theme.scss:442` | SL-R1 | `--mlv-text-warning: var(--mlv-palette-warning-700)` → `var(--mlv-palette-warning-800)` |
| 1.4 | `libs/styles/src/lib/theme.scss:485` | SL-R2 | `--mlv-elevation-bg-1: var(--mlv-background-raised)` → `var(--mlv-background-base)`. Replace the section comment at `:484` with the rung-role table from SL-R2. |
| 1.5 | `libs/styles/src/lib/theme.scss:486-489` | SL-R2 | Leave values; add one role comment per rung (flush / raised / floating / overlay / switch-thumb). |
| 1.6 | `libs/core/tile/src/lib/tiles/tiles.ts:100` | SL-R4 | Add `'[class.mlv-tiles--nested]': 'depth > 0',` to the `host` object. |
| 1.7 | `libs/core/tile/src/lib/tiles/tiles.scss` (append inside `.#{$block}` sibling scope, after `:125`) | SL-R4 | Add the `.mlv-tiles--nested` block verbatim from SL-R4. |
| 1.8 | `libs/core/popup/src/lib/popup/popup.scss:57-63` | SL-R3 | Keep the `drop-shadow` literal and its comment; add `box-shadow: var(--mlv-shadow-floating);` to the same `&--shadow` block. |
| 1.9 | `libs/core/card/src/lib/card/card.scss:18` | SL-R3 | `box-shadow: var(--mlv-shadow-1)` → `var(--mlv-shadow-raised)` |
| 1.10 | `libs/core/card/src/lib/card/card.scss:68` | SL-R3 | `box-shadow: var(--mlv-shadow-3)` → `var(--mlv-shadow-floating)` |
| 1.11 | `libs/core/card/src/lib/card/card.scss:72` | SL-R3 | `box-shadow: var(--mlv-shadow-4)` → `var(--mlv-shadow-overlay)` |
| 1.12 | `libs/core/chip/src/lib/chip/chip.scss:225` | SL-R3 | `--mlv-chip-shadow: var(--mlv-shadow-2)` → `var(--mlv-shadow-raised)` |
| 1.13 | `libs/core/chip/src/lib/chip/chip.scss:228` | SL-R3 | `--mlv-chip-shadow: var(--mlv-shadow-3)` → `var(--mlv-shadow-floating)` |
| 1.14 | `libs/core/chip/src/lib/chip/chip.scss:232` | SL-R3 | `--mlv-chip-shadow: var(--mlv-shadow-1)` → `var(--mlv-shadow-raised)` |
| 1.15 | `libs/core/button/src/lib/button/button.scss:58-60` | SL-R3 | `elevated` map: `--mlv-shadow-2` → `var(--mlv-shadow-raised)`, `--mlv-shadow-3` → `var(--mlv-shadow-floating)`, `--mlv-shadow-1` → `var(--mlv-shadow-raised)` |
| 1.16 | `libs/core/slider/src/lib/slider/slider.scss:102` | SL-R3 | `var(--mlv-shadow-2, 0 2px 6px rgba(0,0,0,0.18))` → `var(--mlv-shadow-raised)` (drop the literal fallback) |
| 1.17 | `libs/core/slider/src/lib/slider/slider.scss:123` | SL-R3 | `var(--mlv-shadow-3, 0 4px 10px rgba(0,0,0,0.22))` → `var(--mlv-shadow-floating)` |
| 1.18 | `libs/core/switch/src/lib/switch/switch.scss:140` | SL-R3 | `box-shadow: var(--mlv-shadow-1)` → `var(--mlv-shadow-raised)` |
| 1.19 | Remaining raw `--mlv-shadow-{1,2,3,4}` uses under `libs/core`, `libs/cdk`, `libs/editor` not listed above | SL-R3 | Map to the alias by role using SL-R3's table. Enumerate with `grep -rn --include='*.scss' 'var(--mlv-shadow-[0-9]' libs/core libs/cdk libs/editor`. Report any site whose role is ambiguous rather than guessing. |
| 1.20 | `libs/core/list/src/lib/list/list.css:5-16` | SL-R5 | Add the shared row hairline to the plain list: `.mlv-list:not(.mlv-list--inset) > .mlv-list-item + .mlv-list-item { border-top: var(--mlv-stroke-width) solid var(--mlv-border-subtle); }`. **The `:not()` is required** — `--inset` already draws its own inset divider via `::after` at `list.css:62-71`, so without it every inset row gets two hairlines. Set `--mlv-list-gap: 0` on `.mlv-list` (the gap moves inside the row per 1.21); `--inset` re-declares its own `--mlv-list-gap` at `:31` and is unaffected. |
| 1.21 | `libs/core/list/src/lib/list-item/list-item.scss:14, 30, 34, 38, 42` | SL-R5 | `--mlv-list-item-padding-block` steps up one notch at every density: comfortable `--mlv-spacing-2` → `--mlv-spacing-3`; tight `-1` → `-1-5`; compact `-1-5` → `-2`; spacious `-2-5` → `-4`; airy `-3` → `-5`. `--mlv-list-item-padding-inline` values are unchanged. |
| 1.22 | `libs/core/list/src/lib/list-item/list-item.scss:16` | SL-R5 | `--mlv-list-item-radius: var(--mlv-radius-m)` → `0`. A row inside a hairline-separated list has no corners of its own; the container clips. (Selection fill still paints edge-to-edge.) |
| 1.23 | `libs/core/list/src/lib/list/list.css:28-52` | SL-R5 | `--inset` keeps its sunken tray and its first/last rounded caps; delete `--mlv-list-item-radius: 0` at `:39` (now the global default) and keep `padding-inline`. |
| 1.24 | `libs/core/page/src/lib/page-shell/page-shell.scss:98, 99, 129, 133` | SL-R6 | Replace each `rgb(255 255 255 / N%)` with `color-mix(in srgb, var(--mlv-page-shell-effective-foreground) N%, var(--mlv-page-shell-effective-background))`. **Percentages are unchanged on these four lines** (10 / 30 / 40 / 50) — they are contrast-tuned foreground and border mixes, not surface-depth fills. The six *row-state* mixes are handled by 5.15/5.16, which do lower their percentages. See the authoritative table in SF-R2. |
| 1.25 | `libs/core/search-field/src/lib/search-field/search-field.scss:70` and `:132-147` | SL-R6 | **No change.** Verified out of scope: the overlay renders into the CDK overlay container outside `.mlv-page-shell` (see the comment at `:67-68`), so `--mlv-page-shell-effective-*` never inherit there and a `color-mix` on them would be invalid-at-computed-value. The white ramp at `:132-147` is read against the component's own `rgb(0 0 0 / 55%)` blurred scrim at `:70`, which must keep its value — `--mlv-background-overlay` is `rgba(0,0,0,0.22)` and would lighten the scrim enough to break the white-on-dark panel. Listed so no sweep re-derives it. |
| 1.26 | `libs/styles/src/lib/theme-contrast.spec.mjs:165-170` | SL-R1 | Add `'--mlv-background-sunken'` to `MESSAGE_SURFACES` — the new floor must be guarded. *(Landed and retained after override #8: guarding `sunken` is still correct at `#f5f5f5`.)* |
| 1.27 | `libs/styles/src/lib/theme-contrast.spec.mjs` (new assertion in the light-values test at `:78-84`) | SL-R1 | ~~Add `assert.equal(hex('--mlv-background-sunken', 'light'), '#e5e5e5');`~~ **AMENDED by owner override #8 — the pin is `'#f5f5f5'` (`:91`).** |

---

# 2 · Radius roles

## RR-R1 · Radius is chosen by role. A component reads its role token and nothing else

**Current** — 118 raw-step uses (`radius-s` 32, `-m` 29, `-full` 25, `-l` 11, `-xs` 10, `-xl` 8, `-2xl` 2, `-3xl` 1) against **5** semantic-token uses, plus 16 `50%` and 8 literal-rem radii (inventory §3). Four role tokens are contradicted by their own component; three more are bypassed even where the value matches. The drift is self-documented at `dropdown-panel.scss:22`.

**Target** — eight roles, each with one corrected value, each consumed by name:

| role token | current | new | consumed by |
| --- | --- | --- | --- |
| `--mlv-radius-button` | `radius-m` 6px | **`radius-l` 8px** | `mlv-button` (all shapes except `circle`/`pill`), `mlv-button-toggle`, `mlv-segmented-item` |
| `--mlv-radius-input` | `radius-m` 6px | **`radius-l` 8px** | `mlv-form-control-wrapper` and every control inside it |
| `--mlv-radius-card` | `radius-xl` 12px | `radius-xl` 12px (unchanged) | `mlv-card`, `mlv-tile`, `mlv-list[variant="inset"]` tray |
| `--mlv-radius-dialog` | `radius-2xl` 16px | `radius-2xl` 16px (unchanged) | `mlv-dialog`, `mlv-drawer` |
| `--mlv-radius-panel` | `radius-xl` 12px | **`radius-l` 8px** | `mlv-popup`, `mlv-dropdown-panel`, `mlv-menu`, `--mlv-popover-surface-radius` |
| `--mlv-radius-tag` | `radius-s` 4px | **`radius-full`** | `mlv-chip` |
| `--mlv-radius-badge` | `radius-full` | `radius-full` (unchanged) | `mlv-badge`, `mlv-status-indicator` |
| `--mlv-radius-tooltip` | `radius-m` 6px | `radius-m` 6px (unchanged) | `mlv-tooltip` |

`--mlv-radius-button` and `--mlv-radius-input` land on the same value **deliberately**: a field and its submit button are the most common pairing in the library (CH-1) and must share a silhouette. `--mlv-radius-panel` moving to 8px resolves the drift `dropdown-panel.scss:22` already documents in a comment.

**Two visible geometry changes fall out of this table** — flagged because neither is a no-op refactor:

- **`mlv-dialog`'s corner doubles, 8px → 16px** (`dialog.scss:28` currently hardcodes `--mlv-radius-l`, and `--mlv-radius-dialog` is 16px). This is the intended direction — a modal is the largest surface in the system and reads under-rounded at 8px next to a 12px card — but it is the single most noticeable shape change in this document.
- **`mlv-chip` becomes a pill**, 8px → `radius-full` (RR-R3).

Everything else in the table either keeps its rendered value or moves by ≤2px.

**Rationale** — RR-1.

## RR-R2 · Radius does not ramp with density

**Current** — button 4 / 6 / 8 / 12 / 16px across densities (`button.scss:104-129`), form-control 4 / 6 / 8 / 12px (`form-control-wrapper.scss:23-49`), tile 6 / 8 / 8 / 12 / 16px (`tile.scss:50-113`), card 12 / 16 / 24px by `size` (`card.scss:27-49`). Because the height and radius ramps are not proportional, the button's corner-to-height ratio drifts from 0.125 at `tight` to 0.235 at `airy` — the silhouette changes character, not just scale.

**Target** — one radius per role at every density and every size. Delete `--mlv-btn-radius` from all four density blocks, `--form-ctrl-radius` from all four, `--mlv-tile-radius` from all five, and card's per-`size` radius from all three. `taiga-refs/taiga-button.png` "Sizes": Large / Medium / Small / Extra-small carry one corner, so the corner reads as the same *role* at every size.

**Rationale** — RR-2.

## RR-R3 · Badge and chip share a palette, so they share a geometry

**Current** — the chip docs state the tones are *"the same palette as `mlv-badge`"*, yet badge is `radius-full` (`badge.scss:30`) and chip is `radius-l` 8px (`chip.scss:34`). Two geometries for one semantic job.

**Target** — both resolve `radius-full`, badge through `--mlv-radius-badge`, chip through `--mlv-radius-tag`. `mlv-chip[rounded]` keeps its public input and its `&--rounded` rule; the rule becomes a redundant re-declaration and is documented as deprecated in `libs-chip.md` rather than removed (removing it is a breaking API change).

**Rationale** — RR-3.

## RR-R4 · A component's implicit default equals its documented default equals its role token

**Current** — `card.scss:9` sets `--mlv-card-radius: var(--mlv-radius-3xl)` (24px) on the block; `card.scss:43` sets `size-m` — the documented default — to `radius-2xl` (16px). `<mlv-card>` without a `size` renders 24px, `<mlv-card size="m">` renders 16px, and neither matches `--mlv-radius-card` (12px).

**Target** — `--mlv-card-radius: var(--mlv-radius-card)` on the block; no per-size override anywhere. All three spellings render 12px.

**Rationale** — RR-4.

## RR-R5 · One spelling of "round"

**Current** — `50%` ×16, `var(--mlv-radius-full)` ×25, `button.scss:299 border-radius: 100%`, `chip.scss:127 border-radius: 50%`. Three literals for one intent, so "make it a circle" is not a token decision anywhere.

**Target** — `var(--mlv-radius-full)` is the only spelling. `50%` and `100%` are prohibited as a `border-radius` value across `libs/`.

**Rationale** — RR-5, and EX-B.1 layer 5 (the star is "the only circle in a row of pills").

---

## Sweep worklist — Dimension 2

| # | Target | Rule | Change |
| ---: | --- | --- | --- |
| 2.1 | `libs/styles/src/lib/theme.scss:503` | RR-R1 | `--mlv-radius-button: var(--mlv-radius-m)` → `var(--mlv-radius-l)` |
| 2.2 | `libs/styles/src/lib/theme.scss:504` | RR-R1 | `--mlv-radius-input: var(--mlv-radius-m)` → `var(--mlv-radius-l)` |
| 2.3 | `libs/styles/src/lib/theme.scss:508` | RR-R1, RR-R3 | `--mlv-radius-tag: var(--mlv-radius-s)` → `var(--mlv-radius-full)` |
| 2.4 | `libs/styles/src/lib/theme.scss:510` | RR-R1 | `--mlv-radius-panel: var(--mlv-radius-xl)` → `var(--mlv-radius-l)` |
| 2.5 | `libs/styles/src/lib/theme.scss:519` | RR-R1 | `--mlv-popover-surface-radius: var(--mlv-radius-l)` → `var(--mlv-radius-panel)` (same value, one source) |
| 2.6 | `libs/core/button/src/lib/button/button.scss:81` | RR-R1 | `--mlv-btn-radius: var(--mlv-radius-l)` → `var(--mlv-radius-button)` |
| 2.7 | `libs/core/button/src/lib/button/button.scss:108, 115, 122, 129` | RR-R2 | Delete the `--mlv-btn-radius` declaration from each of the four density blocks. |
| 2.8 | `libs/core/button/src/lib/button/button.scss:299` | RR-R5 | `border-radius: 100%` → `var(--mlv-radius-full)` |
| 2.9 | `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.scss:15` | RR-R1 | `--form-ctrl-radius: var(--mlv-radius-m)` → `var(--mlv-radius-input)` |
| 2.10 | `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.scss:27, 34, 41, 48` | RR-R2 | Delete the `--form-ctrl-radius` declaration from each of the four density blocks. |
| 2.11 | `libs/core/card/src/lib/card/card.scss:9` | RR-R1, RR-R4 | `--mlv-card-radius: var(--mlv-radius-3xl)` → `var(--mlv-radius-card)` |
| 2.12 | `libs/core/card/src/lib/card/card.scss:29, 43, 49` | RR-R2, RR-R4 | Delete `--mlv-card-radius` from `&--size-s`, `&--size-m`, `&--size-l`. Padding and font-size ramps stay. |
| 2.13 | `libs/core/dialog/src/lib/dialog/dialog.scss:28` | RR-R1 | `border-radius: var(--mlv-radius-l)` → `var(--mlv-radius-dialog)` |
| 2.14 | `libs/core/chip/src/lib/chip/chip.scss:34-36` | RR-R1, RR-R3 | `border-radius: var(--mlv-radius-l)` → `var(--mlv-radius-tag)`; replace the trailing comment with "pill, shared with `mlv-badge` — see `--mlv-radius-tag`". |
| 2.15 | `libs/core/chip/src/lib/chip/chip.scss:127` | RR-R5 | `border-radius: 50%` → `var(--mlv-radius-full)` |
| 2.16 | `libs/core/badge/src/lib/badge/badge.scss:30` | RR-R1 | `border-radius: var(--mlv-radius-full)` → `var(--mlv-radius-badge)` |
| 2.17 | `libs/core/tile/src/lib/tile/tile.scss:23` | RR-R1 | `--mlv-tile-radius: var(--mlv-radius-l)` → `var(--mlv-radius-card)` |
| 2.18 | `libs/core/tile/src/lib/tile/tile.scss:52, 65, 78, 91, 104` | RR-R2 | Delete the `--mlv-tile-radius` declaration from all five density blocks. |
| 2.19 | `libs/core/dropdown/src/lib/dropdown-panel/dropdown-panel.scss:22-25` | RR-R1 | **No code change** — `:25` already reads `var(--mlv-popover-surface-radius)`. Rewrite only the `:22-24` comment: `--mlv-radius-panel` and `--mlv-popover-surface-radius` now both resolve `--mlv-radius-l` (8px) after 2.4/2.5, so the note should record that the two tokens are reconciled rather than that one was avoided. |
| 2.20 | `libs/core/segmented/src/lib/segmented/segmented.scss:44` | RR-R1 | `--mlv-segmented-radius: var(--mlv-radius-xl)` → `var(--mlv-radius-button)`. The `--mlv-segmented-inner-radius` `max()` calc at `:56-59` is unchanged. |
| 2.21 | Remaining `border-radius: 50%` sites under `libs/` (inventory §3 records 16) | RR-R5 | Replace each with `var(--mlv-radius-full)`. Enumerate with `grep -rn --include='*.scss' --include='*.css' 'border-radius:.*50%' libs/`. |
| 2.22 | Remaining literal-rem `border-radius` sites (`0.375rem` ×3, `0.1875rem` ×3, `0.125rem` ×1, `0.0625rem` ×1 — inventory §3) | RR-R1 | Replace with the nearest step token. **Value-preserving:** `0.375rem` → `var(--mlv-radius-m)` (6px = 6px), `0.125rem` → `var(--mlv-radius-xs)` (2px = 2px). **Value-normalizing — these change the rendered corner:** `0.1875rem` → `var(--mlv-radius-xs)` (3px → 2px, ×3 sites) and `0.0625rem` → `var(--mlv-radius-xs)` (1px → 2px, ×1 site). All four normalizations are sub-pixel-scale and intended: the radius scale has no 1px or 3px step, and inventing one would re-open RR-1. |

---

# 3 · Control-height rhythm

## CH-R1 · The height ramp steps evenly: 28 / 36 / 44 / 52 / 60

**Current** — `--mlv-height-{xs,s,m,l,xl}` = 32 / 40 / 44 / 52 / 60, steps of **8 / 4 / 8 / 8** (`theme.scss:684-688`). `comfortable` and `compact` are 10% apart and read as the same control, which is why the owner's *"Compact can help, but…"* lands where it does: reaching for compact buys 4px of height and no change of character.

**Target** —

| token | current | new |
| --- | ---: | ---: |
| `--mlv-height-xs` | `2rem` (32px) | **`1.75rem` (28px)** |
| `--mlv-height-s` | `2.5rem` (40px) | **`2.25rem` (36px)** |
| `--mlv-height-m` | `2.75rem` (44px) | `2.75rem` (44px) unchanged |
| `--mlv-height-l` | `3.25rem` (52px) | `3.25rem` (52px) unchanged |
| `--mlv-height-xl` | `3.75rem` (60px) | `3.75rem` (60px) unchanged |
| `--mlv-height-2xl` | `4.25rem` (68px) | `4.25rem` (68px) unchanged — **loses its only consumer** (CH-R2). Keep declared; do not introduce a new one. |

Steps become **8 / 8 / 8 / 8**. `default → compact` is now an 18% drop, a real change of character.

28px at `tight` clears WCAG 2.2 SC 2.5.8 (AA) — the floor is 24×24 CSS px, and `mlv-switch` already pins its label hit area at 24px independently (`switch.scss:114-115`).

**Two documented off-ramp heights survive this rule.** Both are secondary affordances that must sit *below* the ramp's floor, which by definition the ramp cannot express:

| site | value | why it stays off the ramp |
| --- | ---: | --- |
| `button-close.scss:48` (`tight`) | `1.5rem` (24px) | A dismiss affordance one step under the tight button. 24px **is** the WCAG 2.5.8 floor — the value is the accessibility minimum, not an arbitrary literal. Keep the value; replace the bare number with a comment naming SC 2.5.8. |
| `sidebar.scss:169` (`tight`) | `1.875rem` (30px) → **`var(--mlv-spacing-6)` (24px)** | Currently 30px. With `--mlv-height-xs` dropping to 28px this would make `tight` *taller* than `compact` — an inverted ramp. Retuned to 24px so the order holds. |

Any other height literal outside `--mlv-height-*` is drift and gets converted.

**Rationale** — CH-3, EX-A.5 ("the next step down (`tight`, 32px) is a two-step jump" — after this rule `compact` is 36px and the jump is one even step).

## CH-R2 · Button and form control resolve the same height at every density

**Current** — `button.scss:127` sets `--mlv-btn-height: var(--mlv-height-2xl)` (68px) at `airy` while `form-control-wrapper.scss:45` sets `--form-ctrl-height: var(--mlv-height-xl)` (60px): an 8px hard break on the single most common pairing in the library. Every other density agrees.

**Target** — one table, both components:

| density | height token |
| --- | --- |
| tight | `--mlv-height-xs` (28px) |
| compact | `--mlv-height-s` (36px) |
| comfortable | `--mlv-height-m` (44px) |
| spacious | `--mlv-height-l` (52px) |
| airy | `--mlv-height-xl` (60px) |

**Rationale** — CH-1.

## CH-R3 · The type ramp is locked to the height ramp

**Current** — at the default density a 44px button carries 16px text next to a 44px input carrying 14px text; at `spacious` the gap is 4px; at `airy` the button reaches `--mlv-font-size-3xl`, which is **responsive** (20px on mobile, 24px at `lg`) — so a button's label size changes with the viewport while its container does not.

**Target** — one font token per density step, shared by button and form control, drawn only from the fixed (non-responsive) part of the scale:

| density | height | font token | px |
| --- | ---: | --- | ---: |
| tight | 28 | `--mlv-font-size-s` | 12 |
| compact | 36 | `--mlv-font-size-m` | 14 |
| comfortable | 44 | `--mlv-font-size-m` | 14 |
| spacious | 52 | `--mlv-font-size-l` | 16 |
| airy | 60 | `--mlv-font-size-xl` | 18 |

`--mlv-font-size-{3xl,4xl,5xl,6xl}` are responsive (`theme.scss:556-568`) and are prohibited on any control that has a token-driven height.

**Rationale** — CH-2, and the mechanism behind CH-4.

## CH-R4 · Icon sizing has exactly two modes, and the icon-only mode is a declared fraction of the container

**Current** — `button.scss:155-158` hard-sets the glyph box to `var(--mlv-icon-font-size)`, overriding whatever `[size]` the author passed to the Lucide directive; `button.scss:193` pins that variable to `1.75em`, resolved against `--mlv-btn-font-size`. The container is `--mlv-btn-height`, an absolute rem. Glyph : container is therefore `1.75 × btn-font-size ÷ btn-height` — a by-product of two independently-ramped tokens, never a declared number. Measured: **0.41** in the docs (`12-button.png`, 44px disc / 18px ink) and **0.55** in the support-inbox composer (`85-support-inbox.png`, 40px disc / 22px ink). The authored `[size]="15"` never reaches the pixels.

**Target** — two modes, one rule each:

1. **Icon adjacent to a label** — sized in `em` off the label: `--mlv-icon-font-size: 1.25em` (unchanged). Correct, because the glyph must track the text it sits beside.
2. **Icon alone in a shaped container** — sized as a declared fraction of the container:
   ```scss
   &--icon-only {
     --mlv-icon-font-size: calc(
       var(--mlv-btn-height) * var(--mlv-icon-in-container-ratio)
     );
   }
   ```
   with a new global token `--mlv-icon-in-container-ratio: 0.45`.

Resolved: 28px → 12.6px, 36px → 16.2px, 44px → 19.8px, 52px → 23.4px, 60px → 27px. The ratio is now **constant at every density and immune to inherited font-size**, so the docs context and the composer context can no longer diverge.

**Preventive extension:** the same token governs any other glyph-in-a-shaped-container pair. Apply it to `mlv-tile`'s control glyphs (`--mlv-tile-handle-icon-size`) and `mlv-button-close`. Do **not** apply it to `mlv-badge__icon` or `mlv-chip__prepend/__append`, which are label-adjacent and correctly `em`-based.

**Rationale** — CH-4, EX-B.2; owner interpretation 2.

## CH-R5 · A repeated control cluster compacts with nesting depth

**Current** — `baseline/states/website-builder--page-layouts.png`: the toggle · config · add · delete cluster measures the same at nesting level 1, 2 and 3, while the title type steps 14px → 12px. A 40px control cluster sits on a ~20px text block at the deepest level. In source: `tile.scss:55, 68, 81` all set `--mlv-tile-control-size: var(--mlv-height-m)` — tight, compact and comfortable are the same 44px.

**Target** — two changes:

1. `--mlv-tile-control-size` follows the density ramp like everything else: tight → `--mlv-height-xs`, compact → `--mlv-height-s`, comfortable → `--mlv-height-m`, spacious → `--mlv-height-l`, airy → `--mlv-height-xl`.
2. A nested tiles group steps its controls down one notch. The selector **must reach the tile itself** — `.mlv-tile` declares `--mlv-tile-control-size` on its own block at `tile.scss:26`, so a declaration on the `.mlv-tiles--nested` ancestor is shadowed and does nothing:

   ```scss
   .mlv-tiles.mlv-tiles--nested .mlv-tile {
     --mlv-tile-control-size: var(--mlv-height-xs);
   }
   ```

   Both this selector and the density-mixin output compute to (0,3,0) — a specificity tie, so source order decides. To make the override deterministic, the block MUST be appended at the END of `tile.scss`, after every density block (`density.*` mixin include) that touches `--mlv-tile-control-size`. Keeping it in the same file as its competitors means cross-file bundling order can never flip the result. Shipped in SL-R4's block.

`taiga-refs/taiga-cell.png` "Actions" is the reference for what a per-row cluster should be: *"Multiple actions / with no content on the right"* renders as a single neutral `…` overflow glyph.

**Rationale** — CH-5, EX-A.2 item 1, EX-A.5.

## CH-R6 · One component has one row height

**Current** — `baseline/light/24-data-table.png` renders ~56px rows; `baseline/light/87-data-operations.png` renders ~39px rows for the same component with no stated density difference in the view.

**Target** — `--mlv-dt-row-height` = *the control height at this density* + *one fixed breathing term*, so a density change is the only way a row height changes. The breathing term is **`--mlv-spacing-4` (16px) at every density**, which makes the row ramp inherit the height ramp's even 8px steps exactly:

| density | current | new | px: current → new |
| --- | ---: | --- | ---: |
| tight | `2.5rem` (40px) | `calc(var(--mlv-height-xs) + var(--mlv-spacing-4))` | 40 → **44** |
| compact | `3rem` (48px) | `calc(var(--mlv-height-s) + var(--mlv-spacing-4))` | 48 → **52** |
| comfortable | `3.5rem` (56px) | `calc(var(--mlv-height-m) + var(--mlv-spacing-4))` | 56 → **60** |
| spacious | `4.25rem` (68px) | `calc(var(--mlv-height-l) + var(--mlv-spacing-4))` | 68 → **68** |
| airy | `5rem` (80px) | `calc(var(--mlv-height-xl) + var(--mlv-spacing-4))` | 80 → **76** |

New ramp: **44 / 52 / 60 / 68 / 76** — even 8px steps, and every row is exactly one `--mlv-spacing-4` taller than the tallest control it can host. The three tighter densities grow by 4px, `spacious` is unchanged, `airy` loses 4px.

Growth at the tight end is the intent, not a side effect: SL-R5 item 2 says the whitespace that makes a row breathe lives *inside* it, and EX-C's complaint is that Malva's rows are *"tight inside and separated outside"*. Any view that wants shorter rows sets `mlvDensity`, never a local height.

**Rationale** — CH-6.

---

## Sweep worklist — Dimension 3

| # | Target | Rule | Change |
| ---: | --- | --- | --- |
| 3.1 | `libs/styles/src/lib/theme.scss:684` | CH-R1 | `--mlv-height-xs: 2rem` → `1.75rem; /* 28px */` |
| 3.2 | `libs/styles/src/lib/theme.scss:685` | CH-R1 | `--mlv-height-s: 2.5rem` → `2.25rem; /* 36px */` |
| 3.3 | `libs/styles/src/lib/theme.scss:689` | CH-R1 | Keep `--mlv-height-2xl: 4.25rem`; add the comment `/* 68px — no consumer; do not introduce one */`. |
| 3.4 | `libs/styles/src/lib/theme.scss` (Section 8, after `:689`) | CH-R4 | Add `--mlv-icon-in-container-ratio: 0.45;` with a comment naming the two icon modes from CH-R4. |
| 3.5 | `scripts/generate-tokens-md.mjs:133` and its category `blurb` at `:131-132` | CH-R4 | Add `'--mlv-icon-'` to the `sizing` category's `prefixes` array, otherwise `styles:generate-tokens` fails on the unmatched token. The `sizing` blurb currently describes only `--mlv-padding-*` pairs, so **extend it** to name the odd member out: the category now also holds one unitless ratio, `--mlv-icon-in-container-ratio`, which is a multiplier for a container height rather than a length. Without that sentence the generated reference lists a bare `0.45` under "Sizing" with no explanation. |
| 3.6 | `libs/core/button/src/lib/button/button.scss:127` | CH-R2 | `--mlv-btn-height: var(--mlv-height-2xl)` → `var(--mlv-height-xl)` |
| 3.7 | `libs/core/button/src/lib/button/button.scss:82` | CH-R3 | `--mlv-btn-font-size: var(--mlv-font-size-l)` → `var(--mlv-font-size-m)` |
| 3.8 | `libs/core/button/src/lib/button/button.scss:119` | CH-R3 | `--mlv-btn-font-size: var(--mlv-font-size-2xl)` → `var(--mlv-font-size-l)` |
| 3.9 | `libs/core/button/src/lib/button/button.scss:126` | CH-R3 | `--mlv-btn-font-size: var(--mlv-font-size-3xl)` → `var(--mlv-font-size-xl)` |
| 3.10 | `libs/core/button/src/lib/button/button.scss:105, 112` | CH-R3 | Verify unchanged: tight `--mlv-font-size-s`, compact `--mlv-font-size-m`. No edit expected. |
| 3.11 | `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.scss:40` | CH-R3 | spacious `--form-ctrl-font-size: var(--mlv-font-size-l)` — verify unchanged. |
| 3.12 | `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.scss:47` | CH-R3 | airy `--form-ctrl-font-size: var(--mlv-font-size-xl)` — verify unchanged. |
| 3.13 | `libs/core/button/src/lib/button/button.scss:193-194` | CH-R4 | Replace `--mlv-icon-font-size: 1.75em;` with `--mlv-icon-font-size: calc(var(--mlv-btn-height) * var(--mlv-icon-in-container-ratio));` |
| 3.14 | `libs/core/button/src/lib/button/button.scss:83` | CH-R4 | Keep `--mlv-icon-font-size: 1.25em;` (label-adjacent mode). Add a comment naming both modes. |
| 3.15 | `libs/core/tile/src/lib/tile/tile.scss:55` | CH-R5 | tight `--mlv-tile-control-size: var(--mlv-height-m)` → `var(--mlv-height-xs)` |
| 3.16 | `libs/core/tile/src/lib/tile/tile.scss:68` | CH-R5 | compact `--mlv-tile-control-size: var(--mlv-height-m)` → `var(--mlv-height-s)` |
| 3.17 | `libs/core/tile/src/lib/tile/tile.scss:81` | CH-R5 | comfortable — verify `var(--mlv-height-m)`, no edit. |
| 3.18 | `libs/core/tile/src/lib/tile/tile.scss:27, 56, 69, 82, 95, 108` | CH-R4 (preventive) | `--mlv-tile-handle-icon-size` → `calc(var(--mlv-tile-control-size) * var(--mlv-icon-in-container-ratio))` on the block (`:27`); delete the five per-density declarations. |
| 3.19 | `libs/core/data-table/src/lib/data-table/data-table.scss:16, 34, 45, 56, 67` | CH-R6 | Replace the five `--mlv-dt-row-height` literals with the `calc()` expressions from CH-R6's table. |
| 3.20 | `libs/core/button/src/lib/button-close/button-close.scss:7, 46-49, 51-54` | CH-R1, CH-R4 | `:7` block default `var(--mlv-height-s)` — no edit, but the close button now renders 36px instead of 40px. `:53` is the **compact** override `var(--mlv-height-xs)` — no edit; it renders 28px instead of 32px. `:48` hardcodes `--mlv-btn-height: 1.5rem` at **tight**, off the ramp — **keep the 24px value** (see CH-R1's documented exception) but replace the bare literal with a comment naming WCAG 2.2 SC 2.5.8 as the reason. `:47` `--mlv-btn-font-size: 0.625rem` is likewise off the type scale: → `var(--mlv-font-size-xs)` (0.6875rem/11px), a 1px normalization. Icon sizing needs no entry here — the close button renders `.mlv-button--icon-only` and inherits 3.13's ratio automatically; **verify and report** that it does. |
| 3.20a | `libs/core/button/src/lib/button-close/button-close.scss:19-21` | CH-R1, SF-R3 | Stale comment: it states the ring's "width (`0.125rem`) and offset (`0.175rem`) stay on the shared `.mlv-button` base". After 5.18 the base offset is `var(--mlv-focus-ring-offset)` and the width is `var(--mlv-stroke-width-medium)`. Update both figures to name the tokens. |
| 3.21 | `libs/core/filter/src/lib/filter/filter.scss:87, 100, 135` and `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.scss:85` | CH-R1 | These pin `--mlv-btn-height: var(--mlv-height-xs)` unconditionally, so filter chrome drops 32px → 28px. Confirm the chip label still fits at `--mlv-font-size-s`; if it clips, raise these four sites to `var(--mlv-height-s)` (36px) and report the change. |
| 3.22 | `libs/editor/src/lib/editor/editor.scss:150, 529` | CH-R1 | Same 32px → 28px consequence for editor toolbar chrome. Verify visually; report if it clips. |
| 3.23 | `libs/core/sidebar/src/lib/sidebar/sidebar.scss:169, 173, 177` | CH-R1 | `:173` is the **compact** override `var(--mlv-height-xs)` — 32px → 28px; verify the icon + label row still fits. `:177` is **spacious** `var(--mlv-height-s)` — 40px → 36px. `:169` is **tight**, hardcoded `1.875rem` (30px), off the ramp — with `--mlv-height-xs` now at 28px, tight (30px) would sit *above* compact (28px), inverting the ramp. Set `:169` to `var(--mlv-spacing-6)` (24px) so the order is restored: 24 / 28 / … Report if a 24px row clips its icon. |

---

# 4 · Accent budget

## AB-R1 · At most one accent-carrying mark per repeated unit

**Current** — measured on `baseline/states/website-builder--page-layouts.png` (region below the page header, 1440×640, saturated marks ≥100px area): **24 accent marks, 26 per megapixel**. Over the full page: **147 accent clusters**, of which **27 are accent-filled toggle tracks, every one ON**. The comparable Taiga example (`taiga-cell.png` "Left side") measures **2 marks, 7.7 per megapixel** — 3.4× fewer per unit area, and both belong to one hue family.

**Definitions (binding).** An **accent-carrying mark** is any of:
- a fill from `--mlv-background-accent-1`, `-accent-2`, or `--mlv-background-{danger,success,warning,info}-1` (solid, not `-pale`);
- a foreground from `--mlv-text-action` or `--mlv-text-action-hover`;
- an avatar or media fill with sRGB saturation ≥ 0.45.

A **repeated unit** is any element rendered more than twice in one viewport from one template: a table row, a list row, a tile row, a card in a grid, a chat message, a sidebar item.

**Target** — **at most one** accent-carrying mark per repeated unit. That one mark is either the unit's primary action **or** its selection state, never both. Routine per-row actions — configure, add, remove, reorder, expand, and any adjacent toggle — carry **none**.

Mechanism: `mlv-button[variant="transparent"]` stops resolving `--mlv-text-action`.

This **replaces** `button.scss:258-288` in full. Every declaration currently in that range is preserved except `--mlv-btn-text-color` for `transparent`, which is the one line the rule changes — note in particular that `--mlv-btn-bg: transparent` and the shared `&:focus-visible { outline-color: … }` must survive, or transparent buttons lose their background reset and their focus ring:

```scss
// libs/core/button/src/lib/button/button.scss — replaces :258-288 verbatim
&--variant-transparent,
&--variant-outlined {
  --mlv-btn-bg: transparent;

  &:focus-visible {
    outline-color: var(--mlv-border-focus);
  }
}

&--variant-outlined {
  // Kept accent: an outlined button is a bordered call to action, not a
  // routine per-row glyph.
  --mlv-btn-text-color: var(--mlv-text-action);
  --mlv-btn-bg-hover: var(--mlv-background-accent-1-pale);
  --mlv-btn-bg-active: var(--mlv-background-neutral-1-active);
  border: var(--mlv-stroke-width) solid var(--mlv-border-normal);

  &:hover {
    border-color: var(--mlv-border-strong);
  }

  &:active {
    border-color: var(--mlv-border-focus);
  }
}

&--variant-transparent {
  // THE change: a bare glyph is neutral chrome, not an accent mark.
  --mlv-btn-text-color: var(--mlv-text-secondary);
  --mlv-btn-bg-hover: var(--mlv-background-neutral-1-hover);
  --mlv-btn-bg-active: var(--mlv-background-neutral-1-active);

  &:hover {
    --mlv-btn-text-color: var(--mlv-text-primary);
  }
}
```

The `border` shorthand also moves off its literal `0.0625rem` onto `var(--mlv-stroke-width)` (same value), per `.claude/rules/bem-scss.md`.

`--mlv-text-secondary` (`#525252`) scores **7.81:1** on `--mlv-background-raised` and **6.77:1** on the new hover fill — comfortably AA. `mlv-button-close` already ships a **close relative** of this treatment (`button-close.scss:26-35`: `--mlv-text-tertiary` at rest → `--mlv-text-secondary` on hover), so the base variant is moving toward its own specialisation rather than contradicting it. It does not become identical: the close button stays one step lighter, which is correct — a dismiss affordance should be quieter than a row action.

Effect on the exhibit: ~25 accent config glyphs + ~25 accent trash glyphs + ~17 accent `＋` glyphs stop being accent, in one change.

**Rationale** — AB-1, EX-A.3; owner interpretation 1.

## AB-R2 · Every control in one cluster shares one chrome

**Current** — inside a single four-control cluster, the `＋` sits on a filled neutral square (`website-builder-node.html:118, 132` — `variant="secondary"`) while `config` and `🗑` are bare glyphs (`:99, :146` — `variant="transparent"`). Three controls, two container treatments, no rule.

**Target** — one `variant` per cluster. For a per-row action cluster the variant is `transparent`. A cluster may promote **one** member to a different variant only when that member is the row's primary action, and only in a view where AB-R1's single accent has not already been spent.

**Rationale** — EX-A.2 item 2.

## AB-R3 · Destructive glyphs stay neutral — no accent hue, no `tone` input

**Current** — every `🗑` in `baseline/light/89-website-builder.png` measures `rgb(45,64,156)` = `--mlv-text-action`. *Delete* is chromatically identical to *configure* and *add*.

**Target** — a destructive per-row glyph (trash, remove, etc.) gets **no dedicated tone treatment**. It is styled exactly like every other member of its action cluster under AB-R1/AB-R2: `variant="transparent"`, `--mlv-text-secondary` at rest, `--mlv-text-primary` on hover, no accent hue. The row's accent budget (AB-R1: at most one accent-carrying mark per repeated unit) is not spent recolouring *delete* — a destructive per-row action is distinguished by its icon and its confirmation flow, not by chroma.

`variant="error"` (a solid danger fill) stays reserved for a single blocking destructive CTA — a dialog's confirm button — never a per-row glyph.

**Owner gate decision (2026-08-25).** A `tone="danger"` input on `MlvButton` was drafted to recolour per-row destructive glyphs (`--mlv-text-negative` label, `--mlv-background-danger-1-pale` hover) without promoting them to a filled CTA — see "Owner gate decisions" above. The owner **rejected** the public API addition at the approval gate: no new `MlvButton` input ships. AB-1/EX-A.3/EX-A.4's complaint is resolved entirely by AB-R1's existing `variant="transparent"` neutral treatment, which every row action — destructive or not — already receives once 4.1 lands.

### Canonical emission order in `button.scss` — binding for SF-R1 and SF-R4

Almost every state selector in this file resolves to specificity **(0,2,0)** — `.mlv-button--variant-transparent`, `.mlv-button[aria-pressed='true']`, `.mlv-button--disabled`, and `.mlv-button--variant-transparent:hover` all tie. **Source order is therefore the only thing that decides the winner**, and two of this document's rules add or move blocks in that range. Emit them in exactly this order, after the density blocks and the `&__*` parts:

| # | block | why it sits here |
| ---: | --- | --- |
| 1 | `&:hover`, `&:active` | base interaction, lowest precedence |
| 2 | `@each $filled-variants` loop | per-variant fills |
| 3 | `&--variant-transparent`, `&--variant-outlined` (AB-R1) | non-filled variants override the loop |
| 4 | `&[aria-pressed='true']` (SF-R1) | a persistent state outranks variant |
| 5 | `&--disabled` + its two variant qualifiers (SF-R4) | **last** — a disabled control shows neither a pressed fill |
| 6 | `&--loading`, then `&--shape-*` | geometry, no colour conflict |

Because step 3 introduces `&--variant-transparent:hover` (a `--mlv-btn-text-color` override at (0,2,0)) and step 4 must beat it, **the `[aria-pressed='true']` block pins all three custom properties** — `--mlv-btn-bg`, `--mlv-btn-bg-hover` and `--mlv-btn-text-color` — exactly as the existing comment at `button.scss:170-174` explains it already has to for the first two. Do not rely on specificity here; rely on this order plus the pinning.

**Rationale** — AB-1, EX-A.3, EX-A.4 item 1; owner interpretation 1. `MlvButton.tone` was proposed for this rule and rejected at the 2026-08-25 gate (see Open risk 2, resolved, above).

## AB-R4 · Semantic hue is a marker, not a surface

**Current** — `baseline/light/09-badge.png` and `20-chip.png` render eight tones × solid saturated fill with white text. The `muted` variants exist and are calmer, but the solid form is what the docs lead with. Malva's own `alert` already demonstrates the calm pale-tint behaviour correctly and nothing else follows it.

**Target** — three tiers, in order of preference:

1. **Inside a repeated unit** (table cell, list row, tile header): semantic state renders as `mlv-status-indicator` (a dot, `--mlv-radius-badge`) plus a **neutral** `--mlv-text-primary` label. The hue occupies a few dozen pixels. `taiga-refs/taiga-table.png` "Custom" is the reference.
2. **Standalone label**: `mlv-badge muted` / `mlv-chip muted` — a `--mlv-muted-{tone}-bg-2` tint with `--mlv-muted-{tone}-text-2` ink and a `--mlv-muted-{tone}-border-2` hairline.
3. **Solid saturated fill**: reserved for a **primary CTA button** and a **count badge on a navigation item**. Nowhere else.

`mlv-badge` / `mlv-chip` keep `muted` as an opt-in input (flipping the default is a breaking change), but every docs example and every showcase usage moves to tier 1 or 2.

**Rationale** — AB-3, AB-6, EX-C.2.

## AB-R5 · A tone that applies to most rows is not a signal

**Current** — `baseline/light/87-data-operations.png`: all 8 visible rows carry the same pink `At risk` badge in the Health column; the source data (`data-operations.data.ts:60, 71, 82, 93, 104, 115, 126, 137`) is eight consecutive `'At risk'` accounts. `baseline/light/89-website-builder.png`: the structural chips `Container` and `12 cols` render in the danger/pink family on all five container rows, while the equally-structural `Fluid` / `Max 1280px` / `Row` are grey.

**Target** — two clauses:

1. **Data clause.** If a semantic tone would apply to more than 50% of the rows on the first rendered page, the demo data is wrong. Interleave it.
2. **Semantics clause.** A tone is applied only when the value it encodes is *semantic* (health, validity, availability). **Structural metadata never takes a tone** — a `Container` chip, a `12 cols` chip, a `Section` chip and a `Row` chip are all structure and all render `tone="default" muted`.

**Rationale** — AB-4, EX-A.4 items 2 and 3.

## AB-R6 · Avatars use the name-derived pale tint; a raw `[color]` is prohibited

**Current** — `MlvColorFromTextPipe` already returns `hsl(h, 60%, 80%)` — a correct pale tint. The saturation in the captures comes entirely from consumers passing 500-level hexes: `apps/docs/src/app/pages/list/examples/4/index.ts:55, 65, 75, 85, 95` (`#7c3aed`, `#0ea5e9`, `#f97316`, `#e11d48`, `#16a34a`), `examples/3/index.ts:42, 48, 54, 60, 66`, and 17 sites in `support-inbox.data.ts`. `baseline/light/88-settings-access.png` "Recent activity" is worse — solid discs with **no initials at all**, so they read as raw colour blobs.

**Target** —

1. `mlv-avatar` never receives a raw `[color]`. Delete the `color` fields from demo data and the `[color]` bindings from templates; the name-derived pale tint applies.
2. Every `mlv-avatar` carries `[name]`, so it always renders initials with `--mlv-text-primary` ink.
3. `taiga-refs/taiga-table.png` and `taiga-cell.png` measure **1 hue family** in the comparable crop; `47-list.png` measures **4**. One hue family is the target.

The `color` **input** stays on the component — an explicit brand colour is a legitimate escape hatch — but no first-party demo, docs example or showcase uses it.

**Rationale** — AB-5, EX-C.2; owner interpretation 3.

## AB-R7 · Chromeless icon toggle (`mlv-icon-toggle`)

**Current** — the support-inbox star (`baseline/light/85-support-inbox.png`) is a bespoke `__row-star` / `__star-on` treatment bolted onto the row template: a filled circle behind the glyph when active, styled with `--mlv-text-warning` — a message colour, not a state colour (SF-R1) — and, per RR-R5, "the only circle in a row of pills" (EX-B.1 layer 5). There is no reusable component in the library for a chromeless, glyph-only toggle: every existing toggle (`mlv-switch`, `mlv-button-toggle`, `mlv-checkbox`) carries a track, a pill, or a filled surface.

**Target** — a new leaf library, `libs/core/icon-toggle`, exposing one component:

- **Selector** `button[mlvIconToggle]` — an attribute component on a native `<button>`, following the repo's `button[mlvButton]` convention (`.claude/rules/angular-component.md` § Selectors: the component enhances a semantically identical native element). BEM block `.mlv-icon-toggle`.
- **State** — a WAI-ARIA toggle button: `pressed` is a two-way `model<boolean>()`, reflected as `[attr.aria-pressed]`; `pressedChange` is implicit via the model. `disabled` uses the native `disabled` attribute plus `aria-disabled`, per `.claude/rules/accessibility.md`.
- **Content** — exactly one projected Lucide `<svg>`. Lucide ships no separate filled icon set, so the pressed state is expressed as a CSS `fill` on the *same* glyph — a mechanism that only reads correctly for icons with an enclosed shape (star, heart, bookmark, pin), not for open-stroke glyphs:
  - rest: `color: var(--mlv-text-secondary)`; `svg { fill: transparent; }`
  - hover: `color: var(--mlv-text-primary)`; `svg { fill: color-mix(in srgb, currentColor 15%, transparent); }` — the "tiny fill"
  - pressed: `svg { fill: currentColor; }`; pressed+hover keeps the fill and may lighten the stroke one step
  - focus-visible: Form A per SF-R3
  - `cursor: pointer`; **no background in any state** — the defining constraint. A `mlv-icon-toggle` never paints a surface; a design that needs a filled/tinted toggle affordance is not reaching for this component.
- **Colour** — defaults to `currentColor` (neutral). An optional `tone` input, typed `MlvTone` (`@malva-ui/cdk/utils` — the same union `alert` / `toast` / `badge` / `chip` already use), recolours only the *pressed* state to the matching semantic text token (e.g. `tone="warning"` → `--mlv-text-warning` amber for a favourite star, `tone="danger"` → `--mlv-text-negative`). A tone colours the **icon only**, never a surface — consistent with AB-R4's "hue is a marker, not a surface." This `tone` is a property of the new component and is unrelated to the `MlvButton.tone` input the owner rejected in AB-R3 above (Open risk 2, resolved) — that one would have painted a surface-adjacent state on a chromed button, which is exactly what this component refuses to do.
- **Sizing** — the glyph is **author-sized** via the projected `<svg>`'s own `[size]`, and the component does **not** consume `--mlv-icon-in-container-ratio`. That token derives a glyph from its *container's* height (CH-R4), which presupposes a surface-bearing control; a chromeless toggle has no container height to divide. What the component owns is the hit area: a `1.5rem` (24px) pointer-target floor held unconditionally — WCAG 2.5.8 — grown at looser densities by density-aware padding, **not** by a larger glyph. Chromeless does not mean tap-target-less. *(Tightened 2026-08-25: the original bullet cited the ratio token and the "not a larger glyph" clause in the same breath, which read as a contradiction. `icon-toggle.scss:25-48` implements the half stated here; the ratio token stays with `button`/`button-close`/tile drag handle per the token change list.)*
- **Motion** — the `fill` transition runs at `var(--mlv-duration-fast)` `var(--mlv-ease-default)` (MO-R4's hover/feedback class); a reduced-motion path is required per `.claude/rules/bem-scss.md`.

**Not built here.** Component built as its own program task; showcase adoption happens in the showcase sweep. Nothing in this document's sweep worklists constructs `libs/core/icon-toggle`. The support-inbox star's adoption of it — replacing `__row-star` / `__star-on` with `<button mlvIconToggle tone="warning" [(pressed)]="…">` — happens in the showcase sweep, not here. SF-R1's selected-token law (list rows, segmented, sidebar, tabs, etc.) is unaffected and still stands; it governs every *other* selected surface in the library, none of which is a chromeless icon toggle.

**Rationale** — EX-B.1, EX-B.2 (star exhibit); owner addition at the 2026-08-25 approval gate. Accent budget: replaces the star's ad hoc tinted-circle-behind-a-glyph treatment with a first-class primitive whose state reads from the glyph itself, never from a surface behind it.

## AB-R8 · Two filled colours per view; a segmented choice is never a filled block

**Current (a)** — `button.scss:7-63` declares filled variants `primary`, `secondary`, `accent`, `error`, `warning`, `info`, `elevated`, and `baseline/light/12-button.png` renders six of them as saturated fills in one row. `taiga-refs/taiga-button.png` "Appearance" ships exactly two filled colours; `Secondary`, `Flat`, `Outline` and `Floating` are achromatic or text-only.

**Current (b)** — `button-toggle.scss:15-17` gives a pressed toggle the full `--mlv-btn-bg-active` accent fill, so a mode selector reads with the weight of a primary CTA (`baseline/light/27-density.png`: selected `Comfortable` is a solid indigo block). `mlv-segmented`, which does the same job, uses a neutral white-on-sunken pill (`segmented.scss:46-53`).

**Target** —

1. All seven filled variants stay in the library. **At most two saturated fills render in one view**: `primary` (accent-1) and `accent` (accent-2). `error` / `warning` / `info` filled variants are reserved for a blocking CTA and never appear in a demo row alongside `primary`.
2. **A segmented choice never renders as a filled accent block.** `mlv-button-toggle[pressed]` and `mlv-segmented[selected]` converge on one treatment: `--mlv-background-selected` fill (SF-R1) + `--mlv-text-on-selected` label. `taiga-refs/taiga-tabs.png`: the selected state is an underline plus accent *text*, never a filled block. **Owner override 2026-08-25:** `mlv-segmented`'s `neutral` (default) tone reverted to its raised-white/`--mlv-text-primary` pill after landing — see "Post-implementation owner overrides" below; `mlv-button-toggle[pressed]` and every semantic segmented tone are unaffected.

**Rationale** — AB-2, AB-7.

---

## Sweep worklist — Dimension 4

| # | Target | Rule | Change |
| ---: | --- | --- | --- |
| 4.0 | `libs/core/button/src/lib/button/button.scss` | AB-R3 | **Do this first.** Reorder the file's colour blocks into the canonical emission order (6 rows). Entries 4.1, 5.10 and 5.11 all depend on it; applied out of order they silently lose to source order. |
| 4.1 | `libs/core/button/src/lib/button/button.scss:258-288` | AB-R1 | Replace the whole range with the exact SCSS from AB-R1 (position 3 in the emission order). Verify `--mlv-btn-bg: transparent` and the shared `&:focus-visible { outline-color: var(--mlv-border-focus); }` survive the replacement. |
| 4.4 | `apps/docs/src/app/showcases/pages/website-builder/website-builder-node.html:118, 132` | AB-R2 | `variant="secondary"` → `variant="transparent"` on both `＋` buttons, so all four cluster members share one chrome. |
| 4.5 | `apps/docs/src/app/showcases/pages/website-builder/website-builder-node.html:142-153` | AB-R3 | **No change.** The remove button already renders `variant="transparent"` (per the AB-R2 current-state note above), matching the rest of its cluster once 4.1 lands. Owner rejected `MlvButton.tone` at the 2026-08-25 gate, so there is no `tone="danger"` to add — listed so no sweep re-derives it. |
| 4.6 | `apps/docs/src/app/showcases/pages/website-builder/website-builder-node.html:49-56` | AB-R5 | `<mlv-badge tone="accent" …>{{ columnBadge() }}` → `tone="default"`. Column count is structure, not semantics. |
| 4.7 | `apps/docs/src/app/showcases/pages/website-builder/website-builder-node.html:30-32` | AB-R5 | `kindTone()` in `website-builder-node.ts` must return `'default'` for `Container`, `Section` and `Row`. Only genuinely semantic kinds keep a tone. |
| 4.8 | `apps/docs/src/app/showcases/pages/data-operations/data-operations.data.ts:60-137` | AB-R5 | Interleave the first eight `ACCOUNTS` entries so the first rendered page carries a mix of `At risk` / `Watch` / `Healthy` (target ≤ 3 `At risk` in the first 8). Row order downstream is unchanged. |
| 4.9 | `apps/docs/src/app/showcases/pages/data-operations/data-operations.html:238-244` | AB-R4 | Replace the health `mlv-badge` with `<mlv-status-indicator [tone]="healthTone(row.health)" />` plus a neutral `<span>{{ row.health }}</span>`. |
| 4.10 | `apps/docs/src/app/pages/list/examples/4/index.ts:55, 65, 75, 85, 95` | AB-R6 | Delete the five `color:` entries and the `color` field on the interface (`:22`); remove the `[color]` binding from `examples/4/index.html`. |
| 4.11 | `apps/docs/src/app/pages/list/examples/3/index.ts:42, 48, 54, 60, 66` | AB-R6 | Same deletion (field declared at `:17`). |
| 4.12 | `apps/docs/src/app/showcases/pages/support-inbox/support-inbox.data.ts:276, 289, 298, 307, 316, 453, 655, 796, 922, 1057, 1161, 1289, 1404, 1525, 1654, 1748, 1847` | AB-R6 | Delete all 17 `color:` entries and the `color` field from the agent/author interfaces; remove `[color]="agent.color"` at `support-inbox.html:222, 1334` and every other `[color]` binding in that template. |
| 4.13 | `apps/docs/src/app/showcases/pages/settings-access/settings-access.html:1102, 2182, 2590` (Recent-activity avatars) | AB-R6 | Ensure each `mlv-avatar` has a `[name]` binding so initials render. |
| 4.14 | `apps/docs/src/app/pages/list/examples/6/index.ts:39, 46, 53, 60, 67, 74` | AB-R1, AB-R4 | Six hues on six consecutive rows. Reduce to **one** accented row (`accent: 'negative'` on the error entry) and set the other five to `accent: 'neutral'`; carry their meaning with an `mlv-status-indicator` in the meta slot instead. |
| 4.15 | `apps/docs/src/app/pages/badge/examples/1/index.html:3-9` | AB-R4 | Retitle/reframe as the reserved-use example: keep at most two solid tones (`primary`, `danger`) and move the rest to `muted`, matching `examples/2`. |
| 4.16 | `apps/docs/src/app/pages/chip/examples/1/index.html:3-9` | AB-R4 | Same treatment as 4.15. |
| 4.17 | `apps/docs/src/app/pages/badge/examples/3/index.html:5-8` (and the compact/spacious repeats) | AB-R4 | Add `muted` to the `primary`, `success` and `warning` badges so the density example is not also a saturation example. |
| 4.18 | `apps/docs/src/app/pages/chip/examples/4/index.html:16, 23` | AB-R4 | Add `muted` to the `accent` and `primary` chips. |
| 4.19 | `libs/core/button/src/lib/button-toggle/button-toggle.scss:15-18` | AB-R8 | `--mlv-btn-bg: var(--mlv-btn-bg-active)` → `var(--mlv-background-selected)`; add `--mlv-btn-text-color: var(--mlv-text-on-selected);`; replace the literal `0.0625rem` in the inset ring with `var(--mlv-stroke-width)`. |
| 4.20 | `libs/core/segmented/src/lib/segmented/segmented.scss:58-59` | AB-R8 | `--mlv-segmented-pill-bg: var(--mlv-background-raised)` → `var(--mlv-background-selected)`; `--mlv-segmented-active-color: var(--mlv-text-primary)` → `var(--mlv-text-on-selected)`. **Owner override 2026-08-25:** reverted for the `neutral` tone after landing — see "Post-implementation owner overrides" above; both properties are back to `--mlv-background-raised` / `--mlv-text-primary`. |
| 4.21 | `apps/docs/src/app/pages/button/examples/*/index.html` — the appearance/variant matrix | AB-R8 | Split the six-fill row: one row for `primary` + `accent` (the two sanctioned fills), a separate, labelled row for `error` / `warning` / `info` with a note that they are reserved for blocking CTAs. |
| 4.22 | `libs/core/tile/src/lib/tile/tile.scss:116-125` (`&--tone-*`) | AB-R5 (preventive) | Verify tile tones only recolour the border, never the fill. No edit expected; report if a fill is found. |

---

# 5 · State formula

## SF-R1 · `selected` is its own token. Selection never borrows the pressed fill

**Current** — `grep -i selected libs/styles/src/lib/theme.scss` returns **zero hits**. The only `selected` tokens anywhere are the two `mlv-list-item` invents for itself (`list-item.scss:11-12`). Everything else expresses *selected* by reusing `-active`, which is the **mouse-down** colour:
- `button.scss:175-180`: `&[aria-pressed='true'] { --mlv-btn-bg: var(--mlv-btn-bg-active); … }`
- `button-toggle.scss:15-17`: `&--pressed > .mlv-button { --mlv-btn-bg: var(--mlv-btn-bg-active); }`

Measured consequence: the starred conversation in `baseline/light/85-support-inbox.png` fills with `--mlv-background-neutral-1-active` → **rgb(228,228,228)** — the darkest fill in its row (the assignee chip beside it is rgb(245,245,245)). A persistent state painted with a pressure affordance reads as "stuck mid-click".

**Owner gate note (2026-08-25).** The star glyph itself is superseded by AB-R7's `mlv-icon-toggle` (`tone="warning"`), adopted in the showcase sweep — see worklist 5.33. The law below still governs every *other* selected surface in the library (list rows, segmented, sidebar, tabs, button `aria-pressed`, etc.); a chromeless icon toggle has no background to mis-paint with `-active` in the first place.

**Target** — three new tokens and one law:

| token | light | dark |
| --- | --- | --- |
| `--mlv-background-selected` | `var(--mlv-background-accent-1-pale)` → `#eaeefa` | resolves through the same indirection → `#202433` |
| `--mlv-background-selected-hover` | `var(--mlv-background-accent-1-pale-hover)` → `#dce2f6` | → `#262d46` |
| `--mlv-text-on-selected` | `var(--mlv-text-action)` → `#2d409c` | → `#9fb7f2` |

**Law:** `-active` means *the pointer is down right now*. No persistent state may resolve `--mlv-background-*-active`.

`--mlv-text-on-selected` on `--mlv-background-selected` scores **7.77:1** in light (already guarded in `theme-contrast.spec.mjs`'s light action-surface list). **Owner override 2026-08-25:** `--mlv-text-action` reverted to `primary-600` (`#3c55bb`) after this spec's numbers were computed at `primary-700` — the table's `#2d409c` and this `7.77:1` are now `#3c55bb` and **5.63:1** respectively; still clears AA with margin. See "Post-implementation owner overrides" below.

Because all three are declared through `var()` indirection onto tokens the dark and high-contrast blocks already override, they are declared **once**, in the light `:root` block, and resolve correctly in all three themes.

**Rationale** — SF-1, EX-B.1 layers 1–2.

## SF-R2 · One selection formula, chrome-polarity-safe

**Current** — four different selection formulas across four surfaces:

| where | measured active fill |
| --- | --- |
| `mlv-sidebar` default (`sidebar.scss:35`) | accent-pale pill |
| `mlv-sidebar` inside `mlv-page-shell` (`page-shell.scss:190-194`) | **rgb(190,190,190)** achromatic grey |
| saved-view list | rgb(234,238,250) accent-pale |
| `aria-pressed` icon button | rgb(228,228,228) neutral-active grey |

Named cause: `page-shell.scss:190-194` remaps `--mlv-sidebar-active-bg` to `color-mix(in srgb, var(--mlv-page-shell-effective-foreground) 24%, transparent)`. The tuning comment at `:183` states it was *"Measured on `rgb(65, 99, 169)`"* — a **blue** chrome, where 24% of a white foreground yields a light pill. `settings-access.html:29` sets `color="var(--mlv-background-base)"` — a **light** chrome, whose effective foreground is near-black, so the same formula lands at ~rgb(190,190,190): the darkest surface on the page is a navigation row.

**Target** — every surface resolves `--mlv-background-selected` / `--mlv-background-selected-hover` (SF-R1). The page-shell chrome remap survives, but with two corrections:

1. Mix against `var(--mlv-page-shell-effective-background)` instead of `transparent`, so the result is polarity-correct on a light chrome, a dark chrome and a brand chrome with one formula, and is opaque (a portalled flyout no longer picks up whatever is behind it).
2. Lower the percentages **for the six row-state fills only**, so the pill never exceeds the resting ladder's depth.

### Authoritative percentage table for `page-shell.scss` — this table wins over any percentage quoted elsewhere in this document

| line | declaration | kind | current | new |
| --- | --- | --- | ---: | ---: |
| `:98` | `--container-background-color` | field fill on chrome | 10% | **10%** (unchanged) |
| `:99` | `--container-border-color` | field border | 30% | **30%** (unchanged) |
| `:101-105` | `--container-action-color` | foreground | 78% | **78%** (unchanged) |
| `:111-115` | `--mlv-text-secondary` | foreground | 78% | **78%** (unchanged) |
| `:116-120` | `--mlv-text-tertiary` | foreground | 60% | **60%** (unchanged) |
| `:129` | `--container-border-color` (hover) | field border | 40% | **40%** (unchanged) |
| `:133` | `--container-border-color` (focused) | field border | 50% | **50%** (unchanged) |
| `:149-153` | `--mlv-text-secondary` (sidebar) | foreground | 78% | **78%** (unchanged) |
| `:156-160` | `--mlv-background-neutral-1` | **row-state fill** | 15% | **8%** |
| `:165-169` | `--mlv-background-neutral-1-hover` | **row-state fill** | 15% | **8%** |
| `:170-174` | `--mlv-background-neutral-1-active` | **row-state fill** | 24% | **12%** |
| `:185-189` | `--mlv-sidebar-hover-bg` | **row-state fill** | 15% | **8%** |
| `:190-194` | `--mlv-sidebar-active-bg` | **row-state fill** | 24% | **12%** |
| `:195-199` | `--mlv-sidebar-rail-color` | **row-state fill** | 30% | **24%** |

**Every** row above changes its second `color-mix` colour from `transparent` (or from a literal `rgb(255 255 255 / N%)`) to `var(--mlv-page-shell-effective-background)`. Only the six rows marked **row-state fill** change percentage: those are the ones that paint *behind content* and are therefore bound by SF-R5's "no state fill darker than the darkest resting surface". Foreground and border mixes are contrast-tuned and keep their percentages — lowering them would reduce legibility, not calm the surface.

Resolved:

| chrome | hover | active |
| --- | --- | --- |
| light (`#ffffff` bg, near-black fg) | rgb(236,236,236) | rgb(227,227,227) |
| dark default (`#171717` bg, `#fafafa` fg) | rgb(41,41,41) | rgb(50,50,50) |
| brand blue rgb(65,99,169), white fg | rgb(80,111,176) | rgb(88,118,179) |

The light-chrome results land on the new neutral ramp (hover 239, active 229) within 3 values; the dark-chrome active lands on `--mlv-elevation-bg-3` (51). One formula, three correct answers.

**Rationale** — SF-2.

## SF-R3 · One focus-ring formula, two permitted forms

**Current** — 113 declarations (inventory §8) using **3 widths** (`--mlv-stroke-width` 1px on 33 sites, `--mlv-stroke-width-medium` 2px on 12, literal `0.125rem` on 6), **7 offsets** (`0.125rem`, `-0.125rem`, `calc(var(--mlv-stroke-width) * -2)`, `0.0625rem`, **`0.175rem`** at `button.scss:96` — off the 0.125/0.25 grid and not a token — `var(--mlv-focus-ring-offset)`, `var(--mlv-spacing-0-5)`), and **2 mechanisms** — `outline` for almost all, and `box-shadow` for exactly two rings: `calendar.scss:31-34` / `:38-39` and `color-picker-popup.scss:65`.

There are **6 `outline: none` opt-outs**: `day-picker.scss:23`, `menubar.scss:25`, `color-picker.scss:201`, `editor.scss:400`, `calendar.scss:18`, and `slider.scss:110`. Two are already compliant — `slider.scss:110` restores Form A at `:127-129`, and `menubar.scss:25` restores it at `:30-31`.

A `--mlv-focus-ring` token exists (`theme.scss:804`) and is used once (`editor.scss:358`).

**Not a focus ring, and out of scope:** `list-item.scss:316` is the unread-indicator dot's decorative halo inside `&--unread .mlv-list-item__headline::before` — the row's actual focus ring is the `outline` at `:117-119`. Likewise every `box-shadow: inset …` state ring (`segmented.scss:143-149`, `button.scss:178`, `button-toggle.scss:17`, `editor.scss:37, 709`, `filter.scss:83`) is a border or pressed affordance, not a focus ring. This rule touches neither category.

**Target** — exactly two permitted forms:

**Form A — outline (default).**
```scss
&:focus-visible {
  outline: var(--mlv-stroke-width-medium) solid var(--mlv-border-focus);
  outline-offset: var(--mlv-focus-ring-offset);
}
```

**Form B — inset outline**, when the element's own container clips (`overflow: hidden`) or the ring would collide with a neighbour:
```scss
&:focus-visible {
  outline: var(--mlv-stroke-width-medium) solid var(--mlv-border-focus);
  outline-offset: calc(var(--mlv-focus-ring-offset) * -1);
}
```

`box-shadow` is permitted **only** where the element cannot paint an outline at all, and then it must be `box-shadow: var(--mlv-focus-ring);` — never a hand-built `0 0 0 Nrem` list.

`outline: none` is permitted **only** when the same rule (or a rule on a designated proxy element, e.g. `switch.scss:97-100`) restores Form A or Form B. All four current opt-outs must be re-checked against that condition.

`--mlv-stroke-width` (1px) is not a focus-ring width. `0.175rem` is not a value.

**Rationale** — SF-3.

## SF-R4 · Disabled is a declared surface, not an opacity multiply

**Current** — `button.scss:182-186`: `&--disabled { opacity: var(--mlv-disabled-opacity); }` = `0.4`. Multiplying a solid accent fill with white text produces a pale disc with **white ink on it** — measured rgb(185,196,237) fill with a white glyph in `baseline/light/85-support-inbox.png`. The disabled control loses its glyph rather than its emphasis, and reads *smaller and weaker* than the enabled secondary control beside it. The same formula makes `Save layout` and `Save Profile` washed accent blocks at full height in two sticky docks, with near-invisible ghost siblings.

**Target** — a declared disabled surface plus a legible disabled foreground:

| token | light | dark | high-contrast |
| --- | --- | --- | --- |
| `--mlv-background-disabled` (new) | `var(--mlv-palette-neutral-200)` `#e5e5e5` | `color-mix(in srgb, var(--mlv-palette-neutral-800) 60%, var(--mlv-palette-neutral-900))` `#202020` | `#d0d0d0` |
| `--mlv-text-disabled` (changed) | `neutral-300` `#d4d4d4` → **`neutral-500` `#737373`** | `neutral-600` `#525252` → **`neutral-500` `#737373`** | `#666666` unchanged |

```scss
// libs/core/button/src/lib/button/button.scss — emit AFTER the $filled-variants @each loop
&--disabled {
  --mlv-btn-bg: var(--mlv-background-disabled);
  --mlv-btn-bg-hover: var(--mlv-background-disabled);
  --mlv-btn-bg-active: var(--mlv-background-disabled);
  --mlv-btn-text-color: var(--mlv-text-disabled);
  --mlv-btn-box-shadow: none;
  cursor: not-allowed;
  pointer-events: none;
}

&--variant-transparent.#{$block}--disabled,
&--variant-outlined.#{$block}--disabled {
  --mlv-btn-bg: transparent;
}

&--variant-outlined.#{$block}--disabled {
  border-color: var(--mlv-border-subtle);
}
```

Disabled label legibility: `#737373` on `#e5e5e5` = **3.76:1** in light, `#737373` on `#202020` = **3.44:1** in dark. Disabled text is exempt from the WCAG AA text floor, but both clear 3:1 — where the current formula produces white-on-`#b9c4ed` at roughly 1.9:1. `taiga-refs/taiga-button.png` "Primary disabled" is the reference: a declared pale fill with adjusted text colour, not an opacity multiply.

**Emission order matters:** `&--disabled` currently sits at `button.scss:182`, *before* the `@each $filled-variants` loop, so the variant rules win at equal specificity by source order. It moves to **position 5 — last of the colour blocks — in the canonical emission order** (AB-R3), after `&[aria-pressed='true']`. A disabled control must show no pressed fill.

`opacity: var(--mlv-disabled-opacity)` remains correct for **non-filled, non-text** disabled affordances (a disabled drag handle, a disabled media thumbnail). It is prohibited on any element whose foreground is white on a coloured fill.

**Rationale** — SF-4, EX-A.6, EX-B.2 ("the dominant *perceptual* cause").

## SF-R5 · The state ramp lives inside the resting ladder

**Current** — `--mlv-background-neutral-1` `#f5f5f5` (245) → hover `color-mix(neutral-100 70%, neutral-400)` ≈ `#dcdcdc` (220) → active `color-mix(neutral-100 50%, neutral-400)` ≈ `#cccccc` (204) (`theme.scss:303-311`). A 25/41-value swing against a resting ladder whose entire span is 10 values. Hover and press are louder than every structural boundary in the product.

**Target** —

| step | current light | new light |
| --- | --- | --- |
| rest | `#f5f5f5` (245) | `#f5f5f5` (245) unchanged |
| hover | `#dcdcdc` (220) | **`#efefef` (239)** — `color-mix(in srgb, var(--mlv-palette-neutral-100) 60%, var(--mlv-palette-neutral-200))` |
| active | `#cccccc` (204) | **`#e5e5e5` (229)** — `var(--mlv-palette-neutral-200)` |

The active fill now lands **exactly** on `--mlv-background-sunken` (SL-R1) — the floor of the resting ladder. **Law: no state fill is darker than the darkest resting surface.** State swing drops from 41 to 16 values while the resting spread rises from 10 to 26, so state is now quieter than structure, not 5× louder.

**Owner override 2026-08-25 (#8 below):** `sunken` was reverted to `#f5f5f5`, so the equality above no longer holds — the pressed fill (`#e5e5e5`, 229) now sits one rung *below* the darkest resting surface (245) and the literal "law" as written is knowingly broken. What survives is the part the rule was for: the 41 → 16 value swing, i.e. state is quiet relative to structure. Nothing else may re-derive a value from "active === sunken"; the two are independent tokens now, and the surface that borrowed `sunken` for hover (`data-table.scss`) was moved onto `--mlv-background-neutral-1-hover` (`f7153368`).

Dark is unchanged: its ramp already lands on `--mlv-elevation-bg-3` / `-4` by design (`theme.scss:870-887`).

Contrast improves across the board: `--mlv-text-action` on the pressed fill goes 5.62 → **7.17:1**; `--mlv-text-secondary` goes to **6.20:1**. **Owner override 2026-08-25:** `--mlv-text-action` reverted to `primary-600`, which resolves this same pairing to **5.19:1** — still above the AA + margin floor; see "Post-implementation owner overrides" below.

**Rationale** — SF-5, SL-2.

## SF-R6 · One validation ring

**Current** — `baseline/light/42-input.png` "States": success (green), information (cyan), warning (amber) and error (crimson) each get a full-perimeter saturated 1px ring **plus** coloured hint text, all at the same visual weight (`form-control-wrapper.scss:127-139`). A form with mixed states reads as four alarms.

**Target** — **only `error` gets a coloured ring.** `success`, `info` and `warning` keep `--mlv-border-normal` and carry their meaning entirely in the message text (`mlv-message` already colours by state). `disabled` and `readonly` stay fully achromatic and are differentiated by fill and text colour.

```scss
&--state {
  // `success`, `info` and `warning` deliberately declare nothing: meaning lives
  // in `mlv-message`, not in a full-perimeter ring — a form with mixed states
  // must read as one alarm, not four. Only `error` keeps a coloured border.
  &-error {
    --container-border-color: var(--mlv-border-error);
  }

  &-default:hover {
    --container-border-color: var(--mlv-border-strong);
  }
}
```

The `&-success` / `&-info` / `&-warning` selectors are **removed**, not emptied — a comment-only rule emits no CSS and reads as unfinished work. The hover border also moves off the raw palette stop: `--mlv-border-strong` is `neutral-300` in light (the same pixel as today) and `neutral-600` in dark, which fixes a live dark-mode bug where a hovered field currently draws a near-white `neutral-300` border.

`taiga-refs/taiga-input.png` "States": only `Invalid` gets a coloured ring.

**Rationale** — SF-6.

---

## Sweep worklist — Dimension 5

| # | Target | Rule | Change |
| ---: | --- | --- | --- |
| 5.1 | `libs/styles/src/lib/theme.scss` (light block, after `:299`) | SF-R1 | Add `--mlv-background-selected: var(--mlv-background-accent-1-pale);` and `--mlv-background-selected-hover: var(--mlv-background-accent-1-pale-hover);` with a comment stating the `-active` law. |
| 5.2 | `libs/styles/src/lib/theme.scss` (light block, after `:433`) | SF-R1 | Add `--mlv-text-on-selected: var(--mlv-text-action);` |
| 5.3 | `libs/styles/src/lib/theme.scss` (light block, after `:312`) | SF-R4 | Add `--mlv-background-disabled: var(--mlv-palette-neutral-200);` |
| 5.4 | `libs/styles/src/lib/theme.scss` (`@mixin dark-tokens`, after `:888`) | SF-R4 | Add `--mlv-background-disabled: color-mix(in srgb, var(--mlv-palette-neutral-800) 60%, var(--mlv-palette-neutral-900));` |
| 5.5 | `libs/styles/src/lib/theme.scss` (`[data-theme='high-contrast']`, after `:1096`) | SF-R4 | Add `--mlv-background-disabled: #d0d0d0;` |
| 5.6 | `libs/styles/src/lib/theme.scss:419` | SF-R4 | `--mlv-text-disabled: var(--mlv-palette-neutral-300)` → `var(--mlv-palette-neutral-500)` |
| 5.7 | `libs/styles/src/lib/theme.scss:992` | SF-R4 | `--mlv-text-disabled: var(--mlv-palette-neutral-600)` → `var(--mlv-palette-neutral-500)` |
| 5.8 | `libs/styles/src/lib/theme.scss:303-307` | SF-R5 | `--mlv-background-neutral-1-hover` → `color-mix(in srgb, var(--mlv-palette-neutral-100) 60%, var(--mlv-palette-neutral-200))`. Replace the mix comment with SF-R5's law. |
| 5.9 | `libs/styles/src/lib/theme.scss:308-312` | SF-R5 | `--mlv-background-neutral-1-active` → `var(--mlv-palette-neutral-200)` |
| 5.10 | `libs/core/button/src/lib/button/button.scss:175-180` | SF-R1 | `&[aria-pressed='true']` moves to **position 4** in the canonical emission order (requires 4.0 first). `--mlv-btn-bg` and `--mlv-btn-bg-hover` → `var(--mlv-background-selected)` / `var(--mlv-background-selected-hover)`; **add** `--mlv-btn-text-color: var(--mlv-text-on-selected);` — without this pin, `&--variant-transparent:hover` from 4.1 ties at (0,2,0) and wins by source order. Keep the inset ring. Extend the existing `:170-174` comment to name the third pinned property. |
| 5.11 | `libs/core/button/src/lib/button/button.scss:182-186` | SF-R4 | Delete this `&--disabled` block and re-add it (with the two variant qualifiers) at **position 5 — last of the colour blocks**, after `&[aria-pressed='true']`, using the exact SCSS from SF-R4. |
| 5.12 | `libs/core/list/src/lib/list-item/list-item.scss:11-12` | SF-R1 | `--mlv-list-item-bg-selected: var(--mlv-background-accent-1-pale)` → `var(--mlv-background-selected)`; `-selected-hover` → `var(--mlv-background-selected-hover)`. |
| 5.13 | `libs/core/list/src/lib/list-item/list-item.scss:136` | SF-R1 | `--mlv-list-item-color: var(--mlv-text-primary)` inside `&--active, &[aria-selected='true']` → `var(--mlv-text-on-selected)`. |
| 5.14 | `libs/core/sidebar/src/lib/sidebar/sidebar.scss:35` | SF-R1, SF-R2 | `--mlv-sidebar-active-bg: var(--mlv-background-accent-1-pale)` → `var(--mlv-background-selected)`. Update the `var()`-fallback comment at `:30-32`. |
| 5.15 | `libs/core/page/src/lib/page-shell/page-shell.scss:185-199` | SF-R2 | The three sidebar row-state mixes: 15% → **8%**, 24% → **12%**, 30% → **24%**, each mixed with `var(--mlv-page-shell-effective-background)` instead of `transparent`. Percentages come from **SF-R2's authoritative percentage table**, which overrides any figure quoted elsewhere. Replace the `rgb(65, 99, 169)` tuning comment at `:183-184` with SF-R2's three-chrome resolved table. |
| 5.16 | `libs/core/page/src/lib/page-shell/page-shell.scss:156-174` | SF-R2, SL-R6 | The three `--mlv-background-neutral-1*` row-state mixes: 15% → **8%**, 15% → **8%**, 24% → **12%**, mixed against the effective background. Same authoritative table. |
| 5.17 | `libs/core/view-variant/src/lib/view-variant-list/view-variant-list.scss:110, 111, 114` | SF-R1 | `:110` `background-color: var(--mlv-background-accent-1-pale)` → `var(--mlv-background-selected)`; `:111` **replace** the existing `color: var(--mlv-text-action)` → `var(--mlv-text-on-selected)` (do not add a second `color` line); `:114` `var(--mlv-background-accent-1-pale-hover)` → `var(--mlv-background-selected-hover)`. All three are value-preserving today — the new tokens are indirections onto exactly these two. |
| 5.18 | `libs/core/button/src/lib/button/button.scss:95-96` | SF-R3 | `outline: 0.125rem solid transparent` → `var(--mlv-stroke-width-medium) solid transparent`; `outline-offset: 0.175rem` → `var(--mlv-focus-ring-offset)`. |
| 5.19 | **33 sites, enumerated** (ring *width* `var(--mlv-stroke-width)` → `var(--mlv-stroke-width-medium)`): `accordion-item.scss:52`, `avatar-group.scss:81`, `bottom-nav.scss:79`, `breadcrumb.scss:53`, `breadcrumb.scss:135`, `chat-media-grid.scss:43`, `chat-message.scss:80`, `chat-message.scss:172`, `chat.scss:192`, `checkbox.scss:35`, `copy-to-clipboard.scss:154`, `data-table.scss:373`, `data-table.scss:512`, `date-range-picker.scss:24`, `drawer.scss:77`, `file-upload-item.scss:104`, `file-upload.scss:46`, `link.scss:40`, `number-input.scss:75`, `page.scss:127`, `popup.scss:159`, `radio.scss:34`, `rating.scss:37`, `scrollbar.scss:99`, `sidebar-rail.scss:31`, `split-pane.scss:118`, `stepper.scss:50`, `switch.scss:98`, `tile.scss:204`, `tree.scss:61`, `view-variant-list.scss:100`, `editor-table.scss:49`, `time-picker-column.scss:86` | SF-R3 | → `var(--mlv-stroke-width-medium)`. On `time-picker-column.scss:86` **also drop the `, 2px` literal fallback**. **Do not touch** `alert.scss:152` — it is inside a commented-out block. **Do not touch** any `box-shadow: inset …` ring; those are borders and pressed affordances, not focus rings. |
| 5.20 | **6 sites, enumerated** (literal `0.125rem` ring width): `list-item-group.scss:31`, `list-item.scss:118`, `segmented-item.scss:60`, `slider.scss:128`, `tab-item.scss:45`, `tabs.scss:86` | SF-R3 | → `var(--mlv-stroke-width-medium)`. |
| 5.21 | **12 sites, no change** (already `var(--mlv-stroke-width-medium)`): `sidebar-item.scss:62, 150`, `sidebar-group.scss:72, 236`, `sidebar-workspace.scss:54`, `sidebar-trigger.scss:55`, `menubar.scss:30`, `chip.scss:144`, `avatar-group.scss:159`, `editor.scss:481, 537, 659` | SF-R3 | Verify only. Listed so the sweep does not re-derive them. |
| 5.22 | `outline-offset` — **outliers, enumerated**: `accordion-item.scss:53` (`calc(var(--mlv-stroke-width) * -2)`), `chip.scss:146` (`0.0625rem`), `editor.scss:482`, `editor.scss:539`, `editor.scss:660` (all `var(--mlv-spacing-0-5)`). Already correct: `menubar.scss:31`. Commented out, do not touch: `alert.scss:153`. | SF-R3 | `accordion-item.scss:53` → `calc(var(--mlv-focus-ring-offset) * -1)`; the other four → `var(--mlv-focus-ring-offset)`. |
| 5.23 | `outline-offset` — the mechanical remainder: every literal `0.125rem` → `var(--mlv-focus-ring-offset)`, every literal `-0.125rem` → `calc(var(--mlv-focus-ring-offset) * -1)` | SF-R3 | Enumerate with `grep -rn -A3 --include='*.scss' ':focus-visible' libs/core libs/cdk libs/editor \| grep 'outline-offset'`. Both literals equal the token's own value, so this is value-preserving everywhere. If a site does not match either literal and is not in 5.22, **report it rather than guessing**. |
| 5.24 | `libs/core/calendar/src/lib/calendar/calendar.scss:18, 30-35, 37-40` | SF-R3 | Convert the only two `box-shadow` focus rings in the library to Form A. Delete `outline: none` at `:18`. Replace the `&:focus-visible` block at `:30-35` with Form A. **Delete** the `&--embedded:focus-visible` block at `:37-40` outright — it exists only because the two-layer `box-shadow` had to restate the resting shadow, and an `outline` does not overwrite `box-shadow` at all. The resting `box-shadow` at `:17` (→ `--mlv-shadow-raised` per 1.19) is therefore preserved automatically on both variants; that was the second layer at `:34`. |
| 5.25 | `libs/core/color-picker/src/lib/color-picker-popup/color-picker-popup.scss:65` | SF-R3 | `box-shadow: 0 0 0 0.125rem var(--mlv-border-focus)` → `box-shadow: var(--mlv-focus-ring);` (Form B is unavailable — the swatch is inside a clipped grid). |
| 5.26 | `libs/core/day-picker/src/lib/day-picker/day-picker.scss:23`, `libs/core/color-picker/src/lib/color-picker/color-picker.scss:201`, `libs/editor/src/lib/editor/editor.scss:400` | SF-R3 | For each `outline: none`, confirm a proxy element restores Form A or B. Where none exists, add Form A. Report each decision. **Already compliant, no change:** `slider.scss:110` (restored at `:127-129`) and `menubar.scss:25` (restored at `:30-31`). |
| 5.27 | `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.scss:127-146` | SF-R6 | Apply the exact `&--state` block from SF-R6. **Delete the `&-success`, `&-info` and `&-warning` selectors entirely** — do not leave comment-only empty rules, which emit nothing and read as unfinished work. The explanatory comment goes above `&-error`. |
| 5.29 | `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.scss:149` | SF-R3 | `--container-shadow: 0 0 0 1px currentColor` → `0 0 0 var(--mlv-stroke-width) currentColor` (the literal `1px` also violates the rem rule in `.claude/rules/bem-scss.md`). |
| 5.30 | `libs/core/segmented/src/lib/segmented/segmented.scss:143-149` | SF-R6 | Delete the `warning` and `success` inset rings; keep the `error` one. These are inset *state borders*, not focus rings — SF-R3 does not touch them. |
| 5.31 | `libs/styles/src/lib/theme-contrast.spec.mjs:82-83` | SF-R5 | `'#dcdcdc'` → `'#efefef'`; `'#cccccc'` → `'#e5e5e5'`. |
| 5.32 | `libs/styles/src/lib/theme-contrast.spec.mjs` (light-values test) | SF-R5, SF-R1 | ~~Add `assert.equal(hex('--mlv-background-neutral-1-active','light'), hex('--mlv-background-sunken','light'));`~~ **first assertion WITHDRAWN by owner override #8** — the two tokens are intentionally unequal now (`:92-93`). The `assert.equal(hex('--mlv-background-selected','light'), '#eaeefa');` half stands. |
| 5.33 | `apps/docs/src/app/showcases/pages/support-inbox/support-inbox.scss:339-342, 407-410` | SF-R1, AB-R4, AB-R7 | **Superseded.** The star becomes `mlv-icon-toggle` with `tone="warning"` (AB-R7), adopted in the showcase sweep, not here; `__row-star` / `__star-on` are retired along with the bespoke star markup, not recoloured in place. Do **not** apply the `--mlv-text-on-selected` patch this row previously specified — it targeted markup this document's showcase sweep removes. Listed so the showcase sweep does not re-derive the "recolour, don't retire" reading. |

---

# 6 · Motion

## MO-R1 · Every animated BEM block ships a reduced-motion path

**Current** — of the 71 stylesheets under `libs/core`, `libs/cdk` and `libs/editor` that declare a `transition` or `animation`, **50 have one and 21 do not**. `.claude/rules/bem-scss.md` requires it. The two largest offenders are the ones users see most: the tabs sliding indicator (`tabs.scss:51`, 220ms) and the time-picker drum scroll — both continuous motion with no opt-out.

**Target** — every one of the 21 files ends with `@include mixins.reduced-motion($block);` at top level (outside the block selector). Where the file does not yet `@use` the mixins module, add the import as the first line.

**Rationale** — MO-1.

## MO-R2 · Durations come from the scale

**Current** — 26 literals (inventory §7). **220ms** is used for the sliding indicator in *two* components (`tabs.scss:51`, `segmented.scss:48`) and is not a token value — two components independently picking the same non-token number shows the scale did not serve the need. Also: `drawer.scss:150,152` 350ms; `pagination.scss:86-87` `0.1s` / `0.2s` written as seconds; `copy-to-clipboard.scss` uses **six** distinct durations (140 / 180 / 200 / 220 / 240 / 260ms) in one component.

**Target** — the scale is `instant 0 / fast 100 / normal 200 / slow 300 / slower 400 / sluggish 600` and it is complete. Every literal maps to its nearest step:

| literal | token |
| --- | --- |
| 140ms, 180ms, `0.1s` | `var(--mlv-duration-fast)` (100ms) |
| 200ms, 220ms, 240ms, 260ms, `0.2s` | `var(--mlv-duration-normal)` (200ms) |
| 350ms | `var(--mlv-duration-slow)` (300ms) |

A component-scoped override variable keeps its `var(--mlv-x-duration, …)` shape, but the fallback must be a token, not a number: `var(--mlv-tab-indicator-duration, var(--mlv-duration-normal))`.

Looping decorative animations that legitimately run for seconds (`skeleton.scss:41` 2s, `loader.scss` 1.8s/3s/4s, `avatar.scss:109` 1.4s) are **out of scope** — they are not interaction feedback and the scale does not cover them.

**Rationale** — MO-2.

## MO-R3 · Easings come from the scale

**Current** — `copy-to-clipboard.scss` writes `cubic-bezier(0.23, 1, 0.32, 1)` **7 times** (inventory §7, lines 581-587). That is byte-for-byte the value of `--mlv-ease-out-strong` (`theme.scss:721-726`). The token exists, is correctly named for the use, and is ignored.

**Target** — no `cubic-bezier(...)` literal outside `theme.scss`. `ease-out` / `ease-in` / `ease` keywords are likewise replaced by `var(--mlv-ease-out)` / `var(--mlv-ease-in)` / `var(--mlv-ease-default)`.

**Rationale** — MO-3.

## MO-R4 · One duration per interaction class

**Current** — the same interaction class runs at 4× different speeds: button / filter / rating / number-input at `--mlv-duration-fast` (100ms), radio / tile at `--mlv-duration-normal` (200ms), and **card at `--mlv-duration-slower` (400ms)** (`card.scss:22`) — the token named for slow, page-level movement, applied to a card hover shadow. A card and a button side by side respond at visibly different speeds.

**Target** —

| interaction class | duration |
| --- | --- |
| hover / active / focus feedback on any control or surface (colour, border, shadow, small transform) | `var(--mlv-duration-fast)` (100ms) |
| on-screen movement that the user tracks (sliding indicator, expanding panel, drum scroll, thumb travel) | `var(--mlv-duration-normal)` (200ms) |
| overlay enter/leave (dialog, drawer, popup, toast) | `var(--mlv-duration-slow)` (300ms) |

`--mlv-duration-slower` and `--mlv-duration-sluggish` have no interaction-feedback use.

**Rationale** — MO-4.

## MO-R5 · One name per curve, declared once

**Current** — `--mlv-ease-spring` is declared **twice** in the same `:root` block with identical values (`theme.scss:714-719` and `744-749`); the later silently wins. `--mlv-ease-default` (`:710`) and `--mlv-ease-in-out` (`:713`) are the same curve `cubic-bezier(0.4, 0, 0.2, 1)` under two names, so "which easing does this use" has no single answer.

**Target** — delete the first `--mlv-ease-spring` declaration (`:714-719`), keeping the one in the "Extended spring easing variants" group so all four spring curves are declared together. Make the synonym explicit rather than duplicated: `--mlv-ease-in-out: var(--mlv-ease-default);`. Same computed value, one source.

**Rationale** — MO-5.

---

## Sweep worklist — Dimension 6

| # | Target | Rule | Change |
| ---: | --- | --- | --- |
| 6.1 | 21 files (list below) | MO-R1 | Append `@include mixins.reduced-motion($block);` at top level. |
| 6.2 | `libs/cdk/utils/src/lib/fade/fade.scss` (`$block: mlv-fade`) | MO-R1 | Also add `@use '../../../../../styles/src/lib/mixins' as mixins;` as line 1. |
| 6.3 | `libs/core/number-input/src/lib/number-input/number-input.scss` (`mlv-number-input`), `libs/core/segmented/src/lib/segmented-item/segmented-item.scss` (`mlv-segmented-item`), `libs/core/sidebar/src/lib/sidebar-rail/sidebar-rail.scss` (`mlv-sidebar-rail`), `libs/core/tabs/src/lib/tab-item/tab-item.scss` (`mlv-tab-item`), `libs/core/tabs/src/lib/tabs/tabs.scss` (**`$block: mlv-tab-group`**, not `mlv-tabs`), `libs/core/title/src/lib/title/title.scss` (`mlv-title`) | MO-R1 | Also add `@use '../../../../../styles/src/lib/mixins' as mixins;` as line 1 — these six do not `@use` it yet. |
| 6.4 | `libs/core/{alert/src/lib/alert/alert, avatar-group/src/lib/avatar-group/avatar-group, breadcrumb/src/lib/breadcrumb/breadcrumb, combobox/src/lib/combobox/combobox, form-utils/src/lib/form-control-wrapper/form-control-wrapper, link/src/lib/link/link, page/src/lib/page/page, progress/src/lib/progress/progress, scrollbar/src/lib/scrollbar/scrollbar, select/src/lib/select/select, split-pane/src/lib/split-pane/split-pane, time-picker/src/lib/time-picker-column/time-picker-column, time-picker/src/lib/time-picker/time-picker}.scss` and `libs/core/dialog/src/lib/dialog-container.scss` | MO-R1 | These 14 already `@use` the mixins module — append the include only. |
| 6.5 | `libs/core/tabs/src/lib/tabs/tabs.scss:48-52` | MO-R2 | `var(--mlv-tab-indicator-duration, 220ms)` → `var(--mlv-tab-indicator-duration, var(--mlv-duration-normal))` (4 occurrences). |
| 6.6 | `libs/core/segmented/src/lib/segmented/segmented.scss:48` | MO-R2 | `--mlv-segmented-indicator-duration: 220ms` → `var(--mlv-duration-normal)`. |
| 6.7 | `libs/core/drawer/src/lib/drawer/drawer.scss:150, 152` | MO-R2 | `var(--mlv-drawer-snap-duration, 350ms)` → `var(--mlv-drawer-snap-duration, var(--mlv-duration-slow))`. |
| 6.8 | `libs/core/pagination/src/lib/pagination/pagination.scss:86-87` | MO-R2, MO-R3 | `width 0.1s ease-out` → `width var(--mlv-duration-fast) var(--mlv-ease-out)`; `opacity 0.2s ease-out` → `opacity var(--mlv-duration-normal) var(--mlv-ease-out)`. |
| 6.9 | `libs/core/copy-to-clipboard/src/lib/copy-to-clipboard/copy-to-clipboard.scss:89, 103, 104, 105, 109, 205, 209` | MO-R2, MO-R3 | Map durations via MO-R2's table (140→fast, 180→fast, 200→normal, 220→normal, 240→normal, 260→normal) and replace all 7 `cubic-bezier(0.23, 1, 0.32, 1)` literals with `var(--mlv-ease-out-strong)`. |
| 6.10 | `libs/core/card/src/lib/card/card.scss:22` | MO-R4 | `transition-duration: var(--mlv-duration-slower)` → `var(--mlv-duration-fast)`. |
| 6.11 | `libs/core/tile/src/lib/tile/tile.scss:47` | MO-R4 | `transition-duration: var(--mlv-duration-normal)` → `var(--mlv-duration-fast)` (hover/active feedback class). |
| 6.12 | `libs/core/radio/src/lib/radio/radio.scss:52, 67` | MO-R4 | `:52` `transition: border-color var(--mlv-duration-normal) …` → `var(--mlv-duration-fast)`; `:67` `transition-duration: var(--mlv-duration-normal)` → `var(--mlv-duration-fast)`. Both are hover/checked feedback, not tracked movement. |
| 6.13 | `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.scss:73` | MO-R4 | `transition: all var(--mlv-duration-normal) …` → `var(--mlv-duration-fast)`; the `transition-property` line at `:74` already narrows it, so delete the redundant `all` shorthand and keep only `transition-property` + `transition-duration` + `transition-timing-function`. |
| 6.14 | `libs/core/chip/src/lib/chip/chip.scss:70-73, 128-129` | MO-R2, MO-R4 | Drop the literal fallbacks (`200ms`, `100ms`, `ease`) — the tokens always resolve. Hover feedback → `var(--mlv-duration-fast)`. |
| 6.15 | `libs/core/slider/src/lib/slider/slider.scss:109, 117, 300, 362` | MO-R2 | Drop the `, 100ms` / `, ease` literal fallbacks. |
| 6.16 | `libs/core/switch/src/lib/switch/switch.scss:129-130, 141` | MO-R4 | Track colour is hover-class feedback → `var(--mlv-duration-fast)`; thumb travel is tracked movement → keep `var(--mlv-duration-normal)`. |
| 6.17 | `libs/styles/src/lib/theme.scss:714-719` | MO-R5 | Delete this first `--mlv-ease-spring` declaration; the one at `:744-749` remains. |
| 6.18 | `libs/styles/src/lib/theme.scss:713` | MO-R5 | `--mlv-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)` → `var(--mlv-ease-default)`. |
| 6.19 | Any remaining `cubic-bezier(` outside `theme.scss` | MO-R3 | Enumerate with `grep -rn --include='*.scss' --include='*.css' 'cubic-bezier(' libs/ apps/` and map to the matching `--mlv-ease-*`. Report any curve with no token equivalent rather than inventing one. |

---

# 7 · Composition recipes

**What this section is.** Three recipes, not rules: they carry no `XX-Rn` id, add no worklist entry, and change no rule count. Dimensions 1–6 fixed the *components*; this section is the instruction set for the **showcase layer** — the four composed routes under `apps/docs/src/app/showcases/pages/`. A recipe never restates a landed change. It says what the composition must stop doing so the landed primitive can finally be seen, and it names the file and line where that happens.

**Baseline.** Every rule cited here has already landed in `libs/` (`cbf55b41`…`7fb4709c`). Line anchors are as of `7fb4709c`; if a line has moved, match on the quoted markup, not the number.

**Coverage discipline.** Each recipe ends with a per-showcase applicability table covering all four routes. A **No change** row is a decision this document already made — an executor must not go looking for work there, and must not "improve" a row marked conforming.

---

## Recipe A · Nested surfaces — one bordered card per region

Resolves **EX-A.1** (five concentric bordered surfaces, one pixel value), **EX-C.1**, **EX-C.3** at the composition layer. Enforces **SL-R2**, **SL-R4**, **SL-R5** where the showcase currently fights them.

### The law

1. **One showcase-authored bordered *level* per region.** A "showcase-authored surface" is any local rule that sets two or more of `border` / `border-radius` / `background-color` on a container, or any `<mlv-card>` the showcase places itself. The cap is on **depth, not count**: siblings at one level are fine and expected — a card grid, one card per API key, one section card per page region. What is prohibited is **stacking**: a showcase surface inside another showcase surface, or a showcase surface inside a component surface.
2. **Below that card, containment is the component's job, not the showcase's.** One component surface may sit inside the showcase card (a depth-0 `mlv-tile`, an `mlv-card` row, a `mlv-data-table`). Everything deeper is flush.
3. **A nested group expresses itself with a rail and an indent, never a fill.** That is the landed `.mlv-tiles--nested` (`tiles.scss:134-146`): `padding-inline-start: var(--mlv-spacing-4)` + `border-inline-start: var(--mlv-stroke-width) solid var(--mlv-border-subtle)`, and its children's `background-color` / `border-color` / `border-radius` / `box-shadow` stripped. The showcase must not paint on that element.
4. **A sunken zone is a floor, not a nesting level.** `--mlv-background-sunken` is `#e5e5e5` in light after SL-R1 — 16 values below a quiet band, deliberately visible. It is legitimate **once per region** to mark a plain well (an inset tray, a preview stage) and is **prohibited** on any element that also carries `.mlv-tiles--nested`, because the rail already says "inside".
5. **Rows get hairlines, not cards.** SL-R5 landed the plain-list hairline (`list.css:25`, `--mlv-list-gap: 0` at `:10`, `--mlv-list-item-radius: 0` at `list-item.scss:19`). A showcase must not re-wrap `mlv-list-item` rows in a bordered or filled per-row div to "make them distinct".

**Carve-out — an inline message chip is not a region-level card.** Clause 1's ≥ 2-of-3 test is a *container* test. A small inline callout that wraps a sentence of message text — an error line, an internal-note bubble — trips it mechanically (a tinted fill plus a radius) while carrying no nesting meaning at all: the tint **is** the message, it hosts no other component, and it never becomes a level in the surface ladder. Such a chip is **exempt from clause 1**, and it is exempt on three conditions: (a) the fill is a `-pale` semantic tint, never a resting-ladder surface token; (b) it wraps text only, with no nested surface inside it; (c) it is not repeated as the chrome of a row. Two sites in this scope qualify and are **not** violations: `support-inbox.scss:660-672` (`&__error` — `--mlv-radius-s` + `--mlv-background-danger-1-pale`) and `:704-716` (`&__note` — leading rail + `--mlv-radius-s` + `--mlv-background-warning-1-pale`). They are named here so an executor pattern-matches neither as a defect nor as a licence to wrap anything else.

### Landed primitives to lean on

| Need | Use | Where it landed |
| --- | --- | --- |
| Nested grouping inside a tiles tree | `.mlv-tiles--nested` (automatic at `depth > 0`) | `tiles.ts:100`, `tiles.scss:134-146` |
| Flush, canvas-level fill under a border | `var(--mlv-elevation-bg-1)` → `var(--mlv-background-base)` | `theme.scss:492-494`; consumed by `tile.scss:43` |
| A card that must read as raised | `var(--mlv-background-raised)` + `var(--mlv-shadow-raised)` + `var(--mlv-radius-card)` | SL-R2 / SL-R3 / RR-R1 |
| A real well | `var(--mlv-background-sunken)` | `theme.scss:253` |
| Row boundaries | plain `mlv-list` hairline | `list.css:25` |
| A leading marker inside a flush row | `border-inline-start` at `var(--mlv-stroke-width-thick)` + `var(--mlv-radius-full)` | pattern already used at `website-builder-node.scss:21-29` |

### Before / after — the website-builder block card (exhibit A's surface)

**Before** — `.mlv-tiles--nested` has landed, but the showcase paints a sunken well on the very element the rail is drawn on, and its `padding` shorthand overwrites the rail's indent. `.wb-node__children` compiles to `.wb-node__children[_ngcontent-…]` — specificity (0,2,0) under the docs app's emulated encapsulation — so it beats `.mlv-tiles--nested` (0,1,0) every time.

```text
main[mlvPage]                                    canvas   #fafafa
└── section.wb-section                           BORDER + radius-l + #ffffff        ← surface 1 (showcase)
    └── mlv-tiles.wb-section__tiles              depth 0 — no chrome
        └── docs-wb-node  (container, level 1)
            ├── ::before kind rail               accent-2, 3px                      ← accent mark (Recipe C)
            └── mlv-tile.wb-node__tile           BORDER + radius-card + #fafafa     ← surface 2 (component)
                └── mlv-tiles.wb-node__children.mlv-tiles--nested
                        showcase:  #e5e5e5 fill + radius-m + padding .5rem          ← surface 3 (showcase)
                        library:   rail + 1rem indent  ← DEFEATED by the padding shorthand
                    └── docs-wb-node  (row, level 2)
                        └── mlv-tile             flush (SL-R4 strips it)  ✔
                            └── mlv-tiles.wb-node__children.mlv-tiles--nested
                                    #e5e5e5 fill + radius-m again                   ← surface 4 (showcase)
                                └── docs-wb-node (block, level 3)
                                    └── mlv-tile flush  ✔
```

Four competing surfaces; the two rails the library draws are invisible inside the slabs.

**After** — the showcase keeps its one card and hands every deeper level to the rail:

```text
main[mlvPage]                                    canvas   #fafafa
└── section.wb-section                           BORDER + radius-l + #ffffff        ← the ONE showcase card
    └── mlv-tiles.wb-section__tiles              depth 0 — no chrome
        └── docs-wb-node  (container, level 1)
            ├── ::before kind rail               --mlv-border-strong, 3px (neutral)
            └── mlv-tile.wb-node__tile           BORDER + radius-card + #fafafa     ← the ONE component surface
                └── mlv-tiles.wb-node__children.mlv-tiles--nested
                        rail (--mlv-border-subtle) + 1rem indent, no fill, no radius
                    └── docs-wb-node  (row, level 2)
                        ├── ::before kind rail   --mlv-border-normal, 3px
                        └── mlv-tile             flush
                            └── mlv-tiles.wb-node__children.mlv-tiles--nested
                                    rail + 1rem indent
                                └── docs-wb-node (block, level 3)
                                    ├── ::before kind rail  --mlv-border-subtle, 3px
                                    └── mlv-tile flush
```

**Two bordered levels and three rails** — exactly the result SL-R4 states.

### The edits this recipe authorizes

| Target | Change |
| --- | --- |
| `website-builder-node.scss:84-95` (`.wb-node__children`) | Delete `background-color: var(--mlv-background-sunken);` (`:85`) and `border-radius: var(--mlv-radius-m);` (`:87`). Change `padding: var(--mlv-spacing-2);` (`:86`) to `padding-block: var(--mlv-spacing-2);` — **the shorthand form must not survive**: it writes all four physical longhands at (0,2,0) and silently overwrites the library's `padding-inline-start`, deleting the rail's indent. The `&--tracks` grid rule at `:92-94` is unchanged. |
| `website-builder-node.scss:80-83` (the comment above it) | Rewrite. It currently reads *"An elevation ladder would do nothing, because `--mlv-elevation-bg-1…5` all resolve to `--mlv-background-raised` in the light theme"* — false since SL-R2 (rung 1 is `--mlv-background-base`), and the alternating-well argument it makes is the thing this recipe removes. Replace with a note that `.mlv-tiles--nested` (SL-R4) owns the nested group's chrome and the showcase paints nothing on it. |
| `website-builder-node.scss:21-29` (`:host::before`) | **Keep.** The kind rail is a *semantic* marker (container / row / block), not a containment marker, and it is distinguishable from the group rail by weight and radius: `--mlv-stroke-width-thick` + `--mlv-radius-full` per node vs. a `--mlv-stroke-width` square hairline for the whole group. Do not delete it and do not add a third rail. Its colour changes — see Recipe C. |
| `website-builder.scss:95-104` (`.wb-section`) | **No change.** This is the region's one authorized bordered card. |

### Applicability

| Showcase | Instances | Verdict |
| --- | --- | --- |
| **website-builder** | 2 nested-tiles sites (`website-builder-node.html:171-176` container body, `:222-227` row body), both styled by the one `.wb-node__children` rule | **Change** — the three SCSS edits above. This is the exhibit-A surface and the only place in all four showcases where a showcase surface is painted over a landed library surface. |
| **support-inbox** | **0 region-level bordered surfaces.** Every boundary is a single hairline — layout seams at `support-inbox.scss:202, 210, 243, 362, 425, 448, 478` and the lg in-flow details seam at `:517` (its own comment: *"only the in-flow lg column needs the seam"*) — or one leading rail (`:689`, the quote). The two inline message chips at `:660-672` and `:704-716` trip clause 1's ≥ 2-of-3 test and are **exempt** under the carve-out above | **No change.** Already the recipe's target state; cite it as the in-repo reference. |
| **data-operations** | 0. `data-operations.scss` declares no `border` and no container `background-color`; the table owns its row chrome and `mlv-page-end-pane` owns the inspector | **No change.** |
| **settings-access** | 15 `<mlv-card>` (`settings-access.html:457, 598, 750, 864, 908, 1067, 1260, 1352, 1366, 1510, 1652, 1737, 1873, 1893, 1913`), **maximum nesting depth 1** — no card inside a card. Inner grouping is already rails (`settings-access.scss:506`, `:599`) and one neutral tray (`:575-577`, `:600-605`) | **No change.** Pinned here so the sweep does not add a bordered wrapper around the roster, the invitation rows or the session rows. |

---

## Recipe B · Control-cluster geometry

Resolves **EX-A.2** (three controls, two container treatments, no rule), **EX-A.5** (a 40px cluster on a 20px text block), **EX-B.1 layer 5** (the only circle in a row of pills). Enforces **AB-R1**, **AB-R2**, **CH-R4**, **CH-R5**.

**Definition.** A *control cluster* is the group of actions rendered once per repeated unit — a list row, a table row, a tile row. The canonical shape is **toggle · config · add · delete**. A group of actions that renders once per view — a page header, a dock, a composer — is **not** a control cluster. Neither are an `mlv-empty-state`'s projected actions: an empty state **replaces** the content rather than decorating a row, so its buttons are labelled calls to action and their variant is set by **Recipe C clause 2**, not by the `variant` row below.

**Which rows of the spec below reach a once-per-view group.** Split by what the row actually depends on:

- **Cardinality-dependent — does NOT reach it.** The **density at nesting depth** row (a once-per-view group has no nesting depth to step down through and takes the view's own density) and the **`variant` + promotion** rows, which are AB-R1's per-*repeated-unit* cap plus AB-R2. A once-per-view group takes its chrome from **Recipe C** instead: neutral members plus at most **one** promoted member, and that member is the view surface's single primary. This is why the support-inbox composer keeps `attach` transparent beside a `primary` `Send` and needs no `variant` edit.
- **Geometry, cardinality-independent — DOES reach it.** The **`shape`** and **gap** rows. Shape uniformity is a property of a visually grouped row of buttons, not of how many times that row renders: a header's icon buttons sit shoulder to shoulder with its labelled buttons exactly as a table row's do, and EX-B.1 layer 5 (*"the only circle in a row of pills"*) was measured on a **once-per-view** thread header, not on a repeated unit. A once-per-view group that is uniform already needs no edit.

### The one spec

| Property | Value | Why |
| --- | --- | --- |
| `variant` | `transparent` on **every** member | AB-R1 landed it as `--mlv-text-secondary` at rest / `--mlv-text-primary` on hover (`button.scss:284-295`). AB-R2: one chrome per cluster. Includes the destructive member — AB-R3 gives trash no tone and no dedicated treatment. |
| Promotion | At most **one** member may take a different variant, and only if it is the unit's primary action **and** the view's single accent (Recipe C) is unspent. In all four showcases it is spent. **⇒ no promotions.** | AB-R2 |
| `shape` | One shape for the whole cluster. `square` when any labelled button shares the cluster (it resolves `--mlv-radius-button`, 8px after RR-R1, so it matches the pills beside it); `circle` only when every member is a glyph and no labelled button sits in the same cluster. | EX-B.1 layer 5 |
| Icon `[size]` | Do not tune per context. `.mlv-button--icon-only` derives the glyph from `calc(var(--mlv-btn-height) * var(--mlv-icon-in-container-ratio))` (0.45, `theme.scss:720`) after CH-R4, so the authored `[size]` is advisory and the ratio is constant at every density. | CH-R4 |
| Gap | Glyph-only cluster: `var(--mlv-spacing-1)`. Cluster mixing glyph + labelled buttons: `var(--mlv-spacing-2)`. Inside `mlv-tile` the library already supplies it as `--mlv-tile-controls-gap` (`tile.scss:25, 286-291`) — do not override. | matches the landed tile ramp |
| Alignment | `display: flex; align-items: center;` and trailing-aligned (`margin-inline-start: auto` or a `mlv-spacer`). A cluster never wraps mid-cluster: wrap the whole cluster onto its own line. | — |
| Density at nesting depth | The cluster steps down one notch at nesting depth ≥ 1, matching CH-R5's `--mlv-tile-control-size` ramp (`tile.scss:330-332` steps a nested tile to `--mlv-height-xs`). Bind `[mlvDensity]` on the tile and **delete** the per-button `mlvDensity` so the buttons inherit — `mlv-tile` provides `MLV_DENSITY_CONTEXT` (`tile.ts:58`). | CH-R5 |

**Binding caveat — `mlvDensity` is value-selector-matched.** `MlvDensityDirective`'s selector is `[mlvDensity="tight"], [mlvDensity="compact"], …` (`density.ts:166-167`), so a property binding `[mlvDensity]="expr"` on a **plain element** matches nothing and silently does nothing. It works only on components that expose the directive through `hostDirectives` — `MlvButton` (`button.ts:48-52`) and `MlvTile` (`tile.ts:69`) both do. On any other element use a static attribute value inside an `@if`.

### The star / favourite case — target markup

The support-inbox star is exhibit B's opening complaint: a `--mlv-text-warning` glyph sitting on a filled circular button chip, i.e. a message colour used as a state colour on a surface that no other row control has. **AB-R7** answers it with a chromeless primitive — `button[mlvIconToggle]`, BEM block `.mlv-icon-toggle`, no background in any state, `tone` recolouring the pressed **glyph** only.

**`mlv-icon-toggle` lands in Task 15.5.** Write the markup below only after `libs/core/icon-toggle` exists and `@malva-ui/core/icon-toggle` resolves. Until then the star stays exactly as it is; do not half-migrate it.

```html
<!-- support-inbox.html:520-536 — replaces the mlvButton shape="circle" star.
     One-way [pressed] plus an explicit handler, matching how the enable
     switch is bound at website-builder-node.html:89-94: the ticket fixture
     stays the single source of truth and the toggle never writes its own
     model behind the route's back. -->
<button
  mlvIconToggle
  type="button"
  tone="warning"
  [pressed]="ticket.starred"
  [mlvTooltip]="ticket.starred ? 'Unstar' : 'Star'"
  aria-label="Star conversation"
  (pressedChange)="toggleStar()"
>
  <svg lucideStar [size]="16" aria-hidden="true" />
</button>
```

Landing it also **deletes** `support-inbox.scss:407-410` (`&__star-on`) — the component owns pressed styling. It does **not** touch `support-inbox.scss:339-342` (`&__row-star`): that is the read-only marker in the conversation list row, a bare glyph with no button around it, and its `--mlv-text-warning` + `fill: currentColor` pair is exactly the pressed appearance the toggle produces. The two must stay identical.

Because a `tone` colours a glyph and never a surface, a toned icon toggle is **not** an accent-carrying mark under AB-R1's binding definition (which lists solid `--mlv-background-*-1` fills, `--mlv-text-action` foregrounds, and saturated media). It costs nothing from the row's budget.

### Applicability

| Showcase | Per-row clusters | Verdict |
| --- | --- | --- |
| **website-builder** | **1 cluster, 4 members**, rendered once per tree node at every depth: `website-builder-node.html:88-109` (`mlvTileActions` — switch, settings) + `:112-154` (`mlvTileTrailingActions` — add, remove) | **Change.** (a) `:145` `shape="circle"` → `shape="square"`, so all four members share one silhouette — this is the cluster the exhibit was drawn from. (b) Delete `mlvDensity="compact"` at `:100, :119, :133, :147` and bind the density once on the tile at `:6` as `[mlvDensity]="level() > 1 ? 'tight' : 'compact'"` (`level` is `input.required<number>()`, `website-builder-node.ts:183`; roots are seeded `[level]="1"` at `website-builder.html:261`, so `level() > 1` is exactly "inside a `.mlv-tiles--nested`"). Variants are already all `transparent` — no change there. |
| **support-inbox** | **0 per-row clusters.** The list row's `mlvListItemActions` (`support-inbox.html:419-432`) holds two *markers* — a star glyph and an unread badge — and no buttons | Thread header (`:509-572`) and composer (`:706-727`) are once-per-view groups, so the density row does not reach them — but the **`shape` row does**, per the cardinality-independent clause above (and EX-B.1 layer 5 was measured on this very header). **Two changes:** `:565` overflow `shape="circle"` → `"square"` (it shares the cluster with the labelled `Assign…` and `Solve` buttons); star `:520-536` → `mlv-icon-toggle` once Task 15.5 lands. **No change** to the composer cluster: all-glyph, uniformly `circle`, gap already `var(--mlv-spacing-1)` (`support-inbox.scss:488-493`) — it satisfies the rule as written. |
| **data-operations** | **0.** Rows carry data only; account actions live in the once-per-view header cluster at `data-operations.html:121-140` | **No change.** |
| **settings-access** | **3 clusters.** Roster row `:1186-1199` (one `…`, `transparent`, `tight`) ✔ conforming — it is the in-repo match for CH-R5's Taiga reference. Invitation row `:1313-1339` (Resend / `mlv-copy-to-clipboard` / Revoke, all `transparent` `tight`) ✔ conforming. Session row `:1447-1464` and the drawer copy at `:2319-2335` (`Revoke`, `variant="secondary"`) | **One change:** the two session `Revoke` buttons → `variant="transparent"`, so every per-row action in this showcase shares one chrome (AB-R2 read across the view, and `secondary`'s `--mlv-text-action` label is an accent-carrying mark under AB-R1 where `transparent`'s `--mlv-text-secondary` is not). `mlv-copy-to-clipboard` is invisible-chrome by construction and is exempt from the `variant` clause. |

---

## Recipe C · Accent discipline — one primary per view surface

Resolves **EX-A.3**, **EX-A.4**, **EX-B.1**, **EX-C.2** at the composition layer. Enforces **AB-R1**, **AB-R3**, **AB-R4**, **AB-R5**, **AB-R8**.

### Two counters, not one

AB-R1's binding definitions are easy to conflate. Keep them apart:

- **Solid accent surface** — a fill from `--mlv-background-accent-1`, `-accent-2`, or `--mlv-background-{danger,success,warning,info}-1` (solid, **not** `-pale`). In button terms: `variant` `primary` / `accent` / `error` / `warning` / `info` (`button.scss:7-63`), a non-`muted` `mlv-badge` / `mlv-chip`, and a checked `mlv-switch` track (`switch.scss:144-146`). **Budget: one per view surface.**
- **Accent-carrying mark** — the full AB-R1 definition: the above, **plus** a `--mlv-text-action` / `-hover` foreground (which is what `variant="secondary"` paints on its label, `button.scss:21`), **plus** any avatar or media fill at sRGB saturation ≥ 0.45. **Budget: one per repeated unit.**

A `--mlv-background-selected` fill is `-pale` and is **exempt** from both — SF-R1 made selection its own token precisely so it stops competing with the accent budget. A `tone` on a glyph (Recipe B's icon toggle, `mlv-status-indicator`) is exempt from both.

**The boxed-track convention (owner follow-up #3).** Two components render a segmented choice as a pill inside a boxed track, and they now share one selected treatment: a `--mlv-background-neutral-1` track carrying a **raised** pill — `--mlv-background-raised` in light, lifted to `--mlv-palette-neutral-700` in dark, because the raised token resolves *below* the track there. `mlv-segmented` had it restored at the owner's request (`585622c5`; `segmented.scss:58-59` plus the dark overrides at `:164-169`), and `mlv-tab-group[appearance="boxed"]` was fixed to mirror the same mechanism (`5e8fa92b`; `tabs.scss:239-244` — its dark rule had been a dead `@at-root` selector that also re-declared the sinking token). Cite this as **the boxed-track convention**: a boxed segmented choice is achromatic in both themes, spends nothing from the accent budget, and is never a view's primary. It supersedes AB-R8 clause 2's `--mlv-background-selected` draft **for these two components only** — `mlv-button-toggle[pressed]` (worklist 4.19) and every other selected surface still read from SF-R1's tokens, as the post-implementation override table above records.

### The law

1. **One solid accent surface per view surface.** A *view surface* is the main content plane, and then **each overlay independently**: every `mlv-dialog`, every `mlv-drawer` / `mlv-page-end-pane` in drawer mode, every `mlv-menu`. A dialog footer's submit is that dialog's one accent and does not draw on the page's budget.
2. **An empty-state action is `variant="secondary"`** whenever more than one empty state can render in one viewport, or the view's single accent is already spent. Both hold in all four showcases, so **every** empty-state action here is `secondary`.
3. **Destructive is not accent.** `variant="error"` renders only as a **blocking confirm inside its own dialog**. A destructive trigger sitting on the page carries its meaning in the icon and the confirmation flow (AB-R3), and takes the chrome its position dictates: `transparent` when it belongs to a control cluster (Recipe B), `secondary` when it is a card-level action beside other labelled card actions.
4. **Semantic hue inside a repeated unit is a marker.** Prefer AB-R4 tier 1 — `<mlv-status-indicator [tone]="…" />` plus a neutral `--mlv-text-primary` label. Tier 2 (`mlv-badge muted` / `mlv-chip muted`) is permitted. Tier 3 (solid) is not, with the single exception AB-R4 names: a count badge on a navigation item.
5. **Structural metadata never takes a tone** (AB-R5 clause 2), and no semantic tone may apply to more than 50% of the first rendered page (AB-R5 clause 1).

### Audit checklist — run per showcase, per viewport, light and dark

1. Screenshot the first viewport. Count **solid accent surfaces** (definition above). Expected: **1** on the main plane. Open each dialog and drawer and count again: **≤ 1** each.
2. Count **accent-carrying marks inside one repeated unit** (one list row, one table row, one tile row). Expected: **≤ 1**. Remember `variant="secondary"` spends it.
3. `grep -n 'variant="error"\|variant="warning"\|variant="info"'` the template. Every hit must sit inside an `mlv-dialog-footer`.
4. `grep -n '<mlv-badge\|<mlv-chip'` the template. Every hit inside a repeated unit carries `muted`, or is a `mlv-status-indicator` + neutral label. Count the exceptions; there should be at most one, and it should be a nav count badge.
5. Find every `<button mlvButton>` with **no** `variant` and **no** `shape="square|circle"`. Those resolve `primary` (`button.ts:108-114`) — a silent solid accent. Each must be either the view surface's one accent or demoted.
6. Check the tone distribution of the first rendered page of every list and table against AB-R5 clause 1, and check that structural chips carry `tone="default"`.
7. Confirm no `mlv-avatar` takes `[color]` and every one takes `[name]` (AB-R6 — the D4 sweep cleared all 17 support-inbox entries and the docs list examples; this step is a regression guard, not new work).

### Per-showcase ledger

| Showcase | Solid accent surfaces now (main plane) | Target | Edits |
| --- | --- | --- | --- |
| **website-builder** | Dock `Save layout` (`website-builder.html:304`, no `variant` → `primary`) · 3 empty-state actions (`website-builder.html:242`; `website-builder-node.html:186`, `:251`) · one checked `mlv-switch` track per row (the row's own single mark) | **1** + one per-row switch | `:242`, `:186`, `:251` → `variant="secondary"`. At `website-builder-node.html:239-249` the sibling `Add row` is already `secondary`, so the pair becomes uniform and satisfies AB-R2. Dock `:304` **keeps** `primary`. Dialog submits `website-builder.html:450, 561, 1273` **keep** `primary` — each is its own overlay's one accent. Badges are already all `muted` with `tone="default"` on structure after the D4 sweep (`kindTone`, `website-builder-node.html:30`, `:49-58`) — **no change**. |
| | **Also:** `website-builder-node.scss:33` sets `--wb-rail: var(--mlv-background-accent-2)` on every container node — a solid accent fill on a repeated unit, alongside its checked switch. **Two marks per container row.** | 1 | Retone the kind rail to a neutral three-step ladder using existing tokens: container `--mlv-border-strong` (`:33`), row `--mlv-border-normal` (`:37`), block `--mlv-border-subtle` (`:41`). The kind is still carried by the badge and the icon; the rail was already documented as decorative at `:18-20`. |
| **support-inbox** | `Solve` (`:551`, `variant="primary"`) · composer `Send reply` (`:716`, `variant="primary"`) — **2 on one plane at md+** · per row: solid `tone="primary"` unread badge (`:428`) **and** solid `tone="danger"` `Urgent` badge (`:414`) — **2 per row** | **1** + one per-row mark | `:551` `Solve` → `variant="secondary"`. The view's accent is the composer `Send` (`:716`): it is state-gated by `[disabled]="!draft().trim()"`, so the resting viewport carries **zero** solid accent and the accent appears exactly when there is work to commit; `Solve` stays reachable in `threadMenu` (`:575-578`) and keeps `primary` in the below-lg details drawer footer (`:1274-1295`, button at `:1278`), which is its own overlay surface. `:414` `Urgent` → add `muted`, matching the two SLA badges beside it at `:406`, `:410`. `:428` unread count **keeps** its solid `tone="primary"` — AB-R4 tier 3's named exception, and it is then the row's single mark. `Save note` (`:742`) is the `@else` branch of the same composer and never co-renders with `:716` — **no change**. |
| **data-operations** | `Add account` (`data-operations.html:122`, no `variant` → `primary`) | **1** | **No change.** Already compliant: the `…` at `:126` sits inside the `<mlv-button-split>` opened at `:121`, which supplies `primary` to both halves (`button-split.ts:52`) — one logical primary action rendered as one contiguous accent surface, which is exactly what "one primary" means. The two dialog submits (`:72`, `:108`) are their own overlays' accents, the health column already renders `mlv-status-indicator` + neutral label (D4, `:238-246` with `.data-operations-showcase__health` at `data-operations.scss:39-44`), and the `At risk` run was already interleaved by the D4 sweep to satisfy worklist 4.8 (`data-operations.data.ts` — the first eight `ACCOUNTS` rows now read `At risk` `:60`, `Watch` `:71`, `Healthy` `:82`, `At risk` `:93`, `Watch` `:104`, `Healthy` `:115`, `At risk` `:126`, `Watch` `:137`, i.e. **3 `At risk` in 8**, inside 4.8's ≤ 3 target; `:71, 82, 104, 115, 137` are the lines the sweep rewrote). This showcase is the reference implementation for clauses 4 and 5 — do not touch it. |
| **settings-access** | Dock `Save changes` (`:2122`, no `variant` → `primary`) · **3 solid `variant="error"` buttons** in the danger grid (`:1879`, `:1899`, `:1920`) · one solid `variant="error"` `Delete` per API-key card (`:1846`) | **1** | The three danger-zone triggers `:1879`, `:1899`, `:1920` → `variant="secondary"`. All three open a dialog whose confirm already carries `variant="error"` (`:2664` Transfer, `:2748` Delete workspace, and `:2596` for the two-factor flow), which is where clause 3 puts the solid red. The per-key `Delete` at `:1846` → `variant="secondary"`, matching the `Rotate` beside it at `:1837` (AB-R2 — the key cards are a repeated unit). Dock `:2122` and `Try again` `:2111` are the two mutually exclusive branches of one dock slot and **keep** `primary`. Drawer `Stage changes` (`:2357`) and dialog submits (`:2468`, `:2532`) **keep** `primary` — own overlay surfaces. All badges are already `muted` — **no change**. |

**Counts after the recipe:** one solid accent surface on each of the four main planes; one accent-carrying mark per repeated unit; solid `error` only inside dialog footers.

---

# Token change list

Every `theme.scss` edit, both themes, with the resolved value. Nothing outside this table changes in `theme.scss`.

## Changed

| token | current (light) | current (dark) | new (light) | new (dark) | affected components |
| --- | --- | --- | --- | --- | --- |
| `--mlv-background-sunken` | `neutral-100` `#f5f5f5` | `neutral-950` `#0a0a0a` | **`neutral-200` `#e5e5e5`** | `#0a0a0a` (unchanged) | segmented track, form-control disabled fill, list `--inset` tray, page surfaces |
| `--mlv-background-neutral-1-hover` | `#dcdcdc` | `#333333` | **`#efefef`** — `color-mix(in srgb, var(--mlv-palette-neutral-100) 60%, var(--mlv-palette-neutral-200))` | `#333333` (unchanged) | button (`secondary`, `transparent`), list-item, sidebar, menu, data-table, tile, popover items |
| `--mlv-background-neutral-1-active` | `#cccccc` | `#404040` | **`#e5e5e5`** — `var(--mlv-palette-neutral-200)` | `#404040` (unchanged) | same as above; also every `aria-pressed` surface before SF-R1 lands |
| `--mlv-elevation-bg-1` | `var(--mlv-background-raised)` `#ffffff` | `#1e1e1e` | **`var(--mlv-background-base)` `#fafafa`** | `#1e1e1e` (unchanged) | `mlv-tile` (`tile.scss:38`), `mlv-tiles`, and `mlv-button[variant="elevated"]`'s **pressed** fill (`button.scss:56`) — the elevated button now darkens by 5 values on press instead of not moving at all |
| `--mlv-text-positive` | `success-700` `#15803d` | `success-400` `#4ade80` | **`success-800` `#166534`** | `#4ade80` (unchanged) | `mlv-message`, `mlv-alert`, `mlv-hint`, data-table status cells |
| `--mlv-text-warning` | `warning-700` `#b45309` | `warning-400` `#fbbf24` | **`warning-800` `#92400e`** | `#fbbf24` (unchanged) | `mlv-message`, `mlv-alert`; support-inbox star relocated to `mlv-icon-toggle[tone="warning"]` (AB-R7, worklist 5.33) rather than removed |
| `--mlv-text-disabled` | `neutral-300` `#d4d4d4` | `neutral-600` `#525252` | **`neutral-500` `#737373`** | **`neutral-500` `#737373`** | button, form controls, list-item, menu-item, tile |
| `--mlv-height-xs` | `2rem` (32px) | same | **`1.75rem` (28px)** | same | button (tight), form-control (tight), button-close, filter, smart-filter-bar, sidebar row, editor toolbar |
| `--mlv-height-s` | `2.5rem` (40px) | same | **`2.25rem` (36px)** | same | button (compact), form-control (compact), tile control, avatar `s`, data-table |
| `--mlv-radius-button` | `var(--mlv-radius-m)` 6px | same | **`var(--mlv-radius-l)` 8px** | same | button, button-toggle, button-group, button-split, segmented |
| `--mlv-radius-input` | `var(--mlv-radius-m)` 6px | same | **`var(--mlv-radius-l)` 8px** | same | form-control-wrapper and every control inside it |
| `--mlv-radius-tag` | `var(--mlv-radius-s)` 4px | same | **`var(--mlv-radius-full)`** | same | chip |
| `--mlv-radius-panel` | `var(--mlv-radius-xl)` 12px | same | **`var(--mlv-radius-l)` 8px** | same | popup, dropdown-panel, menu, autocomplete, pagination popover |
| `--mlv-popover-surface-radius` | `var(--mlv-radius-l)` 8px | same | **`var(--mlv-radius-panel)`** (same 8px, one source) | same | select, combobox, autocomplete, menu, breadcrumb overflow |
| `--mlv-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | same | **`var(--mlv-ease-default)`** (identical curve, one source) | same | tiles, editor, any `--mlv-ease-in-out-strong` neighbour |
| `--mlv-ease-spring` | declared **twice** (`:714-719`, `:744-749`) | same | **declared once** (`:744-749` retained) | same | list-item accent bar, tile drag feedback |

## Added

| token | light | dark | high-contrast | affected components |
| --- | --- | --- | --- | --- |
| `--mlv-background-selected` | `var(--mlv-background-accent-1-pale)` → `#eaeefa` | resolves via indirection → `#202433` | resolves via indirection → `#e0e0ff` | button (`aria-pressed`), button-toggle, segmented, tabs, list-item, sidebar, view-variant |
| `--mlv-background-selected-hover` | `var(--mlv-background-accent-1-pale-hover)` → `#dce2f6` | → `#262d46` | → `#c8c8ff` | same as above |
| `--mlv-text-on-selected` | `var(--mlv-text-action)` → `#2d409c` | → `#9fb7f2` | → `#0000ee` | same as above. **Not** the support-inbox star — that glyph moves to `mlv-icon-toggle tone="warning"` (AB-R7) and reads `--mlv-text-warning` instead; see SF-R1's owner gate note and worklist 5.33. **Owner override 2026-08-25:** light column is now `#3c55bb` (`primary-600`) — see "Post-implementation owner overrides" below |
| `--mlv-background-disabled` | `var(--mlv-palette-neutral-200)` → `#e5e5e5` | `color-mix(in srgb, var(--mlv-palette-neutral-800) 60%, var(--mlv-palette-neutral-900))` → `#202020` | `#d0d0d0` (explicit declaration required) | button, button-close, page-dock, form controls |
| `--mlv-icon-in-container-ratio` | `0.45` | `0.45` | `0.45` | button (icon-only), button-close, tile drag handle |

**Declaration placement.** `--mlv-background-selected`, `--mlv-background-selected-hover` and `--mlv-text-on-selected` are declared **once**, in the light `:root` block. Because each is a `var()` indirection onto a token the `dark-tokens` mixin and the high-contrast block already override, they resolve correctly in all three themes without being repeated. `--mlv-background-disabled` resolves a palette stop directly and therefore needs three declarations (worklist 5.3, 5.4, 5.5).

## Contrast evidence (all resolved through `libs/styles/src/lib/theme-contrast.mjs`)

| pairing | before | after |
| --- | ---: | ---: |
| `--mlv-text-action` on the light pressed neutral fill | 5.62 | **7.17** (owner override 2026-08-25: **5.19** at restored `primary-600` — still clears AA + margin) |
| `--mlv-text-secondary` on the light pressed neutral fill | ~4.9 | **6.20** |
| `--mlv-text-positive` on `--mlv-background-sunken` (light) | 3.98 | **5.66** |
| `--mlv-text-warning` on `--mlv-background-sunken` (light) | 3.99 | **5.63** |
| `--mlv-text-positive` on `--mlv-background-neutral-1-hover` (light) | 4.35 | **6.18** |
| `--mlv-text-on-selected` on `--mlv-background-selected` (light) | n/a | **7.77** (owner override 2026-08-25: **5.63** at restored `primary-600` — still clears AA + margin) |
| `--mlv-text-secondary` on `--mlv-background-raised` (light) — the new `transparent` button label, now also the destructive-glyph label per AB-R3 | n/a | **7.81** |
| disabled label: `--mlv-text-disabled` on `--mlv-background-disabled` (light) | **1.71** — white glyph on the `opacity: 0.4` composite `#bac5ed`, which reproduces the audit's measured rgb(185,196,237) | **3.76** |
| disabled label: `--mlv-text-disabled` on `--mlv-background-disabled` (dark) | **1.94** — `neutral-600` on `neutral-800` | **3.44** |
| `--mlv-border-focus` (non-text, 3:1 floor) on the new light `sunken` | n/a | **3.68** |

No pairing in the `theme-contrast.spec.mjs` guard regresses; four improve out of the failing band.

---

# Verification gates

Run in this order after each dimension sweep. Every one must pass before the next dimension starts.

| # | Command | Guards |
| ---: | --- | --- |
| V1 | `yarn nx run styles:generate-tokens` | Regenerates `libs/styles/tokens.md`. **Fails if `--mlv-icon-in-container-ratio` has no category** — worklist 3.5 must land first. |
| V2 | `yarn nx run styles:verify-tokens` | `libs/styles/tokens.md` is not stale. |
| V3 | **`yarn nx run core:build-styles`** | **Regenerates the published artefacts `libs/core/styles/malva-ui.css` and `libs/core/styles/tokens.md`.** Both are compiled copies of `libs/styles` and are therefore stale after *every* `theme.scss` edit in this document — and `styles:check-tokens` does not read them, so nothing else catches it. Consumers install the stale CSS. Run after V1/V2 and commit both outputs. |
| V4 | `yarn nx run styles:check-tokens` | No `var(--mlv-…)` name that exists nowhere. Catches a mistyped `--mlv-background-selected`. |
| V5 | `yarn nx run styles:check-padding-tokens` | No `--mlv-padding-*` pair used outside a whole `padding:` value. |
| V6 | `yarn nx run styles:test` | The WCAG contrast guard. Worklists 1.26, 1.27, 5.31, 5.32 update its expectations; it must be **green**, not skipped. |
| V7 | `yarn nx run-many -t lint` | Includes `styles:lint`, which depends on V5. |
| V8 | `yarn nx run-many -t test` | Component specs. `button.spec.ts` compiles `button.scss` through Sass and pins the `aria-pressed` selector's three declarations — worklist 5.10 changes two of them and adds a third, so that spec's expectations must be updated in the same commit. |
| V9 | `yarn nx run docs:check-doc-api` | Fails when a documented input/output is not in the extracted API. No `MlvButton` API change ships from this document — `tone` was rejected at the 2026-08-25 gate (see Open risk 2, resolved) — so this gate is a pass-through check here, not a specific per-commit obligation. |

## Documentation that must be updated in the same commits

| File | Because of |
| --- | --- |
| `libs/styles/CLAUDE.md` | Section 2/3/6/8/9 token tables; the `--mlv-radius-*` table; the disabled/selected token families |
| `libs/styles/tokens.md` | Generated — via V1, never hand-edited |
| `libs/core/styles/malva-ui.css` | **Generated — via V3.** A compiled copy of the whole theme; stale after every `theme.scss` edit and read by no gate. Must be in the same commit. |
| `libs/core/styles/tokens.md` | **Generated — via V3** (copied from `libs/styles/tokens.md`). Same staleness, same commit. |
| `libs/core/button/src/lib/button/button.spec.ts` | The `aria-pressed` declaration assertions (5.10) |
| `libs/core/button/CLAUDE.md` | the `--variant-transparent` label colour, now also the destructive-glyph treatment (4.1, AB-R3); disabled treatment (5.11); icon-only sizing (3.13) |
| `libs/core/list/CLAUDE.md` | Row hairline + padding recipe (1.20–1.23) |
| `libs/core/tile/CLAUDE.md` | `mlv-tiles--nested` (1.6, 1.7); control-size ramp (3.15–3.18) |
| `libs/core/chip/CLAUDE.md` | `rounded` becomes redundant (2.14) |
| `libs/core/page/CLAUDE.md` | Chrome remap formula (5.15, 5.16) |
| `libs/core/data-table/CLAUDE.md` | Row-height ramp (3.19) |
| `libs/core/form-utils/CLAUDE.md` | Validation-ring rule (5.26) |
| `.claude/rules/bem-scss.md` | Focus-ring Forms A/B (SF-R3); shadow-alias table (SL-R3); the `-active`-means-pointer-down law (SF-R1) |
| `docs/migrations/2026-08-visual-harmonization.md` (new) | The four token additions and ten token value changes. No `MlvButton` API change ships — `tone` was rejected at the 2026-08-25 gate. |

---

# Self-check

| Check | Result |
| --- | --- |
| No TBDs, no "decide later", no placeholder values | ✅ — every value is a concrete token name or a resolved hex |
| Every rule maps to ≥1 AUDIT finding, or is marked preventive | ✅ — 36 rules; 2 carry an explicit **preventive** clause (CH-R4's extension beyond button, AB-R5's tile-tone check); AB-R7 is the owner's 2026-08-25 gate addition, citing EX-B.1/EX-B.2 |
| Every worklist entry maps to a rule | ✅ — 27 + 22 + 24 + 21 + 32 + 19 = **145 entries**, each with a rule ID in its own column. Nine are deliberate **"no change / verify only"** rows (1.25, 3.10, 3.11, 3.12, 3.17, 3.20 in part, 4.5, 4.22, 5.21), recorded so a sweep does not re-derive a decision this document already made |
| Every token referenced exists in `theme.scss` or is an explicit addition row | ✅ — 5 additions listed; every other `--mlv-*` name in this document was set-diffed against the tokens declared in `libs/styles/src/lib/*.scss`, with only prose glob fragments (`--mlv-radius-*`) and one illustrative placeholder (`--mlv-x-duration`, MO-R2) remaining |
| Both themes covered for every changed/added token | ✅ — the Token change list has light and dark columns on every row; high-contrast is called out where an explicit declaration is required |
| Padding-pair semantics respected in every spacing rule | ✅ — every spacing value in this document is a `--mlv-spacing-*` single length (1.21, SL-R4, CH-R6). No `--mlv-padding-*` pair is used outside a whole `padding:` value, and none of the rules introduce one |
| Contrast verified, not assumed | ✅ — every colour change resolved through `theme-contrast.mjs`; 11 pairings tabulated; no guard regresses |
| Dimensions with no drift | None — all six dimensions carry findings and a non-empty worklist |
| §7 composition recipes add no rules and no worklist entries | ✅ — three un-numbered recipes (A / B / C), each citing only rules and exhibits already stated above. The 36-rule and 145-entry counts are unchanged. Every showcase edit a recipe authorizes is named with a `file:line` anchor as of `7fb4709c`, and all four showcases carry an explicit verdict — including three **No change** verdicts recorded so the showcase sweep does not re-derive them |

## Owner gate decisions (2026-08-25)

The owner reviewed this spec at the approval gate and ruled on five items, plus requested one addition. All six numbered Open Risks below are resolved by these rulings — each is annotated in place. Nothing in this document is still awaiting a decision.

| # | Item | Ruling | Resolves |
| --- | --- | --- | --- |
| 1 | Surface ladder (SL-R1 … SL-R6, Dimension 1 in full) | **ACCEPTED as specced.** Light gets one new rung (`--mlv-elevation-bg-1` → `--mlv-background-base` `#fafafa`) plus SL-R3's shadow discipline plus SL-R4's nesting rule. Dark's existing 5-rung fill ladder is untouched. | Open risks 4, 5, 6 |
| 2 | `--mlv-height-xs` 32px → 28px (CH-R1) | **ACCEPTED**, including the `sidebar.scss:169` rail retune 30px → 24px (worklist 3.23). The CH-R1 fallback (retune only `--mlv-height-s`) is not taken. | Open risk 1 |
| 3 | `MlvButton.tone` input (AB-R3) | **REJECTED** — no public API change. Per-row destructive glyphs (trash, etc.) render as plain neutral cluster controls per AB-R1; `variant="error"` stays reserved for a single blocking destructive CTA. AB-R3 is rewritten above; worklist 4.2/4.3 are deleted (4.5 becomes a "no change" row). | Open risk 2 |
| 4 | `--mlv-text-positive` / `--mlv-text-warning` 700 → 800 in light (SL-R1) | **ACCEPTED.** | Open risk 3 |
| 5 | Dialog corners 8px → 16px via `--mlv-radius-dialog` (RR-R1) | **ACCEPTED.** | — (flagged in RR-R1's prose as a visible geometry change; not carried as a numbered Open Risk) |

**Owner-requested addition (2026-08-25):** a new chromeless icon-toggle component, `mlv-icon-toggle` (`button[mlvIconToggle]`), replacing the star treatment in exhibit B. See **AB-R7 · Chromeless icon toggle**, added above between AB-R6 and the renumbered AB-R8.

### Post-implementation owner overrides (2026-08-25)

Worklist 1.1, 4.20 and SL-R1's `--mlv-text-action` rider (all part of the `c25f156a..cbf55b41` sweep) landed and were then reviewed against the live docs app. The owner reversed three specifics; everything else in the rulings above stands. **These rows outrank the rule text above wherever they conflict — a sweep re-reading a superseded rule must not re-apply it.**

| # | Item | Ruling | Resolves |
| --- | --- | --- | --- |
| 6 | `mlv-segmented`'s neutral/default selected pill (AB-R8, worklist 4.20) | **PARTIALLY REVERTED.** The landed convergence onto `--mlv-background-selected` / `--mlv-text-on-selected` read worse in the live pill than the raised-white/`--mlv-text-primary` treatment it replaced. Reverted for the `neutral` (default) tone only — `--mlv-segmented-pill-bg` / `-active-color` and the `'neutral'` `$tones` entry go back to `var(--mlv-background-raised)` / `var(--mlv-text-primary)`, and the dark `--tone-neutral` → `--mlv-palette-neutral-700` override (dropped as stale by AB-R8/I1) is restored, since the raised token no longer resolves its own dark-appropriate value. AB-R8's `selected`-token law is otherwise unchanged: `mlv-button-toggle[pressed]` (worklist 4.19) and every semantic `tone="…"` segmented pill still use the tokens that read from it (the pale tone map was never on `--mlv-background-selected` to begin with, so nothing there changes). SF-R1's `selected`-token law is likewise unaffected for every other surface (list rows, sidebar, view-variant list, button `aria-pressed`). |  |
| 8 | `--mlv-background-sunken` light value (SL-R1, worklist 1.1) | **REVERTED** (`7732fea9`). The specced `neutral-100` → `neutral-200` (`#f5f5f5` → `#e5e5e5`) deepening landed in `cbf55b41` and read too dark for static "recessed tray" zones (settings-access account/network sections); it also made `mlv-data-table` row hover — which borrowed this token — read as *pressed* rather than hovered. Restored to `neutral-100`, and row hover moved onto `--mlv-background-neutral-1-hover` (`#efefef`) in `f7153368` so nothing else depends on `sunken` being the ladder floor. **Consequences, all deliberate:** (a) the light resting ladder ships at 3 distinct values / spread 10, so SL-R1's "four distinct values" target is *not* met and SL-2/SL-3 are answered by SL-R2+SL-R3+SL-R4 alone; (b) SF-R5's "pressed floor === sunken floor" equality is gone — `-active` (`#e5e5e5`) is now one rung below `sunken` (`#f5f5f5`) and its literal "no state fill darker than the darkest resting surface" law no longer holds, though the 41 → 16 swing reduction that motivated it does; (c) worklist 1.1, 1.26 and 1.27 and 5.32 are **withdrawn** — `theme-contrast.spec.mjs` pins `#f5f5f5` and drops the two equality assertions (`:83-93`); (d) SL-R1's `-positive`/`-warning` 700 → 800 justification is moot, but the move ships anyway on owner gate item 4. |  |
| 7 | `--mlv-text-action` light value (SL-R1-adjacent rider, `theme.scss`) | **REVERTED.** A `primary-700` rider (`cbf55b41`) had landed ahead of this spec's approval; the owner asked for `primary-600` back. Verified against the ratios in SF-R5's already-landed pressed-fill retune (`--mlv-background-neutral-1-active` → `#e5e5e5`): `primary-600` clears AA with the required `+0.4` margin on every surface `--mlv-text-action` renders on, in both themes (light pressed-fill low point 5.19:1, was 7.17:1 at `primary-700`) — `styles:test`'s `theme-contrast.spec.mjs` recomputes and pins the new values. |  |


## Open risks the owner should weigh before approving

1. **`--mlv-height-xs` 32px → 28px has the widest blast radius of any change here** (10 consumers: tight-density buttons and form controls, filter chips, smart-filter-bar, sidebar rows, editor toolbar chrome, `button-close`). It clears WCAG 2.5.8 (24px floor) but is the one change most likely to need a visual walk-back. Worklists 3.21–3.23 make the executor report rather than silently accept a clipped label. **If this is too aggressive, the fallback is to change only `--mlv-height-s` (40 → 36), which fixes CH-3's stated defect at the cost of a new 4px step between `tight` and `compact`.**
   **Owner gate decision (2026-08-25): RESOLVED — ACCEPTED.** Ships at 28px, including the `sidebar.scss:169` rail retune 30px → 24px (worklist 3.23). The fallback described above is not taken.
2. **`MlvButton.tone` is a public API addition** (worklist 4.2), the only one in this spec. Everything else is CSS-level. If the owner would rather keep the API frozen, AB-R3 can be delivered showcase-side with a local class, but the library-level gap that produced EX-A.4 stays open.
   **Owner gate decision (2026-08-25): RESOLVED — REJECTED.** No public API change ships. AB-R3 is rewritten so per-row destructive glyphs render as plain neutral cluster controls per AB-R1 — the library-level gap is closed without a new component surface. Worklist 4.2/4.3 deleted.
3. **`--mlv-text-positive` / `--mlv-text-warning` moving 700 → 800 in light is load-bearing for SL-R1.** Without it, `--mlv-background-sunken` cannot go below `#f5f5f5` and the light resting ladder stays at 3 distinct values. The two colours become noticeably darker (`#15803d` → `#166534`, `#b45309` → `#92400e`) — calmer, which is the intent, but it is a visible brand shift on every success/warning message.
   **Owner gate decision (2026-08-25): RESOLVED — ACCEPTED.** 700 → 800 ships in light as specced.
4. **SL-R2 leaves elevation rungs 2–5 at `#ffffff` in light.** This is deliberate — white is the ceiling of the light range and the reference solves the same problem with shadow — but it means SL-1's headline ("all five are `#ffffff`") is answered by *one* new rung plus SL-R3's shadow discipline plus SL-R4's nesting rule, not by five distinct fills. If the owner wants five distinct light fills, the page canvas has to drop below `#f5f5f5`, which collides with the neutral interactive rest fill and with the message-text contrast floor. **Flagging explicitly rather than deciding it silently.**
   **Owner gate decision (2026-08-25): RESOLVED — ACCEPTED as specced.** The one-new-rung-plus-shadow-plus-nesting answer stands; rungs 2–5 remain `#ffffff` in light by design.
5. **`--mlv-background-neutral-1` still equals `--mlv-background-subtle`** (both `#f5f5f5`). SL-R1 declares this an intentional alias rather than drift. If the owner reads it as drift, the fix is to raise `neutral-1` to `neutral-50` (`#fafafa`), which makes a `secondary` button nearly invisible on the page canvas — not recommended.
   **Owner gate decision (2026-08-25): RESOLVED — ACCEPTED as specced.** The alias is intentional, not drift; `--mlv-background-neutral-1` stays at `neutral-100` / `#f5f5f5`.
6. **Sweep 1.20–1.23 changes the default look of every `mlv-list`** (hairlines instead of gaps, zero row radius). It is the correct reading of EX-C, but it is the most visible single change in this spec and touches every list, menu, select panel and combobox panel in the library.
   **Owner gate decision (2026-08-25): RESOLVED — ACCEPTED as specced.** Sweep 1.20–1.23 ships as written.
