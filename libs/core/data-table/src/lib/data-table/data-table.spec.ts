import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDataTable } from './data-table';
import { MlvDataTableToolbarActions } from '../data-table-toolbar-actions';
import type { MlvDataTableColumn, MlvSelectableMode } from '../types';

interface Row {
  id: number;
  name: string;
}

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    [data]="data()"
    [columns]="columns"
    [selectable]="selectable()"
    [cellNavigation]="cellNavigation()"
    [virtualScroll]="virtualScroll()"
    [editable]="editable()"
  />`,
})
class HostComponent {
  readonly data = signal<Row[]>([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Carol' },
  ]);
  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID', sortable: true },
    { key: 'name', title: 'Name' },
  ];
  readonly selectable = signal<MlvSelectableMode>(false);
  readonly cellNavigation = signal(false);
  readonly virtualScroll = signal(false);
  readonly editable = signal(false);
}

function dispatchKey(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('MlvDataTable — accessibility', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HTMLElement;

  function rows(): HTMLTableRowElement[] {
    return Array.from(
      host.querySelectorAll<HTMLTableRowElement>('.mlv-data-table__row--data'),
    );
  }

  function table(): MlvDataTable {
    return fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('should render the table as a grid', () => {
    expect(host.querySelector('table[role="grid"]')).toBeTruthy();
    expect(rows().length).toBe(3);
  });

  it('should apply roving tabindex — only the focused row is tabbable', () => {
    const tabindexes = rows().map((r) => r.getAttribute('tabindex'));
    expect(tabindexes).toEqual(['0', '-1', '-1']);
  });

  it('should move the roving tabindex down with ArrowDown', () => {
    dispatchKey(rows()[0], 'ArrowDown');
    fixture.detectChanges();
    expect(table()._focusedRowIndex()).toBe(1);
    expect(rows().map((r) => r.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ]);
  });

  it('should jump to the last row with End and back to first with Home', () => {
    dispatchKey(rows()[0], 'End');
    fixture.detectChanges();
    expect(table()._focusedRowIndex()).toBe(2);

    dispatchKey(rows()[2], 'Home');
    fixture.detectChanges();
    expect(table()._focusedRowIndex()).toBe(0);
  });

  it('should ignore navigation keys that originate from a cell widget', () => {
    // Dispatch from a cell (not the row itself): target !== currentTarget.
    const cell = rows()[0].querySelector('td') as HTMLElement;
    dispatchKey(cell, 'ArrowDown');
    fixture.detectChanges();
    expect(table()._focusedRowIndex()).toBe(0);
  });

  it('should re-clamp the focused row index when rows are removed', () => {
    dispatchKey(rows()[0], 'End');
    fixture.detectChanges();
    expect(table()._focusedRowIndex()).toBe(2);

    fixture.componentInstance.data.set([{ id: 1, name: 'Alice' }]);
    fixture.detectChanges();
    expect(table()._focusedRowIndex()).toBe(0);
  });

  describe('sortable header structure', () => {
    function sortableTh(): HTMLTableCellElement {
      return host.querySelector(
        '.mlv-data-table__cell--sortable',
      ) as HTMLTableCellElement;
    }
    function sortButton(): HTMLButtonElement {
      return sortableTh().querySelector(
        '.mlv-data-table__sort-button',
      ) as HTMLButtonElement;
    }

    it('should wrap the sort control in exactly one native <button> inside the <th>', () => {
      const th = sortableTh();
      const buttons = th.querySelectorAll('button.mlv-data-table__sort-button');
      expect(buttons.length).toBe(1);
      expect(buttons[0].tagName).toBe('BUTTON');
    });

    it('should keep the header <th> non-interactive (no focusable role/tabindex)', () => {
      const th = sortableTh();
      expect(th.getAttribute('role')).toBeNull();
      expect(th.getAttribute('tabindex')).toBeNull();
    });

    it('should label the sort button "Sort by <column>"', () => {
      expect(sortButton().getAttribute('aria-label')).toBe('Sort by ID');
    });

    it('should cycle aria-sort none → ascending → descending → none on activation', () => {
      const th = sortableTh();
      expect(th.getAttribute('aria-sort')).toBe('none');

      sortButton().click();
      fixture.detectChanges();
      expect(th.getAttribute('aria-sort')).toBe('ascending');

      sortButton().click();
      fixture.detectChanges();
      expect(th.getAttribute('aria-sort')).toBe('descending');

      sortButton().click();
      fixture.detectChanges();
      expect(th.getAttribute('aria-sort')).toBe('none');
    });
  });

  it('should give the actions column header an accessible name', async () => {
    fixture.componentInstance.editable.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const actionsTh = host.querySelector(
      '.mlv-data-table__cell--header.mlv-data-table__cell--actions',
    ) as HTMLTableCellElement;
    expect(actionsTh).toBeTruthy();
    expect(actionsTh.textContent?.trim()).toBe('Actions');
  });

  describe('keyboard selection', () => {
    beforeEach(async () => {
      fixture.componentInstance.selectable.set('multi');
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should toggle row selection with Space on the focused row', () => {
      dispatchKey(rows()[0], ' ');
      fixture.detectChanges();
      expect(table().selectedRows().size).toBe(1);

      dispatchKey(rows()[0], ' ');
      fixture.detectChanges();
      expect(table().selectedRows().size).toBe(0);
    });

    it('should toggle row selection with Enter on the focused row', () => {
      dispatchKey(rows()[1], 'Enter');
      fixture.detectChanges();
      expect(table().selectedRows().size).toBe(1);
    });

    it('should keep the per-row selection checkbox out of the tab order', () => {
      const input = rows()[0].querySelector(
        '.mlv-data-table__cell--select input',
      ) as HTMLInputElement;
      expect(input.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('experimental cell navigation (aria ngGrid)', () => {
    function dataCells(): HTMLTableCellElement[] {
      return Array.from(
        host.querySelectorAll<HTMLTableCellElement>(
          '.mlv-data-table__row--data td[role="gridcell"]',
        ),
      );
    }

    beforeEach(async () => {
      fixture.componentInstance.cellNavigation.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should render aria grid roles on rows and cells', () => {
      expect(host.querySelector('table[role="grid"]')).toBeTruthy();
      // 3 rows × 2 columns = 6 grid cells.
      expect(dataCells().length).toBe(6);
      expect(
        host.querySelectorAll('.mlv-data-table__row--data[role="row"]').length,
      ).toBe(3);
    });

    it('should expose a single roving tab stop across all cells', () => {
      const tabbable = dataCells().filter(
        (c) => c.getAttribute('tabindex') === '0',
      );
      expect(tabbable.length).toBe(1);
      // The remaining cells are focusable programmatically only.
      expect(
        dataCells().filter((c) => c.getAttribute('tabindex') === '-1').length,
      ).toBe(5);
    });

    it('should NOT apply row-level roving tabindex when cell nav is on', () => {
      const rowTabindexes = Array.from(
        host.querySelectorAll('.mlv-data-table__row--data'),
      ).map((r) => r.getAttribute('tabindex'));
      expect(rowTabindexes.every((t) => t === null)).toBe(true);
    });

    it('should move the active cell to the right with ArrowRight', () => {
      const first = dataCells()[0];
      expect(first.getAttribute('tabindex')).toBe('0');

      first.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
      fixture.detectChanges();

      // Roving tab stop should have advanced off the first cell.
      expect(dataCells()[0].getAttribute('tabindex')).toBe('-1');
      expect(dataCells()[1].getAttribute('tabindex')).toBe('0');
    });

    it('should move the active cell down with ArrowDown', () => {
      const cells = dataCells();
      cells[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      // Column 0 of the next row (index 2 in a 2-column grid) becomes the tab stop.
      expect(dataCells()[0].getAttribute('tabindex')).toBe('-1');
      expect(dataCells()[2].getAttribute('tabindex')).toBe('0');
    });

    it('should wrap interactive edit-cell content in an ngGridCellWidget', () => {
      fixture.componentInstance.editable.set(true);
      fixture.detectChanges();
      // The actions column exposes an editable/complex grid widget per row.
      const widgets = host.querySelectorAll('[id^="ng-grid-cell-widget-"]');
      expect(widgets.length).toBe(3);
      // The widget lives inside a grid cell and hosts the row action button.
      const widget = widgets[0] as HTMLElement;
      expect(widget.closest('td[role="gridcell"]')).toBeTruthy();
      expect(widget.querySelector('button')).toBeTruthy();
    });

    it('should fall back to row-level roving when virtual scroll is also on', () => {
      fixture.componentInstance.virtualScroll.set(true);
      fixture.detectChanges();
      // virtualScroll wins: cell navigation is disabled and the virtual
      // (row-roving) rendering path is used instead of the aria grid.
      // (jsdom's cdk viewport materialises no rows, so we assert on the mode,
      // not on rendered virtual rows.)
      expect(table()._cellNav()).toBe(false);
      expect(dataCells().length).toBe(0);
      expect(host.querySelector('cdk-virtual-scroll-viewport')).toBeTruthy();
    });
  });

  describe('cell template/style memoization', () => {
    it('returns a stable cell-context reference for a row across change-detection cycles', () => {
      const row = table().flatRows()[0];
      const first = table().getCellContext(row, 0);

      fixture.detectChanges();
      const second = table().getCellContext(row, 0);

      expect(second).toBe(first);
      expect(first.row).toBe(row);
      expect(first.index).toBe(0);
    });

    it('produces a fresh context bound to the new row after the data set is replaced', () => {
      const before = table().getCellContext(table().flatRows()[0], 0);

      fixture.componentInstance.data.set([{ id: 9, name: 'Zoe' }]);
      fixture.detectChanges();

      const newRow = table().flatRows()[0];
      const after = table().getCellContext(newRow, 0);
      expect(after).not.toBe(before);
      expect(after.row).toBe(newRow);
    });

    it('returns a stable cell-style reference for a column across calls', () => {
      const col = table().visibleColumns()[0];
      expect(table().getCellStyle(col)).toBe(table().getCellStyle(col));
    });
  });
});

@Component({
  imports: [MlvButton, MlvDataTable, MlvDataTableToolbarActions],
  template: `
    <mlv-data-table
      [data]="data"
      [columns]="columns()"
      [showSortMenu]="showSortMenu()"
    >
      <ng-template mlvDataTableToolbarActions>
        <button mlvButton type="button" data-test-export>Export</button>
      </ng-template>
    </mlv-data-table>
  `,
})
class ToolbarHostComponent {
  readonly data: Row[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  readonly columns = signal<MlvDataTableColumn[]>([
    { key: 'id', title: 'ID', sortable: true },
    { key: 'name', title: 'Name', sortable: true },
  ]);
  readonly showSortMenu = signal(false);
}

describe('MlvDataTable — toolbar sort menu', () => {
  let fixture: ComponentFixture<ToolbarHostComponent>;
  let overlayContainer: OverlayContainer;
  let overlay: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolbarHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarHostComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
    overlay = overlayContainer.getContainerElement();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(async () => {
    const openPanel = overlay.querySelector('[role="menu"]');
    openPanel?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    overlay
      .querySelectorAll('.mlv-popup--leave')
      .forEach((panel) =>
        panel.dispatchEvent(new Event('animationend', { bubbles: true })),
      );
    fixture.detectChanges();
    await fixture.whenStable();
    overlayContainer.ngOnDestroy();
  });

  async function openMenuWithKeyboard(): Promise<HTMLButtonElement> {
    const trigger = fixture.nativeElement.querySelector(
      '[data-mlv-table-sort-trigger]',
    ) as HTMLButtonElement | null;
    if (!trigger) throw new Error('Expected the Sort menu trigger');
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return trigger;
  }

  function dispatchMenuKey(
    panel: HTMLElement,
    key: string,
    keyCode: number,
  ): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    Object.defineProperty(event, 'keyCode', { value: keyCode });
    panel.dispatchEvent(event);
  }

  function table(): MlvDataTable {
    return fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
  }

  function menuPanel(label: string): HTMLElement {
    const panel = Array.from(
      overlay.querySelectorAll<HTMLElement>('[role="menu"]'),
    ).find((candidate) => candidate.getAttribute('aria-label') === label);
    if (!panel) throw new Error(`Expected menu panel: ${label}`);
    return panel;
  }

  function menuItem(panel: ParentNode, label: string): HTMLElement {
    const item = Array.from(
      panel.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((candidate) => candidate.textContent?.trim() === label);
    if (!item) throw new Error(`Expected menu item: ${label}`);
    return item;
  }

  async function finishLeave(panel: HTMLElement): Promise<void> {
    panel
      .closest('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('does not render the Sort menu by default', () => {
    expect(
      fixture.nativeElement.querySelector('[data-mlv-table-sort-trigger]'),
    ).toBeNull();
  });

  it('renders Sort only when opted in and at least one column is sortable', () => {
    fixture.componentInstance.showSortMenu.set(true);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '[data-mlv-table-sort-trigger]',
    ) as HTMLButtonElement;
    expect(trigger.textContent).toContain('Sort');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');

    fixture.componentInstance.columns.set([
      { key: 'id', title: 'ID' },
      { key: 'name', title: 'Name' },
    ]);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-mlv-table-sort-trigger]'),
    ).toBeNull();
  });

  it('renders projected domain actions in the one table toolbar', () => {
    const toolbar = fixture.nativeElement.querySelector(
      '.mlv-data-table__toolbar',
    ) as HTMLElement;
    expect(toolbar.querySelector('[data-test-export]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('.mlv-data-table__toolbar'),
    ).toHaveLength(1);
  });

  it('supports Arrow, Home, End, and Escape with trigger focus restoration', async () => {
    fixture.componentInstance.showSortMenu.set(true);
    fixture.detectChanges();
    const trigger = await openMenuWithKeyboard();
    const panel = overlay.querySelector('[role="menu"]') as HTMLElement;
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    expect(document.activeElement).toBe(items[0]);

    dispatchMenuKey(panel, 'End', 35);
    expect(document.activeElement).toBe(items.at(-1));

    dispatchMenuKey(panel, 'Home', 36);
    expect(document.activeElement).toBe(items[0]);

    dispatchMenuKey(panel, 'ArrowDown', 40);
    expect(document.activeElement).toBe(items[1]);

    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the open Sort menu axe-clean', async () => {
    fixture.componentInstance.showSortMenu.set(true);
    fixture.detectChanges();
    await openMenuWithKeyboard();

    await expectNoAxeViolations(overlay);
  });

  it('keeps the root menu open when click activates the active-column direction submenu', async () => {
    fixture.componentInstance.showSortMenu.set(true);
    table().applyPresentationState({
      sort: { key: 'id', direction: 'asc' },
    });
    fixture.detectChanges();

    const rootTrigger = fixture.nativeElement.querySelector(
      '[data-mlv-table-sort-trigger]',
    ) as HTMLButtonElement;
    rootTrigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const rootPanel = menuPanel('Sort rows');
    const activeColumn = menuItem(rootPanel, 'ID');
    activeColumn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rootPanel.closest('.mlv-popup--leave')).toBeNull();
    expect(activeColumn.getAttribute('aria-expanded')).toBe('true');
    expect(menuItem(rootPanel, 'Name')).toBeTruthy();
    expect(menuItem(menuPanel('Sort by ID'), 'Descending')).toBeTruthy();
    await expectNoAxeViolations(overlay);
  });

  it('opens the active direction submenu with Enter and Space and restores nested focus on Escape', async () => {
    fixture.componentInstance.showSortMenu.set(true);
    table().applyPresentationState({
      sort: { key: 'id', direction: 'asc' },
    });
    fixture.detectChanges();

    const rootTrigger = await openMenuWithKeyboard();
    const rootPanel = menuPanel('Sort rows');
    const activeColumn = menuItem(rootPanel, 'ID');
    expect(document.activeElement).toBe(activeColumn);

    activeColumn.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    let directionPanel = menuPanel('Sort by ID');
    expect(rootPanel.closest('.mlv-popup--leave')).toBeNull();
    expect(document.activeElement).toBe(menuItem(directionPanel, 'Ascending'));

    directionPanel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(activeColumn);
    expect(rootPanel.closest('.mlv-popup--leave')).toBeNull();
    await finishLeave(directionPanel);

    activeColumn.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    directionPanel = menuPanel('Sort by ID');
    expect(rootPanel.closest('.mlv-popup--leave')).toBeNull();
    expect(document.activeElement).toBe(menuItem(directionPanel, 'Ascending'));

    directionPanel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(activeColumn);
    await finishLeave(directionPanel);

    rootPanel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(rootTrigger);
  });
});

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    [data]="data"
    [columns]="columns()"
    [virtualScroll]="virtualScroll()"
    [rowHeight]="40"
    [selectable]="selectable()"
    [editable]="editable()"
  />`,
})
class ResizeHostComponent {
  readonly data: Row[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  readonly columns = signal<MlvDataTableColumn[]>([
    {
      key: 'id',
      title: 'ID',
      width: '10rem',
      minWidth: '80px',
      maxWidth: '180px',
      resizable: true,
      pinned: true,
    },
    { key: 'name', title: 'Name', width: '160px', pinned: true },
  ]);
  readonly virtualScroll = signal(false);
  readonly selectable = signal<MlvSelectableMode>(false);
  readonly editable = signal(false);
}

describe('MlvDataTable — column resize', () => {
  let fixture: ComponentFixture<ResizeHostComponent>;
  let measuredHeaderWidth: number;
  let measuredTableWidth: number;
  let measuredSelectionWidth: number;
  let measuredActionsWidth: number;

  function domRect(width: number): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      right: width,
      bottom: 40,
      left: 0,
      width,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect;
  }

  function table(): MlvDataTable {
    return fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
  }

  /** The resizable `id` column's current MlvColumnState (throws if it disappears). */
  function idColumn() {
    const col = table()
      .visibleColumns()
      .find((c) => c.key === 'id');
    if (!col) throw new Error('id column not found');
    return col;
  }

  function resizeHandle(): HTMLElement {
    const handle = fixture.nativeElement.querySelector(
      '.mlv-data-table__resize-handle',
    ) as HTMLElement | null;
    if (!handle) throw new Error('resize handle not found');
    return handle;
  }

  function installPointerCapture(handle = resizeHandle()): void {
    Object.defineProperties(handle, {
      setPointerCapture: {
        configurable: true,
        value: vi.fn(),
      },
      hasPointerCapture: {
        configurable: true,
        value: vi.fn(() => true),
      },
      releasePointerCapture: {
        configurable: true,
        value: vi.fn(),
      },
    });
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
    return event as unknown as PointerEvent;
  }

  function dispatchResizeKey(key: string, shiftKey = false): void {
    resizeHandle().dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResizeHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    measuredHeaderWidth = 120;
    measuredTableWidth = 280;
    measuredSelectionWidth = 44;
    measuredActionsWidth = 112;
    fixture = TestBed.createComponent(ResizeHostComponent);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.matches('table')) return domRect(measuredTableWidth);
        const key = this.getAttribute('data-mlv-column-key');
        if (key === 'id') {
          let currentWidth: number | undefined;
          try {
            currentWidth = idColumn()._currentWidth;
          } catch {
            // The first layout query may occur before the child component is ready.
          }
          return domRect(currentWidth ?? measuredHeaderWidth);
        }
        if (key === 'name') return domRect(160);
        if (this.matches('thead .mlv-data-table__cell--select')) {
          return domRect(measuredSelectionWidth);
        }
        if (this.matches('thead .mlv-data-table__cell--actions')) {
          return domRect(measuredActionsWidth);
        }
        return domRect(0);
      },
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    installPointerCapture();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Direction is global state: `MlvRtlService` writes it onto <html>, which
    // outlives the TestBed injector, and the scoped `dir` sits on the fixture's
    // parent, which the next fixture reuses.
    fixture.nativeElement.parentElement?.removeAttribute('dir');
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  it('uses pointer capture and the measured header width before committing', () => {
    const events: unknown[] = [];
    table().columnResize.subscribe((event) => events.push(event));
    const handle = resizeHandle();

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointermove', 125));
    handle.dispatchEvent(pointerEvent('pointerup', 125));
    fixture.detectChanges();

    expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
    // The declared `10rem` is never misread as `10px`: 120px measured + 25px.
    expect(idColumn()._currentWidth).toBe(145);
    expect(table().getCellStyle(idColumn())).toMatchObject({
      width: '145px',
      'min-width': '145px',
      'max-width': '145px',
    });
    const renderedTable = fixture.nativeElement.querySelector(
      'table.mlv-data-table__table',
    ) as HTMLTableElement;
    expect(renderedTable.style.width).toBe('305px');
    expect(renderedTable.style.tableLayout).toBe('fixed');
    expect(events).toEqual([{ key: 'id', width: 145, source: 'pointer' }]);
  });

