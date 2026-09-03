import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_DATE_LOCALE } from '@malva-ui/core/date';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type Sortable from 'sortablejs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MlvSchedulerCanChange,
  MlvSchedulerEvent,
  MlvSchedulerEventChange,
  MlvSchedulerExternalDropEvent,
  MlvSchedulerView,
} from '../scheduler/scheduler.types';
import { MlvScheduler } from '../scheduler/scheduler';
import { MlvSchedulerDragService, ghostIdFor } from './scheduler-drag.service';

const m = (day: number, h = 0, min = 0) => new Date(2031, 2, day, h, min);

/**
 * SortableJS 1.15's `_prepareGroup` replaces the `group` option we pass at init with this shape — the raw
 * `pull`/`put` functions are gone, only their canonical, always-callable `checkPull`/`checkPut` wrappers remain.
 */
interface NormalizedGroup {
  readonly name: string;
  readonly checkPut: (
    to: Sortable,
    from: Sortable,
    dragEl: HTMLElement,
    event?: Sortable.SortableEvent,
  ) => boolean;
}

@Component({
  imports: [MlvScheduler],
  template: `
    <mlv-scheduler
      [(events)]="events"
      [view]="view()"
      [date]="date"
      [editable]="editable()"
      [canMove]="canMove()"
      (eventMove)="moves.push($event)"
      (externalDrop)="drops.push($event)"
    />
  `,
})
class HostComponent {
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'a', title: 'A', start: m(4, 9), end: m(4, 11) },
    { id: 'bar', title: 'Bar', start: m(3), end: m(6), allDay: true },
    {
      id: 'pinned',
      title: 'Pinned',
      start: m(5, 14),
      end: m(5, 15),
      draggable: false,
    },
  ]);
  readonly view = signal<MlvSchedulerView>('week');
  readonly date = m(4);
  readonly editable = signal(true);
  readonly canMove = signal<MlvSchedulerCanChange | null>(null);
  readonly moves: MlvSchedulerEventChange[] = [];
  readonly drops: MlvSchedulerExternalDropEvent[] = [];
}

