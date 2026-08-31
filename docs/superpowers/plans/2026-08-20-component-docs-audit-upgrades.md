# Component Documentation Audit Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved audit response to all 82 component routes and the seven clicked/open states, then recapture the complete evidence set without using native fullscreen.

**Architecture:** A typed audit-treatment registry gives every docs route one explicit response and connects it to relevant full-size showcases. Healthy reference pages retain their API/state coverage and gain context through shared `DocPageComponent`; weak first examples are selectively rewritten at normal scale. Overlay and target-size refinements live in their owning libraries, while a fresh screenshot inventory proves the combined result.

**Tech Stack:** Angular 22 docs app, Malva component libraries, Nx 23, Vitest/jsdom, axe-core, SCSS BEM, in-app Browser screenshot capture.

**Spec:** `docs/superpowers/specs/2026-08-20-documentation-showcases-design.md`

## Global Constraints

- Every one of the 82 `docsPages` paths appears exactly once in the treatment registry; the seven open states have explicit automated/manual checks.
- Reference docs remain API-oriented; contextual links and focused slices connect them to full-size showcases rather than embedding whole applications.
- Do not use or click `ExampleContainer` native fullscreen. The Browser stays in its normal window at every viewport.
- Open-state examples reserve enough canvas for their overlay and visibly keep top feedback below the shared app bar.
- Do not regress public APIs for components classified healthy; make additive API changes only where this plan names one.
- Use actual Malva components, real content, repository images, and Lucide icons; no fake controls, CSS drawings, emoji icons, or arbitrary raw colors.
- Run affected library tests/lint, docs tests/lint/typecheck/build, `styles:check-padding-tokens`, API extraction checks, axe checks, and the full route screenshot pass.

---

### Task 1: Add typed treatment coverage and contextual showcase links for all routes

**Files:**

- Create: `apps/docs/src/app/component-audit-treatments.ts`
- Create: `apps/docs/src/app/component-audit-treatments.spec.ts`
- Modify: `apps/docs/src/app/shared/doc-page/doc-page.component.ts`
- Modify: `apps/docs/src/app/shared/doc-page/doc-page.component.spec.ts`
- Modify: `apps/docs/src/app/showcases/showcase.registry.ts`

**Interfaces:**

- Produces: `DocsAuditTreatment = 'retain' | 'contextualize' | 'refine' | 'open-state'`.
- Produces: `DOCS_AUDIT_TREATMENTS: Readonly<Record<DocsPagePath, DocsAuditTreatment>>`.
- Produces: `showcasesForComponent(componentName)` and a “Used in” link group after the page description.

- [ ] **Step 1: Write complete coverage tests**

```ts
it('assigns exactly one treatment to every documentation route', () => {
  expect(Object.keys(DOCS_AUDIT_TREATMENTS).sort()).toEqual(
    docsPages.map(page => page.path).sort(),
  );
});

it('links every composed component to a registered showcase', () => {
  for (const page of docsPages) {
    if (DOCS_AUDIT_TREATMENTS[page.path] === 'contextualize') {
      expect(showcasesForComponent(page.path).length).toBeGreaterThan(0);
    }
  }
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/component-audit-treatments.spec.ts src/app/shared/doc-page/doc-page.component.spec.ts
```

Expected: FAIL because the registry and Used in group are missing.

- [ ] **Step 3: Define the exhaustive path set**

Use these exact keys once across the treatment record:

```ts
export const AUDITED_DOC_PATHS = [
  'accessibility', 'accordion', 'action-bar', 'animated-presence', 'alert',
  'avatar', 'avatar-group', 'badge', 'bottom-nav', 'chip', 'breadcrumb',
  'button', 'button-group', 'button-split', 'button-toggle', 'input',
  'number-input', 'empty-state', 'expand', 'form', 'form-field', 'filter',
  'select', 'autocomplete', 'combobox', 'copy-to-clipboard', 'data-table',
  'search-field', 'segmented', 'tokenizer', 'checkbox', 'color-picker',
  'radio', 'rating', 'calendar', 'day-picker', 'date-range-picker', 'density',
  'dropdown', 'editor', 'editor-ai', 'divider', 'popup', 'link', 'dialog',
  'drawer', 'list', 'scrollbar', 'sidebar', 'page', 'skeleton', 'slider',
  'split-pane', 'status-indicator', 'chat', 'stepper', 'timeline', 'toolbar',
  'tooltip', 'switch', 'card', 'tabs', 'title', 'loader', 'menu',
  'notification', 'pagination', 'pin-input', 'progress', 'toast', 'textarea',
  'time-picker', 'tile', 'tree', 'file-upload', 'kbd', 'infinite-scroll',
  'internationalization', 'layout', 'overlay', 'theming', 'utils',
] as const satisfies readonly DocsPagePath[];
```

