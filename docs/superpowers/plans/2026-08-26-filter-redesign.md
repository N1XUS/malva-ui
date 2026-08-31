# Filter Redesign & Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Custom value-editor slot for `mlv-filter`, options editor rebuilt on `mlv-dropdown-panel`, explicit-mode Clear dead-end fix, dashed "Add filter" chip, docs date-editor example.

**Architecture:** Additive API on `@malva-ui/core/filter` (template-slot directive + keyed pass-through in the smart bar), one additive field on `@malva-ui/core/dropdown` (`MlvSelectOption.disabled`), visual-only SCSS changes. No breaking changes.

**Tech Stack:** Angular v20 signals, `@angular/aria` listbox (via `mlv-dropdown-panel`), Vitest + TestBed + axe, Nx.

**Spec:** `docs/superpowers/specs/2026-08-26-filter-redesign-design.md`

## Global Constraints

- Follow `.claude/rules/angular-component.md`, `angular-directive.md`, `bem-scss.md`, `accessibility.md` (loaded via project CLAUDE.md).
- No `standalone: true`; signal `input()`/`output()`/`model()`; `inject()`; host object bindings; `ViewEncapsulation.None` + `OnPush` on components.
- SCSS: only `--mlv-*` tokens, rem values, `--mlv-padding-*` only as whole `padding:` value (`--mlv-spacing-*` per side/gap).
- Public members: JSDoc; private/protected `_` prefix + JSDoc.
- Barrel exports: `export * from ...`.
- Verification gate: `yarn nx run-many -t vite:test typecheck lint -p core-filter core-dropdown` + `yarn nx run docs:check-doc-api` after doc edits.
- Commits: conventional format; lint-staged runs prettier on commit. Never `git stash` while subagents have edits in flight.

---

### Task 1: `core-dropdown` — per-option `disabled`

**Files:**
- Modify: `libs/core/dropdown/src/lib/select-option.ts` (add field)
- Modify: `libs/core/dropdown/src/lib/dropdown-panel/dropdown-panel.html:86-93` (option row)
- Test: `libs/core/dropdown/src/lib/dropdown-panel/dropdown-panel.spec.ts`
- Modify: `.claude/projects/libs-dropdown.md`

**Interfaces:**
- Consumes: existing `MlvListItemSelectable` `disabled` input (already forwarded to the aria `Option`; the panel pins `[softDisabled]="false"` so nav skips disabled options).
- Produces: `MlvSelectOption.disabled?: boolean`; a disabled option renders `aria-disabled` and cannot be selected. Task 5 relies on this.

