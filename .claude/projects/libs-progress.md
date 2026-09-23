---
name: libs-progress
description: Documentation for the @malva-ui/core/progress library — determinate linear and circular progress bar
type: project
---

# Library: progress

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The Progress library (`@malva-ui/core/progress`) provides a standalone determinate progress indicator component — distinct from `mlv-loader` (which handles indeterminate/loading states).

**Features:**

- Linear `bar` and circular `circle` shape variants
- Determinate only — requires a `value` (0–100)
- Size variants: `s`, `m` (default), `l`
- Semantic tone variants: `default`, `success`, `warning`, `danger`, `info`
- Optional percentage display centered inside circle or beside bar
- Label slot via `ng-content`, rendered below the track / ring in **both** shapes, naming the progressbar while it has text (see _Label slot and accessible name_)
- SVG `stroke-dashoffset` animation for the circle variant
- Fully accessible: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and exactly one of `aria-labelledby` / `aria-label`

## Public API

Exported from `libs/core/progress/src/index.ts`:

| Export             | Kind      | Description                                                                          |
| ------------------ | --------- | ------------------------------------------------------------------------------------ |
| `MlvProgress`      | Component | `mlv-progress` — the main component                                                  |
| `MlvProgressShape` | Type      | `'bar' \| 'circle'`                                                                  |
| `MlvProgressSize`  | Type      | `'s' \| 'm' \| 'l'`                                                                  |
| `MlvProgressTone`  | Type      | `MlvTone \| 'default'` (`'info' \| 'success' \| 'warning' \| 'danger' \| 'default'`) |

## Component: `MlvProgress` (`mlv-progress`)

### Inputs

| Input            | Type                  | Default      | Description                                                                                                             |
| ---------------- | --------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `value`          | `number`              | — (required) | Progress value, clamped to 0–100                                                                                        |
| `shape`          | `MlvProgressShape`    | `'bar'`      | Linear bar or circular ring                                                                                             |
| `size`           | `MlvProgressSize`     | `'m'`        | Size variant                                                                                                            |
| `tone`           | `MlvProgressTone`     | `'default'`  | Semantic tone                                                                                                           |
| `showPercentage` | `BooleanInput`        | `false`      | Whether to show the numeric percentage                                                                                  |
| `ariaLabel`      | `string \| undefined` | `undefined`  | Explicit accessible name (`aria-label`); wins over the projected label. Unset + no label → i18n `progress` ("Progress") |

### Host

- `role="progressbar"`
- `[attr.aria-valuenow]="_clampedValue()"`
- `[attr.aria-valuemin]="0"`, `[attr.aria-valuemax]="100"`
- `[attr.aria-labelledby]="_labelledBy()"` — the label wrapper's id, or `null`
- `[attr.aria-label]="_resolvedAriaLabel()"` — `null` whenever `aria-labelledby` is set
- BEM classes: `mlv-progress`, `mlv-progress--bar/circle`, `mlv-progress--s/m/l`, `mlv-progress--default/success/warning/danger/info`

### Label slot and accessible name (#258)

- **One slot.** The template authors a single `<ng-content />`, in `.mlv-progress__label`, **outside** the `shape` `@if` — last child of the host in both shapes. Never add a second bare `<ng-content />` inside a branch: the compiler emits one `'*'` slot per `<ng-content>` and `matchingProjectionSlotIndex` gives unclaimed nodes to the **last** `'*'`, so every earlier copy stays empty for the instance's life. Before #258 each branch had one, so the default `bar` rendered nothing projected while `circle` did (a named slot fails the other way — first wins; `mlv-input` #256). Outside the `@if`, a `shape` flip never destroys the slot, so projected nodes are neither orphaned nor re-created.
- **Naming precedence** — exactly one attribute is ever emitted:

| `ariaLabel` | Label has text | Host carries                               |
| ----------- | -------------- | ------------------------------------------ |
| set         | any            | `aria-label="{ariaLabel}"`                 |
| unset       | yes            | `aria-labelledby="mlv-progress-label-<n>"` |
| unset       | no             | `aria-label="{i18n progress}"`             |

