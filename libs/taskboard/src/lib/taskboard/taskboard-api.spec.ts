import { DOCUMENT } from '@angular/common';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { describe, expect, it, vi } from 'vitest';
import type {
  MlvTaskboardColumn,
  MlvTaskboardKey,
  MlvTaskboardUiSnapshot,
} from '../taskboard.types';
import { MlvTaskboard } from './taskboard';
import { provideTaskboardTesting } from '../testing/taskboard-test-context';

interface Ticket {
  readonly id: string;
  readonly status: string;
  readonly title: string;
}

const INITIAL_ITEMS: readonly Ticket[] = [
  { id: 'a', status: 'todo', title: 'First' },
  { id: 'b', status: 'todo', title: 'Second, with comma' },
  { id: 'x', status: 'done', title: 'Third' },
];

@Component({
  imports: [MlvTaskboard],
  template: `<mlv-taskboard
    [(items)]="items"
    [columns]="columns()"
    (columnsChange)="applyColumns($event)"
    [(selection)]="selection"
    [collapsedColumnIds]="collapsedColumnIds()"
    (collapsedColumnIdsChange)="applyCollapsedColumns($event)"
    dataKey="id"
    columnField="status"
  />`,
})
class ApiHost {
  readonly items = signal<readonly Ticket[]>(INITIAL_ITEMS);
  readonly columns = signal<readonly MlvTaskboardColumn[]>([
    { id: 'todo', label: 'Todo' },
    { id: 'done', label: 'Done' },
  ]);
  /** Every column order the board wrote back, newest last. */
  readonly columnOrders: (readonly MlvTaskboardKey[])[] = [];
  readonly selection = signal<ReadonlySet<string>>(new Set());
  readonly collapsedColumnIds = signal<ReadonlySet<MlvTaskboardKey>>(new Set());
  /** Every collapsed-column set the board wrote back, newest last. */
  readonly collapsedWrites: (readonly MlvTaskboardKey[])[] = [];
  readonly board = viewChild.required(MlvTaskboard<Ticket>);

  applyCollapsedColumns(next: ReadonlySet<MlvTaskboardKey>): void {
    this.collapsedWrites.push([...next]);
    this.collapsedColumnIds.set(next);
  }

  applyColumns(next: readonly MlvTaskboardColumn[]): void {
    this.columnOrders.push(next.map((column) => column.id));
    this.columns.set(next);
  }
}

