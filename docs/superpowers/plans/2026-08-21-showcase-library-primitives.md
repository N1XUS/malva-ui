# Showcase Composition Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Data Operations' generic layout and table behavior into reusable Malva primitives, then rebuild the route as a minimal public-API composition with verified design tokens.

**Architecture:** Sidebar owns its surface appearance, Page owns the responsive trailing pane, Data Table owns search/sort/columns, and the shared overlay layer owns optional focus restoration. Data Operations keeps only deterministic fixtures, URL/view state, simulated persistence, and domain cell rendering; all generic responsive, filtering, and overlay behavior is consumed from public `@malva-ui` entry points.

**Tech Stack:** Angular 22 signals and standalone components, Angular CDK Overlay/A11y, Malva Page/Sidebar/Drawer/Menu/Data Table/Filter/View Variant, SCSS BEM and generated design tokens, Vitest/jsdom, axe-core, Nx, in-app Browser visual review.

**Spec:** `docs/superpowers/specs/2026-08-21-showcase-library-primitives-design.md`

## Global Constraints

- Preserve current public defaults: Sidebar remains raised, Drawer restores focus, and Data Table does not show a Sort menu unless opted in.
- `MlvSidebarAppearance` is exactly `'raised' | 'flat'`; flat removes outer radius and shadow but retains the component border and background.
- `MlvPageEndPane` owns one logical `opened` state and one projected content instance across inline and Drawer renderers.
- Data Operations uses public `mlvFilterFieldsToExpression`, `mlvFilterExpressionToFields`, and `mlvMatchesFilterExpression`; it must not keep local conversions or evaluation.
- A showcase may own fixtures, URL state, simulated persistence, and domain rendering only. Generic shell, responsive pane, search, sort, columns, menu, or overlay behavior belongs to Malva.
- Every referenced global `--mlv-*` name must resolve under `yarn nx run styles:check-tokens --strict --skipNxCache`; never add a baseline entry.
- Use native `click` from the inner button of `mlv-button-close`; never decorate the close-component host with `mlvClick`.
- Use Malva components and named Lucide directives for visible controls. Do not introduce emoji, text-symbol icons, inline SVG, CSS art, or placeholder assets.
- Follow the component, BEM SCSS, and accessibility rules in `.claude/rules/` and update each affected project documentation backing file.
- Visual review uses only the in-app Browser, never clicks fullscreen, and compares the approved reference and implementation at the same viewport and state.

---

### Task 1: Add a flat Sidebar appearance

**Files:**

- Create: `libs/core/sidebar/src/lib/sidebar-appearance.ts`
- Modify: `libs/core/sidebar/src/lib/sidebar/sidebar.ts`
- Modify: `libs/core/sidebar/src/lib/sidebar/sidebar.scss`
- Modify: `libs/core/sidebar/src/lib/sidebar/sidebar.spec.ts`
- Modify: `libs/core/sidebar/src/index.ts`
- Create: `apps/docs/src/app/pages/sidebar/examples/10/index.ts`
- Create: `apps/docs/src/app/pages/sidebar/examples/10/index.html`
- Create: `apps/docs/src/app/pages/sidebar/examples/10/index.scss`
- Create: `apps/docs/src/app/pages/sidebar/examples/10/index.mdx`
- Modify: `apps/docs/src/app/pages/sidebar/index.ts`
- Modify: `.claude/projects/libs-sidebar.md`
- Modify: `.claude/projects/page-sidebar.md`

**Interfaces:**

- Produces: `export type MlvSidebarAppearance = 'raised' | 'flat'`.
- Produces: `MlvSidebar.appearance = input<MlvSidebarAppearance>('raised')`.
- Produces: host modifiers `mlv-sidebar--raised` and `mlv-sidebar--flat`.
- Preserves: all current mode, responsive collapse, width, and Drawer contracts.

- [ ] **Step 1: Write the failing appearance contract tests**

Add a host that can switch the signal input and assertions that the default stays raised, flat is opt-in, and the SCSS modifier contains only the intended surface reset:

```ts
@Component({
  imports: [MlvSidebar],
  template: `<mlv-sidebar [appearance]="appearance()">Views</mlv-sidebar>`,
})
class AppearanceHost {
  readonly appearance = signal<MlvSidebarAppearance>('raised');
}

it('keeps the raised appearance as the default', () => {
  const sidebar = fixture.nativeElement.querySelector('.mlv-sidebar');
  expect(sidebar.classList).toContain('mlv-sidebar--raised');
  expect(sidebar.classList).not.toContain('mlv-sidebar--flat');
});

it('applies the flat modifier without changing mode', () => {
  host.appearance.set('flat');
  fixture.detectChanges();
  const sidebar = fixture.nativeElement.querySelector('.mlv-sidebar');
  expect(sidebar.classList).toContain('mlv-sidebar--flat');
  expect(sidebar.classList).toContain('mlv-sidebar--icon');
});

it('defines the flat surface with real zero-elevation tokens', () => {
  const flat = declarationsFor('.mlv-sidebar--flat');
  expect(flat).toContain('border-radius: 0');
  expect(flat).toContain('box-shadow: var(--mlv-shadow-0)');
  expect(flat).not.toContain('background: transparent');
});
```

- [ ] **Step 2: Run the Sidebar suite and verify RED**

```bash
yarn nx test core-sidebar --skipNxCache
```

Expected: FAIL because `MlvSidebarAppearance`, `appearance`, and the flat modifier do not exist.

- [ ] **Step 3: Implement the public appearance type and host class**

```ts
// sidebar-appearance.ts
/** Outer surface treatment of an inline Sidebar. */
export type MlvSidebarAppearance = 'raised' | 'flat';
```

```ts
// sidebar.ts
readonly appearance = input<MlvSidebarAppearance>('raised');

// component host
'[class.mlv-sidebar--raised]': 'appearance() === "raised"',
'[class.mlv-sidebar--flat]': 'appearance() === "flat"',
```

```scss
.mlv-sidebar--flat {
  border-radius: 0;
  box-shadow: var(--mlv-shadow-0);
}
```

Export the type from `libs/core/sidebar/src/index.ts`. Do not change the existing base surface or the Page Shell's chrome remapping.

- [ ] **Step 4: Add the appearance documentation example**

Render the same concise navigation twice, one raised and one flat, with a visible label above each. The MDX must state that flat removes only radius/shadow and that Page Shell still owns its chrome seam:

```html
<section class="sidebar-appearance-example" aria-label="Sidebar appearances">
  <div>
    <h3>Raised</h3>
    <mlv-sidebar ariaLabel="Raised navigation">
      <mlv-sidebar-item label="Overview" active />
      <mlv-sidebar-item label="Activity" />
    </mlv-sidebar>
  </div>
  <div>
    <h3>Flat</h3>
    <mlv-sidebar appearance="flat" ariaLabel="Flat navigation">
      <mlv-sidebar-item label="Overview" active />
      <mlv-sidebar-item label="Activity" />
    </mlv-sidebar>
  </div>
</section>
```

