# Composed Showcase Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build five polished, full-size, interactive Malva product compositions and replace the showcase catalog concepts with screenshots captured from those working routes.

**Architecture:** Each showcase is a lazy standalone route under `ShowcaseShellComponent`, keeps its domain data in a sibling file, and composes public `@malva-ui/core/*` imports. Route components own mock domain state and async simulation; library components remain domain-neutral. Shared showcase fixtures and formatting helpers live under `showcases/shared`, while every route owns its layout and interactions.

**Tech Stack:** Angular 22 signals, Angular Router, Malva Page/Sidebar/Data Table/Filter/View Variant/Editor/Chat/Form/Overlay components, Lucide icons, SCSS BEM, Vitest/jsdom, axe-core, in-app Browser capture at 1600×1000.

**Spec:** `docs/superpowers/specs/2026-08-20-documentation-showcases-design.md`

## Global Constraints

- Execute after `2026-08-20-documentation-showcase-shell.md` and `2026-08-20-saved-view-filtering.md`; consume their exact registry, Page, view-variant, query-filter, and table snapshot APIs.
- Every route contains one `main`; projected navigation uses native `nav`, details use `aside`, and no showcase imports the docs sidebar or table of contents.
- Core task interactions must work with realistic deterministic data; no dead primary buttons, fake input fields, or CSS-drawn assets.
- Use Malva components for every control and overlay. Use named Lucide directives for static icons.
- Use source/reference images already in the design spec and repository; generate a raster asset only when a visible media slot lacks a suitable source.
- Keep desktop product controls 36–40 px high and dense rows 44–48 px through Malva density/tokens, not hard-coded miniature typography.
- All responsive sidebars/drawers restore focus, close on Escape, and preserve one main task surface.
- Tests run through `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test`; also run docs lint/typecheck/build and the style token gate.

---

### Task 1: Build the Data Operations showcase from approved filter direction 2

**Files:**

- Create: `apps/docs/src/app/showcases/shared/showcase-async.ts`
- Create: `apps/docs/src/app/showcases/pages/data-operations/data-operations.data.ts`
- Create: `apps/docs/src/app/showcases/pages/data-operations/data-operations.html`
- Create: `apps/docs/src/app/showcases/pages/data-operations/data-operations.scss`
- Create: `apps/docs/src/app/showcases/pages/data-operations/data-operations.spec.ts`
- Modify: `apps/docs/src/app/showcases/pages/data-operations/data-operations.ts`

**Interfaces:**

- Produces: `AccountsViewState { search; filterExpression; table }` and typed account/view fixtures.
- Consumes: `MlvViewVariantList`, `MlvViewVariantStatus`, `MlvSmartFilterBar appearance="query"`, `MlvDataTable.getPresentationState()`, and `applyPresentationState()`.
- Route interactions: select/search views, add/edit/remove filters, change sort/columns, duplicate locked view, create personal view, update editable view, reset changes, open/close row details, and keep the active saved view in the `view` query parameter.

- [ ] **Step 1: Write the end-to-end component-state tests**

```ts
it('loads the locked At risk system view into filters and table state', () => {
  expect(component.activeVariant()?.name).toBe('At risk');
  expect(component.dirty()).toBe(false);
  expect(host.textContent).toContain('This system view is read-only');
  expect(host.textContent).toContain('34');
});

it('duplicates a dirty locked view as an editable personal view', async () => {
  component.search.set('enterprise');
  expect(component.dirty()).toBe(true);
  component.duplicateActiveView();
  await settleShowcaseOperation();
  expect(component.activeVariant()?.scope).toBe('personal');
  expect(component.activeVariant()?.name).toBe('At risk copy');
  expect(component.dirty()).toBe(false);
});

it('updates only an editable variant and preserves state after failure', async () => {
  component.selectVariant('my-follow-ups');
  component.search.set('Acme');
  component.failNextOperation.set(true);
  component.updateActiveView();
  await settleShowcaseOperation();
  expect(component.dirty()).toBe(true);
  expect(component.operationError()).toContain('could not be updated');
});

it('restores a valid saved view from the URL', async () => {
  await navigateTo('/showcases/data-operations?view=my-follow-ups');
  expect(component.activeVariant()?.id).toBe('my-follow-ups');
});

it('replaces an unknown view with the At risk default', async () => {
  const router = await navigateTo('/showcases/data-operations?view=missing');
  expect(component.activeVariant()?.id).toBe('at-risk');
  expect(router.url).toBe('/showcases/data-operations?view=at-risk');
});

it('writes selection to the URL without adding a history entry', async () => {
  const router = await navigateTo('/showcases/data-operations?view=at-risk');
  const navigate = vi.spyOn(router, 'navigate');
  component.selectVariant('my-follow-ups');
  expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
    queryParams: { view: 'my-follow-ups' },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  }));
});
```