  it('falls back to document pointer listeners when capture is rejected', () => {
    const handle = resizeHandle();
    vi.spyOn(handle, 'setPointerCapture').mockImplementation(() => {
      throw new DOMException('Pointer capture rejected');
    });

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    document.dispatchEvent(pointerEvent('pointermove', 115));
    document.dispatchEvent(pointerEvent('pointerup', 115));
    fixture.detectChanges();

    expect(idColumn()._currentWidth).toBe(135);
  });

  it('treats lost pointer capture as cancellation and permits a later drag', () => {
    const events: unknown[] = [];
    table().columnResize.subscribe((event) => events.push(event));
    const handle = resizeHandle();

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointermove', 130));
    handle.dispatchEvent(pointerEvent('lostpointercapture', 130));
    document.dispatchEvent(pointerEvent('pointerup', 130));
    fixture.detectChanges();

    expect(idColumn()._currentWidth).toBeUndefined();
    expect(events).toEqual([]);

    handle.dispatchEvent(pointerEvent('pointerdown', 100, 2));
    document.dispatchEvent(pointerEvent('pointermove', 110, 2));
    document.dispatchEvent(pointerEvent('pointerup', 110, 2));
    fixture.detectChanges();

    expect(idColumn()._currentWidth).toBe(130);
    expect(events).toEqual([{ key: 'id', width: 130, source: 'pointer' }]);
  });

