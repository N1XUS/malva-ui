# Library: layout

> **Keep this file up to date.** Always update this file and keep it aligned
> with the current implementation whenever you make any change to this library.

## Overview

`@malva-ui/core/layout` is a **deprecation shim and nothing else**. It exports
no component and no directive; its entire content is

```ts
export * from '@malva-ui/cdk/theme';
```

so `MlvThemeService`, `provideDefaultTheme`, `MLV_THEME`, `MLV_THEME_KEY`,
`MlvTheme`, `MlvThemeMode`, `isMlvThemeMode`, `defaultTheme` and
`defaultThemeKey` keep resolving from the old path for one minor. The
identities are the same objects, so mixing import paths in one application is
safe.

`@deprecated since 0.2.0 — removed in 1.0.` The entry point disappears in the
next major; move imports to `@malva-ui/cdk/theme`.

## What was removed

`MlvLayout` (`mlv-layout`), `MlvLayoutTop` (`[mlvLayoutTop]`) and
`MlvLayoutSide` (`[mlvLayoutSide]`) are **deleted**, with no alias. Use
`mlv-page-shell` from `@malva-ui/core/page`:

```html
<!-- before -->
<mlv-layout>
  <nav *mlvLayoutSide>…</nav>
  <main>…</main>
</mlv-layout>

<!-- after -->
<mlv-page-shell sizing="viewport">
  <nav mlvPageSidebar>…</nav>
  <main mlvPage>…</main>
</mlv-page-shell>
```

Two differences worth naming:

- The slots are **attribute directives on the author's own element**
  (`mlvPageSidebar`, `mlvPageTopbar`, `mlvPageEndSidebar`), not `ng-template`
  structural markers. Unwrap the template and move the marker onto the element
  inside it.
- `mlv-layout` painted a canvas padding its `plain` mode then zeroed again.
  `mlv-page-shell` has no such mode; the page's own `padding` input owns the
  inset, and `sizing` decides whether the shell fills the viewport, its parent,
  or its content.
- **`sizing` has no neutral value, so porting means choosing one.** `mlv-layout`
  declared neither a block size nor an overflow: it was content-sized and the
  document scrolled it. Only `sizing="content"` reproduces that. `viewport` (in
  the snippet above, because a full application shell usually wants it) and the
  `parent` default both bound the shell and make `.mlv-page-shell__content`
  `overflow: hidden`, so a ported layout whose body owns no scroller of its own
  is clipped at the fold with nothing able to scroll it — silently, since
  nothing throws and the markup is unchanged. `apps/docs`' own shell shipped
  that way for one commit.

The shell's template was already a strict superset of the layout's, both
remaining in-repo consumers wanted the shell, and the layout's default was
wrong often enough to ship an undocumented escape hatch — see
`docs/migrations/2026-09-page-rebuild.md`.

## Why the theme service moved

It imports nothing from any layout component, already writes on the document
root precisely so a route rendering no layout still themes correctly, and
several consumers render no layout at all. Most decisively it is **bootstrap
API written by a schematic** — `ng add @malva-ui/core` injects
`provideDefaultTheme` into the consumer's app config — which implied the layout
component was part of the install contract. It was not.

Full documentation: [libs-theme.md](libs-theme.md).