Add tests for conditional New/Duplicate/Update actions, dirty switch confirmation, filter add/remove, table snapshot restoration, inspector focus return, and axe-clean default/dirty states.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/data-operations/data-operations.spec.ts
```

Expected: FAIL because the route contains only the walking-skeleton heading.

- [ ] **Step 3: Add exact account and view fixtures**

Define 34 accounts with the visible first page led by Acme Corporation, Northwind Traders, Globex Industries, Initech, Umbrella Corp, Stark Industries, Wayne Enterprises, and Soylent Corp. Include owner, plan, ARR, health, renewal date/days, and last activity. Define System (`All accounts`, `At risk`, `Enterprise renewals`, `Unassigned`), Team (`Overdue renewals`, `Expansion potential`, `Low usage`, `Contracts expiring`), and Personal (`My follow-ups`, `Recently contacted`) variants with the capability matrix from the selected visual.

- [ ] **Step 4: Implement normalized baseline/working state**

```ts
private readonly _route = inject(ActivatedRoute);
private readonly _router = inject(Router);
private readonly _variantIds = new Set(ACCOUNT_VIEW_VARIANTS.map((variant) => variant.id));

readonly activeId = signal(this._resolveViewId(this._route.snapshot.queryParamMap.get('view')));
readonly search = signal('');
readonly filterExpression = signal<MlvFilterExpression>(AT_RISK_EXPRESSION);
readonly tableState = signal<MlvDataTablePresentationState>(DEFAULT_TABLE_STATE);
readonly baselineState = signal<AccountsViewState>(AT_RISK_VIEW.state);

readonly workingState = computed<AccountsViewState>(() => ({
  search: this.search(),
  filterExpression: this.filterExpression(),
  table: this.tableState(),
}));
readonly dirty = computed(() => !mlvViewStateEqual(
  this.baselineState(), this.workingState(), normalizeAccountsViewState,
));

private _resolveViewId(candidate: string | null): string {
  return candidate && this._variantIds.has(candidate) ? candidate : 'at-risk';
}