  it('enforces both configured pointer bounds', () => {
    const handle = resizeHandle();

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointermove', -200));
    handle.dispatchEvent(pointerEvent('pointerup', -200));
    fixture.detectChanges();
    expect(idColumn()._currentWidth).toBe(80);

    handle.dispatchEvent(pointerEvent('pointerdown', 100, 2));
    handle.dispatchEvent(pointerEvent('pointermove', 500, 2));
    handle.dispatchEvent(pointerEvent('pointerup', 500, 2));
    fixture.detectChanges();
    expect(idColumn()._currentWidth).toBe(180);
  });

  it('ignores unrelated pointers until the captured pointer finishes', () => {
    const handle = resizeHandle();
    handle.dispatchEvent(pointerEvent('pointerdown', 100, 7));

    handle.dispatchEvent(pointerEvent('pointermove', 170, 8));
    handle.dispatchEvent(pointerEvent('pointerup', 170, 8));
    expect(idColumn()._currentWidth).toBeUndefined();

    handle.dispatchEvent(pointerEvent('pointermove', 110, 7));
    handle.dispatchEvent(pointerEvent('pointerup', 110, 7));
    fixture.detectChanges();
    expect(idColumn()._currentWidth).toBe(130);
  });

  /**
   * Tracks listeners bound to `target` as a **net count per event type**. The
   * number of subscriptions is an implementation detail — `takeUntil(up$)`
   * opens a `pointerup` subscription of its own — while "nothing is still
   * bound once the gesture is over" is the guarantee, and a net of zero is how
   * you see it. Restored by the suite's `afterEach`.
   */
  function trackListeners(target: EventTarget): Map<string, number> {
    const net = new Map<string, number>();
    const bump = (type: string, delta: number): void =>
      void net.set(type, (net.get(type) ?? 0) + delta);
    const realAdd = target.addEventListener.bind(target);
    const realRemove = target.removeEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation(
      (type, listener, options) => {
        bump(type, 1);
        realAdd(type, listener, options);
      },
    );
    vi.spyOn(target, 'removeEventListener').mockImplementation(
      (type, listener, options) => {
        bump(type, -1);
        realRemove(type, listener, options);
      },
    );
    return net;
  }

