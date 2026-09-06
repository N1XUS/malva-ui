import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import Sortable from 'sortablejs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MLV_TASKBOARD_COLUMNS_REGISTRY } from './taskboard-column-sortable';
import { MlvTaskboard } from './taskboard';
import type {
  MlvTaskboardCanReorderColumnFn,
  MlvTaskboardColumn,
  MlvTaskboardColumnGroup,
} from '../taskboard.types';
import { provideTaskboardTesting } from '../testing/taskboard-test-context';

interface Ticket {
  readonly id: string;
  readonly status: string;
}

const INITIAL_ITEMS: readonly Ticket[] = [{ id: 'one', status: 'a' }];

const INITIAL_COLUMNS: readonly MlvTaskboardColumn[] = [
  { id: 'a', label: 'A', groupId: 'left' },
  { id: 'b', label: 'B', groupId: 'left' },
  { id: 'c', label: 'C', groupId: 'right' },
];

const INITIAL_GROUPS: readonly MlvTaskboardColumnGroup[] = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

/** Inline spans of the three headers while reading order runs left to right. */
const LTR_SPANS: Readonly<Record<string, readonly [number, number]>> = {
  a: [0, 100],
  b: [100, 200],
  c: [200, 300],
};

/** The same three headers mirrored: `a` now sits at the physical right edge. */
const RTL_SPANS: Readonly<Record<string, readonly [number, number]>> = {
  a: [200, 300],
  b: [100, 200],
  c: [0, 100],
};

@Component({
  imports: [MlvTaskboard],
  template: `
    <mlv-taskboard
      [(items)]="items"
      [columns]="columns()"
      (columnsChange)="onColumnsChange($event)"
      [columnGroups]="groups()"
      dataKey="id"
      columnField="status"
      [canReorderColumnFn]="canReorderColumnFn()"
    />
  `,
})
class ColumnHost {
  readonly items = signal<readonly Ticket[]>(INITIAL_ITEMS);
  readonly columns = signal<readonly MlvTaskboardColumn[]>(INITIAL_COLUMNS);
  readonly groups = signal<readonly MlvTaskboardColumnGroup[]>(INITIAL_GROUPS);
  readonly canReorderColumnFn = signal<
    MlvTaskboardCanReorderColumnFn | undefined
  >(undefined);
  /** How many times the board wrote a replacement column collection. */
  readonly emissions = signal(0);
  readonly board = viewChild.required(MlvTaskboard<Ticket>);

  onColumnsChange(next: readonly MlvTaskboardColumn[]): void {
    this.emissions.update((count) => count + 1);
    this.columns.set(next);
  }
}

