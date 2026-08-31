import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, getDebugNode, signal } from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvDataTable } from './data-table';
import { MlvFilterDropdown } from '../filter-dropdown/filter-dropdown';
import type { MlvFilterState } from '@malva-ui/cdk/data-source';
import type { MlvFilterDisplay, MlvDataTableColumn } from '../types';

interface Row {
  name: string;
  status: string;
}

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    [data]="data"
    [columns]="columns()"
    [filterDisplay]="filterDisplay()"
    [showSearch]="showSearch()"
    [searchTrigger]="searchTrigger()"
    [searchDebounce]="searchDebounce()"
    [searchQuery]="query()"
    (searchQueryChange)="query.set($event)"
    [activeFilters]="filters()"
    (activeFiltersChange)="filters.set($event)"
  />`,
})
class SearchFilterHostComponent {
  readonly data: Row[] = [
    { name: 'Alice', status: 'active' },
    { name: 'Bob', status: 'inactive' },
  ];
  readonly columns = signal<MlvDataTableColumn[]>([
    { key: 'name', title: 'Name', searchable: true, filterable: true },
    {
      key: 'status',
      title: 'Status',
      searchable: true,
      filterable: true,
      filterConfig: {
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
    },
  ]);
  readonly filterDisplay = signal<MlvFilterDisplay>('toolbar');
  readonly showSearch = signal<BooleanInput>(true);
  readonly searchTrigger = signal<'live' | 'submit'>('live');
  readonly searchDebounce = signal(0);
  readonly query = signal('');
  readonly filters = signal<MlvFilterState[]>([]);
}

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    [data]="data"
    [columns]="columns"
    filterDisplay="column"
  />`,
})
class UncontrolledColumnFilterHostComponent {
  readonly data = [
    { owner: 'Maya', status: 'Requested' },
    { owner: 'Maya', status: 'Published' },
    { owner: 'Noah', status: 'Requested' },
  ];
  readonly columns: MlvDataTableColumn[] = [
    { key: 'owner', title: 'Owner', filterable: true },
    {
      key: 'status',
      title: 'Status',
      filterable: true,
      filterConfig: {
        options: [
          { label: 'Requested', value: 'Requested' },
          { label: 'Published', value: 'Published' },
        ],
      },
    },
  ];
}

