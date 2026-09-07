import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTable } from './table';
import { MlvTableCell } from './table-cell';
import { MlvTableRow } from './table-row';

@Component({
  imports: [MlvTable, MlvTableRow, MlvTableCell],
  template: `
    <table
      mlvTable
      [bordered]="true"
      [responsive]="true"
      [popIn]="true"
      mlvDensity="compact"
      hoverable="row"
      aria-label="People"
    >
      <caption>
        People
      </caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Role</th>
        </tr>
      </thead>
      <tbody>
        <tr mlvTableRow main>
          <td mlvTableCell data-label="Name">Ada Lovelace</td>
          <td mlvTableCell data-label="Role">Engineer</td>
        </tr>
        <tr mlvTableRow secondary>
          <td mlvTableCell colspan="2">Loves analytical engines.</td>
        </tr>
      </tbody>
    </table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

@Component({
  imports: [MlvTable, MlvTableRow, MlvTableCell],
  template: `
    <table
      mlvTable
      [bordered]="false"
      [responsive]="false"
      [popIn]="false"
      hoverable="cell"
      aria-label="Single value"
    >
      <tbody>
        <tr mlvTableRow main>
          <td mlvTableCell>Only value</td>
        </tr>
      </tbody>
    </table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CellHoverHostComponent {}

describe('MlvTable', () => {
  let fixture: ComponentFixture<HostComponent>;
  let table: HTMLTableElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    table = fixture.nativeElement.querySelector('table') as HTMLTableElement;
  });

  it('enhances a native table with the base and appearance classes', () => {
    expect(table.classList.contains('mlv-table')).toBe(true);
    expect(table.classList.contains('mlv-table--bordered')).toBe(true);
    expect(table.classList.contains('mlv-table--responsive')).toBe(true);
    expect(table.classList.contains('mlv-table--pop-in')).toBe(true);
    expect(table.classList.contains('mlv-table--hover-row')).toBe(true);
    expect(table.classList.contains('mlv-table--compact')).toBe(true);
  });

  it('marks main and secondary Pop In rows without changing native row semantics', () => {
    const rows = table.querySelectorAll('tbody tr');

    expect(rows[0].classList.contains('mlv-table__row')).toBe(true);
    expect(rows[0].classList.contains('mlv-table__row--main')).toBe(true);
    expect(rows[0].getAttribute('data-mlv-table-row')).toBe('main');
    expect(rows[0].getAttribute('role')).toBeNull();
    expect(rows[1].classList.contains('mlv-table__row--secondary')).toBe(true);
    expect(rows[1].getAttribute('data-mlv-table-row')).toBe('secondary');
  });

  it('marks cells for shared table styling and Pop In labels', () => {
    const cells = table.querySelectorAll('td[mlvTableCell]');

    expect(cells.length).toBe(3);
    expect(cells[0].classList.contains('mlv-table__cell')).toBe(true);
    expect(cells[0].getAttribute('data-label')).toBe('Name');
    expect(cells[2].classList.contains('mlv-table__cell')).toBe(true);
  });

  it('supports cell hover and disables optional appearances independently', () => {
    const cellFixture = TestBed.createComponent(CellHoverHostComponent);
    cellFixture.detectChanges();
    const cellTable = cellFixture.nativeElement.querySelector(
      'table',
    ) as HTMLTableElement;

    expect(cellTable.classList.contains('mlv-table--bordered')).toBe(false);
    expect(cellTable.classList.contains('mlv-table--responsive')).toBe(false);
    expect(cellTable.classList.contains('mlv-table--pop-in')).toBe(false);
    expect(cellTable.classList.contains('mlv-table--hover-cell')).toBe(true);
  });

  it('has no axe violations in the native table structure', async () => {
    await expectNoAxeViolations(table);
  });
});