async function createFixture(): Promise<ComponentFixture<ColumnHost>> {
  await TestBed.configureTestingModule({
    imports: [ColumnHost],
    providers: [provideTaskboardTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(ColumnHost);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function headerRow(host: HTMLElement): HTMLElement {
  const row = host.querySelector<HTMLElement>('.mlv-taskboard__column-row');
  if (!row) throw new Error('Expected a rendered column header row.');
  return row;
}

function columnHeader(host: HTMLElement, columnId: string): HTMLElement {
  const header = host.querySelector<HTMLElement>(
    `.mlv-taskboard__column-header[data-mlv-taskboard-column-id="string:${columnId}"]`,
  );
  if (!header) throw new Error(`Expected a rendered header for ${columnId}`);
  return header;
}

function sortableFor(element: HTMLElement): Sortable {
  const sortable = Sortable.get(element);
  if (!sortable) {
    throw new Error('Expected a registered taskboard column Sortable.');
  }
  return sortable;
}

/**
 * Pins each header's inline span. jsdom lays nothing out and reports every
 * rect as zero, so the adapter's midpoint comparison needs real numbers.
 */
function stubHeaderRects(
  host: HTMLElement,
  spans: Readonly<Record<string, readonly [number, number]>>,
): void {
  for (const [id, [left, right]] of Object.entries(spans)) {
    const rect: DOMRect = {
      x: left,
      y: 0,
      left,
      right,
      top: 0,
      bottom: 40,
      width: right - left,
      height: 40,
      toJSON: () => ({}),
    };
    vi.spyOn(columnHeader(host, id), 'getBoundingClientRect').mockReturnValue(
      rect,
    );
  }
}

/** One hovered pointer position, plus the engine flags the row must ignore. */
interface ColumnHover {
  /** The pointer's physical `clientX`, the only input the slot comes from. */
  readonly clientX: number;
  /** Sends the coordinate as a `TouchEvent`-shaped payload instead. */
  readonly touch?: boolean;
  /** Deliberately contradicts the geometry; the header row must ignore it. */
  readonly willInsertAfter?: boolean;
  /** The header SortableJS names as `related`; also ignored by the row. */
  readonly relatedId?: string;
}

function dragEvent(
  item: HTMLElement,
  container: HTMLElement,
): Sortable.SortableEvent {
  return {
    item,
    items: [],
    clone: item,
    from: container,
    to: container,
    target: container,
    oldIndex: 0,
    newIndex: 0,
    oldDraggableIndex: 0,
    newDraggableIndex: 0,
    pullMode: true,
    type: 'end',
  } as unknown as Sortable.SortableEvent;
}

function hoverEvent(
  dragged: HTMLElement,
  container: HTMLElement,
  related: HTMLElement,
  hover: ColumnHover,
): Sortable.MoveEvent {
  return {
    dragged,
    draggedRect: dragged.getBoundingClientRect(),
    from: container,
    related,
    relatedRect: related.getBoundingClientRect(),
    to: container,
    willInsertAfter: hover.willInsertAfter ?? false,
    originalEvent: hover.touch
      ? { touches: [{ clientX: hover.clientX }] }
      : { clientX: hover.clientX },
    type: 'move',
  } as unknown as Sortable.MoveEvent;
}

/** Drags one column header to a pointer position and releases it there. */
function dropColumnAt(
  host: HTMLElement,
  draggedId: string,
  hover: ColumnHover,
): boolean | -1 | 1 | void {
  const row = headerRow(host);
  const sortable = sortableFor(row);
  const dragged = columnHeader(host, draggedId);
  const related = columnHeader(host, hover.relatedId ?? draggedId);
  sortable.options.onStart?.(dragEvent(dragged, row));
  const moveResult = sortable.options.onMove?.(
    hoverEvent(dragged, row, related, hover),
    new Event('pointermove'),
  );
  sortable.options.onEnd?.(dragEvent(dragged, row));
  return moveResult;
}

/** Starts a header drag and hovers it, leaving the drag in flight. */
function hoverColumnAt(
  host: HTMLElement,
  draggedId: string,
  hover: ColumnHover,
): { readonly release: () => void } {
  const row = headerRow(host);
  const sortable = sortableFor(row);
  const dragged = columnHeader(host, draggedId);
  const related = columnHeader(host, hover.relatedId ?? draggedId);
  sortable.options.onStart?.(dragEvent(dragged, row));
  sortable.options.onMove?.(
    hoverEvent(dragged, row, related, hover),
    new Event('pointermove'),
  );
  return { release: () => sortable.options.onEnd?.(dragEvent(dragged, row)) };
}

/** The header carrying the insertion-edge marker, as `<id>:<side>`. */
function dropEdge(host: HTMLElement): string | null {
  const marked = host.querySelector<HTMLElement>(
    '[data-mlv-taskboard-drop-edge]',
  );
  if (marked === null) return null;
  return `${String(
    marked.getAttribute('data-mlv-taskboard-column-id'),
  )}:${String(marked.getAttribute('data-mlv-taskboard-drop-edge'))}`;
}

function columnIds(fixture: ComponentFixture<ColumnHost>): string[] {
  return fixture.componentInstance.columns().map((column) => String(column.id));
}

/** Each rendered group run as `<group key token or '-'>:<tracks it spans>`. */
function groupRunSpans(host: HTMLElement): string[] {
  return Array.from(
    host.querySelectorAll<HTMLElement>('.mlv-taskboard__group'),
  ).map((group) => {
    const id = group.getAttribute('data-mlv-taskboard-group-id') ?? '-';
    const span = /span (\d+)/.exec(group.style.gridColumn)?.[1] ?? '0';
    return `${id}:${span}`;
  });
}

describe('MlvTaskboard SortableJS column adapter', () => {
  /** Set by the direction specs; the flip is global state and must be reset. */
  let rtlService: MlvRtlService | null = null;

  afterEach(() => {
    rtlService?.setDirection('ltr');
    rtlService = null;
  });

  it('registers the header row in a private column group that only drags headers', async () => {
    const fixture = await createFixture();
    const sortable = sortableFor(headerRow(fixture.nativeElement));

    // The suffix is per board instance, so two boards on one page never
    // accept each other's header drags.
    expect((sortable.options.group as Sortable.GroupOptions).name).toMatch(
      /^mlv-taskboard-columns-\d+$/,
    );
    expect(sortable.options.draggable).toBe('.mlv-taskboard__column-header');
    expect(sortable.options.filter).toContain(
      '[data-mlv-taskboard-column-locked="true"]',
    );
    expect(sortable.options.forceFallback).toBe(true);
  });

  it('registers a replacement header row and keeps it when the old one leaves', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const registry = fixture.debugElement
      .query(By.css('mlv-taskboard'))
      .injector.get(MLV_TASKBOARD_COLUMNS_REGISTRY);
    const first = headerRow(host);

    // Angular can render a replacement row before the destroy hook of the one
    // it replaces has run, so registration arrives before unregistration.
    const replacement = document.createElement('div');
    replacement.className = 'mlv-taskboard__column-row';
    first.after(replacement);
    registry.registerColumnRow(replacement);
    registry.unregisterColumnRow(first);

    expect(Sortable.get(replacement)).toBeTruthy();
    expect(Sortable.get(first)).toBeNull();
  });

  it('reorders the controlled columns without letting Sortable move the header', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    stubHeaderRects(host, LTR_SPANS);

    expect(dropColumnAt(host, 'c', { clientX: 30 })).toBe(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(columnIds(fixture)).toEqual(['c', 'a', 'b']);
    expect(
      Array.from(
        host.querySelectorAll<HTMLElement>('.mlv-taskboard__column-header'),
      ).map((header) => header.getAttribute('data-mlv-taskboard-column-id')),
    ).toEqual(['string:c', 'string:a', 'string:b']);
  });

  describe('drop slots on the inline axis', () => {
    it('counts the headers the pointer has passed in LTR', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);

      // Before `a`'s midpoint: the head of the row. `willInsertAfter` and
      // `related` say the slot after `a`; the row ignores both.
      dropColumnAt(host, 'c', {
        clientX: 30,
        relatedId: 'a',
        willInsertAfter: true,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(columnIds(fixture)).toEqual(['c', 'a', 'b']);
    });

    it('counts a pointer past one midpoint as the second slot in LTR', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);

      dropColumnAt(host, 'c', {
        clientX: 150,
        relatedId: 'a',
        willInsertAfter: false,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(columnIds(fixture)).toEqual(['a', 'c', 'b']);
    });

    it('reads a touch payload the same way as a pointer one', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);

      dropColumnAt(host, 'c', {
        clientX: 150,
        touch: true,
        relatedId: 'a',
        willInsertAfter: false,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(columnIds(fixture)).toEqual(['a', 'c', 'b']);
    });

    it('emits nothing while the pointer sits over the dragged header', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);
      const before = fixture.componentInstance.columns();

      dropColumnAt(host, 'c', {
        clientX: 290,
        relatedId: 'a',
        willInsertAfter: true,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.columns()).toBe(before);
      expect(fixture.componentInstance.emissions()).toBe(0);
    });

    it('emits nothing for free space past the end when the column is already last', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);
      const before = fixture.componentInstance.columns();

      dropColumnAt(host, 'c', {
        clientX: 350,
        relatedId: 'b',
        willInsertAfter: false,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.columns()).toBe(before);
      expect(fixture.componentInstance.emissions()).toBe(0);
    });

    it('sends a column to the tail from free space past the end in LTR', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);

      dropColumnAt(host, 'a', {
        clientX: 350,
        relatedId: 'b',
        willInsertAfter: false,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(columnIds(fixture)).toEqual(['b', 'c', 'a']);
    });

    it('counts from the inline-start edge under a global RTL flip', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      rtlService = TestBed.inject(MlvRtlService);
      rtlService.setDirection('rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      stubHeaderRects(host, RTL_SPANS);

      // 270 sits inside `a`, past its inline-start edge but before its
      // midpoint, so the drop lands at the head of the row.
      dropColumnAt(host, 'c', {
        clientX: 270,
        relatedId: 'a',
        willInsertAfter: false,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(columnIds(fixture)).toEqual(['c', 'a', 'b']);
    });

    it('emits nothing at the inline-end of an RTL row for the last column', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      rtlService = TestBed.inject(MlvRtlService);
      rtlService.setDirection('rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      stubHeaderRects(host, RTL_SPANS);
      const before = fixture.componentInstance.columns();

      dropColumnAt(host, 'c', {
        clientX: 30,
        relatedId: 'a',
        willInsertAfter: false,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.columns()).toBe(before);
      expect(fixture.componentInstance.emissions()).toBe(0);
    });

    it('sends a column to the tail past the inline-end in RTL', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      rtlService = TestBed.inject(MlvRtlService);
      rtlService.setDirection('rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      stubHeaderRects(host, RTL_SPANS);

      dropColumnAt(host, 'a', {
        clientX: -50,
        relatedId: 'b',
        willInsertAfter: true,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(columnIds(fixture)).toEqual(['b', 'c', 'a']);
    });

    it('follows a [dir] scope on an ancestor while the document stays LTR', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      rtlService = TestBed.inject(MlvRtlService);
      host.setAttribute('dir', 'rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      stubHeaderRects(host, RTL_SPANS);

      expect(rtlService.direction()).toBe('ltr');

      dropColumnAt(host, 'c', {
        clientX: 270,
        relatedId: 'a',
        willInsertAfter: false,
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(columnIds(fixture)).toEqual(['c', 'a', 'b']);
    });
  });

  describe('drop indicator', () => {
    it('marks the insertion edge while a header drag hovers, and clears it on drop', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);

      // Past `b`'s midpoint only: `a` would land between `b` and `c`, so the
      // slot shows at `c`'s inline-start edge.
      const between = hoverColumnAt(host, 'a', { clientX: 160 });
      expect(dropEdge(host)).toBe('string:c:start');
      between.release();
      expect(dropEdge(host)).toBeNull();

      // Past every remaining midpoint: the slot is the tail, drawn on the
      // inline-end edge of the last remaining header.
      const tail = hoverColumnAt(host, 'a', { clientX: 290 });
      expect(dropEdge(host)).toBe('string:c:end');
      tail.release();
      expect(dropEdge(host)).toBeNull();
    });

    it('marks no slot for a hover that would not move the column', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);

      const drag = hoverColumnAt(host, 'a', { clientX: 30 });
      expect(dropEdge(host)).toBeNull();
      expect(
        headerRow(host).getAttribute('data-mlv-taskboard-drop-state'),
      ).toBe('invalid');
      drag.release();
    });

    it('shows no accept affordance for an order a locked column denies', async () => {
      const fixture = await createFixture();
      fixture.componentInstance.columns.set([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', locked: true },
        { id: 'c', label: 'C' },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      stubHeaderRects(host, LTR_SPANS);

      // Moving `a` past `b` would shift the locked column out of index 1.
      const drag = hoverColumnAt(host, 'a', { clientX: 160 });
      expect(dropEdge(host)).toBeNull();
      expect(
        headerRow(host).getAttribute('data-mlv-taskboard-drop-state'),
      ).toBe('invalid');
      drag.release();
    });

    it('resolves the insertion edge against a scoped RTL direction', async () => {
      const fixture = await createFixture();
      const host = fixture.nativeElement as HTMLElement;
      rtlService = TestBed.inject(MlvRtlService);
      host.setAttribute('dir', 'rtl');
      fixture.detectChanges();
      await fixture.whenStable();
      stubHeaderRects(host, RTL_SPANS);

      expect(rtlService.direction()).toBe('ltr');

      // Mirrored, `c` sits at the physical left. A pointer just inside it has
      // passed `b`'s midpoint only, so `a` lands before `c` — the same logical
      // edge the LTR case reports, on the header the mirrored geometry names.
      const drag = hoverColumnAt(host, 'a', { clientX: 90 });
      expect(dropEdge(host)).toBe('string:c:start');
      drag.release();
      host.removeAttribute('dir');
    });
  });

  it('adopts the group of the new neighbours when a column crosses a run', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    stubHeaderRects(host, LTR_SPANS);

    dropColumnAt(host, 'c', { clientX: 30 });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.componentInstance
        .columns()
        .map((column) => `${String(column.id)}:${String(column.groupId)}`),
    ).toEqual(['c:left', 'a:left', 'b:left']);
  });

  it('leaves the columns untouched when a locked column would change position', async () => {
    const fixture = await createFixture();
    fixture.componentInstance.columns.set([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', locked: true },
      { id: 'c', label: 'C' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    stubHeaderRects(host, LTR_SPANS);
    const before = fixture.componentInstance.columns();
    dropColumnAt(host, 'c', { clientX: 30 });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.columns()).toBe(before);
  });

  it('leaves the columns untouched when canReorderColumnFn denies the order', async () => {
    const fixture = await createFixture();
    const calls: string[] = [];
    fixture.componentInstance.canReorderColumnFn.set(
      (column, fromIndex, toIndex) => {
        calls.push(`${String(column.id)}:${fromIndex}->${toIndex}`);
        return false;
      },
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    stubHeaderRects(host, LTR_SPANS);
    const before = fixture.componentInstance.columns();
    dropColumnAt(host, 'c', { clientX: 30 });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.columns()).toBe(before);
    expect(calls).toEqual(['c:2->0']);
  });

  it('renders group headers as contiguous runs rather than declaration order', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(groupRunSpans(host)).toEqual(['string:left:2', 'string:right:1']);
    expect(
      host
        .querySelector('[data-mlv-taskboard-group-id="string:left"]')
        ?.getAttribute('aria-colspan'),
    ).toBe('2');

    fixture.componentInstance.columns.set([
      { id: 'a', label: 'A', groupId: 'left' },
      { id: 'c', label: 'C', groupId: 'right' },
      { id: 'b', label: 'B', groupId: 'left' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(groupRunSpans(host)).toEqual([
      'string:left:1',
      'string:right:1',
      'string:left:1',
    ]);
  });

  it('renders an unlabeled spacer run for columns that belong to no group', async () => {
    const fixture = await createFixture();
    fixture.componentInstance.columns.set([
      { id: 'a', label: 'A', groupId: 'left' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C', groupId: 'right' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(groupRunSpans(host)).toEqual([
      'string:left:1',
      '-:1',
      'string:right:1',
    ]);
    expect(
      host
        .querySelector('.mlv-taskboard__group--spacer')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
