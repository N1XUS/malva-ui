# Task 3 — Routed full examples

## Implementation

- Replaced the native Fullscreen API control in `ExampleContainerComponent` with an optional `fullExampleRoute` input and an accessible Malva button-style `RouterLink` labeled **Open full example**.
- Removed fullscreen state, DOM queries, document listeners, API calls, selectors, and maximize/minimize icon imports.
- Added `showcaseRouteForComponent()` to the showcase registry. It returns the first matching showcase route for an exact canonical docs path, or `null`.
- `DocPageComponent` now maps human display headers through an explicit alias map before the registry lookup, retains legacy canonical header inputs, and supplies a route only to its first numbered example.
- Corrected the existing inline nested CSS selector in `DocPageComponent` to valid CSS, avoiding jsdom stylesheet parsing noise in the new component test.

## Files changed

- `apps/docs/src/app/shared/example-container/example-container.component.ts`
- `apps/docs/src/app/shared/example-container/example-container.component.spec.ts`
- `apps/docs/src/app/shared/doc-page/doc-page.component.ts`
- `apps/docs/src/app/shared/doc-page/doc-page.component.spec.ts`
- `apps/docs/src/app/showcases/showcase.registry.ts`
- `apps/docs/src/app/showcases/showcase.registry.spec.ts`

## TDD evidence

### RED

`NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/shared/example-container/example-container.component.spec.ts src/app/shared/doc-page/doc-page.component.spec.ts src/app/showcases/showcase.registry.spec.ts`

Failed as intended before production changes:

- `fullExampleRoute` was not an input and no expansion link rendered.
- `DocPageComponent` did not pass a contextual route to the first aliased example.
- `showcaseRouteForComponent` did not exist.
- The source guard found native fullscreen API usage.

### GREEN

`NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/shared/example-container/example-container.component.spec.ts src/app/shared/doc-page/doc-page.component.spec.ts src/app/showcases/showcase.registry.spec.ts`

Passed: 3 files, 11 tests. Coverage includes registered/unregistered links, a normal RouterLink, first-example-only behavior, display-header aliasing, canonical registry lookup, missing routes, and a source guard for fullscreen API removal.

## Verification

- `yarn nx typecheck docs` — passed.
- `git diff --check` — passed with no whitespace errors.
- Scoped production source inspection confirmed no `requestFullscreen`, `exitFullscreen`, `fullscreenchange`, fullscreen selectors, or maximize/minimize imports remain in `ExampleContainerComponent`.

## Self-review

- Registry inventories remain canonical docs path strings; the display-header map is isolated in `DocPageComponent` and runs before lookup.
- The contextual route resolves once as a computed signal and is supplied only when `$index === 0`; unregistered headers resolve to `null`.
- The new control is a semantic anchor with Angular `RouterLink`, visible text, and a decorative Lucide icon; it has no custom keyboard behavior or fullscreen side effects.
- The scoped diff contains no unrelated files or generated artifacts.

## Concerns

- The focused Vitest run retains existing Vite warnings about dynamic example imports and example files outside the TypeScript program, plus existing Nx Vite-plugin deprecation notices. The tests and docs typecheck pass despite those pre-existing warnings.

## Fix Round 1

### Changes

- Updated `apps/docs/CLAUDE.md` so the shared-component reference describes `fullExampleRoute: string | null`, the normal **Open full example** RouterLink, its absence when the route is null, and `DocPageComponent`'s first-example-only contextual routing.
- Removed the obsolete native Fullscreen API description.

### Verification

```sh
rg -qF 'readonly fullExampleRoute = input<string | null>(null);' apps/docs/src/app/shared/example-container/example-container.component.ts
rg -qF 'normal Malva button-style `RouterLink`' apps/docs/CLAUDE.md
rg -qF '`fullExampleRoute: string | null`' apps/docs/CLAUDE.md
rg -qF 'only to the first numbered `ExampleContainerComponent`' apps/docs/CLAUDE.md
! rg -q 'native Fullscreen API\|fullscreen button' apps/docs/CLAUDE.md
git diff --check
```

Passed: the source and documentation agree on the nullable route input, RouterLink behavior, null-state control omission, and first-example-only routing; the obsolete fullscreen description is absent and the diff has no whitespace errors.
