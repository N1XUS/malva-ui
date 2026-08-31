# @malva-ui/tailwind

## Purpose

Optional Tailwind CSS v4 theme adapter for Malva UI applications. It exposes
Malva runtime colors, spacing, radii, shadows, font families, weights, sizes,
and line heights through namespaced CSS-first Tailwind variables.

## Package

- Source: libs/tailwind
- Published name: @malva-ui/tailwind
- Theme entrypoint: @malva-ui/tailwind/theme.css
- Installer: ng add @malva-ui/tailwind
- Build target: yarn nx build tailwind
- Test target: yarn nx test tailwind
- No Angular runtime or TypeScript entrypoint

## Implementation notes

theme.css must reference the canonical Malva variables from
libs/styles/src/lib/theme.scss through @theme inline; it must not copy
literal palette or typography values. The spacing namespace may use only the
single-value --mlv-spacing-* scale, never the vertical/horizontal
--mlv-padding-* pairs.

The schematic updates application styles, dependencies, and PostCSS config
idempotently. It owns only regions marked with
malva-ui:tailwind:start / malva-ui:tailwind:end and preserves unrelated
consumer content.

