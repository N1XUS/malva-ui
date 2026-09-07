# @malva-ui/tailwind

Optional Tailwind CSS v4 theme variables backed by Malva UI runtime tokens.
This package adds application-level utility styling; it does not replace the
Malva component stylesheet or require Tailwind in @malva-ui/core.

## Install

For an Angular application, run the guided installer:

```sh
ng add @malva-ui/tailwind
```

The schematic adds Tailwind CSS v4, the Angular PostCSS adapter, and PostCSS;
creates src/styles/malva-ui-tailwind.css; adds that file to the application
build; and adds the Malva core stylesheet that provides the runtime
--mlv-\* values. It is safe to run again: only regions surrounded by the
Malva markers are managed.

The generated stylesheet is:

```css
/* malva-ui:tailwind:start */
@import 'tailwindcss';
@import '@malva-ui/tailwind/theme.css';
/* malva-ui:tailwind:end */
```

## Manual setup

Install the runtime packages and Tailwind build tooling:

```sh
npm install @malva-ui/core @malva-ui/tailwind
npm install --save-dev tailwindcss @tailwindcss/postcss postcss
```

Create `postcss.config.json` (the JSON format is discovered automatically by
the Angular application builder):

```json
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

Create a global CSS entrypoint included by the Angular application:

```css
@import 'tailwindcss';
@import '@malva-ui/tailwind/theme.css';
```

Also include the core stylesheet in the application build:

```json
{
  "styles": ["src/styles/malva-ui-tailwind.css", "node_modules/@malva-ui/core/styles/malva-ui.css"]
}
```

The core stylesheet is required because the adapter deliberately references
runtime Malva variables instead of copying their values. Light, dark, and
high-contrast themes therefore update the same utility classes automatically.

The installer also accepts `--project`, `--stylesheet`,
`--include-core-styles`, and `--skip-install`. The default stylesheet is
`src/styles/malva-ui-tailwind.css`; use `--project` in a workspace with more
than one Angular application. Set `--include-core-styles=false` only when the
application already loads the published core stylesheet elsewhere.

## Available theme variables and classes

The adapter uses Tailwind v4's CSS-first @theme inline API. Every exported
theme variable is namespaced with mlv- and resolves to an existing Malva custom
property.

| Tailwind theme variables                                                                                 | Available class patterns                                | Examples                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| --color-mlv-primary-_, secondary-_, accent-_, neutral-_, success-_, warning-_, danger-_, info-_ (50–950) | bg-mlv-_, text-mlv-_, border-mlv-\*                     | bg-mlv-primary-500, text-mlv-neutral-700                             |
| --color-mlv-surface-_, content-_, semantic state colors                                                  | bg-mlv-_, text-mlv-_, border-mlv-\*                     | bg-mlv-surface-raised, text-mlv-content-secondary, border-mlv-normal |
| --spacing-mlv-\* (0, px, 0-5, 1, 1-5, 2, 2-5, 3, 3-5, 4, 5, 6, 8, 10, 12, 16)                            | p-mlv-_, px-mlv-_, m-mlv-_, gap-mlv-_, sizing utilities | p-mlv-4, gap-mlv-2, mt-mlv-6                                         |
| --radius-mlv-\* and semantic shape names                                                                 | rounded-mlv-\*                                          | rounded-mlv-card, rounded-mlv-full                                   |
| --shadow-mlv-\* (0–5 and semantic elevation names)                                                       | shadow-mlv-\*                                           | shadow-mlv-raised, shadow-mlv-floating                               |
| --font-mlv-sans, mono, code, display and --font-weight-mlv-\*                                            | font-mlv-\*                                             | font-mlv-code, font-mlv-medium                                       |
| --text-mlv-_ and --leading-mlv-_                                                                         | text-mlv-_, leading-mlv-_                               | text-mlv-body-m, leading-mlv-body-m                                  |

The semantic color names include surfaces, content, primary/accent/neutral
interactive states, danger/success/warning/info states, and subtle/normal/
strong/focus/error/success/warning/info borders. State and responsive variants
work normally, for example:

`font-mlv-code` maps to `--mlv-font-family-code`, which prefers Fira Code and
JetBrains Mono before falling back to the system monospace stack.

```html
<article class="rounded-mlv-card border border-mlv-normal bg-mlv-surface-raised p-mlv-5 shadow-mlv-raised">
  <h2 class="font-mlv-display text-mlv-heading-h2 text-mlv-content">Account settings</h2>
  <p class="mt-mlv-2 text-mlv-body-m leading-mlv-body-m text-mlv-content-secondary">Uses Malva's shared surface, type, spacing, border, and elevation tokens.</p>
  <button class="mt-mlv-4 rounded-mlv-button bg-mlv-primary px-mlv-4 py-mlv-2 font-mlv-medium text-mlv-on-primary hover:bg-mlv-primary-hover">Save changes</button>
</article>
```

Use the underlying Malva variables directly when a utility does not cover a
private or application-specific concern. Do not map --mlv-padding-\* into
Tailwind spacing: those variables are vertical/horizontal pairs, while
Tailwind spacing values must be single values.

## Updating safely

The schematic owns only text between
/_ malva-ui:tailwind:start _/ and /_ malva-ui:tailwind:end _/. It preserves
content outside those boundaries, does not duplicate existing dependencies or
style entries, and leaves an unmarked manual stylesheet for review instead of
overwriting it.

Tailwind utilities are an optional layer for application layout and visual
composition. Malva components continue to use their published CSS and runtime
tokens independently.

## Versioning and support

Semver contract, what counts as public API, the deprecation window and the
support window per major:
[VERSIONING.md](https://github.com/N1XUS/malva-ui/blob/main/VERSIONING.md)
(the repository is private while the library is pre-1.0, so the link needs
repository access — ask us for the policy if it 404s for you).
