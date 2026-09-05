import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import Sortable from 'sortablejs';
import { afterEach, describe, expect, it } from 'vitest';
import { MLV_TASKBOARD_COLUMNS_REGISTRY } from './taskboard-column-sortable';
import { MlvTaskboard } from './taskboard';
import type {
  MlvTaskboardCanReorderColumnFn,
  MlvTaskboardColumn,
  MlvTaskboardColumnGroup,
} from '../taskboard.types';

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

@Component({
  imports: [MlvTaskboard],
  template: `
    <mlv-taskboard
      [(items)]="items"
      [(columns)]="columns"
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
  readonly board = viewChild.required(MlvTaskboard<Ticket>);
}

async function createFixture(): Promise<ComponentFixture<ColumnHost>> {
  await TestBed.configureTestingModule({
    imports: [ColumnHost],
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
    `.mlv-taskboard__column-header[data-mlv-taskboard-column-id="${columnId}"]`,
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
  willInsertAfter: boolean,
): Sortable.MoveEvent {
  return {
    dragged,
    draggedRect: dragged.getBoundingClientRect(),
    from: container,
    related,
    relatedRect: related.getBoundingClientRect(),
    to: container,
    willInsertAfter,
    type: 'move',
  } as unknown as Sortable.MoveEvent;
}

/** Drags one column header over another and releases it there. */
function dropColumnOn(
  host: HTMLElement,
  draggedId: string,
  relatedId: string,
  willInsertAfter = false,
): boolean | -1 | 1 | void {
  const row = headerRow(host);
  const sortable = sortableFor(row);
  const dragged = columnHeader(host, draggedId);
  sortable.options.onStart?.(dragEvent(dragged, row));
  const moveResult = sortable.options.onMove?.(
    hoverEvent(dragged, row, columnHeader(host, relatedId), willInsertAfter),
    new Event('pointermove'),
  );
  sortable.options.onEnd?.(dragEvent(dragged, row));
  return moveResult;
}

function columnIds(fixture: ComponentFixture<ColumnHost>): string[] {
  return fixture.componentInstance.columns().map((column) => String(column.id));
}

/** Each rendered group run as `<group id or '-'>:<column tracks it spans>`. */
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

    expect((sortable.options.group as Sortable.GroupOptions).name).toBe(
      'mlv-taskboard-columns',
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

    expect(dropColumnOn(host, 'c', 'a')).toBe(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(columnIds(fixture)).toEqual(['c', 'a', 'b']);
    expect(
      Array.from(
        host.querySelectorAll<HTMLElement>('.mlv-taskboard__column-header'),
      ).map((header) => header.getAttribute('data-mlv-taskboard-column-id')),
    ).toEqual(['c', 'a', 'b']);
  });

  it('keeps the physical insert side in LTR', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;

    // A pointer physically past `a` is the slot after it while reading order
    // runs left to right.
    dropColumnOn(host, 'c', 'a', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(columnIds(fixture)).toEqual(['a', 'c', 'b']);
  });

  it('mirrors the physical insert side under a global RTL flip', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    rtlService = TestBed.inject(MlvRtlService);
    rtlService.setDirection('rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    // `willInsertAfter` is physical: SortableJS compares `clientX` with the
    // target's rect edges, so in RTL "after" is the slot before in DOM order.
    dropColumnOn(host, 'c', 'a', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(columnIds(fixture)).toEqual(['c', 'a', 'b']);
  });

  it('follows a [dir] scope on an ancestor while the document stays LTR', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;
    rtlService = TestBed.inject(MlvRtlService);
    host.setAttribute('dir', 'rtl');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rtlService.direction()).toBe('ltr');

    dropColumnOn(host, 'c', 'a', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(columnIds(fixture)).toEqual(['c', 'a', 'b']);
  });

  it('adopts the group of the new neighbours when a column crosses a run', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;

    dropColumnOn(host, 'c', 'a');
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
    const before = fixture.componentInstance.columns();
    dropColumnOn(host, 'c', 'a');
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
    const before = fixture.componentInstance.columns();
    dropColumnOn(host, 'c', 'a');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.columns()).toBe(before);
    expect(calls).toEqual(['c:2->0']);
  });

  it('renders group headers as contiguous runs rather than declaration order', async () => {
    const fixture = await createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(groupRunSpans(host)).toEqual(['left:2', 'right:1']);
    expect(
      host
        .querySelector('[data-mlv-taskboard-group-id="left"]')
        ?.getAttribute('aria-colspan'),
    ).toBe('2');

    fixture.componentInstance.columns.set([
      { id: 'a', label: 'A', groupId: 'left' },
      { id: 'c', label: 'C', groupId: 'right' },
      { id: 'b', label: 'B', groupId: 'left' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(groupRunSpans(host)).toEqual(['left:1', 'right:1', 'left:1']);
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
    expect(groupRunSpans(host)).toEqual(['left:1', '-:1', 'right:1']);
    expect(
      host
        .querySelector('.mlv-taskboard__group--spacer')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