Assign treatments in this precedence order so each key receives one value: `open-state` for autocomplete, color-picker, date-range-picker, dropdown, popup, dialog, drawer, menu, tooltip, notification, toast, and time-picker; `refine` for action-bar, empty-state, copy-to-clipboard, calendar, list, loader, pagination, and tile; `contextualize` for every still-unassigned component used by a registered showcase; `retain` for the remaining healthy reference/foundation pages. Store canonical docs route paths in each showcase's `componentNames`, so `showcasesForComponent(page.path)` performs an exact typed match rather than label normalization.

- [ ] **Step 4: Render named Used in links**

In `DocPageComponent`, derive `relatedShowcases` from `header()`. Render only when non-empty:

```html
<nav class="doc-page__showcases" aria-label="Composed examples">
  <span>Used in</span>
  @for (showcase of relatedShowcases(); track showcase.slug) {
    <a mlvLink [routerLink]="['/showcases', showcase.slug]">{{ showcase.title }}</a>
  }
</nav>
```

The group is excluded from ToC headings and appears before Examples/API tabs.

- [ ] **Step 5: Run coverage/link tests and commit**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/component-audit-treatments.spec.ts src/app/shared/doc-page/doc-page.component.spec.ts
git add apps/docs/src/app/component-audit-treatments* apps/docs/src/app/shared/doc-page apps/docs/src/app/showcases/showcase.registry.ts
git commit -m "docs(audit): map every component to its treatment"
```

---

### Task 2: Rewrite weak first examples with realistic hierarchy

**Files:**

- Modify: `apps/docs/src/app/pages/action-bar/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/empty-state/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/copy-to-clipboard/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/dropdown/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/list/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/sidebar/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/split-pane/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/toolbar/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/card/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/loader/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/pagination/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/pin-input/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/tile/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/file-upload/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Create: `apps/docs/src/app/pages/reference-first-examples.spec.ts`

**Interfaces:**

- Every listed route answers “what is it?” in its first viewport using normal-scale content and at least one meaningful action/state.

- [ ] **Step 1: Write first-example source contracts**

Create a parameterized test that dynamically imports every listed `examples/1/index.ts`, expects a default Angular component, reads the HTML/MDX source, and rejects `Item 1`, `Lorem`, empty button labels, and raw introductory markup.

```ts
it.each(FIRST_EXAMPLE_ROUTES)('%s has meaningful first-example copy', async route => {
  const html = await readExampleSource(route, 'html');
  expect(html).not.toMatch(/Item 1|Lorem ipsum|Click me/);
  expect(html.trim().length).toBeGreaterThan(80);
});
```

- [ ] **Step 2: Run the source contracts and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/pages/reference-first-examples.spec.ts
```

Expected: at least Action Bar, Empty State, Copy to Clipboard, and Dropdown fail the meaningful-content contract.

- [ ] **Step 3: Replace the first examples with these exact contexts**

| Route | First-example composition |
| --- | --- |
| Action Bar | Malva brand, page breadcrumbs, search, two actions, preferences icon; no empty center. |
| Empty State | Filtered accounts result with title, explanation, Clear filters, and Create account. |
| Copy to Clipboard | API key and install command rows with copied state and keyboard activation. |
| Dropdown | Open project-status panel with grouped options, icons, current selection, and Escape behavior. |
| List | Grouped conversations with avatars, preview, unread count, timestamp, and selected row. |
| Sidebar | Rail + expanded navigation attached to a Page canvas rather than a card. |
| Split Pane | Wide document/version comparison with a labelled separator. |
| Toolbar | Editor/table action group with separators, overflow, and accessible labels. |
| Card | Project summary, editorial media, selectable record, metadata, and action hierarchy. |
| Loader | Stable loaded/skeleton geometry plus restrained inline progress; no dominant full-width blue bars. |
| Pagination | Accounts table footer with strengthened disabled states and compact responsive mode. |
| PIN Input | Verification flow with destination, paste, invalid code, resend timer, and completion. |
| Tile | Media/plan choices with selected, disabled, keyboard, and multi-select states. |
| File Upload | Preview, progress, type/size error, retry, and completed uploads before basic API variants. |

- [ ] **Step 4: Use tokenized normal-scale layouts**

Each example owns one BEM wrapper, a minimum useful block size, body-m text, and realistic content. Use spacing/separators before adding surfaces; only overlays and floating actions use shadows.

- [ ] **Step 5: Run docs tests, style gate, build, and commit**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/pages/reference-first-examples.spec.ts
yarn nx run styles:check-padding-tokens
yarn nx typecheck docs
yarn nx build docs
git add apps/docs/src/app/pages
git commit -m "docs(examples): strengthen weak component introductions"
```

