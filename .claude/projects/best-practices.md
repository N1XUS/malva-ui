---
# Best Practices for angular-ui-lib

> **Keep this file up to date.** Whenever conventions, tooling, or patterns change, update this document to reflect the new guidance.

This document captures the coding standards and conventions for the `angular-ui-lib` monorepo. It is the authoritative reference for all agents and developers working in this codebase.

For granular, copy-paste-ready rules with full code examples, see the rule files in `.claude/rules/`:

| Rule file | Covers |
|-----------|--------|
| `.claude/rules/angular-component.md` | `@Component` skeleton, host bindings, inputs, outputs, queries, DI, templates |
| `.claude/rules/angular-directive.md` | `@Directive` skeleton, selectors, slots, injection tokens, lifecycle cleanup |
| `.claude/rules/angular-pipe.md` | `@Pipe` skeleton, pure vs impure, typing, DI |
| `.claude/rules/bem-scss.md` | BEM naming, `--mlv-*` CSS variables, `$block` pattern, rem values, design tokens |
| `.claude/rules/accessibility.md` | Keyboard nav, tabindex, ARIA, FocusKeyManager, focus trapping, WCAG AA |

---

## TypeScript Best Practices

- **Strict type checking** — always enable and respect TypeScript strict mode
- **Prefer type inference** when the type is obvious from context (e.g., `const count = 0` not `const count: number = 0`)
- **Avoid `any`** — use `unknown` when the type is genuinely uncertain; narrow before use
- **Barrel exports** — always use `export * from './lib'` rather than named re-exports like `export { MyComponent } from './lib'`
- **Use interfaces for public APIs** — prefer `interface` over `type` for defining public API shapes, to allow for declaration merging and better readability
- **Use type aliases for unions and primitives** — use `type` for defining union types, intersection types, mapped types, and primitive aliases (e.g., `type MlvButtonVariant = 'primary' | 'secondary' | 'outlined'`)
- **Use class extension for code reuse** — prefer abstract class inheritance when multiple components share common logic, rather than mixins or composition patterns, to leverage TypeScript's structural typing and better IDE support

---

## Angular Best Practices

- **Standalone components only** — never use NgModules; every component, directive, and pipe is standalone
- **Do NOT set `standalone: true`** inside decorators — it is the default in Angular v20+ and is redundant/incorrect to set explicitly
- **Signals for state** — use Angular signals (`signal()`, `computed()`, `effect()`) for all reactive state
- **Lazy loading** — all feature routes must use lazy loading (`loadComponent` / `loadChildren`)
- **Dependency Injection via Injection Tokens** — never directly import concrete classes into components, directives, or services; define an interface + `InjectionToken<Interface>` and provide the concrete implementation separately
- **No `@HostBinding` / `@HostListener`** — use the `host` object inside `@Component` or `@Directive` decorator instead:
  ```ts
  @Component({ host: { '(click)': 'onClick()', '[class.active]': 'isActive()' } })
  ```
- **`NgOptimizedImage`** for all static images (not valid for inline base64 images)
- **Always** use `takeUntilDestroyed()` for observables in component/directives/services/etc, to prevent memory leaks:
  ```ts
  this.myObservable$.pipe(takeUntilDestroyed()).subscribe((value) => {
    // handle value
  });
  ```

---

## Accessibility Requirements

- All components **must pass all AXE checks**
- All components **must follow WCAG AA minimums**: focus management, color contrast, ARIA attributes
- Ensure keyboard navigability for interactive elements
- Use semantic HTML; add ARIA roles/labels only when native semantics are insufficient

---

## Native Form Controls

**Don't use native `<input>` elements outside `mlv-input`.** Every text-style entry field (`text`, `password`, `email`, `number`, `tel`, `url`, `search`) must be expressed as `<mlv-input>`. Reach for `<mlv-input>` even when you only need a one-line `value`/`(input)` widget — consistent focus styling, density, theming, ARIA, prefix/suffix slots, and `FormControlBase` integration come for free.

If `<mlv-input>` is missing a property/attribute you need to forward to the underlying native element (e.g. `min`, `max`, `step`, `maxlength`, `pattern`, `name`, `autofocus`), **add the property to `mlv-input`** rather than dropping a raw `<input>` next to it. Forward it through the template binding on the internal `<input>` element. Update the lib's CLAUDE.md inputs table when you do.

Allowed exceptions — these are the **only** places a native `<input>` is correct:

