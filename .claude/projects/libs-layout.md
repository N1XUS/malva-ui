---
# Library: layout

The layout writes the active theme through Angular's injected `DOCUMENT` only
in a browser, so construction is safe during server rendering.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Layout library (`@malva-ui/core/layout`) provides a responsive application
shell component with optional header and sidebar regions. It manages automatic,
light, and dark theme modes, persists the selected mode, and exposes both the
selected mode and resolved light/dark theme through `MlvThemeService`.

## Public API

Exported from `libs/core/layout/src/index.ts`:

| Export                | Kind      | Description                                       |
| --------------------- | --------- | ------------------------------------------------- |
| `MlvLayout`           | Component | App layout shell — `mlv-layout`                   |
| `MlvLayoutTop`        | Directive | Header template slot — `[mlvLayoutTop]`           |
| `MlvLayoutSide`       | Directive | Sidebar template slot — `[mlvLayoutSide]`         |
| `MlvThemeService`     | Service   | Selected mode, resolved theme, and persistence    |
| `MlvThemeMode`        | Type      | `'auto' \| 'light' \| 'dark'` selected mode       |
| `MlvTheme`            | Type      | `'light' \| 'dark'` resolved theme                |
| `isMlvThemeMode`      | Function  | Runtime guard for persisted or external values    |
| `MLV_THEME`           | Token     | Default theme-mode injection token                |
| `MLV_THEME_KEY`       | Token     | Storage key injection token                       |
| `defaultTheme`        | Const     | `'light'`                                         |
| `defaultThemeKey`     | Const     | `'mlv-theme'`                                     |
| `provideDefaultTheme` | Function  | Theme-mode and storage-key provider factory       |

---

## Components

### `MlvLayout`

**File:** `libs/core/layout/src/lib/layout/layout.ts`
**Template:** `libs/core/layout/src/lib/layout/layout.html`
**Styles:** `libs/core/layout/src/lib/layout/layout.scss`

- **Selector:** `mlv-layout`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Inputs / Outputs

None — managed via content directives.

#### Computed Signals

- `theme: computed()` — current theme from `MlvThemeService`

#### Host Bindings

```ts
host: {
  'class': 'mlv-layout',
  '[attr.mlvTheme]': 'theme()',
}
```

The host binding scopes the theme to this subtree. Publishing the theme on the
**document element** is `MlvThemeService`'s job, not the layout's — see below.
`mlv-layout` used to own that write, which meant an application (or a single
route) that renders no layout got a theme switcher that flipped a signal nobody
read.

#### Content Children

| Name      | Directive       | Description                        |
| --------- | --------------- | ---------------------------------- |
| `topRef`  | `MlvLayoutTop`  | Renders into `.mlv-layout__header` |
| `sideRef` | `MlvLayoutSide` | Renders into `.mlv-layout__side`   |

#### Template Structure

```html
@if (topRef()) {
<header class="mlv-layout__header">
  <ng-container [ngTemplateOutlet]="topRef()!.templateRef" />
</header>
}
<div class="mlv-layout__container">
  @if (sideRef()) {
  <aside class="mlv-layout__side">
    <ng-container [ngTemplateOutlet]="sideRef()!.templateRef" />
  </aside>
  }
  <ng-content />
</div>
```

---

## Directives

### `MlvLayoutTop`

**Selector:** `[mlvLayoutTop]` | **File:** `libs/core/layout/src/lib/layout/directives/MlvLayoutTop.ts`

Marks template for header. Provides `templateRef: TemplateRef`.

### `MlvLayoutSide`

**Selector:** `[mlvLayoutSide]` | **File:** `libs/core/layout/src/lib/layout/directives/MlvLayoutSide.ts`

Marks template for sidebar. Provides `templateRef: TemplateRef`.

---

## Services

### `MlvThemeService`

**File:** `libs/core/layout/src/lib/layout/services/theme.service.ts` | **Provided in:** `root`

#### Signals

| Signal         | Type                          | Description                             |
| -------------- | ----------------------------- | --------------------------------------- |
| `themeMode`    | `signal<MlvThemeMode>`        | Selected and persisted theme mode       |
| `currentTheme` | `signal<MlvTheme>`            | Resolved light/dark theme for consumers |
| `_prefersDark` | `signal<boolean>` (protected) | Live system dark-mode preference        |

#### Methods

- `setTheme(mode: MlvThemeMode): void` — set a selected mode, persist it, and
  synchronize the resolved theme

#### Root Theme Attribute

The service writes the resolved theme to `document.documentElement` as
`mlvTheme="light|dark"` from a constructor `effect`, browser-only. `theme.scss`
keys its dark token map off a plain `[mlvTheme='dark']` attribute selector, so
nothing changes colour until that attribute exists above the content.

- It lives here, not on `mlv-layout`, so the theme applies regardless of which
  components are on screen. Any route that renders no layout still themes.
- The service is `providedIn: 'root'`, so the write happens as soon as anything
  injects it — which any theme control already does.
- A scoped `mlvTheme` attribute further down the tree still wins locally: it is
  a plain attribute selector and custom properties inherit, so the nearest
  matching ancestor decides. That is how a permanently-dark rail inside an
  otherwise light page works.
- Server rendering never touches `documentElement`.

#### Storage Behavior

1. Attempts `localStorage` first
2. Falls back to `sessionStorage` (private browsing, quota exceeded)
3. Validates restored values with `isMlvThemeMode`
4. Stores/retrieves the selected mode as JSON

#### System Dark Mode

`auto` resolves against `(prefers-color-scheme: dark)` and follows live system
changes. Manual `light` and `dark` modes ignore system changes. During server
rendering, `auto` resolves deterministically to `light` without reading
`window.matchMedia`.

---

## Injection Tokens

```ts
export const MLV_THEME = new InjectionToken<MlvThemeMode>('MLV_THEME');
export const MLV_THEME_KEY = new InjectionToken<string>('MLV_THEME_KEY');
```

## Provider Function

```ts
export function provideDefaultTheme(theme: MlvThemeMode = 'light', themeKey = 'mlv-theme'): Provider[];
```

---

## Usage Examples

```html
<mlv-layout>
  <ng-template mlvLayoutTop>
    <header>
      <h1>My App</h1>
      <button (click)="toggle()">Toggle Theme</button>
    </header>
  </ng-template>

  <ng-template mlvLayoutSide>
    <nav><!-- sidebar nav --></nav>
  </ng-template>

  <main><!-- page content --></main>
</mlv-layout>
```

```ts
// Bootstrap by following the operating-system preference
bootstrapApplication(AppComponent, {
  providers: [provideDefaultTheme('auto', 'my-app-theme')]
});

// In component
themeService = inject(MlvThemeService);
useDarkTheme() {
  this.themeService.setTheme('dark');
}
```

Use `themeMode()` to render mode controls and `currentTheme()` anywhere that
needs the actual resolved theme.

---

## Dependencies

- `@angular/core`, `@angular/common`
- `rxjs` — media query listener
