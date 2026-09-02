import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvDataTable } from './data-table';
import type { MlvDataTableColumn } from '../types';

interface Row {
  id: number;
  name: string;
}

const ROWS: Row[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  name: `Row ${index + 1}`,
}));

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    virtualScroll
    [data]="data()"
    [columns]="columns"
    [rowHeight]="40"
    [error]="error()"
  />`,
})
class VirtualHostComponent {
  readonly data = signal<Row[]>([...ROWS]);
  readonly error = signal<string | boolean>(false);
  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Name' },
  ];
}

/**
 * The virtual body's repeater must survive every empty state.
 *
 * `cdk-virtual-scroll-viewport` publishes its rendered range on a plain
 * `Subject`. A `CdkVirtualForOf` constructed while the viewport already exists
 * therefore receives no range until the range next changes — until somebody
 * scrolls — and renders nothing in the meantime. Putting the repeater behind a
 * structural `@if` on the row count meant an empty result set destroyed it and
 * the refill rebuilt it into exactly that state: a table with a correctly sized
 * scrollbar, no rows, and no error anywhere.
 */
describe('MlvDataTable — virtual repeater lifetime', () => {
  let fixture: ComponentFixture<VirtualHostComponent>;

  function dataRows(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>(
        '.mlv-data-table__row--data',
      ),
    );
  }

  /**
   * The viewport measures itself and recomputes its rendered range outside the
   * Angular zone, one task after the rows change, so a single
   * `detectChanges`/`whenStable` pair is not enough to observe what it rendered.
   */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VirtualHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(VirtualHostComponent);
    await settle();
  });

  it('renders rows again after the result set empties and refills', async () => {
    expect(dataRows().length).toBeGreaterThan(0);

    fixture.componentInstance.data.set([]);
    await settle();

    expect(dataRows()).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('.mlv-data-table__row--no-data'),
    ).not.toBeNull();

    fixture.componentInstance.data.set([...ROWS]);
    await settle();

    // Without a surviving repeater this is 0 until the user scrolls.
    expect(dataRows().length).toBeGreaterThan(0);
    expect(
      fixture.nativeElement.querySelector('.mlv-data-table__row--no-data'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('cdk-virtual-scroll-viewport'),
    ).not.toBeNull();
  });

  it('renders rows again after an error is raised and cleared', async () => {
    fixture.componentInstance.error.set('Request failed');
    await settle();

    expect(dataRows()).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('.mlv-data-table__row--error'),
    ).not.toBeNull();

    fixture.componentInstance.error.set(false);
    await settle();

    expect(dataRows().length).toBeGreaterThan(0);
    expect(
      fixture.nativeElement.querySelector('.mlv-data-table__row--error'),
    ).toBeNull();
  });

  it('keeps the same viewport element across both transitions', async () => {
    const viewport = fixture.nativeElement.querySelector(
      'cdk-virtual-scroll-viewport',
    );

    fixture.componentInstance.data.set([]);
    await settle();
    fixture.componentInstance.data.set([...ROWS]);
    await settle();

    // The bug this guards is specific to a *surviving* viewport: if the element
    // were recreated the repeater would be new too, and nothing would be stale.
    expect(
      fixture.nativeElement.querySelector('cdk-virtual-scroll-viewport'),
    ).toBe(viewport);
  });
});