---

### Task 3: Make the audited overlay states primary and shell-safe

**Files:**

- Modify: `apps/docs/src/app/pages/dialog/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/drawer/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/menu/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/tooltip/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/toast/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/notification/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/time-picker/examples/1/index.ts`, `index.html`, `index.scss`, `index.mdx`
- Create: `libs/core/toast/src/lib/toast-viewport-inset.ts`
- Create: `libs/core/toast/src/lib/toast-viewport-inset.spec.ts`
- Modify: `libs/core/toast/src/lib/abstract-toast.service.ts`
- Modify: `libs/core/toast/src/index.ts`
- Modify: `apps/docs/src/app/app.config.ts`
- Modify: `libs/core/toast/CLAUDE.md`
- Modify: `libs/core/notification/CLAUDE.md`

**Interfaces:**

- Produces: `MlvToastViewportInset { top; right; bottom; left }` and `MLV_TOAST_VIEWPORT_INSET` with `1rem` defaults.
- Docs app provides `{ top: '5rem', right: '1rem', bottom: '1rem', left: '1rem' }` so Toast and Notification share the safe lane below the 4rem app bar.

- [ ] **Step 1: Write positioning and open-state tests**

```ts
it('uses the injected top viewport inset for top positions', () => {
  service.open('Saved', { position: 'top-right' });
  const pane = overlayContainer.querySelector('.mlv-toast-panel--top-right') as HTMLElement;
  expect(pane.style.top).toBe('5rem');
  expect(pane.style.right).toBe('1rem');
});
```

Add docs tests that open each of the seven requested states, assert it is visible, press Escape when supported, and verify focus returns to the trigger. Toast/Notification tests assert their panels begin below the app bar.

- [ ] **Step 2: Run toast/notification/docs tests and verify RED**

```bash
yarn nx test core-toast
yarn nx test core-notification
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/pages/dialog src/app/pages/drawer src/app/pages/menu src/app/pages/tooltip src/app/pages/toast src/app/pages/notification src/app/pages/time-picker
```

Expected: inset tests fail before the token exists; sparse/open-state-first docs assertions fail where applicable.

- [ ] **Step 3: Add the shared viewport-inset token**

```ts
export interface MlvToastViewportInset {
  readonly top: string;
  readonly right: string;
  readonly bottom: string;
  readonly left: string;
}

export const MLV_TOAST_VIEWPORT_INSET = new InjectionToken<MlvToastViewportInset>(
  'MLV_TOAST_VIEWPORT_INSET',
  { factory: () => ({ top: '1rem', right: '1rem', bottom: '1rem', left: '1rem' }) },
);
```

Inject it into `AbstractToastService` and use the corresponding values in every global position strategy. Notification inherits the same infrastructure without a duplicate token.

- [ ] **Step 4: Rewrite the seven first examples**

- Dialog: complete unsaved-changes decision with clear title/body/action hierarchy.
- Drawer: 30rem customer inspector, `maxSize="32rem"`, one visible close button, dense labelled sections.
- Menu: grouped account actions with shortcut labels, submenu, separator, and destructive item.
- Tooltip: labelled icon toolbar with focus, delay, Escape, and collision examples.
- Toast: queued save/send confirmations rendered below a mock/shared app bar.
- Notification: assignment/status card with icon, title, body, actions, queue, and polite announcement.
- Time Picker: scheduling form that opens the drums immediately through an explicit Open picker control and shows the committed value.

- [ ] **Step 5: Run axe/open-state verification and commit**

```bash
yarn nx test core-toast
yarn nx test core-notification
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test
yarn nx run styles:check-padding-tokens
git add libs/core/toast libs/core/notification apps/docs/src/app/app.config.ts apps/docs/src/app/pages
git commit -m "fix(toast): keep feedback below application chrome"
```

---

### Task 4: Refine Drawer and Time Picker density without breaking mechanics

**Files:**

- Modify: `libs/core/drawer/src/lib/drawer/drawer.scss`
- Modify: `libs/core/drawer/src/lib/drawer/drawer.spec.ts`
- Modify: `libs/core/drawer/CLAUDE.md`
- Modify: `libs/core/time-picker/src/lib/time-picker/time-picker.scss`
- Modify: `libs/core/time-picker/src/lib/time-picker/time-picker.spec.ts`
- Modify: `libs/core/time-picker/CLAUDE.md`

