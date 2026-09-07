import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvDropdownPanel } from '@malva-ui/core/dropdown';
import { MlvSelect } from '@malva-ui/core/select';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvFilterCondition, MlvFilterOperator } from '../filter.types';
import { MlvFilter } from './filter';
import { MlvFilterValueEditorDef } from './filter-value-editor';

@Component({
  imports: [MlvFilter, MlvFilterValueEditorDef],
  template: `
    <mlv-filter
      label="Renewal"
      editor="text"
      [applyMode]="applyMode()"
      [allowMultipleConditions]="allowMultiple()"
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
  readonly allowMultiple = signal(false);
  readonly conditions = signal<readonly MlvFilterCondition[]>([]);
}

@Component({
  imports: [MlvFilter, MlvFilterValueEditorDef],
  template: `
    <mlv-filter
      label="Renewal"
      editor="text"
      [operators]="operators"
      [(conditions)]="conditions"
    >
      <ng-template mlvFilterValueEditor let-value let-set="setValue">
        <input
          class="custom-editor"
          [value]="value ?? ''"
          (input)="set($any($event.target).value)"
        />
      </ng-template>
    </mlv-filter>
  `,
})
class ValuelessOperatorHost {
  readonly operators: readonly MlvFilterOperator[] = ['contains', 'empty'];
  readonly conditions = signal<readonly MlvFilterCondition[]>([]);
}

describe('MlvFilter', () => {
  let fixture: ComponentFixture<MlvFilter>;
  let component: MlvFilter;
  let host: HTMLElement;
  let overlay: HTMLElement;

  const options = [
    { label: 'Draft', value: 'draft' },
    { label: 'Requested', value: 'requested' },
    { label: 'Published', value: 'published' },
  ] as const;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvFilter],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvFilter);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    fixture.componentRef.setInput('label', 'Status');
    fixture.componentRef.setInput('options', options);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    overlay.replaceChildren();
  });

  async function open(): Promise<void> {
    (host.querySelector('.mlv-filter__trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Bounded-option rows rendered by the shared `mlv-dropdown-panel`. */
  function optionRows(): HTMLElement[] {
    return [
      ...overlay.querySelectorAll<HTMLElement>('.mlv-dropdown-panel__item'),
    ];
  }

  /**
   * The open editor's dropdown panel. `onValueChange()` is the panel's public
   * re-emit of the aria listbox selection, so calling it reproduces an aria
   * `valueChange` shape the DOM cannot produce on its own — aria's single-select
   * click is a toggle, so it never restates an unchanged selection.
   */
  function panel(): MlvDropdownPanel<unknown> {
    return fixture.debugElement.query(By.directive(MlvDropdownPanel))
      .componentInstance as MlvDropdownPanel<unknown>;
  }

  it('renders a compact, labelled popover trigger', () => {
    const trigger = host.querySelector(
      '.mlv-filter__trigger',
    ) as HTMLButtonElement;
    expect(host.classList.contains('mlv-filter')).toBe(true);
    expect(trigger.textContent).toContain('Status');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-label')).toBe('Filter by Status');
    expect(component.conditionStrategy()).toBe('or');
  });

  it('forwards validation state and its description to the trigger', () => {
    fixture.componentRef.setInput('invalid', true);
    fixture.componentRef.setInput('ariaDescribedBy', 'status-error');
    fixture.detectChanges();

    const trigger = host.querySelector(
      '.mlv-filter__trigger',
    ) as HTMLButtonElement;
    expect(host.classList.contains('mlv-filter--invalid')).toBe(true);
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(trigger.getAttribute('aria-describedby')).toBe('status-error');
  });

  it('commits a single option live and closes the editor', async () => {
    const applied = vi.fn();
    component.applied.subscribe(applied);
    await open();

    const rows = optionRows();
    expect(
      overlay
        .querySelector('.mlv-dropdown-panel__listbox')
        ?.getAttribute('role'),
    ).toBe('listbox');
    expect(rows).toHaveLength(3);
    rows[1].click();
    fixture.detectChanges();

    expect(component.conditions()).toEqual([
      { operator: 'equals', value: 'requested' },
    ]);
    expect(component.opened()).toBe(false);
    expect(applied).toHaveBeenLastCalledWith([
      { operator: 'equals', value: 'requested' },
    ]);
  });

  it('accumulates an in-condition and keeps a multiple editor open', async () => {
    fixture.componentRef.setInput('multiple', true);
    fixture.detectChanges();
    await open();

    const rows = optionRows();
    rows[0].click();
    fixture.detectChanges();
    expect(component.conditions()).toEqual([
      { operator: 'in', value: ['draft'] },
    ]);
    expect(component.opened()).toBe(true);

    rows[2].click();
    fixture.detectChanges();
    expect(component.conditions()).toEqual([
      { operator: 'in', value: ['draft', 'published'] },
    ]);
    expect(component.opened()).toBe(true);
    expect(optionRows()[0].getAttribute('aria-selected')).toBe('true');
    expect(optionRows()[1].getAttribute('aria-selected')).toBe('false');
    expect(optionRows()[2].getAttribute('aria-selected')).toBe('true');

    // Deselecting the last value collapses the field back to no conditions.
    optionRows()[0].click();
    fixture.detectChanges();
    optionRows()[2].click();
    fixture.detectChanges();
    expect(component.conditions()).toEqual([]);
  });

  it('never selects a disabled option', async () => {
    fixture.componentRef.setInput('options', [
      { label: 'Draft', value: 'draft' },
      { label: 'Blocked', value: 'blocked', disabled: true },
    ]);
    fixture.detectChanges();
    await open();

    const rows = optionRows();
    expect(rows[1].getAttribute('aria-disabled')).toBe('true');

    rows[1].click();
    fixture.detectChanges();

    expect(component.conditions()).toEqual([]);
    expect(component.opened()).toBe(true);
  });

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

  it('keeps a committed value whose option is not rendered', async () => {
    const applied = vi.fn();
    component.applied.subscribe(applied);
    component.conditions.set([
      { operator: 'in', value: ['archived', 'draft'] },
    ]);
    fixture.componentRef.setInput('multiple', true);
    fixture.detectChanges();
    await open();

    // aria drops `archived` from its own value model because no option is
    // registered for it. That reconciliation must never reach the conditions.
    expect(applied).not.toHaveBeenCalled();
    expect(component.conditions()).toEqual([
      { operator: 'in', value: ['archived', 'draft'] },
    ]);
    expect(component.opened()).toBe(true);
  });

  it('holds a committed value while an options editor still has no choices', async () => {
    const applied = vi.fn();
    component.applied.subscribe(applied);
    fixture.componentRef.setInput('editor', 'options');
    fixture.componentRef.setInput('options', []);
    component.conditions.set([{ operator: 'equals', value: 'draft' }]);
    fixture.detectChanges();
    await open();

    expect(applied).not.toHaveBeenCalled();
    expect(component.conditions()).toEqual([
      { operator: 'equals', value: 'draft' },
    ]);
    expect(component.opened()).toBe(true);
  });

  it('keeps an unrendered committed value when another option is picked', async () => {
    component.conditions.set([
      { operator: 'in', value: ['archived', 'draft'] },
    ]);
    fixture.componentRef.setInput('multiple', true);
    fixture.detectChanges();
    await open();

    optionRows()[2].click(); // Published
    fixture.detectChanges();

    // aria emits only its rendered values, so `archived` must be re-added or
    // one extra pick would silently drop the rest of the committed selection.
    const [condition] = component.conditions();
    expect(condition.operator).toBe('in');
    expect(condition.value).toEqual(
      expect.arrayContaining(['archived', 'draft', 'published']),
    );
    expect(condition.value as readonly unknown[]).toHaveLength(3);
  });

  it('reads a duplicated selection as a change, not as an unchanged restate', async () => {
    component.conditions.set([
      { operator: 'in', value: ['draft', 'published'] },
    ]);
    fixture.componentRef.setInput('multiple', true);
    fixture.detectChanges();
    await open();

    // Same length, and every incoming value is a member of the current
    // selection — a plain membership test reads this as unchanged and drops it.
    // As multisets `['draft','draft']` and `['draft','published']` differ.
    panel().onValueChange(['draft', 'draft']);
    fixture.detectChanges();

    expect(component.conditions()).toEqual([
      { operator: 'in', value: ['draft', 'draft'] },
    ]);
  });

  it('never resolves an explicit draft from a restated panel emit', async () => {
    fixture.componentRef.setInput('applyMode', 'explicit');
    component.conditions.set([{ operator: 'equals', value: 'draft' }]);
    fixture.detectChanges();
    await open();

    optionRows()[2].click(); // Published — pending, uncommitted.
    fixture.detectChanges();
    expect(component.conditions()).toEqual([
      { operator: 'equals', value: 'draft' },
    ]);

    // A restate of the pending selection must not close the popover: only
    // Apply/Cancel may resolve an explicit draft.
    panel().onValueChange(['published']);
    fixture.detectChanges();
    expect(component.opened()).toBe(true);

    const apply = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Apply');
    apply?.click();
    fixture.detectChanges();

    expect(component.conditions()).toEqual([
      { operator: 'equals', value: 'published' },
    ]);
  });

  it('closes a live single-select editor when the committed option is restated', async () => {
    component.conditions.set([{ operator: 'equals', value: 'draft' }]);
    fixture.detectChanges();
    await open();
    expect(component.opened()).toBe(true);

    panel().onValueChange(['draft']);
    fixture.detectChanges();

    expect(component.opened()).toBe(false);
    expect(component.conditions()).toEqual([
      { operator: 'equals', value: 'draft' },
    ]);
  });

  it('clears the draft when re-clicking the same option in explicit mode', async () => {
    // aria's explicit single-select click model is a toggle (see `panel()`
    // above) — a real re-click on the committed option deselects it. This is
    // the only DOM-reachable path that clears a single-select draft.
    fixture.componentRef.setInput('applyMode', 'explicit');
    await open();

    optionRows()[0].click(); // Draft — pending, uncommitted.
    fixture.detectChanges();
    expect(optionRows()[0].getAttribute('aria-selected')).toBe('true');
    expect(component.conditions()).toEqual([]);

    optionRows()[0].click(); // Re-click deselects the draft.
    fixture.detectChanges();
    expect(optionRows()[0].getAttribute('aria-selected')).toBe('false');

    const apply = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Apply');
    apply?.click();
    fixture.detectChanges();

    expect(component.conditions()).toEqual([]);
  });

  it('moves focus onto the committed option when the bounded editor opens', async () => {
    component.conditions.set([{ operator: 'equals', value: 'published' }]);
    fixture.detectChanges();
    await open();
    await fixture.whenStable();

    expect(document.activeElement).toBe(optionRows()[2]);
  });

  it('summarizes multiple values and clears from a sibling action', async () => {
    component.conditions.set([
      { operator: 'in', value: ['requested', 'published', 'draft'] },
    ]);
    fixture.componentRef.setInput('multiple', true);
    fixture.detectChanges();

    expect(host.textContent).toContain('Status:');
    expect(host.textContent).toContain('Requested');
    expect(host.textContent).toContain('+ 2 more');
    const trigger = host.querySelector('.mlv-filter__trigger');
    const clear = host.querySelector(
      'button[aria-label="Clear Status filter"]',
    ) as HTMLButtonElement;
    expect(clear).not.toBeNull();
    expect(trigger?.contains(clear)).toBe(false);

    clear.click();
    fixture.detectChanges();
    await Promise.resolve();
    expect(component.conditions()).toEqual([]);
    expect(host.querySelector('.mlv-filter__clear')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders a readable, removable sentence chip in query appearance', () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('queryRemovable', true);
    fixture.componentRef.setInput('label', 'Health');
    fixture.componentRef.setInput('options', [
      { label: 'At risk', value: 'risk' },
    ]);
    fixture.componentRef.setInput('operatorLabels', { equals: 'is' });
    component.conditions.set([{ operator: 'equals', value: 'risk' }]);
    fixture.detectChanges();

    const trigger = host.querySelector<HTMLButtonElement>(
      '.mlv-filter__trigger',
    );
    const remove = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Health filter"]',
    );
    expect(host.classList.contains('mlv-filter--query')).toBe(true);
    expect(trigger?.textContent?.trim()).toBe('Health is At risk');
    expect(trigger?.getAttribute('aria-label')).toBe('Health is At risk');
    expect(trigger?.getAttribute('title')).toBe('Health is At risk');
    expect(remove).not.toBeNull();
  });

  it('removes a query chip and restores focus to its sentence trigger', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('queryRemovable', true);
    component.conditions.set([{ operator: 'equals', value: 'requested' }]);
    fixture.detectChanges();

    const trigger = host.querySelector<HTMLButtonElement>(
      '.mlv-filter__trigger',
    );
    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Status filter"]',
      )
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.conditions()).toEqual([]);
    expect(document.activeElement).toBe(trigger);
  });

  it('exposes the localized remove action for a blank removable query field', () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('queryRemovable', true);
    fixture.detectChanges();

    const remove = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Status filter"]',
    );
    expect(remove).not.toBeNull();

    remove?.click();
    fixture.detectChanges();

    expect(component.conditions()).toEqual([]);
  });

  it('keeps explicit edits private until Apply', async () => {
    fixture.componentRef.setInput('applyMode', 'explicit');
    fixture.detectChanges();
    await open();

    optionRows()[2].click();
    fixture.detectChanges();
    expect(component.conditions()).toEqual([]);

    const apply = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Apply');
    apply?.click();
    fixture.detectChanges();
    expect(component.conditions()).toEqual([
      { operator: 'equals', value: 'published' },
    ]);
  });

  it('keeps an explicit panel Clear draft-only when Cancel restores state', async () => {
    fixture.componentRef.setInput('applyMode', 'explicit');
    component.conditions.set([{ operator: 'equals', value: 'requested' }]);
    fixture.detectChanges();
    await open();

    overlay
      .querySelector<HTMLButtonElement>('.mlv-filter__panel-clear')
      ?.click();
    fixture.detectChanges();

    expect(component.conditions()).toEqual([
      { operator: 'equals', value: 'requested' },
    ]);
    expect(component.opened()).toBe(true);

    const cancel = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Cancel');
    cancel?.click();
    fixture.detectChanges();

    expect(component.conditions()).toEqual([
      { operator: 'equals', value: 'requested' },
    ]);
    expect(component.opened()).toBe(false);
  });

  it('commits an explicit panel Clear only on Apply', async () => {
    fixture.componentRef.setInput('applyMode', 'explicit');
    component.conditions.set([{ operator: 'equals', value: 'requested' }]);
    const applied = vi.fn();
    const cleared = vi.fn();
    component.applied.subscribe(applied);
    component.cleared.subscribe(cleared);
    fixture.detectChanges();
    await open();

    overlay
      .querySelector<HTMLButtonElement>('.mlv-filter__panel-clear')
      ?.click();
    fixture.detectChanges();

    expect(applied).not.toHaveBeenCalled();
    expect(cleared).not.toHaveBeenCalled();
    expect(component.opened()).toBe(true);

    const apply = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Apply');
    apply?.click();
    fixture.detectChanges();

    expect(component.conditions()).toEqual([]);
    expect(applied).toHaveBeenCalledWith([]);
    expect(cleared).toHaveBeenCalledTimes(1);
    expect(component.opened()).toBe(false);
  });

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

  it('edits free-text conditions and supports multiple-condition strategy', async () => {
    fixture.componentRef.setInput('editor', 'text');
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('allowMultipleConditions', true);
    fixture.componentRef.setInput('applyMode', 'live');
    fixture.detectChanges();
    await open();

    const input = overlay.querySelector(
      '.mlv-filter__input input',
    ) as HTMLInputElement;
    input.value = 'requested';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.conditions()[0]).toMatchObject({
      operator: 'contains',
      value: 'requested',
    });

    const add = [...overlay.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.includes('Add condition'),
    );
    add?.click();
    fixture.detectChanges();
    expect(overlay.querySelectorAll('.mlv-filter__condition')).toHaveLength(2);
    expect(overlay.querySelector('.mlv-filter__strategy')).not.toBeNull();
  });

  it('normalizes complete numeric between ranges and summarizes them as one value', async () => {
    fixture.componentRef.setInput('editor', 'number');
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('operators', ['between']);
    fixture.componentRef.setInput('defaultOperator', 'between');
    fixture.detectChanges();
    await open();

    const inputs = overlay.querySelectorAll<HTMLInputElement>(
      '.mlv-filter__range input',
    );
    expect(inputs).toHaveLength(2);
    inputs[0].value = '10';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.conditions()).toEqual([]);

    inputs[1].value = '20';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.conditions()[0]).toMatchObject({
      operator: 'between',
      value: [10, 20],
    });

    component.opened.set(false);
    fixture.detectChanges();
    expect(host.querySelector('.mlv-filter__value')?.textContent).toBe(
      '10 – 20',
    );
    expect(host.querySelector('.mlv-filter__more')).toBeNull();
  });

  it('falls back to the first allowed operator when the requested default is unavailable', async () => {
    fixture.componentRef.setInput('editor', 'number');
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('operators', [
      'equals',
      'greater-than',
      'less-than',
    ]);
    fixture.detectChanges();
    await open();

    const input = overlay.querySelector(
      '.mlv-filter__input input',
    ) as HTMLInputElement;
    input.value = '42';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(component.conditions()[0]).toMatchObject({
      operator: 'equals',
      value: 42,
    });
  });

  it('uses the translated operator label for valueless summaries', () => {
    component.conditions.set([{ operator: 'empty', value: null }]);
    fixture.detectChanges();
    expect(host.querySelector('.mlv-filter__value')?.textContent).toBe(
      'Is empty',
    );
    expect(host.textContent).toContain('Is empty');
  });

  it('blocks interaction while disabled or loading', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(
      (host.querySelector('.mlv-filter__trigger') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(host.classList.contains('mlv-filter--loading')).toBe(true);
    expect(host.querySelector('mlv-loader')).not.toBeNull();
  });

  it('locks an already-open bounded editor when loading starts', async () => {
    await open();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const rows = optionRows();
    expect(rows.map((row) => row.getAttribute('aria-disabled'))).toEqual([
      'true',
      'true',
      'true',
    ]);

    rows[1].click();
    fixture.detectChanges();
    expect(component.conditions()).toEqual([]);
  });

  it('locks an already-open editor when loading starts', async () => {
    fixture.componentRef.setInput('editor', 'text');
    fixture.componentRef.setInput('options', []);
    fixture.componentRef.setInput('allowMultipleConditions', true);
    fixture.detectChanges();
    await open();

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const input = overlay.querySelector(
      '.mlv-filter__input input',
    ) as HTMLInputElement;
    const operator = overlay.querySelector(
      '.mlv-filter__operator [role="combobox"]',
    ) as HTMLElement;
    const add = overlay.querySelector(
      '.mlv-filter__add-condition',
    ) as HTMLButtonElement;
    expect(input.disabled).toBe(true);
    expect(operator.getAttribute('aria-disabled')).toBe('true');
    expect(add.disabled).toBe(true);

    input.value = 'must not commit';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.conditions()).toEqual([]);
  });

  it('is axe-clean with its option dialog open', async () => {
    await open();
    await expectNoAxeViolations(document.body);
  });

  it('is axe-clean with a query chip editor open', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    component.conditions.set([{ operator: 'equals', value: 'draft' }]);
    fixture.detectChanges();
    await open();
    await expectNoAxeViolations(document.body);
  });

  describe('custom value editor slot', () => {
    let slotFixture: ComponentFixture<SlotHost>;
    let slotHost: SlotHost;

    beforeEach(async () => {
      slotFixture = TestBed.createComponent(SlotHost);
      slotHost = slotFixture.componentInstance;
      slotFixture.detectChanges();
      await slotFixture.whenStable();
    });

    async function openIn(
      target: ComponentFixture<SlotHost | ValuelessOperatorHost>,
    ): Promise<void> {
      (
        target.nativeElement.querySelector(
          '.mlv-filter__trigger',
        ) as HTMLButtonElement
      ).click();
      target.detectChanges();
      await target.whenStable();
      target.detectChanges();
    }

    it('renders the template instead of the built-in input', async () => {
      await openIn(slotFixture);

      expect(overlay.querySelector('.custom-editor')).toBeTruthy();
      expect(overlay.querySelector('.mlv-filter__input')).toBeNull();
      // Operator select stays lib-owned.
      expect(overlay.querySelector('.mlv-filter__operator')).toBeTruthy();
    });

    it('setValue commits immediately in live mode', async () => {
      await openIn(slotFixture);

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
      await openIn(slotFixture);

      const input = overlay.querySelector('.custom-editor') as HTMLInputElement;
      input.value = '2026-10-01';
      input.dispatchEvent(new Event('input'));
      slotFixture.detectChanges();
      expect(slotHost.conditions()).toEqual([]);

      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      slotFixture.detectChanges();

      expect(slotHost.conditions()).toEqual([
        expect.objectContaining({ operator: 'contains', value: '2026-10-01' }),
      ]);
    });

    it('focuses the first tabbable control inside a custom editor on open', async () => {
      await openIn(slotFixture);
      await slotFixture.whenStable();

      expect(document.activeElement).toBe(
        overlay.querySelector('.custom-editor'),
      );
    });

    it('focuses the custom editor of a newly added condition row', async () => {
      slotHost.allowMultiple.set(true);
      slotFixture.detectChanges();
      await openIn(slotFixture);

      (
        overlay.querySelector('.mlv-filter__add-condition') as HTMLButtonElement
      ).click();
      slotFixture.detectChanges();
      await slotFixture.whenStable();

      const cells = overlay.querySelectorAll<HTMLElement>(
        '.mlv-filter__value-cell',
      );
      expect(cells).toHaveLength(2);
      expect(cells[1].contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(
        cells[1].querySelector('.custom-editor'),
      );
    });

    it('does not render the slot for valueless operators', async () => {
      const valuelessFixture = TestBed.createComponent(ValuelessOperatorHost);
      valuelessFixture.detectChanges();
      await valuelessFixture.whenStable();
      await openIn(valuelessFixture);

      expect(overlay.querySelector('.custom-editor')).toBeTruthy();

      const operatorSelect = valuelessFixture.debugElement
        .queryAll(By.directive(MlvSelect))
        .find((candidate) =>
          (candidate.nativeElement as HTMLElement).classList.contains(
            'mlv-filter__operator',
          ),
        );
      expect(operatorSelect).toBeTruthy();
      (
        operatorSelect?.componentInstance as MlvSelect<MlvFilterOperator>
      ).selectOption(['empty']);
      valuelessFixture.detectChanges();

      expect(valuelessFixture.componentInstance.conditions()).toEqual([
        expect.objectContaining({ operator: 'empty', value: null }),
      ]);
      expect(overlay.querySelector('.custom-editor')).toBeNull();
      expect(overlay.querySelector('.mlv-filter__value-cell')).toBeNull();
    });
  });
});
