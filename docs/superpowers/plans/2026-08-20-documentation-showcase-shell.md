# Documentation and Showcase Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one shared Malva app bar, a dedicated full-size showcase route tree and catalog, normal-route example expansion, and an explicitly supported Page shell with two start sidebars and one end inspector.

**Architecture:** The existing Angular `docs` app keeps three route experiences: homepage, reference docs, and `/showcases`. `DocsAppBar` owns the brand, exactly two primary pill links, and global preferences; `DocsShellComponent` and `ShowcaseShellComponent` compose it around different content. A typed showcase registry drives both child routes and the screenshot catalog, while `MlvPageShell` formalizes repeated start-sidebar projection without numbered slot APIs.

**Tech Stack:** Angular 22 standalone components and signals, Angular Router, Nx 23, Malva Action Bar/Segmented/Page/Sidebar/Button/Popup/Select, Lucide icons, SCSS BEM, Vitest/jsdom, in-app Browser screenshots.

**Spec:** `docs/superpowers/specs/2026-08-20-documentation-showcases-design.md`

## Global Constraints

- The shared primary navigation contains exactly `Docs` and `Showcases`; `Docs` is active outside `/showcases`, and `Showcases` is active for `/showcases` descendants.
- Showcase routes render only the shared app bar and showcase content: no docs navigation sidebar and no docs table of contents.
- Never call `requestFullscreen()`, `exitFullscreen()`, or click a native fullscreen control; full examples use normal Angular routes.
- Use `mlv-segmented` for showcase categories and persist the selected category as `?category=`.
- Use only existing Malva tokens and Lucide icons; do not draw replacement icons or artwork in CSS/SVG.
- Every docs component uses `ChangeDetectionStrategy.OnPush`; library Page changes also use `ViewEncapsulation.None`, BEM, signal APIs, `host`, `inject()`, and complete public JSDoc.
- Run docs tests with `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- <spec path>` and Page tests with `yarn nx test core-page`.
- Run `yarn nx run styles:check-padding-tokens`, `yarn nx lint docs`, `yarn nx lint core-page`, `yarn nx typecheck docs`, and `yarn nx build docs` before the final commit.

---

### Task 1: Extract the shared app bar and global preferences

**Files:**

- Create: `apps/docs/src/app/shared/docs-app-bar/docs-app-bar.ts`
- Create: `apps/docs/src/app/shared/docs-app-bar/docs-app-bar.html`
- Create: `apps/docs/src/app/shared/docs-app-bar/docs-app-bar.scss`
- Create: `apps/docs/src/app/shared/docs-app-bar/docs-app-bar.spec.ts`
- Create: `apps/docs/src/app/shared/docs-app-bar/docs-app-bar-preferences.ts`
- Create: `apps/docs/src/app/shared/docs-app-bar/docs-app-bar-preferences.html`
- Create: `apps/docs/src/app/shared/docs-app-bar/docs-app-bar-preferences.scss`
- Create: `apps/docs/src/app/shared/docs-app-bar/docs-app-bar-preferences.spec.ts`
- Move: `apps/docs/src/app/shared/docs-shell/docs-locales.ts` → `apps/docs/src/app/shared/docs-app-bar/docs-locales.ts`
- Move: `apps/docs/src/app/shared/docs-shell/docs-locales.spec.ts` → `apps/docs/src/app/shared/docs-app-bar/docs-locales.spec.ts`
- Modify: `apps/docs/src/app/shared/index.ts`
- Modify: `apps/docs/src/app/shared/docs-shell/docs-shell.ts`
- Modify: `apps/docs/src/app/shared/docs-shell/docs-shell.html`
- Modify: `apps/docs/src/app/shared/docs-shell/docs-shell.scss`
- Modify: `apps/docs/src/app/shared/docs-shell/docs-shell.spec.ts`
- Modify: `apps/docs/src/app/pages/home/home.ts`
- Modify: `apps/docs/src/app/pages/home/home.html`
- Modify: `apps/docs/src/app/pages/home/home.scss`
- Modify: `apps/docs/src/app/pages/home/home.spec.ts`

**Interfaces:**

- Produces: `DocsAppBarComponent` with computed `docsActive` / `showcasesActive` route state and identical content on homepage, docs, and showcases.
- Owns: brand, primary links, GitHub link, and a focused `DocsAppBarPreferencesComponent` child.
- `DocsAppBarPreferencesComponent` owns theme mode, density, locale, recoverable locale-loading status, and the popup currently implemented in `DocsShellComponent`.
- Consumes: `MlvThemeService`, `MlvDensityService`, `MlvI18nService`, `DOCS_LOCALE_CODES`, `DOCS_LOCALE_METADATA`, and `docsLocaleToOption`.