describe('MlvDataTable search and filter presentation', () => {
  let fixture: ComponentFixture<SearchFilterHostComponent>;
  let table: MlvDataTable;

  const renderedRows = (): HTMLTableRowElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll<HTMLTableRowElement>(
        '.mlv-data-table__row--data',
      ),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SearchFilterHostComponent,
        UncontrolledColumnFilterHostComponent,
      ],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchFilterHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    table = fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
  });

  it('renders global search only when columns opt in and applies its event', () => {
    expect(
      fixture.nativeElement.querySelector('mlv-search-field'),
    ).toBeTruthy();

    table.onSearch('alice');
    fixture.detectChanges();

    expect(fixture.componentInstance.query()).toBe('alice');
    expect(renderedRows()).toHaveLength(1);
    expect(renderedRows()[0].textContent).toContain('Alice');
  });

  it('searches across configured columns but not arbitrary row properties', () => {
    table.onSearch('inactive');
    fixture.detectChanges();

    expect(renderedRows()).toHaveLength(1);
    expect(renderedRows()[0].textContent).toContain('Bob');
  });

  it('hides the built-in search UI without disabling externally bound search', () => {
    fixture.componentInstance.showSearch.set('false');
    fixture.componentInstance.query.set('bob');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mlv-search-field')).toBeNull();
    expect(table.searchableColumnKeys()).toEqual(['name', 'status']);
    expect(renderedRows()).toHaveLength(1);
    expect(renderedRows()[0].textContent).toContain('Bob');
  });

  it('keeps submit-mode typing as a draft until Enter commits it', () => {
    fixture.componentInstance.searchTrigger.set('submit');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'mlv-search-field input',
    ) as HTMLInputElement;

    input.value = 'alice';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.query()).toBe('');
    expect(renderedRows()).toHaveLength(2);

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.query()).toBe('alice');
    expect(renderedRows()).toHaveLength(1);
  });

  it('synchronizes an external query into the field and resets pagination', () => {
    table.currentPage.set(2);
    fixture.componentInstance.query.set('bob');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      'mlv-search-field input',
    ) as HTMLInputElement;
    expect(input.value).toBe('bob');
    expect(table.currentPage()).toBe(1);
    expect(renderedRows()).toHaveLength(1);
    expect(renderedRows()[0].textContent).toContain('Bob');
  });

  it('re-emits the same live query after a controlled reset', () => {
    const input = fixture.nativeElement.querySelector(
      'mlv-search-field input',
    ) as HTMLInputElement;

    input.value = 'alice';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.query()).toBe('alice');

    fixture.componentInstance.query.set('');
    fixture.detectChanges();
    expect(input.value).toBe('');

    input.value = 'alice';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.query()).toBe('alice');
    expect(renderedRows()).toHaveLength(1);
  });

  it('resets the visible page when filters change', () => {
    table.currentPage.set(3);
    fixture.componentInstance.filters.set([
      { key: 'status', operator: 'in', value: ['active'] },
    ]);
    fixture.detectChanges();

    expect(table.currentPage()).toBe(1);
    expect(renderedRows()).toHaveLength(1);
  });

  it('renders accessible per-column filter buttons in column mode', () => {
    fixture.componentInstance.filterDisplay.set('column');
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
        '.mlv-data-table__column-filter',
      ),
    );
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Filter Name',
      'Filter Status',
    ]);
    expect(
      fixture.nativeElement.querySelector(
        '.mlv-data-table__toolbar-actions button[aria-label="Toggle filters"]',
      ),
    ).toBeNull();
  });

  it('marks a column filter trigger active and supports hiding all filter UI', () => {
    fixture.componentInstance.filterDisplay.set('column');
    fixture.componentInstance.filters.set([
      { key: 'status', operator: 'equals', value: 'active' },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '.mlv-data-table__column-filter--active',
      ),
    ).toHaveLength(1);
    const activeTrigger =
      fixture.nativeElement.querySelector<HTMLButtonElement>(
        '.mlv-data-table__column-filter--active',
      );
    expect(activeTrigger?.getAttribute('aria-label')).toBe(
      'Filter Status, active',
    );
    expect(activeTrigger?.hasAttribute('aria-pressed')).toBe(false);

    fixture.componentInstance.filterDisplay.set('none');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.mlv-data-table__column-filter'),
    ).toBeNull();
  });

  it('composes independent column popovers and clears only the owned filter', async () => {
    const uncontrolledFixture = TestBed.createComponent(
      UncontrolledColumnFilterHostComponent,
    );
    uncontrolledFixture.detectChanges();
    await uncontrolledFixture.whenStable();
    const uncontrolledTable = uncontrolledFixture.debugElement.query(
      By.directive(MlvDataTable),
    ).componentInstance as MlvDataTable;

    const open = async (key: string): Promise<HTMLElement> => {
      const trigger =
        uncontrolledFixture.nativeElement.querySelector<HTMLButtonElement>(
          `.mlv-data-table__column-filter[data-column-key="${key}"]`,
        );
      if (!trigger) throw new Error(`Expected a ${key} filter trigger`);
      trigger.click();
      uncontrolledFixture.detectChanges();
      await uncontrolledFixture.whenStable();
      const panel = Array.from(
        document.querySelectorAll<HTMLElement>('mlv-dt-filter-dropdown'),
      ).at(-1);
      if (!panel) throw new Error(`Expected a ${key} filter editor`);
      return panel;
    };

    const act = (panel: HTMLElement, label: string): void => {
      const button = Array.from(
        panel.querySelectorAll<HTMLButtonElement>(
          '.mlv-dt-filter-dropdown__footer button',
        ),
      ).find((item) => item.textContent?.trim() === label);
      if (!button) throw new Error(`Expected the ${label} filter action`);
      button.click();
      uncontrolledFixture.detectChanges();
    };

    const finishClose = async (panel: HTMLElement): Promise<void> => {
      panel
        .closest('.mlv-popup')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
      uncontrolledFixture.detectChanges();
      await uncontrolledFixture.whenStable();
    };

    const ownerPanel = await open('owner');
    const ownerInput = ownerPanel.querySelector<HTMLInputElement>('input');
    if (!ownerInput) throw new Error('Expected the Owner filter input');
    ownerInput.value = 'Maya';
    ownerInput.dispatchEvent(new Event('input', { bubbles: true }));
    uncontrolledFixture.detectChanges();
    act(ownerPanel, 'Apply');
    expect(uncontrolledTable.activeFilters()).toEqual([
      { key: 'owner', operator: 'contains', value: 'Maya' },
    ]);
    await finishClose(ownerPanel);
    const ownerTrigger =
      uncontrolledFixture.nativeElement.querySelector<HTMLButtonElement>(
        '.mlv-data-table__column-filter[data-column-key="owner"]',
      );
    expect(document.activeElement).toBe(ownerTrigger);
    expect(ownerTrigger?.getAttribute('aria-label')).toBe(
      'Filter Owner, active',
    );

    const statusPanel = await open('status');
    // A portal editor can briefly hold an older full-array input snapshot.
    // Its scoped output must never replace filters owned by sibling columns.
    const statusEditor =
      getDebugNode(statusPanel)?.injector.get(MlvFilterDropdown);
    if (!statusEditor) throw new Error('Expected the Status editor component');
    statusEditor.activeFilters.set([]);
    uncontrolledFixture.detectChanges();
    expect(uncontrolledTable.activeFilters()).toEqual([
      { key: 'owner', operator: 'contains', value: 'Maya' },
    ]);

    const requested = statusPanel.querySelector<HTMLInputElement>(
      'input[aria-label="Requested"]',
    );
    if (!requested) throw new Error('Expected the Requested option');
    requested.click();
    uncontrolledFixture.detectChanges();
    act(statusPanel, 'Apply');

    expect(uncontrolledTable.activeFilters()).toEqual([
      { key: 'owner', operator: 'contains', value: 'Maya' },
      { key: 'status', operator: 'in', value: ['Requested'] },
    ]);

    await finishClose(statusPanel);

    const reopenedStatusPanel = await open('status');
    act(reopenedStatusPanel, 'Clear all');
    expect(uncontrolledTable.activeFilters()).toEqual([
      { key: 'owner', operator: 'contains', value: 'Maya' },
    ]);
    await finishClose(reopenedStatusPanel);

    expect(ownerTrigger?.getAttribute('aria-label')).toBe(
      'Filter Owner, active',
    );
    expect(
      uncontrolledFixture.nativeElement
        .querySelector<HTMLButtonElement>(
          '.mlv-data-table__column-filter[data-column-key="status"]',
        )
        ?.getAttribute('aria-label'),
    ).toBe('Filter Status');
    uncontrolledFixture.destroy();
  });

  it('restores focus to the matching column filter trigger', () => {
    fixture.componentInstance.filterDisplay.set('column');
    fixture.detectChanges();
    const statusButton = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
        '.mlv-data-table__column-filter',
      ),
    ).find((button) => button.dataset['columnKey'] === 'status');
    if (!statusButton) throw new Error('Expected a Status filter trigger');
    const focus = vi.spyOn(statusButton, 'focus');

    table.focusColumnFilterTrigger('status');

    expect(focus).toHaveBeenCalledOnce();
  });

  it('does not render the toolbar filter trigger without filterable columns', () => {
    fixture.componentInstance.columns.set([
      { key: 'name', title: 'Name', searchable: true },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.mlv-data-table__toolbar-actions button[aria-label="Toggle filters"]',
      ),
    ).toBeNull();
  });

  it('omits the toolbar when an external filter surface owns all controls', () => {
    fixture.componentInstance.showSearch.set(false);
    fixture.componentInstance.filterDisplay.set('none');
    fixture.componentInstance.filters.set([
      { key: 'status', operator: 'in', value: ['active'] },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.mlv-data-table__toolbar'),
    ).toBeNull();
    expect(renderedRows()).toHaveLength(1);
  });
});