| Element                                      | Owner component               | Why it is not `mlv-input`                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<input type="checkbox">`                    | `mlv-checkbox`, `mlv-switch`  | Toggles, not text inputs. The native input is visually-hidden but kept in the a11y tree (clip-path pattern).                                                                                             |
| `<input type="radio">`                       | `mlv-radio`                   | Native radio grouping semantics. Visually hidden, kept in the a11y tree.                                                                                                                                 |
| `<input type="file">`                        | `mlv-file-upload`             | File picker has no `<mlv-input>` equivalent — kept native and visually hidden.                                                                                                                           |
| Per-cell single-character inputs             | `mlv-pin-input`               | Specialised cell-row OTP pattern that does not map to one `<mlv-input>`.                                                                                                                                 |
| `<input type="range">`                       | `mlv-color-picker` (internal) | Range slider — `mlv-slider` is the public-API equivalent for full slider widgets. Internal flat tracks (e.g. the hue / opacity strips inside `mlv-color-picker`) keep the native `type="range"` for now. |
| The internal `<input>` of `mlv-input` itself | `mlv-input`                   | The component's own implementation.                                                                                                                                                                      |

Every other text/numeric/email/tel/url field — including search boxes inside `mlv-combobox`, the trigger of `mlv-tokenizer`, and free-form HEX/RGB fields inside `mlv-color-picker` — must use `<mlv-input>` (the migration is in progress; see `docs/audits/SUMMARY.md` for the current state).

---

## Component Guidelines

| Concern                | Rule                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size                   | Keep components small and focused on a single responsibility                                                                                                                        |
| Inputs/Outputs         | Use `input()` and `output()` signal functions — not `@Input()` / `@Output()` decorators                                                                                             |
| Derived state          | Use `computed()`                                                                                                                                                                    |
| Change detection       | Always set `changeDetection: ChangeDetectionStrategy.OnPush`                                                                                                                        |
| Template size          | Prefer inline templates for small components                                                                                                                                        |
| Forms                  | Prefer Reactive Forms over Template-driven                                                                                                                                          |
| CSS classes            | Use `[class.foo]="condition"` bindings — **not** `ngClass`                                                                                                                          |
| Inline styles          | Use `[style.color]="value"` bindings — **not** `ngStyle`                                                                                                                            |
| Queries                | Use `contentChild()`, `contentChildren()`, `viewChild()`, `viewChildren()` signal functions — **not** `@ContentChild`, `@ContentChildren`, `@ViewChild`, `@ViewChildren` decorators |
| Template / style paths | Always relative to the component `.ts` file                                                                                                                                         |

---

## State Management

- Use signals for all local component state
- Use `computed()` for any derived/calculated values
- Keep state transformations pure and predictable (no side effects in computed)
- **Never use `.mutate()`** on signals — use `.update()` or `.set()` instead

---

## Templates

- Keep templates simple — avoid complex logic (extract to `computed()` or methods)
- Use **native control flow**: `@if`, `@for`, `@switch` — **not** `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the `async` pipe to subscribe to observables in templates
- **Do not assume globals** like `new Date()` are available in templates — derive values in the component class
- **Do** use `as [variable]` syntax for `@if` and `@for` to improve readability and performance by avoiding repeated expressions

---

## Services

- Each service has a single responsibility
- Use `providedIn: 'root'` for singleton services
- Use the `inject()` function for dependency injection — **not** constructor injection:
  ```ts
  private readonly myService = inject(MY_SERVICE_TOKEN);
  ```

---

## Nx Workspace Conventions

- **Navigating/exploring**: invoke the `nx-workspace` skill first
- **Running tasks**: always use `nx` CLI (`nx run`, `nx run-many`, `nx affected`) — not underlying tools directly
- **Prefix nx commands** with the workspace package manager: `yarn nx build`, `npm exec nx test`, etc.
- **Scaffolding**: invoke the `nx-generate` skill first before exploring or calling MCP tools
- **NEVER guess CLI flags** — check `nx_docs` or `--help` first

### Project boundaries

- Every project carries `scope:*`, `family:*`, and `type:*` tags.
- Core UI leaves may depend on core, CDK, i18n, and styles families; CDK
  infrastructure may depend only on CDK, i18n, and styles.
- Import the narrow published secondary entry point (for example
  `@malva-ui/cdk/utils`) instead of a family root barrel inside libraries.
- Internal renderers and implementation helpers stay out of public barrels.
  Export only APIs that consumers are expected to construct or reference.

### Consumer installation schematics

- Package installation schematics live in the owning publishable package's
  `schematics/` directory and are exposed through its `package.json`.
- Keep `ng-add` rules idempotent: never duplicate dependencies, build styles,
  imports, or root providers when the installer is rerun.
- Use Angular's workspace and standalone utility rules for consumer edits so
  both standalone applications and NgModule-based applications remain
  supported.
- Test schematics against in-memory Angular workspaces through a dedicated Nx
  target. Do not couple their Node-only harness to the browser-oriented Angular
  component test environment.

