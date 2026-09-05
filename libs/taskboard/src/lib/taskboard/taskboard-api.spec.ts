import { DOCUMENT } from '@angular/common';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { MlvTaskboardColumn, MlvTaskboardKey } from '../taskboard.types';
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

  it('restores a virtual cell scroll offset after the next render', async () => {
    const { fixture, host } = await mount();
    const cell = host.querySelector('.mlv-taskboard__cards') as HTMLElement;

    fixture.componentInstance.board().restore({
      columnIds: ['todo', 'done'],
      collapsedColumnIds: [],
      collapsedSwimlaneIds: [],
      selectedIds: [],
      cellScrollPositions: { 'string:todo|undefined': 24 },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(cell.scrollTop).toBe(24);
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