**Interfaces:**

- Preserves Drawer `size`, `maxSize`, resizable/snap, focus trap, and close APIs.
- Preserves Time Picker value formats, 12/24-hour logic, keyboard listboxes, and density modes.

- [ ] **Step 1: Add visual-contract source tests**

Read the compiled component host/source styles and assert Drawer content has a readable max measure with scroll padding and Time Picker default density uses at least `2.5rem` item height and `4rem` column width. Keep existing axe and keyboard suites unchanged.

- [ ] **Step 2: Run both library suites and verify RED on new contracts**

```bash
yarn nx test core-drawer
yarn nx test core-time-picker
```

Expected: new density contract assertions fail before SCSS changes.

- [ ] **Step 3: Refine Drawer content geometry**

Keep panel max viewport clamping. Give `.mlv-drawer__content` consistent inline/block spacing, `min-width: 0`, one scroll owner, and a configurable `--mlv-drawer-content-max-width` default of `42rem` used only for inner reading measure, not panel width. Do not add another close control in the library.

- [ ] **Step 4: Refine Time Picker drums**

Set comfortable defaults to `--mlv-tp-item-height: 2.5rem`, `--mlv-tp-column-width: 4rem`, and `--mlv-tp-ampm-width: 4rem`; retain compact/tight reductions and spacious/airy growth. Increase selected-row fill/border contrast, keep non-selected values on `--mlv-text-secondary`, add visible column separation, and retain one centered selection band.

- [ ] **Step 5: Run mechanics, axe, token, and lint checks**

```bash
yarn nx test core-drawer
yarn nx test core-time-picker
yarn nx lint core-drawer
yarn nx lint core-time-picker
yarn nx run styles:check-padding-tokens
```

Expected: all existing drag/snap/focus/value/keyboard tests plus visual contracts PASS.

- [ ] **Step 6: Commit density refinements**

```bash
git add libs/core/drawer libs/core/time-picker
git commit -m "fix(time-picker): improve overlay density and contrast"
```

---

### Task 5: Complete target, contrast, and normal-scale refinements

**Files:**

- Modify: `libs/core/checkbox/src/lib/checkbox/checkbox.scss`, `checkbox.spec.ts`
- Modify: `libs/core/radio/src/lib/radio/radio.scss`, `radio.spec.ts`
- Modify: `libs/core/switch/src/lib/switch/switch.scss`, `switch.spec.ts`
- Modify: `libs/core/slider/src/lib/slider/slider.scss`, `slider.spec.ts`
- Modify: `libs/core/calendar/src/lib/calendar/calendar.scss`, `calendar.spec.ts`
- Modify: `libs/core/pagination/src/lib/pagination/pagination.scss`, `pagination.spec.ts`
- Modify: `apps/docs/src/app/pages/density/examples/1/index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/tokenizer/examples/1/index.html`, `index.scss`, `index.mdx`
- Modify: `apps/docs/src/app/pages/tree/examples/1/index.html`, `index.scss`, `index.mdx`
- Modify: relevant library `CLAUDE.md` files for any token/default change

**Interfaces:**

- Compact modes remain available, but default interactive targets and readable labels meet the visible WCAG audit requirements.

- [ ] **Step 1: Add measurable target/contrast tests**

For each control, mount default and compact density. Assert default target geometry resolves to at least 1.5rem visual control plus a 2.75rem clickable label row where applicable; assert disabled text/borders do not use `--mlv-text-tertiary`; retain axe tests. Pagination tests verify disabled controls remain visually distinct and non-focusable.

- [ ] **Step 2: Run affected suites and verify RED where audit gaps exist**

```bash
yarn nx test core-checkbox
yarn nx test core-radio
yarn nx test core-switch
yarn nx test core-slider
yarn nx test core-calendar
yarn nx test core-pagination
```

- [ ] **Step 3: Apply tokenized target and label rhythm changes**

Adjust only default/comfortable values needed by failing tests; retain compact/tight opt-in sizes. Strengthen slider track/thumb focus, calendar day contrast, and pagination disabled borders using existing tokens. Do not hard-code colors or use tertiary text for meaningful values.

- [ ] **Step 4: Increase cramped docs canvases**

Density example compares complete regions, Tokenizer shows realistic recipients with wrapping/overflow, and Tree uses body-m labels with a wider hierarchy canvas. Keep responsive behavior and source tabs intact.

- [ ] **Step 5: Run affected tests, token gate, docs build, and commit**

