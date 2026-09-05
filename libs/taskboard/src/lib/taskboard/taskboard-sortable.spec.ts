import { DOCUMENT } from '@angular/common';
import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import Sortable from 'sortablejs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MlvTaskboard } from './taskboard';
import type {
  MlvTaskboardBeforeMove,
  MlvTaskboardCanDropFn,
  MlvTaskboardColumn,
  MlvTaskboardHistory,
  MlvTaskboardKey,
  MlvTaskboardMoveCancelReason,
  MlvTaskboardState,
  MlvTaskboardTransition,
} from '../taskboard.types';

interface Ticket {
  readonly id: string;
  readonly status: string;
}

const INITIAL_ITEMS: readonly Ticket[] = [
  { id: 'a', status: 'todo' },
  { id: 'b', status: 'todo' },
  { id: 'x', status: 'done' },
];

const INITIAL_COLUMNS: readonly MlvTaskboardColumn[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'done', label: 'Done' },
];

@Component({
  imports: [MlvTaskboard],
  template: `
    <mlv-taskboard
      [(items)]="items"
      [(columns)]="columns"
      dataKey="id"
      columnField="status"
      [transitions]="transitions()"
      [lockedItemIds]="lockedItemIds()"
      [canDropFn]="canDropFn()"
      [beforeMove]="beforeMove()"
    />
  `,
})
class SortableHost {
  readonly items = signal<readonly Ticket[]>(INITIAL_ITEMS);
  readonly columns = signal<readonly MlvTaskboardColumn[]>(INITIAL_COLUMNS);
  readonly transitions = signal<readonly MlvTaskboardTransition[] | undefined>(
    undefined,
  );
  readonly lockedItemIds = signal<readonly MlvTaskboardKey[] | undefined>(
    undefined,
  );
  readonly canDropFn = signal<MlvTaskboardCanDropFn<Ticket> | undefined>(
    undefined,
  );
  readonly beforeMove = signal<MlvTaskboardBeforeMove<Ticket> | undefined>(
    undefined,
  );
  readonly board = viewChild.required(MlvTaskboard<Ticket>);
}

@Component({
  imports: [MlvTaskboard],
  template: `
    <mlv-taskboard
      [(items)]="firstItems"
      [(columns)]="firstColumns"
      dataKey="id"
      columnField="status"
    />
    <mlv-taskboard
      [(items)]="secondItems"
      [(columns)]="secondColumns"
      dataKey="id"
      columnField="status"
    />
  `,
})
class TwoBoardHost {
  readonly firstItems = signal<readonly Ticket[]>(INITIAL_ITEMS);
  readonly secondItems = signal<readonly Ticket[]>(INITIAL_ITEMS);
  readonly firstColumns =
    signal<readonly MlvTaskboardColumn[]>(INITIAL_COLUMNS);
  readonly secondColumns =
    signal<readonly MlvTaskboardColumn[]>(INITIAL_COLUMNS);
}

interface Recorded {
  readonly moved: string[];
  readonly cancelled: MlvTaskboardMoveCancelReason[];
}

async function createFixture(): Promise<{
  readonly fixture: ComponentFixture<SortableHost>;
  readonly host: HTMLElement;
  readonly recorded: Recorded;
}> {
  await TestBed.configureTestingModule({
    imports: [SortableHost],
  }).compileComponents();
  const fixture = TestBed.createComponent(SortableHost);
  fixture.detectChanges();
  await fixture.whenStable();
  const recorded: Recorded = { moved: [], cancelled: [] };
  const board = fixture.componentInstance.board();
  board.moved.subscribe((result) =>
    recorded.moved.push(
      `${String(result.target.columnId)}:${result.target.index}:${result.items
        .map((item) => item.id)
        .join(',')}`,
    ),
  );
  board.moveCancelled.subscribe((event) =>
    recorded.cancelled.push(event.reason),
  );
  return { fixture, host: fixture.nativeElement as HTMLElement, recorded };
}