- [ ] **Step 1: Write the shared app-bar contract tests**

Create `docs-app-bar.spec.ts` with `RouterTestingHarness`, Malva testing providers, and these assertions:

```ts
it('renders exactly the Docs and Showcases primary links', async () => {
  const { root } = await renderAt('/button');
  const links = [...root.querySelectorAll<HTMLAnchorElement>('.docs-app-bar__primary a')];
  expect(links.map((link) => link.textContent?.trim())).toEqual(['Docs', 'Showcases']);
});

it.each([
  ['/', 'Docs'],
  ['/button', 'Docs'],
  ['/showcases', 'Showcases'],
  ['/showcases/data-operations', 'Showcases'],
])('marks the correct destination active at %s', async (url, label) => {
  const { root } = await renderAt(url);
  const active = root.querySelector('.mlv-segmented-item--active');
  expect(active?.textContent?.trim()).toBe(label);
  expect(active?.getAttribute('aria-current')).toBe('page');
});

it('provides one semantic header and a skip link', async () => {
  const { root } = await renderAt('/button');
  expect(root.querySelectorAll('header')).toHaveLength(1);
  expect(root.querySelector('a[href="#main-content"]')?.textContent?.trim())
    .toBe('Skip to content');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/shared/docs-app-bar/docs-app-bar.spec.ts
```

Expected: FAIL because `DocsAppBarComponent` and its template do not exist.

- [ ] **Step 3: Move the preference state without changing behavior**

Move locale metadata and the existing theme/density/locale signals and handlers from `DocsShellComponent` into `DocsAppBarPreferencesComponent`. Keep the same persisted service APIs. Define app-bar route activity as:

```ts
private readonly _router = inject(Router);
private readonly _url = toSignal(
  this._router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(() => this._router.url),
  ),
  { initialValue: this._router.url },
);

readonly showcasesActive = computed(() => {
  const path = this._url().split(/[?#]/, 1)[0];
  return path === '/showcases' || path.startsWith('/showcases/');
});
readonly docsActive = computed(() => !this.showcasesActive());
```

- [ ] **Step 4: Build the exact shared action-bar structure**

Use this semantic skeleton in `docs-app-bar.html`; move the existing preference popup markup into the trailing group unchanged apart from BEM names:

```html
<header class="docs-app-bar">
  <a class="docs-app-bar__skip-link" href="#main-content">Skip to content</a>
  <nav mlvActionBar fixed aria-label="Primary">
    <a mlvActionBarLogo routerLink="/">
      <img ngSrc="/malva-ui-logo.png" width="37" height="40" priority alt="" />
      <span class="docs-app-bar__brand">Malva UI</span>
    </a>
    <mlv-segmented class="docs-app-bar__primary" ariaLabel="Documentation areas">
      <a mlvSegmentedItem routerLink="/" [active]="docsActive()">Docs</a>
      <a mlvSegmentedItem routerLink="/showcases" [active]="showcasesActive()">Showcases</a>
    </mlv-segmented>
    <div mlvActionBarSpacer></div>
    <div class="docs-app-bar__global-controls" role="group" aria-label="Display preferences">
      <a mlvButton shape="square" variant="transparent" href="https://github.com/N1XUS/malva-ui"
        target="_blank" rel="noopener noreferrer" aria-label="View Malva UI on GitHub (opens in a new tab)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </a>
      <docs-app-bar-preferences />
    </div>
  </nav>
</header>
```

`docs-app-bar-preferences.html` receives the complete current Settings trigger and Theme/Density/Language popup nodes from `docs-shell.html`; preserve their controls, labels, focus behavior, and handlers while changing only BEM names.

- [ ] **Step 5: Replace both existing headers with `docs-app-bar`**

In `DocsShellComponent`, retain sidebar/query/ToC state and place its labelled mobile navigation trigger at the start of the docs content row below the shared app bar. Remove preference imports, services, signals, handlers, and duplicated styles. In `HomePageComponent`, remove its custom header and theme actions, import `DocsAppBarComponent`, and render it before the existing homepage `main`. Give the existing docs-shell and homepage main elements `id="main-content"` so the shared skip link always has one target.

- [ ] **Step 6: Add responsive app-bar styling**

Implement these stable layout rules in `docs-app-bar.scss`:

```scss
$block: docs-app-bar;

.#{$block} {
  --mlv-docs-app-bar-height: 4rem;

  &__global-controls {
    display: inline-flex;
    align-items: center;
    gap: var(--mlv-spacing-2);
  }

  &__primary {
    margin-inline-start: var(--mlv-spacing-6);
  }

  &__brand { white-space: nowrap; }

  &__skip-link {
    position: fixed;
    inset-block-start: var(--mlv-spacing-2);
    inset-inline-start: var(--mlv-spacing-2);
    z-index: 100;
    transform: translateY(-200%);

    &:focus { transform: translateY(0); }
  }
}

@media (max-width: 47.999rem) {
  .#{$block} {
    &__brand { display: none; }
    &__primary { margin-inline-start: var(--mlv-spacing-2); }
  }
}
```

- [ ] **Step 7: Run focused and existing shell/home tests**

Run:

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/shared/docs-app-bar/docs-app-bar.spec.ts src/app/shared/docs-app-bar/docs-locales.spec.ts src/app/shared/docs-shell/docs-shell.spec.ts src/app/pages/home/home.spec.ts
```

Expected: PASS with one shared app bar and no duplicated global-preference state.

- [ ] **Step 8: Commit the shared app bar**

```bash
git add apps/docs/src/app/shared apps/docs/src/app/pages/home
git commit -m "feat(docs): share the primary app bar"
```

---

### Task 2: Add the showcase registry, shell, index, and walking-skeleton routes

**Files:**

- Create: `apps/docs/src/app/showcases/showcase.types.ts`
- Create: `apps/docs/src/app/showcases/showcase.registry.ts`
- Create: `apps/docs/src/app/showcases/showcase.registry.spec.ts`
- Create: `apps/docs/src/app/showcases/showcase-shell/showcase-shell.ts`
- Create: `apps/docs/src/app/showcases/showcase-shell/showcase-shell.html`
- Create: `apps/docs/src/app/showcases/showcase-shell/showcase-shell.scss`
- Create: `apps/docs/src/app/showcases/showcase-shell/showcase-shell.spec.ts`
- Create: `apps/docs/src/app/showcases/showcase-index/showcase-index.ts`
- Create: `apps/docs/src/app/showcases/showcase-index/showcase-index.html`
- Create: `apps/docs/src/app/showcases/showcase-index/showcase-index.scss`
- Create: `apps/docs/src/app/showcases/showcase-index/showcase-index.spec.ts`
- Create: `apps/docs/src/app/showcases/pages/project-workspace/project-workspace.ts`
- Create: `apps/docs/src/app/showcases/pages/support-inbox/support-inbox.ts`
- Create: `apps/docs/src/app/showcases/pages/publishing-workspace/publishing-workspace.ts`
- Create: `apps/docs/src/app/showcases/pages/data-operations/data-operations.ts`
- Create: `apps/docs/src/app/showcases/pages/settings-access/settings-access.ts`
- Create: `apps/docs/public/showcases/README.md`
- Modify: `apps/docs/src/app/app.routes.ts`
- Modify: `apps/docs/src/app/app.routes.spec.ts`

**Interfaces:**

- Produces: `ShowcaseCategory`, `ShowcaseDefinition`, `SHOWCASE_CATEGORIES`, `SHOWCASES`, `showcaseRoutes`, and `showcasesForComponent(componentName)`.
- Route slugs: `project-workspace`, `support-inbox`, `publishing-workspace`, `data-operations`, `settings-access`.
- Query values: `all`, `workspaces`, `communication`, `data`, `content`, `settings`.

- [ ] **Step 1: Write registry and route-contract tests**

```ts
it('defines five unique showcase routes', () => {
  expect(SHOWCASES.map((item) => item.slug)).toEqual([
    'project-workspace',
    'support-inbox',
    'publishing-workspace',
    'data-operations',
    'settings-access',
  ]);
  expect(new Set(SHOWCASES.map((item) => item.slug)).size).toBe(5);
});

it('derives showcase child routes from the same registry', () => {
  expect(showcaseRoutes.map((route) => route.path)).toEqual([
    '',
    ...SHOWCASES.map((item) => item.slug),
  ]);
});
```

Extend `app.routes.spec.ts` to assert `/showcases` is outside the docs-shell children and has `ShowcaseShellComponent` as its lazy shell. In `showcase-shell.spec.ts`, provide a controllable `Router.events` subject and assert that `RouteConfigLoadStart` renders an `aria-busy="true"` loading surface while `RouteConfigLoadEnd` removes it without adding a second app bar.

- [ ] **Step 2: Run registry/route tests and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/showcase.registry.spec.ts src/app/app.routes.spec.ts
```