Use only spacing tokens in the example SCSS. Increment the Sidebar page examples from 9 to 10 and document the exact public type/input in both backing files.

- [ ] **Step 5: Run focused verification and commit**

```bash
yarn nx test core-sidebar --skipNxCache
yarn nx lint core-sidebar --skipNxCache
yarn nx typecheck core-sidebar --skipNxCache
yarn nx typecheck docs --skipNxCache
yarn nx lint docs --skipNxCache
git diff --check
git add libs/core/sidebar apps/docs/src/app/pages/sidebar .claude/projects/libs-sidebar.md .claude/projects/page-sidebar.md
git commit -m "feat(sidebar): add flat surface appearance"
```

The workspace-wide strict token gate remains intentionally RED until Task 5 removes the three Data Operations findings. Guard the Task 1 diff directly: no Sidebar or example line may contain those names, and no new global token name may be introduced without a declaration in `libs/styles/src/lib/theme.scss`.

---

### Task 2: Add the responsive Page end pane and logical focus lifecycle

**Files:**

- Modify: `libs/cdk/overlay/src/lib/overlay-host-base.ts`
- Modify: `libs/cdk/overlay/src/lib/overlay.spec.ts`
- Create: `libs/core/page/src/lib/page-end-pane/page-end-pane-content.ts`
- Create: `libs/core/page/src/lib/page-end-pane/page-end-pane-trigger.ts`
- Create: `libs/core/page/src/lib/page-end-pane/page-end-pane.ts`
- Create: `libs/core/page/src/lib/page-end-pane/page-end-pane.html`
- Create: `libs/core/page/src/lib/page-end-pane/page-end-pane.scss`
- Create: `libs/core/page/src/lib/page-end-pane/page-end-pane.spec.ts`
- Modify: `libs/core/page/src/lib/page-shell/page-shell.html`
- Modify: `libs/core/page/src/lib/page-shell/page-shell.scss`
- Modify: `libs/core/page/src/lib/page-shell/page-shell.spec.ts`
- Modify: `libs/core/page/src/index.ts`
- Create: `apps/docs/src/app/pages/page/examples/4/index.ts`
- Create: `apps/docs/src/app/pages/page/examples/4/index.html`
- Create: `apps/docs/src/app/pages/page/examples/4/index.scss`
- Create: `apps/docs/src/app/pages/page/examples/4/index.mdx`
- Create: `apps/docs/src/app/pages/page/examples/4/index.spec.ts`
- Modify: `apps/docs/src/app/pages/page/index.ts`
- Modify: `.claude/projects/libs-page.md`
- Modify: `.claude/projects/page-page.md`

**Interfaces:**

- Produces: `MlvOverlayHostBase.restoreFocus`, a coerced boolean input defaulting to `true`.
- Produces: `MlvPageEndPaneContent`, a structural template directive.
- Produces: `MlvPageEndPane` with `opened`, `width`, `collapseBelow`, `ariaLabel`, `closeOnBackdropClick`, `closeOnEscape`, `initialFocus`, `open()`, `close()`, `toggle()`, `afterOpened`, and `afterClosed`.
- Produces: `MlvPageEndPaneTrigger`, a native-button directive taking a required pane instance.
- Preserves: existing `[mlvPageEndSidebar]` projection and Drawer focus restoration defaults.

- [ ] **Step 1: Write the overlay focus opt-out test**

Extend the existing declarative overlay test host to bind `[restoreFocus]="restoreFocus()"`, then prove the default and opt-out paths independently:

```ts
it('restores focus by default after disposal', async () => {
  trigger.focus();
  host.opened.set(true);
  fixture.detectChanges();
  host.opened.set(false);
  finishLeaveAnimation();
  expect(document.activeElement).toBe(trigger);
});

it('does not restore focus when restoreFocus is false', async () => {
  host.restoreFocus.set(false);
  trigger.focus();
  host.opened.set(true);
  fixture.detectChanges();
  fallback.focus();
  host.opened.set(false);
  finishLeaveAnimation();
  expect(document.activeElement).toBe(fallback);
});
```

- [ ] **Step 2: Write the failing Page end-pane behavior tests**

Create a host with a controlled breakpoint provider, an explicit trigger, one focusable content control, and counters for logical lifecycle outputs. Cover these exact cases:

```ts
it('renders one named inline aside while opened above the breakpoint', () => {
  host.open.set(true);
  fixture.detectChanges();
  expect(document.querySelectorAll('[data-pane-content]')).toHaveLength(1);
  const aside = fixture.nativeElement.querySelector('aside');
  expect(aside.getAttribute('aria-label')).toBe('Account details');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('renders one modal Drawer below the breakpoint without reserving host width', () => {
  breakpoint.setDown('lg', true);
  host.open.set(true);
  fixture.detectChanges();
  expect(document.querySelectorAll('[data-pane-content]')).toHaveLength(1);
  expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label'))
    .toBe('Account details');
  expect(paneElement.classList).toContain('mlv-page-end-pane--overlay');
});

it('migrates an open pane in both directions without duplicate content or lifecycle emissions', () => {
  host.open.set(true);
  fixture.detectChanges();
  expect(host.openedCount).toBe(1);
  breakpoint.setDown('lg', true);
  fixture.detectChanges();
  breakpoint.setDown('lg', false);
  fixture.detectChanges();
  expect(host.open()).toBe(true);
  expect(host.openedCount).toBe(1);
  expect(host.closedCount).toBe(0);
  expect(document.querySelectorAll('[data-pane-content]')).toHaveLength(1);
});

it('synchronizes Escape and backdrop dismissal, then restores the opening trigger', () => {
  breakpoint.setDown('lg', true);
  trigger.focus();
  trigger.click();
  fixture.detectChanges();
  dispatchKeyboardEvent(document.querySelector('.mlv-drawer')!, 'keydown', 'Escape');
  finishDrawerLeaveAnimation();
  expect(host.open()).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it('removes closed inline content from the tab order', () => {
  host.open.set(false);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-pane-action]')).toBeNull();
});
```

Also add an axe test for inline and compact states and a destroy-while-open test that leaves no overlay pane.

- [ ] **Step 3: Run the overlay and Page suites and verify RED**

```bash
yarn nx test cdk-overlay --skipNxCache
yarn nx test core-page --skipNxCache
```

Expected: the overlay opt-out assertion fails and Page tests cannot import the new primitives.

- [ ] **Step 4: Implement optional overlay focus restoration**

```ts
readonly restoreFocus = input<boolean, BooleanInput>(true, {
  transform: coerceBooleanProperty,
});
```

Guard the existing disposal path without changing its ordering:

