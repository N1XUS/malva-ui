# 2026-08 — Visual harmonization program

Applies to `@malva-ui/styles` and nearly every `@malva-ui/core` component —
button, button-toggle, button-close, segmented, tabs, list/list-item, card,
chip, dialog, form-control-wrapper (every text-style control built on it),
dropdown-panel, sidebar, page-shell, tile, and more.

**No exported symbol was renamed or removed.** One new component shipped
(`MlvIconToggle`, `@malva-ui/core/icon-toggle`). Everything else in this
program is a **visual restyle** driven by `@malva-ui/styles` theme-token
changes and the components being wired onto those tokens — most consumers
need no code changes, only a visual diff review. Sections below call out the
handful of spots that need an explicit override to keep the old look.

## 1. Token changes (`@malva-ui/styles`)

5 tokens added, 16 changed (`libs/styles/src/lib/theme.scss`). Verify current
values directly against `theme.scss` / `libs/styles/tokens.md` before relying
on any number below — some of these round-tripped mid-program to a different
value than they landed on first.

### Added

| Token                             | Light                                       | Dark                                               | Purpose                                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mlv-background-selected`       | `var(--mlv-background-accent-1-pale)`       | theme-aware                                        | Persistent selection fill. Selection is its own state — it never borrows the pressed `-active` fill (**SF-R1**). `-active` on a selected control still means "pointer is down right now", nothing else.                                              |
| `--mlv-background-selected-hover` | `var(--mlv-background-accent-1-pale-hover)` | theme-aware                                        | Hover step on a selected surface.                                                                                                                                                                                                                    |
| `--mlv-text-on-selected`          | `var(--mlv-text-action)`                    | `var(--mlv-text-action)`                           | Foreground on a `--mlv-background-selected` surface.                                                                                                                                                                                                 |
| `--mlv-background-disabled`       | `var(--mlv-palette-neutral-200)`            | `color-mix(in srgb, neutral-800 60%, neutral-900)` | Disabled-control fill. Disabled is now a **declared surface**, not an opacity multiply (see §3).                                                                                                                                                     |
| `--mlv-icon-in-container-ratio`   | `0.45`                                      | `0.45`                                             | **CH-R4.** The fraction of a shaped container's height a lone glyph sizes to (icon-only button, `mlv-button-close`, tile drag handle). A label-adjacent glyph still sizes in `em` off the text via `--mlv-icon-font-size`, unaffected by this ratio. |

### Changed

| Token                                               | Old                                                    | New                                                                                                                                                                             | Note                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mlv-radius-button`                               | `--mlv-radius-m` (6px)                                 | `--mlv-radius-l` (8px)                                                                                                                                                          | See §2.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `--mlv-radius-input`                                | `--mlv-radius-m` (6px)                                 | `--mlv-radius-l` (8px)                                                                                                                                                          | See §2.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `--mlv-radius-tag`                                  | `--mlv-radius-s` (4px)                                 | `--mlv-radius-full` (pill)                                                                                                                                                      | `mlv-chip` goes from a slightly-rounded rectangle to a full pill.                                                                                                                                                                                                                                                                                                                                                       |
| `--mlv-radius-panel`                                | `--mlv-radius-xl` (12px)                               | `--mlv-radius-l` (8px)                                                                                                                                                          | `mlv-dropdown-panel` / `--mlv-popover-surface-radius` (select, combobox, menu, autocomplete, pagination, breadcrumb overflow) shrink one step, reconciling onto the same 8px `mlv-popup` already used.                                                                                                                                                                                                                  |
| `--mlv-height-xs`                                   | `2rem` (32px)                                          | `1.75rem` (28px)                                                                                                                                                                | Tight-density control height.                                                                                                                                                                                                                                                                                                                                                                                           |
| `--mlv-height-s`                                    | `2.5rem` (40px)                                        | `2.25rem` (36px)                                                                                                                                                                | Compact-density control height.                                                                                                                                                                                                                                                                                                                                                                                         |
| `--mlv-background-sunken` (light)                   | `neutral-100`                                          | `neutral-200`, then **restored to `neutral-100`**                                                                                                                               | Net **unchanged** — an intermediate commit darkened it one stop, the owner asked for it back the same day because it read too dark for static "recessed tray" zones and made data-table row hover look pressed. Row hover was moved off this token entirely (see §7); `sunken` itself still backs the static expanded-row / striped-row / recessed-tray look.                                                           |
| `--mlv-background-neutral-1-hover` (light)          | `color-mix(neutral-100 70%, neutral-400)` (≈`#dcdcdc`) | `color-mix(neutral-100 60%, neutral-200)` (≈`#efefef`)                                                                                                                          | Lighter, gentler hover step.                                                                                                                                                                                                                                                                                                                                                                                            |
| `--mlv-background-neutral-1-active` (light)         | `color-mix(neutral-100 50%, neutral-400)` (≈`#cccccc`) | flat `var(--mlv-palette-neutral-200)` (`#e5e5e5`)                                                                                                                               | Lighter pressed step — this is what let `--mlv-text-action` stay at `primary-600` (see next row) instead of moving darker.                                                                                                                                                                                                                                                                                              |
| `--mlv-background-neutral-1-hover`/`-active` (dark) | mix 75%/60% toward white                               | mix 94%/88% toward white                                                                                                                                                        | The old percentages were tuned by eye and blew past AA: a 25%/40% white mix jumped luminance 5.5x/10.8x in sRGB near black, dropping even plain white text to 4.13:1. The new steps land exactly on `--mlv-elevation-bg-3`/`-4`.                                                                                                                                                                                        |
| `--mlv-text-disabled` (light)                       | `neutral-300`                                          | `neutral-500`                                                                                                                                                                   | Needed for legible text on the new declared `--mlv-background-disabled` surface (§3) instead of an opacity multiply.                                                                                                                                                                                                                                                                                                    |
| `--mlv-text-disabled` (dark)                        | `neutral-600`                                          | `neutral-500`                                                                                                                                                                   | Same.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `--mlv-text-action` (light)                         | `primary-600`                                          | briefly `primary-700`, **restored to `primary-600`**                                                                                                                            | Net **unchanged**. The `primary-700` rider measured `primary-600` at 4.07:1 against the _old_ `#cccccc` pressed fill and moved it darker; once the `neutral-1-active` fix above landed (`#e5e5e5`), `primary-600` cleared AA with margin again (6.00:1 rest / 5.19:1 pressed) and the owner asked for it back. `primary-600` is the correct, final value — do not read the intermediate `primary-700` state as current. |
| `--mlv-text-action` (dark)                          | `primary-400`                                          | `primary-300` softened 15% toward white                                                                                                                                         | `primary-400` fell to 4.45:1 on the dark rest fill (under the 4.5:1 AA floor); `primary-300` clears it, worst case 5.19:1 pressed. `--mlv-border-focus` deliberately stays on `primary-400` (a non-text part, 3:1 floor) to keep the brand hue on the focus ring.                                                                                                                                                       |
| `--mlv-text-positive` (light)                       | `success-700`                                          | `success-800`                                                                                                                                                                   | Contrast headroom. Dark (`success-400`) is unchanged.                                                                                                                                                                                                                                                                                                                                                                   |
| `--mlv-text-warning` (light)                        | `warning-700`                                          | `warning-800`                                                                                                                                                                   | Contrast headroom. Dark (`warning-400`) is unchanged.                                                                                                                                                                                                                                                                                                                                                                   |
| `--mlv-elevation-bg-1..5` (light)                   | all resolved `--mlv-background-raised`                 | rung 1 (`flush`) now resolves `--mlv-background-base`; rungs 2–5 (card/dialog/drawer, popup/toast/form-control, drawer/side-overlay, switch-thumb) stay at the `raised` ceiling | Each rung now has a declared role instead of a uniform value; depth for 2–5 comes from the shadow alias, not a distinct fill.                                                                                                                                                                                                                                                                                           |
| `--mlv-ease-in-out`                                 | own `cubic-bezier(0.4, 0, 0.2, 1)`                     | `var(--mlv-ease-default)`                                                                                                                                                       | Dedup — identical resolved curve, one source. No visible effect. `--mlv-ease-spring` was similarly deduplicated (a leftover duplicate declaration removed); the token and its value are unchanged.                                                                                                                                                                                                                      |
| `--mlv-popover-surface-radius`                      | direct `var(--mlv-radius-l)`                           | `var(--mlv-radius-panel)`                                                                                                                                                       | Reference-chain cleanup only — both resolve 8px, no visible effect on its own (the effect of `--mlv-radius-panel` itself changing is the `--mlv-radius-panel` row above).                                                                                                                                                                                                                                               |