- Why `ariaLabel` wins — **not** accessible-name order: `progressbar` is Name From: author only, so name-from-content never applies, and accname would rank `aria-labelledby` **above** `aria-label` if both were emitted (they never are). The rule is the library's own for a label generated from DOM text: `mlv-drawer` (`_resolvedAriaLabelledBy`) and `MlvDialogContainer` drop their header-title `aria-labelledby` for an explicit `ariaLabel` the same way. It is also the only way to give a name **richer** than the visible text — docs example 6 (`ariaLabel="CPU usage"` around "CPU"). WCAG 2.5.3 then asks the consumer's `ariaLabel` to contain the visible text; a dev warning for one that does not is #501. Form controls go the other way (`mlv-radio-group`, the pickers: own `label` beats `ariaLabel`) — a field label is an authored label element; the progress slot is promoted content.
- **Label wrapper stays `aria-hidden`** and still names the host: a hidden node **directly referenced** by `aria-labelledby` contributes its text (accname step 2A), and axe `aria-progressbar-name` accepts it. Hiding it is what keeps the text from being exposed twice — measured in Chrome 153 (CDP `getFullAXTree`, #258 review), a visible wrapper puts a separate non-ignored `StaticText` under the progressbar in both naming paths (the label text again beside the `aria-labelledby` name; a stray "CPU" beside `aria-label="CPU usage"`); "Children Presentational" does not suppress it. A focusable projected node fails axe `nested-interactive` either way — do not project one. The percentage readout stays `aria-hidden` (the value is `aria-valuenow`).
- **"Has text" detection** — `_syncLabel()` reads `textContent.trim()` of the wrapper into a private signal: whitespace-only projection and `@if` comment anchors count as empty. No `MutationObserver`; two reads, each pinned by an ablation spec:
  - `ngAfterViewChecked` — runs on the server, so the SSR payload already carries `aria-labelledby` (`ssr-smoke.spec.ts`); on the client it settles inside the pass that changed the text.
  - `afterEveryRender` — catches a projected OnPush child re-rendering its own text, which refreshes only that child and never runs this view's hooks.
  - Not counted: non-text content (an `<img alt>`, an icon with its own `aria-label`) — the name stays `aria-label`. Text changed by direct DOM writes outside change detection is picked up on the next render.
  - Counted, deliberately: text inside an `aria-hidden` descendant (`<span aria-hidden="true">{{ v }}%</span>`) — the hidden, directly referenced wrapper passes its hidden descendants' text into the name, so the host is named "40%", not left unnamed (spec + the axe sweep's `hidden-text` host).

## SCSS / BEM

Block: `mlv-progress`

| Class                                   | Description                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `.mlv-progress`                         | Host element                                                                                                            |
| `.mlv-progress__track`                  | Bar: outer track div                                                                                                    |
| `.mlv-progress__fill`                   | Bar: inner fill div, `width` driven by `value()`                                                                        |
| `.mlv-progress__svg-wrapper`            | Circle: sized box holding the SVG + percentage                                                                          |
| `.mlv-progress__svg`                    | Circle: SVG element                                                                                                     |
| `.mlv-progress__circle-track`           | Circle: background stroke                                                                                               |
| `.mlv-progress__circle-fill`            | Circle: animated foreground stroke                                                                                      |
| `.mlv-progress__percentage`             | Percentage text (inside circle or beside bar)                                                                           |
| `.mlv-progress__label`                  | The one `ng-content` label slot, both shapes; `aria-hidden`, `id` = the `aria-labelledby` target; collapsed by `:empty` |
| `--bar` modifier                        | Linear bar layout                                                                                                       |
| `--circle` modifier                     | Circular SVG ring                                                                                                       |
| `--s/m/l`                               | Size variants                                                                                                           |
| `--default/success/warning/danger/info` | Tone color variants                                                                                                     |

Tone colors map to the semantic solid fills `--mlv-background-{success,warning,danger,info}-1` (`default` → `--mlv-background-accent-1`) — never a `--mlv-palette-*` step, so the high-contrast theme reaches them. The bar track and the circle track paint `--mlv-background-subtle`, and each tone clears 3:1 against it in light, dark, high contrast and high contrast over dark (`styles:test` → `tone-contrast.spec.mjs`, #302 / #303). The track used to be `--mlv-border-subtle`: same colour in light / dark, but `#999` in high contrast, which put `success` / `warning` / `danger` at 2.54 / 2.78 / 2.07:1. It is not `--mlv-background-neutral-1`, which `mlv-page-shell` remaps inside its chrome slots (1.08:1 fill vs track on a brand chrome); the spec fails if any component stylesheet redeclares a token the fill-vs-track score reads.

## Dependencies

- `@malva-ui/styles` — all `--mlv-*` CSS custom properties

## Notes

- **Not** a replacement for `mlv-loader` — use `mlv-loader` for indeterminate loading spinners/bars.
- The circle SVG uses `stroke-dasharray` = circumference, `stroke-dashoffset` = circumference × (1 - value/100).
- Percentage display for circle is centered as an absolutely-positioned span over the SVG.