```ts
const trigger = this._triggerElement;
this._triggerElement = null;
if (this.restoreFocus() && trigger?.isConnected) {
  trigger.focus();
}
this.afterClosed.emit();
```

- [ ] **Step 5: Implement the Page end-pane primitives**

The content directive is a typed `TemplateRef` owner:

```ts
@Directive({ selector: 'ng-template[mlvPageEndPaneContent]' })
export class MlvPageEndPaneContent {
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}
```

The trigger is restricted to native buttons and mirrors the pane state:

```ts
@Directive({
  selector: 'button[mlvPageEndPaneTrigger]',
  host: {
    '(click)': 'mlvPageEndPaneTrigger().toggle()',
    '[attr.aria-expanded]': 'mlvPageEndPaneTrigger().opened()',
    '[attr.aria-controls]': 'mlvPageEndPaneTrigger().panelId',
  },
})
export class MlvPageEndPaneTrigger {
  readonly mlvPageEndPaneTrigger = input.required<MlvPageEndPane>();
}
```

The pane uses `MlvBreakpointService`, a single content `TemplateRef`, and one logical transition tracker. Its public surface is:

```ts
readonly opened = model(false);
readonly width = input('20rem');
readonly collapseBelow = input<MlvBreakpoint | null>(null);
readonly ariaLabel = input.required<string>();
readonly closeOnBackdropClick = input<boolean, BooleanInput>(true, {
  transform: coerceBooleanProperty,
});
readonly closeOnEscape = input<boolean, BooleanInput>(true, {
  transform: coerceBooleanProperty,
});
readonly initialFocus = input<MlvOverlayInitialFocus>('auto');
readonly afterOpened = output<void>();
readonly afterClosed = output<void>();
readonly panelId = mlvNextId('mlv-page-end-pane');

protected readonly _content = contentChild.required(MlvPageEndPaneContent);
protected readonly _compact = computed(() => {
  const breakpoint = this.collapseBelow();
  return breakpoint !== null && this._breakpoints.isDown(breakpoint)();
});

open(): void { this.opened.set(true); }
close(): void { this.opened.set(false); }
toggle(): void { this.opened.update((value) => !value); }
```

Bind `panelId` to the `mlv-page-end-pane` host so the trigger's `aria-controls` always resolves in inline, overlay, open, and closed states. Do not duplicate the same id on the inline `aside`.

Render only one branch:

```html
@if (_compact()) {
  <mlv-drawer
    [opened]="opened()"
    position="right"
    [size]="width()"
    [ariaLabel]="ariaLabel()"
    [closeOnBackdropClick]="closeOnBackdropClick()"
    [closeOnEscape]="closeOnEscape()"
    [initialFocus]="initialFocus()"
    [restoreFocus]="false"
    (openedChange)="_onDrawerOpenedChange($event)"
    (afterClosed)="_onDrawerDisposed()"
  >
    <ng-template mlvDrawerContent>
      <ng-container [ngTemplateOutlet]="_content().templateRef" />
    </ng-template>
  </mlv-drawer>
} @else if (opened()) {
  <aside
    class="mlv-page-end-pane__surface"
    [attr.aria-label]="ariaLabel()"
  >
    <ng-container [ngTemplateOutlet]="_content().templateRef" />
  </aside>
}
```

The component, not Drawer, captures `document.activeElement` only on `false → true`, retains it during breakpoint migration, and restores it only on a real `true → false` close after the active renderer is gone. Track the prior logical state separately from `_compact()` so a renderer migration cannot emit lifecycle events. `close()` marks the close pending; inline mode completes it with `afterNextRender`, while compact mode completes it from the internal Drawer's `afterClosed`. The shared completion helper must guard `isConnected`, restore once, clear the stored element, and emit `afterClosed` once.

- [ ] **Step 6: Integrate Page Shell projection and document the primitive**

Change the trailing projection to:

```html
<ng-content select="[mlvPageEndSidebar], mlv-page-end-pane" />
```

Add both selectors to the end-slot flex geometry. The Page example uses the public directive and content slot directly:

```html
<button mlvButton type="button" [mlvPageEndPaneTrigger]="details">
  Account details
</button>
<mlv-page-end-pane
  #details
  collapseBelow="lg"
  width="20rem"
  ariaLabel="Account details"
>
  <ng-template mlvPageEndPaneContent>
    <section class="page-end-pane-example__details">
      <h3>Northwind Traders</h3>
      <dl>
        <div><dt>Owner</dt><dd>Alex Morgan</dd></div>
        <div><dt>Plan</dt><dd>Enterprise</dd></div>
      </dl>
      <button mlvButton type="button" variant="secondary" (click)="details.close()">
        Close details
      </button>
    </section>
  </ng-template>
</mlv-page-end-pane>
```

Its test clicks the rendered trigger and close button, crosses `lg`, and dismisses the compact Drawer through Escape/backdrop; no test may call private handlers.

Increment Page examples from `[1, 2, 3]` to `[1, 2, 3, 4]`. Document the exact inputs, outputs, single-template rule, focus behavior, and static end-sidebar compatibility.

- [ ] **Step 7: Run focused verification and commit**

```bash
yarn nx test cdk-overlay --skipNxCache
yarn nx test core-page --skipNxCache
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache -- src/app/pages/page/examples/4/index.spec.ts
yarn nx lint core-page --skipNxCache
yarn nx typecheck core-page --skipNxCache
yarn nx typecheck docs --skipNxCache
yarn nx run styles:check-padding-tokens
git diff --check
git add libs/cdk/overlay libs/core/page apps/docs/src/app/pages/page .claude/projects/libs-page.md .claude/projects/page-page.md
git commit -m "feat(page): add responsive end pane"
```

---

### Task 3: Remove nested interactive close-button hosts

**Files:**

- Modify: `libs/core/search-field/src/lib/search-field/search-field.html`
- Modify: `libs/core/search-field/src/lib/search-field/search-field.ts`
- Modify: `libs/core/search-field/src/lib/search-field/search-field.spec.ts`
- Modify: `libs/core/alert/src/lib/alert/alert.html`
- Modify: `libs/core/alert/src/lib/alert/alert.ts`
- Modify: `libs/core/alert/src/lib/alert/alert.spec.ts`
- Modify: `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.html`
- Modify: `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.ts`
- Modify: `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.spec.ts`
- Modify: `libs/core/combobox/src/lib/combobox/combobox.html`
- Modify: `libs/core/combobox/src/lib/combobox/combobox.ts`
- Modify: `libs/core/combobox/src/lib/combobox/combobox.spec.ts`
- Modify: `libs/core/select/src/lib/select/select.html`
- Modify: `libs/core/select/src/lib/select/select.spec.ts`

**Interfaces:**

