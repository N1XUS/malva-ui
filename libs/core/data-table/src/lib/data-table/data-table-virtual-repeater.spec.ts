import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
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

  it('observes the virtual viewport once the browser has rendered it', async () => {
    // The scroll-sync block moved from the effect body into `afterNextRender`
    // so that its geometry reads cannot run on a server, where they resolve
    // `undefined` and serialise `NaNpx` (see the SSR smoke suite in
    // `@malva-ui/core`). Render hooks never run on the server — but they must
    // still run here, or the fix would have quietly disabled horizontal scroll
    // syncing in the browser as well. jsdom reports no layout, so the resize
    // subscription is the observable end of that block.
    // The spy has to predate the table: the effect resolves the viewport once
    // and its dependencies never change again, so a spy installed on the
    // fixture built in `beforeEach` would be watching after the only call.
    const observeSpy = vi.spyOn(
      TestBed.inject(MlvResizeObserverService),
      'observe',
    );

    const observed = TestBed.createComponent(VirtualHostComponent);
    observed.detectChanges();
    await observed.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    observed.detectChanges();
    await observed.whenStable();

    const viewport = observed.nativeElement.querySelector(
      'cdk-virtual-scroll-viewport',
    ) as HTMLElement;
    const observedViewport = observeSpy.mock.calls.filter(
      ([target]) => target === viewport,
    ).length;
    observeSpy.mockRestore();

    expect(observedViewport).toBeGreaterThan(0);
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
