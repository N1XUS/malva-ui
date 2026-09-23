---

# Library: cdk/floating-container

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you change this library's API, layout, accessibility, styling, tests, or packaging.

## Overview

`@malva-ui/cdk/floating-container` provides `MlvFloatingContainer`
(`[mlvFloatingContainer]`) — a container for sticky floating footers. The host
sticks to the bottom edge of its nearest scroll container while a
gradient-masked backdrop fades the content scrolling beneath it, so projected
controls appear to float over the page without a hard separator line.

## Public API

| Export                 | Kind      | Selector                 |
| ---------------------- | --------- | ------------------------ |
| `MlvFloatingContainer` | Component | `[mlvFloatingContainer]` |

| Input                                                  | Type     | Default | Description                                                                                     |
| ------------------------------------------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------- |
| `background` (attribute value: `mlvFloatingContainer`) | `string` | `''`    | Optional CSS background for the fading backdrop; empty falls back to `--mlv-background-raised`. |

## Behaviour

- Attribute-selector component: it enhances the consumer's own
  footer/landmark element (`<footer mlvFloatingContainer>`), no wrapper.
- `position: sticky; inset-block-end: 0`, `z-index: 1`,
  `padding-block-end: max(1rem, env(safe-area-inset-bottom))` for notched
  devices.
- Grid layout with an optional leading hint line: a `:first-child` that is not
  the only child renders in its own row above the main content row.
- The `::before` backdrop spans slightly wider than the host and applies
  `mask-image: linear-gradient(180deg, transparent, black 2.5rem)`.

## Shared SCSS recipe — `floating-container.mixins.scss`

`MlvFloatingContainer` is a **component**, so it cannot be applied as a
`hostDirective`. Surfaces that want the same treatment without becoming a
floating container pull the recipe in from
`libs/cdk/floating-container/src/lib/floating-container.mixins.scss` — the
single definition of it. `floating-container.scss` itself is one of the
consumers, so the mixins can never drift from the component.

| Mixin                                  | Signature                    | Emits                                                                                                                |
| -------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `backdrop($background, $inset, $fade)` | `$inset: 0`, `$fade: 2.5rem` | `&::before` at `z-index: -1` with the given fill and `mask-image: linear-gradient(180deg, transparent, black $fade)` |
| `safe-area-block-end($min)`            | —                            | `padding-block-end: max($min, env(safe-area-inset-bottom))`                                                          |

The host **must** establish a stacking context (`position: sticky` with a
`z-index`, or `isolation: isolate`), or the `z-index: -1` backdrop paints
behind the surrounding content instead of over it.

Consumers (SCSS `@use` by relative path — TypeScript path aliases do not work
in SCSS, and the mixins are inlined at compile time, so no runtime dependency
on this package is created):

- `libs/cdk/floating-container/src/lib/floating-container.scss`
- `libs/core/page/src/lib/page-dock/page-dock.scss`
  (`mlv-page-dock[appearance="floating"]`)

## Testing

- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run cdk-floating-container:test`
- `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run cdk-floating-container:lint`