- Consumes: the native `click` event bubbled from `mlv-button-close`'s inner native button.
- Preserves: clear/dismiss outputs, disabled behavior, pointer focus preservation, Select's `mlvClick` trigger, and all public APIs.
- Removes: `role="button"` and `tabindex="0"` accidentally applied to close-component hosts.

- [ ] **Step 1: Add failing structural and axe regressions**

For each affected component, render the clear/dismiss state and assert one interactive descendant and no interactive host:

```ts
const closeHost = fixture.nativeElement.querySelector('mlv-button-close');
expect(closeHost).not.toBeNull();
expect(closeHost.getAttribute('role')).toBeNull();
expect(closeHost.getAttribute('tabindex')).toBeNull();
expect(closeHost.querySelectorAll('button')).toHaveLength(1);

const results = await axe(fixture.nativeElement, {
  rules: { 'color-contrast': { enabled: false } },
});
expect(results.violations.map(({ id }) => id)).not.toContain(
  'nested-interactive',
);
```

Click `mlv-button-close button`, then assert the existing clear/dismiss output fires exactly once. In Search Field, assert mousedown still keeps the text input focused.

- [ ] **Step 2: Run all five suites and verify RED**

```bash
yarn nx test core-search-field --skipNxCache
yarn nx test core-alert --skipNxCache
yarn nx test core-form-utils --skipNxCache
yarn nx test core-combobox --skipNxCache
yarn nx test core-select --skipNxCache
```

Expected: structural or axe assertions fail because `mlvClick` decorates each close host.

- [ ] **Step 3: Replace only close-host event bindings**

Apply these exact template substitutions:

```html
(mlvClick)="_clear()"       → (click)="_clear()"
(mlvClick)="_onDismiss()"  → (click)="_onDismiss()"
(mlvClick)="_onClearClick()" → (click)="_onClearClick()"
(mlvClick)="onClear()"     → (click)="onClear()"
```

Remove `MlvClick` from Search Field, Alert, Form Control Wrapper, and Combobox imports because those templates have no other use. Retain `MlvClick` in Select for `.mlv-select__trigger`; change only the `mlv-button-close` binding.

- [ ] **Step 4: Run verification and commit**

```bash
yarn nx run-many -t test -p core-search-field core-alert core-form-utils core-combobox core-select --skipNxCache
yarn nx run-many -t lint -p core-search-field core-alert core-form-utils core-combobox core-select --skipNxCache
yarn nx run-many -t typecheck -p core-search-field core-alert core-form-utils core-combobox core-select --skipNxCache
git diff --check
git add libs/core/search-field libs/core/alert libs/core/form-utils libs/core/combobox libs/core/select
git commit -m "fix(forms): remove nested close interactions"
```

---

### Task 4: Add the Data Table-owned Sort menu

**Files:**

- Modify: `libs/core/data-table/src/lib/data-table/data-table.ts`
- Modify: `libs/core/data-table/src/lib/data-table/data-table.html`
- Modify: `libs/core/data-table/src/lib/data-table/data-table.scss`
- Create: `libs/core/data-table/src/lib/data-table-toolbar-actions.ts`
- Modify: `libs/core/data-table/src/lib/data-table/data-table.spec.ts`
- Modify: `libs/core/data-table/src/lib/data-table/data-table-presentation-state.spec.ts`
- Modify: `libs/core/data-table/src/index.ts`
- Modify: `libs/i18n/src/lib/tokens/data-table.ts`
- Modify: `libs/i18n/src/lib/provide-i18n.spec.ts`
- Modify: `libs/i18n/tests/locale-contract.spec.ts`
- Modify: `libs/i18n/project.json`
- Modify: `libs/i18n/en/src/lib/en.ts`
- Modify: `libs/i18n/de/src/lib/de.ts`
- Modify: `libs/i18n/es/src/lib/es.ts`
- Modify: `libs/i18n/fr/src/lib/fr.ts`
- Modify: `libs/i18n/id/src/lib/id.ts`
- Modify: `libs/i18n/it/src/lib/it.ts`
- Modify: `libs/i18n/ja/src/lib/ja.ts`
- Modify: `libs/i18n/nl/src/lib/nl.ts`
- Modify: `libs/i18n/pl/src/lib/pl.ts`
- Modify: `libs/i18n/pt/src/lib/pt.ts`
- Modify: `libs/i18n/ro/src/lib/ro.ts`
- Modify: `libs/i18n/tr/src/lib/tr.ts`
- Modify: `libs/i18n/uk/src/lib/uk.ts`
- Modify: `libs/i18n/zh-Hans/src/lib/zh-Hans.ts`
- Create: `apps/docs/src/app/pages/data-table/examples/23/index.ts`
- Create: `apps/docs/src/app/pages/data-table/examples/23/index.html`
- Create: `apps/docs/src/app/pages/data-table/examples/23/index.mdx`
- Create: `apps/docs/src/app/pages/data-table/examples/23/index.spec.ts`
- Modify: `apps/docs/src/app/pages/data-table/index.ts`
- Modify: `.claude/projects/libs-data-table.md`
- Modify: `.claude/projects/page-data-table.md`

**Interfaces:**

- Produces: `MlvDataTable.showSortMenu`, a coerced boolean input defaulting to `false`.
- Produces: `MlvDataTableToolbarActions`, an optional projected `TemplateRef` rendered after table-owned toolbar controls.
- Produces i18n keys: `sort`, `sortMenu`, `ascending`, `descending`, and `clearSort`.
- Consumes: existing sortable column definitions, `currentSort`, `onSortClick` semantics, `MlvMenu`, and presentation snapshots.
- Preserves: sortable headers, silent programmatic state application, and one emission per user action.

- [ ] **Step 1: Register the existing i18n Vitest suite as an Nx target**

The project currently has a Vite config but no inferred `test` target. Add this explicit target before relying on `nx test i18n`:

```json
"test": {
  "executor": "nx:run-commands",
  "options": {
    "command": "yarn vitest run --config libs/i18n/vite.config.mts",
    "cwd": "{workspaceRoot}"
  }
}
```

Run `yarn nx test i18n --skipNxCache` once and record the existing baseline of 5 files / 104 tests passing.

- [ ] **Step 2: Add failing Sort-menu rendering and behavior tests**

Cover the public default, opt-in visibility, no-sortable-column suppression, real menu interaction, nested direction interaction, keyboard semantics, and state emissions:

```ts
it('does not render the Sort menu by default', () => {
  expect(fixture.nativeElement.querySelector('[data-mlv-table-sort-trigger]'))
    .toBeNull();
});

it('renders Sort only when opted in and at least one column is sortable', () => {
  host.showSortMenu.set(true);
  fixture.detectChanges();
  const trigger = fixture.nativeElement.querySelector(
    '[data-mlv-table-sort-trigger]',
  );
  expect(trigger.textContent).toContain('Sort');
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
});

it('renders projected domain actions in the one table toolbar', () => {
  const toolbar = fixture.nativeElement.querySelector('.mlv-data-table__toolbar');
  expect(toolbar.querySelector('[data-test-export]')).not.toBeNull();
  expect(fixture.nativeElement.querySelectorAll('.mlv-data-table__toolbar'))
    .toHaveLength(1);
});

it('sorts an inactive column ascending through the rendered menu', async () => {
  host.showSortMenu.set(true);
  fixture.detectChanges();
  openMenu('[data-mlv-table-sort-trigger]');
  clickMenuItem('Name');
  expect(table.getPresentationState().sort).toEqual({
    key: 'name',
    direction: 'asc',
  });
  expect(changes).toHaveLength(1);
});

it('changes direction and clears through the active-column submenu', async () => {
  table.applyPresentationState({ sort: { key: 'name', direction: 'asc' } });
  openMenu('[data-mlv-table-sort-trigger]');
  openSubmenu('Name');
  clickMenuItem('Descending');
  expect(table.getPresentationState().sort?.direction).toBe('desc');
  expect(changes).toHaveLength(1);
  openMenu('[data-mlv-table-sort-trigger]');
  openSubmenu('Name');
  clickMenuItem('Clear sort');
  expect(table.getPresentationState().sort).toBeNull();
  expect(changes).toHaveLength(2);
});
```

Also assert page resets to 1, header `aria-sort` stays synchronized, programmatic apply emits zero changes, Escape returns focus, Arrow/Home/End navigation works, and the open menu is axe-clean.

- [ ] **Step 3: Run Data Table and i18n tests and verify RED**

```bash
yarn nx test core-data-table --skipNxCache
yarn nx test i18n --skipNxCache
```

Expected: Data Table lacks `showSortMenu` and i18n lacks the five keys.

- [ ] **Step 4: Extend the exact i18n contract in every locale**

Add these English source values and translation contexts:

```ts
sort: 'Sort',
sortMenu: 'Sort rows',
ascending: 'Ascending',
descending: 'Descending',
clearSort: 'Clear sort',
```

Use the following locale values; preserve Unicode exactly:

| Locale | sort | sortMenu | ascending | descending | clearSort |
| --- | --- | --- | --- | --- | --- |
| de | Sortieren | Zeilen sortieren | Aufsteigend | Absteigend | Sortierung löschen |
| es | Ordenar | Ordenar filas | Ascendente | Descendente | Borrar orden |
| fr | Trier | Trier les lignes | Croissant | Décroissant | Effacer le tri |
| id | Urutkan | Urutkan baris | Menaik | Menurun | Hapus pengurutan |
| it | Ordina | Ordina righe | Crescente | Decrescente | Cancella ordinamento |
| ja | 並べ替え | 行を並べ替え | 昇順 | 降順 | 並べ替えを解除 |
| nl | Sorteren | Rijen sorteren | Oplopend | Aflopend | Sortering wissen |
| pl | Sortuj | Sortuj wiersze | Rosnąco | Malejąco | Wyczyść sortowanie |
| pt | Ordenar | Ordenar linhas | Crescente | Decrescente | Limpar ordenação |
| ro | Sortează | Sortează rândurile | Crescător | Descrescător | Șterge sortarea |
| tr | Sırala | Satırları sırala | Artan | Azalan | Sıralamayı temizle |
| uk | Сортувати | Сортувати рядки | За зростанням | За спаданням | Очистити сортування |
| zh-Hans | 排序 | 对行排序 | 升序 | 降序 | 清除排序 |

The `sortMenu` context usage is `aria-label`; the other four are `button-text`. The locale contract must fail if any pack omits a key.

- [ ] **Step 5: Implement the opt-in Data Table Sort menu**

Add the input and derived availability:

```ts
readonly showSortMenu = input<boolean, BooleanInput>(false, {
  transform: coerceBooleanProperty,
});

readonly hasSortableColumns = computed(() =>
  this.columns().some((column) => column.sortable),
);
```

Include `showSortMenu() && hasSortableColumns()` in `hasToolbarContent`. Add one internal state mutator used only by menu actions:

```ts
protected _applyMenuSort(
  column: MlvDataTableColumn,
  direction: MlvSortDirection | null,
): void {
  if (!column.sortable) return;
  this.currentSort.set(
    direction === null ? null : { key: column.key, direction },
  );
  this.currentPage.set(1);
  this._emitPresentationStateChange();
}
```

Define and export the action slot:

```ts
@Directive({ selector: 'ng-template[mlvDataTableToolbarActions]' })
export class MlvDataTableToolbarActions {
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}
```

Read it with `contentChild(MlvDataTableToolbarActions)`, include its presence in `hasToolbarContent`, and render it as the final child of `.mlv-data-table__toolbar-actions`:

```html
@if (_toolbarActions(); as actions) {
  <ng-container [ngTemplateOutlet]="actions.templateRef" />
}
```

Render the Sort trigger before Columns and derive every item from `columns()`:

```html
@if (showSortMenu() && hasSortableColumns()) {
  <button
    mlvButton
    variant="secondary"
    mlvDensity="compact"
    type="button"
    data-mlv-table-sort-trigger
    [mlvMenuTrigger]="sortMenu"
    [attr.aria-label]="_i18n().sortMenu"
  >
    <svg mlvButtonIcon lucideArrowUpDown [size]="14" />
    {{ _i18n().sort }}
  </button>
  <mlv-menu #sortMenu [label]="_i18n().sortMenu" mlvDensity="compact">
    @for (column of columns(); track column.key) {
      @if (column.sortable) {
        @if (currentSort()?.key === column.key) {
          <mlv-list-item
            mlvMenuItem
            [mlvMenuTrigger]="directionMenu"
            [isSubmenuTrigger]="true"
          >
            {{ column.title ?? column.key }}
          </mlv-list-item>
          <mlv-menu #directionMenu [label]="getSortLabel(column)" mlvDensity="compact">
            <mlv-list-item mlvMenuItem (itemClick)="_applyMenuSort(column, 'asc')">
              {{ _i18n().ascending }}
            </mlv-list-item>
            <mlv-list-item mlvMenuItem (itemClick)="_applyMenuSort(column, 'desc')">
              {{ _i18n().descending }}
            </mlv-list-item>
            <mlv-list-item mlvMenuItem (itemClick)="_applyMenuSort(column, null)">
              {{ _i18n().clearSort }}
            </mlv-list-item>
          </mlv-menu>
        } @else {
          <mlv-list-item mlvMenuItem (itemClick)="_applyMenuSort(column, 'asc')">
            {{ column.title ?? column.key }}
          </mlv-list-item>
        }
      }
    }
  </mlv-menu>
}
```

Import the public Menu/List/Lucide primitives through grouped package entry points. Use existing toolbar spacing and menu chrome; do not add a parallel custom dropdown style.