## 2. Component radius roles fixed per density (RR-R1/RR-R2)

Before this program, `mlv-button` and `mlv-form-control-wrapper` (and
therefore every text-style control built on it) scaled their border-radius
**per density** instead of using the shared role token:

| Density               | Old button/input radius   |
| --------------------- | ------------------------- |
| tight                 | `--mlv-radius-s` (4px)    |
| compact               | `--mlv-radius-m` (6px)    |
| comfortable (default) | `--mlv-radius-l` (8px)    |
| spacious              | `--mlv-radius-xl` (12px)  |
| airy                  | `--mlv-radius-2xl` (16px) |

Every density now uses the single `--mlv-radius-button` / `--mlv-radius-input`
role token (both `--mlv-radius-l`, 8px) regardless of density. A tight or
compact button/input is visibly rounder than before; a spacious or airy one
is visibly squarer. `mlv-card` similarly used to scale its radius per `size`
(`s`→`xl`/12px, `m`→`2xl`/16px, `l`→`3xl`/24px) and now uses one fixed
`--mlv-radius-card` (`xl`, 12px) at every size.

`mlv-dialog`'s surface radius (at the `md+` breakpoint) was hardcoded to
`--mlv-radius-l` (8px) and now resolves `--mlv-radius-dialog` (`--mlv-radius-2xl`,
16px) — dialog corners are visibly rounder.