  it('releases every drag listener when the gesture ends', () => {
    const handle = resizeHandle();
    const net = trackListeners(document);

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(net.get('pointermove')).toBeGreaterThan(0);

    handle.dispatchEvent(pointerEvent('pointerup', 140));

    expect(net.get('pointermove')).toBe(0);
    expect(net.get('pointerup')).toBe(0);
    expect(net.get('pointercancel')).toBe(0);
  });

  // `_cleanupResize()` runs from `DestroyRef.onDestroy` as well as from the
  // gesture's own exits. Nothing a user can do exercises that path, so it gets
  // its own assertion.
  it('releases every drag listener when destroyed mid-drag', () => {
    const handle = resizeHandle();
    const net = trackListeners(document);

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointermove', 140));
    expect(net.get('pointermove')).toBeGreaterThan(0);

    fixture.destroy();

    expect(net.get('pointermove')).toBe(0);
    expect(net.get('pointerup')).toBe(0);
    expect(net.get('pointercancel')).toBe(0);
  });

  it('keeps the drag alive when an unrelated pointer lifts', () => {
    const handle = resizeHandle();
    const net = trackListeners(document);

    handle.dispatchEvent(pointerEvent('pointerdown', 100, 7));
    const bound = net.get('pointermove');

    // A secondary contact releasing must not end the captured gesture — the
    // terminator is filtered on the captured pointer id.
    handle.dispatchEvent(pointerEvent('pointerup', 170, 8));

    expect(net.get('pointermove')).toBe(bound);

    handle.dispatchEvent(pointerEvent('pointerup', 110, 7));
    expect(net.get('pointermove')).toBe(0);
  });