function cardsContainer(host: HTMLElement, columnId: string): HTMLElement {
  const container = host.querySelector<HTMLElement>(
    `.mlv-taskboard__cards[data-mlv-taskboard-column-id="${columnId}"]`,
  );
  if (!container) throw new Error(`Expected a cards container for ${columnId}`);
  return container;
}

function columnRow(host: HTMLElement): HTMLElement {
  const row = host.querySelector<HTMLElement>('.mlv-taskboard__column-row');
  if (!row) throw new Error('Expected a rendered column header row.');
  return row;
}

/** The SortableJS group name a registered container was created with. */
function groupNameOf(element: HTMLElement): string | undefined {
  return (sortableFor(element).options.group as Sortable.GroupOptions).name;
}

/** The two `<mlv-taskboard>` elements of a two-board fixture, in order. */
function boardElements(host: HTMLElement): [HTMLElement, HTMLElement] {
  const boards = Array.from(
    host.querySelectorAll<HTMLElement>('mlv-taskboard'),
  );
  const [first, second] = boards;
  if (!first || !second) throw new Error('Expected two rendered taskboards.');
  return [first, second];
}

function sortableFor(element: HTMLElement): Sortable {
  const sortable = Sortable.get(element);
  if (!sortable) {
    throw new Error('Expected a registered taskboard Sortable instance.');
  }
  return sortable;
}

function cardElement(container: HTMLElement, id: string): HTMLElement {
  const card = container.querySelector<HTMLElement>(
    `[data-mlv-taskboard-card-id="${id}"]`,
  );
  if (!card) throw new Error(`Expected a rendered card ${id}`);
  return card;
}

function dragEvent(
  item: HTMLElement,
  from: HTMLElement,
  to: HTMLElement,
  newDraggableIndex?: number,
): Sortable.SortableEvent {
  return {
    item,
    items: [],
    clone: item,
    from,
    to,
    target: to,
    oldIndex: 0,
    newIndex: newDraggableIndex ?? 0,
    oldDraggableIndex: 0,
    newDraggableIndex: newDraggableIndex ?? 0,
    pullMode: true,
    type: 'end',
  } as unknown as Sortable.SortableEvent;
}

function hoverEvent(
  dragged: HTMLElement,
  from: HTMLElement,
  to: HTMLElement,
  related: HTMLElement,
  willInsertAfter: boolean,
): Sortable.MoveEvent {
  return {
    dragged,
    draggedRect: dragged.getBoundingClientRect(),
    from,
    related,
    relatedRect: related.getBoundingClientRect(),
    to,
    willInsertAfter,
    type: 'move',
  } as unknown as Sortable.MoveEvent;
}

function startDrag(source: HTMLElement, card: HTMLElement): void {
  sortableFor(source).options.onStart?.(dragEvent(card, source, source));
}

function hover(
  source: HTMLElement,
  card: HTMLElement,
  to: HTMLElement,
  related: HTMLElement,
  willInsertAfter = false,
): boolean | -1 | 1 | void {
  return sortableFor(source).options.onMove?.(
    hoverEvent(card, source, to, related, willInsertAfter),
    new Event('pointermove'),
  );
}

function endDrag(
  source: HTMLElement,
  card: HTMLElement,
  to: HTMLElement,
  newDraggableIndex?: number,
): void {
  sortableFor(source).options.onEnd?.(
    dragEvent(card, source, to, newDraggableIndex),
  );
}

/**
 * The board's private history ledger. The public undo/redo surface arrives
 * with the keyboard grab feature; until then the ledger is only reachable
 * through the component field it is stored in.
 */
function historyOf(board: MlvTaskboard<Ticket>): MlvTaskboardHistory<Ticket> {
  const ledger = (
    board as unknown as { _history: MlvTaskboardHistory<Ticket> | null }
  )._history;
  if (!ledger) throw new Error('Expected a seeded taskboard history ledger.');
  return ledger;
}

