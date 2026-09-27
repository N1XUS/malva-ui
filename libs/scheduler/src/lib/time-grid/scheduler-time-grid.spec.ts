import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { compile } from 'sass';
import Sortable from 'sortablejs';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { MLV_DATE_LOCALE, MlvNativeDateAdapter } from '@malva-ui/core/date';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvScheduler } from '../scheduler/scheduler';
import { MLV_SCHEDULER_CONTEXT } from '../scheduler/scheduler-context';
import { MlvSchedulerDragService } from '../drag/scheduler-drag.service';
import { TOUCH_GESTURE_DELAY } from '../drag/scheduler-pointer';
import { createSchedulerTestContext } from '../testing/scheduler-test-context';
import { MlvSchedulerTimeGrid, scrollOffsetFor } from './scheduler-time-grid';
import type {
  MlvSchedulerEvent,
  MlvSchedulerRangeSelectEvent,
  MlvSchedulerSlotEvent,
  MlvSchedulerView,
} from '../scheduler/scheduler.types';
import { focused, present, query } from '../testing/scheduler-test-dom';

// Week of Mon 3 – Sun 9 March 2031 (never "today").
const m = (day: number, h = 0, min = 0) => new Date(2031, 2, day, h, min);

@Component({
  imports: [MlvScheduler],
  template: `
    <mlv-scheduler
      [(events)]="events"
      [(view)]="view"
      [(date)]="date"
      [minTime]="minTime()"
      [maxTime]="maxTime()"
      [slotDuration]="slotDuration()"
      [businessHours]="businessHours()"
      [showCurrentTime]="showNow()"
      [scrollToCurrentTime]="scrollToNow()"
      [selectable]="selectable()"
      (slotClick)="slotClicks.push($event)"
      (rangeSelect)="ranges.push($event)"
    />
  `,
})
class Host {
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'a', title: 'A', start: m(4, 9), end: m(4, 11) },
    { id: 'b', title: 'B', start: m(4, 10), end: m(4, 12) },
    { id: 'c', title: 'C', start: m(4, 22), end: m(5, 2) }, // crosses midnight
    { id: 'd', title: 'D', start: m(3), end: m(6), allDay: true }, // all-day row, Mon–Wed
    { id: 'e', title: 'E', start: m(6, 9), end: m(7, 9) }, // 24 h timed → all-day row
  ]);
  readonly view = signal<MlvSchedulerView>('week');
  readonly date = signal(m(4));
  readonly minTime = signal('00:00');
  readonly maxTime = signal('24:00');
  readonly slotDuration = signal(30);
  readonly businessHours = signal<{ start: string; end: string } | null>({
    start: '09:00',
    end: '17:00',
  });
  readonly showNow = signal(true);
  readonly scrollToNow = signal(false);
  readonly selectable = signal(true);
  readonly slotClicks: MlvSchedulerSlotEvent[] = [];
  readonly ranges: MlvSchedulerRangeSelectEvent[] = [];
}