- [ ] **Step 6: Add the Data Table documentation example**

Example 23 renders Search, Sort, and Columns from one Data Table toolbar with this public surface:

```html
<mlv-data-table
  [data]="orders"
  [columns]="columns"
  showSortMenu
  [searchQuery]="query()"
  (searchQueryChange)="query.set($event)"
  (presentationStateChange)="lastState.set($event)"
>
  <ng-template mlvDataTableToolbarActions>
    <button mlvButton type="button" variant="secondary" (click)="export()">
      Export
    </button>
  </ng-template>
</mlv-data-table>
```

Its `orders` fixture contains Northwind (€18,400), Acme (€24,500), and Initech (€8,200). `columns` makes `customer` and `amount` sortable/searchable and `status` hideable. The test clicks Sort → Amount → Sort → Amount → Descending, checks Acme is the first rendered row and `aria-sort="descending"`, then toggles Status in the built-in Columns popup.

Increment the Data Table example count from 22 to 23 and document `showSortMenu`, its default, i18n, controlled-state behavior, and one-emission guarantee.

- [ ] **Step 7: Run verification and commit**

```bash
yarn nx test core-data-table --skipNxCache
yarn nx test i18n --skipNxCache
yarn nx lint core-data-table --skipNxCache
yarn nx typecheck core-data-table --skipNxCache
yarn nx lint i18n --skipNxCache
yarn nx typecheck i18n --skipNxCache
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache -- src/app/pages/data-table/examples/23/index.spec.ts
yarn nx typecheck docs --skipNxCache
git diff --check
git add libs/core/data-table libs/i18n apps/docs/src/app/pages/data-table .claude/projects/libs-data-table.md .claude/projects/page-data-table.md
git commit -m "feat(data-table): add toolbar sort menu"
```

---

### Task 5: Refactor Data Operations to public Malva composition

**Files:**

- Modify: `apps/docs/src/app/showcases/pages/data-operations/data-operations.ts`
- Modify: `apps/docs/src/app/showcases/pages/data-operations/data-operations.html`
- Modify: `apps/docs/src/app/showcases/pages/data-operations/data-operations.scss`
- Modify: `apps/docs/src/app/showcases/pages/data-operations/data-operations.spec.ts`
- Modify: `apps/docs/src/app/showcases/pages/data-operations/data-operations.data.ts`
- Modify: `apps/docs/CLAUDE.md`
- Modify: `.claude/projects/app-docs.md`

**Interfaces:**

- Consumes: `MlvSidebar appearance="flat" mode="fixed" collapseBelow="lg"` and external `MlvSidebarTrigger`.
- Consumes: `MlvPageEndPane`, `MlvPageEndPaneContent`, and optional `MlvPageEndPaneTrigger`.
- Consumes: `MlvDataTable showSortMenu`, controlled `searchQuery`, and built-in Columns popup.
- Consumes: `MlvDataTableToolbarActions` for the domain-owned Export action.
- Consumes: the three public filter expression functions.
- Preserves: deterministic fixtures, URL synchronization, create/clone/update operation isolation, dirty/reset state, export/import domain actions, pagination, and announcements.

- [ ] **Step 1: Replace method-driven coverage with rendered interaction tests**

Keep existing state/URL concurrency coverage, then add real DOM tests for each public composition boundary:

```ts
it('uses one responsive Malva Sidebar for Views', async () => {
  setViewport('desktop');
  expect(host.querySelectorAll('mlv-sidebar')).toHaveLength(1);
  expect(host.querySelector('.mlv-sidebar--flat')).not.toBeNull();
  setViewport('compact');
  await settle();
  clickButton('Open navigation');
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  dispatchKeyboardEvent(document.querySelector('[role="dialog"]')!, 'keydown', 'Escape');
  finishOverlayAnimations();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('uses Data Table-owned Search, Sort, and Columns exactly once', async () => {
  expect(host.querySelectorAll('.mlv-data-table__search')).toHaveLength(1);
  expect(host.querySelectorAll('[data-mlv-table-sort-trigger]')).toHaveLength(1);
  expect(buttonsNamed('Columns')).toHaveLength(1);
  typeInSearch('acme');
  openMenu('Sort');
  clickMenuItem('Renewal date');
  openPopup('Columns');
  toggleCheckbox('Owner');
  expect(component.dirty()).toBe(true);
});

it('opens one responsive details pane and clears selection on Escape', async () => {
  clickTableRow('Acme Corporation');
  expect(host.querySelectorAll('[data-account-details]')).toHaveLength(1);
  setViewport('compact');
  await settle();
  expect(document.querySelectorAll('[data-account-details]')).toHaveLength(1);
  dispatchKeyboardEvent(document.querySelector('[role="dialog"]')!, 'keydown', 'Escape');
  finishOverlayAnimations();
  expect(component.selectedAccount()).toBeNull();
  expect(document.querySelector('[data-account-details]')).toBeNull();
});

it('does not expose unsupported saved-view actions', () => {
  selectView('My follow-ups');
  openActiveViewMenu();
  expect(menuItem('Rename')).toBeNull();
  expect(menuItem('Share')).toBeNull();
  expect(menuItem('Delete')).toBeNull();
});

it('clears optional filters instead of restoring the saved baseline', () => {
  clickButton('Clear filters');
  expect(component.filterFields()).toEqual([]);
  expect(component.filterExpression()).toEqual({
    kind: 'group',
    combinator: 'and',
    children: [],
  });
  expect(component.dirty()).toBe(true);
});
```

Add rendered dialog tests for dirty-view switch Cancel/Discard, create Save/Cancel, duplicate, update, retry/dismiss failure, import menu, export menu, real backdrop dismissal, compact→desktop and desktop→compact transitions, focus restoration, table row order, and axe with `nested-interactive` enabled.

- [ ] **Step 2: Run the focused showcase suite and verify RED**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache -- src/app/showcases/pages/data-operations/data-operations.spec.ts
```

Expected: failures prove duplicate route-owned controls, custom responsive hosts, unsupported actions, and restore-baseline clear behavior.

- [ ] **Step 3: Replace route-local filtering with public utilities**

Delete `filtersToExpression`, `expressionToFilters`, and `_matchesExpression`. Import and call:

```ts
import {
  MlvSmartFilterBar,
  mlvFilterExpressionToFields,
  mlvFilterFieldsToExpression,
  mlvMatchesFilterExpression,
} from '@malva-ui/core/filter';
```

```ts
readonly filteredAccounts = computed(() => {
  const search = this.search().trim().toLocaleLowerCase();
  const expression = this.filterExpression();
  return this.accounts().filter((account) => {
    const searchMatches =
      search.length === 0 ||
      [account.name, account.owner, account.plan, account.health]
        .some((value) => String(value ?? '').toLocaleLowerCase().includes(search));
    return searchMatches && mlvMatchesFilterExpression(
      account,
      expression,
      (row, key) => row[key as keyof Account],
    );
  });
});

