import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { MLV_DATE_LOCALE, MlvNativeDateAdapter } from '@malva-ui/core/date';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvScheduler } from '../scheduler/scheduler';
import { scrollOffsetFor } from './scheduler-time-grid';
import type {
  MlvSchedulerEvent,
  MlvSchedulerRangeSelectEvent,
  MlvSchedulerSlotEvent,
  MlvSchedulerView,
} from '../scheduler/scheduler.types';

const AXE_RULES = [
  'aria-allowed-attr',
  'aria-allowed-role',
  'aria-conditional-attr',
  'aria-hidden-focus',
  'aria-prohibited-attr',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'aria-roles',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'button-name',
  'duplicate-id-aria',
  'nested-interactive',
  'tabindex',
];

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
      [slotDuration]="30"
      [businessHours]="{ start: '09:00', end: '17:00' }"
      [showCurrentTime]="showNow()"
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
  readonly showNow = signal(true);
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
    root.querySelector<HTMLElement>(
      `[data-day-index="${dayIndex}"][data-minutes="${minutes}"]`,
    )!;
  const allDayCell = (dayIndex: number) =>
    root.querySelector<HTMLElement>(
      `[data-day-index="${dayIndex}"][data-minutes="all-day"]`,
    )!;
  const chip = (id: string) =>
    root.querySelector<HTMLElement>(`[data-event-id="${id}"]`)!;
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
    expect(
      root.querySelector('[role="grid"]')?.getAttribute('aria-label'),
    ).toMatch(/^Week view, /);
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
    expect(slot(1, 570).classList).toContain(
      'mlv-scheduler-time-grid__slot--business',
    );
    expect(slot(1, 480).classList).not.toContain(
      'mlv-scheduler-time-grid__slot--business',
    );
    expect(slot(6, 570).classList).not.toContain(
      'mlv-scheduler-time-grid__slot--business',
    ); // Sunday
    expect(
      root
        .querySelector('.mlv-scheduler-time-grid__column')
        ?.getAttribute('role'),
    ).toBe('row');
    expect(slot(1, 570).getAttribute('role')).toBe('gridcell');
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
    const firstSlot = root.querySelector<HTMLElement>(
      '.mlv-scheduler-time-grid__slot',
    )!;
    Object.defineProperty(firstSlot, 'offsetHeight', {
      value: 40,
      configurable: true,
    });
    const viewport = root.querySelector<HTMLElement>(
      '.mlv-scrollbar__viewport',
    )!;
    const scheduler = fixture.debugElement.children[0]
      .componentInstance as MlvScheduler;
    scheduler.scrollToTime('10:00');
    fixture.detectChanges();
    expect(viewport.scrollTop).toBe(800);
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

    it('does nothing when not selectable', () => {
      host.selectable.set(false);
      fixture.detectChanges();
      slot(1, 540).dispatchEvent(pointerEvent('pointerdown', 10, 10));
      slot(1, 630).dispatchEvent(pointerEvent('pointermove', 10, 80));
      slot(1, 630).dispatchEvent(pointerEvent('pointerup', 10, 80));
      expect(host.ranges).toHaveLength(0);
    });
  });

  it('passes axe', async () => {
    const results = await axe.run(root, {
      runOnly: { type: 'rule', values: AXE_RULES },
    });
    expect(results.violations).toEqual([]);
  });
});