- [ ] **Step 1: Write the failing test** — append to `dropdown-panel.spec.ts` (follow the file's existing render helpers; it renders `MlvDropdownPanel` via a host fixture and reads `role="option"` rows):

```ts
describe('disabled options', () => {
  it('marks a disabled option and blocks its selection', async () => {
    // Render the panel with one disabled option using the spec's existing host pattern.
    const options = [
      { label: 'Enabled', value: 'a' },
      { label: 'Blocked', value: 'b', disabled: true },
    ];
    // ...use the file's established fixture setup with these options...
    const rows = element.querySelectorAll<HTMLElement>('[role="option"]');
    expect(rows[1].getAttribute('aria-disabled')).toBe('true');

    rows[1].click();
    fixture.detectChanges();
    // Selection must not include the disabled value.
    expect(valueChangeSpy).not.toHaveBeenCalledWith(
      expect.arrayContaining(['b']),
    );
  });
});
```

Adapt fixture/spy names to the file's existing conventions — do not invent a parallel harness.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn nx test core-dropdown -- --run --testNamePattern="disabled option"`
Expected: FAIL — `aria-disabled` is `null` (no binding exists yet).

- [ ] **Step 3: Implement** — `select-option.ts`:

```ts
export interface MlvSelectOption<T = unknown> {
  label: string;
  value: T;
  /** Optional group label — clusters options under a sticky, non-selectable header. */
  group?: string;
  /** Whether the option is unavailable for selection. Skipped by keyboard navigation. */
  disabled?: boolean;
}
```

`dropdown-panel.html` option row (`#optionRow` template) — add one binding to the `<mlv-list-item>`:

```html
<mlv-list-item
  class="mlv-dropdown-panel__item"
  itemRole="option"
  [class.mlv-dropdown-panel__item--active]="index === activeIndex()"
  [value]="option.value"
  [label]="option.label"
  [disabled]="option.disabled ?? false"
  [optionId]="optionId(index)"
>
```

- [ ] **Step 4: Run tests**

Run: `yarn nx test core-dropdown -- --run`
Expected: PASS (all — no existing test sets `disabled`, field is optional).

- [ ] **Step 5: Update `.claude/projects/libs-dropdown.md`** — `MlvSelectOption` shape (`{ label; value; group?; disabled? }`) in the export table + Interfaces section + option-row note ("disabled options render `aria-disabled`, are skipped by nav, cannot be selected").

- [ ] **Step 6: Verify + commit**

Run: `yarn nx run-many -t vite:test typecheck lint -p core-dropdown`

```bash
git add libs/core/dropdown .claude/projects/libs-dropdown.md
git commit -m "feat(dropdown): per-option disabled support in mlv-dropdown-panel"
```

---

### Task 2: `core-filter` — explicit-mode Clear dead-end fix

**Files:**
- Modify: `libs/core/filter/src/lib/filter/filter.ts:401-411` (`_clearDraft`)
- Test: `libs/core/filter/src/lib/filter/filter.spec.ts`

**Interfaces:**
- Produces: after Clear, a free-form editor always shows exactly one empty condition row. Rollback semantics unchanged (Apply after Clear commits `[]` + emits `cleared`; Cancel restores).

- [ ] **Step 1: Write the failing test** — in `filter.spec.ts`, free-form context (set `options` to `[]`, `editor` to `'text'`, `applyMode` to `'explicit'`; use the file's `open()` helper):

```ts
it('reseeds one empty condition after Clear in explicit mode', async () => {
  fixture.componentRef.setInput('options', []);
  fixture.componentRef.setInput('editor', 'text');
  fixture.componentRef.setInput('applyMode', 'explicit');
  component.conditions.set([{ operator: 'contains', value: 'design' }]);
  fixture.detectChanges();
  await open();

  (
    overlay.querySelector('.mlv-filter__panel-clear') as HTMLButtonElement
  ).click();
  fixture.detectChanges();

  // Bug regression: panel must not dead-end with zero condition rows.
  expect(overlay.querySelectorAll('.mlv-filter__condition').length).toBe(1);
  // Explicit mode: nothing committed yet.
  expect(component.conditions()).toEqual([
    { operator: 'contains', value: 'design' },
  ]);
});

it('commits [] and emits cleared when applying after Clear', async () => {
  const cleared = vi.fn();
  component.cleared.subscribe(cleared);
  fixture.componentRef.setInput('options', []);
  fixture.componentRef.setInput('editor', 'text');
  fixture.componentRef.setInput('applyMode', 'explicit');
  component.conditions.set([{ operator: 'contains', value: 'design' }]);
  fixture.detectChanges();
  await open();

  (
    overlay.querySelector('.mlv-filter__panel-clear') as HTMLButtonElement
  ).click();
  fixture.detectChanges();
  const buttons = overlay.querySelectorAll<HTMLButtonElement>(
    '.mlv-filter__panel-footer button',
  );
  buttons[buttons.length - 1].click(); // Apply
  fixture.detectChanges();

  expect(component.conditions()).toEqual([]);
  expect(cleared).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run to verify first test fails**

Run: `yarn nx test core-filter -- --run --testNamePattern="reseeds one empty"`
Expected: FAIL — 0 condition rows found.

- [ ] **Step 3: Implement** — `_clearDraft` in `filter.ts`:

```ts
/** @protected Clears the editor draft while preserving explicit-mode rollback. */
protected _clearDraft(): void {
  if (this._editorDisabled()) return;
  this._draftConditions.set(
    this._usesOptions() ? [] : [this._newCondition()],
  );
  if (this.applyMode() === 'explicit') return;

  this.conditions.set([]);
  this.applied.emit([]);
  this.cleared.emit();
  this.opened.set(false);
}
```

Note: the reseeded condition is not "meaningful" (`_isConditionMeaningful` is false for empty value), so live mode still commits `[]` and the panel-header Clear button visibility (`_draft().length > 0`) now stays on for free-form editors — that is correct: the row exists, its value is empty.

- [ ] **Step 4: Run tests**

Run: `yarn nx test core-filter -- --run`
Expected: PASS. If an existing test asserts `_draft()` becomes `[]` after Clear for a free-form editor, update it to expect one empty condition — the old behavior is the bug.

- [ ] **Step 5: Commit**

```bash
git add libs/core/filter
git commit -m "fix(filter): reseed empty condition after Clear so panel never dead-ends"
```

---

### Task 3: `core-filter` — custom value-editor slot

**Files:**
- Create: `libs/core/filter/src/lib/filter/filter-value-editor.ts`
- Modify: `libs/core/filter/src/lib/filter/filter.ts`
- Modify: `libs/core/filter/src/lib/filter/filter.html:149-186` (value cell)
- Modify: `libs/core/filter/src/index.ts`
- Test: `libs/core/filter/src/lib/filter/filter.spec.ts`

**Interfaces:**
- Consumes: `MlvFilterCondition`, `MlvFilterOperator` from `../filter.types`; `MlvTabbableElementService` from `@malva-ui/cdk/accessibility` (method: `getTabbableElement(root: HTMLElement, reverse: boolean, includeRoot: boolean): HTMLElement | null` — check the actual signature in `libs/cdk/accessibility` before use and adapt).
- Produces (Task 4 + docs rely on these exact names):
  - `MlvFilterValueEditorContext` interface — fields `$implicit`, `condition`, `index`, `operator`, `disabled`, `placeholder`, `setValue(value: unknown): void`, `commit(): void`.
  - `MlvFilterValueEditorDef` directive, selector `[mlvFilterValueEditor]`, key input `mlvFilterValueEditor: string` (default `''`), field `templateRef`.
  - `MlvFilter.valueEditor` input: `TemplateRef<MlvFilterValueEditorContext> | null`, default `null`; input wins over projected content child.

- [ ] **Step 1: Create `filter-value-editor.ts`**

```ts
import { Directive, inject, input, TemplateRef } from '@angular/core';
import type {
  MlvFilterCondition,
  MlvFilterOperator,
} from '../filter.types';

/** Template context available to a custom condition value editor. */
export interface MlvFilterValueEditorContext {
  /** Current condition value (scalar, or the range array for `between`). */
  $implicit: unknown;
  /** Full condition being edited. */
  condition: MlvFilterCondition;
  /** Condition index within the editor. */
  index: number;
  /** Current operator of the condition. */
  operator: MlvFilterOperator;
  /** Whether the editor must reject changes (filter disabled or loading). */
  disabled: boolean;
  /** Resolved value placeholder. */
  placeholder: string;
  /** Writes the draft value; commits immediately in live apply mode. */
  setValue: (value: unknown) => void;
  /** Applies the draft in explicit mode (Enter-equivalent). No-op in live mode. */
  commit: () => void;
}

/**
 * Marks an `ng-template` as the value editor for free-form filter conditions.
 * Standalone `mlv-filter`: project the template as content. Inside
 * `mlv-smart-filter-bar`: set the input to a definition key to target one
 * field; an empty key is the fallback for every free-form field.
 */
@Directive({ selector: '[mlvFilterValueEditor]' })
export class MlvFilterValueEditorDef {
  /** Definition key this editor targets; empty targets all free-form fields. */
  readonly mlvFilterValueEditor = input<string>('');

  /** The template rendered in place of the built-in value input. */
  readonly templateRef = inject(TemplateRef<MlvFilterValueEditorContext>);

  /** Type guard for template context inference. */
  static ngTemplateContextGuard(
    _dir: MlvFilterValueEditorDef,
    ctx: unknown,
  ): ctx is MlvFilterValueEditorContext {
    return true;
  }
}
```

- [ ] **Step 2: Write the failing tests** — needs a host component (content projection). Add to `filter.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { MlvFilterValueEditorDef } from './filter-value-editor';
// (top-level imports; MlvFilter is already imported)

@Component({
  imports: [MlvFilter, MlvFilterValueEditorDef],
  template: `
    <mlv-filter
      label="Renewal"
      editor="text"
      [applyMode]="applyMode()"
      [(conditions)]="conditions"
    >
      <ng-template
        mlvFilterValueEditor
        let-value
        let-set="setValue"
        let-commitFn="commit"
      >
        <input
          class="custom-editor"
          [value]="value ?? ''"
          (input)="set($any($event.target).value)"
          (keydown.enter)="commitFn()"
        />
      </ng-template>
    </mlv-filter>
  `,
})
class SlotHost {
  readonly applyMode = signal<'live' | 'explicit'>('live');
  readonly conditions = signal<readonly MlvFilterCondition[]>([]);
}

describe('custom value editor slot', () => {
  let slotFixture: ComponentFixture<SlotHost>;
  let slotHost: SlotHost;

  beforeEach(async () => {
    slotFixture = TestBed.createComponent(SlotHost);
    slotHost = slotFixture.componentInstance;
    slotFixture.detectChanges();
    await slotFixture.whenStable();
  });

  async function openSlot(): Promise<void> {
    (
      slotFixture.nativeElement.querySelector(
        '.mlv-filter__trigger',
      ) as HTMLButtonElement
    ).click();
    slotFixture.detectChanges();
    await slotFixture.whenStable();
    slotFixture.detectChanges();
  }

  it('renders the template instead of the built-in input', async () => {
    await openSlot();
    expect(overlay.querySelector('.custom-editor')).toBeTruthy();
    expect(overlay.querySelector('.mlv-filter__input')).toBeNull();
    // Operator select stays lib-owned.
    expect(overlay.querySelector('.mlv-filter__operator')).toBeTruthy();
  });

  it('setValue commits immediately in live mode', async () => {
    await openSlot();
    const input = overlay.querySelector('.custom-editor') as HTMLInputElement;
    input.value = '2026-10-01';
    input.dispatchEvent(new Event('input'));
    slotFixture.detectChanges();
    expect(slotHost.conditions()).toEqual([
      expect.objectContaining({ operator: 'contains', value: '2026-10-01' }),
    ]);
  });

  it('setValue defers and commit() applies in explicit mode', async () => {
    slotHost.applyMode.set('explicit');
    slotFixture.detectChanges();
    await openSlot();
    const input = overlay.querySelector('.custom-editor') as HTMLInputElement;
    input.value = '2026-10-01';
    input.dispatchEvent(new Event('input'));
    slotFixture.detectChanges();
    expect(slotHost.conditions()).toEqual([]); // not yet applied

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    slotFixture.detectChanges();
    expect(slotHost.conditions()).toEqual([
      expect.objectContaining({ value: '2026-10-01' }),
    ]);
  });

  it('does not render the slot for valueless operators', async () => {
    slotFixture.componentRef.instance.conditions.set([
      { operator: 'empty', value: null },
    ]);
    // 'empty' must be in the operators list for this to be a valid state:
    // set operators input accordingly on the mlv-filter in a dedicated host,
    // or drive the operator select; simplest is asserting via the default
    // host after switching the operator through the UI is out of scope —
    // assert against the template branch directly:
    await openSlot();
    // switch operator to 'empty' via component API of the inner filter
    // (query the MlvFilter instance through debugElement) then:
    // expect(overlay.querySelector('.custom-editor')).toBeNull();
  });
});
```

For the valueless-operator case, prefer a host whose `mlv-filter` sets `[operators]="['contains', 'empty']"`, open, change the operator select to "Is empty" through its public API (`MlvSelect.valueChange` handler is wired to `_setOperator`) via `debugElement` — then assert `.custom-editor` is absent. Implement it concretely; do not leave it commented.

- [ ] **Step 3: Run to verify failure**

Run: `yarn nx test core-filter -- --run --testNamePattern="custom value editor"`
Expected: FAIL — `.custom-editor` never renders (slot not implemented).

- [ ] **Step 4: Implement in `filter.ts`**

Add imports: `contentChild`, `TemplateRef`, `NgTemplateOutlet` (add to component `imports` array), `MlvFilterValueEditorDef` + `MlvFilterValueEditorContext` from `./filter-value-editor`, `MlvTabbableElementService` from `@malva-ui/cdk/accessibility`.

```ts
/** Custom value-editor template forwarded by a smart filter bar. Wins over projected content. */
readonly valueEditor = input<TemplateRef<MlvFilterValueEditorContext> | null>(
  null,
);

/** @private Projected value-editor template for standalone usage. */
private readonly _contentValueEditor = contentChild(MlvFilterValueEditorDef);

/** @private Tabbable-element lookup for focusing custom editors. */
private readonly _tabbable = inject(MlvTabbableElementService);

/** @protected Resolved custom value-editor template; null renders the built-in input. */
protected readonly _valueEditorTemplate = computed(
  () => this.valueEditor() ?? this._contentValueEditor()?.templateRef ?? null,
);

/** @private Rendered value cells used to focus custom editors. */
private readonly _valueCells = viewChildren('valueCell', {
  read: ElementRef<HTMLElement>,
});

/** @protected Builds the template context for one condition's custom editor. */
protected _valueEditorContext(
  condition: MlvFilterCondition,
  index: number,
): MlvFilterValueEditorContext {
  return {
    $implicit: condition.value,
    condition,
    index,
    operator: condition.operator,
    disabled: this._editorDisabled(),
    placeholder: this._resolvedPlaceholder(),
    setValue: (value) => this._setConditionValue(index, value),
    commit: () => {
      if (this.applyMode() === 'explicit') this._apply();
    },
  };
}
```

Focus handling — in `_onOpened()`, replace the free-form branch:

```ts
} else {
  const cell = this._valueCells()[0]?.nativeElement;
  const target = cell
    ? this._tabbable.getTabbableElement(cell, false, true)
    : null;
  if (target) target.focus();
  else this._conditionInputs()[0]?.focus();
}
```

(Verify `MlvTabbableElementService`'s real method signature in `libs/cdk/accessibility/src` first and adapt the call — the intent is "first tabbable element inside the cell".)

`filter.html` — wrap the value cell (the `@if (condition.operator !== 'empty' ...)` block) so the slot replaces both the single input and the range pair. Replace lines 149-186 equivalent with:

```html
@if ( condition.operator !== 'empty' && condition.operator !== 'not-empty' ) {
<div class="mlv-filter__value-cell" #valueCell>
  @if (_valueEditorTemplate(); as editorTemplate) {
  <ng-container
    [ngTemplateOutlet]="editorTemplate"
    [ngTemplateOutletContext]="_valueEditorContext(condition, index)"
  />
  } @else { @if (condition.operator === 'between') {
  <div class="mlv-filter__range">
    <!-- ...existing two mlv-input range fields, unchanged... -->
  </div>
  } @else {
  <mlv-input
    class="mlv-filter__input"
    [type]="_resolvedEditor() === 'number' ? 'number' : 'text'"
    [value]="$any(condition.value)"
    [placeholder]="_resolvedPlaceholder()"
    [ariaLabel]="label() + ' ' + (index + 1)"
    [disabled]="_editorDisabled()"
    (valueChange)="_setConditionValue(index, $event)"
    (keydown.enter)="applyMode() === 'explicit' && _apply()"
  />
  } }
</div>
}
```

`filter.scss` — the new wrapper takes the old value-cell grid slot:

```scss
&__value-cell {
  min-width: 0;
}
```

(and add `__value-cell` to the `@media (max-width: 30rem)` `grid-column: 1` group alongside `__operator`/`__input`/`__range`).

`index.ts`:

```ts
export * from './lib/filter/filter-value-editor';
```

- [ ] **Step 5: Run tests**

Run: `yarn nx test core-filter -- --run`
Expected: PASS, including all pre-existing tests (built-in editors unchanged when no template).

- [ ] **Step 6: Commit**

```bash
git add libs/core/filter
git commit -m "feat(filter): custom condition value-editor template slot"
```

---

### Task 4: `mlv-smart-filter-bar` — keyed editor pass-through

**Files:**
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.ts`
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.html:117-143` and `:269-296` (both `mlv-filter` bindings)
- Test: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.spec.ts`

**Interfaces:**
- Consumes: `MlvFilterValueEditorDef` (Task 3), `MlvFilter.valueEditor` input (Task 3).
- Produces: `<ng-template mlvFilterValueEditor="key">` children resolved per definition — exact key wins, then key-less fallback, else `null`.

- [ ] **Step 1: Write the failing test** — host component in `smart-filter-bar.spec.ts` (follow the file's existing host/fixture conventions):

```ts
@Component({
  imports: [MlvSmartFilterBar, MlvFilterValueEditorDef],
  template: `
    <mlv-smart-filter-bar [definitions]="definitions">
      <ng-template mlvFilterValueEditor="renewalDate" let-value let-set="setValue">
        <input class="date-editor" [value]="value ?? ''" (input)="set($any($event.target).value)" />
      </ng-template>
      <ng-template mlvFilterValueEditor let-value let-set="setValue">
        <input class="fallback-editor" [value]="value ?? ''" (input)="set($any($event.target).value)" />
      </ng-template>
    </mlv-smart-filter-bar>
  `,
})
class EditorSlotsHost {
  readonly definitions: readonly MlvFilterDefinition[] = [
    { key: 'renewalDate', label: 'Renewal date', editor: 'text', defaultVisible: true },
    { key: 'title', label: 'Title', editor: 'text', defaultVisible: true },
  ];
}

it('routes keyed editor templates to matching fields, key-less to the rest', async () => {
  // open the "Renewal date" filter (first trigger), assert `.date-editor`
  // renders and `.fallback-editor` does not; close; open "Title", assert
  // `.fallback-editor` renders.
});
```

Write the body concretely using the spec file's existing open/close helpers (trigger clicks + `fixture.whenStable()` + overlay queries).

- [ ] **Step 2: Run to verify failure**

Run: `yarn nx test core-filter -- --run --testNamePattern="routes keyed editor"`
Expected: FAIL — built-in `mlv-input` renders instead.

- [ ] **Step 3: Implement** — `smart-filter-bar.ts`:

```ts
/** @private Projected custom value-editor templates, matched to definitions by key. */
private readonly _valueEditors = contentChildren(MlvFilterValueEditorDef);

/** @protected Resolves the value-editor template for one definition (exact key > key-less fallback > null). */
protected _valueEditorFor(
  definition: MlvFilterDefinition,
): TemplateRef<MlvFilterValueEditorContext> | null {
  const editors = this._valueEditors();
  const exact = editors.find(
    (editor) => editor.mlvFilterValueEditor() === definition.key,
  );
  if (exact) return exact.templateRef;
  const fallback = editors.find(
    (editor) => editor.mlvFilterValueEditor() === '',
  );
  return fallback?.templateRef ?? null;
}
```

`smart-filter-bar.html` — add to **both** `mlv-filter` usages (classic `:117` block and query `:269` block):

```html
[valueEditor]="_valueEditorFor(definition)"
```

- [ ] **Step 4: Run tests**

Run: `yarn nx test core-filter -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/core/filter
git commit -m "feat(filter): keyed value-editor templates in mlv-smart-filter-bar"
```

---

### Task 5: `mlv-filter` options editor → `mlv-dropdown-panel`

**Files:**
- Modify: `libs/core/filter/src/lib/filter/filter.ts` (remove roving machinery, add panel wiring)
- Modify: `libs/core/filter/src/lib/filter/filter.html:91-121` (options branch)
- Modify: `libs/core/filter/src/lib/filter/filter.scss` (drop `__option`/`__options` rules)
- Modify: `libs/core/filter/src/lib/filter/filter.spec.ts` (options tests re-target panel rows)
- Modify: `libs/core/filter/project.json` / imports only if lint boundary requires tag updates (core leaf → core family is allowed; expect no change)

**Interfaces:**
- Consumes: `MlvDropdownPanel`, `MlvSelectOption.disabled` (Task 1).
- Produces: options UI = `mlv-dropdown-panel` rows (`.mlv-dropdown-panel__item`); selection round-trips to `in`/`equals` conditions; single-select closes the popup; reconciliation emits are ignored.

- [ ] **Step 1: Re-target existing options tests.** Existing specs query `.mlv-filter__option` buttons and assert `role="listbox"` / `aria-selected` / roving tabindex on them. Update them to the panel's DOM: rows are `overlay.querySelectorAll('.mlv-dropdown-panel__item')` (`[role="option"]`), selection asserted via `aria-selected`, activation via `row.click()`. Delete only tests that assert the hand-rolled roving-tabindex internals (`_optionTabIndex` semantics, Home/End on buttons) — keyboard behavior now belongs to `core-dropdown`/`core-list` specs. Keep and re-target every behavioral test: single commit closes, multi keeps open, `in`-array building, disabled option not selectable, clear from options state.

Add one new regression test:

```ts
it('ignores selection reconciliation emits when the panel mounts', async () => {
  const applied = vi.fn();
  component.applied.subscribe(applied);
  component.conditions.set([
    { operator: 'in', value: ['draft', 'published'] },
  ]);
  fixture.componentRef.setInput('multiple', true);
  fixture.detectChanges();
  await open();
  // Opening alone must not re-commit (live mode) or mutate conditions.
  expect(applied).not.toHaveBeenCalled();
  expect(component.conditions()).toEqual([
    { operator: 'in', value: ['draft', 'published'] },
  ]);
});
```

- [ ] **Step 2: Run to verify failures**

Run: `yarn nx test core-filter -- --run`
Expected: re-targeted tests FAIL (`.mlv-dropdown-panel__item` absent).

- [ ] **Step 3: Implement.** `filter.html` options branch replacement:

```html
@if (_usesOptions()) {
<mlv-dropdown-panel
  class="mlv-filter__options"
  [options]="_panelOptions()"
  [multiple]="multiple()"
  [selectedValues]="_selectedValues()"
  (valueChange)="_onOptionValuesChange($event)"
>
  <span class="mlv-filter__empty">{{ _i18n().selectValue }}</span>
</mlv-dropdown-panel>
} @else {
```

`filter.ts` — add `MlvDropdownPanel` import (component + `imports` array) and:

```ts
/** @protected Options mapped to the dropdown panel's option shape. */
protected readonly _panelOptions = computed(() =>
  this.options().map((option) => ({
    label: option.label,
    value: option.value,
    disabled: option.disabled,
  })),
);

/** @protected Values currently selected in the draft, for the panel. */
protected readonly _selectedValues = computed(() =>
  this._draft().flatMap((condition) =>
    Array.isArray(condition.value) ? condition.value : [condition.value],
  ),
);

/** @protected Applies a panel selection to the draft; ignores reconciliation restates. */
protected _onOptionValuesChange(values: readonly unknown[]): void {
  if (this._editorDisabled()) return;
  const current = this._selectedValues();
  const unchanged =
    values.length === current.length &&
    values.every((value) => current.some((c) => Object.is(c, value)));
  if (unchanged) {
    if (!this.multiple() && values.length > 0) this.opened.set(false);
    return;
  }
  if (this.multiple()) {
    this._draftConditions.set(
      values.length > 0 ? [{ operator: 'in', value: [...values] }] : [],
    );
    this._commitLive(false);
    return;
  }
  const value = values[0];
  this._draftConditions.set(
    value === undefined ? [] : [{ operator: 'equals', value }],
  );
  this._commitLive(true);
}
```

Remove now-dead members and their template references: `_activeOptionIndex`, `_optionButtons`, `_optionTabIndex`, `_setActiveOption`, `_onOptionKeydown`, `_toggleOption`, `_isOptionSelected` (the panel handles selected state), the `optionButton` template refs, `LucideCheck` import if unused elsewhere. Keep `_selectedOptionValues()` only if still referenced — `_selectedValues` supersedes it; delete and update `_isOptionSelected` callers accordingly. **After removal, grep the whole repo for each removed name** (specs, docs) and clean up.

`_onOpened()` options branch — focus moves into the panel's listbox:

```ts
queueMicrotask(() => {
  if (this._usesOptions()) {
    const panel = this._document.getElementById(this._panelId);
    (
      panel?.querySelector('[role="option"][tabindex="0"]') ??
      panel?.querySelector('[role="option"]')
    )?.dispatchEvent(new Event('focus'));
    (panel?.querySelector('[role="option"]') as HTMLElement | null)?.focus();
  } else {
    /* Task 3 branch unchanged */
  }
});
```

Simplify to the minimal working form: focus the listbox element (`panel?.querySelector('[role="listbox"]') as HTMLElement`)`.focus()` is acceptable if aria then routes to the active option — verify in the spec, choose the variant whose test passes with roving focus landing on an option.

`filter.scss` — delete `__option`, `__option-label` rules and the `__options` flex/list styling; keep:

```scss
&__options {
  display: block;
  max-height: 20rem;
}

&__empty {
  display: block;
  padding: var(--mlv-spacing-3);
  color: var(--mlv-text-secondary);
  text-align: center;
}
```

- [ ] **Step 4: Run tests**

Run: `yarn nx test core-filter -- --run`
Expected: PASS, including axe checks (panel brings its own listbox semantics; the old hand-rolled `role="listbox"` wrapper is gone with the buttons).

- [ ] **Step 5: Verify + commit**

Run: `yarn nx run-many -t vite:test typecheck lint -p core-filter core-dropdown`

```bash
git add libs/core/filter
git commit -m "refactor(filter): options editor on mlv-dropdown-panel"
```

---

### Task 6: Styling — "Add filter" chip + spacing token sweep

**Files:**
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.html:308-320` (add button)
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.ts` (LucidePlus import)
- Modify: `libs/core/filter/src/lib/smart-filter-bar/smart-filter-bar.scss`
- Modify: `libs/core/filter/src/lib/filter/filter.scss` (spacing literals → tokens)

**Interfaces:**
- Consumes: existing `mlvButton` component variables (`--mlv-btn-height`, `--mlv-btn-padding`, `--mlv-btn-bg-hover`, `--mlv-btn-text-color`).
- Produces: `.mlv-smart-filter-bar__add` dashed ghost chip.

- [ ] **Step 1: Add plus icon** — `smart-filter-bar.html` add button:

```html
<button
  #addButton
  #addTrigger="mlvPopupTrigger"
  mlvButton
  type="button"
  variant="transparent"
  class="mlv-smart-filter-bar__add"
  [mlvPopupTrigger]="addPopup"
  [ariaHasPopup]="'dialog'"
  [disabled]="disabled() || loading()"
>
  <svg mlvButtonIcon lucidePlus [size]="14" aria-hidden="true"></svg>
  {{ _i18n().addFilter }}
</button>
```

`smart-filter-bar.ts`: add `LucidePlus` to the lucide import and the component `imports` array.

- [ ] **Step 2: Chip styles** — `smart-filter-bar.scss`, on the existing `&__add` (create if absent):

```scss
&__add {
  --mlv-btn-height: var(--mlv-height-xs);
  --mlv-btn-padding: var(--mlv-padding-xs);
  --mlv-btn-text-color: var(--mlv-text-secondary);
  --mlv-btn-bg-hover: var(--mlv-background-neutral-1-hover);
  border: var(--mlv-stroke-width) dashed var(--mlv-border-normal);
  border-radius: var(--mlv-radius-m);

  &:hover {
    --mlv-btn-text-color: var(--mlv-text-primary);
  }
}
```

Verify against `libs/core/button/src/lib/button/button.scss` which component variables actually exist (`--mlv-btn-*` names) and use those; if the transparent variant styles borders, override with the dashed border after it in specificity terms (same selector is enough — component-scoped rules load after via BEM).

- [ ] **Step 3: Token sweep** — in `filter.scss` and `smart-filter-bar.scss`, replace raw spacing literals with the matching `--mlv-spacing-*` token where an exact token exists (`0.125rem`→`--mlv-spacing-0-5`, `0.25rem`→`--mlv-spacing-1`, `0.375rem`→`--mlv-spacing-1-5`, `0.5rem`→`--mlv-spacing-2`, `0.625rem`→`--mlv-spacing-2-5`, `0.75rem`→`--mlv-spacing-3`). Do NOT touch `--mlv-padding-*` pair usage, border widths (`0.0625rem` stays — or use `var(--mlv-stroke-width)` where it means a border), or grid `minmax()` bounds. Check the exact token names against `libs/styles/src/lib/theme.scss` before substituting.

- [ ] **Step 4: Verify + commit**

Run: `yarn nx run-many -t vite:test typecheck lint -p core-filter` and `yarn nx run styles:check-padding-tokens`

```bash
git add libs/core/filter
git commit -m "style(filter): dashed add-filter chip and spacing token sweep"
```

---

### Task 7: Docs — date editor example + doc updates

**Files:**
- Modify: `apps/docs/src/app/pages/filter/examples/4/index.ts`
- Modify: `apps/docs/src/app/pages/filter/examples/4/index.html`
- Modify: `apps/docs/src/app/pages/filter/examples/4/index.mdx`
- Modify: `.claude/projects/libs-filter.md`
- Modify: `apps/docs/src/app/pages/filter/CLAUDE.md` (if it indexes example content)

**Interfaces:**
- Consumes: `MlvFilterValueEditorDef` + context (Task 3), keyed pass-through (Task 4), `MlvDayPicker` (`value = model<Date | null>`) from `@malva-ui/core/day-picker`.
- Produces: example 4's `renewalDate` edited with `mlv-day-picker`; conditions keep ISO `yyyy-MM-dd` strings.

- [ ] **Step 1: Example component** — `index.ts` additions:

```ts
import { MlvFilterValueEditorDef } from '@malva-ui/core/filter';
import { MlvDayPicker } from '@malva-ui/core/day-picker';
// add both to the component imports array

/** Parses an ISO yyyy-MM-dd condition value into a Date for the picker. */
protected toDate(value: unknown): Date | null {
  return typeof value === 'string' && value ? new Date(`${value}T00:00:00`) : null;
}

/** Serializes a picked Date back into the ISO string the condition stores. */
protected toIso(date: Date | null): string {
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Reads one side of a between range value. */
protected rangeAt(value: unknown, index: number): unknown {
  return Array.isArray(value) ? (value[index] ?? '') : '';
}

/** Writes one side of a between range value. */
protected setRangeAt(
  value: unknown,
  index: number,
  next: string,
  set: (value: unknown) => void,
): void {
  const range = Array.isArray(value) ? [...value] : ['', ''];
  range[index] = next;
  set(range);
}
```

`index.html` — inside the existing `<mlv-smart-filter-bar ...>`:

```html
<ng-template
  mlvFilterValueEditor="renewalDate"
  let-value
  let-operator="operator"
  let-disabled="disabled"
  let-set="setValue"
>
  @if (operator === 'between') {
  <div class="query-filter-example__range">
    <mlv-day-picker
      [value]="toDate(rangeAt(value, 0))"
      [disabled]="disabled"
      (valueChange)="setRangeAt(value, 0, toIso($event), set)"
    />
    <mlv-day-picker
      [value]="toDate(rangeAt(value, 1))"
      [disabled]="disabled"
      (valueChange)="setRangeAt(value, 1, toIso($event), set)"
    />
  </div>
  } @else {
  <mlv-day-picker
    [value]="toDate(value)"
    [disabled]="disabled"
    (valueChange)="set(toIso($event))"
  />
  }
</ng-template>
```

Check `MlvDayPicker`'s actual `disabled` input name/shape in `libs/core/day-picker` before binding. `index.scss`: `.query-filter-example__range { display: grid; grid-template-columns: 1fr 1fr; gap: var(--mlv-spacing-2); }` (docs pages keep emulated encapsulation).

- [ ] **Step 2: MDX prose** — extend `index.mdx` with one short paragraph: keyed `mlvFilterValueEditor` templates replace the built-in value input per definition key; key-less template = fallback for all free-form fields.

- [ ] **Step 3: `.claude/projects/libs-filter.md`** — document: `MlvFilterValueEditorDef` (+ context interface fields), `MlvFilter.valueEditor` input, smart-bar keyed resolution order, options editor now rendered by `mlv-dropdown-panel`, Clear reseed behavior, add-filter chip visual.

- [ ] **Step 4: Verify**

Run: `yarn nx run docs:check-doc-api`
Run: `set -o pipefail; yarn nx run docs:build 2>&1 | tail -20` (AOT gate — docs vitest skips template typecheck).
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add apps/docs .claude/projects/libs-filter.md
git commit -m "docs(filter): day-picker value editor example and API docs"
```

---

### Task 8: QA — browser verification at /filter

**Files:** none (verification only; findings feed fix loops).

**Interfaces:**
- Consumes: dev server `localhost:4200/filter` (docs app).

- [ ] **Step 1:** Verify each spec point in the browser:
  1. Renewal date filter opens with `mlv-day-picker` (single) and two pickers for Between; picked dates round-trip into the chip sentence.
  2. Options filter dropdown (Tag/Renewal risk) rows visually match `mlv-select`'s dropdown rows (geometry, selected state, hover); arrows/Home/End/type-ahead work; disabled options skipped.
  3. Title filter: open → Clear → exactly one empty condition row remains (no dead-end); Cancel restores; Apply after Clear clears the chip.
  4. Add filter renders as dashed chip with plus icon; hover/focus states; keyboard reachable, Form-A focus ring.
  5. Dark theme pass on all of the above.
  6. Console free of errors; axe spot-check on the open panels.
- [ ] **Step 2:** Report pass/fail per item with screenshots; failures loop back to the owning task.

---

## Self-Review Notes

- Spec §1 → Tasks 3-4; §2 → Tasks 1, 5; §3 → Task 2; §4 → Task 6; §5 → Task 6 step 3; §6 → Task 7; §7 → tests inside Tasks 1-5 + Task 8. No uncovered spec sections.
- Names cross-checked: `MlvFilterValueEditorDef.mlvFilterValueEditor` / `.templateRef`, `MlvFilter.valueEditor`, `_valueEditorFor`, `_panelOptions`, `_selectedValues`, `_onOptionValuesChange` consistent across tasks.
- Known judgment points left to implementers (explicitly marked in steps): exact `MlvTabbableElementService` signature, `MlvDayPicker.disabled` input shape, existing spec-file harness conventions, exact `--mlv-btn-*` variable names.
