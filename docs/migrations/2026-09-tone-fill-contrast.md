# 2026-09 — Tone fills, the accent focus ring and avatar initials meet WCAG AA (#302)

- **Visual change, not breaking — patch.** No exported symbol, selector, input,
  output, token name, BEM class or i18n key added, renamed or removed. Every
  change is a new value for an existing `--mlv-*` token, or a component reading
  a different existing token (VERSIONING.md: "visual change within an existing
  token"). Pixels still move in light and dark — review visual baselines.
- Floors: 4.5:1 text (WCAG 1.4.3, hover + press included), 3:1 icons / dots /
  fills / focus rings (1.4.11). No large-text exemption used; colour never
  varies with density in any component below.
- Measured with `libs/styles/src/lib/theme-contrast.mjs` against `theme.scss`.
  Guarded by `yarn nx run styles:test` (`theme-contrast.spec.mjs` + new
  `tone-contrast.spec.mjs`) and `yarn nx test core-avatar`.

## 1. Tokens (`@malva-ui/styles`)

| Token                                                   | Light before → after                                    | Dark before → after                                |
| ------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| `--mlv-background-success-1` / `-warning-1` / `-info-1` | 600 → **700** step; hover / active re-based on 700      | 600 → **500** step; hover / active re-based on 500 |
| `--mlv-background-danger-1`                             | unchanged (600)                                         | 600 → **500**; hover / active re-based on 500      |
| `--mlv-background-accent-2`                             | `accent-500` → **`accent-700`**                         | unchanged (`accent-500`)                           |
| `--mlv-background-accent-2-hover`                       | `accent-500` 82% **white** → `accent-700` 85% **black** | unchanged                                          |
| `--mlv-background-accent-2-active`                      | 75% black, re-based on `accent-700`                     | unchanged                                          |
| `--mlv-background-accent-1-hover`                       | 82% **white** → 85% **black**                           | 80% white → 85% toward **`primary-700`**           |
| `--mlv-background-accent-1-active`                      | unchanged                                               | 65% white → 75% toward **`primary-700`**           |
| `--mlv-text-on-{success,warning,info,danger}`           | unchanged (`#ffffff`)                                   | `#ffffff` → **`var(--mlv-palette-neutral-950)`**   |
| `--mlv-text-primary-on-accent-2`                        | unchanged (`#ffffff`)                                   | `#ffffff` → **`var(--mlv-palette-neutral-950)`**   |

- `-pale` / `-pale-hover` tints unchanged (still the 500 steps; accent-2's stay on the coral).
- `--mlv-text-primary-on-accent-1` stays `#ffffff` in every theme — it is also the
  neutral tooltip foreground. So dark accent-1 hover / press deepen toward
  `primary-700` rather than lightening: white 5.04 / 5.37:1; hover fill ≥ 3:1 on
  base / subtle / raised (radio dot, switch track, stepper ring). Press reads
  2.82:1 on `--mlv-background-subtle` — transient, not a 1.4.11 state.
- High contrast (`[data-theme='high-contrast']`) untouched — own fills, white
  labels, still wins over dark by source order.
- Nested `[mlvTheme]` islands unaffected: each changed token is declared in the
  light selector list and in the `dark-tokens` mixin.
- Why dark labels go near-black:
  - A white-label fill on dark must sit at luminance 0.158–0.183 — ≤ 0.183 for
    4.5:1 under white, ≥ 0.158 for 3:1 against the `#262626` loader track.
  - Info has no palette step in that window: 600 → 4.10:1 under white, 700 →
    2.55:1 on the track.
  - The 500 steps under `neutral-950`: 5.39–9.22:1 at rest, and hover / press
    lighten away from the label.

## 2. Components (`@malva-ui/core`)

- **`mlv-badge`, `mlv-chip`** — `tone="success"` / `"info"` read
  `--mlv-background-{success,info}-1` + `--mlv-text-on-{success,info}` instead of
  `--mlv-palette-{success,info}-500` + `--mlv-text-inverse` (light 2.28 / 2.77 →
  5.02 / 5.93:1; HC now reaches its own fills). Chip close glyph rest opacity
  0.7 → **0.85** (danger 2.88 → 3.7:1); hover still 1.
- **`button[mlvButton]`**
  - `variant="info"` reads the `--mlv-background-info-1` / `-hover` / `-active`
    triple instead of raw `info-500` plus its own `color-mix()` (2.77 → 5.93:1).
  - `variant="warning"` hover / press read `-warning-1-hover` / `-active` instead
    of mixing their own (dark hover was 2.51:1 once the token moved).
  - `variant="accent"` focus ring → shared `--mlv-border-focus` (was the
    accent-2 hover fill: 2.15:1 on the light page → 4.39:1).
- **`mlv-loader`, `mlv-progress`** — `success` / `info` fills read the semantic
  `-1` fills (light track 2.09 / 2.54 → 4.60 / 5.44:1).
- **`mlv-timeline-item`** — node foreground per tone: `--mlv-text-primary` on the
  default node, `--mlv-text-on-*` on tone nodes, carried by an internal custom
  property (not an override point, not public API). Every node painted white
  before — 1.26:1 on the grey default node.
- **`mlv-avatar`**
  - No `color` → nothing bound inline; theme pair `--mlv-background-neutral-1` /
    `--mlv-text-primary` applies (16.44 / 15.13 / 17.14:1). Was inline
    `var(--mlv-text-secondary)` under 0.8-opacity `neutral-800` initials — 1.72:1.
  - `color` set → visual also binds `color: var(--mlv-palette-neutral-800)`;
    initials opaque, inherit it. Worst `mlvColorFromText` tint 4.29 → 6.2:1.
  - Projected content under a tint reads that neutral too — it inherited
    `--mlv-text-primary`, i.e. white on a pale tint in dark (1.17:1).
- **`mlv-tokenizer`** — "+N more" caption reads `--mlv-text-secondary` (was
  literal `#666`: 2.2–3.1:1 in dark). Placeholder's `#999` fallback removed.
- **`mlv-tree`** — the selected-row rule reads `--mlv-background-selected` /
  `-selected-hover` / `--mlv-text-on-selected` (SF-R1) instead of
  `--mlv-text-action` on `--mlv-background-accent-2`, which the new accent-2
  would have taken from 2.40 to 1.33:1 (1.02:1 hovered) in light. Now 5.48 / 4.94
  light, 7.68 / 6.78 dark, 7.28 / 5.89 HC (rest / hover). **Nothing renders
  differently:** the rule targets `.mlv-tree__item__content--selected`, which the
  template never stamps (it marks `.mlv-tree__item--selected`), so a selected row
  still paints `--mlv-text-primary` with no fill. Retargeting it — the visible
  selected look — is #304.
- **`mlv-tab-group`** — overflow "More" trigger reads `--mlv-text-secondary`
  like `.mlv-tab-item` (was raw `--mlv-palette-neutral-400`: 2.42:1 light).
- Repainted through the tokens, no code change: `mlv-tooltip` tones,
  `mlv-swipe-actions` tone blocks, `mlv-status-indicator`, `mlv-calendar-sheet`
  selection, scheduler / list / notification tone bars.

## 3. Consumer action

- **Nothing**, for Malva components.
- **Own surfaces** pairing `--mlv-text-on-{success,warning,info,danger}` or
  `--mlv-text-primary-on-accent-2` with anything other than the matching
  `--mlv-background-*` fill: in dark those labels are now near-black. Pair with
  the fill, or pin `#ffffff` locally. Same for the `@malva-ui/tailwind`
  utilities that map them (`text-mlv-on-accent`, `text-mlv-on-{danger,success,warning,info}`):
  pair each with its `bg-mlv-*` fill.
- **`mlv-avatar` `color` that is not a pale tint** (e.g. `#5770cb`, 3.3:1): fails
  AA under the fixed dark foreground; nothing detects it. Use `mlvColorFromText`
  or a tint at ~75–85% lightness.
- **Visual baselines**: status fills one step darker in light, one step brighter
  with dark labels in dark; `accent-2` deeper burnt-orange in light; primary
  hover darkens instead of lightening.

## 4. Not changed here

- High-contrast loader / progress track `#999` under fills (2.07–2.78:1) and the
  missing HC elevation tokens (tokenizer caption 1.38:1 on `elevation-bg-3` in
  dark + HC) — theme-scope work, #303.
- `mlv-tree` selected fill actually rendering (see §2) — #304, with table /
  list / sidebar selection.
- `mlv-scrollbar` thumb contrast — accepted by the owner.
