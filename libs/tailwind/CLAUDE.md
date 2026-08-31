# Tailwind package

The @malva-ui/tailwind package is a CSS-only, Tailwind CSS v4-only adapter.
It maps the runtime custom properties from
libs/styles/src/lib/theme.scss through one @theme inline block in theme.css.

## Boundaries

- Keep the package optional; @malva-ui/core must render without Tailwind.
- Do not duplicate literal design-token values in theme.css.
- Export only namespaced mlv- theme keys and only stable public tokens.
- Do not expose --mlv-padding-* pair values as Tailwind spacing tokens.
- Keep schematic-owned content between the stable
  malva-ui:tailwind:start and malva-ui:tailwind:end markers.

## Commands

~~~sh
yarn nx test tailwind --skipNxCache
yarn nx lint tailwind --skipNxCache
yarn nx build tailwind --skipNxCache
~~~

The build is a package staging task, not an Angular compilation task. It emits
dist/libs/tailwind with theme.css, README.md, and the ng-add schematic.