/** Item identifiers of one recorded board state, as a comparable string. */
function boardIds(board: MlvTaskboardState<Ticket> | null): string | null {
  return board === null ? null : board.items.map((item) => item.id).join(',');
}

/** Item identifiers of the controlled collection, as a comparable string. */
function itemIds(fixture: ComponentFixture<SortableHost>): string {
  return fixture.componentInstance
    .items()
    .map((item) => item.id)
    .join(',');
}

/** Drags one card onto the slot before `relatedId` and releases it there. */
async function moveCard(
  fixture: ComponentFixture<SortableHost>,
  host: HTMLElement,
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  relatedId: string,
): Promise<void> {
  const from = cardsContainer(host, fromColumnId);
  const to = cardsContainer(host, toColumnId);
  const card = cardElement(from, cardId);
  startDrag(from, card);
  hover(from, card, to, cardElement(to, relatedId));
  endDrag(from, card, to);
  fixture.detectChanges();
  await fixture.whenStable();
}

function childClasses(container: HTMLElement): string[] {
  return Array.from(container.children).map(
    (child) => child.className.split(' ')[0] ?? '',
  );
}

describe('MlvTaskboard SortableJS card adapter', () => {
  it('registers one private group per rendered cards container with touch-safe fallback mechanics', async () => {
    const { host } = await createFixture();
    const todo = sortableFor(cardsContainer(host, 'todo'));

    // The suffix is per board instance (see the two-board spec below), so the
    // assertion pins the private prefix and that one board shares one group.
    expect(groupNameOf(cardsContainer(host, 'todo'))).toMatch(
      /^mlv-taskboard-cards-\d+$/,
    );
    expect(groupNameOf(cardsContainer(host, 'done'))).toBe(
      groupNameOf(cardsContainer(host, 'todo')),
    );
    expect(todo.options.draggable).toBe('.mlv-taskboard__card');
    expect(todo.options.forceFallback).toBe(true);
    expect(todo.options.fallbackOnBody).toBe(true);
    expect(todo.options.delay).toBe(150);
    expect(todo.options.delayOnTouchOnly).toBe(true);
    expect(todo.options.removeCloneOnHide).toBe(true);
    expect(todo.options.preventOnFilter).toBe(false);
    expect(todo.options.chosenClass).toBe('mlv-taskboard__sortable-chosen');
    expect(todo.options.dragClass).toBe('mlv-taskboard__sortable-drag');
    expect(todo.options.ghostClass).toBe('mlv-taskboard__sortable-ghost');
    expect(todo.options.fallbackClass).toBe('mlv-taskboard__sortable-fallback');
    expect(todo.options.filter).toContain('input');
    expect(todo.options.filter).toContain('[data-mlv-taskboard-no-drag]');
  });

  it('gives each board its own card group so two boards never accept each other', async () => {
    await TestBed.configureTestingModule({
      imports: [TwoBoardHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(TwoBoardHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const [first, second] = boardElements(fixture.nativeElement as HTMLElement);

    // A shared group name would let a card dragged out of one board be put
    // into the other, whose session knows nothing about it — the drop is
    // rejected and the first board emits a spurious `invalid-drop`.
    expect(groupNameOf(cardsContainer(first, 'todo'))).not.toBe(
      groupNameOf(cardsContainer(second, 'todo')),
    );
    expect(groupNameOf(cardsContainer(second, 'todo'))).toBe(
      groupNameOf(cardsContainer(second, 'done')),
    );
    expect(groupNameOf(columnRow(first))).not.toBe(
      groupNameOf(columnRow(second)),
    );
  });

  it('previews the hovered slot, clears the previous one, and never lets Sortable reorder Angular', async () => {
    const { fixture, host } = await createFixture();
    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');
    const beforeItems = fixture.componentInstance.items();

    startDrag(todoCards, card);
    expect(hover(todoCards, card, doneCards, cardElement(doneCards, 'x'))).toBe(
      false,
    );

    expect(doneCards.getAttribute('data-mlv-taskboard-drop-state')).toBe(
      'valid',
    );
    expect(doneCards.contains(card)).toBe(false);
    expect(fixture.componentInstance.items()).toBe(beforeItems);

    expect(hover(todoCards, card, todoCards, card)).toBe(false);
    expect(doneCards.getAttribute('data-mlv-taskboard-drop-state')).toBeNull();
    expect(todoCards.getAttribute('data-mlv-taskboard-drop-state')).toBe(
      'invalid',
    );
    expect(fixture.componentInstance.items()).toBe(beforeItems);
  });

  it('renders one drop indicator at the previewed slot of the hovered container', async () => {
    const { fixture, host } = await createFixture();
    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');

    startDrag(todoCards, card);
    hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(childClasses(doneCards)).toEqual([
      'mlv-taskboard__drop-indicator',
      'mlv-taskboard__card',
    ]);

    hover(todoCards, card, doneCards, cardElement(doneCards, 'x'), true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(childClasses(doneCards)).toEqual([
      'mlv-taskboard__card',
      'mlv-taskboard__drop-indicator',
    ]);
  });

  it('resolves the end-of-list payload to the tail slot, not the first one', async () => {
    const { fixture, host, recorded } = await createFixture();
    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');

    startDrag(todoCards, card);
    // SortableJS's insert-at-end branch reports the container itself as
    // `related` with `willInsertAfter` set whenever the pointer sits over a
    // direct child that is not a card — the live drop indicator is one.
    hover(todoCards, card, doneCards, doneCards, true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(childClasses(doneCards)).toEqual([
      'mlv-taskboard__card',
      'mlv-taskboard__drop-indicator',
    ]);

    endDrag(todoCards, card, doneCards);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(recorded.moved).toEqual(['done:1:b,x,a']);
  });

  it('commits the last previewed slot rather than the container Sortable reports on drop', async () => {
    const { fixture, host, recorded } = await createFixture();
    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');

    startDrag(todoCards, card);
    hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));
    endDrag(todoCards, card, todoCards, 5);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.items().map((item) => item.id)).toEqual([
      'b',
      'a',
      'x',
    ]);
    expect(
      fixture.componentInstance.items().find((item) => item.id === 'a')?.status,
    ).toBe('done');
    expect(recorded.moved).toEqual(['done:0:b,a,x']);
    expect(recorded.cancelled).toEqual([]);
    expect(host.querySelector('.mlv-taskboard__drop-indicator')).toBeNull();
    expect(doneCards.getAttribute('data-mlv-taskboard-drop-state')).toBeNull();
  });

  it('returns the dragged card to Angular and strips every Sortable residue', async () => {
    const { fixture, host } = await createFixture();
    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');
    const sibling = card.nextElementSibling;
    const beforeItems = fixture.componentInstance.items();

    startDrag(todoCards, card);

    // What a real drag leaves on the picked-up node: the engine's four state
    // classes, the inline geometry it writes while the fallback follows the
    // pointer, a `draggable` flag — and, if anything ever defeats the
    // `onMove`-false guard, the node itself inside another container.
    card.classList.add(
      'mlv-taskboard__sortable-chosen',
      'mlv-taskboard__sortable-drag',
      'mlv-taskboard__sortable-ghost',
      'mlv-taskboard__sortable-fallback',
    );
    card.setAttribute('style', 'transform: translate(10px, 20px);');
    card.setAttribute('draggable', 'true');
    doneCards.appendChild(card);

    endDrag(todoCards, card, doneCards);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(card.parentElement).toBe(todoCards);
    expect(card.nextElementSibling).toBe(sibling);
    expect(card.className).toBe('mlv-taskboard__card');
    expect(card.getAttribute('style')).toBeNull();
    expect(card.getAttribute('draggable')).toBeNull();
    expect(fixture.componentInstance.items()).toBe(beforeItems);
  });

  it('emits nothing when the card is dropped back onto its own slot', async () => {
    const { fixture, host, recorded } = await createFixture();
    const todoCards = cardsContainer(host, 'todo');
    const card = cardElement(todoCards, 'a');
    const beforeItems = fixture.componentInstance.items();

    startDrag(todoCards, card);
    hover(todoCards, card, todoCards, card);
    endDrag(todoCards, card, todoCards);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(recorded.moved).toEqual([]);
    expect(recorded.cancelled).toEqual([]);
    expect(fixture.componentInstance.items()).toBe(beforeItems);
  });

  it('cancels the drag when Escape reaches the injected document', async () => {
    const { fixture, host, recorded } = await createFixture();
    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');
    const beforeItems = fixture.componentInstance.items();

    startDrag(todoCards, card);
    hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    endDrag(todoCards, card, doneCards);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(recorded.cancelled).toEqual(['cancelled']);
    expect(recorded.moved).toEqual([]);
    expect(fixture.componentInstance.items()).toBe(beforeItems);
    expect(doneCards.getAttribute('data-mlv-taskboard-drop-state')).toBeNull();
  });

  it.each([
    [
      'a locked destination column',
      (host: SortableHost) =>
        host.columns.set([
          { id: 'todo', label: 'Todo' },
          { id: 'done', label: 'Done', locked: true },
        ]),
    ],
    [
      'a locked source column',
      (host: SortableHost) =>
        host.columns.set([
          { id: 'todo', label: 'Todo', locked: true },
          { id: 'done', label: 'Done' },
        ]),
    ],
    ['a locked card', (host: SortableHost) => host.lockedItemIds.set(['a'])],
    [
      'a rejected transition',
      (host: SortableHost) =>
        host.transitions.set([{ from: 'todo', to: 'todo' }]),
    ],
    [
      'a full destination WIP limit',
      (host: SortableHost) =>
        host.columns.set([
          { id: 'todo', label: 'Todo' },
          { id: 'done', label: 'Done', wipLimit: 1 },
        ]),
    ],
    [
      'a denying canDropFn',
      (host: SortableHost) => host.canDropFn.set(() => false),
    ],
  ])(
    'rejects a drop denied by %s without touching items',
    async (_reason, configure) => {
      const { fixture, host, recorded } = await createFixture();
      configure(fixture.componentInstance);
      fixture.detectChanges();
      await fixture.whenStable();

      const todoCards = cardsContainer(host, 'todo');
      const doneCards = cardsContainer(host, 'done');
      const card = cardElement(todoCards, 'a');
      const beforeItems = fixture.componentInstance.items();

      startDrag(todoCards, card);
      hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));

      expect(doneCards.getAttribute('data-mlv-taskboard-drop-state')).toBe(
        'invalid',
      );

      endDrag(todoCards, card, doneCards);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(recorded.cancelled).toEqual(['invalid-drop']);
      expect(recorded.moved).toEqual([]);
      expect(fixture.componentInstance.items()).toBe(beforeItems);
    },
  );

  it('holds items unchanged while an asynchronous beforeMove is pending and commits once it resolves', async () => {
    const { fixture, host, recorded } = await createFixture();
    let settle: ((accepted: boolean) => void) | undefined;
    fixture.componentInstance.beforeMove.set(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');
    const beforeItems = fixture.componentInstance.items();

    startDrag(todoCards, card);
    hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));
    endDrag(todoCards, card, doneCards);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.items()).toBe(beforeItems);
    expect(recorded.moved).toEqual([]);
    expect(host.querySelector('mlv-taskboard')?.getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(sortableFor(todoCards).options.disabled).toBe(true);

    settle?.(true);
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.items().map((item) => item.id)).toEqual([
      'b',
      'a',
      'x',
    ]);
    expect(recorded.moved).toEqual(['done:0:b,a,x']);
    expect(
      host.querySelector('mlv-taskboard')?.getAttribute('aria-busy'),
    ).toBeNull();
    expect(sortableFor(todoCards).options.disabled).toBe(false);
  });

  it('blocks column drags as well while a guarded move is pending', async () => {
    const { fixture, host } = await createFixture();
    let settle: ((accepted: boolean) => void) | undefined;
    fixture.componentInstance.beforeMove.set(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');

    expect(sortableFor(columnRow(host)).options.disabled).toBe(false);

    startDrag(todoCards, card);
    hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));
    endDrag(todoCards, card, doneCards);
    fixture.detectChanges();
    await fixture.whenStable();

    // A column drag during the pending guard would write `columns`, change the
    // board snapshot, and make the settling move report `stale`.
    expect(sortableFor(columnRow(host)).options.disabled).toBe(true);

    settle?.(true);
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(sortableFor(columnRow(host)).options.disabled).toBe(false);
  });

  it.each([
    ['a synchronous false', () => false, 'before-move-rejected'],
    ['a resolved false', () => Promise.resolve(false), 'before-move-rejected'],
    [
      'a thrown error',
      () => {
        throw new Error('denied');
      },
      'before-move-error',
    ],
    [
      'a rejected promise',
      () => Promise.reject(new Error('denied')),
      'before-move-error',
    ],
  ])(
    'leaves items untouched for %s beforeMove decision',
    async (_reason, beforeMove, expectedReason) => {
      const { fixture, host, recorded } = await createFixture();
      fixture.componentInstance.beforeMove.set(
        beforeMove as MlvTaskboardBeforeMove<Ticket>,
      );
      fixture.detectChanges();
      await fixture.whenStable();

      const todoCards = cardsContainer(host, 'todo');
      const doneCards = cardsContainer(host, 'done');
      const card = cardElement(todoCards, 'a');
      const beforeItems = fixture.componentInstance.items();

      startDrag(todoCards, card);
      hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));
      endDrag(todoCards, card, doneCards);
      await Promise.resolve();
      await Promise.resolve();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(recorded.cancelled).toEqual([expectedReason]);
      expect(recorded.moved).toEqual([]);
      expect(fixture.componentInstance.items()).toBe(beforeItems);
    },
  );

  it('reports a stale move when the controlled items change while beforeMove is pending', async () => {
    const { fixture, host, recorded } = await createFixture();
    let settle: ((accepted: boolean) => void) | undefined;
    fixture.componentInstance.beforeMove.set(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');

    startDrag(todoCards, card);
    hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));
    endDrag(todoCards, card, doneCards);

    const replacement: readonly Ticket[] = [
      { id: 'a', status: 'todo' },
      { id: 'b', status: 'todo' },
    ];
    fixture.componentInstance.items.set(replacement);
    fixture.detectChanges();
    await fixture.whenStable();

    settle?.(true);
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(recorded.cancelled).toEqual(['stale']);
    expect(recorded.moved).toEqual([]);
    expect(fixture.componentInstance.items()).toBe(replacement);
  });

  it('registers and destroys instances as columns are added and removed', async () => {
    const { fixture, host } = await createFixture();
    const removed = cardsContainer(host, 'done');
    expect(Sortable.get(removed)).toBeTruthy();

    fixture.componentInstance.columns.set([
      { id: 'todo', label: 'Todo' },
      { id: 'review', label: 'Review' },
    ]);
    fixture.componentInstance.items.set([
      { id: 'a', status: 'todo' },
      { id: 'b', status: 'todo' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(Sortable.get(cardsContainer(host, 'review'))).toBeTruthy();
    // `destroy()` clears the expando to `null`; an element that was never
    // registered reports `undefined`, so this pins the teardown, not absence.
    expect(Sortable.get(removed)).toBeNull();
  });
});

describe('MlvTaskboard move history ledger', () => {
  it('chains consecutive moves instead of resetting the ledger', async () => {
    const { fixture, host } = await createFixture();
    const initial = itemIds(fixture);

    await moveCard(fixture, host, 'a', 'todo', 'done', 'x');
    const afterFirst = itemIds(fixture);
    await moveCard(fixture, host, 'x', 'done', 'todo', 'b');
    const afterSecond = itemIds(fixture);

    expect([initial, afterFirst, afterSecond]).toEqual([
      'a,b,x',
      'b,a,x',
      'x,b,a',
    ]);

    const history = historyOf(fixture.componentInstance.board());
    expect(boardIds(history.current())).toBe(afterSecond);
    expect(boardIds(history.undo())).toBe(afterFirst);
    expect(boardIds(history.undo())).toBe(initial);
    expect(history.undo()).toBeNull();
    expect(boardIds(history.redo())).toBe(afterFirst);
    expect(boardIds(history.redo())).toBe(afterSecond);
  });

  it('keeps the ledger across a selection change, which is not a board change', async () => {
    const { fixture, host } = await createFixture();
    const initial = itemIds(fixture);

    await moveCard(fixture, host, 'a', 'todo', 'done', 'x');
    fixture.componentInstance.board().selection.set(new Set(['b']));
    fixture.detectChanges();
    await fixture.whenStable();
    await moveCard(fixture, host, 'x', 'done', 'todo', 'b');

    const history = historyOf(fixture.componentInstance.board());
    expect(boardIds(history.undo())).toBe('b,a,x');
    expect(boardIds(history.undo())).toBe(initial);
  });

  it('replaces the ledger when the controlled board changes elsewhere', async () => {
    const { fixture, host } = await createFixture();

    await moveCard(fixture, host, 'a', 'todo', 'done', 'x');
    fixture.componentInstance.items.set([
      { id: 'b', status: 'todo' },
      { id: 'a', status: 'todo' },
      { id: 'x', status: 'done' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const external = itemIds(fixture);

    await moveCard(fixture, host, 'a', 'todo', 'done', 'x');

    const history = historyOf(fixture.componentInstance.board());
    expect(boardIds(history.undo())).toBe(external);
    expect(history.undo()).toBeNull();
  });
});

// Isolated: this suite swaps the `DOCUMENT` provider, so it keeps its own
// TestBed rather than the one every suite above shares.
describe('MlvTaskboard drag document binding', () => {
  afterEach(() => vi.restoreAllMocks());

  /** Counts listeners a target gained (+1) and released (-1), by event type. */
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

  // Under server rendering the injected `DOCUMENT` and the ambient `document`
  // global are different objects and the global is defined, so binding the
  // ambient one would attach a per-render board to a process-wide object no
  // teardown reaches — and nothing would throw. Only asserting *which* object
  // receives the listener can see that.
  it('binds the Escape listener to the injected DOCUMENT, not the ambient global', async () => {
    const isolated = document.implementation.createHTMLDocument('taskboard');
    await TestBed.configureTestingModule({
      imports: [SortableHost],
      providers: [{ provide: DOCUMENT, useValue: isolated }],
    }).compileComponents();
    const fixture = TestBed.createComponent(SortableHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const cancelled: MlvTaskboardMoveCancelReason[] = [];
    fixture.componentInstance
      .board()
      .moveCancelled.subscribe((event) => cancelled.push(event.reason));

    const isolatedNet = trackListeners(isolated);
    const ambientNet = trackListeners(document);
    const todoCards = cardsContainer(host, 'todo');
    const doneCards = cardsContainer(host, 'done');
    const card = cardElement(todoCards, 'a');
    startDrag(todoCards, card);
    hover(todoCards, card, doneCards, cardElement(doneCards, 'x'));

    expect(isolatedNet.get('keydown')).toBeGreaterThan(0);
    expect(ambientNet.get('keydown')).toBeUndefined();

    // Escape on the ambient global must not reach a board bound elsewhere.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    isolated.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    endDrag(todoCards, card, doneCards);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(cancelled).toEqual(['cancelled']);
    // The drag's listener is released with the drag, not left on the document.
    expect(isolatedNet.get('keydown')).toBe(0);

    fixture.destroy();
  });
});
