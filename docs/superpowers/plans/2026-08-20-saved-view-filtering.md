# Saved View Variants and Query Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship generic permission-aware saved view components, a natural-language Smart Filter query appearance with grouped expressions, and a data-table presentation snapshot API suitable for create, clone, and update workflows.

**Architecture:** A new `@malva-ui/core/view-variant` secondary entry point renders controlled System/Team/Personal view navigation and dirty/read-only actions but never persists data. `@malva-ui/core/filter` retains its flat state and classic UI while adding expression adapters and `appearance="query"`. `MlvDataTable` exposes capture/apply methods for sort, visible/pinned columns, widths, and page size; the showcase host combines those three independent state surfaces.

**Tech Stack:** Angular 22 signals and standalone components, Nx 23 secondary-entry generator, Malva Button/List/Search/Popup/Filter/Data Table, Lucide icons, SCSS BEM, Vitest/jsdom, axe-core.

**Spec:** `docs/superpowers/specs/2026-08-20-documentation-showcases-design.md`

## Global Constraints

- `MlvViewVariantList` and `MlvViewVariantStatus` are controlled UI; no HTTP, storage, role lookup, or optimistic persistence belongs in the library.
- Create, clone, update, rename, delete, and share actions render only when explicit capabilities permit them.
- `MlvSmartFilterBar` defaults to the current classic appearance; query mode is additive and preserves flat `filters`, `visibleKeys`, and execution payload compatibility.
- `MlvDataTable` must not know view names, scopes, ownership, permissions, or dirty state.
- Saved table state excludes current page, row selection, loading/error status, density, overlays, and inspectors.
- Every library component follows `.claude/rules/angular-component.md`, `.claude/rules/bem-scss.md`, and `.claude/rules/accessibility.md` in full.
- Generate the new secondary entry point with Nx; the verified dry run creates `libs/core/view-variant/{README.md,ng-package.json,src/index.ts}` and updates `tsconfig.base.json` plus `libs/core/tsconfig.lib.json`.
- Use `yarn nx test core-view-variant`, `yarn nx test core-filter`, and `yarn nx test core-data-table`; also run the three lint targets, `yarn nx run styles:check-padding-tokens`, `yarn nx typecheck docs`, and `yarn nx build core`.

---

### Task 1: Generate and wire the `view-variant` secondary entry point

**Files:**

