# Library: cdk/theme

> **Keep this file up to date.** Always update this file whenever you change the
> theme service, its tokens, its provider factory, or the storage contract.

## Overview

`@malva-ui/cdk/theme` is a **headless** entry point — no components, no
directives, no stylesheet. It owns one thing: the application's theme, and the
`mlvTheme` attribute on the document element that every `--mlv-*` token map in
`@malva-ui/styles` keys off.

It lives in the CDK family for the same reason `@malva-ui/core/date` exists: it
is a contract with no component. It was carved out of `@malva-ui/core/layout`
when `mlv-layout` was deleted — nothing in it ever referenced the layout, it
already wrote on the document root precisely so a route rendering no layout
still themes correctly, and it is **bootstrap API written by a schematic**
(`ng add @malva-ui/core` injects `provideDefaultTheme` into the consumer's app
config), which meant the layout component looked like part of the install
contract when it never was.

## Public API

| Export                | Kind     | Notes                                             |
| --------------------- | -------- | ------------------------------------------------- |
| `MlvThemeService`     | Service  | `providedIn: 'root'`. Mode, resolved theme, write |
| `provideDefaultTheme` | Function | Configuration **and** the eager initializer       |
| `MlvTheme`            | Type     | `'light' \| 'dark'` — the resolved theme          |
| `MlvThemeMode`        | Type     | `'auto' \| 'light' \| 'dark'` — the preference    |
| `isMlvThemeMode`      | Function | Runtime guard for persisted / external values     |
| `MLV_THEME`           | Token    | Default theme-mode injection token                |
| `MLV_THEME_KEY`       | Token    | Storage key injection token                       |
| `defaultTheme`        | Const    | `'light'`                                         |
| `defaultThemeKey`     | Const    | `'mlv-theme'`                                     |

`@malva-ui/core/layout` re-exports every one of these unchanged for one minor
(`@deprecated since 0.2.0 — removed in 1.0`). Identities are the same objects,
so mixing the two import paths in one application is safe.

## `provideDefaultTheme` starts the service

```ts
bootstrapApplication(AppComponent, {
  providers: [provideDefaultTheme('auto', 'my-app-theme')],
});
```

The provider supplies `MLV_THEME` and `MLV_THEME_KEY` **and** an
`provideEnvironmentInitializer` that injects `MlvThemeService`. That third
provider is the fix for a real defect: the service is the only thing that
writes the `mlvTheme` attribute, so an application that registered the
configuration and never happened to inject the service got no theme at all,
while its bootstrap looked correct. `theme.service.spec.ts` pins it with a case
that injects nothing and asserts the attribute — ablate the initializer and it
fails.

## Root theme attribute

The service writes `mlvTheme="light|dark"` to `document.documentElement` from a
constructor `effect`, browser-only.

- `theme.scss` keys its dark token map off a plain `[mlvTheme='dark']`
  attribute selector, so nothing changes colour until that attribute exists
  above the content.
- A scoped `mlvTheme` attribute further down the tree still wins locally — it
  is a plain attribute selector and custom properties inherit, so the nearest
  matching ancestor decides. That is how a permanently-dark rail inside an
  otherwise light page works.
- Server rendering never touches `documentElement`.

## Storage behaviour

1. `localStorage` first.
2. Falls back to `sessionStorage` (private browsing, quota exceeded).
3. Restored values are validated with `isMlvThemeMode`.
4. Stored as JSON; a legacy bare string (`dark`) is still accepted, and a
   corrupt value degrades to the configured default instead of throwing.

The key and the encoding are unchanged from the `@malva-ui/core/layout` era, so
a consumer that moves import paths keeps every user's saved choice.

## System dark mode

`'auto'` resolves against `(prefers-color-scheme: dark)` and follows live system
changes. Manual `'light'` / `'dark'` ignore system changes. During server
rendering `'auto'` resolves deterministically to `'light'` without reading
`window.matchMedia` at all.

## Dependencies

- `@angular/core`, `@angular/common`
- `rxjs` — the media-query listener