applyFilterFields(fields: readonly MlvFilterFieldState[]): void {
  this.filterFields.set(fields);
  this.filterExpression.set(mlvFilterFieldsToExpression(fields));
}

private _loadExpression(expression: MlvFilterExpression): void {
  const fields = mlvFilterExpressionToFields(expression);
  if (fields === null) {
    throw new Error('The selected account view cannot be represented by the query filter bar.');
  }
  this.filterExpression.set(expression);
  this.filterFields.set(fields);
}
```

All shipped fixtures must be flat-representable; add a fixture contract test for this instead of silently dropping grouping.

- [ ] **Step 4: Compose the shared Sidebar, Page end pane, and Data Table toolbar**

Replace the route's start `nav`, manual `matchMedia`, custom Drawer, Search input, Sort menu, and Columns menu with:

```html
<mlv-page-shell
  class="data-operations-showcase"
  color="var(--mlv-background-base)"
>
  <mlv-sidebar
    #viewsSidebar
    mlvPageSidebar
    appearance="flat"
    mode="fixed"
    collapseBelow="lg"
    width="17rem"
    ariaLabel="Account views"
  >
    <mlv-view-variant-list
      [variants]="variants()"
      [activeId]="activeId()"
      [(query)]="viewQuery"
      [canCreate]="canCreateView()"
      [busyAction]="busyAction()"
      [errorMessage]="operationError()"
      (variantSelect)="requestVariantSelection($event)"
      (createRequest)="createView($event)"
      (retryRequest)="retryOperation()"
      (dismissError)="operationError.set(null)"
    />
  </mlv-sidebar>

  <main mlvPage padding="l" surface="flat" id="main-content">
    <mlv-page-header>
      <ng-template mlvPageTitle>
        <div class="data-operations-showcase__title-row">
          <mlv-sidebar-trigger [sidebar]="viewsSidebar" />
          <h1>{{ activeVariant()?.name ?? 'Accounts' }}</h1>
        </div>
      </ng-template>
      <ng-template mlvPageHeaderActions>
        <mlv-button-split>
          <button mlvButton type="button" (click)="createAccount()">
            <svg lucidePlus mlvButtonIcon [size]="16" aria-hidden="true" />
            Add account
          </button>
          <button
            mlvButton
            type="button"
            shape="square"
            aria-label="More account actions"
            [mlvMenuTrigger]="accountActionsMenu"
          >
            <svg lucideChevronDown mlvButtonIcon [size]="16" aria-hidden="true" />
          </button>
        </mlv-button-split>
        <mlv-menu #accountActionsMenu label="Account actions">
          <mlv-list-item mlvMenuItem (itemClick)="importAccounts()">
            Import accounts
          </mlv-list-item>
          <mlv-list-item mlvMenuItem (itemClick)="createAccount()">
            Add from template
          </mlv-list-item>
        </mlv-menu>
      </ng-template>
    </mlv-page-header>

    <mlv-smart-filter-bar
      appearance="query"
      [definitions]="filterDefinitions"
      [filters]="filterFields()"
      [autoExecute]="true"
      (filtersChange)="applyFilterFields($event)"
      (execute)="filterExpression.set($event.expression)"
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

    <mlv-data-table
      class="data-operations-showcase__table"
      [data]="filteredAccounts()"
      [columns]="columns"
      [searchQuery]="search()"
      (searchQueryChange)="search.set($event)"
      showSortMenu
      selectable="multi"
      (rowClick)="openAccount($event.row)"
      (presentationStateChange)="onPresentationStateChange($event)"
    >
      <ng-template mlvDataTableToolbarActions>
        <button mlvButton type="button" variant="secondary" (click)="exportAccounts()">
          <svg lucideDownload mlvButtonIcon [size]="16" aria-hidden="true" />
          Export
        </button>
      </ng-template>
      <ng-template
        mlvDataTableCell="name"
        [mlvDataTableCellFrom]="accounts()"
        let-row
      >
        <div class="data-operations-showcase__account-cell">
          <mlv-avatar [name]="row.name" size="s" shape="square" />
          <span>{{ row.name }}</span>
        </div>
      </ng-template>
      <ng-template
        mlvDataTableCell="owner"
        [mlvDataTableCellFrom]="accounts()"
        let-row
      >
        {{ row.owner ?? '—' }}
      </ng-template>
      <ng-template
        mlvDataTableCell="arr"
        [mlvDataTableCellFrom]="accounts()"
        let-row
      >
        <span class="data-operations-showcase__amount">
          {{ row.arr | currency:'USD':'symbol':'1.0-0' }}
        </span>
      </ng-template>
      <ng-template
        mlvDataTableCell="health"
        [mlvDataTableCellFrom]="accounts()"
        let-row
      >
        <mlv-badge [tone]="healthTone(row.health)" muted>
          {{ row.health }}
        </mlv-badge>
      </ng-template>
      <ng-template
        mlvDataTableCell="renewalDate"
        [mlvDataTableCellFrom]="accounts()"
        let-row
      >
        <span>{{ row.renewalDate | date:'MMM d, y' }}</span>
        <small
          class="data-operations-showcase__renewal-days"
          [class.data-operations-showcase__renewal-days--urgent]="row.renewalDays <= 60"
        >
          {{ row.renewalDays }} days
        </small>
      </ng-template>
      <ng-template mlvDataTableNoData>
        <div class="data-operations-showcase__empty-state">
          <p>No accounts match these filters.</p>
          <button mlvButton type="button" variant="secondary" (click)="clearFilters()">
            Clear filters
          </button>
        </div>
      </ng-template>
    </mlv-data-table>
  </main>

  <mlv-page-end-pane
    #accountDetails
    width="20rem"
    collapseBelow="lg"
    ariaLabel="Account details"
    [opened]="selectedAccount() !== null"
    (openedChange)="onDetailsOpenedChange($event)"
  >
    <ng-template mlvPageEndPaneContent>
      @if (selectedAccount(); as account) {
        <section class="data-operations-showcase__inspector" data-account-details>
          <header class="data-operations-showcase__inspector-header">
            <div>
              <p>Account details</p>
              <h2>{{ account.name }}</h2>
            </div>
            <button
              mlvButton
              type="button"
              variant="transparent"
              shape="square"
              aria-label="Close account details"
              (click)="accountDetails.close()"
            >
              <svg lucideX mlvButtonIcon [size]="18" aria-hidden="true" />
            </button>
          </header>
          <dl class="data-operations-showcase__details">
            <div><dt>Owner</dt><dd>{{ account.owner ?? 'Unassigned' }}</dd></div>
            <div><dt>Plan</dt><dd>{{ account.plan }}</dd></div>
            <div><dt>ARR</dt><dd>{{ account.arr | currency:'USD':'symbol':'1.0-0' }}</dd></div>
            <div><dt>Renewal</dt><dd>{{ account.renewalDate | date:'MMMM d, y' }}</dd></div>
            <div><dt>Last activity</dt><dd>{{ account.lastActivity }}</dd></div>
          </dl>
        </section>
      }
    </ng-template>
  </mlv-page-end-pane>
