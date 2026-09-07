# @malva-ui/core

A production-grade Angular component library — 68 components, light/dark theming, five density levels, 14 locales, and WCAG 2.1 AA accessibility verified with axe.

Every component is standalone, `OnPush`, and signal-based throughout, styled with BEM against `--mlv-*` design tokens you can override.

```html
<button mlvButton>Save</button>
```

## Install

Run the Angular installer from the root of a consumer workspace:

```bash
ng add @malva-ui/core
```

The installer:

1. Selects the only Angular application automatically, or accepts
   `--project <name>` in a multi-application workspace.
2. Adds the matching `@malva-ui/cdk` and `@malva-ui/i18n` packages.
3. Adds the packaged Malva UI token, reset, and animation stylesheet.
4. Configures `provideDefaultTheme()` and `provideMlvDensity()` in the root
   application providers.

It asks for the initial light/dark theme, component density, global-style
setup, and provider bootstrapping. The command is idempotent and can be run
again without duplicating configuration.

### Non-interactive installation

```bash
ng add @malva-ui/core \
  --project my-app \
  --theme dark \
  --density compact \
  --include-styles \
  --configure-providers \
  --no-interactive
```

| Option               | Values                                                  | Default       |
| -------------------- | ------------------------------------------------------- | ------------- |
| `project`            | Angular application name                                | sole app      |
| `theme`              | `light`, `dark`                                         | `light`       |
| `density`            | `tight`, `compact`, `comfortable`, `spacious`, `airy`   | `comfortable` |
| `includeStyles`      | Add the packaged global stylesheet                      | `true`        |
| `configureProviders` | Add theme and density root providers                    | `true`        |
| `themeStorageKey`    | Browser storage key for the persisted theme             | `mlv-theme`   |
| `skipInstall`        | Do not run the package manager after dependency changes | `false`       |

If styles or providers are managed elsewhere, disable those steps with
`--no-include-styles` and `--no-configure-providers`.

## Use a component

Each component has its own entry point, so you only bundle what you import:

```ts
import { MlvButton } from '@malva-ui/core/button';
import { MlvDialogService } from '@malva-ui/core/dialog';
import { MlvInput } from '@malva-ui/core/input';
```

```html
<button mlvButton>Save</button>
```

## Components

**Forms** — `button` · `input` · `textarea` · `select` · `combobox` · `autocomplete` · `checkbox` · `radio` · `switch` · `slider` · `rating` · `number-input` · `pin-input` · `file-upload` · `color-picker` · `tokenizer` · `search-field` · `segmented` · `form` · `form-utils`

**Dates** — `calendar` · `day-picker` · `date-range-picker` · `time-picker`

**Data** — `data-table` · `tree` · `pagination` · `filter` · `list` · `timeline`

**Overlays** — `dialog` · `drawer` · `popup` · `menu` · `tooltip` · `toast` · `notification` · `dropdown`

**Navigation** — `sidebar` · `tabs` · `breadcrumb` · `stepper` · `bottom-nav` · `action-bar` · `link` · `page`

**Layout** — `layout` · `card` · `tile` · `accordion` · `expand` · `split-pane` · `divider` · `toolbar` · `scrollbar`

**Display** — `avatar` · `avatar-group` · `badge` · `chip` · `alert` · `progress` · `loader` · `skeleton` · `empty-state` · `status-indicator` · `kbd` · `title` · `chat` · `copy-to-clipboard`

## Theming

Components read `--mlv-*` custom properties, so a theme is a stylesheet override — no build step, no SCSS fork:

```css
:root {
  --mlv-background-accent-1: #6d28d9;
  --mlv-radius-button: 0.75rem;
}
```

Light and dark ship out of the box via `provideDefaultTheme()`; density (`tight` → `airy`) is switched per-tree with `mlvDensity` or globally with `provideMlvDensity()`.

## Zoneless and SSR

Every component is `OnPush` and signal-based, so the library runs under
`provideZonelessChangeDetection()` with `zone.js` removed:

```ts
bootstrapApplication(App, {
  providers: [provideZonelessChangeDetection(), provideDefaultTheme()],
});
```

Components are also safe to server-render — measurement, observers and
document-level listeners stay behind platform guards, and overlays are never
constructed during SSR. Both are covered by tests, not just intent.

## Peer dependencies

`@angular/aria`, `@angular/cdk`, `@angular/common`, `@angular/core`, `@angular/forms`, `@lucide/angular`, `rxjs`, plus the companion packages `@malva-ui/cdk` and `@malva-ui/i18n` (both added by `ng add`).

## Related packages

- [`@malva-ui/cdk`](https://www.npmjs.com/package/@malva-ui/cdk) — headless primitives (overlay, density, data-source)
- [`@malva-ui/i18n`](https://www.npmjs.com/package/@malva-ui/i18n) — localisation, 14 locales
- [`@malva-ui/editor`](https://www.npmjs.com/package/@malva-ui/editor) — Tiptap-based rich-text editor

## Versioning and support

Semver contract, what counts as public API, the deprecation window and the
support window per major:
[VERSIONING.md](https://github.com/N1XUS/malva-ui/blob/main/VERSIONING.md)
(the repository is private while the library is pre-1.0, so the link needs
repository access — ask us for the policy if it 404s for you).

## License

MIT
