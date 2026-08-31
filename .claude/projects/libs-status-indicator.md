# Library: status-indicator

> **Keep this file up to date.** Update this file whenever you change any component, directive, public API, template, styling, or dependency wiring in this library.

## Overview

`@malva-ui/core/status-indicator` provides a small circular **status dot**
(`mlv-status-indicator`) for conveying presence, health, or state (online,
busy, error, live, …). It renders a `0.25rem` (4px) coloured dot using the same
semantic tone vocabulary as `mlv-badge` / `mlv-chip`, with an optional
infinite **ripple pulse**.

- **Leaf project (Nx):** `core-status-indicator` at `libs/core/status-indicator`
- **Secondary entry point:** `@malva-ui/core/status-indicator` (also re-exported from the grouped `@malva-ui/core` barrel)
- **Package tag:** `scope:ui`

## Public API

Exported from `libs/core/status-indicator/src/index.ts`:

| Symbol                   | Kind      | Selector               | Description                                                    |
| ------------------------ | --------- | ---------------------- | -------------------------------------------------------------- |
| `MlvStatusIndicator`     | Component | `mlv-status-indicator` | The coloured status dot with optional pulse.                   |
| `MlvStatusIndicatorTone` | Type      | —                      | `MlvTone \| 'default' \| 'primary' \| 'secondary' \| 'accent'` |

## Component

### `MlvStatusIndicator` — `mlv-status-indicator`

- **Change detection:** `OnPush` · **Encapsulation:** `None`
- **Template:** empty (`template: ''`). The host element **is** the dot; the
  ripple is drawn by a decorative `::after` pseudo-element, so no child DOM is
  needed.

#### Inputs

| Input       | Type                     | Default     | Description                                                                                                       |
| ----------- | ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `tone`      | `MlvStatusIndicatorTone` | `'default'` | Semantic tone → solid fill colour token. Same vocabulary as `MlvBadgeTone` / `MlvChipTone`.                       |
| `pulse`     | `boolean` (coerced)      | `false`     | Enables the infinite expanding-ripple animation. Supports attribute syntax `<mlv-status-indicator pulse>`.        |
| `size`      | `number`                 | `4`         | Dot diameter in **px**; converted to `rem` internally (`4` → `0.25rem`) via `--mlv-status-indicator-size`.        |
| `ariaLabel` | `string`                 | `''`        | Optional accessible name. When set → `role="img"` + `aria-label`; when empty → decorative (`aria-hidden="true"`). |

#### Host bindings

```ts
host: {
  class: 'mlv-status-indicator',
  '[class]': '"mlv-status-indicator--tone-" + tone()',
  '[class.mlv-status-indicator--pulse]': 'pulse()',
  '[style.--mlv-status-indicator-size]': '_sizeVar()',
  '[attr.role]': 'ariaLabel() ? "img" : null',
  '[attr.aria-label]': 'ariaLabel() || null',
  '[attr.aria-hidden]': 'ariaLabel() ? null : "true"',
}
```

## Accessibility

Per `.claude/rules/accessibility.md`, a bare coloured dot has no intrinsic
accessible name and — in the common case — sits next to a text label that
already conveys the status. The default is therefore **decorative**:
`aria-hidden="true"`, no `role`, no name, so screen readers ignore it and read
only the adjacent text.

When the colour/pulse is the _sole_ carrier of meaning, set `ariaLabel`. This
exposes the dot as `role="img"` with the given `aria-label` — the canonical
pattern for giving an otherwise-empty graphic an accessible name. `role="img"`
(rather than `role="status"`) is deliberate: `role="status"` is an `aria-live`
region that announces on every change, which would be noisy for a persistent
indicator; `img` provides a stable name without live announcements.

## Styling

- BEM block `.mlv-status-indicator`; the host is the dot. Tone modifiers
  `--tone-{default|primary|secondary|accent|success|info|warning|danger}` set the
  `--mlv-status-indicator-color` scoped variable; the `--pulse` modifier enables
  the `::after` ripple.
- All colours come from `--mlv-*` design tokens in
  `libs/styles/src/lib/theme.scss`; sizes/radius are rem-based / token-based. The
  dynamic `size` input feeds `--mlv-status-indicator-size` as a `rem` value.
- `@keyframes mlv-status-indicator-ripple` scales the pseudo-element `1 → 3`
  while fading `0.6 → 0` over `2s`. `prefers-reduced-motion: reduce` removes the
  ripple entirely (static dot).

## Dependencies

- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@malva-ui/cdk/utils` — shared `MlvTone` union (type-only import)
- `@malva-ui/styles` — design tokens (`--mlv-*`)

## Tests

`status-indicator.spec.ts` (10 specs): creation; block class + default tone;
tone modifier reflection; all eight tones; no pulse by default; pulse class when
enabled; bare-attribute pulse coercion; decorative default (`aria-hidden`, no
role/name); labeled mode (`role="img"` + `aria-label`, no `aria-hidden`); dot
size default `0.25rem` and px→rem conversion of the `size` input.