</mlv-page-shell>
```

The table retains the existing five typed domain cell templates and no-data projection. Only Search, Sort, Columns, and toolbar geometry move to Data Table ownership.

- [ ] **Step 5: Remove dead actions, correct Clear, and delete generic custom CSS**

Set the fixture capability helper to:

```ts
const capabilities = (editable: boolean) => ({
  clone: !editable,
  update: editable,
  rename: false,
  delete: false,
  share: false,
});
```

Make Clear genuinely empty:

```ts
clearFilters(): void {
  const fields: readonly MlvFilterFieldState[] = [];
  this.filterFields.set(fields);
  this.filterExpression.set(mlvFilterFieldsToExpression(fields));
}
```

Keep Reset as the separate saved-baseline replay. Remove the route's Views/inspector backgrounds, fixed widths, borders, responsive media queries, mobile Drawer padding, Search width, and duplicate toolbar layout. Retain only domain cell alignment, tabular numbers, semantic renewal text using the declared `--mlv-text-negative` token, and unavoidable content spacing.

Replace `--mlv-background-page` with verified `--mlv-background-base`; remove every use of `--mlv-background-elevation-1` and `--mlv-color-danger`.

- [ ] **Step 6: Run focused and full route verification, then commit**

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache -- src/app/showcases/pages/data-operations/data-operations.spec.ts
yarn nx typecheck docs --skipNxCache
yarn nx lint docs --skipNxCache
yarn nx run styles:check-tokens --strict --skipNxCache
yarn nx run styles:check-padding-tokens
git diff --check
git add apps/docs/src/app/showcases/pages/data-operations apps/docs/CLAUDE.md .claude/projects/app-docs.md
git commit -m "refactor(docs): compose data operations from Malva"
```

Expected: the strict token check is now green with zero findings.

---

### Task 6: Correct token documentation and complete same-tree QA

**Files:**

- Modify: `.claude/projects/libs-card.md`
- Modify: `.claude/projects/libs-drawer.md`
- Modify: `.superpowers/sdd/2026-08-20-composed-showcase-pages/progress.md`
- Create: `.superpowers/sdd/2026-08-21-showcase-library-primitives/task-6-report.md`

**Interfaces:**

- Corrects Card docs to `--mlv-elevation-bg-2` and `--mlv-shadow-1`.
- Corrects Drawer docs to `--mlv-elevation-bg-2`, `--mlv-shadow-3`, `--mlv-text-primary`, `--mlv-padding-l`, and `--mlv-border-normal`.
- Produces a clean verification record for the composed-showcase ledger.
- Does not publish route screenshots to the registry; the composed-showcase plan keeps preview capture in its final catalog task after every route is review-clean.

- [ ] **Step 1: Correct the two stale token summaries from source**

Use these exact documentation lines:

```md
- Background: `var(--mlv-elevation-bg-2)`; Shadow: `var(--mlv-shadow-1)`
```

```md
- `--mlv-elevation-bg-2`, `--mlv-shadow-3`, `--mlv-text-primary`, `--mlv-padding-l`, `--mlv-border-normal`
```

Verify each name against `libs/styles/src/lib/theme.scss` or the generated `libs/styles/tokens.md` before staging.

- [ ] **Step 2: Run the complete automated matrix on one committed tree**

```bash
yarn nx run-many -t test -p cdk-overlay core-sidebar core-page core-search-field core-alert core-form-utils core-combobox core-select core-data-table i18n --skipNxCache
yarn nx run-many -t lint -p core-sidebar core-page core-search-field core-alert core-form-utils core-combobox core-select core-data-table i18n docs --skipNxCache
yarn nx run-many -t typecheck -p core-sidebar core-page core-search-field core-alert core-form-utils core-combobox core-select core-data-table i18n docs --skipNxCache
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache
yarn nx build core --skipNxCache
yarn nx build docs --skipNxCache
yarn nx run docs:extract-api --skipNxCache
yarn nx run docs:check-doc-api --skipNxCache
yarn nx run styles:verify-tokens --skipNxCache
yarn nx run styles:check-tokens --strict --skipNxCache
yarn nx run styles:check-padding-tokens
git diff --check
```

Do not collapse failures into “known warnings.” Record command, exit code, test counts, and any non-failing warning separately in the task reports.

- [ ] **Step 3: Perform in-app Browser interaction and visual QA**

Start the docs dev server through Nx, open `/showcases/data-operations` in the in-app Browser, and do not activate fullscreen. At the approved 1600×1000 viewport:

1. exercise view search/selection, Add filter, explicit filter Apply, top-level Apply, Reset, Duplicate, Update, Search, Sort, Columns, Export, a row, pane close, dirty confirmation, operation failure/retry, and theme switching;
2. repeat Sidebar and details-pane open/close at compact width, including Escape and backdrop;
3. capture the stable default desktop state;
4. load `docs/superpowers/specs/assets/2026-08-20-data-operations-view-library.png` and the captured implementation image in one comparison input;
5. check hierarchy, density, typography, borders, radii, row heights, empty space, clipping, popup placement, and focus visibility;
6. fix only source-backed mismatches, rerun the affected tests, and repeat the combined comparison.

The route is visually accepted only when the implementation preserves the selected direction's quiet Views sidebar, natural-language filter hierarchy, restrained status surface, dense table rhythm, and flat trailing details pane without route-owned shell decoration.

- [ ] **Step 4: Update ledgers/reports and commit documentation evidence**

Append the architectural ruling to the composed-showcase ledger:

```md
Ruling: responsive shell panes, table toolbar controls, and token correctness are library contracts implemented before further showcase routes; showcase code remains limited to fixtures, URL state, simulated persistence, and domain rendering — cost if wrong: reusable component tasks expand the plan, but every later showcase becomes smaller and more credible.
```

Each task report must contain RED evidence, GREEN evidence, review findings/fix rounds, final commit hash, custom-code audit, and remaining concerns. Force-add ignored reports without adding unrelated ignored files.

```bash
git add .claude/projects/libs-card.md .claude/projects/libs-drawer.md
git add -f .superpowers/sdd/2026-08-20-composed-showcase-pages/progress.md .superpowers/sdd/2026-08-21-showcase-library-primitives
git diff --cached --check
git commit -m "docs: verify showcase composition primitives"
git status --short
git show --check --stat HEAD
```