---

## CSS Methodology

This codebase follows the **BEM (Block Element Modifier)** naming convention for all CSS class names.

- **Block** — a standalone component: `.mlv-button`, `.mlv-dialog`, `.mlv-tokenizer`
- **Element** — a part of a block, separated by `__`: `.mlv-button__icon`, `.mlv-dialog__header`, `.mlv-tokenizer__input`
- **Modifier** — a variant or state of a block or element, separated by `--`: `.mlv-button--primary`, `.mlv-dialog--large`, `.mlv-tokenizer--disabled`

Rules:

- Block names match the component selector (e.g., `mlv-button` → `.mlv-button`)
- Never nest BEM class names to create element names — `.mlv-card__header__title` is wrong; use `.mlv-card__title` instead
- Modifiers are always combined with the base class: `class="mlv-button mlv-button--primary"`, never `class="mlv-button--primary"` alone
- Use `ViewEncapsulation.None` on every **library** component and rely on BEM scoping for style isolation. **Docs-app exemption:** `apps/docs` page/example components keep Angular's default (emulated) encapsulation — their example styles are written for scoped behavior and must not leak across pages.
- Avoid using custom CSS values (padding, font-size, margin, etc.) in favor of built-in CSS variables defined in `libs/styles/src/lib/theme.css`, `libs/styles/src/lib/_typography.css`, `libs/styles/src/lib/_animations.css`
- If a CSS value is static, reference the shared `--mlv-*` token directly instead of creating an extra component-scoped alias variable.
- Only introduce a component-scoped CSS variable when the value is meant to change based on component state, variant, density, theme override, or another modifier.
- Use rem-based values rather than px for all properties. For example, use `padding: 0.5rem` instead of `padding: 8px` to ensure better scalability and accessibility across different devices and user settings.
- `--mlv-padding-{xs,s,m,l,xl,2xl}` are **two-value `block inline` pairs** — use them only as the whole `padding:` value; per-side, `padding-inline/block`, `gap`, `margin`, `top`, `calc()` and multi-value shorthands take the matching `--mlv-spacing-*` half instead (see `.claude/rules/bem-scss.md`). Enforced by `yarn nx run styles:check-padding-tokens` (a `styles:lint` dependency, so it gates CI).
- Every animated BEM block must provide a reduced-motion path. Prefer
  `@include mixins.reduced-motion('<block>')` for the standard instantaneous
  fallback, or the narrower motion helpers when a bespoke fallback is needed.
- Every rule the library emits belongs in a cascade layer — component SCSS in
  `@layer mlv.components`, tokens in `mlv.tokens`, global resets in `mlv.base`.
  Nothing ships unlayered: an unlayered library rule beats every layered one and
  takes the override slot that belongs to the consumer. A partial that opens a
  layer block must `@use 'layers';` first, because a layer's priority is fixed
  the first time it is named. **A plain `.css` component stylesheet is layered
  the same way** — wrap the whole file in `@layer mlv.components { … }`; there is
  no `@use` to write.
- Enforced by `libs/styles/src/lib/layers.spec.mjs` (a `styles:test` input) in
  two parts: the global entry points are compiled and checked for layer order,
  and **every** stylesheet under `libs/**/src/**` is parsed with PostCSS and
  asserted to emit no rule outside a layer. Exempt: files that emit nothing
  (`_partials`, `*.mixins.scss`, `mixins`/`density`/`breakpoints`), the global
  `libs/core/styles/**` entry point (covered by the first part) and
  `libs/tailwind/theme.css` (a Tailwind v4 `@theme` adapter that declares
  variables, not rules).

---

## Style Specs and Cascade Layers

jsdom does not implement `@layer`: it fails with "Could not parse CSS stylesheet"
and drops the **entire** stylesheet, so a `getComputedStyle` assertion against a
layered component stylesheet silently reads `''` instead of failing loudly.

The test environment therefore flattens layers away; the shipped CSS keeps them.

| Spec reads…                                      | What to do                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Computed styles from an injected `<style>`       | Nothing. `scripts/testing/setup-strip-css-layers.js` is a `setupFiles` entry in every `vite.config.mts` and strips layers from any CSS entering a `<style>` element.     |
| Compiled CSS **text** or a PostCSS AST           | Wrap the `sass.compile(...).css` in `stripCssLayersFromText()` from `@malva-ui/internal-testing` — the wrapper's indentation is removed with it, so line anchors hold.  |
| The `.scss` **source** text                      | Nothing — the source is read as written.                                                                                                                                |

`@malva-ui/internal-testing` maps to `scripts/testing/strip-css-layers.js`. It is
spec-only, never bundled, and allow-listed in `@nx/enforce-module-boundaries`.
Its own tests run as `nx run @malva-ui/source:test`.

