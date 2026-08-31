import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFilterDropdown } from './filter-dropdown';
import type { MlvFilterState } from '@malva-ui/cdk/data-source';
import type { MlvDataTableColumn } from '../types';

describe('MlvFilterDropdown', () => {
  let fixture: ComponentFixture<MlvFilterDropdown>;
  let component: MlvFilterDropdown;

  const columns: MlvDataTableColumn[] = [
    {
      key: 'status',
      title: 'Status',
      filterable: true,
      filterConfig: {
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
        ],
      },
    },
    { key: 'name', title: 'Name', filterable: true },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvFilterDropdown],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvFilterDropdown);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('columns', columns);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('restores committed filters when opened', () => {
    component.activeFilters.set([
      { key: 'status', operator: 'in', value: ['published'] },
    ]);
    fixture.detectChanges();

    const published = fixture.nativeElement.querySelector(
      'input[aria-label="Published"]',
    ) as HTMLInputElement;
    expect(published).toBeTruthy();
    expect(published.checked).toBe(true);
  });

  it('commits option selections with the in operator', () => {
    const controls = component as unknown as {
      toggleInArray(key: string, value: unknown): void;
      apply(): void;
    };

    controls.toggleInArray('status', 'draft');
    controls.apply();

    expect(component.activeFilters()).toEqual([
      { key: 'status', operator: 'in', value: ['draft'] },
    ]);
  });

  it('preserves not-in semantics while editing option selections', () => {
    component.activeFilters.set([
      { key: 'status', operator: 'not-in', value: ['published'] },
    ]);
    fixture.detectChanges();
    const controls = component as unknown as {
      toggleInArray(key: string, value: unknown): void;
      apply(): void;
    };

    controls.toggleInArray('status', 'draft');
    controls.apply();

    expect(component.activeFilters()).toEqual([
      {
        key: 'status',
        operator: 'not-in',
        value: ['published', 'draft'],
      },
    ]);
  });

  it('merges a scoped column edit without erasing other filters', () => {
    const scoped: MlvDataTableColumn[] = [columns[0]];
    fixture.componentRef.setInput('columns', scoped);
    component.activeFilters.set([
      { key: 'name', operator: 'contains', value: 'al' },
      { key: 'status', operator: 'in', value: ['published'] },
    ]);
    fixture.detectChanges();

    const controls = component as unknown as {
      toggleInArray(key: string, value: unknown): void;
      apply(): void;
    };
    controls.toggleInArray('status', 'draft');
    controls.apply();

    expect(component.activeFilters()).toEqual([
      { key: 'name', operator: 'contains', value: 'al' },
      {
        key: 'status',
        operator: 'in',
        value: ['published', 'draft'],
      },
    ] satisfies MlvFilterState[]);
  });

  it('associates option labels with their checkboxes', () => {
    const checkbox = fixture.nativeElement.querySelector(
      'input[aria-label="Draft"]',
    ) as HTMLInputElement;
    expect(checkbox).toBeTruthy();
  });

  it('gives operator and value controls distinct accessible names', () => {
    const operator = fixture.nativeElement.querySelector(
      '.mlv-dt-filter-dropdown__operator [role="combobox"]',
    ) as HTMLElement;
    const value = fixture.nativeElement.querySelector(
      '.mlv-dt-filter-dropdown__text-input input',
    ) as HTMLInputElement;

    expect(operator.getAttribute('aria-label')).toBe('Contains: Name');
    expect(value.getAttribute('aria-label')).toBe('Filter by Name');
  });

  it('clears only the columns owned by a scoped editor', () => {
    fixture.componentRef.setInput('columns', [columns[0]]);
    component.activeFilters.set([
      { key: 'name', operator: 'contains', value: 'al' },
      { key: 'status', operator: 'in', value: ['published'] },
    ]);
    fixture.detectChanges();
    const controls = component as unknown as { clear(): void };

    controls.clear();

    expect(component.activeFilters()).toEqual([
      { key: 'name', operator: 'contains', value: 'al' },
    ]);
  });
});