```bash
yarn nx test core-checkbox
yarn nx test core-radio
yarn nx test core-switch
yarn nx test core-slider
yarn nx test core-calendar
yarn nx test core-pagination
yarn nx run styles:check-padding-tokens
yarn nx build docs
git add libs/core apps/docs/src/app/pages
git commit -m "fix(styles): improve default control targets"
```

---

### Task 6: Recapture all 82 routes and seven open states

**Files:**

- Replace: `docs/audits/component-library-2026-08-20/01-*.jpg` through `82-*.jpg`
- Replace: `docs/audits/component-library-2026-08-20/83-dialog-open.jpg` and `84-drawer-open.jpg`
- Replace: `docs/audits/component-library-2026-08-20/85-*.jpg` through `91-*.jpg`
- Replace: `docs/audits/component-library-2026-08-20/contact-*.jpg`
- Modify: `docs/audits/component-library-2026-08-20/AUDIT.md`
- Modify: `apps/docs/CLAUDE.md`

**Interfaces:**

- Evidence viewport stays fixed to the audit baseline; each numbered file keeps its route/state identity.
- Open states: Dialog, Drawer, Menu, Tooltip, Toast, Notification, Time Picker.

- [ ] **Step 1: Run full automated verification before visual capture**

```bash
yarn nx run-many -t test --projects=core-checkbox,core-radio,core-switch,core-slider,core-calendar,core-pagination,core-drawer,core-time-picker,core-toast,core-notification
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test
yarn nx run styles:check-padding-tokens
yarn nx run docs:check-doc-api
yarn nx lint docs
yarn nx typecheck docs
yarn nx build docs
```

Expected: every command exits 0.

- [ ] **Step 2: Serve and capture the 82 default routes**

Run `yarn nx run docs:serve`. Use the in-app Browser at the same viewport for every route. Wait for lazy content, fonts, images, and animations; capture the normal page without native fullscreen. Keep route order 1–82 from `AUDIT.md`.

- [ ] **Step 3: Capture the seven requested open states**

Activate the named in-page trigger for Dialog, Drawer, Menu, Tooltip, Toast, Notification, and Time Picker. Confirm focus/announcement behavior, capture the visible state, close it with Escape/dismiss, and confirm focus restoration before moving on.

- [ ] **Step 4: Regenerate contact sheets and compare references**

Regenerate the ten labelled contact sheets with ImageMagick at the existing two-column overview scale:

```bash
audit_dir=docs/audits/component-library-2026-08-20
montage -label '%t' "$audit_dir"/{01,02,03,04,05,06}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-01-06.jpg"
montage -label '%t' "$audit_dir"/{07,08,09,10,11,12,13,14,15,16}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-07-16.jpg"
montage -label '%t' "$audit_dir"/{17,18,19,20,21,22,23,24,25,26}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-17-26.jpg"
montage -label '%t' "$audit_dir"/{27,28,29,30,31,32,33,34,35,36}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-27-36.jpg"
montage -label '%t' "$audit_dir"/{37,38,39,40,41,42,43,44,45,46}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-37-46.jpg"
montage -label '%t' "$audit_dir"/{47,48,49,50,51,52,53,54,55,56}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-47-56.jpg"
montage -label '%t' "$audit_dir"/{57,58,59,60,61,62,63,64,65,66}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-57-66.jpg"
montage -label '%t' "$audit_dir"/{67,68,69,70,71,72,73,74,75,76}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-67-76.jpg"
montage -label '%t' "$audit_dir"/{77,78,79,80,81,82}-*.jpg -thumbnail '500x281>' -tile 2x -geometry +4+4 "$audit_dir/contact-77-82.jpg"
montage -label '%t' "$audit_dir"/{85-dialog-clicked,86-drawer-clicked,87-menu-clicked,88-tooltip-focused,89-toast-clicked,90-notification-clicked,91-time-picker-clicked}.jpg -thumbnail '650x366>' -tile 1x -geometry +4+4 "$audit_dir/contact-clicked-states.jpg"
```

Compare Project Workspace, Support Inbox, Showcase Index, and Data Operations screenshots beside the approved references; fix visible crop, spacing, scale, border, and hierarchy mismatches before accepting evidence.

- [ ] **Step 5: Update the audit with resolved/remaining findings**

Keep all 82 route rows and seven clicked-state rows, and preserve the two additional pre-click Dialog/Drawer captures as evidence files 83–84. Mark resolved findings with concrete evidence filenames; retain measured remaining risks without claiming success from screenshots alone. Record axe/keyboard results for the seven clicked states.

- [ ] **Step 6: Commit the complete audit upgrade**

```bash
git add apps/docs/CLAUDE.md docs/audits/component-library-2026-08-20
git commit -m "docs(audit): recapture the premium component library"
```
