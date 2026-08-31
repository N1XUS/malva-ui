import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MlvDataTableFooter } from '../data-table-footer';
import type { MlvDataTableColumn } from '../types';
import { MlvDataTable } from './data-table';

const dataTableStyles = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'data-table.scss'),
  'utf8',
);

interface Row {
  label: string;
  amount: number;
}

@Component({
  imports: [MlvDataTable, MlvDataTableFooter],
  template: `
    <mlv-data-table
      [data]="data"
      [columns]="columns"
      [bordered]="bordered()"
      [stickyHeader]="stickyHeader()"
      [virtualScroll]="virtualScroll()"
    >
      <ng-template mlvDataTableFooter let-visibleColumns>
        <th
          class="summary-label"
          scope="row"
          [attr.data-visible-columns]="visibleColumns.length"
        >
          Total
        </th>
        <td class="summary-value">30</td>
      </ng-template>
    </mlv-data-table>
  `,
  styles: `
    .summary-label {
      text-align: left;
    }

    .summary-value {
      text-align: right;
    }
  `,
})
class FooterHostComponent {
  readonly data: Row[] = [
    { label: 'First', amount: 10 },
    { label: 'Second', amount: 20 },
  ];
  readonly columns: MlvDataTableColumn[] = [
    { key: 'label', title: 'Label', width: '10rem', pinned: true },
    { key: 'amount', title: 'Amount', align: 'right', width: '8rem' },
  ];
  readonly bordered = signal(true);
  readonly stickyHeader = signal(true);
  readonly virtualScroll = signal(false);
}

describe('MlvDataTable — projected footer cells', () => {
  let fixture: ComponentFixture<FooterHostComponent>;
  let host: HTMLElement;

  function footerCells(): HTMLTableCellElement[] {
    return Array.from(
      host.querySelectorAll<HTMLTableCellElement>(
        '.mlv-data-table__row--footer > td, .mlv-data-table__row--footer > th',
      ),
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('renders consumer-owned th/td elements directly without private cell classes', () => {
    const cells = footerCells();

    expect(cells.map(({ tagName }) => tagName)).toEqual(['TH', 'TD']);
    expect(
      cells.every((cell) => !cell.classList.contains('mlv-data-table__cell')),
    ).toBe(true);
    expect(cells[0].getAttribute('data-visible-columns')).toBe('2');
  });

  it('owns density, divider, background, and vertical alignment styles for raw cells', () => {
    const declarations = dataTableStyles.match(
      />\s*:where\(td,\s*th\)\s*\{([^}]*)\}/,
    );

    expect(declarations).toBeTruthy();
    expect(declarations?.[1]).toContain('box-sizing: border-box');
    expect(declarations?.[1]).toContain(
      'padding: 0 var(--mlv-dt-cell-padding-x)',
    );
    expect(declarations?.[1]).toContain('height: var(--mlv-dt-header-height)');
    expect(declarations?.[1]).toContain(
      'border-top: 0.125rem solid var(--mlv-border-normal)',
    );
    expect(declarations?.[1]).toContain('border-bottom: 0');
    expect(declarations?.[1]).toContain('vertical-align: middle');
    expect(declarations?.[1]).toContain('background: inherit');
  });

  it('keeps consumer alignment classes and leaves text alignment consumer-owned', () => {
    const [label, value] = footerCells();
    const declarations = dataTableStyles.match(
      />\s*:where\(td,\s*th\)\s*\{([^}]*)\}/,
    );

    expect(label.classList.contains('summary-label')).toBe(true);
    expect(value.classList.contains('summary-value')).toBe(true);
    expect(declarations?.[1]).not.toContain('text-align');
  });

  it('adds cell separators in bordered mode without a trailing separator', () => {
    const normalizedStyles = dataTableStyles.replace(/\s+/g, ' ');

    expect(normalizedStyles).toContain(
      '.#{$block}__table--bordered & > :where(td, th) { border-inline-end: 0.0625rem solid var(--mlv-border-subtle);',
    );
    expect(normalizedStyles).toContain(
      '&:last-child { border-inline-end: none;',
    );
  });

  it('keeps the sticky footer surface opaque', () => {
    const foot = host.querySelector('.mlv-data-table__foot');
    const normalizedStyles = dataTableStyles.replace(/\s+/g, ' ');

    expect(foot?.classList.contains('mlv-data-table__foot--sticky')).toBe(true);
    expect(normalizedStyles).toContain(
      '&__foot { font-weight: var(--mlv-font-weight-medium); font-size: var(--mlv-dt-font-size); background: var(--mlv-background-base);',
    );
  });

  it('applies the same classless footer treatment in virtual mode', async () => {
    fixture.componentInstance.virtualScroll.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const footerTable = host.querySelector<HTMLTableElement>(
      '.mlv-data-table__table--virtual-footer',
    );

    expect(footerTable).toBeTruthy();
    expect(footerTable?.getAttribute('role')).toBe('presentation');
    expect(
      footerTable?.classList.contains('mlv-data-table__table--bordered'),
    ).toBe(true);
    expect(footerCells().map(({ tagName }) => tagName)).toEqual(['TH', 'TD']);
  });
});