### Restoring the old per-density/per-size radius

Set the CSS custom property back on your own selector — it is a normal
cascade override, unlayered styles beat `mlv.tokens`:

```scss
.my-app mlv-button.mlv--tight {
  --mlv-btn-radius: var(--mlv-radius-s);
}
```

## 3. Disabled is a declared surface, not an opacity multiply (SF-R4)

Disabled controls across the library used `opacity: var(--mlv-disabled-opacity)`
(0.4) over their normal colored state. On a filled/accent surface this could
produce near-invisible text (as low as ~1.9:1 contrast — the button variant
had white text over a pale-accent composite). Disabled now resolves the
declared `--mlv-background-disabled` fill with legible `--mlv-text-disabled`
ink instead. `transparent`/`outlined` button variants keep a transparent
disabled background (only the label recolors).

**Consequence for custom styling:** any consumer override that assumed
`opacity` was the disabled mechanism (e.g. `mlv-button[disabled] { opacity: .5 }`
layered on top) now competes with an explicit background/color pair instead
of a multiply — review any such override.

## 4. Disabled-beats-pressed cascade fix (button, button-toggle, segmented)

A disabled+pressed control (time-picker AM/PM, calendar month/year cell,
`mlv-button-toggle`, `[aria-pressed]` on a plain button) could previously
render as **enabled-and-selected**: `.mlv-button--disabled` was a
single-class selector `(0,1,0)` while `[aria-pressed='true']` is
class+attribute `(0,2,0)`, so the pressed rule always won regardless of
source order. `.mlv-button--disabled` is now emitted as a doubled class
(`.mlv-button.mlv-button--disabled`, `(0,2,0)`) positioned **after** the
pressed rule in source, so disabled now deterministically wins. If your own
overrides target `.mlv-button--disabled` with a single class selector, they
may now lose a specificity contest to `[aria-pressed]` that they used to win
by accident — target `.mlv-button.mlv-button--disabled` (or your own
disabled selector at matching specificity) instead.