describe('MlvTaskboard public surface', () => {
  async function mount() {
    await TestBed.configureTestingModule({
      imports: [ApiHost],
      providers: [provideTaskboardTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ApiHost);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const card = (id: string) =>
      host.querySelector(
        `[data-mlv-taskboard-card-id="string:${id}"]`,
      ) as HTMLElement;
    const move = () => {
      card('a').dispatchEvent(new FocusEvent('focus'));
      for (const value of [' ', 'ArrowRight', ' ']) {
        card('a').dispatchEvent(
          new KeyboardEvent('keydown', { key: value, bubbles: true }),
        );
      }
      fixture.detectChanges();
    };
    const live = () =>
      host.querySelector('.mlv-taskboard__live-region')?.textContent?.trim() ??
      '';
    return { fixture, host, card, move, live };
  }

  it('reports nothing to undo or redo on an untouched board', async () => {
    const { fixture } = await mount();

    expect(fixture.componentInstance.board().undo()).toBe(false);
    expect(fixture.componentInstance.board().redo()).toBe(false);
  });

  it('undoes and redoes a committed move through the controlled models', async () => {
    const { fixture, move } = await mount();
    const statusOf = (id: string) =>
      fixture.componentInstance.items().find((item) => item.id === id)?.status;

    move();
    expect(statusOf('a')).toBe('done');

    expect(fixture.componentInstance.board().undo()).toBe(true);
    fixture.detectChanges();
    expect(statusOf('a')).toBe('todo');

    expect(fixture.componentInstance.board().redo()).toBe(true);
    fixture.detectChanges();
    expect(statusOf('a')).toBe('done');
  });

  it('drops the replayable ledger when the application replaces the items', async () => {
    const { fixture, move } = await mount();

    move();
    fixture.componentInstance.items.set([
      { id: 'a', status: 'todo', title: 'Rewritten' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.board().undo()).toBe(false);
  });

  it('snapshots the collapsed, selected, and focused board state', async () => {
    const { fixture, card } = await mount();
    fixture.componentInstance.collapsedColumnIds.set(new Set(['done']));
    fixture.detectChanges();
    card('a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card('a').dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();

    const snapshot = fixture.componentInstance.board().snapshot();
    expect([...snapshot.columnIds]).toEqual(['todo', 'done']);
    expect([...snapshot.collapsedColumnIds]).toEqual(['done']);
    expect([...snapshot.selectedIds]).toEqual(['a']);
    expect(snapshot.focusedId).toBe('a');
  });

  it('restores a snapshot and ignores identifiers the board does not know', async () => {
    const { fixture } = await mount();

    fixture.componentInstance.board().restore({
      columnIds: ['todo', 'done'],
      collapsedColumnIds: ['done', 'nope'],
      collapsedSwimlaneIds: ['ghost'],
      selectedIds: ['b', 'missing'],
      focusedId: 'gone',
      cellScrollPositions: { 'string:nowhere|undefined': 40 },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect([...fixture.componentInstance.collapsedColumnIds()]).toEqual([
      'done',
    ]);
    expect([...fixture.componentInstance.selection()]).toEqual(['b']);
    expect(fixture.componentInstance.board().snapshot().focusedId).toBe(
      undefined,
    );
  });

  it('restores the snapshot column order and keeps unknown columns behind it', async () => {
    const { fixture } = await mount();
    const host = fixture.componentInstance;
    host.columns.set([
      { id: 'todo', label: 'Todo' },
      { id: 'done', label: 'Done' },
      { id: 'review', label: 'Review' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const snapshot = host.board().snapshot();

    host.columns.set([
      { id: 'review', label: 'Review' },
      { id: 'todo', label: 'Todo' },
      { id: 'done', label: 'Done' },
      { id: 'extra', label: 'Extra' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    host.columnOrders.length = 0;

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.columns().map((column) => column.id)).toEqual([
      'todo',
      'done',
      'review',
      'extra',
    ]);
    expect(host.columnOrders).toEqual([['todo', 'done', 'review', 'extra']]);

    expect(host.board().undo()).toBe(true);
    fixture.detectChanges();
    expect(host.columns().map((column) => column.id)).toEqual([
      'review',
      'todo',
      'done',
      'extra',
    ]);
  });

  it('writes no column order when the snapshot already matches the board', async () => {
    const { fixture } = await mount();
    const host = fixture.componentInstance;
    const snapshot = host.board().snapshot();
    host.columnOrders.length = 0;

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.columnOrders).toEqual([]);
    expect(host.board().undo()).toBe(false);
  });

  it('restores state without rewriting unchanged sets or announcing them', async () => {
    const { fixture, live } = await mount();
    const host = fixture.componentInstance;
    host.collapsedColumnIds.set(new Set(['done']));
    fixture.detectChanges();
    const snapshot = host.board().snapshot();
    host.collapsedWrites.length = 0;

    host.board().restore({ ...snapshot, selectedIds: ['b'] });
    fixture.detectChanges();
    await fixture.whenStable();

    expect([...host.selection()]).toEqual(['b']);
    // The collapsed set the snapshot names is the one the board already has.
    expect(host.collapsedWrites).toEqual([]);
    // A restore is programmatic: nothing the user did needs announcing.
    expect(live()).toBe('');
  });

  it('captures and restores a plain cell offset on the element that scrolls', async () => {
    const { fixture, host } = await mount();
    // This board declares no `virtualItemSize`, so the cell is a plain cards
    // list — and the element that actually scrolls is the `mlv-scrollbar`
    // viewport wrapped around it, not the list itself. Asserting on the
    // wrapper is the point: an offset written to a box with no overflow is
    // silently discarded, and the snapshot would restore nothing.
    const cards = host.querySelector('.mlv-taskboard__cards') as HTMLElement;
    // The *nearest* enclosing viewport, not any enclosing one: the column
    // strip's scrollbar also contains this list, and writing an offset there
    // would prove nothing about the cell.
    const scroller = cards.closest<HTMLElement>('.mlv-scrollbar__viewport');
    expect(scroller).not.toBeNull();
    expect(
      fixture.debugElement
        .queryAll(By.directive(MlvScrollbar))
        .map((debugElement) => debugElement.injector.get(MlvScrollbar))
        .map((scrollbar) => scrollbar.viewportElement),
    ).toContain(scroller);

    (scroller as HTMLElement).scrollTop = 24;
    expect(
      fixture.componentInstance.board().snapshot().cellScrollPositions[
        'string:todo|undefined'
      ],
    ).toBe(24);

    (scroller as HTMLElement).scrollTop = 0;
    fixture.componentInstance.board().restore({
      columnIds: ['todo', 'done'],
      collapsedColumnIds: [],
      collapsedSwimlaneIds: [],
      selectedIds: [],
      cellScrollPositions: { 'string:todo|undefined': 24 },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect((scroller as HTMLElement).scrollTop).toBe(24);
  });

  it('restores the card placement a snapshot captured', async () => {
    const { fixture, move } = await mount();
    const host = fixture.componentInstance;
    const statusOf = (id: string) =>
      host.items().find((item) => item.id === id)?.status;
    const snapshot = host.board().snapshot();

    move();
    await fixture.whenStable();
    expect(statusOf('a')).toBe('done');

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(statusOf('a')).toBe('todo');
    expect(host.items().map((item) => item.id)).toEqual(['a', 'b', 'x']);
  });

  it('restores placement onto card content edited since the capture', async () => {
    const { fixture, move } = await mount();
    const host = fixture.componentInstance;
    const snapshot = host.board().snapshot();

    move();
    await fixture.whenStable();
    // The application edits the card after the capture, the way a controlled
    // store does: a replacement record, not a mutation.
    host.items.set(
      host
        .items()
        .map((item) =>
          item.id === 'a' ? { ...item, title: 'Renamed' } : item,
        ),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();

    const restored = host.items().find((item) => item.id === 'a');
    // Placement comes back; content stays the application's.
    expect([restored?.status, restored?.title]).toEqual(['todo', 'Renamed']);
    expect(host.items().map((item) => item.id)).toEqual(['a', 'b', 'x']);
  });

  it('never resurrects a card removed since the capture', async () => {
    const { fixture, move } = await mount();
    const host = fixture.componentInstance;
    const snapshot = host.board().snapshot();

    move();
    await fixture.whenStable();
    host.items.set(host.items().filter((item) => item.id !== 'b'));
    fixture.detectChanges();
    await fixture.whenStable();

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.items().map((item) => item.id)).toEqual(['a', 'x']);
  });

  it('keeps a card added since the capture, behind the captured ones', async () => {
    const { fixture, move } = await mount();
    const host = fixture.componentInstance;
    const snapshot = host.board().snapshot();

    move();
    await fixture.whenStable();
    // Added at the front, so "kept" and "kept in place" cannot both pass by
    // accident: the restore has to put it behind every captured card.
    host.items.set([
      { id: 'c', status: 'todo', title: 'Fourth' },
      ...host.items(),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.items().map((item) => item.id)).toEqual(['a', 'b', 'x', 'c']);
    expect(host.items().find((item) => item.id === 'c')?.status).toBe('todo');
  });

  it('writes nothing for a store that re-creates every card in place', async () => {
    const { fixture } = await mount();
    const host = fixture.componentInstance;
    const snapshot = host.board().snapshot();

    // A store that emits fresh objects on every tick without moving anything:
    // the placement the snapshot describes is the placement on screen.
    const recreated = host.items().map((item) => ({ ...item }));
    host.items.set(recreated);
    fixture.detectChanges();
    await fixture.whenStable();

    const writes: (readonly Ticket[])[] = [];
    host.board().items.subscribe((value) => writes.push(value));

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(writes).toEqual([]);
    expect(host.items()).toBe(recreated);
    expect(host.board().undo()).toBe(false);
  });

  it('records one undoable command for a restore that moves cards back', async () => {
    const { fixture, move } = await mount();
    const host = fixture.componentInstance;
    const statusOf = (id: string) =>
      host.items().find((item) => item.id === id)?.status;
    const columnOrder = () => host.columns().map((column) => column.id);
    const snapshot = host.board().snapshot();

    move();
    await fixture.whenStable();
    // Both halves of the restore have to move, or an implementation recording
    // one command per half passes on the cards alone: with the column order
    // already matching, only one write ever happens.
    host.columns.set([...host.columns()].reverse());
    fixture.detectChanges();
    await fixture.whenStable();
    expect([statusOf('a'), columnOrder()]).toEqual(['done', ['done', 'todo']]);

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();
    expect([statusOf('a'), columnOrder()]).toEqual(['todo', ['todo', 'done']]);

    // One step back over the whole restore — cards and column order together.
    expect(host.board().undo()).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect([statusOf('a'), columnOrder()]).toEqual(['done', ['done', 'todo']]);

    expect(host.board().redo()).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect([statusOf('a'), columnOrder()]).toEqual(['todo', ['todo', 'done']]);
  });

  it('leaves the cards alone for a snapshot that carries none', async () => {
    const { fixture, move } = await mount();
    const host = fixture.componentInstance;

    move();
    await fixture.whenStable();
    const moved = host.items();

    host.board().restore({
      columnIds: ['todo', 'done'],
      collapsedColumnIds: [],
      collapsedSwimlaneIds: [],
      selectedIds: [],
      cellScrollPositions: {},
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.items()).toBe(moved);
  });

  it('keeps a card whose captured column is gone at its current placement', async () => {
    const { fixture, host: dom } = await mount();
    const host = fixture.componentInstance;
    const statusOf = (id: string) =>
      host.items().find((item) => item.id === id)?.status;
    host.columns.set([
      { id: 'todo', label: 'Todo' },
      { id: 'doing', label: 'Doing' },
      { id: 'done', label: 'Done' },
    ]);
    host.items.set([
      { id: 'a', status: 'todo', title: 'First' },
      { id: 'b', status: 'doing', title: 'Second, with comma' },
      { id: 'x', status: 'done', title: 'Third' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const snapshot = host.board().snapshot();

    // The board moves on the way a consumer moves it on: `done` is retired and
    // the card it held is moved into a column that survives, along with the
    // card the snapshot captured in `todo`.
    host.items.set([
      { id: 'a', status: 'doing', title: 'First' },
      { id: 'b', status: 'doing', title: 'Second, with comma' },
      { id: 'x', status: 'doing', title: 'Third' },
    ]);
    host.columns.set([
      { id: 'todo', label: 'Todo' },
      { id: 'doing', label: 'Doing' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    host.board().restore(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();

    // `a` and `b` name columns the board still has, so they go back where the
    // snapshot found them; `x` named the retired one and keeps its current
    // placement instead of naming a column the index would reject.
    expect([statusOf('a'), statusOf('b'), statusOf('x')]).toEqual([
      'todo',
      'doing',
      'doing',
    ]);
    expect(dom.querySelectorAll('[data-mlv-taskboard-card-id]')).toHaveLength(
      3,
    );

    expect(host.board().undo()).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(statusOf('a')).toBe('doing');
  });

  it('treats a snapshot whose items are undefined as UI-only', async () => {
    const { fixture, move } = await mount();
    const host = fixture.componentInstance;

    move();
    await fixture.whenStable();
    const moved = host.items();
    // A hand-built or round-tripped object can carry an explicit `undefined`
    // where a captured snapshot carries the array. That is absent placement,
    // not empty placement.
    const withoutItems = {
      ...host.board().snapshot(),
      items: undefined,
    } as unknown as MlvTaskboardUiSnapshot;

    host.board().restore(withoutItems);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.items()).toBe(moved);
    // The restore recorded nothing of its own, so the one undo is the move's.
    expect(host.board().undo()).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.items().find((item) => item.id === 'a')?.status).toBe('todo');
  });

  it('records no command for a restore that changes nothing', async () => {
    const { fixture } = await mount();
    const host = fixture.componentInstance;
    const before = host.items();

    host.board().restore(host.board().snapshot());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.items()).toBe(before);
    expect(host.board().undo()).toBe(false);
  });

  it('embeds the UI-only projection of a snapshot in the JSON export', async () => {
    const { fixture } = await mount();

    const json = fixture.componentInstance.board().exportJson();

    expect('items' in json.snapshot).toBe(false);
    expect(json.items.map((item) => item.id)).toEqual(['a', 'b', 'x']);
  });

  it('delegates the exports to the pure board helpers', async () => {
    const { fixture } = await mount();

    const json = fixture.componentInstance.board().exportJson();
    expect(json.items.map((item) => item.id)).toEqual(['a', 'b', 'x']);
    expect(json.dataKey).toBe('id');

    expect(
      fixture.componentInstance.board().exportCsv('todo', [
        { field: 'id', heading: 'Id' },
        { field: 'title', heading: 'Title' },
      ]),
    ).toBe('Id,Title\na,First\nb,"Second, with comma"');
  });

  it('prints through the document view after expanding every cell', async () => {
    const { fixture } = await mount();
    const view = TestBed.inject(DOCUMENT).defaultView;
    if (view === null) throw new Error('Expected a browser test document.');
    const print = vi.spyOn(view, 'print').mockImplementation(() => undefined);

    try {
      fixture.componentInstance.board().print();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(print).toHaveBeenCalledTimes(1);
    } finally {
      // The view is the shared jsdom window: a spy left installed is handed
      // straight back by the next `vi.spyOn`, calls already recorded and all.
      print.mockRestore();
    }
  });

  it('does nothing on print when the document has no view', async () => {
    // A detached document is the shape a server render hands the board: it has
    // no `defaultView`, and the ambient one must not be reached for instead.
    const serverDocument = document.implementation.createHTMLDocument();
    expect(serverDocument.defaultView).toBeNull();
    await TestBed.configureTestingModule({
      imports: [ApiHost],
      providers: [
        provideTaskboardTesting(),
        { provide: DOCUMENT, useValue: serverDocument },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ApiHost);
    fixture.detectChanges();
    const ambientPrint = vi
      .spyOn(window, 'print')
      .mockImplementation(() => undefined);

    try {
      fixture.componentInstance.board().print();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(ambientPrint).not.toHaveBeenCalled();
    } finally {
      ambientPrint.mockRestore();
    }
  });
});