- Generate: `libs/core/view-variant/README.md`
- Generate: `libs/core/view-variant/ng-package.json`
- Generate: `libs/core/view-variant/src/index.ts`
- Create: `libs/core/view-variant/project.json`
- Create: `libs/core/view-variant/tsconfig.json`
- Create: `libs/core/view-variant/tsconfig.lib.json`
- Create: `libs/core/view-variant/tsconfig.lib.prod.json`
- Create: `libs/core/view-variant/tsconfig.spec.json`
- Create: `libs/core/view-variant/vite.config.mts`
- Create: `libs/core/view-variant/src/test-setup.ts`
- Create: `libs/core/view-variant/AGENTS.md`
- Create: `libs/core/view-variant/CLAUDE.md`
- Modify: `tsconfig.base.json`
- Modify: `libs/core/tsconfig.lib.json`
- Modify: `libs/core/src/index.ts`
- Modify: `libs/core/CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `commitlint.config.mjs`

**Interfaces:**

- Produces Nx project `core-view-variant` with tags `scope:ui`, `family:core`, `type:ui`.
- Produces consumer import `@malva-ui/core/view-variant`.

- [ ] **Step 1: Repeat the verified Nx dry run**

```bash
yarn nx g @nx/angular:library-secondary-entry-point view-variant --library=core --skipModule --dry-run --no-interactive
```

Expected: CREATE only `README.md`, `ng-package.json`, and `src/index.ts`; UPDATE only `tsconfig.base.json` and `libs/core/tsconfig.lib.json`; no route/module file.

- [ ] **Step 2: Generate the secondary entry point**

```bash
yarn nx g @nx/angular:library-secondary-entry-point view-variant --library=core --skipModule --no-interactive
```

Expected: the same five paths change without dependency installation.

- [ ] **Step 3: Add the leaf Nx test project using the existing core pattern**

Create `project.json` with:

```json
{
  "name": "core-view-variant",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/core/view-variant/src",
  "prefix": "mlv",
  "projectType": "library",
  "tags": ["scope:ui", "family:core", "type:ui"],
  "targets": {
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "@nx/vitest:test",
      "options": { "config": "libs/core/view-variant/vite.config.mts" }
    }
  }
}
```

Create the focused configuration shape used by core leaf projects: `tsconfig.json` references `tsconfig.lib.json` and `tsconfig.spec.json`; `tsconfig.lib.json` includes `src/**/*.ts` and excludes specs/test setup; `tsconfig.lib.prod.json` sets Angular partial compilation; `tsconfig.spec.json` includes Vitest/Node types and `src/test-setup.ts`; `src/test-setup.ts` calls `setupTestBed({ zoneless: false })`; and `vite.config.mts` uses the Angular, Nx tsconfig-path, and copy-assets plugins with jsdom, project name `core-view-variant`, and coverage directory `coverage/libs/core/view-variant`.

- [ ] **Step 4: Wire grouped exports and project documentation**

Add to `libs/core/src/index.ts`:

```ts
export * from '@malva-ui/core/view-variant';
```

Add `view-variant` alphabetically to commitlint scopes, the root library index, the core public-entry list, and core internal dependency list. `AGENTS.md` describes the library as permission-aware controlled navigation/actions for named state snapshots.

- [ ] **Step 5: Verify project discovery before adding components**

```bash
yarn nx show project core-view-variant --json
yarn nx lint core-view-variant
```

Expected: project root `libs/core/view-variant` and test/lint targets are present. The first test run happens in Task 2 after a real suite exists.

- [ ] **Step 6: Commit the generated entry point**

```bash
git add AGENTS.md commitlint.config.mjs tsconfig.base.json libs/core
git commit -m "feat(view-variant): add the core entry point"
```

---

### Task 2: Add public saved-view types and normalization helpers

**Files:**

- Create: `libs/core/view-variant/src/lib/view-variant.types.ts`
- Create: `libs/core/view-variant/src/lib/view-variant-state.ts`
- Create: `libs/core/view-variant/src/lib/view-variant-state.spec.ts`
- Modify: `libs/core/view-variant/src/index.ts`

**Interfaces:**

- Produces: `MlvViewVariantScope`, `MlvViewVariantCapabilities`, `MlvViewVariant<TState>`, `MlvViewVariantCreateRequest<TState>`, `MlvViewVariantAction`, `MlvViewVariantBusyAction`, `MlvViewVariantGroupLabels`, `mlvViewStateEqual()`.

- [ ] **Step 1: Write equality and immutable-type tests**

```ts
it('compares normalized view state supplied by the host', () => {
  const normalize = (state: { page: number; filters: string[] }) => ({
    filters: [...state.filters].sort(),
  });
  expect(mlvViewStateEqual(
    { page: 1, filters: ['b', 'a'] },
    { page: 9, filters: ['a', 'b'] },
    normalize,
  )).toBe(true);
});