private _writeViewToUrl(view: string): void {
  void this._router.navigate([], {
    relativeTo: this._route,
    queryParams: { view },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
```

During construction, replace a missing or invalid `view` query parameter with the resolved `at-risk` value. Subscribe to later `queryParamMap` changes with `takeUntilDestroyed()` so browser Back/Forward restores the corresponding baseline and working state. `selectVariant(id)` first resolves and loads the variant, then calls `_writeViewToUrl(id)`. Create/clone/update use the shared deterministic operation helper, preserve state on failure, update variants/baseline only on success, and write the newly active variant id to the same query parameter.

- [ ] **Step 5: Compose the approved page structure**

```html
<mlv-page-shell class="data-operations-showcase">
  <nav mlvPageSidebar class="data-operations-showcase__views" aria-label="Account views">
    <mlv-view-variant-list
      [variants]="variants()"
      [(activeId)]="activeId"
      [(query)]="viewQuery"
      [canCreate]="canCreateView()"
      [busyAction]="busyAction()"
      [errorMessage]="operationError()"
      (variantSelect)="requestVariantSelection($event)"
      (createRequest)="createView($event)"
      (retryRequest)="retryOperation()"
      (dismissError)="operationError.set(null)"
    />
  </nav>
  <main mlvPage padding="l" id="main-content">
    <mlv-page-header>
      <ng-template mlvPageTitle><h1 mlvTitle>{{ activeVariant()?.name ?? 'Accounts' }}</h1></ng-template>
      <ng-template mlvPageHeaderActions>
        <button mlvButton (click)="createAccount()">Add account</button>
      </ng-template>
    </mlv-page-header>
    <mlv-smart-filter-bar
      appearance="query"
      [definitions]="filterDefinitions"
      [(filters)]="filterFields"
      [(visibleKeys)]="visibleFilterKeys"
      (execute)="applyFilters($event)"
    />
    <mlv-view-variant-status
      [variant]="activeVariant()"
      [dirty]="dirty()"
      [canCreate]="canCreateView()"
      [busyAction]="busyAction()"
      [errorMessage]="operationError()"
      (resetRequest)="resetWorkingState()"
      (cloneRequest)="duplicateActiveView()"
      (updateRequest)="updateActiveView()"
      (createRequest)="createView('personal')"
      (retryRequest)="retryOperation()"
      (dismissError)="operationError.set(null)"
    />
    <mlv-toolbar aria-label="Account table tools">
      <mlv-search-field [(value)]="search" placeholder="Search accounts" />
      <button mlvButton variant="outlined" (click)="openSortMenu()">Sort</button>
      <button mlvButton variant="outlined" (click)="openColumnsMenu()">Columns</button>
      <mlv-toolbar-spacer />
      <button mlvButton variant="outlined" (click)="exportAccounts()">Export</button>
    </mlv-toolbar>
    <mlv-data-table
      [data]="filteredAccounts()"
      [columns]="columns"
      [showSearch]="false"
      [selectable]="'multi'"
      (rowClick)="openAccount($event.row)"
      (presentationStateChange)="tableState.set($event)"
    />
  </main>
  @if (selectedAccount(); as account) {
    <aside mlvPageEndSidebar class="data-operations-showcase__inspector" aria-label="Account details">
      <header>
        <h2>{{ account.name }}</h2>
        <button mlvButton shape="square" variant="transparent" aria-label="Close account details"
          (click)="closeAccount()">×</button>
      </header>
      <dl>
        <div><dt>Owner</dt><dd>{{ account.owner }}</dd></div>
        <div><dt>Plan</dt><dd>{{ account.plan }}</dd></div>
        <div><dt>ARR</dt><dd>{{ account.arr | currency }}</dd></div>
        <div><dt>Renewal</dt><dd>{{ account.renewalDate | date }}</dd></div>
      </dl>
    </aside>
  }
</mlv-page-shell>
```

The table columns and cells match the selected reference hierarchy; ARR is tabular, health uses semantic badges, renewal days use negative text only when urgent, and row activation opens the details inspector.

- [ ] **Step 6: Implement responsive and premium styling**

Use a 17rem Views sidebar, a `min-width: 0` center, a 20rem inspector, 1px separators, a single base page surface, and no decorative gradient. Below `64rem`, the inspector becomes off-canvas; below `48rem`, the Views sidebar becomes off-canvas and the page header exposes labelled triggers.

- [ ] **Step 7: Run tests and commit Data Operations**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/data-operations/data-operations.spec.ts
yarn nx run styles:check-padding-tokens
yarn nx lint docs
git add apps/docs/src/app/showcases/shared apps/docs/src/app/showcases/pages/data-operations
git commit -m "feat(docs): build the data operations showcase"
```

---

### Task 2: Build the Project Workspace flagship Page composition

**Files:**

- Create: `apps/docs/src/app/showcases/pages/project-workspace/project-workspace.data.ts`
- Create: `apps/docs/src/app/showcases/pages/project-workspace/project-workspace.html`
- Create: `apps/docs/src/app/showcases/pages/project-workspace/project-workspace.scss`
- Create: `apps/docs/src/app/showcases/pages/project-workspace/project-workspace.spec.ts`
- Modify: `apps/docs/src/app/showcases/pages/project-workspace/project-workspace.ts`

**Interfaces:**

- Consumes: two `[mlvPageSidebar]` hosts, one `[mlvPageEndSidebar]`, Page Header/Summary/Content, Sidebar, Tabs, Data Table, Timeline, Progress, Avatar, Badge, Menu, Drawer.
- Interactions: active navigation, Summary/Activity/Files, task-group expand, status change, navigation collapse, inspector close/reopen.

- [ ] **Step 1: Write shell-geometry and interaction tests**

```ts
it('orders rail, project navigation, content, and inspector', () => {
  const body = host.querySelector('.mlv-page-shell__body')!;
  expect([...body.children].map((node: Element) => node.getAttribute('data-region')))
    .toEqual(['rail', 'project-navigation', null, 'inspector']);
});

it('changes task status and updates summary progress', () => {
  const before = component.progress();
  component.setTaskStatus('responsive-shell', 'done');
  expect(component.progress()).toBeGreaterThan(before);
});
```

Add tests for tab switching, group expansion, inspector focus restoration, responsive drawer mode, and axe-clean default state.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/project-workspace/project-workspace.spec.ts
```

Expected: FAIL until the full composition exists.

- [ ] **Step 3: Add project fixtures and derived state**

Define Planning, Design, and Development groups with 7 tasks, assignees AM/DS/KL, status, due date, priority, and progress. Compute overall progress from task completion; keep the Aug 14 milestone, design approval, kickoff, development, and launch timeline events from the approved reference.

- [ ] **Step 4: Compose all four shell regions**

Use a narrow icon-only `nav` rail, expanded `nav` project sidebar, one `main[mlvPage]`, and an `aside` inspector. The central surface contains breadcrumb/title/actions, Summary/Activity/Files tabs, three key facts, grouped tasks, and a bottom timeline. The inspector contains a real repository preview image from `apps/docs/public/malva-ui-hero-abstract.png`, owner, status, due date, tags, collaborators, and recent activity.

- [ ] **Step 5: Implement responsive collapse and inspectable actions**

Navigation and inspector have independent signals and labelled reopen buttons. Menu actions change task status in place and issue a polite Notification. At tablet width the end inspector becomes a Drawer; at mobile width the project navigation does too, while the rail remains available.

- [ ] **Step 6: Style against approved workspace direction**

Keep the central canvas white/raised against quiet chrome, 3rem summary rows, 2.75rem task rows, thin separators, compact badges, and one blue primary action. Do not apply purple gradients from the reference; Malva brand tokens remain authoritative.

- [ ] **Step 7: Verify and commit Project Workspace**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/project-workspace/project-workspace.spec.ts
yarn nx run styles:check-padding-tokens
git add apps/docs/src/app/showcases/pages/project-workspace
git commit -m "feat(docs): build the project workspace showcase"
```

---

### Task 3: Build the Support Inbox and shell-aware feedback states

**Files:**

- Create: `apps/docs/src/app/showcases/pages/support-inbox/support-inbox.data.ts`
- Create: `apps/docs/src/app/showcases/pages/support-inbox/support-inbox.html`
- Create: `apps/docs/src/app/showcases/pages/support-inbox/support-inbox.scss`
- Create: `apps/docs/src/app/showcases/pages/support-inbox/support-inbox.spec.ts`
- Modify: `apps/docs/src/app/showcases/pages/support-inbox/support-inbox.ts`

**Interfaces:**

- Consumes: Sidebar/List/Search/Chat/Editor-or-Textarea/Menu/Tooltip/Toast/Notification/Dialog/Drawer/Avatar/Badge/Page.
- Interactions: select/filter conversation, composer action menu, send reply, message menu, resolved state, customer inspector collapse/reopen.

- [ ] **Step 1: Write inbox and overlay interaction tests**

```ts
it('selects a conversation and updates the customer inspector', () => {
  component.selectConversation('borunova');
  expect(component.activeConversation()?.customer.name).toBe('Ульяна Борунова');
  expect(host.querySelector('[aria-label="Customer details"]')?.textContent).toContain('Москва');
});

it('sends a reply, clears the composer, and opens a shell-safe toast', () => {
  component.composer.set('Спасибо! Заказ уже в пути.');
  component.sendReply();
  expect(component.activeConversation()?.messages.at(-1)?.text).toContain('Заказ уже в пути');
  expect(component.composer()).toBe('');
  expect(component.lastFeedback()).toBe('Reply sent');
});
```

Add tests for search empty state, resolved toggle, Menu Escape/focus return, Dialog/Drawer focus return, Toast/Notification top offset, and axe-clean default plus every open state.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/support-inbox/support-inbox.spec.ts
```

Expected: FAIL until the inbox composition exists.

- [ ] **Step 3: Add realistic conversation fixtures**

Use the supplied FloraStore reference as content direction: Alexander Ivanov, Ulyana Borunova, Sergey Sokolov, Mikhail Fedorov, Elena Popova, and Olga Morozova; channel, timestamp, preview, assignee, tags, location, contact fields, and visited pages. Keep the UI copy in English except customer names and message examples where the reference is intentionally Russian.

- [ ] **Step 4: Compose navigation, list, chat, composer, and inspector**

The first start sidebar is channel navigation, the second is a conversation list with search, center is `MlvChat`, and the end sidebar is customer details. The composer has attachment, emoji, canned reply, send, and overflow actions built with Malva controls. Sending appends a deterministic outgoing message and does not contact a server.

- [ ] **Step 5: Demonstrate overlays in context**

Use Menu for message/composer actions, Tooltip for icon-only actions, Dialog for destructive close, Drawer for customer details on tablet, Toast for sent confirmation, and Notification for assignment/resolution. All top feedback uses the shared safe-area token and never overlaps the app bar.

- [ ] **Step 6: Style for readable communication density**

Conversation rows are 4.5rem with a clear selected state; chat text remains body-m; timestamps are secondary but not tertiary; bubbles max at 34rem; details sections use separators rather than nested cards. On small screens, conversation selection becomes the primary canvas and Back returns to the list.

- [ ] **Step 7: Verify and commit Support Inbox**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/support-inbox/support-inbox.spec.ts
yarn nx run styles:check-padding-tokens
git add apps/docs/src/app/showcases/pages/support-inbox
git commit -m "feat(docs): build the support inbox showcase"
```

---

### Task 4: Build the Publishing Workspace

**Files:**

- Create: `apps/docs/src/app/showcases/pages/publishing-workspace/publishing-workspace.data.ts`
- Create: `apps/docs/src/app/showcases/pages/publishing-workspace/publishing-workspace.html`
- Create: `apps/docs/src/app/showcases/pages/publishing-workspace/publishing-workspace.scss`
- Create: `apps/docs/src/app/showcases/pages/publishing-workspace/publishing-workspace.spec.ts`
- Modify: `apps/docs/src/app/showcases/pages/publishing-workspace/publishing-workspace.ts`

**Interfaces:**

- Consumes: Editor/AI Kit/Page/Split Pane/Toolbar/Title/Avatar Group/Badge/File Upload/Drawer/Dialog/Notification.
- Interactions: edit content, open AI menu, accept/reject suggestion, inspect version, change draft status, publish confirmation.

- [ ] **Step 1: Write editor workflow tests**

```ts
it('accepts an AI review suggestion into the document', async () => {
  component.requestSuggestion('shorten');
  await settleAiStream();
  component.acceptSuggestion();
  expect(component.documentHtml()).toContain('A clearer product update');
  expect(component.reviewSuggestion()).toBeNull();
});

it('publishes only after confirmation', () => {
  component.openPublishDialog();
  expect(component.status()).toBe('draft');
  component.confirmPublish();
  expect(component.status()).toBe('published');
});
```

Add tests for reject, version selection, image upload progress/error, split-pane collapse, focus return, and axe-clean editor/dialog states.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/publishing-workspace/publishing-workspace.spec.ts
```

Expected: FAIL until the workflow is implemented.

- [ ] **Step 3: Add deterministic article/version/suggestion fixtures**

Define one complete product-update article, three historical versions, collaborators, workflow status, comments, and canned AI output streamed by the same abortable local mock pattern already documented by Editor AI. Upload uses local object URLs and deterministic progress; it never contacts a backend.

- [ ] **Step 4: Compose the publishing canvas**

Use document navigation at start, a wide Page center with title/status/collaborators and editor, and a review/version inspector at end. Split Pane compares selected versions. `MlvPageDock` holds last-saved state, Preview, and Publish. The publish action opens a complete confirmation Dialog with schedule/status summary.

- [ ] **Step 5: Style and verify the content measure**

Editor body measure stays 42–48rem, surrounding chrome uses quiet backgrounds, toolbar groups have visible separation, and the review inspector does not shrink the editor below its minimum. Below tablet width, review becomes a Drawer.

- [ ] **Step 6: Verify and commit Publishing Workspace**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/publishing-workspace/publishing-workspace.spec.ts
yarn nx run styles:check-padding-tokens
git add apps/docs/src/app/showcases/pages/publishing-workspace
git commit -m "feat(docs): build the publishing workspace showcase"
```

---

### Task 5: Build Settings & Access

**Files:**

- Create: `apps/docs/src/app/showcases/pages/settings-access/settings-access.data.ts`
- Create: `apps/docs/src/app/showcases/pages/settings-access/settings-access.html`
- Create: `apps/docs/src/app/showcases/pages/settings-access/settings-access.scss`
- Create: `apps/docs/src/app/showcases/pages/settings-access/settings-access.spec.ts`
- Modify: `apps/docs/src/app/showcases/pages/settings-access/settings-access.ts`

**Interfaces:**

- Consumes: Page/Sidebar/Tabs/Form/Form Field/Input/Select/Radio/Checkbox/Switch/Tokenizer/Time Picker/PIN Input/Dialog/Drawer/Alert/Toast.
- Interactions: tabs, validation, dependent notification controls, roles/tokens, time selection, save success, destructive confirmation.

- [ ] **Step 1: Write settings workflow tests**

```ts
it('shows validation and blocks an invalid profile save', () => {
  component.profileForm.email().value.set('invalid');
  component.saveProfile();
  expect(component.profileForm.email().invalid()).toBe(true);
  expect(component.saveState()).toBe('error');
});

it('disables quiet-hours controls when notifications are off', () => {
  component.notificationsEnabled.set(false);
  expect(component.quietHoursDisabled()).toBe(true);
});
```

Add tests for tab route state, Time Picker value, token creation, role change, delete Dialog, save Toast, focus return, and axe-clean default/error/open states.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/settings-access/settings-access.spec.ts
```

Expected: FAIL until the settings composition exists.

- [ ] **Step 3: Build typed signal forms and deterministic data**

Use profile values for Alex Morgan, locale/timezone, notification channels, quiet hours, two API tokens, and six team members. Validation covers required name, email format, duplicate token name, and role restrictions. Save simulates a short deterministic operation and preserves dirty/error state on failure.

- [ ] **Step 4: Compose navigation and tabbed forms**

Sidebar sections link to Profile, Notifications, Security, and Team access. Center Page header shows title/description/save action; each tab uses `mlvForm` and `mlvFieldset`. Security demonstrates PIN Input and token creation; Notifications demonstrates Switch groups and Time Picker; Team access demonstrates roles and destructive removal.

- [ ] **Step 5: Style normal form measure and responsive navigation**

Keep fields in a 42rem reading measure, group related controls with headings and descriptions, reserve Alerts for persistent validation/security messages, and avoid card-per-field. Sidebar becomes Drawer below tablet width.

- [ ] **Step 6: Verify and commit Settings & Access**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases/pages/settings-access/settings-access.spec.ts
yarn nx run styles:check-padding-tokens
git add apps/docs/src/app/showcases/pages/settings-access
git commit -m "feat(docs): build the settings access showcase"
```

---

### Task 6: Capture route-derived previews and verify all showcases

**Files:**

- Create: `apps/docs/public/showcases/project-workspace.png`
- Create: `apps/docs/public/showcases/support-inbox.png`
- Create: `apps/docs/public/showcases/publishing-workspace.png`
- Create: `apps/docs/public/showcases/data-operations.png`
- Create: `apps/docs/public/showcases/settings-access.png`
- Modify: `apps/docs/src/app/showcases/showcase-index/showcase-index.spec.ts`
- Modify: `apps/docs/src/app/showcases/showcase.registry.ts`
- Modify: `apps/docs/CLAUDE.md`

**Interfaces:**

- Preview contract: 1600×1000 PNG, light theme, default route state, decoded images, settled fonts, no open transient overlay unless the catalog copy names that state.

- [ ] **Step 1: Run all showcase tests and the docs build**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/showcases
yarn nx typecheck docs
yarn nx build docs
```

Expected: all five showcase suites and registry/index suites PASS.

- [ ] **Step 2: Serve and inspect each route in the in-app Browser**

Run `yarn nx run docs:serve`. At 1600×1000 inspect each route for overflow, crop, type scale, spacing, border radius, focus ring, app-bar overlap, and functional primary interactions. Do not activate any native fullscreen control.

- [ ] **Step 3: Capture the five PNG previews**

Use the in-app Browser screenshot action after fonts/images/animations settle. Save each screenshot to its exact public asset path. Repeat any capture with clipped content, transient focus artifacts, or open overlays not intended for the catalog.

Set each registry entry's `previewAsset` from `null` to its exact `/showcases/<slug>.png` path and update the index test to require five image sources.

- [ ] **Step 4: Compare implementation and approved references together**

Create side-by-side comparison images for Project Workspace and Data Operations using their route screenshots plus the approved spec assets. Correct visible hierarchy/density/layout mismatches, then capture again. The implementation keeps Malva brand tokens while matching the selected references' composition.

- [ ] **Step 5: Verify index images and responsive routes**

Open `/showcases?category=all` and one filtered category. Confirm every image decodes at the intended aspect ratio. Inspect all routes at 1024×768 and 390×844; exercise Drawer triggers, Escape, and focus restoration.

- [ ] **Step 6: Run final verification and commit previews**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test
yarn nx run styles:check-padding-tokens
yarn nx lint docs
yarn nx typecheck docs
yarn nx build docs
git add apps/docs/public/showcases apps/docs/src/app/showcases apps/docs/CLAUDE.md
git commit -m "docs(showcases): capture the composed product previews"
```