`mlv-button-toggle` needed a further fix: its own `--pressed` rule and
`button.scss`'s doubled-class disabled rule are both `(0,2,0)` but live in
different component stylesheets, so which one won depended on Angular's
per-component `<style>` injection order, not source position. A disabled
button-toggle now carries an explicit `(0,3,0)` reset scoped to its own inner
button so the disabled fill always wins regardless of injection order.

## 5. Transparent/outlined button: neutral glyph (AB-R1)

`mlv-button[variant="transparent"]` no longer resolves `--mlv-text-action`.
A bare/icon-only glyph is neutral chrome, not an accent mark:

| State             | Old                              | New                                 |
| ----------------- | -------------------------------- | ----------------------------------- |
| Rest              | `--mlv-text-action` (accent)     | `--mlv-text-secondary`              |
| Hover             | accent, darker                   | `--mlv-text-primary`                |
| Hover background  | `--mlv-background-accent-1-pale` | `--mlv-background-neutral-1-hover`  |
| Active background | —                                | `--mlv-background-neutral-1-active` |

`variant="outlined"` is **unaffected** — it keeps its accent label
(`--mlv-text-action`) and border; it is documented as a bordered call to
action, not a routine per-row glyph, and AB-R1 only reclassifies
`transparent`.

Rationale: every un-annotated icon action (configure, add, remove, reorder,
expand) previously rendered in the brand accent color, so a row of per-row
transparent-variant actions spent the page's accent budget on routine chrome
instead of the one action that actually deserves emphasis.

### Restoring the old accent glyph

Use `variant="outlined"`, or override the button's local color variable on
your own selector:

```html
<button mlvButton variant="transparent" class="keep-accent" aria-label="Add">
  <svg lucidePlus />
</button>
```

```scss
.keep-accent {
  --mlv-btn-text-color: var(--mlv-text-action);
}
```

### Not affected

- `mlv-button-close` — sets its own transparent-variant treatment and was
  already neutral.
- `mlv-icon-toggle` (new, see §9) — was designed neutral-at-rest from the
  start, not migrated.
- Any button with an explicit non-`transparent` `variant`.

## 6. Selected state is its own token everywhere (SF-R1)

Persistent selection (a pressed toggle, a selected list row, an active
sidebar item, an `aria-current` nav link, a selected view-variant) used to
paint the same `-active` fill as a momentary press. It now resolves the new
`--mlv-background-selected` / `-hover` / `--mlv-text-on-selected` token pair
everywhere — button `[aria-pressed]`, `mlv-list-item`, `mlv-sidebar` item/group,
`mlv-view-variant-list`, `mlv-filter` (`aria-selected`), `mlv-sidebar-workspace`
(`aria-current`), and `mlv-calendar`'s range-preview. Visually this mostly
resolves to the **same pixels** as before (`--mlv-background-selected`
defaults to the pale accent, the same value these surfaces already used) —
the change is architectural (one shared token instead of each surface
hand-rolling the same pair), not a new look, **except**:

- `mlv-button-toggle` and `mlv-segmented`'s **non-default** tones converge
  their pressed/selected pill onto `--mlv-background-selected` instead of a
  filled accent block (AB-R8) — a pressed toggle or a `neutral`-tone
  segmented item briefly rendered a solid accent fill; the pale token pair
  replaces it. **`mlv-segmented`'s default (`neutral`) tone was reverted**
  after this landed — see §8.

## 7. List default restyle: hairlines, no per-row card, radius 0 (SL-R5)

`mlv-list[variant="plain"]` (the default) changed from spaced rows (each row
had breathing room via a container `gap`) to a hairline-separated, edge-to-edge
row list, matching the reference "airy list" pattern:

- The list container's `gap` is now `0` — spacing moved **inside** the row
  (`mlv-list-item`'s own padding), not between rows.
- A single `border-top: var(--mlv-stroke-width) solid var(--mlv-border-subtle)`
  is painted by the **container**, between consecutive `mlv-list-item`
  siblings — never by the row itself, and never doubled with `variant="inset"`
  (which keeps its own inset divider).
- Every row's own corner radius is now `0` — a row inside a hairline list has
  no corners of its own; the container clips. Selection fill still paints
  edge-to-edge.
- A row has **no background at rest** (`transparent`) — a fill only appears
  on hover, selection, or keyboard focus.

`variant="inset"` (the iOS Settings-style grouped card look) is **unaffected** —
it keeps its own sunken card, inset dividers, and rounded corners.

Also unrelated but in the same sweep: `mlv-data-table` row hover moved off
`--mlv-background-sunken` onto `--mlv-background-neutral-1-hover` — hovering a
row previously read as pressed (same darkness as the active/pressed step);
it now reads as a gentle hover.

## 8. Segmented / tabs: raised-pill treatment, including a dark-mode lift

`mlv-segmented`'s default tone (`'neutral'`) and `mlv-tab-item`'s boxed
`appearance="boxed"` indicator both use a **raised white pill sliding on a
sunken/neutral track** — `--mlv-background-raised` background,
`--mlv-shadow-raised`/`--mlv-shadow-1`, sliding via `--mlv-ease-in-out-strong`.
This is the owner-approved final look for the default/neutral case (an
intermediate program state briefly converged it onto the plain
`--mlv-background-selected` pale-accent pill per §6/AB-R8; that was reverted
for `neutral`/default specifically — semantic tones on `mlv-segmented`
(`accent`/`info`/`success`/`warning`/`danger`) still use their pale pill,
unaffected).

**Dark mode:** `--mlv-background-raised` resolves darker than the boxed
track's neutral background in dark mode (`#1e1e1e` vs `#262626`), which
would sink the pill below the track instead of lifting it above it. Both
components gained/fixed a `[mlvTheme='dark']` override that repaints the
pill one step lighter, `--mlv-palette-neutral-700`, so it visibly lifts in
dark mode the same way it does in light. (`mlv-tabs`' dark override had
existed but was dead — a malformed `@at-root` selector that never matched —
so this is a genuine dark-mode visual fix, not just a refactor.)

## 9. Motion tokenization + reduced-motion coverage

Component stylesheets across the library were swept to consume the shared
`--mlv-duration-*` / `--mlv-ease-*` tokens instead of literal
`transition-duration`/timing-function values, and every animated BEM block
that lacked one gained a `@include mixins.reduced-motion($block)` fallback
(`@media (prefers-reduced-motion: reduce)`, defined in
`libs/styles/src/lib/mixins.scss`). Reduced-motion coverage across the
library is now 100%. No token values changed in this sweep (see the
`--mlv-ease-in-out` dedup in §1, which is unrelated) — this is purely
components adopting the existing shared tokens and gaining the fallback.

## 10. New component: `mlv-icon-toggle`

`@malva-ui/core/icon-toggle` — a chromeless, glyph-only WAI-ARIA toggle
button, `button[mlvIconToggle]` (AB-R7). Wraps exactly one projected Lucide
`<svg>` and expresses `pressed` purely through the glyph: an outlined icon at
rest, a "tiny fill" on hover, and a full `fill: currentColor` when pressed —
**no background in any state**. An optional `tone` (`MlvTone`) recolors only
the pressed glyph to a matching semantic text token (e.g. a favorite star).
Built to replace ad hoc "tinted circle behind a glyph" treatments; a design
that needs a filled/tinted toggle affordance should reach for
`mlv-button-toggle` instead.

```html
<button mlvIconToggle type="button" [(pressed)]="bookmarked" aria-label="Bookmark">
  <svg lucideBookmark [size]="16" aria-hidden="true" />
</button>
```

See `libs/core/icon-toggle/CLAUDE.md` for the full API (`pressed` model,
`tone`, `disabled`, density support via `mlvDensity`).

## Not affected / no API removals

No exported class, type, interface, input, output, or public method was
renamed or removed anywhere in this program — confirmed by diffing every
`index.ts` barrel across the range; the only barrel changes are additive
(`libs/core/icon-toggle/src/index.ts`, plus the `icon-toggle` re-export added
to `libs/core/src/index.ts`). A draft `tone` input on `MlvButton` (to recolor
per-row destructive glyphs without promoting them to a filled CTA) was
considered and **rejected** at the owner review gate — it never shipped, so
there is nothing to migrate away from.
