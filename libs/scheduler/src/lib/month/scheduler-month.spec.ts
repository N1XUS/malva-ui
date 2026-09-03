import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { MLV_DATE_LOCALE, MlvNativeDateAdapter } from '@malva-ui/core/date';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvScheduler } from '../scheduler/scheduler';
import type {
  MlvSchedulerEvent,
  MlvSchedulerEventInteraction,
  MlvSchedulerMoreClickEvent,
  MlvSchedulerSlotEvent,
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

// March 2031: the 1st is a Saturday, so the grid opens with five outside days
// and "today" is never inside the range (no wall-clock dependence).
const m = (day: number, h = 0, min = 0, month = 2) =>
  new Date(2031, month, day, h, min);

@Component({
  imports: [MlvScheduler],
  template: `
    <mlv-scheduler
      [(events)]="events"
      view="month"
      [(date)]="date"
      [hiddenDays]="hiddenDays()"
      (slotClick)="slotClicks.push($event)"
      (eventClick)="eventClicks.push($event)"
      (moreClick)="moreClicks.push($event)"
    />
  `,
})
class Host {
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'span', title: 'Offsite', start: m(3), end: m(6), allDay: true }, // Mon 3 – Wed 5
    { id: 't1', title: 'A', start: m(4, 9), end: m(4, 10) },
    { id: 't2', title: 'B', start: m(4, 11), end: m(4, 12) },
    { id: 't3', title: 'C', start: m(4, 13), end: m(4, 14) },
    { id: 't4', title: 'D', start: m(4, 15), end: m(4, 16) },
  ]);
  readonly date = signal(m(10));
  readonly hiddenDays = signal<number[]>([]);
  readonly slotClicks: MlvSchedulerSlotEvent[] = [];
  readonly eventClicks: MlvSchedulerEventInteraction[] = [];
  readonly moreClicks: MlvSchedulerMoreClickEvent[] = [];
}

