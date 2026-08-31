import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvSearchField } from '@malva-ui/core/search-field';
import * as axe from 'axe-core';
import { MlvFilter } from '../filter/filter';
import { MlvFilterValueEditorDef } from '../filter/filter-value-editor';
import type {
  MlvFilterDefinition,
  MlvFilterExecutionPayload,
} from '../filter.types';
import { MlvSmartFilterBar } from './smart-filter-bar';

@Component({
  imports: [MlvSmartFilterBar, MlvFilterValueEditorDef],
  template: `
    <mlv-smart-filter-bar [definitions]="definitions">
      <ng-template
        mlvFilterValueEditor="renewalDate"
        let-value
        let-set="setValue"
      >
        <input
          class="date-editor"
          [value]="value ?? ''"
          (input)="set($any($event.target).value)"
        />
      </ng-template>
      <ng-template mlvFilterValueEditor let-value let-set="setValue">
        <input
          class="fallback-editor"
          [value]="value ?? ''"
          (input)="set($any($event.target).value)"
        />
      </ng-template>
    </mlv-smart-filter-bar>
  `,
})
class EditorSlotsHost {
  readonly definitions: readonly MlvFilterDefinition[] = [
    {
      key: 'renewalDate',
      label: 'Renewal date',
      editor: 'text',
      defaultVisible: true,
    },
    { key: 'title', label: 'Title', editor: 'text', defaultVisible: true },
  ];
}

@Component({
  imports: [MlvSmartFilterBar, MlvFilterValueEditorDef],
  template: `
    <mlv-smart-filter-bar [definitions]="definitions">
      @if (true) {
        <ng-template
          mlvFilterValueEditor="renewalDate"
          let-value
          let-set="setValue"
        >
          <input
            class="nested-date-editor"
            [value]="value ?? ''"
            (input)="set($any($event.target).value)"
          />
        </ng-template>
      }
    </mlv-smart-filter-bar>
  `,
})
class NestedEditorSlotHost {
  readonly definitions: readonly MlvFilterDefinition[] = [
    {
      key: 'renewalDate',
      label: 'Renewal date',
      editor: 'text',
      defaultVisible: true,
    },
  ];
}