describe('MlvSchedulerTimeGrid', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;
  let adapter: MlvNativeDateAdapter;
  let rtl: MlvRtlService;

  const slot = (dayIndex: number, minutes: number) =>
    query<HTMLElement>(
      root,
      `[data-day-index="${dayIndex}"][data-minutes="${minutes}"]`,
    );
  const allDayCell = (dayIndex: number) =>
    query<HTMLElement>(
      root,
      `[data-day-index="${dayIndex}"][data-minutes="all-day"]`,
    );
  /** The focused slot as `dayIndex@minutes`, so a miss names the slot it landed on. */
  const focusedSlot = () => {
    const { dayIndex, minutes } = focused().dataset;
    return `${dayIndex}@${minutes}`;
  };
  const chip = (id: string) =>
    query<HTMLElement>(root, `[data-event-id="${id}"]`);
  /**
   * The scheduler's polite live regions — siblings of the grid, so query the
   * fixture root. `MlvScheduler.announce()` alternates between two regions so
   * an identical repeat still reads as a DOM change, so join them rather than
   * reading the first one.
   */
  const liveText = () =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[aria-live]'),
    )
      .map((node) => node.textContent ?? '')
      .join('');
  const key = (
    target: HTMLElement,
    key: string,
    init: KeyboardEventInit = {},
  ) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideMlvI18nTesting(),
        { provide: MLV_DATE_LOCALE, useValue: 'en-US' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    root = fixture.nativeElement.querySelector('mlv-scheduler-time-grid');
    adapter = TestBed.inject(MlvNativeDateAdapter);
    rtl = TestBed.inject(MlvRtlService);
  });
  afterEach(() => rtl.setDirection('ltr'));

  it('renders seven day columns of 48 slots with labels, hour gutter and business shading', () => {
    // The sheet is a labelled group; the all-day band is the only real grid.
    expect(
      root.querySelector('[role="group"]')?.getAttribute('aria-label'),
    ).toMatch(/^Week view, /);
    expect(
      root.querySelector('[role="grid"]')?.getAttribute('aria-label'),
    ).toBe('All day');
    expect(
      root.querySelectorAll('.mlv-scheduler-time-grid__day-header').length,
    ).toBe(7);
    expect(
      root.querySelectorAll('.mlv-scheduler-time-grid__column').length,
    ).toBe(7);
    expect(root.querySelectorAll('.mlv-scheduler-time-grid__slot').length).toBe(
      7 * 48,
    );
    expect(root.querySelectorAll('.mlv-scheduler-time-grid__hour').length).toBe(
      24,
    );
    expect(slot(1, 570).getAttribute('aria-label')).toBe(
      `${adapter.getDateLabel(m(4))}, 9:30 AM`,
    );
    // Shading marks the hours OUTSIDE the window (09:00–17:00 Mon–Fri here).
    expect(slot(1, 570).classList).not.toContain(
      'mlv-scheduler-time-grid__slot--outside-business',
    );
    expect(slot(1, 480).classList).toContain(
      'mlv-scheduler-time-grid__slot--outside-business',
    );
    expect(slot(6, 570).classList).toContain(
      'mlv-scheduler-time-grid__slot--outside-business',
    ); // Sunday
    // The body is day-major, so it is exposed as one multi-select listbox per
    // day rather than as rows of a grid whose columnheaders are days — those
    // headers head the all-day band, not the transposed body.
    expect(
      root
        .querySelector('.mlv-scheduler-time-grid__column')
        ?.getAttribute('role'),
    ).toBe('presentation');
    const listbox = query(root, '.mlv-scheduler-time-grid__slots');
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.getAttribute('aria-multiselectable')).toBe('true');
    expect(listbox.getAttribute('aria-label')).toBe(adapter.getDateLabel(m(3)));
    expect(slot(1, 570).getAttribute('role')).toBe('option');
    // The chip overlay is a presentational layer, not a contentless 49th cell.
    expect(
      root
        .querySelector('.mlv-scheduler-time-grid__events')
        ?.getAttribute('role'),
    ).toBe('presentation');
  });

  it('shades nothing and keeps the today tint when businessHours is unset', () => {
    // `null` is the documented default and means "no shading" — with the
    // modifier on every slot the whole grid read as out-of-hours and the
    // today column's tint was painted over everywhere.
    host.businessHours.set(null);
    fixture.detectChanges();
    expect(
      root.querySelectorAll('.mlv-scheduler-time-grid__slot--outside-business')
        .length,
    ).toBe(0);
  });

  it('measures percentages against the RENDERED rows, not the named span', () => {
    // 08:00–17:30 at 60-minute slots renders ceil(570 / 60) = 10 rows = 600
    // minutes. Dividing by the 570-minute span put the 17:00 label at 94.7%
    // of a 600-minute box — half a row below the line it annotates.
    host.minTime.set('08:00');
    host.maxTime.set('17:30');
    host.slotDuration.set(60);
    fixture.detectChanges();
    const hours = Array.from(
      root.querySelectorAll<HTMLElement>('.mlv-scheduler-time-grid__hour'),
    );
    expect(hours).toHaveLength(10);
    expect(hours[9].style.getPropertyValue('--mlv-scheduler-offset')).toBe(
      '90%',
    ); // (1020 − 480) / 600
    expect(root.querySelectorAll('.mlv-scheduler-time-grid__slot').length).toBe(
      7 * 10,
    );
  });

  it('isolates the hour label from the surrounding bidi context', () => {
    // "8 AM" is a digit run plus a Latin run; inside an RTL paragraph the two
    // reorder to "AM 8" unless the label is its own bidi isolate.
    expect(
      root.querySelector('.mlv-scheduler-time-grid__hour > bdi'),
    ).not.toBeNull();
  });

  it('positions timed chips by minutes and clusters overlaps side by side', () => {
    const a = chip('a');
    const b = chip('b');
    const v = (el: HTMLElement, name: string) =>
      el.style.getPropertyValue(name);
    expect(v(a, '--mlv-scheduler-event-top')).toBe('37.5%'); // 9:00 of 24 h
    expect(parseFloat(v(a, '--mlv-scheduler-event-height'))).toBeCloseTo(
      8.3333,
      3,
    ); // 2 h of 24 h
    expect(v(a, '--mlv-scheduler-event-width')).toBe('50%');
    expect(v(a, '--mlv-scheduler-event-start')).toBe('0%');
    expect(v(b, '--mlv-scheduler-event-start')).toBe('50%');
    expect(
      a
        .closest('.mlv-scheduler-time-grid__column')
        ?.getAttribute('data-day-index'),
    ).toBe('1');
  });

  it('splits a cross-midnight event into two clipped segments and clips to minTime / maxTime', () => {
    const segments = root.querySelectorAll<HTMLElement>('[data-event-id="c"]');
    expect(segments.length).toBe(2);
    expect(segments[0].classList).toContain(
      'mlv-scheduler-event--continues-after',
    );
    expect(segments[1].classList).toContain(
      'mlv-scheduler-event--continues-before',
    );
    host.minTime.set('08:00');
    host.maxTime.set('18:00');
    fixture.detectChanges();
    expect(root.querySelectorAll('.mlv-scheduler-time-grid__slot').length).toBe(
      7 * 20,
    );
    expect(root.querySelectorAll('[data-event-id="c"]').length).toBe(0);
    expect(chip('a').style.getPropertyValue('--mlv-scheduler-event-top')).toBe(
      '10%',
    ); // (9:00 − 8:00) / 10 h
  });

  it('routes all-day and ≥ 24 h events into the all-day row lanes', () => {
    const monday = allDayCell(0);
    expect(monday.querySelector('[data-event-id="d"]')).not.toBeNull();
    expect(
      monday
        .querySelector<HTMLElement>('[data-event-id="d"]')
        ?.style.getPropertyValue('--mlv-scheduler-span'),
    ).toBe('3');
    expect(allDayCell(3).querySelector('[data-event-id="e"]')).not.toBeNull();
    expect(
      root.querySelector(
        '.mlv-scheduler-time-grid__column [data-event-id="e"]',
      ),
    ).toBeNull();
    expect(
      root
        .querySelector('.mlv-scheduler-time-grid__all-day-label')
        ?.textContent?.trim(),
    ).toBe('All day');
  });

  it('renders the day view as a single column and hides the now-line when today is not visible', () => {
    host.view.set('day');
    fixture.detectChanges();
    expect(
      root.querySelectorAll('.mlv-scheduler-time-grid__column').length,
    ).toBe(1);
    expect(root.querySelector('.mlv-scheduler-time-grid__now')).toBeNull();
    host.date.set(adapter.today());
    fixture.detectChanges();
    expect(root.querySelector('.mlv-scheduler-time-grid__now')).not.toBeNull();
    host.showNow.set(false);
    fixture.detectChanges();
    expect(root.querySelector('.mlv-scheduler-time-grid__now')).toBeNull();
  });

  it('computes the scroll offset and writes it to the scrollbar viewport on scrollToTime', () => {
    expect(scrollOffsetFor(8 * 60, 0, 30, 40)).toBe(640);
    expect(scrollOffsetFor(8 * 60, 7 * 60, 30, 40)).toBe(80);
    expect(scrollOffsetFor(5 * 60, 7 * 60, 30, 40)).toBe(0);
    // G12: the headroom lifts the target row off the top edge of the viewport
    // so the half-hour above it stays visible…
    expect(scrollOffsetFor(8 * 60, 0, 30, 40, 10)).toBe(630);
    // …and is clamped away at the very top rather than scrolling negative.
    expect(scrollOffsetFor(0, 0, 30, 40, 10)).toBe(0);
    const firstSlot = query<HTMLElement>(
      root,
      '.mlv-scheduler-time-grid__slot',
    );
    Object.defineProperty(firstSlot, 'offsetHeight', {
      value: 40,
      configurable: true,
    });
    const viewport = query<HTMLElement>(root, '.mlv-scrollbar__viewport');
    const scheduler = fixture.debugElement.children[0]
      .componentInstance as MlvScheduler;
    scheduler.scrollToTime('10:00');
    fixture.detectChanges();
    expect(viewport.scrollTop).toBe(800);
  });

  it('keeps scrollToTime top-aligned while scrollToCurrentTime is on', async () => {
    // The centring is the INITIAL scroll only: an explicit `scrollToTime` still
    // puts the named minute at the top, whatever the input says.
    host.scrollToNow.set(true);
    await fixture.whenStable();
    const firstSlot = query<HTMLElement>(
      root,
      '.mlv-scheduler-time-grid__slot',
    );
    Object.defineProperty(firstSlot, 'offsetHeight', {
      value: 40,
      configurable: true,
    });
    const viewport = query<HTMLElement>(root, '.mlv-scrollbar__viewport');
    Object.defineProperty(viewport, 'clientHeight', {
      value: 400,
      configurable: true,
    });
    const scheduler = fixture.debugElement.children[0]
      .componentInstance as MlvScheduler;
    scheduler.scrollToTime('10:00');
    fixture.detectChanges();
    expect(viewport.scrollTop).toBe(800);
  });

  it('keeps a tab stop on a window whose span is not a whole number of slots', () => {
    // 08:30–18:00 at 60 minutes renders 510, 570 … 1050, so the old
    // `maxMinutes − slotDuration` ceiling (1020) named a minute no cell
    // carries: `_focus` moved to a phantom position, nothing took DOM focus
    // and the grid left the tab order entirely.
    host.minTime.set('08:30');
    host.maxTime.set('18:00');
    host.slotDuration.set(60);
    fixture.detectChanges();
    const last = slot(1, 1050);
    expect(last).not.toBeNull();

    last.focus();
    key(last, 'ArrowDown'); // clamps ON the last row, not past it
    expect(document.activeElement).toBe(last);
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);

    key(slot(1, 990), 'ArrowDown'); // the last row is reachable at all
    expect(document.activeElement).toBe(slot(1, 1050));
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);
  });

  it('keeps the roving tab stop through a clock tick', async () => {
    // The clock refreshes `today()` every 60 s and the adapter hands back a
    // NEW date object each time, so with identity equality the tick
    // invalidated the view's default-focus computation and threw away the cell
    // the user had roved to — DOM focus stayed put while its `tabindex` flipped
    // to -1 and today/08:00 became the only tab stop.
    vi.useFakeTimers();
    const own = TestBed.createComponent(Host);
    own.componentInstance.date.set(adapter.today());
    own.detectChanges();
    const ownRoot = own.nativeElement.querySelector(
      'mlv-scheduler-time-grid',
    ) as HTMLElement;
    const cell = query<HTMLElement>(
      ownRoot,
      '[data-day-index="4"][data-minutes="840"]',
    );
    cell.focus();
    own.detectChanges();
    expect(cell.getAttribute('tabindex')).toBe('0');

    await vi.advanceTimersByTimeAsync(60_000);
    own.detectChanges();
    expect(cell.getAttribute('tabindex')).toBe('0');
    expect(ownRoot.querySelectorAll('[tabindex="0"]').length).toBe(1);

    own.destroy();
    vi.useRealTimers();
  });

  it('re-applies the initial scroll on a week ↔ day switch', () => {
    // Both views render from the same `@default` branch, so the component is
    // reused and an `afterNextRender` would never run again — the day view
    // would open wherever the week was left scrolled.
    const firstSlot = query<HTMLElement>(
      root,
      '.mlv-scheduler-time-grid__slot',
    );
    Object.defineProperty(firstSlot, 'offsetHeight', {
      value: 40,
      configurable: true,
    });
    const viewport = query<HTMLElement>(root, '.mlv-scrollbar__viewport');
    viewport.scrollTop = 0;
    host.view.set('day');
    fixture.detectChanges();
    // 09:00 (the business-hours start) at 40px per 30-minute row.
    expect(viewport.scrollTop).toBe(720);
  });

  it('roves focus through slots: vertical by slot, horizontal by day (mirrored in RTL), all-day row above', () => {
    const start = slot(1, 540);
    start.focus();
    key(start, 'ArrowDown');
    expect(document.activeElement).toBe(slot(1, 570));
    key(slot(1, 570), 'ArrowRight');
    expect(document.activeElement).toBe(slot(2, 570));
    key(slot(2, 570), 'Home');
    expect(document.activeElement).toBe(slot(0, 570));
    key(slot(0, 570), 'End');
    expect(document.activeElement).toBe(slot(6, 570));
    key(slot(6, 570), 'End', { ctrlKey: true });
    expect(document.activeElement).toBe(slot(6, 1410));
    key(slot(6, 1410), 'ArrowDown'); // clamps at the last slot
    expect(document.activeElement).toBe(slot(6, 1410));
    key(slot(6, 1410), 'Home', { ctrlKey: true });
    expect(document.activeElement).toBe(slot(0, 0));
    key(slot(0, 0), 'ArrowUp');
    expect(document.activeElement).toBe(allDayCell(0));
    key(allDayCell(0), 'ArrowDown');
    expect(document.activeElement).toBe(slot(0, 0));
    rtl.setDirection('rtl');
    fixture.detectChanges();
    key(slot(0, 0), 'ArrowLeft');
    expect(document.activeElement).toBe(slot(1, 0));
    expect(root.querySelectorAll('[tabindex="0"]').length).toBe(1);
  });

  it('mirrors horizontal arrows under a scoped [dir] while the document stays LTR', async () => {
    (fixture.nativeElement as HTMLElement).setAttribute('dir', 'rtl');
    await fixture.whenStable();
    expect(rtl.direction()).toBe('ltr');
    const start = slot(1, 540);
    start.focus();
    key(start, 'ArrowLeft'); // "next" day on the inline axis under RTL
    expect(focusedSlot()).toBe('2@540');
    key(slot(2, 540), 'ArrowRight');
    expect(focusedSlot()).toBe('1@540');
    key(slot(1, 540), 'ArrowUp'); // the block axis never mirrors
    expect(focusedSlot()).toBe('1@510');
  });

  it('keeps horizontal arrows unmirrored in an LTR island inside an RTL document', async () => {
    rtl.setDirection('rtl');
    (fixture.nativeElement as HTMLElement).setAttribute('dir', 'ltr');
    await fixture.whenStable();
    const start = slot(1, 540);
    start.focus();
    key(start, 'ArrowLeft');
    expect(focusedSlot()).toBe('0@540');
    key(slot(0, 540), 'ArrowDown');
    expect(focusedSlot()).toBe('0@570');
  });

  it('drops a focus request whose target never renders instead of holding it', async () => {
    const scheduler = fixture.debugElement.query(By.css('mlv-scheduler'))
      .componentInstance as MlvScheduler;
    const anchorSlot = slot(1, 540);
    anchorSlot.focus();
    // No chip carries this id, so nothing will ever satisfy the request.
    scheduler.pendingFocus.set({ kind: 'event', id: 'gone' });

    await fixture.whenStable();
    expect(scheduler.pendingFocus()).toBeNull();
    // And it never stole the focus it could not place.
    expect(document.activeElement).toBe(anchorSlot);
  });

  it('navigates a week when the horizontal arrow leaves the range and keeps the slot', async () => {
    slot(6, 600).focus();
    key(slot(6, 600), 'ArrowRight');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.date()).toEqual(m(10));
    expect(document.activeElement).toBe(slot(0, 600));
    key(slot(0, 600), 'PageUp');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.date()).toEqual(m(3));
    expect(document.activeElement).toBe(slot(0, 600));
  });

  it('emits slotClick with the slot start (timed) or the day (all-day) on Space / click / Enter', () => {
    key(slot(1, 570), ' ');
    slot(1, 570).click();
    expect(host.slotClicks.length).toBe(2);
    expect(host.slotClicks[0]).toMatchObject({
      date: m(4, 9, 30),
      allDay: false,
    });
    allDayCell(2).click();
    expect(host.slotClicks[2]).toMatchObject({ date: m(5), allDay: true });
    key(slot(1, 540), 'Enter'); // chip "a" starts here
    expect(document.activeElement).toBe(chip('a'));
    key(slot(1, 300), 'Enter'); // empty
    expect(host.slotClicks.length).toBe(4);
  });

  it('gives every rendered chip a SortableJS instance on its own parent', () => {
    // The assertion the synthetic-callback specs never made: SortableJS starts
    // a drag only from a DIRECT child of its container, so a chip whose parent
    // carries no instance can never be dragged at all (V4 / D0).
    const chips = Array.from(
      root.querySelectorAll<HTMLElement>('mlv-scheduler-event'),
    );
    expect(chips.length).toBeGreaterThan(0);
    for (const chipEl of chips) {
      expect(
        Sortable.get(present(chipEl.parentElement, "the chip's column")),
      ).toBeTruthy();
    }
  });

  describe('pointer range selection', () => {
    const pointerEvent = (type: string, x: number, y: number) =>
      Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
        clientX: x,
        clientY: y,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

    it('selects a range of slots by dragging and emits rangeSelect on release', () => {
      const from = slot(1, 540); // Tue 9:00
      const to = slot(1, 630); // Tue 10:30
      from.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      to.dispatchEvent(pointerEvent('pointermove', 10, 80));
      fixture.detectChanges();
      expect(
        root.querySelectorAll(
          '.mlv-scheduler-time-grid__slot[aria-selected="true"]',
        ),
      ).toHaveLength(4); // 9:00, 9:30, 10:00, 10:30
      to.dispatchEvent(pointerEvent('pointerup', 10, 80));
      expect(host.ranges).toHaveLength(1);
      expect(host.ranges[0]).toEqual({
        start: m(4, 9),
        end: m(4, 11),
        allDay: false,
        source: 'pointer',
      });
      to.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(host.slotClicks).toHaveLength(0); // the trailing click is swallowed
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
    });

    /**
     * jsdom implements no `elementFromPoint`; install one and take it back in
     * `afterEach` rather than at the end of the spec, so a failing assertion
     * cannot leave a stale hit test behind for axe and the scroll specs.
     */
    let restoreHitTest: (() => void) | null = null;
    const stubHitTest = (result: Element) => {
      Object.defineProperty(document, 'elementFromPoint', {
        value: () => result,
        configurable: true,
      });
      restoreHitTest = () =>
        Reflect.deleteProperty(document, 'elementFromPoint');
    };
    afterEach(() => {
      restoreHitTest?.();
      restoreHitTest = null;
      // Same reason: a touch case that fails mid-gesture would otherwise leave
      // the fake timers installed for every later spec in the file.
      vi.useRealTimers();
    });

    it('extends a TOUCH drag past the pressed slot, which keeps the moves', () => {
      // The Pointer Events spec gives a touch pointer implicit capture to the
      // element it went down on, so every `pointermove.target` is the pressed
      // slot no matter where the finger travels. Resolving the head from the
      // target therefore painted one slot and stopped — the mouse gesture two
      // specs up passed the whole time. The head comes from the pointer's
      // POSITION instead.
      vi.useFakeTimers();
      const from = slot(1, 540); // Tue 9:00
      const to = slot(1, 630); // Tue 10:30
      stubHitTest(to);

      from.dispatchEvent(
        Object.assign(pointerEvent('pointerdown', 10, 10), {
          pointerType: 'touch',
        }),
      );
      vi.advanceTimersByTime(TOUCH_GESTURE_DELAY);
      // Target stays the pressed slot; only the coordinates move.
      from.dispatchEvent(
        Object.assign(pointerEvent('pointermove', 10, 80), {
          pointerType: 'touch',
        }),
      );
      fixture.detectChanges();
      expect(
        root.querySelectorAll(
          '.mlv-scheduler-time-grid__slot[aria-selected="true"]',
        ),
      ).toHaveLength(4); // 9:00, 9:30, 10:00, 10:30

      from.dispatchEvent(
        Object.assign(pointerEvent('pointerup', 10, 80), {
          pointerType: 'touch',
        }),
      );
      expect(host.ranges[0]).toEqual({
        start: m(4, 9),
        end: m(4, 11),
        allDay: false,
        source: 'pointer',
      });
    });

    it('spans days: the range runs from the first day/slot to the last day/slot', () => {
      slot(1, 540).dispatchEvent(pointerEvent('pointerdown', 10, 10));
      slot(3, 600).dispatchEvent(pointerEvent('pointermove', 200, 40));
      slot(3, 600).dispatchEvent(pointerEvent('pointerup', 200, 40));
      expect(host.ranges[0]).toEqual({
        start: m(4, 9),
        end: m(6, 10, 30),
        allDay: false,
        source: 'pointer',
      });
    });

    it('orders a backwards multi-day drag by (day, minute), not per component', () => {
      // Press Tue 14:00, release Wed 09:00. The interval is Tue 14:00 →
      // Wed 09:30, not the per-component min/max Tue 09:00 → Wed 14:30: the
      // minute of the EARLIER day starts the range and the minute of the later
      // day ends it, whichever endpoint the pointer went down on.
      slot(1, 840).dispatchEvent(pointerEvent('pointerdown', 200, 300));
      slot(2, 540).dispatchEvent(pointerEvent('pointermove', 300, 40));
      fixture.detectChanges();
      // The paint reads the same bounds, so it moves with the commit.
      expect(slot(1, 840).getAttribute('aria-selected')).toBe('true');
      expect(slot(1, 810).getAttribute('aria-selected')).toBeNull(); // Tue 13:30
      expect(slot(2, 540).getAttribute('aria-selected')).toBe('true');
      expect(slot(2, 570).getAttribute('aria-selected')).toBeNull(); // Wed 09:30
      slot(2, 540).dispatchEvent(pointerEvent('pointerup', 300, 40));
      expect(host.ranges[0]).toEqual({
        start: m(4, 14),
        end: m(5, 9, 30),
        allDay: false,
        source: 'pointer',
      });
    });

    it('still normalizes a same-day upward drag', () => {
      // Tue 14:00 up to Tue 09:00 commits 09:00 → 14:30: with both endpoints on
      // one day the tuple order degenerates to the minute comparison.
      slot(1, 840).dispatchEvent(pointerEvent('pointerdown', 200, 300));
      slot(1, 540).dispatchEvent(pointerEvent('pointermove', 200, 40));
      slot(1, 540).dispatchEvent(pointerEvent('pointerup', 200, 40));
      expect(host.ranges[0]).toEqual({
        start: m(4, 9),
        end: m(4, 14, 30),
        allDay: false,
        source: 'pointer',
      });
    });

    it('selects all-day cells as an all-day range', () => {
      allDayCell(2).dispatchEvent(pointerEvent('pointerdown', 10, 10));
      allDayCell(4).dispatchEvent(pointerEvent('pointermove', 100, 10));
      allDayCell(4).dispatchEvent(pointerEvent('pointerup', 100, 10));
      expect(host.ranges[0]).toEqual({
        start: m(5),
        end: m(8),
        allDay: true,
        source: 'pointer',
      });
    });

    it('treats a press without travel as a click', () => {
      const s = slot(1, 540);
      s.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      s.dispatchEvent(pointerEvent('pointerup', 11, 10));
      s.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(host.ranges).toHaveLength(0);
      expect(host.slotClicks).toHaveLength(1);
    });

    it('paints a multi-day range continuously, not as a rectangle', () => {
      // The committed interval runs Tue 09:00 → Wed 10:30 without a gap, so
      // the paint has to as well: Tuesday down to midnight, Wednesday from
      // midnight up. A rectangle would leave both tails unpainted.
      slot(1, 540).dispatchEvent(pointerEvent('pointerdown', 10, 10));
      slot(2, 600).dispatchEvent(pointerEvent('pointermove', 200, 40));
      fixture.detectChanges();
      expect(slot(1, 540).getAttribute('aria-selected')).toBe('true');
      expect(slot(1, 1410).getAttribute('aria-selected')).toBe('true'); // Tue 23:30
      expect(slot(2, 0).getAttribute('aria-selected')).toBe('true'); // Wed 00:00
      expect(slot(2, 600).getAttribute('aria-selected')).toBe('true');
      expect(slot(1, 510).getAttribute('aria-selected')).toBeNull(); // before the start
      expect(slot(2, 630).getAttribute('aria-selected')).toBeNull(); // after the end
    });

    it('abandons a pending selection when the next press lands outside it', () => {
      slot(1, 540).focus();
      key(slot(1, 540), 'ArrowDown', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(2);
      slot(4, 900).dispatchEvent(pointerEvent('pointerdown', 400, 300));
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
    });

    it('swallows the trailing click when Escape cancels a drag mid-gesture', () => {
      // Escape ends the gesture while the finger/button is still down, so the
      // release still fires a native click on the cell the user backed out of.
      const from = slot(1, 540);
      from.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      slot(1, 570).dispatchEvent(pointerEvent('pointermove', 10, 40));
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(2);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      from.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(host.slotClicks).toHaveLength(0);
      expect(host.ranges).toHaveLength(0);
    });

    it('leaves the trailing click alone when the drag painted nothing', () => {
      host.selectable.set(false);
      fixture.detectChanges();
      const s = slot(1, 540);
      s.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      slot(1, 630).dispatchEvent(pointerEvent('pointermove', 10, 80));
      slot(1, 630).dispatchEvent(pointerEvent('pointerup', 10, 80));
      s.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(host.ranges).toHaveLength(0);
      expect(host.slotClicks).toHaveLength(1);
    });

    it('does nothing when not selectable', () => {
      host.selectable.set(false);
      fixture.detectChanges();
      slot(1, 540).dispatchEvent(pointerEvent('pointerdown', 10, 10));
      slot(1, 630).dispatchEvent(pointerEvent('pointermove', 10, 80));
      slot(1, 630).dispatchEvent(pointerEvent('pointerup', 10, 80));
      expect(host.ranges).toHaveLength(0);
    });
  });

  describe('keyboard range selection', () => {
    it('Shift+ArrowDown extends the selection from the focused slot; Enter commits it', async () => {
      const s = slot(1, 540);
      s.focus();
      key(s, 'ArrowDown', { shiftKey: true });
      key(s, 'ArrowDown', { shiftKey: true });
      fixture.detectChanges();
      expect(
        root.querySelectorAll(
          '.mlv-scheduler-time-grid__slot[aria-selected="true"]',
        ),
      ).toHaveLength(3);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(liveText()).toMatch(/9:00.*10:30/); // selectionHint {start, end}
      key(focused(), 'Enter');
      expect(host.ranges[0]).toEqual({
        start: m(4, 9),
        end: m(4, 10, 30),
        allDay: false,
        source: 'keyboard',
      });
    });

    it('Shift+ArrowRight extends across days and Escape clears', () => {
      const s = slot(1, 540);
      s.focus();
      key(s, 'ArrowRight', { shiftKey: true });
      fixture.detectChanges();
      // Continuous, not a 1×2 rectangle: Tue 09:00 → 23:30 (30 cells) plus
      // Wed 00:00 → 09:00 (19), matching the Tue 09:00 → Wed 09:30 interval
      // `Enter` would commit.
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(49);
      key(focused(), 'Escape');
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      expect(host.ranges).toHaveLength(0);
    });

    it('orders a backwards keyboard selection by (day, minute) too', () => {
      // Anchor Wed 09:00, walk the head one day back and then ten slots down:
      // the head (Tue 14:00) is on the EARLIER day, so it starts the range.
      const s = slot(2, 540);
      s.focus();
      key(s, 'ArrowLeft', { shiftKey: true });
      for (let step = 0; step < 10; step++) {
        key(focused(), 'ArrowDown', { shiftKey: true });
      }
      fixture.detectChanges();
      expect(slot(1, 840).getAttribute('aria-selected')).toBe('true');
      expect(slot(1, 810).getAttribute('aria-selected')).toBeNull(); // Tue 13:30
      expect(slot(2, 570).getAttribute('aria-selected')).toBeNull(); // Wed 09:30
      key(focused(), 'Enter');
      expect(host.ranges[0]).toEqual({
        start: m(4, 14),
        end: m(5, 9, 30),
        allDay: false,
        source: 'keyboard',
      });
    });

    it('mirrors the horizontal selection keys in RTL, vertical unchanged', () => {
      rtl.setDirection('rtl');
      fixture.detectChanges();

      slot(1, 540).focus();
      // ArrowLeft is "next" in RTL, so it paints the very interval the LTR
      // ArrowRight case does — Tue 09:00 through Wed 09:30 exclusive.
      key(slot(1, 540), 'ArrowLeft', { shiftKey: true });
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(49);
      key(focused(), 'Enter');
      expect(host.ranges.at(-1)).toEqual({
        start: m(4, 9),
        end: m(5, 9, 30),
        allDay: false,
        source: 'keyboard',
      });

      // ArrowRight is "previous": the head lands on Mon 09:00, one day back.
      fixture.detectChanges();
      key(slot(1, 540), 'ArrowRight', { shiftKey: true });
      key(focused(), 'Enter');
      expect(host.ranges.at(-1)).toEqual({
        start: m(3, 9),
        end: m(4, 9, 30),
        allDay: false,
        source: 'keyboard',
      });

      // The block axis never mirrors: ArrowDown still extends downward.
      fixture.detectChanges();
      key(slot(1, 540), 'ArrowDown', { shiftKey: true });
      key(focused(), 'Enter');
      expect(host.ranges.at(-1)).toEqual({
        start: m(4, 9),
        end: m(4, 10),
        allDay: false,
        source: 'keyboard',
      });
    });

    it('clamps the selection head to the visible range and never moves focus', async () => {
      const s = slot(6, 1410); // Sun 23:30, last slot
      s.focus();
      key(s, 'ArrowDown', { shiftKey: true });
      key(s, 'ArrowRight', { shiftKey: true });
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
      expect(document.activeElement).toBe(s);
      expect(host.ranges).toHaveLength(0);
      await fixture.whenStable();
      fixture.detectChanges();
      // The exclusive end of the last slot is midnight. The hint has to roll to
      // the next day: `withTime(day, 24, 0)` is rejected by the adapter, and the
      // throw would take the announcement — and the rest of the handler — with it.
      expect(liveText()).toMatch(/11:30 PM.*Mar 10, 12:00 AM/);
    });

    it('announces an all-day selection by its inclusive last day', async () => {
      const c = allDayCell(0); // Mon 3 Mar
      c.focus();
      key(c, 'ArrowRight', { shiftKey: true });
      expect(
        root.querySelectorAll(
          '.mlv-scheduler-time-grid__all-day-cell[aria-selected="true"]',
        ),
      ).toHaveLength(2);
      await fixture.whenStable();
      fixture.detectChanges();
      // The hint names Mon → Tue, the *inclusive* span; the range `Enter`
      // commits ends at the exclusive Wed midnight. Both come from the same
      // `_selectionRange()`, so the two can only differ where they mean to.
      expect(liveText()).toContain(
        `${adapter.getDateLabel(m(3))} to ${adapter.getDateLabel(m(4))}`,
      );
      key(focused(), 'Enter');
      expect(host.ranges[0]).toEqual({
        start: m(3),
        end: m(5),
        allDay: true,
        source: 'keyboard',
      });
    });

    it('abandons a pending selection on plain navigation', () => {
      const s = slot(1, 540);
      s.focus();
      key(s, 'ArrowDown', { shiftKey: true });
      key(s, 'ArrowDown', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(3);

      key(s, 'ArrowUp'); // plain navigation: focus 08:30, selection abandoned
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      expect(document.activeElement).toBe(slot(1, 510));

      // Enter activates the focused cell instead of committing the stale range.
      key(slot(1, 510), 'Enter');
      expect(host.ranges).toHaveLength(0);
      expect(host.slotClicks.at(-1)?.date).toEqual(m(4, 8, 30));

      // And the next Shift+Arrow re-anchors on the live focus rather than
      // growing from the abandoned head.
      key(slot(1, 510), 'ArrowDown', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(2);
      expect(slot(1, 540).getAttribute('aria-selected')).toBe('true');
      expect(slot(1, 570).getAttribute('aria-selected')).toBeNull();
    });
  });

  it('Enter focuses a timed chip and Escape returns to the slot that owns it', () => {
    // The timed chip is a sibling of the slots under the column, and the column
    // carries `data-day-index` without `data-minutes` — so the chip resolves its
    // owning cell from its start minute, not from an ancestor.
    const s = slot(1, 540); // Tue 4 Mar 09:00, where event `a` starts
    s.focus();
    key(s, 'Enter');
    expect(document.activeElement).toBe(chip('a'));

    const escape = key(chip('a'), 'Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(s);
  });

  it('Tab cycles the timed chips of the focused column', () => {
    chip('a').focus();
    const tab = key(chip('a'), 'Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(chip('b'));

    const back = key(chip('b'), 'Tab', { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(chip('a'));

    // `c` (22:00 → past midnight) is the column's last chip; Tab off it leaves
    // the grid natively.
    expect(key(chip('c'), 'Tab').defaultPrevented).toBe(false);
  });

  it('passes axe', async () => {
    await expectNoAxeViolations(root, {
      // NARROWED, not clean: `empty-table-header` (best-practice, minor)
      // fires on every
      // `.mlv-scheduler-time-grid__day-header[role="columnheader"]`. The
      // header's visible "Mon"/"3" spans carry `aria-hidden="true"` so the
      // columnheader is announced from its `aria-label` ("Monday, March 3,
      // 2031") instead of the abbreviation, which leaves axe's subtree text
      // empty.
      //
      // PERMANENT, and not a scheduler defect: the rule's whole check list
      // is `any: ['has-visible-text']` (axe-core 4.12.1, `axe.js:32321`).
      // Unlike its sibling `empty-heading`, whose `any` also accepts
      // `aria-label` / `aria-labelledby` / `title`, it has no way to see an
      // accessible name — so a correctly named columnheader with an
      // `aria-hidden` subtree cannot pass it however the grid is written.
      // Nothing to fix here and nothing to follow up: no issue is owed.
      rules: { 'empty-table-header': { enabled: false } },
    });
  });
});

/**
 * The initial scroll reads the wall clock straight off the adapter, so these
 * cases pin `adapter.now()` rather than leaning on the context's `nowMinutes`.
 * 10:17 is deliberately NOT a slot boundary: a snapped target is a different
 * number, which is what makes the "exact minute" contract falsifiable.
 */
@Component({
  imports: [MlvSchedulerTimeGrid],
  template: `<mlv-scheduler-time-grid />`,
})
class ScrollHost {}

describe('MlvSchedulerTimeGrid initial scroll', () => {
  let fixture: ComponentFixture<ScrollHost>;
  let ctx: ReturnType<typeof createSchedulerTestContext>;
  let root: HTMLElement;
  let viewport: HTMLElement;

  /**
   * jsdom lays nothing out: feed the effect a 40 px slot row (30 minutes), a
   * 400 px viewport and a sticky day-header band of `topPx` (0 = as if absent).
   * Re-run after a change that re-creates the first row.
   */
  const measure = (topPx = 0) => {
    Object.defineProperty(
      query<HTMLElement>(root, '.mlv-scheduler-time-grid__slot'),
      'offsetHeight',
      { value: 40, configurable: true },
    );
    Object.defineProperty(viewport, 'clientHeight', {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(
      query<HTMLElement>(root, '.mlv-scheduler-time-grid__top'),
      'offsetHeight',
      { value: topPx, configurable: true },
    );
  };

  /** Pins the adapter clock to today at `h:min` — the only clock the scroll reads. */
  const pinClock = (h: number, min: number) => {
    const adapter = ctx.context.adapter;
    vi.spyOn(adapter, 'now').mockReturnValue(
      adapter.withTime(adapter.today(), h, min),
    );
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScrollHost],
      providers: [
        provideMlvI18nTesting(),
        { provide: MLV_DATE_LOCALE, useValue: 'en-US' },
        MlvSchedulerDragService,
        {
          provide: MLV_SCHEDULER_CONTEXT,
          useFactory: () => (ctx = createSchedulerTestContext()).context,
        },
      ],
    }).compileComponents();
    // The grid registers its drop lists as it renders, so the engine must be
    // bound to the fake context before the first pass — the root does this.
    TestBed.inject(MlvSchedulerDragService).attach(
      TestBed.inject(MLV_SCHEDULER_CONTEXT),
    );
    fixture = TestBed.createComponent(ScrollHost);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
    viewport = query<HTMLElement>(root, '.mlv-scrollbar__viewport');
  });

  afterEach(() => vi.restoreAllMocks());

  it('centres the exact current minute in the visible region when scrollToCurrentTime is on', async () => {
    measure(100);
    pinClock(10, 17);
    ctx.scrollToCurrentTime.set(true);
    await fixture.whenStable();
    // 10:17 is 617 minutes, i.e. 617 / 30 × 40 = 822.67 px down — the exact
    // minute, not 10:00 snapped down to a row (which would be 800). Half the
    // VISIBLE region is given back: the day-header band is sticky INSIDE the
    // scroller and covers the top 100 px of the 400 px viewport, so the centre
    // of what the user can see sits (400 + 100) / 2 = 250 px down, not 200.
    expect(viewport.scrollTop).toBeCloseTo((617 / 30) * 40 - 250, 5);
  });

  it('falls back to the top-aligned default when now is outside the window', async () => {
    // 10:17 sits above a 00:00–09:00 window. Asserted on the max side because
    // it is the one that discriminates: with a minTime above 10:17 the clamped
    // centre AND the clamped default both land on the first row (0).
    ctx.maxMinutes.set(9 * 60);
    await fixture.whenStable();
    measure();
    pinClock(10, 17);
    ctx.scrollToCurrentTime.set(true);
    await fixture.whenStable();
    // 08:00 top-aligned (640), not 09:00 centred (520).
    expect(viewport.scrollTop).toBe(640);
  });

  it('re-applies the fallback when maxTime narrows below the current time', async () => {
    measure();
    pinClock(10, 17);
    ctx.scrollToCurrentTime.set(true);
    await fixture.whenStable();
    expect(viewport.scrollTop).toBeCloseTo((617 / 30) * 40 - 200, 5);
    // Narrowing the far bound past `now` must re-run the effect and take the
    // documented fallback, exactly as narrowing the near one does.
    ctx.maxMinutes.set(9 * 60);
    await fixture.whenStable();
    expect(viewport.scrollTop).toBe(640); // 08:00 top-aligned
  });

  it('re-centres on a week to day switch', async () => {
    measure();
    pinClock(10, 17);
    ctx.scrollToCurrentTime.set(true);
    await fixture.whenStable();
    viewport.scrollTop = 0;
    ctx.view.set('day');
    await fixture.whenStable();
    expect(viewport.scrollTop).toBeCloseTo((617 / 30) * 40 - 200, 5);
  });

  it('lets a scrollToTime issued in the same tick win over the initial scroll', async () => {
    measure();
    pinClock(10, 17);
    ctx.scrollToCurrentTime.set(true);
    await fixture.whenStable();
    // One tick, both triggers: the view switch re-arms the initial scroll while
    // the consumer asks for 14:00. Same-phase `afterRenderEffect`s run in
    // registration order, so the explicit request has to be the later writer.
    ctx.view.set('day');
    ctx.scrollRequest.set({ time: '14:00', sequence: 1 });
    await fixture.whenStable();
    expect(viewport.scrollTop).toBe(1120); // 14:00 top-aligned
  });

  it('does not let a past scrollToTime win over a later axis change', async () => {
    measure();
    ctx.scrollRequest.set({ time: '14:00', sequence: 1 });
    await fixture.whenStable();
    expect(viewport.scrollTop).toBe(1120); // 14:00 top-aligned at 30 min rows

    // The request effect is registered after the initial-scroll one so that it
    // wins a same-tick race. Widening the rows re-runs the initial scroll; the
    // request must NOT come along for the ride, or every later `minTime` /
    // `maxTime` / `slotDuration` change would land back on 14:00 instead of
    // the documented initial offset. Two things keep it out: the request is
    // consumed on apply, and the effect tracks nothing but the request itself.
    // (`slotDuration` rather than `minTime` only because the slot list is
    // keyed by minute: the first row survives a pitch change, so the height
    // this fixture measured onto it survives too.)
    ctx.slotDuration.set(60);
    await fixture.whenStable();
    expect(viewport.scrollTop).toBe(320); // 08:00 at 60 min rows, not 560
  });

  it('still honours a scrollToTime issued after an axis change', async () => {
    measure();
    ctx.scrollRequest.set({ time: '14:00', sequence: 1 });
    await fixture.whenStable();
    ctx.slotDuration.set(60);
    await fixture.whenStable();
    // The mirror of the case above: a NEW sequence is a new request and is
    // read outside `untracked`, so it still re-runs the effect.
    ctx.scrollRequest.set({ time: '14:00', sequence: 2 });
    await fixture.whenStable();
    expect(viewport.scrollTop).toBe(560); // 14:00 at 60 min rows
  });

  it('applies a scrollToTime issued before the grid was created, then consumes it', async () => {
    // `scheduler.html` renders the month view from a different branch than
    // week / day, so `setView('week')` + `scrollToTime()` in ONE tick writes
    // both signals before the week grid is constructed. The request is the
    // whole point of that tick, so the grid that appears has to honour it —
    // and then clear it, so no grid built later replays it. The fresh
    // instance's own first render is the case, so the rows have to measure
    // from the moment they exist: `measure()` sizes an element that is already
    // in the DOM, which is one render too late here.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains('mlv-scheduler-time-grid__slot')
          ? 40
          : 0;
      },
    );
    // The switch destroys the outgoing branch before the incoming one exists;
    // two live grids sharing one context is not a state the app can reach, and
    // the first would consume the request before the second ever saw it.
    fixture.destroy();
    ctx.scrollRequest.set({ time: '14:00', sequence: 1 });

    const later = TestBed.createComponent(ScrollHost);
    later.detectChanges();
    await later.whenStable();
    const laterViewport = query<HTMLElement>(
      later.nativeElement as HTMLElement,
      '.mlv-scrollbar__viewport',
    );
    // The 14:00 the consumer asked for, not the documented initial scroll
    // (08:00 top-aligned, 640).
    expect(laterViewport.scrollTop).toBe(1120);
    // Consumed on apply: nothing is left for a later grid to replay.
    expect(ctx.scrollRequest()).toBeNull();

    // And a second request goes through the same cycle.
    ctx.scrollRequest.set({ time: '09:00', sequence: 2 });
    await later.whenStable();
    expect(laterViewport.scrollTop).toBe(720); // 09:00 at 30 min rows
    expect(ctx.scrollRequest()).toBeNull();
  });

  it('never reads the context clock, so it cannot cache a stale minute', async () => {
    // `nowMinutes` only ticks while `showCurrentTime` is on; a grid that read it
    // would cache whatever minute it first saw and re-centre that forever.
    const stale = vi.spyOn(ctx.context, 'nowMinutes');
    measure();
    pinClock(10, 17);
    ctx.scrollToCurrentTime.set(true);
    await fixture.whenStable();
    expect(stale).not.toHaveBeenCalled();
  });
});

// jsdom paints nothing and models no text selection, so the parts of the
// pointer contract that live purely in CSS are asserted on the compiled text.
describe('MlvSchedulerTimeGrid styles', () => {
  let css: string;

  beforeAll(() => {
    // Joined at runtime so Vite's asset rewrite never turns the stylesheet
    // path into an http(s) URL under jsdom (same trick as compare.spec).
    css = stripCssLayersFromText(
      compile(
        fileURLToPath(
          new URL(['.', 'scheduler-time-grid.scss'].join('/'), import.meta.url),
        ),
      ).css,
    );
  });

  /** Declarations of every rule with exactly this selector, joined. */
  function block(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = [
      ...css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g')),
    ];
    if (matches.length === 0) {
      throw new Error(`No rule found for "${selector}" in:\n${css}`);
    }
    return matches.map((match) => match[1]).join('\n');
  }

  it('suppresses native text selection while a range-drag crosses the sheet', () => {
    // A drag runs over the hour gutter, the day headers and the "All day"
    // rowheader; without this the browser highlight smears across the grid on
    // top of the selected-cell paint. It must sit on the sheet, not on a
    // `--selecting` modifier: a class set once the drag threshold is crossed
    // arrives after the browser has already started selecting.
    expect(block('.mlv-scheduler-time-grid__sheet')).toMatch(
      /user-select:\s*none/,
    );
  });

  it('keeps touch panning native on BOTH axes of the sheet', () => {
    // The week sheet is wider than its scroller on a narrow screen, so
    // `pan-y` alone made the hidden days unreachable by touch. Range
    // selection arms on a press instead (`touchDelay`), not on movement.
    expect(block('.mlv-scheduler-time-grid__sheet')).toMatch(
      /touch-action:\s*pan-x pan-y pinch-zoom/,
    );
  });

  it('sizes an all-day spanning bar in cell pitches, not in its own padded box', () => {
    // `100%` is the `__all-day-lanes` content box: one cell pitch MINUS the
    // cell's two inline paddings and its inline-start border. The bar has to
    // add that gap back once per crossed boundary, and the terms it adds must
    // be the very declarations the cell uses (jsdom lays nothing out, so the
    // formula itself is the subject).
    const cellRule = block('.mlv-scheduler-time-grid__all-day-cell');
    expect(cellRule).toMatch(/padding:\s*var\(--mlv-spacing-1\)/);
    expect(cellRule).toMatch(
      /border-inline-start:\s*var\(--mlv-stroke-width\)/,
    );
    const bar = block('.mlv-scheduler-time-grid__lane-event--spanning').replace(
      /\s+/g,
      ' ',
    );
    expect(bar).toContain('100% * var(--mlv-scheduler-span, 1)');
    expect(bar).toContain(
      '(var(--mlv-scheduler-span, 1) - 1) * (2 * var(--mlv-spacing-1) + var(--mlv-stroke-width))',
    );
  });

  it('gives a selected all-day cell a channel the today fill cannot hide', () => {
    // `--mlv-background-selected` IS `--mlv-background-accent-1-pale` in both
    // themes — exactly what `--today` paints — so the fill alone showed
    // nothing at all when the selection covered today.
    expect(block('.mlv-scheduler-time-grid__all-day-cell--selected')).toMatch(
      /box-shadow:\s*inset[^;]*var\(--mlv-background-accent-1\)/,
    );
  });

  it('keeps the row separators visible inside the out-of-hours band', () => {
    // `--mlv-background-sunken` and `--mlv-border-subtle` are the same palette
    // step in the light theme, so the default separator disappears under the
    // shading; the shaded rows step up one border token.
    expect(block('.mlv-scheduler-time-grid__slot')).toMatch(
      /border-block-end:\s*var\(--mlv-stroke-width\) solid var\(--mlv-border-subtle\)/,
    );
    const shaded = block('.mlv-scheduler-time-grid__slot--outside-business');
    expect(shaded).toMatch(/background:\s*var\(--mlv-background-sunken\)/);
    expect(shaded).toMatch(
      /border-block-end-color:\s*var\(--mlv-border-normal\)/,
    );
  });
});

// A timed chip is positioned by the GRID, but it is an `mlv-scheduler-event`
// whose own block sets `position: relative` — the containing block its resize
// handles need. Both rules live in `mlv.components`, so at equal specificity
// the cascade falls through to source order, and Angular injects a component's
// stylesheet the first time an instance renders: the grid's sheet lands before
// the chip's, so `relative` used to win. Every chip then stayed in normal flow
// and `inset-block-start` offset it from its preceding siblings instead of
// from the column — the second chip of a column painted one chip-height too
// low, and a drag preview inserted mid-list shoved its later siblings around.
//
// jsdom cannot judge this: its `getComputedStyle` resolves the cascade by
// DOCUMENT ORDER ALONE (a `.b` rule appended after a `#t` rule wins there), so
// it reports the defect whether or not it is fixed. The cascade is therefore
// resolved here over the compiled sheets — jsdom still answers `matches()`,
// which is the part it does implement — and asserted in BOTH injection orders,
// because that independence is exactly what winning on specificity buys.
describe('MlvSchedulerTimeGrid chip placement cascade', () => {
  let sheets: Record<'grid' | 'chip', readonly StyleRule[]>;
  let fixtureEl: HTMLElement;

  interface StyleRule {
    readonly selectors: readonly string[];
    readonly declarations: string;
  }

  /**
   * A compiled sheet with every `@media` block cut out, braces balanced.
   *
   * The flat `/([^{}]+)\{([^{}]*)\}/` scan below cannot skip one: it never
   * sees the `@media` prelude as a prelude — that text is followed by `{` and
   * then another `{`, so the first match starts at the NESTED rule instead,
   * and a `prelude.includes('@')` guard lets every media-nested rule in at
   * full weight. Cutting the blocks out first is what actually keeps them out.
   */
  function withoutMediaBlocks(css: string): string {
    let out = '';
    let from = 0;
    for (
      let at = css.indexOf('@media');
      at !== -1;
      at = css.indexOf('@media', from)
    ) {
      out += css.slice(from, at);
      const open = css.indexOf('{', at);
      if (open === -1) return out;
      let depth = 0;
      let cursor = open;
      for (; cursor < css.length; cursor++) {
        if (css[cursor] === '{') depth++;
        else if (css[cursor] === '}' && --depth === 0) break;
      }
      from = cursor + 1;
    }
    return out + css.slice(from);
  }

  /**
   * Rules of a compiled sheet, `@media` blocks removed (see
   * `withoutMediaBlocks`): jsdom evaluates no media context, so a nested rule
   * left in would be scored as if its query always matched. That is not
   * hypothetical — both sheets end in a `prefers-reduced-motion` block whose
   * `!important` declarations this harness would happily resolve, and it
   * models no `!important` either. "keeps media-nested rules out of the
   * resolution entirely" below pins the removal.
   */
  function rulesOf(...segments: string[]): readonly StyleRule[] {
    // Joined at runtime so Vite's asset rewrite never turns the stylesheet
    // path into an http(s) URL under jsdom (same trick as `block()` above).
    const css = withoutMediaBlocks(
      stripCssLayersFromText(
        compile(fileURLToPath(new URL(segments.join('/'), import.meta.url)))
          .css,
      ),
    );
    const rules: StyleRule[] = [];
    for (const [, prelude, declarations] of css.matchAll(
      /([^{}]+)\{([^{}]*)\}/g,
    )) {
      if (prelude.includes('@')) continue;
      rules.push({
        selectors: prelude
          .split(',')
          .map((one) => one.trim())
          .filter(Boolean),
        declarations,
      });
    }
    return rules;
  }

  /**
   * Class-and-id weight of a selector. These sheets are class-only, so
   * counting `#` and `.` (and never letting one overflow into the other)
   * ranks them exactly as the real cascade does.
   */
  function specificityOf(selector: string): number {
    const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
    const classes = selector.match(/\.[\w-]+/g)?.length ?? 0;
    return ids * 1000 + classes;
  }

  /**
   * The declared value the cascade gives `property` on `element` when the
   * sheets are injected in `order` — highest specificity wins, ties go to the
   * later declaration, exactly as a browser resolves it.
   *
   * A selector LIST is weighed by its MATCHING members, not by its heaviest
   * member and not by whichever one happens to come first: a browser scores
   * each of `a, .b .c` on its own and keeps the heaviest that matched, so a
   * rule must neither borrow the weight of a sibling selector that missed nor
   * be under-weighed because a lighter member was listed earlier.
   */
  function resolve(
    element: HTMLElement,
    property: string,
    order: readonly (keyof typeof sheets)[],
  ): string | null {
    let winner: { specificity: number; value: string } | null = null;
    for (const name of order) {
      for (const rule of sheets[name]) {
        const matched = rule.selectors.filter((one) => element.matches(one));
        if (!matched.length) continue;
        const declared = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(
          rule.declarations,
        );
        if (!declared) continue;
        const specificity = Math.max(...matched.map(specificityOf));
        if (winner && specificity < winner.specificity) continue;
        winner = { specificity, value: declared[1].trim() };
      }
    }
    return winner?.value ?? null;
  }

  beforeAll(() => {
    sheets = {
      grid: rulesOf('.', 'scheduler-time-grid.scss'),
      chip: rulesOf('..', 'event', 'scheduler-event.scss'),
    };
    fixtureEl = document.createElement('div');
    fixtureEl.innerHTML = `
      <div class="mlv-scheduler-time-grid__events">
        <div
          id="timed"
          class="mlv-scheduler-event mlv-scheduler-time-grid__event mlv-scheduler-event--timed"
        ></div>
        <div
          id="ghost"
          class="mlv-scheduler-event mlv-scheduler-time-grid__event mlv-scheduler-event--timed mlv-scheduler-event--ghost"
        ></div>
      </div>
      <div class="mlv-scheduler-time-grid__all-day-cell">
        <div
          id="lane"
          class="mlv-scheduler-event mlv-scheduler-time-grid__lane-event mlv-scheduler-event--all-day"
        ></div>
      </div>
    `;
    document.body.append(fixtureEl);
  });

  afterAll(() => fixtureEl.remove());

  const positionOf = (
    id: string,
    order: readonly (keyof typeof sheets)[] = ['grid', 'chip'],
  ) => resolve(query<HTMLElement>(document, `#${id}`), 'position', order);

  const pointerEventsOf = (
    id: string,
    order: readonly (keyof typeof sheets)[] = ['grid', 'chip'],
  ) => resolve(query<HTMLElement>(document, `#${id}`), 'pointer-events', order);

  it('takes a timed chip out of flow whichever sheet is injected first', () => {
    // ['grid', 'chip'] is the order Angular actually produces; the reverse
    // proves the rule no longer depends on it.
    expect(positionOf('timed', ['grid', 'chip'])).toBe('absolute');
    expect(positionOf('timed', ['chip', 'grid'])).toBe('absolute');
  });

  it('leaves a lane chip relative, the containing block of its resize handles', () => {
    // The chip block, the grid's `__lane-event` and the month `__event` all
    // say `relative`; only the time grid's own chip layer overrides it.
    expect(positionOf('lane', ['grid', 'chip'])).toBe('relative');
    expect(positionOf('lane', ['chip', 'grid'])).toBe('relative');
  });

  it('leaves the drag ghost un-hit-testable whichever sheet is injected first', () => {
    // The chip layer is `pointer-events: none` so the slots underneath keep
    // their clicks, which is why a real timed chip has to opt back in — and
    // that opt-in is written on the (0,2,0) `__events > __event` selector,
    // which outweighs the chip sheet's own (0,1,0) `--ghost` rule. The drag
    // preview must stay out of hit-testing all the same: the `inert` attribute
    // on its host is a second line of defence, not a reason for the declared
    // `pointer-events: none` to lose.
    expect(pointerEventsOf('ghost', ['grid', 'chip'])).toBe('none');
    expect(pointerEventsOf('ghost', ['chip', 'grid'])).toBe('none');
    expect(pointerEventsOf('timed', ['grid', 'chip'])).toBe('auto');
    expect(pointerEventsOf('timed', ['chip', 'grid'])).toBe('auto');
  });

  it('keeps media-nested rules out of the resolution entirely', () => {
    // Both sheets end in a `prefers-reduced-motion` block whose selector list
    // matches `.mlv-scheduler-event`, and every declaration in it is
    // `!important`. jsdom evaluates no media context, so those rules must not
    // reach the cascade at all — and a `prelude.includes('@')` guard cannot
    // keep them out, because the flat rule scan never sees the `@media`
    // prelude AS a prelude. `animation-iteration-count` is declared nowhere
    // else, so a non-null answer here means a media block leaked in.
    expect(
      resolve(
        query<HTMLElement>(document, '#timed'),
        'animation-iteration-count',
        ['grid', 'chip'],
      ),
    ).toBeNull();
  });
});
