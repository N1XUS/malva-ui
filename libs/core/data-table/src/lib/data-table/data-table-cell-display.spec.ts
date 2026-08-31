import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvDataTableCell } from '../data-table-cell';
import type { MlvDataTableColumn } from '../types';
import { MlvDataTable } from './data-table';

interface Row {
  id: number;
  status: 'active' | 'paused' | 'archived';
  plan: 'free' | 'pro';
  note: string | null;
}

const ROWS: Row[] = [
  { id: 1, status: 'active', plan: 'free', note: null },
  { id: 2, status: 'paused', plan: 'pro', note: 'hi' },
  { id: 3, status: 'archived', plan: 'free', note: 'yo' },
];

const STATUS_TONES: Record<Row['status'], 'success' | 'warning' | 'danger'> = {
  active: 'success',
  paused: 'warning',
  archived: 'danger',
};

@Component({
  imports: [MlvDataTable, MlvDataTableCell],
  template: `<mlv-data-table [data]="rows" [columns]="columns()">
    @if (withCustomTemplate()) {
      <ng-template mlvDataTableCell="status" let-row>
        <span class="custom-status">custom:{{ row.status }}</span>
      </ng-template>
    }
  </mlv-data-table>`,
})
class CellDisplayHostComponent {
  readonly rows = ROWS;
  readonly withCustomTemplate = signal(false);

  readonly columns = signal<MlvDataTableColumn<Row>[]>([
    { key: 'id', title: 'ID' },
    {
      key: 'status',
      title: 'Status',
      valueLabels: {
        active: 'Active',
        paused: 'Paused',
        archived: 'Archived',
      },
      tone: (row) => STATUS_TONES[row.status],
    },
    {
      key: 'plan',
      title: 'Plan',
      filterable: true,
      filterConfig: {
        options: [
          { label: 'Free plan', value: 'free' },
          { label: 'Pro plan', value: 'pro' },
        ],
      },
    },
    { key: 'note', title: 'Note' },
  ]);
}

describe('MlvDataTable — value labels and cell tones', () => {
  let fixture: ComponentFixture<CellDisplayHostComponent>;
  let host: HTMLElement;

  function cellsOfColumn(index: number): HTMLElement[] {
    return Array.from(
      host.querySelectorAll<HTMLTableRowElement>('.mlv-data-table__row--data'),
    ).map((row) => row.querySelectorAll('td')[index] as HTMLElement);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CellDisplayHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CellDisplayHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('should render explicit valueLabels instead of the raw value', () => {
    const labels = cellsOfColumn(1).map((cell) => cell.textContent?.trim());
    expect(labels).toEqual(['Active', 'Paused', 'Archived']);
  });

  it('should fall back to filterConfig.options labels when valueLabels is absent', () => {
    const labels = cellsOfColumn(2).map((cell) => cell.textContent?.trim());
    expect(labels).toEqual(['Free plan', 'Pro plan', 'Free plan']);
  });

  it('should render a muted badge with the resolved tone per row', () => {
    const badges = cellsOfColumn(1).map((cell) =>
      cell.querySelector('mlv-badge'),
    );
    expect(badges.every((badge) => badge !== null)).toBe(true);
    expect(badges.map((badge) => badge?.className)).toEqual([
      expect.stringContaining('mlv-badge--tone-success'),
      expect.stringContaining('mlv-badge--tone-warning'),
      expect.stringContaining('mlv-badge--tone-danger'),
    ]);
    expect(
      badges.every((badge) => badge?.classList.contains('mlv-badge--muted')),
    ).toBe(true);
  });

  it('should render plain text for columns without a tone', () => {
    expect(cellsOfColumn(2)[0].querySelector('mlv-badge')).toBeNull();
    expect(cellsOfColumn(0)[0].textContent?.trim()).toBe('1');
  });

  it('should apply a fixed string tone to every row of the column', () => {
    fixture.componentInstance.columns.update((cols) =>
      cols.map((col) => (col.key === 'plan' ? { ...col, tone: 'info' } : col)),
    );
    fixture.detectChanges();

    const badges = cellsOfColumn(2).map((cell) =>
      cell.querySelector('mlv-badge'),
    );
    expect(badges.length).toBe(3);
    for (const badge of badges) {
      expect(badge?.classList.contains('mlv-badge--tone-info')).toBe(true);
    }
  });

  it('should render plain text when the tone resolver opts a row out', () => {
    fixture.componentInstance.columns.update((cols) =>
      cols.map((col) =>
        col.key === 'status'
          ? { ...col, tone: (row: Row) => (row.id === 2 ? 'warning' : null) }
          : col,
      ),
    );
    fixture.detectChanges();

    const cells = cellsOfColumn(1);
    expect(cells[0].querySelector('mlv-badge')).toBeNull();
    expect(cells[0].textContent?.trim()).toBe('Active');
    expect(cells[1].querySelector('mlv-badge')).toBeTruthy();
  });

  it('should leave nullish values untouched', () => {
    const cells = cellsOfColumn(3);
    expect(cells[0].textContent?.trim()).toBe('');
    expect(cells[1].textContent?.trim()).toBe('hi');
  });

  it('should let a custom cell template win over valueLabels and tone', () => {
    fixture.componentInstance.withCustomTemplate.set(true);
    fixture.detectChanges();

    const cell = cellsOfColumn(1)[0];
    expect(cell.querySelector('mlv-badge')).toBeNull();
    expect(cell.querySelector('.custom-status')?.textContent).toBe(
      'custom:active',
    );
  });
});