  // `pointercancel` and `lostpointercapture` are the two terminators
  // `takeUntil(pointerUp$)` cannot see — no `pointerup` ever arrives — so
  // `_cleanupResize()`'s `unsubscribe()` is the only thing that releases the
  // streams on these paths. The pointer-up test above passes without it.
  it('releases every drag listener when the gesture is cancelled', () => {
    const handle = resizeHandle();
    const net = trackListeners(document);

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(net.get('pointermove')).toBeGreaterThan(0);

    handle.dispatchEvent(pointerEvent('pointercancel', 140));

    expect(net.get('pointermove')).toBe(0);
    expect(net.get('pointerup')).toBe(0);
    expect(net.get('pointercancel')).toBe(0);
  });

  it('releases every drag listener when pointer capture is lost', () => {
    const handle = resizeHandle();
    const documentNet = trackListeners(document);
    const handleNet = trackListeners(handle);

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    expect(documentNet.get('pointermove')).toBeGreaterThan(0);
    expect(handleNet.get('lostpointercapture')).toBeGreaterThan(0);

    handle.dispatchEvent(pointerEvent('lostpointercapture', 140));

    expect(documentNet.get('pointermove')).toBe(0);
    expect(documentNet.get('pointerup')).toBe(0);
    expect(documentNet.get('pointercancel')).toBe(0);
    expect(handleNet.get('lostpointercapture')).toBe(0);
  });

  it('drops the live width and emits nothing when the pointer is cancelled', () => {
    const events: unknown[] = [];
    table().columnResize.subscribe((event) => events.push(event));
    const handle = resizeHandle();
    const cancelRaf = vi.spyOn(globalThis, 'cancelAnimationFrame');

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    handle.dispatchEvent(pointerEvent('pointermove', 140));
    handle.dispatchEvent(pointerEvent('pointercancel', 140));
    fixture.detectChanges();

    expect(idColumn()._currentWidth).toBeUndefined();
    expect(table().getCellStyle(idColumn())['width']).toBe('10rem');
    expect(events).toEqual([]);
    expect(cancelRaf).toHaveBeenCalled();
  });

  it('supports arrow, shifted arrow, Home, and End keyboard resizing', () => {
    const events: unknown[] = [];
    table().columnResize.subscribe((event) => events.push(event));

    dispatchResizeKey('ArrowRight');
    expect(idColumn()._currentWidth).toBe(128);

    dispatchResizeKey('ArrowRight', true);
    expect(idColumn()._currentWidth).toBe(160);

    dispatchResizeKey('Home');
    expect(idColumn()._currentWidth).toBe(80);

    dispatchResizeKey('End');
    expect(idColumn()._currentWidth).toBe(180);
    expect(events).toEqual([
      { key: 'id', width: 128, source: 'keyboard' },
      { key: 'id', width: 160, source: 'keyboard' },
      { key: 'id', width: 80, source: 'keyboard' },
      { key: 'id', width: 180, source: 'keyboard' },
    ]);
  });

  it('mirrors keyboard resizing inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
    const scope = fixture.nativeElement.parentElement as HTMLElement;
    scope.setAttribute('dir', 'rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    // The document is untouched — only this subtree is flipped. A CDK overlay
    // pane is stamped the same way, so this is also the in-overlay case.
    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');

    // The separator sits on the column's mirrored inline-end edge, so
    // ArrowLeft grows the column and ArrowRight shrinks it.
    dispatchResizeKey('ArrowLeft');
    expect(idColumn()._currentWidth).toBe(128);

    dispatchResizeKey('ArrowRight');
    expect(idColumn()._currentWidth).toBe(120);

    dispatchResizeKey('ArrowLeft', true);
    expect(idColumn()._currentWidth).toBe(152);

    // Home/End address the resolved bounds, not an inline side, and the
    // handler ignores the vertical pair in both directions.
    dispatchResizeKey('Home');
    expect(idColumn()._currentWidth).toBe(80);

    dispatchResizeKey('ArrowUp');
    expect(idColumn()._currentWidth).toBe(80);

    dispatchResizeKey('End');
    expect(idColumn()._currentWidth).toBe(180);
  });