describe('MlvSchedulerMonth', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;
  let adapter: MlvNativeDateAdapter;
  let rtl: MlvRtlService;

  const cell = (dayIndex: number) =>
    root.querySelector<HTMLElement>(
      `[data-day-index="${dayIndex}"][data-minutes="all-day"]`,
    )!;
  const tabbable = () =>
    Array.from(
      root.querySelectorAll<HTMLElement>(
        '.mlv-scheduler-month__cell[tabindex="0"]',
      ),
    );
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
    root = fixture.nativeElement.querySelector('mlv-scheduler-month');
    adapter = TestBed.inject(MlvNativeDateAdapter);
    rtl = TestBed.inject(MlvRtlService);
  });
  afterEach(() => rtl.setDirection('ltr'));

  it('renders weekday headers, six week rows and labelled cells; outside days are dimmed', () => {
    const headers = root.querySelectorAll('[role="columnheader"]');
    expect(headers.length).toBe(7);
    expect(headers[0].textContent?.trim()).toBe('Mon');
    expect(
      root.querySelector('[role="grid"]')?.getAttribute('aria-label'),
    ).toBe('Month view, March 2031');
    expect(root.querySelectorAll('.mlv-scheduler-month__row').length).toBe(6);
    expect(root.querySelectorAll('.mlv-scheduler-month__cell').length).toBe(42);
    expect(cell(0).classList).toContain('mlv-scheduler-month__cell--outside'); // Mon 24 Feb
    expect(cell(5).classList).not.toContain(
      'mlv-scheduler-month__cell--outside',
    ); // Sat 1 Mar
    expect(cell(5).getAttribute('aria-label')).toBe(adapter.getDateLabel(m(1)));
    expect(
      cell(5)
        .querySelector('.mlv-scheduler-month__day-number')
        ?.textContent?.trim(),
    ).toBe('1');
  });

  it('places the spanning bar in its start cell and collapses overflow into "+N more"', () => {
    // Visible lanes fall back to 3 in jsdom → threshold 2: lanes 0 and 1 render, the rest hide.
    const monday = cell(7); // Mon 3 Mar
    const bar = monday.querySelector<HTMLElement>('[data-event-id="span"]')!;
    expect(bar).not.toBeNull();
    expect(bar.style.getPropertyValue('--mlv-scheduler-span')).toBe('3');
    expect(bar.style.getPropertyValue('--mlv-scheduler-lane')).toBe('1');
    expect(bar.classList).toContain('mlv-scheduler-month__event--spanning');
    const tuesday = cell(8);
    expect(tuesday.querySelector('[data-event-id="span"]')).toBeNull();
    expect(
      tuesday
        .querySelector<HTMLElement>('[data-event-id="t1"]')
        ?.style.getPropertyValue('--mlv-scheduler-lane'),
    ).toBe('2');
    expect(tuesday.querySelector('[data-event-id="t2"]')).toBeNull();
    const more = tuesday.querySelector<HTMLButtonElement>(
      '.mlv-scheduler-month__more',
    )!;
    expect(more.textContent?.trim()).toBe('+3 more');
    expect(more.getAttribute('aria-label')).toBe(
      `3 more events on ${adapter.getDateLabel(m(4))}`,
    );
    expect(more.style.getPropertyValue('--mlv-scheduler-lane')).toBe('3');
  });

  it('opens the overflow popover listing every event of that day, emits moreClick and closes on Escape', async () => {
    const more = cell(8).querySelector<HTMLButtonElement>(
      '.mlv-scheduler-month__more',
    )!;
    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const popover = document.querySelector<HTMLElement>(
      '.mlv-scheduler-month__popover',
    )!;
    expect(popover).not.toBeNull();
    expect(popover.querySelectorAll('[data-event-id]').length).toBe(5);
    expect(host.moreClicks.length).toBe(1);
    expect(host.moreClicks[0].events.map((e) => e.id)).toEqual([
      't2',
      't3',
      't4',
    ]);
    expect(host.moreClicks[0].date).toEqual(m(4));
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.mlv-scheduler-month__popover')).toBeNull();
  });

  it('keeps one roving tab stop, starting on the first day of the month', () => {
    expect(tabbable().map((c) => c.dataset['dayIndex'])).toEqual(['5']);
    cell(5).focus();
    key(cell(5), 'ArrowRight');
    expect(tabbable().map((c) => c.dataset['dayIndex'])).toEqual(['6']);
    expect(document.activeElement).toBe(cell(6));
    key(cell(6), 'ArrowDown');
    expect(document.activeElement).toBe(cell(13));
    key(cell(13), 'Home');
    expect(document.activeElement).toBe(cell(7));
    key(cell(7), 'End');
    expect(document.activeElement).toBe(cell(13));
    key(cell(13), 'Home', { ctrlKey: true });
    expect(document.activeElement).toBe(cell(0));
    key(cell(0), 'End', { ctrlKey: true });
    expect(document.activeElement).toBe(cell(41));
  });

  it('mirrors horizontal arrows in RTL and keeps vertical ones', () => {
    rtl.setDirection('rtl');
    fixture.detectChanges();
    cell(6).focus();
    key(cell(6), 'ArrowLeft');
    expect(document.activeElement).toBe(cell(7));
    key(cell(7), 'ArrowUp');
    expect(document.activeElement).toBe(cell(0));
  });

  it('navigates when an arrow leaves the visible range and focuses the target date', async () => {
    cell(0).focus();
    key(cell(0), 'ArrowLeft'); // Sun 23 Feb → February 2031
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.date()).toEqual(m(23, 0, 0, 1));
    const focused = document.activeElement as HTMLElement;
    expect(focused.getAttribute('aria-label')).toBe(
      adapter.getDateLabel(m(23, 0, 0, 1)),
    );
    key(focused, 'PageDown'); // back to March, same day-of-month logic: 23 Mar
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.date()).toEqual(m(23));
    expect(
      (document.activeElement as HTMLElement).getAttribute('aria-label'),
    ).toBe(adapter.getDateLabel(m(23)));
  });

  it('emits slotClick on Space / click / Enter on an empty cell, and Enter focuses the first chip of a busy cell', () => {
    const empty = cell(10); // Thu 6 Mar
    key(empty, ' ');
    empty.click();
    key(empty, 'Enter');
    expect(host.slotClicks.length).toBe(3);
    expect(host.slotClicks[0]).toMatchObject({
      date: m(6),
      allDay: true,
      element: empty,
    });
    expect(host.slotClicks[0].nativeEvent).toBeInstanceOf(KeyboardEvent);
    const busy = cell(8);
    busy.focus();
    key(busy, 'Enter');
    expect(document.activeElement).toBe(
      busy.querySelector('[data-event-id="t1"]'),
    );
    expect(host.slotClicks.length).toBe(3);
  });

  it('does not emit slotClick for a click that landed on a chip', () => {
    const chip = cell(8).querySelector<HTMLElement>('[data-event-id="t1"]')!;
    chip.click();
    expect(host.eventClicks.length).toBe(1);
    expect(host.slotClicks.length).toBe(0);
  });

  it('drops hidden weekdays from every row', () => {
    host.hiddenDays.set([0, 6]);
    fixture.detectChanges();
    expect(root.querySelectorAll('[role="columnheader"]').length).toBe(5);
    expect(
      root
        .querySelectorAll('.mlv-scheduler-month__row')[0]
        .querySelectorAll('.mlv-scheduler-month__cell').length,
    ).toBe(5);
    expect(root.querySelector('[data-event-id="span"]')).not.toBeNull();
  });

  it('passes axe', async () => {
    const results = await axe.run(root, {
      runOnly: { type: 'rule', values: AXE_RULES },
    });
    expect(results.violations).toEqual([]);
  });
});