Expected: FAIL because the showcase registry and route tree are absent.

- [ ] **Step 3: Define the registry contract and exact catalog data**

```ts
export type ShowcaseCategory =
  | 'workspaces'
  | 'communication'
  | 'data'
  | 'content'
  | 'settings';

export interface ShowcaseDefinition {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly category: ShowcaseCategory;
  readonly componentNames: readonly string[];
  readonly previewAsset: string | null;
  readonly loadComponent: () => Promise<unknown>;
}

export const SHOWCASE_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'workspaces', label: 'Workspaces' },
  { value: 'communication', label: 'Communication' },
  { value: 'data', label: 'Data' },
  { value: 'content', label: 'Content' },
  { value: 'settings', label: 'Settings' },
] as const;
```

Populate `SHOWCASES` with outcome-focused summaries, route component loaders, component inventories from the approved spec, and `previewAsset: null`. The composed-showcase plan replaces each null with its route-derived `/showcases/<slug>.png`; until then, cards render their text without a fake image surface.

- [ ] **Step 4: Build `ShowcaseShellComponent`**

Use one `docs-app-bar`, a route-loading surface, and one nested outlet. In the component, subscribe to `Router.events` through `takeUntilDestroyed()`; set `routeLoading` to `true` for `RouteConfigLoadStart` and `false` for `RouteConfigLoadEnd`:

```html
<div class="showcase-shell">
  <docs-app-bar />
  @if (routeLoading()) {
    <main class="showcase-shell__loading" id="main-content" aria-busy="true" aria-label="Loading showcase">
      <div class="showcase-shell__loading-header" aria-hidden="true"></div>
      <div class="showcase-shell__loading-grid" aria-hidden="true">
        <div></div><div></div><div></div><div></div>
      </div>
    </main>
  }
  <router-outlet />
</div>
```

Keep the outlet mounted so the lazy child completes normally. Style the loading surface with the same width, spacing, two-column geometry, and neutral token surfaces as the index; use the existing Malva pulse animation token and respect `prefers-reduced-motion`. Do not import `DocsShellComponent`, `MlvSidebar`, or `DocsTableOfContentsComponent`.

- [ ] **Step 5: Build category parsing and the index grid**

Use a signal derived from `ActivatedRoute.queryParamMap`; invalid values resolve to `all`. Update the URL with `queryParamsHandling="merge"` and `replaceUrl: true`. The index template must use:

```html
<main class="showcase-index" id="main-content">
  <header class="showcase-index__header">
    <p class="showcase-index__eyebrow">Built with Malva UI</p>
    <h1>Showcases</h1>
    <p>Full-size product compositions that show how the library works together.</p>
  </header>
  <mlv-segmented class="showcase-index__categories" ariaLabel="Showcase categories">
    @for (category of categories; track category.value) {
      <a mlvSegmentedItem [routerLink]="[]" [queryParams]="{ category: category.value }"
        [active]="activeCategory() === category.value">{{ category.label }}</a>
    }
  </mlv-segmented>
  <div class="showcase-index__grid">
    @for (showcase of visibleShowcases(); track showcase.slug) {
      <article class="showcase-index__card">
        <a [routerLink]="['/showcases', showcase.slug]" [attr.aria-label]="'Open ' + showcase.title + ' showcase'">
          @if (showcase.previewAsset; as previewAsset) {
            <img [ngSrc]="previewAsset" width="1600" height="1000" alt="" />
          }
          <h2>{{ showcase.title }}</h2>
          <p>{{ showcase.summary }}</p>
        </a>
      </article>
    }
  </div>
</main>
```

- [ ] **Step 6: Add route components with stable semantic canvases**

Each initial route component must compile and render its final route title in a single `main`, for example:

```ts
@Component({
  selector: 'app-data-operations-showcase',
  template: `<main class="data-operations-showcase" id="main-content"><h1>Data Operations</h1></main>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataOperationsShowcaseComponent {}
```

The composed-showcase plan expands these same files; do not create disposable alternate routes.

- [ ] **Step 7: Add deterministic catalog styling and screenshot asset contract**

Use a `minmax(0, 1fr)` two-column grid above `64rem`, one column below, `aspect-ratio: 8 / 5`, `object-fit: cover`, tokenized borders/backgrounds, and no card shadow until hover/focus. `apps/docs/public/showcases/README.md` records `1600×1000`, light theme, animations settled, and route-derived screenshots as the asset contract.

- [ ] **Step 8: Run index, route, accessibility, and build tests**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/showcase.registry.spec.ts src/app/showcases/showcase-shell/showcase-shell.spec.ts src/app/showcases/showcase-index/showcase-index.spec.ts src/app/app.routes.spec.ts
yarn nx typecheck docs
yarn nx build docs
```

Expected: five routes lazy-load, categories are linkable, invalid categories resolve to All, and the index contains one `main`.

- [ ] **Step 9: Commit the showcase route system**

```bash
git add apps/docs/src/app/showcases apps/docs/src/app/app.routes.ts apps/docs/src/app/app.routes.spec.ts apps/docs/public/showcases
git commit -m "feat(docs): add full-size showcase routes"
```

---

### Task 3: Replace native fullscreen with routed full examples

**Files:**

- Modify: `apps/docs/src/app/shared/example-container/example-container.component.ts`
- Modify: `apps/docs/src/app/shared/example-container/example-container.component.spec.ts`
- Modify: `apps/docs/src/app/shared/doc-page/doc-page.component.ts`
- Create: `apps/docs/src/app/shared/doc-page/doc-page.component.spec.ts`
- Modify: `apps/docs/src/app/showcases/showcase.registry.ts`

**Interfaces:**

- Produces: `ExampleContainerComponent.fullExampleRoute = input<string | null>(null)`.
- Produces: `showcaseRouteForComponent(componentName: string): string | null`.
- `DocPageComponent` passes a route only to the first numbered example on a page.

- [ ] **Step 1: Replace fullscreen tests with route-link tests**

```ts
it('renders no expansion control without a registered route', () => {
  const { fixture } = createFixture();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.example-container__open-full')).toBeNull();
});

it('renders a normal router link for a registered full example', () => {
  const { fixture } = createFixture();
  fixture.componentRef.setInput('fullExampleRoute', '/showcases/data-operations');
  fixture.detectChanges();
  const link = fixture.nativeElement.querySelector('.example-container__open-full');
  expect(link.textContent).toContain('Open full example');
  expect(link.getAttribute('href')).toContain('/showcases/data-operations');
});
```

Add a source guard that reads `example-container.component.ts` and expects no `requestFullscreen`, `exitFullscreen`, or `fullscreenchange` substring.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/shared/example-container/example-container.component.spec.ts src/app/shared/doc-page/doc-page.component.spec.ts
```

Expected: FAIL because the route input/link do not exist and native fullscreen code remains.

- [ ] **Step 3: Delete native fullscreen state and render a normal link**

Remove `DOCUMENT`, fullscreen signals/listeners, element queries, `toggleFullscreen()`, fullscreen selectors, and maximize/minimize imports. Add `RouterLink`, `LucideExternalLink`, and:

```html
@if (fullExampleRoute(); as route) {
  <a class="example-container__open-full" mlvButton variant="transparent" [routerLink]="route">
    <svg mlvButtonIcon lucideExternalLink [size]="16" aria-hidden="true" />
    Open full example
  </a>
}
```

- [ ] **Step 4: Resolve the first contextual showcase from the registry**

Add:

```ts
readonly showcaseRoute = computed(() =>
  showcaseRouteForComponent(this.header() ?? ''),
);
```

Inside the example loop bind:

```html
[fullExampleRoute]="$index === 0 ? showcaseRoute() : null"
```

The registry helper returns the first `SHOWCASES` item whose `componentNames` includes the docs header and otherwise returns `null`.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/shared/example-container/example-container.component.spec.ts src/app/shared/doc-page/doc-page.component.spec.ts
```

Expected: PASS, and static source inspection confirms there is no browser-fullscreen API.

- [ ] **Step 6: Commit routed example expansion**

```bash
git add apps/docs/src/app/shared apps/docs/src/app/showcases/showcase.registry.ts
git commit -m "fix(docs): open complex examples as routes"
```

---

### Task 4: Formalize two start sidebars and one end inspector in Page shell

**Files:**

- Modify: `libs/core/page/src/lib/page-shell/page-shell.spec.ts`
- Modify: `libs/core/page/src/lib/page-shell/page-shell.scss`
- Modify: `libs/core/page/CLAUDE.md`
- Modify: `apps/docs/src/app/pages/page/examples/2/index.html`
- Modify: `apps/docs/src/app/pages/page/examples/2/index.scss`
- Modify: `apps/docs/src/app/pages/page/examples/2/index.spec.ts`

