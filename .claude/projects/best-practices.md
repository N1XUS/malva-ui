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
| `.claude/rules/rtl.md` | Direction / RTL: logical CSS, `--mlv-inline-direction`, `normalizeArrowKey`, overlay `direction`, icon mirroring, RTL specs |

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
  Exception: a subscription whose lifetime is shorter than the component's — re-created when a signal changes, or tied to an overlay that is attached and disposed repeatedly — is released by the `effect`'s `onCleanup` (or the owning teardown list) instead; `takeUntilDestroyed()` would fire only at destroy and leak every earlier generation (`mlv-speed-dial`'s `fromEvent` trigger listeners are the reference case).

---

## DOM Listeners

DOM listeners go through `fromEvent`, not `addEventListener` and not a template/host
listener binding. Triage each site before converting — several forms below are
legitimately raw, and choosing by omission is the failure mode.

**Why not a template `(event)` / host binding.** Angular wraps every listener binding in
`wrapListenerIn_markDirtyAndPreventDefault`, which marks the ancestor view chain dirty and
notifies the change-detection scheduler on **every** event — before it knows whether the
handler changed anything. For a high-frequency event (`mousemove`, `wheel`, `scroll`,
`dragover`, `pointermove`) that is one scheduler notification per event, for a handler that
usually writes a signal the value it already holds. `fromEvent` registers a plain listener
with no wrapper, so a signal `.set()` to an unchanged value notifies nothing.

**`runOutsideAngular` is not the fix.** The library is zoneless-only (#37), so `NgZone` is
`NoopNgZone` and `runOutsideAngular` is a passthrough. Existing wrappers around `fromEvent`
are kept for consumers still on zone-based change detection and are documented as such —
do **not** add new ones.

Pick the lifetime, then write it:

| Lifetime                                                                               | Form                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Exactly the component's / directive's                                                  | `fromEvent(el, 'x', opts).pipe(takeUntilDestroyed(ref)).subscribe(...)`                                  |
| Ends at a specific moment (drag until `pointerup`, an animation until `transitionend`) | `.pipe(takeUntil(end$), takeUntilDestroyed(ref))` — **both**, so a destroy mid-gesture still releases it |
| Re-created per signal change / per overlay attach                                      | released from the owning `effect`'s `onCleanup`, **not** `takeUntilDestroyed`                            |

`fromEvent`'s third argument is typed `EventListenerOptions` and does **not** accept the
legacy boolean: `fromEvent(el, 'x', true)` fails `ngc` with TS2769 _and_ collapses the
emission generic to `unknown`. Write `{ capture: true }`. It is runtime-correct, so the unit
suites pass — only `nx run core:build` / `cdk:build` (AOT) or a project's `typecheck` target
catches it. Run one of those, not just `test` and `lint`, after touching a listener.

- `takeUntilDestroyed` fires only at destroy. On a re-created subscription it leaks every
  earlier generation — `mlv-speed-dial`'s trigger listeners are the reference case.
- `afterNextRender` / `afterRenderEffect` callbacks are **not** injection contexts, so the
  bare `takeUntilDestroyed()` throws there. Pass the ref: `takeUntilDestroyed(this._destroyRef)`.
- **Carry `capture` / `passive` / `once` over verbatim** — `fromEvent`'s third argument. A
  dropped `passive: true` is a scroll-performance regression; a dropped `capture` changes
  event ordering. When the handler calls `preventDefault()`, pass `{ passive: false }`
  **explicitly** and say why, rather than resting on `fromEvent`'s default. **One
  exception:** `once: true` on a target-guarded end-event listener is a bug and is dropped,
  not carried — see the bubbling end-event bullet below.
- **Bind document-level listeners to the injected `DOCUMENT`**, never the ambient `document`
  global (`inject(DOCUMENT)`; the token is declared in `@angular/core` and re-exported
  unchanged by `@angular/common`, so either import resolves to the same token — 19 of the 21
  call sites in `libs/` use the `@angular/common` spelling). Under server rendering the two are **different objects and the global
  is defined**, so an ambient `document.addEventListener` binds a per-render component to a
  process-wide object no teardown reaches — and nothing throws, so the SSR smoke suite stays
  green. Pin it with a test that overrides `DOCUMENT` with
  `document.implementation.createHTMLDocument()` and asserts **which** object received the
  listener (`sidebar-rail.spec.ts` is the reference); asserting that nothing threw cannot see it.
- An event that is not guaranteed to arrive needs a fallback, not an open wait:
  `race(fromEvent(el, 'transitionend'), timer(MS)).pipe(take(1), …)`. A `transition` or
  `animation` declared under `@media (prefers-reduced-motion: no-preference)` never fires
  its end event under reduced motion, so a handler that self-removes inside the event both
  latches its class and stacks one listener per gesture. The end event also needs the target
  guard below, applied inside the `race`'s event arm.
- **A bubbling end event is "_this_ element finished" only behind a target guard.**
  `animationend` / `transitionend` bubble, so every listener for one that completes, disposes
  or un-latches something — raw, `fromEvent`, **or a template / host `(animationend)`
  binding** — admits only the bound element's own event (#231). A descendant's finite
  animation is ordinary, in-repo too: `mlv-message`'s `animate.enter` inside a popup field,
  `mlv-expand`, consumer content in a drawer body.
  - Raw / `fromEvent`: `event.target === el`. Template binding: pass `$event` to a method
    comparing `event.target === event.currentTarget` (`MlvPopup._onPanelAnimationEnd`,
    `MlvOverlayHostBase._onPanelAnimationEnd`, `MlvDialog._onAnimationEnd`).
  - **Never `once: true`** on a guarded listener — the ignored descendant event spends it
    and strands the real one on a fallback timer, or latches it for good. Remove it by hand
    on the matching event and on every cancellation path (`overlay-ref.ts`,
    `overlay-service-base.ts`, `animated-presence.ts`).
  - Inside `race`, the filter goes **inside the event arm**:
    `race(fromEvent(el, 'transitionend').pipe(filter((e) => e.target === el)), timer(MS))`.
    Placed after the `race`, a descendant event wins it, is dropped, and the timer arm is
    already unsubscribed — the class latches (`drawer-resize.ts`).
  - Keep the guard off the fallback path: a filtered listener method forwards to an
    unfiltered completion method, and the fallback timer calls the **unfiltered** one.
    `target === currentTarget` also admits a never-dispatched `Event` (both `null`), so never
    synthesize an event to reach the filtered method.
  - Blind spot (measured, Chromium): an animation on the bound element's own `::before` /
    `::after` arrives with `target === element` and passes the guard;
    `AnimationEvent.pseudoElement` tells them apart. No bound element in `libs/` animates a
    pseudo-element today — check before adding one.

**The capture phase is not a reason to stay raw.** `fromEvent`'s third argument reaches the
identical `addEventListener` call, so the phase and the ordering among capture listeners are
unchanged, and `Subscriber.next` is synchronous, so a `stopImmediatePropagation()` guard still
runs inside the native listener invocation. Every capture-phase site in `libs/` is a
`fromEvent(el, 'x', { capture: true })` stream, each pinned by an ordering test:
`popup.service.spec.ts` (click-outside beating an inner `stopPropagation`),
`editor-focus.spec.ts` (a disabled-guard beating descendant listeners), and
`segmented.spec.ts` (a disabled link beating Angular's coalesced host listener on the _same_
element — at `AT_TARGET` the capture pass runs before the bubble pass, so registration order
is irrelevant).

Legitimately **keep raw** — with a one-line reason in the code naming which of these it is:

- A per-animation listener on an element the same code path removes or disposes, where the
  listener's lifetime is one animation rather than the component's. The four sites in
  `libs/cdk` are this shape — `animated-presence` (two), `overlay-ref`, `overlay-service-base`
  — all target-guarded and removed by hand, none `once: true` (see the bubbling end-event
  bullet above). `animated-presence`'s leave still has no fallback timer (#278).
- No injection context to take a `DestroyRef` from, and a teardown boundary that is not the
  component's — a ProseMirror plugin view constructed by Tiptap
  (`editor-block-handle.ts`, eight listeners unbound in the plugin's own `destroy()`).
- A listener a third party's contract requires you to add and remove yourself.

"The stable bound handler reference is what makes re-entry a no-op" is **not** on this list: a
`Subscription` field replaced with a fresh one per gesture gives the same idempotence and an
explicit teardown (`sidebar-rail.ts`, `data-table.ts`).

An `addEventListener` / `removeEventListener` count mismatch is a **signal, not a verdict**:
a listener on an element that is itself removed dies with it. The ones that matter are on
`document` / `window` / a long-lived element. Equally, a balanced count proves nothing when
the `remove` sits on a path that may never run — that is exactly the `drawer-resize`
`transitionend` bug (#76). Decide per site, and assert destroy-time teardown with a spy on
`removeEventListener` plus a post-destroy dispatch rather than by reading the code.

---

## Accessibility Requirements

- All components **must pass all AXE checks** — a full sweep per rendered state, asserted with `expectNoAxeViolations` from `@malva-ui/internal-testing/axe`. Never `import axe from 'axe-core'` in a spec and never `expect(results.violations).toEqual([])`. The contract, the two centrally disabled rules, how to narrow one at a call site and the `scripts/check-axe-coverage.mjs` guard (run by `nx run @malva-ui/source:test`) are all in `.claude/rules/accessibility.md` § _Asserting It_
- All components **must follow WCAG AA minimums**: focus management, color contrast, ARIA attributes
- Ensure keyboard navigability for interactive elements
- Horizontal keyboard and pointer behaviour mirrors in RTL: arrow handlers go through `MlvRtlService.normalizeArrowKey(event, this._direction())` — the second argument is a resolved `MlvDirection`, one cached `elementDirection(host)` signal per component, passed whenever the handler branches on the horizontal pair (direction is scoped, and every CDK overlay pane is its own `[dir]` scope), horizontal `FocusKeyManager`s take the live scoped direction, overlays carry `direction` on their config. See `.claude/rules/rtl.md`
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

### Every project owning specs MUST declare an explicit `test` target

`nx.json` registers `@nx/vitest` with `"testTargetName": "vite:test"`, so the
plugin-**inferred** unit-test target is _not_ called `test` anywhere in this
workspace. Both CI jobs select strictly by target name
(`nx affected -t lint test …` / `nx run-many -t lint test …` in
`.github/workflows/ci.yml`), and nx does no aliasing between the two names — a
project runs in CI only because it hand-declares `test` in its own
`project.json`. Copy the shape its peers use:

```jsonc
"test": {
  "executor": "@nx/vitest:test",
  "options": { "config": "<project-root>/vite.config.mts" }
}
```

- Add `"dependsOn"` when the suite needs generated sources — `apps/docs`
  carries `["extract-api"]`, without which most of its 36 spec files fail at
  module resolution on a fresh clone (`src/generated/api` is git-ignored).
- **Run the suite through `test`, never `vite:test`**, in READMEs, docs and
  local commands: `yarn nx test <project>`. Referencing the inferred name
  teaches the next reader the target CI does not run.
- The `@nx/vitest:test` executor runs with **cwd = workspace root**, while the
  inferred `vite:test` runs from the project root. A spec that reads a source
  file must resolve it from `dirname(fileURLToPath(import.meta.url))`, not
  `process.cwd()`.

Enforced by `scripts/check-test-targets.mjs`, which runs as part of
`@malva-ui/source:test` (a target CI already selects). It attributes every
`*.spec.*` / `*.test.*` file to the innermost project containing it and fails
unless some `test` target actually runs it — an executor-driven or
`vitest`/`jest` target covers its project's specs by glob, while a
`nx:run-commands` target that enumerates files (`node --test a.spec.mjs …`),
or a project with no `test` target at all, must have each of its specs named
verbatim in some `test` command anywhere in the workspace. That last rule is
what keeps the two deliberate cross-project arrangements honest —
`scripts/testing/strip-css-layers.spec.js` runs through the root target and
`scripts/check-padding-tokens.spec.mjs` through `styles:test` — so dropping
either file from the command that runs it fails the check instead of silently
retiring the suite.

Because the guard's answer depends on the shape of the whole workspace, the
root `test` target's `inputs` are workspace-wide globs (`**/project.json`,
`**/package.json`, `**/*.{spec,test}.*`). Do not narrow them to `apps/`+`libs/`:
a project added anywhere else would then be a cache hit and the guard would
never run.

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
- Inline-axis CSS is **logical**: `margin-inline-start`, `inset-inline-end`, `text-align: start`, `border-start-start-radius`, `float: inline-start` — never `margin-left`, `left`, `text-align: left`. Physical `left`/`right` stay only for JS-fed coordinates, `left: 50%` centering pairs and collision-resolved overlay arrows, each with a `// physical: <reason>` comment. `transform`/`transform-origin`/`box-shadow` offsets go through `mixins.inline-distance()` / `--mlv-inline-direction`. See `.claude/rules/rtl.md`.
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

## Style Specs, Cascade Layers and Container Queries

jsdom implements neither `@layer` nor `@container`: it fails with "Could not
parse CSS stylesheet" and drops the **entire** stylesheet, so a
`getComputedStyle` assertion against a component stylesheet that uses either one
silently reads `''` instead of failing loudly. One container query anywhere in a
file is enough to disable every rule in it.

The test environment therefore rewrites CSS on its way into a `<style>` element:
layers are flattened, container queries are **dropped**. The shipped CSS keeps
both.

Dropping is the honest answer for a container query, not a shortcut: jsdom
performs no layout, so no container has a size and no query inside one could
ever match. Hoisting its rules would make them apply unconditionally, which is a
different stylesheet.

| Spec reads…                                | What to do                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Computed styles from an injected `<style>` | Nothing. `scripts/testing/setup-strip-css-layers.js` is a `setupFiles` entry in every `vite.config.mts` and rewrites any CSS entering a `<style>` element.                                                                                                         |
| A **container query's** effect             | Assert on the compiled text instead — jsdom cannot resolve one, so a `getComputedStyle` assertion could only ever be asserting the fallback. `page-header.spec.ts` § _responsive withholding_ is the reference.                                                    |
| Compiled CSS **text** or a PostCSS AST     | Wrap the `sass.compile(...).css` in `stripCssLayersFromText()` from `@malva-ui/internal-testing` — the wrapper's indentation is removed with it, so line anchors hold. It leaves container queries alone, because the spec is asserting on the shipped stylesheet. |
| The `.scss` **source** text                | Nothing — the source is read as written.                                                                                                                                                                                                                           |

`@malva-ui/internal-testing` maps to `scripts/testing/strip-css-layers.js`, and
`@malva-ui/internal-testing/axe` to `scripts/testing/axe.js` (see
`.claude/rules/accessibility.md`). Both are spec-only, never bundled, and
allow-listed in `@nx/enforce-module-boundaries` under the **single** entry
`@malva-ui/internal-testing`. That one entry covers every secondary entry point:
Nx matches `allow` with `matchImportWithWildcard`, whose no-wildcard branch is
`new RegExp(allowableImport).test(extractedImport)` — an unanchored regex test,
not an equality check — so a `/*` sibling would be dead code. Their own tests
run as `nx run @malva-ui/source:test`.

---

## Server-Rendering Specs and the Shared jsdom Window

Vitest reuses **one jsdom window per worker process** — the environment is not
rebuilt between test files. `@angular/platform-server` runs
`Object.assign(globalThis, domino.impl)` when its DOM adapter is made current,
replacing `Event`, `KeyboardEvent`, `HTMLElement` and every other DOM class with
domino's. jsdom brand-checks what it is handed, so from that point on
`element.dispatchEvent(new Event('change'))` throws
`parameter 1 is not of type 'Event'` — in that spec **and in every later file
that shares the worker**.

How many files share a worker depends on the core count, so this reproduces on a
2-core CI runner and passes on a dev machine. Reproduce it locally with
`npx vitest run --config <project>/vite.config.mts --no-file-parallelism`.

`scripts/testing/setup-restore-dom-globals.js` is a `setupFiles` entry in every
`vite.config.mts`: it captures the pristine constructors the first time it loads
in a worker and puts back any that were replaced around every test. Nothing to
do per spec — but keep it in `setupFiles` when adding a project, and prefer
`--no-file-parallelism` when a suite passes locally and fails in CI.

---

## The Test Environment Is Zoneless

The library is zoneless-only. Every component, directive and service is `OnPush`
and signal-based, authored for `provideZonelessChangeDetection()`; `apps/docs`
bootstraps that way, and no suite loads `zone.js`. **There is no zone-based test
mode and no dual-mode run** — do not add `zone.js` to `setupFiles`, and do not
write `provideZoneChangeDetection`, `fakeAsync`, `waitForAsync`,
`NgZone.onStable` or `onMicrotaskEmpty` in a spec. `await fixture.whenStable()`
after a signal write is the pattern that works. That list is enforced, not
advisory: `nx run @malva-ui/source:test` greps every TypeScript spec file for
it.

This is a rule about **specs**, not about library source. `NgZone.runOutsideAngular`
in a component or directive is a separate question — the remaining call sites
are considered and tracked in #37/#13 — and one spec type-imports `NgZone` for a
hand-rolled stub. Neither puts a spec on zone change detection, so neither is
banned.

Every project declares the mode the same way, so one grep tells the whole story:

```ts
// <project>/src/test-setup.ts
setupTestBed({ zoneless: true });
```

The bare `setupTestBed()` is not an accepted spelling even though `zoneless`
defaults to `true` in `@analogjs/vitest-angular` — the point is that the file
says what it means rather than leaving the mode to a third-party default.

**Why it is pinned twice.** Angular's `TestBed` puts
`provideZonelessChangeDetectionInternal()` into its root scope module
unconditionally and `ZONELESS_ENABLED` defaults to `() => true`, so a project
passing `{ zoneless: false }` still resolves `NoopNgZone`, still auto-detects,
and nothing goes red. A wrong declaration is invisible at runtime, and a runtime
that stopped matching a right declaration would be invisible statically. So:

| Guard                                            | Runs as                             | Catches                                                                                                                                                                                          |
| ------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/testing/setup-assert-zoneless.js`       | a `setupFiles` entry, per spec file | the _resolved_ injector: `PROVIDED_ZONELESS`, `ZONELESS_ENABLED`, a real `NgZone`, or a `globalThis.Zone` that something pulled in transitively                                                  |
| `scripts/testing/assert-zoneless-config.spec.js` | `nx run @malva-ui/source:test`      | the _declaration_: a setup that does not say `{ zoneless: true }`, a `vite.config.mts` that does not load the runtime pin at a path that resolves, and a spec reaching for a zone-based test API |

Most of the banned spec APIs already fail loudly without `zone.js` —
`provideZoneChangeDetection()` throws NG0908, `fakeAsync` throws
"zone-testing.js is needed" — so the third check is not what stands between the
suite and a silent pass for those. It matters for the two cases that _are_
silent: `NgZone.onStable` and `onMicrotaskEmpty` resolve to `NoopNgZone`
emitters that **never fire**, so a spec asserting inside such a callback goes
green having run no assertion at all; and a `vite.config.mts` that never lists
the runtime pin is invisible to that pin by construction, so only a static sweep
can find it.

When adding a project, list the pin **after** `src/test-setup.ts` in
`setupFiles` alongside the other two shared entries. The static guard walks the
whole tree, not just `libs/` and `apps/`, so a project added under a new root is
swept too; the root `test` target's `inputs` carry `**/vite.config.mts`,
`**/test-setup.ts` and `**/*.{spec,test}.*` for the same reason.

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

## Versioning and Deprecation

[`VERSIONING.md`](../../VERSIONING.md) is the semver contract: which surfaces are
public, which change requires which bump, and what a removal owes a consumer
first. Consult it before any change that alters a published surface.

- **Public API is not just TypeScript.** Component selectors, `exportAs`, input /
  output / model names and types, exported injection tokens and the shape of
  their values, `--mlv-*` tokens listed in `libs/styles/tokens.md`, BEM class
  names, i18n keys on an `Mlv<X>I18n` interface, published `exports` paths and
  `peerDependencies` ranges are all public. `ViewEncapsulation.None` is mandatory,
  so a BEM class name is the only override handle a consumer has.
- **Not public:** anything outside a published barrel, `@internal` members,
  `_`-prefixed members, `libs/styles` SCSS (mixins, maps, partials — only the
  compiled `malva-ui.css` ships), and DOM structure below the named BEM elements.
- **Declare every package a published entry point imports.** npm installs a
  package's own `dependencies` and `peerDependencies` and nothing else, so a
  bare specifier imported but declared in neither is `Cannot find module` in the
  consumer's build with no install-time signal — and invisible in-repo, because
  every workspace consumer resolves it from the root manifest instead. Use
  `peerDependencies` for a framework the consumer owns exactly one copy of
  (`@angular/*`, `rxjs`, `@malva-ui/*`), `dependencies` for a runtime library the
  package brings its own copy of (`fast-equals`, `sortablejs`), and
  a `0.0.0-*-package-version` placeholder for anything the root manifest pins —
  which needs its mapping in **both** `scripts/publish.mjs` and
  `apps/docs/tools/playground-manifest.ts`. Enforced by
  `scripts/check-package-dependencies.mjs` →
  `yarn nx run @malva-ui/source:check-package-dependencies`, a `dependsOn` of
  the root `test` target. It walks the graph `ng-packagr` compiles — each
  `ng-package.json`'s `lib.entryFile` plus everything it reaches by relative
  import — so a spec, a `vite.config.mts` or an unreachable helper is out of
  scope by construction rather than by a filter. An exception goes in
  `DECLARATION_EXCEPTIONS`, narrowed by package, dependency and file, and says
  whether it is clean or deferred; an entry that matches nothing fails the
  check. #242 is the worked example: `@malva-ui/core` imported `@angular/router`
  in nine entry points and declared no peer for months.
- **Ship and export every asset a consumer is told to import.** ng-packagr
  copies only what `ng-package.json`'s `assets` glob names, generates `exports`
  for TypeScript entry points only, and writes `sideEffects: false` unless the
  source manifest says otherwise — so a stylesheet can be compiled, documented
  and still absent, unresolvable as a bare specifier, or dropped by webpack.
  A new asset owes three edits: the generating target's `outputs`, the `assets`
  glob, and an `exports` pattern (plus a `sideEffects` entry for a stylesheet).
  Enforced by `scripts/check-dist-assets.mjs` →
  `yarn nx run @malva-ui/source:check-dist-assets`, a `dependsOn` of the root
  `test` target that builds every `release.projects` package and checks each
  generated or documented `@malva-ui/<pkg>/<path>` asset against the **built**
  dist through Node's own resolver; `scripts/publish.mjs` repeats it. #310 is
  the worked example: `page-view-transitions.css` never shipped and
  `@import '@malva-ui/core/styles/malva-ui.css'` never resolved.
- **A rename is a removal.** Add the new name in a minor with a working
  `@deprecated` alias; delete the old one in the next major.
- **Changing a default value or default behaviour is breaking** even when nothing
  is renamed, and still needs a `docs/migrations/` entry.
- **Every `@deprecated` tag under `libs/` names both versions** — `since <major.minor>`
  (name the patch too while the line is `0.x`, where the minor identifies no
  release) and `removed in <major>.0`, the removal always landing on a major
  boundary and always still ahead of the version in the root `package.json`.
  Spell the tag lowercase: TypeScript recognises only `@deprecated`, so
  `@DEPRECATED` strikes nothing through and warns no consumer. Enforced by
  `scripts/check-deprecations.mjs` →
  `yarn nx run @malva-ui/source:check-deprecations`, a `dependsOn` of the root
  `test` target. Its inputs mirror the script's traversal (`libs/**/*.{ts,scss,css}`)
  rather than `libs/**/src/**`; narrowing them back would make the target a
  cache hit on the global stylesheet and on `@malva-ui/tailwind`, which it scans.
- **File a deprecating commit as `feat`.** It is the only type `nx.json` maps to
  a minor, and the deprecation window is measured in minors.

---

## Keeping Documentation Current

- After **any** change to a component, directive, service, or public API in a library, update the corresponding `.claude/projects/libs-<name>.md`
- After **any** new route, page, or significant component addition to an app, update `.claude/projects/app-<name>.md`
- After **any** change to conventions or tooling, update this file (`best-practices.md`)
- After editing a `.claude/projects/libs-<name>.md` (or any lib `CLAUDE.md`), run `yarn nx run docs:check-doc-api` — it fails when a documented input/output/model/method is not declared in the extracted API, and warns on declared-but-undocumented members (`--strict` to fail on warnings, `--json` for the raw report)