it('detects meaningful normalized changes', () => {
  expect(mlvViewStateEqual({ search: 'risk' }, { search: 'renewal' }, value => value))
    .toBe(false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
yarn nx test core-view-variant
```

Expected: FAIL because the public types/helper are missing.

- [ ] **Step 3: Define the exact public model**

```ts
export type MlvViewVariantScope = 'system' | 'team' | 'personal';
export type MlvViewVariantAction =
  | 'create' | 'clone' | 'update' | 'rename' | 'delete' | 'share';

export interface MlvViewVariantCapabilities {
  readonly clone: boolean;
  readonly update: boolean;
  readonly rename: boolean;
  readonly delete: boolean;
  readonly share: boolean;
}

export interface MlvViewVariant<TState> {
  readonly id: string;
  readonly name: string;
  readonly scope: MlvViewVariantScope;
  readonly state: TState;
  readonly capabilities: MlvViewVariantCapabilities;
  readonly locked?: boolean;
  readonly resultCount?: number;
  readonly ownerLabel?: string;
  readonly revision?: string | number;
  readonly updatedAt?: Date | string;
}

export interface MlvViewVariantBusyAction {
  readonly action: MlvViewVariantAction;
  readonly variantId?: string;
}

export interface MlvViewVariantCreateRequest<TState> {
  readonly name: string;
  readonly scope: Exclude<MlvViewVariantScope, 'system'>;
  readonly state: TState;
  readonly sourceId?: string;
}

export interface MlvViewVariantGroupLabels {
  readonly system: string;
  readonly team: string;
  readonly personal: string;
}
```

- [ ] **Step 4: Implement host-supplied normalization equality**

```ts
export function mlvViewStateEqual<TState, TNormalized>(
  first: TState,
  second: TState,
  normalize: (state: TState) => TNormalized,
): boolean {
  return JSON.stringify(normalize(first)) === JSON.stringify(normalize(second));
}
```

Document that the normalizer must return stable key/array order and exclude transient values.

- [ ] **Step 5: Export, test, and commit**

```bash
yarn nx test core-view-variant
yarn nx lint core-view-variant
git add libs/core/view-variant
git commit -m "feat(view-variant): define saved view state contracts"
```

---

### Task 3: Build controlled view navigation and permission-aware actions

**Files:**

- Create: `libs/core/view-variant/src/lib/view-variant-list/view-variant-list.ts`
- Create: `libs/core/view-variant/src/lib/view-variant-list/view-variant-list.html`
- Create: `libs/core/view-variant/src/lib/view-variant-list/view-variant-list.scss`
- Create: `libs/core/view-variant/src/lib/view-variant-list/view-variant-list.spec.ts`
- Create: `libs/core/view-variant/src/lib/view-variant-status/view-variant-status.ts`
- Create: `libs/core/view-variant/src/lib/view-variant-status/view-variant-status.html`
- Create: `libs/core/view-variant/src/lib/view-variant-status/view-variant-status.scss`
- Create: `libs/core/view-variant/src/lib/view-variant-status/view-variant-status.spec.ts`
- Modify: `libs/core/view-variant/src/index.ts`
- Modify: `libs/core/view-variant/CLAUDE.md`

**Interfaces:**

- `MlvViewVariantList<TState>` inputs/models: `variants`, `activeId`, `query`, `canCreate`, `createScopes`, `groupLabels`, `busyAction`, `errorMessage`.
- List outputs: `variantSelect: MlvViewVariant<TState>`, `createRequest: Exclude<MlvViewVariantScope, 'system'>`, `renameRequest` / `deleteRequest` / `shareRequest: MlvViewVariant<TState>`, and void `retryRequest` / `dismissError`.
- `MlvViewVariantStatus<TState>` inputs: `variant`, `dirty`, `canCreate`, `busyAction`, `errorMessage`; outputs: void `resetRequest` / `createRequest` / `retryRequest` / `dismissError` and `cloneRequest` / `updateRequest: MlvViewVariant<TState>`.

- [ ] **Step 1: Write permission-matrix and grouping tests**

```ts
it('groups variants as System, Team, and My views in stable order', () => {
  const headings = [...host.querySelectorAll('.mlv-view-variant-list__group-title')];
  expect(headings.map(node => node.textContent?.trim())).toEqual(['System', 'Team', 'My views']);
});

it('hides New view when creation is not permitted', () => {
  fixture.componentRef.setInput('canCreate', false);
  fixture.detectChanges();
  expect(buttonNamed(host, 'New view')).toBeUndefined();
});

it('shows only actions allowed by the active variant', () => {
  fixture.componentRef.setInput('variant', lockedSystemVariant);
  fixture.componentRef.setInput('dirty', true);
  fixture.detectChanges();
  expect(actionLabels(host)).toEqual(['Reset changes', 'Duplicate view']);
});

it('omits the status band for a clean editable variant', () => {
  fixture.componentRef.setInput('variant', editablePersonalVariant);
  fixture.componentRef.setInput('dirty', false);
  fixture.detectChanges();
  expect(host.querySelector('.mlv-view-variant-status')).toBeNull();
});
```

Add axe tests for default list, locked-dirty status, and error status.

- [ ] **Step 2: Run view component tests and verify RED**

```bash
yarn nx test core-view-variant
```

Expected: FAIL because list/status components do not exist.

- [ ] **Step 3: Implement controlled list derivations**

Use computed groups in System/Team/Personal order, diacritic-insensitive local search via `normalizeForMatch`, and active-id write-through only after emitting selection:

```ts
readonly variants = input.required<readonly MlvViewVariant<TState>[]>();
readonly activeId = model<string | null>(null);
readonly query = model('');
readonly canCreate = input(false);
readonly createScopes = input<readonly Exclude<MlvViewVariantScope, 'system'>[]>(['personal']);
readonly variantSelect = output<MlvViewVariant<TState>>();
readonly createRequest = output<Exclude<MlvViewVariantScope, 'system'>>();
readonly renameRequest = output<MlvViewVariant<TState>>();
readonly deleteRequest = output<MlvViewVariant<TState>>();
readonly shareRequest = output<MlvViewVariant<TState>>();
readonly retryRequest = output<void>();
readonly dismissError = output<void>();

protected _select(variant: MlvViewVariant<TState>): void {
  if (this._isBusy(variant.id)) return;
  this.activeId.set(variant.id);
  this.variantSelect.emit(variant);
}
```

Render native `<button>` rows inside grouped `<ul>` elements. Selected rows expose `aria-current="page"`; locked rows include visually hidden `Read-only` text; counts use tabular numerals.

- [ ] **Step 4: Implement the five resolved status modes**

```ts
protected readonly _mode = computed(() => {
  const variant = this.variant();
  if (!variant) return 'unsaved';
  if (variant.locked && this.dirty()) return 'locked-dirty';
  if (variant.locked) return 'locked-clean';
  return this.dirty() ? 'editable-dirty' : 'editable-clean';
});
```

Render the four visible modes from the approved spec: locked-clean, locked-dirty, editable-dirty, and unsaved. `editable-clean` returns no status band because there is no decision to make. Render actions only from `variant.capabilities` plus `canCreate`. Declare the status outputs explicitly as:

```ts
readonly resetRequest = output<void>();
readonly cloneRequest = output<MlvViewVariant<TState>>();
readonly updateRequest = output<MlvViewVariant<TState>>();
readonly createRequest = output<void>();
readonly retryRequest = output<void>();
readonly dismissError = output<void>();
```

A busy action disables only that operation, displays the Malva button loader, and sets `aria-busy` on the status region. Error text uses `role="status"`, not an assertive alert.

- [ ] **Step 5: Style the selected visual direction**

Use a 16–18rem list measure, quiet section labels, 2.5rem rows, selected pale accent background, tokenized separators, and no shadow. The status surface is a full-width bordered band with message at start and actions at end, stacking below `48rem`.

- [ ] **Step 6: Run tests, style gate, and commit**

```bash
yarn nx test core-view-variant
yarn nx lint core-view-variant
yarn nx run styles:check-padding-tokens
git add libs/core/view-variant
git commit -m "feat(view-variant): add controlled variant navigation"
```

---

### Task 4: Add filter expressions and compatibility adapters

**Files:**

- Modify: `libs/core/filter/src/lib/filter.types.ts`
- Create: `libs/core/filter/src/lib/filter-expression.ts`
- Create: `libs/core/filter/src/lib/filter-expression.spec.ts`
- Modify: `libs/core/filter/src/index.ts`
- Modify: `libs/core/filter/CLAUDE.md`

**Interfaces:**

- Produces: `MlvFilterExpression`, `mlvFilterFieldsToExpression()`, `mlvFilterExpressionToFields()`, and `mlvMatchesFilterExpression()`.
- Preserves: `MlvFilterFieldState[]` and all existing operator names.

- [ ] **Step 1: Write expression adapter/evaluator tests**

```ts
const expression: MlvFilterExpression = {
  kind: 'group', combinator: 'and', children: [
    { kind: 'condition', key: 'health', condition: { operator: 'equals', value: 'risk' } },
    { kind: 'group', combinator: 'or', children: [
      { kind: 'condition', key: 'region', condition: { operator: 'equals', value: 'EU' } },
      { kind: 'condition', key: 'region', condition: { operator: 'equals', value: 'UK' } },
    ] },
  ],
};
expect(mlvMatchesFilterExpression({ health: 'risk', region: 'UK' }, expression, (row, key) => row[key]))
  .toBe(true);
expect(mlvMatchesFilterExpression({ health: 'healthy', region: 'UK' }, expression, (row, key) => row[key]))
  .toBe(false);
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
yarn nx test core-filter
```

Expected: FAIL because expression types and helpers are missing.

- [ ] **Step 3: Define the recursive expression model**

```ts
export type MlvFilterExpression =
  | { readonly kind: 'condition'; readonly key: string; readonly condition: MlvFilterCondition }
  | {
      readonly kind: 'group';
      readonly combinator: MlvFilterConditionStrategy;
      readonly children: readonly MlvFilterExpression[];
    };
```

Convert flat fields to one top-level `and` group; each field with multiple conditions becomes a nested group using its existing `strategy`. Reverse conversion accepts only expressions representable by the flat model and returns `null` for cross-field OR groups.

- [ ] **Step 4: Implement every existing operator in the evaluator**

Use the same null, string normalization, numeric comparison, range, and membership behavior as the existing data source. Empty/not-empty require no operand. `mlvMatchesFilterExpression` receives a value reader so the filter package stays domain-neutral.

- [ ] **Step 5: Test, document, and commit**

```bash
yarn nx test core-filter
yarn nx lint core-filter
git add libs/core/filter
git commit -m "feat(filter): add grouped filter expressions"
```

---

### Task 5: Add the natural-language query appearance

**Files:**

- Modify: `libs/core/filter/src/lib/filter/filter.ts`
- Modify: `libs/core/filter/src/lib/filter/filter.html`
- Modify: `libs/core/filter/src/lib/filter/filter.scss`
- Modify: `libs/core/filter/src/lib/filter/filter.spec.ts`
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.ts`
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.html`
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.scss`
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.spec.ts`
- Modify: `libs/core/filter/src/lib/filter.types.ts`

**Interfaces:**

- Produces: `MlvSmartFilterBarAppearance = 'classic' | 'query'` and `appearance` input defaulting to `classic`.
- Produces: `expression` in `MlvFilterExecutionPayload` while preserving `search`, `filters`, and `visibleKeys`.

- [ ] **Step 1: Write query-mode interaction tests**

```ts
it('renders active conditions as readable query chips', () => {
  fixture.componentRef.setInput('appearance', 'query');
  component.filters.set([{
    key: 'health', strategy: 'and',
    conditions: [{ operator: 'equals', value: 'risk' }],
  }]);
  fixture.detectChanges();
  expect(host.textContent).toContain('Health is At risk');
  expect(host.textContent).toContain('Add filter');
  expect(host.textContent).not.toContain('Manage filters');
});

it('emits a grouped expression without removing the flat payload', () => {
  const payload = executeOnce();
  expect(payload.filters).toHaveLength(2);
  expect(payload.expression.kind).toBe('group');
});
```

Add tests for searched Add filter selection, focus restoration, chip removal, wrapping, explicit Apply, live execution, and axe-clean open popups.

- [ ] **Step 2: Run Smart Filter tests and verify RED**

```bash
yarn nx test core-filter
```

Expected: query appearance assertions fail while every classic test still passes.

- [ ] **Step 3: Add sentence presentation to `MlvFilter`**

Add `appearance = input<'field' | 'query'>('field')` and a computed sentence assembled from definition label, operator label, and human-readable operand. The query host binds `mlv-filter--query`; its trigger remains a native Malva button and its remove control uses `aria-label="Remove <field> filter"`.

- [ ] **Step 4: Branch Smart Filter template by appearance**

Keep the current template under `@if (appearance() === 'classic')`. Query mode renders the optional search field, one `MlvFilter appearance="query"` per meaningful/required state, a searchable Add filter popup, conditional Clear all, and explicit Apply only when `filterApplyMode() === 'explicit'`.

The Add filter menu excludes disabled definitions and non-repeatable active fields. Choosing a field appends its key to `visibleKeys`, creates no fake operand, closes the popup, and focuses the field trigger after render.

- [ ] **Step 5: Extend execution payload immutably**

```ts
return {
  search: this.searchValue(),
  filters: cloneFieldStates(this.filters()),
  visibleKeys: [...this.visibleKeys()],
  expression: mlvFilterFieldsToExpression(this.filters()),
};
```

Update the public payload interface and every exact-object test.

- [ ] **Step 6: Style query wrapping and anchored editors**

Use one wrapping flex row, 2rem chip height, stable tokenized gap, and a transparent Add filter button. Long labels use ellipsis at 18rem with the full sentence in the accessible name/title. At narrow widths the search occupies a full row before chips; no horizontal scrolling.

- [ ] **Step 7: Run compatibility, axe, style, and lint checks**

```bash
yarn nx test core-filter
yarn nx lint core-filter
yarn nx run styles:check-padding-tokens
```

Expected: every existing classic test plus query-mode and axe tests PASS.

- [ ] **Step 8: Commit query filtering**

```bash
git add libs/core/filter
git commit -m "feat(filter): add natural language query filters"
```

---

### Task 6: Add the data-table presentation snapshot API

**Files:**

- Modify: `libs/core/data-table/src/lib/types.ts`
- Modify: `libs/core/data-table/src/lib/data-table/services/data-table-column-visibility.service.ts`
- Modify: `libs/core/data-table/src/lib/data-table/services/data-table-pinning.service.ts`
- Modify: `libs/core/data-table/src/lib/data-table/data-table.ts`
- Modify: `libs/core/data-table/src/lib/data-table/data-table.html`
- Create: `libs/core/data-table/src/lib/data-table/data-table-presentation-state.spec.ts`
- Modify: `libs/core/data-table/src/index.ts`
- Modify: `libs/core/data-table/CLAUDE.md`

**Interfaces:**

- Produces: `MlvDataTablePresentationState`.
- Produces: `getPresentationState()`, `applyPresentationState()`, and `presentationStateChange`.
- Adds internal `replaceHiddenColumns()` and `replaceOverrides()` service methods.

- [ ] **Step 1: Write capture/apply/no-feedback-loop tests**

```ts
it('captures only durable table presentation', () => {
  table.onSortClick(columns[1]);
  table.toggleColumnVisibility('owner');
  table.pinTo(columns[2], 'right');
  expect(table.getPresentationState()).toMatchObject({
    sort: { key: 'name', direction: 'asc' },
    visibleColumnKeys: ['name', 'health'],
    pinnedEndColumnKeys: ['health'],
    columnWidths: {},
    perPage: 10,
  });
});

it('ignores unknown keys and emits no echo while applying state', () => {
  const changed = vi.fn();
  table.presentationStateChange.subscribe(changed);
  table.applyPresentationState({
    visibleColumnKeys: ['name', 'missing'],
    pinnedEndColumnKeys: ['health', 'missing'],
    columnWidths: { name: 9999, missing: 12 },
    perPage: 25,
  });
  expect(table.getPresentationState().visibleColumnKeys).toEqual(['name']);
  expect(changed).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
yarn nx test core-data-table
```

Expected: FAIL because the state type and APIs are missing.

- [ ] **Step 3: Define the public snapshot**

```ts
export interface MlvDataTablePresentationState {
  readonly sort: MlvSortState | null;
  readonly visibleColumnKeys: readonly string[];
  readonly pinnedStartColumnKeys: readonly string[];
  readonly pinnedEndColumnKeys: readonly string[];
  readonly columnWidths: Readonly<Record<string, number>>;
  readonly perPage: number;
}
```

Import `MlvSortState` as a type from `@malva-ui/cdk/data-source`. The component methods are `getPresentationState(): MlvDataTablePresentationState` and `applyPresentationState(state: Partial<MlvDataTablePresentationState>): void`; `presentationStateChange` emits the full normalized snapshot.

- [ ] **Step 4: Add service replacement APIs**

`replaceHiddenColumns(keys)` replaces the hidden set after filtering to current columns. `replaceOverrides(entries)` replaces pin overrides from normalized `{ key, pinned, pinSide }` entries. Both clone their inputs and remain component-scoped.

- [ ] **Step 5: Implement capture and apply**

`getPresentationState()` returns columns in declaration order, clones sort, converts the width map to a plain object, and derives start/end pin keys from effective state. `applyPresentationState()` filters unknown keys, clamps per-page to at least 1, clamps widths through `_columnResizeBounds`, updates services/signals, resets current page to 1, schedules width measurement, and deliberately does not emit `presentationStateChange`.

- [ ] **Step 6: Emit one snapshot after each user gesture**

Add private `_emitPresentationStateChange()` and call it after sort, column visibility, pin/unpin, committed resize/reset, and items-per-page changes. Replace paginator two-way syntax with explicit handlers:

```html
<mlv-pagination
  [totalItems]="totalItems()"
  [currentPage]="currentPage()"
  [itemsPerPage]="currentPerPage()"
  (currentPageChange)="_onPageChange($event)"
  (itemsPerPageChange)="_onPerPageChange($event)"
/>
```

Page changes remain transient; `_onPageChange` does not emit presentation state. `_onPerPageChange` resets page to 1 and emits once.

- [ ] **Step 7: Run data-table regression and integration tests**

```bash
yarn nx test core-data-table
yarn nx lint core-data-table
yarn nx run styles:check-padding-tokens
```

Expected: current sorting, resizing, pinning, visibility, pagination, virtual-scroll, and accessibility tests remain green.

- [ ] **Step 8: Commit table snapshots**

```bash
git add libs/core/data-table
git commit -m "feat(data-table): expose presentation snapshots"
```

---

### Task 7: Add reference examples and complete cross-package verification

**Files:**

- Create: `apps/docs/src/app/pages/filter/examples/4/index.ts`
- Create: `apps/docs/src/app/pages/filter/examples/4/index.html`
- Create: `apps/docs/src/app/pages/filter/examples/4/index.scss`
- Create: `apps/docs/src/app/pages/filter/examples/4/index.mdx`
- Create: `apps/docs/src/app/pages/filter/examples/4/index.spec.ts`
- Modify: `apps/docs/src/app/pages/filter/index.ts`
- Create: `apps/docs/src/app/pages/data-table/examples/22/index.ts`
- Create: `apps/docs/src/app/pages/data-table/examples/22/index.html`
- Create: `apps/docs/src/app/pages/data-table/examples/22/index.scss`
- Create: `apps/docs/src/app/pages/data-table/examples/22/index.mdx`
- Create: `apps/docs/src/app/pages/data-table/examples/22/index.spec.ts`
- Modify: `apps/docs/src/app/pages/data-table/index.ts`
- Modify: `apps/docs/CLAUDE.md`

**Interfaces:**

- Filter example proves natural-language chips, Add filter, explicit/live modes, and grouped expressions.
- Data-table example proves capture, mutate, apply, and reset of presentation state without saved-view UI.

- [ ] **Step 1: Add docs smoke tests for both new examples**

The filter test adds/removes a query condition and asserts the emitted expression. The table test captures state, changes sort/visibility, reapplies the snapshot, and expects restoration.

- [ ] **Step 2: Run the docs tests and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test -- src/app/pages/filter/examples/4/index.spec.ts src/app/pages/data-table/examples/22/index.spec.ts
```

Expected: FAIL until the example files and page counts exist.

- [ ] **Step 3: Build realistic reference examples**

Use accounts/renewals content and normal-width canvases. Keep persistence out of both pages; saved System/Team/My view composition belongs to `/showcases/data-operations`.

- [ ] **Step 4: Update public docs and API extraction inputs**

Document exact signatures, defaults, capability visibility, expression compatibility, snapshot exclusions, and examples. Run `yarn nx run docs:extract-api` and verify generated output through `yarn nx run docs:check-doc-api` without committing ignored generated API files.

- [ ] **Step 5: Run full verification**

```bash
yarn nx test core-view-variant
yarn nx test core-filter
yarn nx test core-data-table
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test
yarn nx lint core-view-variant
yarn nx lint core-filter
yarn nx lint core-data-table
yarn nx run styles:check-padding-tokens
yarn nx run docs:check-doc-api
yarn nx build core
yarn nx build docs
```

Expected: every command exits 0 and grouped package build includes `@malva-ui/core/view-variant`.

- [ ] **Step 6: Commit docs and final integration adjustments**

```bash
git add apps/docs libs/core/view-variant libs/core/filter libs/core/data-table
git commit -m "docs(filter): document saved view composition"
```