**Interfaces:**

- Preserves: repeated `[mlvPageSidebar]` projection in DOM order.
- Preserves: one optional `[mlvPageEndSidebar]` after the content track.
- Adds no numbered sidebar selectors and no column-count input.

- [ ] **Step 1: Write a projection and geometry test**

```ts
@Component({
  imports: [MlvPageShell, MlvPageSidebar, MlvPageEndSidebar],
  template: `<mlv-page-shell>
    <nav mlvPageSidebar data-slot="rail"></nav>
    <nav mlvPageSidebar data-slot="navigation"></nav>
    <main data-slot="content"></main>
    <aside mlvPageEndSidebar data-slot="inspector"></aside>
  </mlv-page-shell>`,
})
class MultiSidebarHost {}

it('projects two start sidebars before content and one inspector after it', () => {
  const body = fixture.nativeElement.querySelector('.mlv-page-shell__body');
  expect([...body.children].map((node: Element) => node.getAttribute('data-slot')))
    .toEqual(['rail', 'navigation', null, 'inspector']);
  expect(body.children[2].classList).toContain('mlv-page-shell__content');
});
```

- [ ] **Step 2: Run Page tests and verify RED on the documented styling contract**

```bash
yarn nx test core-page
```

Expected: the new adjacent-sidebar style assertions fail before the CSS contract is added.

- [ ] **Step 3: Add stable adjacent-sidebar CSS**

Inside `.mlv-page-shell__body`, keep the content track `flex: 1 1 auto; min-width: 0`. Add tokenized separators without wrapping projected hosts:

```scss
> [mlvPageSidebar] {
  flex: 0 0 auto;
  min-width: 0;
}

> [mlvPageSidebar] + [mlvPageSidebar] {
  border-inline-start: var(--mlv-stroke-width) solid
    color-mix(in srgb, currentColor 16%, transparent);
}

> [mlvPageEndSidebar] {
  flex: 0 0 auto;
  min-width: 0;
}
```

- [ ] **Step 4: Upgrade the Page reference example**

Change Page example 2 to render an icon rail and expanded navigation before the central canvas plus a labelled end inspector. Add controls that independently collapse navigation and inspector, and a test asserting DOM order and focusable reopen controls.

- [ ] **Step 5: Document the supported projection contract**

Update `libs/core/page/CLAUDE.md` to state: zero to two repeated start sidebars, DOM order defines visual/reading order, one end sidebar, each host owns width/collapse/off-canvas mode, and the central content track remains `min-width: 0`.

- [ ] **Step 6: Verify Page, docs example, style tokens, and lint**

```bash
yarn nx test core-page
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/pages/page/examples/2/index.spec.ts
yarn nx run styles:check-padding-tokens
yarn nx lint core-page
```

Expected: PASS with two start sidebars and one end inspector at normal route scale.

- [ ] **Step 7: Commit the Page composition contract**

```bash
git add libs/core/page apps/docs/src/app/pages/page/examples/2
git commit -m "feat(page): support composed multi-sidebar shells"
```

---

### Task 5: Complete shell documentation and regression verification

**Files:**

- Modify: `apps/docs/CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-20-documentation-showcases-design.md` only if implementation names differ from the approved contract

**Interfaces:**

- Records the shared app bar, showcase route manifest, screenshot contract, and routed example behavior as current implementation.

- [ ] **Step 1: Update project documentation**

Document exact directories, public route slugs, query values, shared-app-bar ownership, the no-native-fullscreen rule, and preview image dimensions in `apps/docs/CLAUDE.md`. Update the root project index only if project names or descriptions changed.

- [ ] **Step 2: Run the complete shell verification set**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test
yarn nx test core-page
yarn nx run styles:check-padding-tokens
yarn nx lint docs
yarn nx lint core-page
yarn nx typecheck docs
yarn nx build docs
```

Expected: every command exits 0.

- [ ] **Step 3: Inspect the routes in the in-app Browser without fullscreen**

Serve with `yarn nx run docs:serve`, then inspect `/`, `/button`, `/showcases`, and `/showcases/project-workspace`. Verify the same app bar, correct active pill, no docs sidebar on showcases, keyboard focus rings, one main landmark, and no browser-fullscreen control.

- [ ] **Step 4: Commit documentation and verification adjustments**

```bash
git add AGENTS.md apps/docs/CLAUDE.md docs/superpowers/specs/2026-08-20-documentation-showcases-design.md
git commit -m "docs(docs): document the showcase shell"
```
