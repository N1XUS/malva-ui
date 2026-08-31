import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvPagination } from '@malva-ui/core/pagination';
import { MlvDataTable } from './data-table';
import type { MlvDataTableColumn } from '../types';

interface Row {
  id: string;
  name: string;
  owner: string;
  health: string;
}

@Component({
  imports: [MlvDataTable],
  template: '<mlv-data-table [data]="data" [columns]="columns" showSortMenu />',
})
class HostComponent {
  readonly data: Row[] = [
    { id: 'atlas', name: 'Atlas', owner: 'Platform', health: 'Healthy' },
  ];

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID' },
    { key: 'owner', title: 'Owner', hideable: true, pinnable: true },
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      hideable: true,
      resizable: true,
      minWidth: '80px',
      maxWidth: '240px',
    },
    { key: 'health', title: 'Health', hideable: true, pinnable: true },
  ];
}

describe('MlvDataTable presentation state', () => {
  let fixture: ComponentFixture<HostComponent>;
  let table: MlvDataTable;
  let columns: MlvDataTableColumn[];
  let overlayContainer: OverlayContainer;
  let overlay: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    overlay = overlayContainer.getContainerElement();
    fixture.detectChanges();
    await fixture.whenStable();
    table = fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
    columns = fixture.componentInstance.columns;
  });

  afterEach(async () => {
    overlay
      .querySelectorAll('.mlv-popup--leave')
      .forEach((panel) =>
        panel.dispatchEvent(new Event('animationend', { bubbles: true })),
      );
    fixture.detectChanges();
    await fixture.whenStable();
    overlayContainer.ngOnDestroy();
  });

  async function openSortMenu(): Promise<void> {
    const trigger = fixture.nativeElement.querySelector(
      '[data-mlv-table-sort-trigger]',
    ) as HTMLButtonElement | null;
    if (!trigger) throw new Error('Expected the Sort menu trigger');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function menuItem(label: string): HTMLElement {
    const item = Array.from(
      overlay.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((candidate) => candidate.textContent?.trim() === label);
    if (!item) throw new Error(`Expected menu item: ${label}`);
    return item;
  }

  async function openDirectionSubmenu(column: string): Promise<void> {
    const trigger = menuItem(column);
    trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function paginator(): MlvPagination {
    return fixture.debugElement.query(By.directive(MlvPagination))
      .componentInstance as MlvPagination;
  }

  function pointerEvent(
    type: string,
    clientX: number,
    pointerId = 1,
  ): PointerEvent {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX,
    });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    return event as PointerEvent;
  }

  it('captures only durable table presentation', () => {
    table.onSortClick(columns[2]);
    table.toggleColumnVisibility('owner');
    table.pinTo(columns[3], 'right');

    expect(table.getPresentationState()).toMatchObject({
      sort: { key: 'name', direction: 'asc' },
      visibleColumnKeys: ['id', 'name', 'health'],
      pinnedEndColumnKeys: ['health'],
      columnWidths: {},
      perPage: 10,
    });
  });

  it('ignores unknown keys and emits no echo while applying state', () => {
    const changed = vi.fn();
    table.presentationStateChange.subscribe(changed);
    table.currentPage.set(3);

    table.applyPresentationState({
      visibleColumnKeys: ['name', 'missing'],
      pinnedEndColumnKeys: ['health', 'missing'],
      columnWidths: { name: 9999, missing: 12 },
      perPage: 25,
    });

    expect(table.getPresentationState()).toMatchObject({
      visibleColumnKeys: ['id', 'name'],
      pinnedEndColumnKeys: ['health'],
      columnWidths: { name: 240 },
      perPage: 25,
    });
    expect(table.currentPage()).toBe(1);
    expect(changed).not.toHaveBeenCalled();
  });

  it('changes only supplied presentation fields while resetting the transient page', () => {
    table.onSortClick(columns[2]);
    table.toggleColumnVisibility('owner');
    table.pinTo(columns[3], 'right');
    table.currentPage.set(3);

    table.applyPresentationState({ perPage: 25 });

    expect(table.getPresentationState()).toMatchObject({
      sort: { key: 'name', direction: 'asc' },
      visibleColumnKeys: ['id', 'name', 'health'],
      pinnedEndColumnKeys: ['health'],
      perPage: 25,
    });
    expect(table.currentPage()).toBe(1);
  });

  it('preserves non-hideable columns while normalizing visible keys in declaration order', () => {
    table.applyPresentationState({
      visibleColumnKeys: ['health', 'name', 'missing'],
    });

    expect(table.getPresentationState().visibleColumnKeys).toEqual([
      'id',
      'name',
      'health',
    ]);
  });

  it('preserves Infinity through the paginator output and presentation round-trip', () => {
    const changed = vi.fn();
    table.presentationStateChange.subscribe(changed);
    table.currentPage.set(2);

    paginator().itemsPerPage.set(Infinity);
    fixture.detectChanges();

    expect(table.currentPerPage()).toBe(Infinity);
    expect(table.currentPage()).toBe(1);
    expect(table.getPresentationState().perPage).toBe(Infinity);
    expect(changed).toHaveBeenCalledTimes(1);

    table.currentPage.set(3);
    table.applyPresentationState({ perPage: Infinity });

    expect(table.currentPerPage()).toBe(Infinity);
    expect(table.currentPage()).toBe(1);
    expect(table.getPresentationState().perPage).toBe(Infinity);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('normalizes invalid page sizes without losing the all-items sentinel', () => {
    for (const perPage of [NaN, -Infinity, -25, 0]) {
      table.applyPresentationState({ perPage });
      expect(table.getPresentationState().perPage).toBe(1);
    }
  });

  it('preserves the omitted pin side during a partial pin-state apply', () => {
    table.pinTo(columns[1], 'left');

    table.applyPresentationState({ pinnedEndColumnKeys: ['health'] });

    expect(table.getPresentationState()).toMatchObject({
      pinnedStartColumnKeys: ['owner'],
      pinnedEndColumnKeys: ['health'],
    });
  });

  it('emits exactly once for durable template interactions and paginator outputs', async () => {
    const changed = vi.fn();
    table.presentationStateChange.subscribe(changed);

    const sortButton = fixture.nativeElement.querySelector(
      '[data-mlv-column-key="name"] .mlv-data-table__sort-button',
    ) as HTMLButtonElement;
    sortButton.click();
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(1);

    const columnsButton = fixture.nativeElement.querySelector(
      'button[aria-label="Toggle column visibility"]',
    ) as HTMLButtonElement;
    columnsButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const ownerCheckbox = Array.from(
      document.querySelectorAll<HTMLElement>('.mlv-data-table__columns-item'),
    )
      .find((item) => item.textContent?.includes('Owner'))
      ?.querySelector('.mlv-checkbox__native') as HTMLInputElement | null;
    if (!ownerCheckbox)
      throw new Error('Expected the Owner visibility checkbox');
    ownerCheckbox.click();
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(2);

    const pinButton = fixture.nativeElement.querySelector(
      '[data-mlv-column-key="health"] .mlv-data-table__pin-btn',
    ) as HTMLButtonElement;
    pinButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const pinRight = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.mlv-data-table__pin-popup-item',
      ),
    ).find((item) => item.textContent?.includes('Pin right'));
    if (!pinRight) throw new Error('Expected the Pin right action');
    pinRight.click();
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(3);

    pinButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const unpin = document.querySelector<HTMLButtonElement>(
      '.mlv-data-table__pin-popup-item--unpin',
    );
    if (!unpin) throw new Error('Expected the Unpin action');
    unpin.click();
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(4);

    const resizeHandle = fixture.nativeElement.querySelector(
      '[data-mlv-column-key="name"] .mlv-data-table__resize-handle',
    ) as HTMLElement;
    resizeHandle.dispatchEvent(pointerEvent('pointerdown', 100));
    document.dispatchEvent(pointerEvent('pointermove', 120));
    document.dispatchEvent(pointerEvent('pointerup', 120));
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(5);

    resizeHandle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(6);

    paginator().itemsPerPage.set(Infinity);
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(7);
    expect(table.currentPage()).toBe(1);

    paginator().currentPage.set(2);
    fixture.detectChanges();
    expect(table.currentPage()).toBe(2);
    expect(changed).toHaveBeenCalledTimes(7);
  });

  it('sorts an inactive column ascending through the rendered menu', async () => {
    const changed = vi.fn();
    table.presentationStateChange.subscribe(changed);
    table.currentPage.set(3);

    await openSortMenu();
    menuItem('Name').click();
    fixture.detectChanges();

    expect(table.getPresentationState().sort).toEqual({
      key: 'name',
      direction: 'asc',
    });
    expect(table.currentPage()).toBe(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement
        .querySelector('[data-mlv-column-key="name"]')
        .getAttribute('aria-sort'),
    ).toBe('ascending');
  });

  it('changes direction and clears through the active-column submenu', async () => {
    const changed = vi.fn();
    table.presentationStateChange.subscribe(changed);
    table.applyPresentationState({
      sort: { key: 'name', direction: 'asc' },
    });
    expect(changed).not.toHaveBeenCalled();

    table.currentPage.set(3);
    await openSortMenu();
    await openDirectionSubmenu('Name');
    menuItem('Descending').click();
    fixture.detectChanges();

    expect(table.getPresentationState().sort?.direction).toBe('desc');
    expect(table.currentPage()).toBe(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement
        .querySelector('[data-mlv-column-key="name"]')
        .getAttribute('aria-sort'),
    ).toBe('descending');

    await openSortMenu();
    await openDirectionSubmenu('Name');
    menuItem('Clear sort').click();
    fixture.detectChanges();

    expect(table.getPresentationState().sort).toBeNull();
    expect(changed).toHaveBeenCalledTimes(2);
    expect(
      fixture.nativeElement
        .querySelector('[data-mlv-column-key="name"]')
        .getAttribute('aria-sort'),
    ).toBe('none');
  });
});