---

## File & Folder Conventions

- Libraries live under `libs/<name>/src/lib/`
- Public API is exported from `libs/<name>/src/index.ts`
- Applications live under `apps/<name>/src/`
- Each library and application has its own `CLAUDE.md` (symlink to `.claude/projects/libs-<name>.md` or `.claude/projects/app-<name>.md`) with detailed documentation

---

## Class, Type & Interface Naming Conventions

Every **publicly exported** class, type, and interface in `libs/` is prefixed `Mlv`, and
classes decorated with `@Component` or `@Directive` carry **no** `Component` / `Directive`
suffix. See [docs/migrations/2026-07-mlv-prefix.md](../../docs/migrations/2026-07-mlv-prefix.md).

| Declaration                                              | Naming                              | Example                                                    |
| -------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `@Component` class                                       | `Mlv<Name>` — no `Component` suffix | `MlvButton`, `MlvDialog`, `MlvTooltipPanel`                |
| `@Directive` class                                       | `Mlv<Name>` — no `Directive` suffix | `MlvButtonIcon`, `MlvClick`, `MlvInfiniteScroll`           |
| Structural template-def directive                        | `Mlv<Name>Def`                      | `MlvCardHeaderDef`, `MlvTabContentDef`                     |
| Attribute directive that duplicates an element component | `Mlv<Name>Host`                     | `MlvSidebarItemHost`, `MlvBreadcrumbItemHost`              |
| Service / ref / pipe / abstract base                     | `Mlv<Name>` — **keep** the suffix   | `MlvDialogService`, `MlvDialogRef`, `MlvColorFromTextPipe` |
| `type` / `interface`                                     | `Mlv<Name>`                         | `MlvButtonShape`, `MlvSelectOption<T>`                     |
| Injection token                                          | `MLV_<NAME>` (unchanged)            | `MLV_BUTTON_VARIANT`                                       |

Exceptions (documented in the migration doc): `MlvDensityDirective` and
`MlvDensityRootDirective` keep the suffix, because stripping it collides with the public
`MlvDensity` type.

`apps/docs`-internal components are **not** part of this scheme — they keep their
docs-local `app-` / `docs-` naming.

Filenames under `libs/` carry no `.component` / `.directive` segment: `dialog.ts`, not
`dialog.component.ts`. Plural multi-declaration modules (`button.directives.ts`) are the
exception.

## Property & Method Naming Conventions

- Use **camelCase** for all properties and methods (e.g., `isActive`, `handleClick`, `fetchData`)
- Use **PascalCase** for all types and interfaces (e.g., `MlvUser`, `MlvProduct`, `MlvApiResponse`)
- Use **UPPER_SNAKE_CASE** for constants (e.g., `API_URL`, `DEFAULT_TIMEOUT`)
- Use **kebab-case** for CSS class names (e.g., `.mlv-button`, `.mlv-dialog`, `.mlv-tokenizer`)
- Avoid abbreviations unless they are widely understood (e.g., `id`, `url`, `api` are fine; `usr`, `cfg`, `tmp` are not)
- Use descriptive names that clearly convey the purpose and intent of the property or method (e.g., `isLoading`, `handleSubmit`, `fetchUserData`), unless its alias from standard HTML attributes (e.g., `disabled`, `readonly`, `required`)
- For boolean input properties use BooleanInput type with `coerceBooleanProperty` to allow flexible usage in templates (e.g., `<mlv-button disabled>` or `<mlv-button [disabled]="true">`)
- **Always** include JSDoc comments for all public API properties and methods, describing their purpose, parameters, return values, and any important notes or caveats
- **Always** prefix private/internal members with an underscore. Protected members that are **template-facing** (bound/called from the component's own template, incl. signal queries like `protected readonly headerRef = contentChild(...)`) may omit the prefix; protected members that are implementation details keep the `_` prefix. All of them get JSDoc describing purpose and caveats
- **Always** prefix all private/internal properties and methods with underscore, include JSDoc comments describing their purpose and any important implementation details or caveats

## Keeping Documentation Current

- After **any** change to a component, directive, service, or public API in a library, update the corresponding `.claude/projects/libs-<name>.md`
- After **any** new route, page, or significant component addition to an app, update `.claude/projects/app-<name>.md`
- After **any** change to conventions or tooling, update this file (`best-practices.md`)
- After editing a `.claude/projects/libs-<name>.md` (or any lib `CLAUDE.md`), run `yarn nx run docs:check-doc-api` — it fails when a documented input/output/model/method is not declared in the extracted API, and warns on declared-but-undocumented members (`--strict` to fail on warnings, `--json` for the raw report)