  it('keeps keyboard resizing unmirrored in an LTR island while the document is RTL', async () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    const scope = fixture.nativeElement.parentElement as HTMLElement;
    scope.setAttribute('dir', 'ltr');
    fixture.detectChanges();
    await fixture.whenStable();

    dispatchResizeKey('ArrowRight');
    expect(idColumn()._currentWidth).toBe(128);

    dispatchResizeKey('ArrowLeft');
    expect(idColumn()._currentWidth).toBe(120);
  });

  // #308 — the separator rides the column's inline-end edge, the physical LEFT
  // edge in RTL, so an outward drag moves the pointer toward smaller `clientX`.
  // The raw `clientX` delta shrank the column instead (120 → 80, its minimum)
  // while the keyboard path, already direction-aware, grew it.
  it.each(['ltr', 'global-rtl', 'scoped-rtl'] as const)(
    'grows the column when its separator is dragged 40px outward (%s)',
    async (scope) => {
      if (scope === 'global-rtl') {
        TestBed.inject(MlvRtlService).setDirection('rtl');
      }
      if (scope === 'scoped-rtl') {
        (fixture.nativeElement.parentElement as HTMLElement).setAttribute(
          'dir',
          'rtl',
        );
      }
      fixture.detectChanges();
      await fixture.whenStable();
      if (scope === 'scoped-rtl') {
        expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
      }

      const events: unknown[] = [];
      table().columnResize.subscribe((event) => events.push(event));
      const handle = resizeHandle();
      const outward = scope === 'ltr' ? 40 : -40;

      handle.dispatchEvent(pointerEvent('pointerdown', 100));
      handle.dispatchEvent(pointerEvent('pointermove', 100 + outward));
      handle.dispatchEvent(pointerEvent('pointerup', 100 + outward));
      fixture.detectChanges();

      expect(idColumn()._currentWidth).toBe(160);
      expect(events).toEqual([{ key: 'id', width: 160, source: 'pointer' }]);
    },
  );

  it.each(['ltr', 'global-rtl', 'scoped-rtl'] as const)(
    'shrinks the column when its separator is dragged 25px inward (%s)',
    async (scope) => {
      if (scope === 'global-rtl') {
        TestBed.inject(MlvRtlService).setDirection('rtl');
      }
      if (scope === 'scoped-rtl') {
        (fixture.nativeElement.parentElement as HTMLElement).setAttribute(
          'dir',
          'rtl',
        );
      }
      fixture.detectChanges();
      await fixture.whenStable();

      const handle = resizeHandle();
      const inward = scope === 'ltr' ? -25 : 25;

      handle.dispatchEvent(pointerEvent('pointerdown', 100));
      handle.dispatchEvent(pointerEvent('pointermove', 100 + inward));
      handle.dispatchEvent(pointerEvent('pointerup', 100 + inward));
      fixture.detectChanges();

      expect(idColumn()._currentWidth).toBe(95);
    },
  );

  it('exposes complete localized separator ARIA markup', () => {
    const handle = resizeHandle();
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Resize ID column');
    expect(handle.getAttribute('aria-valuemin')).toBe('80');
    expect(handle.getAttribute('aria-valuemax')).toBe('180');
    expect(handle.getAttribute('aria-valuenow')).toBe('120');
    expect(handle.getAttribute('aria-valuetext')).toBe('120 pixels');
  });

  it('resets one or all overrides and reports a reset source', () => {
    const events: unknown[] = [];
    table().columnResize.subscribe((event) => events.push(event));
    dispatchResizeKey('ArrowRight');

    resizeHandle().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    expect(idColumn()._currentWidth).toBeUndefined();
    expect(table().getCellStyle(idColumn())['width']).toBe('10rem');
    expect(events.at(-1)).toEqual({
      key: 'id',
      width: null,
      source: 'reset',
    });

    dispatchResizeKey('ArrowRight');
    table().resetColumnWidth();
    fixture.detectChanges();
    expect(idColumn()._currentWidth).toBeUndefined();
    expect(events.at(-1)).toEqual({
      key: 'id',
      width: null,
      source: 'reset',
    });
  });

  it('resets the active column with Enter for keyboard reset parity', () => {
    const events: unknown[] = [];
    table().columnResize.subscribe((event) => events.push(event));

    dispatchResizeKey('ArrowRight');
    dispatchResizeKey('Enter');

    expect(idColumn()._currentWidth).toBeUndefined();
    expect(table().getCellStyle(idColumn())['width']).toBe('10rem');
    expect(events.at(-1)).toEqual({
      key: 'id',
      width: null,
      source: 'reset',
    });
  });

  it('prefers measured pinned offsets and retains them across reset', () => {
    expect(table().columnOffsets().get('name_left')).toBe('120px');

    dispatchResizeKey('ArrowRight');
    expect(table().columnOffsets().get('name_left')).toBe('128px');

    dispatchResizeKey('Enter');
    expect(table().columnOffsets().get('name_left')).toBe('120px');
  });

  it('safely mirrors horizontal scroll in both virtual directions and exposes the gutter extent', async () => {
    fixture.componentInstance.columns.update((columns) =>
      columns.map((column) =>
        column.key === 'name'
          ? { ...column, pinSide: 'right' as const }
          : column,
      ),
    );
    fixture.componentInstance.virtualScroll.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    installPointerCapture();

    const splitTables = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLTableElement>(
        'table.mlv-data-table__table--virtual',
      ),
    );
    const viewport = fixture.nativeElement.querySelector(
      'cdk-virtual-scroll-viewport',
    ) as HTMLElement;
    const wrapper = fixture.nativeElement.querySelector(
      '.mlv-data-table__wrapper',
    ) as HTMLElement;
    let wrapperScrollLeft = 0;
    let viewportScrollLeft = 0;
    let wrapperScrollWrites = 0;
    let viewportScrollWrites = 0;
    Object.defineProperties(viewport, {
      offsetWidth: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 285 },
      scrollWidth: { configurable: true, value: 444 },
      scrollLeft: {
        configurable: true,
        get: () => viewportScrollLeft,
        set: (value: number) => {
          viewportScrollWrites++;
          viewportScrollLeft = value;
        },
      },
    });
    Object.defineProperties(wrapper, {
      clientWidth: { configurable: true, value: 300 },
      scrollLeft: {
        configurable: true,
        get: () => wrapperScrollLeft,
        set: (value: number) => {
          wrapperScrollWrites++;
          wrapperScrollLeft = Math.min(159, Math.max(0, value));
        },
      },
    });

    dispatchResizeKey('ArrowRight');
    const expectedWidth = `${table().resizedTableWidth()}px`;

    wrapper.scrollLeft = 64;
    wrapper.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    expect(splitTables.length).toBeGreaterThanOrEqual(2);
    expect(splitTables.map((element) => element.style.width)).toEqual(
      splitTables.map(() => expectedWidth),
    );
    expect(viewport.style.width).toBe('');
    expect(viewport.scrollLeft).toBe(64);
    expect(
      wrapper.style.getPropertyValue('--mlv-dt-virtual-scrollbar-gutter'),
    ).toBe('15px');
    const horizontalSizer = fixture.nativeElement.querySelector(
      '.mlv-data-table__virtual-horizontal-sizer',
    ) as HTMLElement;
    expect(horizontalSizer.getAttribute('aria-hidden')).toBe('true');
    expect(horizontalSizer.style.width).toBe('459px');

    const writesAfterForwardSync = viewportScrollWrites;
    wrapper.dispatchEvent(new Event('scroll'));
    expect(viewportScrollWrites).toBe(writesAfterForwardSync);

    viewport.scrollLeft = 200;
    const wrapperWritesBeforeReverseSync = wrapperScrollWrites;
    viewport.dispatchEvent(new Event('scroll'));
    expect(wrapper.scrollLeft).toBe(159);
    expect(viewport.scrollLeft).toBe(159);
    expect(wrapperScrollWrites).toBe(wrapperWritesBeforeReverseSync + 1);

    const writesAfterReverseSync = {
      wrapper: wrapperScrollWrites,
      viewport: viewportScrollWrites,
    };
    viewport.dispatchEvent(new Event('scroll'));
    expect(wrapperScrollWrites).toBe(writesAfterReverseSync.wrapper);
    expect(viewportScrollWrites).toBe(writesAfterReverseSync.viewport);

    const nameColumn = table()
      .visibleColumns()
      .find((column) => column.key === 'name');
    if (!nameColumn) throw new Error('name column not found');
    expect(table().getCellStyle(idColumn())['left']).toContain(
      '--mlv-dt-pinned-left-correction',
    );
    expect(table().getCellStyle(nameColumn)['right']).toContain(
      '--mlv-dt-pinned-right-correction',
    );

    dispatchResizeKey('Enter');
    expect(table().resizedTableWidth()).toBeNull();
    expect(horizontalSizer.style.width).toBe('459px');
  });

  it('removes both virtual horizontal synchronization listeners on destroy', async () => {
    fixture.componentInstance.virtualScroll.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector(
      '.mlv-data-table__wrapper',
    ) as HTMLElement;
    const viewport = fixture.nativeElement.querySelector(
      'cdk-virtual-scroll-viewport',
    ) as HTMLElement;
    const wrapperRemoveSpy = vi.spyOn(wrapper, 'removeEventListener');
    const viewportRemoveSpy = vi.spyOn(viewport, 'removeEventListener');

    fixture.destroy();

    expect(wrapperRemoveSpy.mock.calls.map((call) => call[0])).toContain(
      'scroll',
    );
    expect(viewportRemoveSpy.mock.calls.map((call) => call[0])).toContain(
      'scroll',
    );
  });

  it('freezes measured selection and actions geometry with the data columns', () => {
    fixture.componentInstance.selectable.set('multi');
    fixture.componentInstance.editable.set(true);
    fixture.detectChanges();

    dispatchResizeKey('ArrowRight');

    expect(table().resizedTableWidth()).toBe(444);

    const selectionColumns = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLTableColElement>(
        'col.mlv-data-table__col--select',
      ),
    );
    const actionColumns = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLTableColElement>(
        'col.mlv-data-table__col--actions',
      ),
    );
    expect(selectionColumns.map((column) => column.style.width)).toEqual(
      selectionColumns.map(() => '44px'),
    );
    expect(actionColumns.map((column) => column.style.width)).toEqual(
      actionColumns.map(() => '112px'),
    );

    const selectionCells = [
      fixture.nativeElement.querySelector(
        'th.mlv-data-table__cell--select',
      ) as HTMLElement,
      fixture.nativeElement.querySelector(
        'td.mlv-data-table__cell--select',
      ) as HTMLElement,
    ];
    const actionCells = [
      fixture.nativeElement.querySelector(
        'th.mlv-data-table__cell--actions',
      ) as HTMLElement,
      fixture.nativeElement.querySelector(
        'td.mlv-data-table__cell--actions',
      ) as HTMLElement,
    ];
    for (const cell of selectionCells) {
      expect(cell.style.width).toBe('44px');
      expect(cell.style.minWidth).toBe('44px');
      expect(cell.style.maxWidth).toBe('44px');
    }
    for (const cell of actionCells) {
      expect(cell.style.width).toBe('112px');
      expect(cell.style.minWidth).toBe('112px');
      expect(cell.style.maxWidth).toBe('112px');
    }

    dispatchResizeKey('Enter');
    for (const element of [
      ...selectionColumns,
      ...actionColumns,
      ...selectionCells,
      ...actionCells,
    ]) {
      expect(element.style.width).toBe('');
      expect(element.style.minWidth).toBe('');
      expect(element.style.maxWidth).toBe('');
    }
  });

  it('resolves percentage bounds against the rendered header table', () => {
    measuredTableWidth = 400;
    fixture.componentInstance.columns.update((columns) =>
      columns.map((column) =>
        column.key === 'id'
          ? { ...column, minWidth: '25%', maxWidth: '50%' }
          : column,
      ),
    );
    fixture.detectChanges();

    dispatchResizeKey('Home');
    expect(idColumn()._currentWidth).toBe(100);

    dispatchResizeKey('Enter');
    dispatchResizeKey('End');
    expect(idColumn()._currentWidth).toBe(200);
    expect(resizeHandle().getAttribute('aria-valuemin')).toBe('100');
    expect(resizeHandle().getAttribute('aria-valuemax')).toBe('200');
  });

  it('preserves zero and fractional pixel bounds without truthiness loss', () => {
    fixture.componentInstance.columns.update((columns) =>
      columns.map((column) =>
        column.key === 'id'
          ? { ...column, minWidth: '0px', maxWidth: '180.6px' }
          : column,
      ),
    );
    fixture.detectChanges();

    dispatchResizeKey('End');
    expect(idColumn()._currentWidth).toBe(180.6);
    expect(table().getCellStyle(idColumn())['width']).toBe('180.6px');

    dispatchResizeKey('Home');
    expect(idColumn()._currentWidth).toBe(0);
    expect(table().getCellStyle(idColumn())).toMatchObject({
      width: '0px',
      'min-width': '0px',
      'max-width': '0px',
    });
  });

  it('removes pointer listeners and releases capture when destroyed mid-drag', () => {
    const handle = resizeHandle();
    const documentRemoveSpy = vi.spyOn(document, 'removeEventListener');
    const handleRemoveSpy = vi.spyOn(handle, 'removeEventListener');

    handle.dispatchEvent(pointerEvent('pointerdown', 100));
    fixture.destroy();

    const removedDocumentEvents = documentRemoveSpy.mock.calls.map(
      (call) => call[0],
    );
    expect(removedDocumentEvents).toContain('pointermove');
    expect(removedDocumentEvents).toContain('pointerup');
    expect(removedDocumentEvents).toContain('pointercancel');
    expect(handleRemoveSpy.mock.calls.map((call) => call[0])).toContain(
      'lostpointercapture',
    );
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
  });
});