function rect(
  top: number,
  left: number,
  width: number,
  height: number,
): DOMRect {
  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('MlvSchedulerDragService', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let root: HTMLElement;
  let drag: MlvSchedulerDragService<Date>;
  let rtlService: MlvRtlService;

  const chip = (id: string) =>
    root.querySelector<HTMLElement>(
      `.mlv-scheduler-event[data-event-id="${id}"]`,
    )!;
  const column = (dayIndex: number) =>
    root.querySelector<HTMLElement>(
      `.mlv-scheduler-time-grid__column[data-day-index="${dayIndex}"]`,
    )!;
  const allDayLanes = (dayIndex: number) =>
    root.querySelector<HTMLElement>(
      `.mlv-scheduler-time-grid__all-day-cell[data-day-index="${dayIndex}"] .mlv-scheduler-time-grid__all-day-lanes`,
    )!;

  const sortableEvent = (
    item: HTMLElement,
    from: HTMLElement,
    to: HTMLElement,
    extra: Partial<Sortable.SortableEvent> = {},
  ) =>
    ({
      item,
      from,
      to,
      clone: item,
      oldIndex: 0,
      newIndex: 0,
      ...extra,
    }) as unknown as Sortable.SortableEvent;
  const moveEvent = (dragged: HTMLElement, to: HTMLElement) =>
    ({
      dragged,
      to,
      from: dragged.parentElement,
      related: to,
      willInsertAfter: false,
    }) as unknown as Sortable.MoveEvent;
  const pointer = (x: number, y: number) =>
    new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideMlvI18nTesting(),
        { provide: MLV_DATE_LOCALE, useValue: 'en-US' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    root = fixture.nativeElement;
    drag = fixture.debugElement
      .query(By.directive(MlvScheduler))
      .injector.get(MlvSchedulerDragService);
    rtlService = TestBed.inject(MlvRtlService);
    // A 24 h column that is 960 px tall → 40 px per hour, starting at y = 100.
    for (let i = 0; i < 7; i++) {
      vi.spyOn(column(i), 'getBoundingClientRect').mockReturnValue(
        rect(100, 100 + i * 120, 120, 960),
      );
    }
  });

  // `setDirection` is global state (MlvRtlService is `providedIn: 'root'`) — always reset it, per
  // .claude/rules/rtl.md, so a flip in one test can never leak into the next.
  afterEach(() => rtlService.setDirection('ltr'));

  it('registers every drop list with SortableJS and refuses foreign items when not editable', () => {
    const list = column(1);
    expect(list.hasAttribute('data-mlv-scheduler-list')).toBe(true);
    const sortable = drag.sortableFor(list)!;
    expect(sortable).toBeTruthy();
    // SortableJS normalises `group` at init: `option('group')` is
    // `{ name, checkPull, checkPut, revertClone }` — there is no `put` on the
    // live instance, only the canonical `checkPut` SortableJS derived from it.
    const group = sortable.option('group') as unknown as NormalizedGroup;
    expect(group.checkPut(sortable, sortable, chip('a'))).toBe(true);
    host.editable.set(false);
    fixture.detectChanges();
    expect(group.checkPut(sortable, sortable, chip('a'))).toBe(false);
  });

  it('previews a timed move into another column at the snapped pointer time and renders a ghost chip', () => {
    const a = chip('a');
    drag.handleStart(sortableEvent(a, column(1), column(1)), {
      x: 280,
      y: 460,
    });
    fixture.detectChanges();
    expect(root.querySelector('.mlv-scheduler')!.classList).toContain(
      'mlv-scheduler--dragging',
    );

    // Pointer at y = 100 + 10.5 h * 40 px → 10:30 on Friday (dayIndex 4); snap is 30 min.
    expect(drag.handleMove(moveEvent(a, column(4)), pointer(600, 520))).toBe(
      false,
    );
    const preview = drag.preview()!;
    expect(preview.eventId).toBe('a');
    expect(preview.next.start).toEqual(m(7, 10, 30));
    expect(preview.next.end).toEqual(m(7, 12, 30));
    expect(preview.next.allDay).toBe(false);

    fixture.detectChanges();
    const ghost = chip(ghostIdFor('a'));
    expect(ghost.classList).toContain('mlv-scheduler-event--ghost');
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.getAttribute('tabindex')).toBe('-1');
    expect(
      ghost
        .closest('.mlv-scheduler-time-grid__column')
        ?.getAttribute('data-day-index'),
    ).toBe('4');
    expect(chip('a')).toBeTruthy(); // the source chip is still rendered
  });

  it('commits the previewed move on end, emits eventMove and swallows the trailing click', () => {
    const a = chip('a');
    drag.handleStart(sortableEvent(a, column(1), column(1)), {
      x: 280,
      y: 460,
    });
    drag.handleMove(moveEvent(a, column(4)), pointer(600, 520));
    drag.handleEnd(sortableEvent(a, column(1), column(1)));
    fixture.detectChanges();

    expect(host.events().find((e) => e.id === 'a')).toMatchObject({
      start: m(7, 10, 30),
      end: m(7, 12, 30),
    });
    expect(host.moves).toHaveLength(1);
    expect(host.moves[0].source).toBe('pointer');
    expect(host.moves[0].previous.start).toEqual(m(4, 9));
    expect(drag.preview()).toBeNull();
    expect(root.querySelector('.mlv-scheduler')!.classList).not.toContain(
      'mlv-scheduler--dragging',
    );
    expect(
      root.querySelector(`[data-event-id="${ghostIdFor('a')}"]`),
    ).toBeNull();

    const clicks: unknown[] = [];
    fixture.debugElement
      .query(By.directive(MlvScheduler))
      .componentInstance.eventClick.subscribe((e: unknown) => clicks.push(e));
    chip('a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks).toHaveLength(0);
    chip('a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks).toHaveLength(1);
  });

  it('drops on its own cell at its own time without committing', () => {
    const a = chip('a');
    drag.handleStart(sortableEvent(a, column(1), column(1)), {
      x: 280,
      y: 460,
    });
    // `a` is Tue 4 Mar 09:00-11:00 = dayIndex 1. Target dayIndex 1 at y = 460
    // -> (460 - 100) / 960 * 1440 = 540 min = 09:00 - the event's own cell at
    // its own time, so `_changed()` is false and nothing commits.
    drag.handleMove(moveEvent(a, column(1)), pointer(280, 460));
    expect(drag.preview()!.next).toEqual({
      start: m(4, 9),
      end: m(4, 11),
      allDay: false,
    });
    drag.handleEnd(sortableEvent(a, column(1), column(1)));
    expect(host.moves).toHaveLength(0);
    expect(host.events().find((e) => e.id === 'a')).toMatchObject({
      start: m(4, 9),
      end: m(4, 11),
    });
  });

  it('commits a move to a different column of the same week', () => {
    const a = chip('a');
    drag.handleStart(sortableEvent(a, column(1), column(1)), {
      x: 280,
      y: 460,
    });
    // dayIndex 2 = Wed 5 Mar, y = 460 -> 09:00; the 2 h duration is kept.
    drag.handleMove(moveEvent(a, column(2)), pointer(400, 460));
    expect(drag.preview()!.next).toEqual({
      start: m(5, 9),
      end: m(5, 11),
      allDay: false,
    });
    drag.handleEnd(sortableEvent(a, column(1), column(1)));
    fixture.detectChanges();
    expect(host.moves).toHaveLength(1);
    expect(host.events().find((e) => e.id === 'a')).toMatchObject({
      start: m(5, 9),
      end: m(5, 11),
    });
  });

  it('cancels with Escape', () => {
    const a = chip('a');
    drag.handleStart(sortableEvent(a, column(1), column(1)), {
      x: 280,
      y: 460,
    });
    drag.handleMove(moveEvent(a, column(4)), pointer(600, 520));
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(drag.preview()).toBeNull();
    drag.handleEnd(sortableEvent(a, column(1), column(1)));
    expect(host.moves).toHaveLength(0);
    expect(host.events().find((e) => e.id === 'a')!.start).toEqual(m(4, 9));
  });

  it('keeps the grabbed day of a multi-day bar under the pointer (grab offset)', () => {
    const bar = chip('bar'); // Mon 3 → Wed 5 inclusive, span 3, rendered in the Monday lane (dayIndex 0)
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(
      rect(40, 100, 360, 20),
    );
    for (let i = 0; i < 7; i++) {
      vi.spyOn(allDayLanes(i), 'getBoundingClientRect').mockReturnValue(
        rect(40, 100 + i * 120, 120, 20),
      );
    }
    // Grab on the second day of the bar (x inside 220..340) → grabDayOffset 1.
    drag.handleStart(sortableEvent(bar, allDayLanes(0), allDayLanes(0)), {
      x: 300,
      y: 50,
    });
    // Hover the Saturday lane (dayIndex 5) → the bar should start on Friday (dayIndex 4).
    drag.handleMove(moveEvent(bar, allDayLanes(5)), pointer(720, 50));
    expect(drag.preview()!.next).toEqual({
      start: m(7),
      end: m(10),
      allDay: true,
    });
  });

  it('mirrors the grab-day offset of a multi-day bar in RTL', () => {
    rtlService.setDirection('rtl');
    const bar = chip('bar'); // Mon 3 → Wed 5 inclusive, span 3, rendered in the Monday lane (dayIndex 0)
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(
      rect(40, 100, 360, 20),
    );
    for (let i = 0; i < 7; i++) {
      vi.spyOn(allDayLanes(i), 'getBoundingClientRect').mockReturnValue(
        rect(40, 100 + i * 120, 120, 20),
      );
    }
    // Same physical pointer x (140) as would give grabDayOffset 0 in LTR
    // (offset = pointer.x - rect.left = 40 -> floor(40/120) = 0). In RTL the
    // offset is read from the bar's right edge instead: rect.right (460) -
    // pointer.x (140) = 320 -> floor(320/120) = 2, clamped to span - 1 = 2 -
    // the mirror image of the LTR result for the same physical position. A
    // sign regression on the RTL branch would collapse this back to 0.
    drag.handleStart(sortableEvent(bar, allDayLanes(0), allDayLanes(0)), {
      x: 140,
      y: 50,
    });
    // Hover the Saturday lane (dayIndex 5) → dayIndex 5 - grabDayOffset 2 = Thursday (dayIndex 3).
    drag.handleMove(moveEvent(bar, allDayLanes(5)), pointer(720, 50));
    expect(drag.preview()!.next).toEqual({
      start: m(6),
      end: m(9),
      allDay: true,
    });
  });

  it('turns a timed event dropped on the all-day row into an all-day event and back', () => {
    const a = chip('a');
    drag.handleStart(sortableEvent(a, column(1), column(1)), {
      x: 280,
      y: 460,
    });
    drag.handleMove(moveEvent(a, allDayLanes(1)), pointer(220, 50));
    expect(drag.preview()!.next).toEqual({
      start: m(4),
      end: m(5),
      allDay: true,
    });
    drag.handleEnd(sortableEvent(a, column(1), column(1)));
    fixture.detectChanges();
    expect(host.events().find((e) => e.id === 'a')!.allDay).toBe(true);

    const moved = chip('a');
    drag.handleStart(sortableEvent(moved, allDayLanes(1), allDayLanes(1)), {
      x: 220,
      y: 50,
    });
    drag.handleMove(moveEvent(moved, column(2)), pointer(340, 100 + 8 * 40));
    expect(drag.preview()!.next).toEqual({
      start: m(5, 8),
      end: m(5, 9),
      allDay: false,
    }); // defaultEventDuration 60
  });

  it('respects canMove vetoes on drop', () => {
    host.canMove.set(() => false);
    fixture.detectChanges();
    const a = chip('a');
    drag.handleStart(sortableEvent(a, column(1), column(1)), {
      x: 280,
      y: 460,
    });
    drag.handleMove(moveEvent(a, column(4)), pointer(600, 520));
    drag.handleEnd(sortableEvent(a, column(1), column(1)));
    expect(host.moves).toHaveLength(0);
    expect(host.events().find((e) => e.id === 'a')!.start).toEqual(m(4, 9));
  });

  it('marks non-draggable chips so the SortableJS filter skips them', () => {
    expect(chip('pinned').getAttribute('data-draggable')).toBe('false');
    expect(drag.sortableFor(column(1))!.option('filter')).toBe(
      '[data-draggable="false"]',
    );
  });

  it('returns a foreign item to its list and emits externalDrop', () => {
    const foreignList = document.createElement('ul');
    const first = document.createElement('li');
    const foreign = document.createElement('li');
    foreign.textContent = 'external';
    foreignList.append(first, foreign);
    document.body.appendChild(foreignList);
    const target = column(2);
    target.appendChild(foreign); // what SortableJS does on drop

    drag.handleAdd(
      sortableEvent(foreign, foreignList, target, { oldIndex: 1 }),
      { x: 340, y: 100 + 13 * 40 },
    );
    expect(foreignList.children[1]).toBe(foreign);
    expect(target.contains(foreign)).toBe(false);
    expect(host.drops).toHaveLength(1);
    expect(host.drops[0]).toMatchObject({
      element: foreign,
      start: m(5, 13),
      end: m(5, 14),
      allDay: false,
    });
    foreignList.remove();
  });

  it('destroys SortableJS instances with the view', () => {
    const list = column(1);
    const sortable = drag.sortableFor(list)!;
    const destroy = vi.spyOn(sortable, 'destroy');
    host.view.set('month');
    fixture.detectChanges();
    expect(destroy).toHaveBeenCalled();
    expect(drag.sortableFor(list)).toBeNull();
  });
});