describe('MlvSmartFilterBar', () => {
  let fixture: ComponentFixture<MlvSmartFilterBar>;
  let component: MlvSmartFilterBar;
  let host: HTMLElement;
  let overlay: HTMLElement;

  const definitions: readonly MlvFilterDefinition[] = [
    {
      key: 'status',
      label: 'Status',
      defaultVisible: true,
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      key: 'owner',
      label: 'Owner',
      defaultVisible: true,
      editor: 'text',
    },
    {
      key: 'country',
      label: 'Country',
      options: [{ label: 'Romania', value: 'ro' }],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvSmartFilterBar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvSmartFilterBar);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    fixture.componentRef.setInput('definitions', definitions);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    overlay.replaceChildren();
  });

  function satisfyRequiredStatus(): void {
    component.filters.set([
      {
        key: 'status',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'draft' }],
      },
    ]);
    fixture.detectChanges();
  }

  it('initializes required and default-visible fields in metadata order', () => {
    expect(component.visibleKeys()).toEqual(['status', 'owner']);
    expect(component.visibleFilterCount()).toBe(2);
    expect(
      host.querySelectorAll('.mlv-smart-filter-bar__filters mlv-filter'),
    ).toHaveLength(2);
    expect(
      host.querySelector('button[aria-label="Manage filters"]')?.textContent,
    ).toContain('Filters (2)');
  });

  it('keeps required fields visible and blocks execution with accessible errors while empty', async () => {
    const execute = vi.fn();
    const refresh = vi.fn();
    component.execute.subscribe(execute);
    component.refresh.subscribe(refresh);
    component.filtersVisible.set(false);

    component.executeQuery();
    component.refreshQuery();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(execute).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(component.filtersVisible()).toBe(true);
    expect(component.visibleKeys()).toContain('status');
    const summary = host.querySelector('[role="alert"]');
    expect(summary?.textContent).toContain(
      'Complete the required filter before running the query.',
    );
    const trigger = host.querySelector<HTMLButtonElement>(
      '.mlv-filter__trigger',
    );
    expect(trigger?.getAttribute('aria-invalid')).toBe('true');
    const errorId = trigger?.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(host.querySelector(`[id="${errorId}"]`)?.textContent).toContain(
      'Status is required.',
    );
    expect(document.activeElement).toBe(trigger);

    satisfyRequiredStatus();
    component.executeQuery();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('uses OR as the default multi-condition strategy', () => {
    const filter = fixture.debugElement.query(By.directive(MlvFilter))
      .componentInstance as MlvFilter;
    expect(filter.conditionStrategy()).toBe('or');
  });

  it('executes an immutable search and structured-filter snapshot', () => {
    component.searchValue.set('quarterly');
    component.filters.set([
      {
        key: 'status',
        strategy: 'and',
        conditions: [{ operator: 'in', value: ['draft'] }],
      },
    ]);
    const execute = vi.fn();
    component.execute.subscribe(execute);

    component.executeQuery();

    expect(execute).toHaveBeenCalledWith({
      search: 'quarterly',
      visibleKeys: ['status', 'owner'],
      filters: [
        {
          key: 'status',
          strategy: 'and',
          conditions: [{ operator: 'in', value: ['draft'] }],
        },
      ],
      expression: {
        kind: 'group',
        combinator: 'and',
        children: [
          {
            kind: 'condition',
            key: 'status',
            condition: { operator: 'in', value: ['draft'] },
          },
        ],
      },
    });
    const emitted = execute.mock.calls[0][0];
    expect(emitted.filters).not.toBe(component.filters());
    expect(emitted.visibleKeys).not.toBe(component.visibleKeys());
    expect(emitted.expression).not.toBe(component.filters());
  });

  it('keeps classic as the default appearance and renders query state as sentence chips', () => {
    expect(
      host.querySelector('button[aria-label="Manage filters"]'),
    ).not.toBeNull();

    fixture.componentRef.setInput('appearance', 'query');
    component.filters.set([
      {
        key: 'status',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'draft' }],
      },
    ]);
    fixture.detectChanges();

    expect(host.classList.contains('mlv-smart-filter-bar--query')).toBe(true);
    expect(host.textContent).toContain('Status Equals Draft');
    expect(host.textContent).toContain('Add filter');
    expect(host.textContent).not.toContain('Manage filters');
    expect(
      host.querySelector('.mlv-smart-filter-bar__query-filters'),
    ).not.toBeNull();
  });

  it('searches eligible query filters, makes only visibility state, and focuses the added trigger', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('definitions', [
      ...definitions,
      {
        key: 'region',
        label: 'Région',
        options: [{ label: 'Europe', value: 'eu' }],
      },
      {
        key: 'archived',
        label: 'Archived',
        disabled: true,
      },
    ]);
    fixture.detectChanges();

    host
      .querySelector<HTMLButtonElement>('.mlv-smart-filter-bar__add')
      ?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const search = overlay.querySelector<HTMLInputElement>(
      '.mlv-smart-filter-bar__add-search input',
    );
    if (!search) throw new Error('Expected Add filter search input.');
    search.value = 'REGION';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const choices = overlay.querySelectorAll<HTMLButtonElement>(
      '.mlv-smart-filter-bar__add-option',
    );
    expect([...choices].map((choice) => choice.textContent?.trim())).toEqual([
      'Région',
    ]);
    choices[0].click();
    fixture.detectChanges();
    overlay
      .querySelector<HTMLElement>('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.visibleKeys()).toContain('region');
    expect(
      component.filters().find((filter) => filter.key === 'region'),
    ).toBeUndefined();
    expect(
      host
        .querySelector<HTMLButtonElement>('.mlv-smart-filter-bar__add')
        ?.getAttribute('aria-expanded'),
    ).toBe('false');
    const regionTrigger = [
      ...host.querySelectorAll<HTMLButtonElement>('.mlv-filter__trigger'),
    ].find((trigger) => trigger.textContent?.trim() === 'Région');
    expect(document.activeElement).toBe(regionTrigger);
  });

  it('removes a blank newly added optional query filter without inventing state', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('autoExecute', true);
    satisfyRequiredStatus();
    const execute = vi.fn();
    component.execute.subscribe(execute);
    fixture.detectChanges();

    host
      .querySelector<HTMLButtonElement>('.mlv-smart-filter-bar__add')
      ?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    [
      ...overlay.querySelectorAll<HTMLButtonElement>(
        '.mlv-smart-filter-bar__add-option',
      ),
    ]
      .find((option) => option.textContent?.trim() === 'Country')
      ?.click();
    fixture.detectChanges();
    overlay
      .querySelector<HTMLElement>('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.visibleKeys()).toContain('country');
    expect(component.filters().map((state) => state.key)).toEqual(['status']);
    expect(
      host.querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Country filter"]',
      ),
    ).not.toBeNull();

    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Country filter"]',
      )
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.visibleKeys()).not.toContain('country');
    expect(component.filters().map((state) => state.key)).toEqual(['status']);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('uses honest native list semantics for the Add filter popup', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.detectChanges();
    host
      .querySelector<HTMLButtonElement>('.mlv-smart-filter-bar__add')
      ?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const list = overlay.querySelector('.mlv-smart-filter-bar__add-list');
    const option = overlay.querySelector<HTMLButtonElement>(
      '.mlv-smart-filter-bar__add-option',
    );
    expect(list?.tagName).toBe('UL');
    expect(list?.getAttribute('role')).toBeNull();
    expect(option?.parentElement?.tagName).toBe('LI');
    expect(option?.getAttribute('role')).toBeNull();
    option?.focus();
    expect(document.activeElement).toBe(option);

    const results = await axe.run(overlay, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('falls back to Add filter focus after the popup detaches when metadata removes the selected field', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.detectChanges();
    const add = host.querySelector<HTMLButtonElement>(
      '.mlv-smart-filter-bar__add',
    );
    add?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    [
      ...overlay.querySelectorAll<HTMLButtonElement>(
        '.mlv-smart-filter-bar__add-option',
      ),
    ]
      .find((option) => option.textContent?.trim() === 'Country')
      ?.click();
    fixture.componentRef.setInput(
      'definitions',
      definitions.filter((definition) => definition.key !== 'country'),
    );
    fixture.detectChanges();
    overlay
      .querySelector<HTMLElement>('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(overlay.querySelector('.mlv-popup')).toBeNull();
    expect(document.activeElement).toBe(add);
  });

  it('removes an optional query chip from state and executes once in live mode', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('autoExecute', true);
    component.visibleKeys.set(['status', 'country']);
    component.filters.set([
      {
        key: 'status',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'draft' }],
      },
      {
        key: 'country',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'ro' }],
      },
    ]);
    const execute = vi.fn();
    component.execute.subscribe(execute);
    fixture.detectChanges();

    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Country filter"]',
      )
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.filters().map((filter) => filter.key)).toEqual(['status']);
    expect(component.visibleKeys()).toEqual(['status']);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('clears all query state while retaining required fields and waiting for a valid query', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('autoExecute', true);
    component.searchValue.set('draft');
    component.visibleKeys.set(['status', 'country']);
    component.filters.set([
      {
        key: 'status',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'draft' }],
      },
      {
        key: 'country',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'ro' }],
      },
    ]);
    const execute = vi.fn();
    component.execute.subscribe(execute);
    fixture.detectChanges();

    host
      .querySelector<HTMLButtonElement>('.mlv-smart-filter-bar__clear-all')
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.searchValue()).toBe('');
    expect(component.filters()).toEqual([]);
    expect(component.visibleKeys()).toEqual(['status']);
    expect(execute).not.toHaveBeenCalled();
  });

  it('waits for Apply before executing a query filter in explicit mode', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('filterApplyMode', 'explicit');
    fixture.componentRef.setInput('autoExecute', true);
    const execute = vi.fn();
    component.execute.subscribe(execute);
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('.mlv-filter__trigger')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    overlay
      .querySelectorAll<HTMLElement>('.mlv-dropdown-panel__item')[0]
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();
    expect(execute).not.toHaveBeenCalled();

    [...overlay.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Apply')
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();
    expect(execute).not.toHaveBeenCalled();

    host
      .querySelector<HTMLButtonElement>('.mlv-smart-filter-bar__apply-query')
      ?.click();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('keeps query filter edits, removal, and Clear all private in explicit mode', async () => {
    fixture.componentRef.setInput('appearance', 'query');
    fixture.componentRef.setInput('filterApplyMode', 'explicit');
    fixture.componentRef.setInput('autoExecute', true);
    satisfyRequiredStatus();
    component.visibleKeys.set(['status', 'country']);
    component.filters.set([
      ...component.filters(),
      {
        key: 'country',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'ro' }],
      },
    ]);
    const execute = vi.fn();
    component.execute.subscribe(execute);
    fixture.detectChanges();

    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Country filter"]',
      )
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();
    expect(execute).not.toHaveBeenCalled();

    host
      .querySelector<HTMLButtonElement>('.mlv-smart-filter-bar__apply-query')
      ?.click();
    expect(execute).toHaveBeenCalledTimes(1);

    host
      .querySelector<HTMLButtonElement>('.mlv-smart-filter-bar__clear-all')
      ?.click();
    fixture.detectChanges();
    await Promise.resolve();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('deep-clones nested option values in execution payloads', () => {
    const nestedValue = { scope: { ids: [1] } };
    component.filters.set([
      {
        key: 'status',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: nestedValue }],
      },
    ]);
    const execute = vi.fn();
    component.execute.subscribe(execute);

    component.executeQuery();

    const emitted = execute.mock.calls[0][0] as MlvFilterExecutionPayload;
    const emittedValue = emitted.filters[0].conditions[0].value as {
      scope: { ids: number[] };
    };
    expect(emittedValue).not.toBe(nestedValue);
    expect(emittedValue.scope).not.toBe(nestedValue.scope);
    expect(emittedValue.scope.ids).not.toBe(nestedValue.scope.ids);
    nestedValue.scope.ids.push(2);
    expect(emittedValue.scope.ids).toEqual([1]);
    const expressionChild =
      emitted.expression.kind === 'group'
        ? emitted.expression.children[0]
        : undefined;
    expect(
      expressionChild?.kind === 'condition'
        ? (expressionChild.condition.value as { scope: { ids: number[] } })
            .scope.ids
        : undefined,
    ).toEqual([1]);
  });

  it('configures clear commits for live or auto-executing search only', () => {
    fixture.componentRef.setInput('searchTrigger', 'submit');
    fixture.detectChanges();
    const search = fixture.debugElement.query(By.directive(MlvSearchField))
      .componentInstance as MlvSearchField;
    expect(search.commitOnClear()).toBe(false);

    fixture.componentRef.setInput('searchTrigger', 'live');
    fixture.detectChanges();
    expect(search.commitOnClear()).toBe(true);

    fixture.componentRef.setInput('searchTrigger', 'submit');
    fixture.componentRef.setInput('autoExecute', true);
    fixture.detectChanges();
    expect(search.commitOnClear()).toBe(true);
  });

  it('submits global search from the composed search field', () => {
    satisfyRequiredStatus();
    fixture.componentRef.setInput('searchTrigger', 'submit');
    fixture.detectChanges();
    const execute = vi.fn();
    component.execute.subscribe(execute);
    const search = fixture.debugElement.query(By.directive(MlvSearchField))
      .componentInstance as MlvSearchField;

    search.value.set('invoices');
    search.search.emit('invoices');

    expect(component.searchValue()).toBe('invoices');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].search).toBe('invoices');
  });

  it('keeps the default live field visually simple while Enter executes staged text', () => {
    satisfyRequiredStatus();
    const execute = vi.fn();
    component.execute.subscribe(execute);
    const input = host.querySelector(
      '.mlv-smart-filter-bar__search input',
    ) as HTMLInputElement;
    input.value = 'customers';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(component.searchValue()).toBe('customers');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].search).toBe('customers');
  });

  it('merges one field change without disturbing other field state', () => {
    component.filters.set([
      {
        key: 'owner',
        strategy: 'or',
        conditions: [{ operator: 'contains', value: 'Ada' }],
      },
    ]);
    fixture.detectChanges();

    const filters = fixture.debugElement
      .queryAll(By.directive(MlvFilter))
      .map((debug) => debug.componentInstance as MlvFilter);
    filters[0].conditions.set([{ operator: 'equals', value: 'published' }]);
    fixture.detectChanges();

    expect(component.filters()).toEqual([
      {
        key: 'status',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'published' }],
      },
      {
        key: 'owner',
        strategy: 'or',
        conditions: [{ operator: 'contains', value: 'Ada' }],
      },
    ]);
  });

  it('waits for asynchronous definitions before initializing visibility', async () => {
    const asyncFixture = TestBed.createComponent(MlvSmartFilterBar);
    asyncFixture.componentRef.setInput('definitions', []);
    asyncFixture.detectChanges();
    await asyncFixture.whenStable();
    expect(asyncFixture.componentInstance.visibleKeys()).toEqual([]);

    asyncFixture.componentRef.setInput('definitions', definitions);
    asyncFixture.detectChanges();
    await asyncFixture.whenStable();
    asyncFixture.detectChanges();

    expect(asyncFixture.componentInstance.visibleKeys()).toEqual([
      'status',
      'owner',
    ]);
    asyncFixture.destroy();
  });

  it('reconciles changing metadata, prunes removed state, and preserves hidden intent', async () => {
    component.visibleKeys.set(['status']);
    component.filters.set([
      {
        key: 'status',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'draft' }],
      },
      {
        key: 'country',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'ro' }],
      },
      {
        key: 'removed',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'stale' }],
      },
    ]);
    fixture.componentRef.setInput('definitions', [
      definitions[2],
      definitions[0],
      {
        key: 'channel',
        label: 'Channel',
        defaultVisible: true,
      },
      definitions[1],
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.filters().map((state) => state.key)).toEqual([
      'country',
      'status',
    ]);
    expect(component.visibleKeys()).toEqual(['country', 'status', 'channel']);
    expect(component.visibleKeys()).not.toContain('owner');

    fixture.componentRef.setInput('definitions', [
      definitions[0],
      definitions[1],
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.filters().map((state) => state.key)).toEqual(['status']);
    expect(component.visibleKeys()).toEqual(['status']);
  });

  it('manages available fields while keeping required fields visible', async () => {
    const manager = host.querySelector(
      'button[aria-label="Manage filters"]',
    ) as HTMLButtonElement;
    manager.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const checkboxInputs = overlay.querySelectorAll<HTMLInputElement>(
      '.mlv-smart-filter-bar__manager-list input[type="checkbox"]',
    );
    expect(checkboxInputs).toHaveLength(3);
    expect(checkboxInputs[0].disabled).toBe(true);
    expect(checkboxInputs[2].checked).toBe(false);

    checkboxInputs[2].click();
    fixture.detectChanges();
    expect(component.visibleKeys()).toEqual(['status', 'owner']);

    const apply = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Apply');
    apply?.click();
    fixture.detectChanges();
    expect(component.visibleKeys()).toEqual(['status', 'owner', 'country']);
  });

  it('keeps active fields visible and explains their locked manager state', async () => {
    component.filters.set([
      {
        key: 'country',
        strategy: 'or',
        conditions: [{ operator: 'equals', value: 'ro' }],
      },
    ]);
    component.visibleKeys.set(['status', 'owner']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.visibleKeys()).toEqual(['status', 'owner', 'country']);

    const manager = host.querySelector(
      'button[aria-label="Manage filters"]',
    ) as HTMLButtonElement;
    manager.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const countryOption = [
      ...overlay.querySelectorAll<HTMLElement>(
        '.mlv-smart-filter-bar__manager-option',
      ),
    ].find((option) => option.textContent?.includes('Country'));
    const countryInput = countryOption?.querySelector('input');
    expect(countryInput?.checked).toBe(true);
    expect(countryInput?.disabled).toBe(true);
    expect(countryOption?.textContent).toContain('Active');
  });

  it('matches available-filter labels without case or diacritic sensitivity', async () => {
    fixture.componentRef.setInput(
      'definitions',
      definitions.map((definition) =>
        definition.key === 'country'
          ? { ...definition, label: 'Région' }
          : definition,
      ),
    );
    fixture.detectChanges();

    const manager = host.querySelector(
      'button[aria-label="Manage filters"]',
    ) as HTMLButtonElement;
    manager.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const results = await axe.run(overlay, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    const search = overlay.querySelector<HTMLInputElement>(
      '.mlv-smart-filter-bar__manager-search input',
    );
    search.value = 'REGION';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const matchingLabels = [
      ...overlay.querySelectorAll<HTMLElement>(
        '.mlv-smart-filter-bar__manager-list mlv-checkbox',
      ),
    ].map((checkbox) => checkbox.textContent?.trim());
    expect(matchingLabels).toEqual(['Région']);
  });

  it('discards staged visibility on Cancel and stages Reset until Apply', async () => {
    component.visibleKeys.set(['status', 'owner', 'country']);
    fixture.detectChanges();
    const manager = host.querySelector(
      'button[aria-label="Manage filters"]',
    ) as HTMLButtonElement;
    manager.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const reset = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Reset');
    reset?.click();
    fixture.detectChanges();
    const checkboxInputs = overlay.querySelectorAll<HTMLInputElement>(
      '.mlv-smart-filter-bar__manager-list input[type="checkbox"]',
    );
    expect(checkboxInputs[2].checked).toBe(false);
    expect(component.visibleKeys()).toEqual(['status', 'owner', 'country']);

    const cancel = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Cancel');
    cancel?.click();
    fixture.detectChanges();
    expect(component.visibleKeys()).toEqual(['status', 'owner', 'country']);
  });

  it('clears values without changing visibility and resets all state to defaults', () => {
    component.visibleKeys.set(['status', 'country']);
    component.searchValue.set('active');
    component.filters.set([
      {
        key: 'status',
        strategy: 'and',
        conditions: [{ operator: 'equals', value: 'draft' }],
      },
    ]);
    component.clear();
    expect(component.searchValue()).toBe('');
    expect(component.filters()).toEqual([]);
    expect(component.visibleKeys()).toEqual(['status', 'country']);

    const reset = vi.fn();
    component.resetCompleted.subscribe(reset);
    component.searchValue.set('again');
    component.resetToDefaults();
    expect(component.searchValue()).toBe('');
    expect(component.visibleKeys()).toEqual(['status', 'owner']);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('auto-executes condition changes and exposes refresh independently', async () => {
    fixture.componentRef.setInput('autoExecute', true);
    fixture.detectChanges();
    const execute = vi.fn();
    const refresh = vi.fn();
    component.execute.subscribe(execute);
    component.refresh.subscribe(refresh);

    const filter = fixture.debugElement.query(By.directive(MlvFilter))
      .componentInstance as MlvFilter;
    filter.conditions.set([{ operator: 'equals', value: 'draft' }]);
    await Promise.resolve();
    component.refreshQuery();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0][0].filters[0].key).toBe('status');
  });

  it('collapses filter fields without discarding their conditions', () => {
    component.filters.set([
      {
        key: 'status',
        strategy: 'and',
        conditions: [{ operator: 'equals', value: 'draft' }],
      },
    ]);
    const toggle = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.includes('Hide filters'),
    );
    toggle?.click();
    fixture.detectChanges();

    expect(component.filtersVisible()).toBe(false);
    // The filters region lives inside <mlv-expand>, which destroys its body
    // when closed — the conditions survive in component state, not the DOM.
    expect(host.querySelector('.mlv-smart-filter-bar__filters')).toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(component.filters()).toHaveLength(1);
  });

  it('renders the manager as a focus-trapped modal and restores its trigger', async () => {
    const manager = host.querySelector(
      'button[aria-label="Manage filters"]',
    ) as HTMLButtonElement;
    manager.focus();
    manager.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = overlay.querySelector<HTMLElement>(
      '.mlv-popup[role="dialog"]',
    );
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(overlay.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
    expect(document.activeElement).toBe(
      overlay.querySelector('.mlv-smart-filter-bar__manager-search input'),
    );

    const results = await axe.run(overlay, {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    const cancel = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === 'Cancel');
    cancel?.click();
    fixture.detectChanges();
    overlay
      .querySelector<HTMLElement>('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
    expect(document.activeElement).toBe(manager);
  });

  it('disables query, toolbar, filter, and manager actions while loading', async () => {
    const execute = vi.fn();
    component.execute.subscribe(execute);
    const manager = host.querySelector(
      'button[aria-label="Manage filters"]',
    ) as HTMLButtonElement;
    manager.click();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(
      [...host.querySelectorAll<HTMLButtonElement>('button')].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    expect(
      host.querySelector<HTMLInputElement>(
        '.mlv-smart-filter-bar__search input',
      )?.disabled,
    ).toBe(true);
    expect(
      [...overlay.querySelectorAll<HTMLButtonElement>('button')].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    expect(
      overlay.querySelector<HTMLInputElement>(
        '.mlv-smart-filter-bar__manager-search input',
      )?.disabled,
    ).toBe(true);
    expect(
      [
        ...overlay.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      ].every((input) => input.disabled),
    ).toBe(true);

    component.executeQuery();
    expect(execute).not.toHaveBeenCalled();
  });

  it('is axe-clean in its expanded default state', async () => {
    const results = await axe.run(host, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('routes keyed editor templates to matching fields, key-less to the rest', async () => {
    const editorFixture = TestBed.createComponent(EditorSlotsHost);
    editorFixture.detectChanges();
    await editorFixture.whenStable();
    editorFixture.detectChanges();

    const editorHost = editorFixture.nativeElement as HTMLElement;
    const triggers = [
      ...editorHost.querySelectorAll<HTMLButtonElement>('.mlv-filter__trigger'),
    ];
    expect(triggers.map((trigger) => trigger.textContent?.trim())).toEqual([
      'Renewal date',
      'Title',
    ]);
    const [renewalTrigger, titleTrigger] = triggers;

    renewalTrigger.click();
    editorFixture.detectChanges();
    await editorFixture.whenStable();
    editorFixture.detectChanges();

    expect(overlay.querySelector('.date-editor')).not.toBeNull();
    expect(overlay.querySelector('.fallback-editor')).toBeNull();

    renewalTrigger.click();
    editorFixture.detectChanges();
    overlay
      .querySelector<HTMLElement>('.mlv-popup')
      ?.dispatchEvent(new Event('animationend'));
    await editorFixture.whenStable();
    editorFixture.detectChanges();

    titleTrigger.click();
    editorFixture.detectChanges();
    await editorFixture.whenStable();
    editorFixture.detectChanges();

    expect(overlay.querySelector('.fallback-editor')).not.toBeNull();
  });

  it('reaches a keyed editor template projected inside an @if block', async () => {
    // `contentChildren(MlvFilterValueEditorDef)` must opt into
    // `descendants: true` — otherwise a template wrapped in `@if`/`@for`/
    // `ng-container` is silently missed, unlike `MlvFilter`'s own
    // `contentChild` half, which already defaults to `descendants: true`.
    const nestedFixture = TestBed.createComponent(NestedEditorSlotHost);
    nestedFixture.detectChanges();
    await nestedFixture.whenStable();
    nestedFixture.detectChanges();

    const nestedHost = nestedFixture.nativeElement as HTMLElement;
    const trigger = nestedHost.querySelector<HTMLButtonElement>(
      '.mlv-filter__trigger',
    );

    trigger?.click();
    nestedFixture.detectChanges();
    await nestedFixture.whenStable();
    nestedFixture.detectChanges();

    expect(overlay.querySelector('.nested-date-editor')).not.toBeNull();
  });
});