// Isolated: this suite swaps the `DOCUMENT` provider, so it keeps its own
// TestBed rather than mutating the resize suite's.
describe('MlvDataTable — resize document binding', () => {
  afterEach(() => vi.restoreAllMocks());

  function countAdds(target: EventTarget): Map<string, number> {
    const added = new Map<string, number>();
    const realAdd = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation(
      (type, listener, options) => {
        added.set(type, (added.get(type) ?? 0) + 1);
        realAdd(type, listener, options);
      },
    );
    return added;
  }

  // Under server rendering the injected `DOCUMENT` and the ambient `document`
  // global are different objects and the global is defined, so binding the
  // ambient one would attach a per-render table to a process-wide object no
  // teardown reaches — without throwing. This asserts *which* object receives
  // the drag listeners.
  it('binds the resize drag to the injected DOCUMENT, not the ambient global', async () => {
    const isolated = document.implementation.createHTMLDocument('table');

    await TestBed.configureTestingModule({
      imports: [ResizeHostComponent],
      providers: [
        provideMlvI18nTesting(),
        { provide: DOCUMENT, useValue: isolated },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ResizeHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const handle = fixture.nativeElement.querySelector(
      '.mlv-data-table__resize-handle',
    ) as HTMLElement | null;
    if (!handle) throw new Error('resize handle not found');

    const isolatedAdds = countAdds(isolated);
    const ambientAdds = countAdds(document);

    const down = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 100,
    });
    Object.defineProperty(down, 'pointerId', { value: 1 });
    handle.dispatchEvent(down as unknown as PointerEvent);

    expect(isolatedAdds.get('pointermove')).toBeGreaterThan(0);
    expect(isolatedAdds.get('pointerup')).toBeGreaterThan(0);
    expect(ambientAdds.get('pointermove')).toBeUndefined();
    expect(ambientAdds.get('pointerup')).toBeUndefined();

    fixture.destroy();
  });
});

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table [data]="data" [columns]="columns" />`,
})
class HideableHostComponent {
  readonly data: Row[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID', hideable: true },
    { key: 'name', title: 'Name', hideable: true },
  ];
}

describe('MlvDataTable — cell-style memoization coverage', () => {
  let fixture: ComponentFixture<HideableHostComponent>;

  function table(): MlvDataTable {
    return fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
  }

  /** The declared column for `key`, whether or not it is currently visible. */
  function column(key: string): MlvDataTableColumn {
    const col = table()
      .allColumns()
      .find((c) => c.key === key);
    if (!col) throw new Error(`No column declared for key "${key}"`);
    return col;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HideableHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HideableHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('returns a stable cell-style reference for a hidden column', async () => {
    table().toggleColumnVisibility('name');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      table()
        .visibleColumns()
        .map((c) => c.key),
    ).toEqual(['id']);

    const hidden = column('name');
    expect(table().getCellStyle(hidden)).toBe(table().getCellStyle(hidden));
  });

  // Pins the coverage invariant `getCellStyle`'s fallback rests on: every
  // declared column is memoized, so no column a cell can be rendered for — and
  // no column a consumer can legitimately pass — reaches the on-the-fly branch.
  // Asserted over the declared set, not just the visible one, so re-narrowing
  // the memo to `visibleColumns()` fails here instead of silently reintroducing
  // a per-call allocation.
  it('memoizes every declared column, hidden ones included', async () => {
    table().toggleColumnVisibility('name');
    fixture.detectChanges();
    await fixture.whenStable();
    // Guard the precondition: if the toggle ever regresses to a no-op both
    // columns stay visible, every column hits the memo, `unstable` is `[]` and
    // the assertion below passes having exercised nothing.
    expect(
      table()
        .visibleColumns()
        .map((c) => c.key),
    ).toEqual(['id']);

    const unstable = table()
      .allColumns()
      .filter((col) => table().getCellStyle(col) !== table().getCellStyle(col))
      .map((col) => col.key);

    expect(unstable).toEqual([]);
  });

  it('builds a hidden column style from table state, not from the raw column input', async () => {
    table().applyPresentationState({
      visibleColumnKeys: ['id'],
      columnWidths: { name: 160 },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      table()
        .visibleColumns()
        .map((c) => c.key),
    ).toEqual(['id']);
    expect(table().getCellStyle(column('name'))).toEqual({
      width: '160px',
      'min-width': '160px',
      'max-width': '160px',
    });
  });
});
