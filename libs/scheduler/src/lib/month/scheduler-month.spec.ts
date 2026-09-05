import { fileURLToPath } from 'node:url';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import axe from 'axe-core';
import { compile } from 'sass';
import Sortable from 'sortablejs';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { MLV_DATE_LOCALE, MlvNativeDateAdapter } from '@malva-ui/core/date';
import { MlvResizeObserverService, MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvScheduler } from '../scheduler/scheduler';
import type {
  MlvSchedulerEvent,
  MlvSchedulerEventInteraction,
  MlvSchedulerMoreClickEvent,
  MlvSchedulerRangeSelectEvent,
  MlvSchedulerSlotEvent,
} from '../scheduler/scheduler.types';
import { focused, present, query } from '../testing/scheduler-test-dom';

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
      [selectable]="selectable()"
      [showCurrentTime]="showCurrentTime()"
      (slotClick)="slotClicks.push($event)"
      (eventClick)="eventClicks.push($event)"
      (slotDoubleClick)="slotDoubleClicks.push($event)"
      (slotContextMenu)="slotContextMenus.push($event)"
      (eventDoubleClick)="eventDoubleClicks.push($event)"
      (moreClick)="moreClicks.push($event)"
      (rangeSelect)="ranges.push($event)"
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
  readonly selectable = signal(true);
  readonly showCurrentTime = signal(true);
  readonly slotClicks: MlvSchedulerSlotEvent[] = [];
  readonly slotDoubleClicks: MlvSchedulerSlotEvent[] = [];
  readonly slotContextMenus: MlvSchedulerSlotEvent[] = [];
  readonly eventDoubleClicks: MlvSchedulerEventInteraction[] = [];
  readonly eventClicks: MlvSchedulerEventInteraction[] = [];
  readonly moreClicks: MlvSchedulerMoreClickEvent[] = [];
  readonly ranges: MlvSchedulerRangeSelectEvent[] = [];
}

describe('MlvSchedulerMonth', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;
  let adapter: MlvNativeDateAdapter;
  let rtl: MlvRtlService;
  /** Times the month view subscribed the row-size `ResizeObserver`. */
  let observeCount = 0;

  const cell = (dayIndex: number) =>
    query<HTMLElement>(
      root,
      `[data-day-index="${dayIndex}"][data-minutes="all-day"]`,
    );
  const cellFor = (date: Date) => {
    const label = adapter.getDateLabel(date);
    const found = root.querySelector<HTMLElement>(
      `.mlv-scheduler-month__cell[aria-label="${label}"]`,
    );
    if (!found) throw new Error(`no rendered cell labelled "${label}"`);
    return found;
  };
  /** The `+N more` button of a cell; throws when the cell does not overflow. */
  const moreButton = (dayIndex: number) => {
    const found = cell(dayIndex).querySelector<HTMLButtonElement>(
      '.mlv-scheduler-month__more',
    );
    if (!found) throw new Error(`day ${dayIndex} renders no "+N more" button`);
    return found;
  };
  /** A chip inside `container` by event id; throws when it is not rendered. */
  const chip = (container: HTMLElement, eventId: string) => {
    const found = container.querySelector<HTMLElement>(
      `[data-event-id="${eventId}"]`,
    );
    if (!found) throw new Error(`no chip rendered for event "${eventId}"`);
    return found;
  };
  /** The open overflow panel; throws when none is open. */
  const popover = () => {
    const found = document.querySelector<HTMLElement>(
      '.mlv-scheduler-month__popover',
    );
    if (!found) throw new Error('no overflow popover is open');
    return found;
  };
  const scheduler = () =>
    fixture.debugElement.query(By.directive(MlvScheduler))
      .componentInstance as MlvScheduler;
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
    const resizeObserver = TestBed.inject(MlvResizeObserverService);
    const observe = resizeObserver.observe.bind(resizeObserver);
    observeCount = 0;
    vi.spyOn(resizeObserver, 'observe').mockImplementation((target) => {
      // Other components (the toolbar's segmented control) observe too — count
      // only the month view's own week-row container.
      if (
        target instanceof Element &&
        target.classList.contains('mlv-scheduler-month__rows')
      ) {
        observeCount += 1;
      }
      return observe(target);
    });
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
    const bar = query<HTMLElement>(monday, '[data-event-id="span"]');
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
    const more = moreButton(8);
    expect(more.textContent?.trim()).toBe('+3 more');
    // The accessible name is asserted by the WCAG 2.5.3 spec below.
    expect(more.style.getPropertyValue('--mlv-scheduler-lane')).toBe('3');
  });

  it('opens the overflow popover listing every event of that day, emits moreClick and closes on Escape', async () => {
    const more = moreButton(8);
    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(popover().querySelectorAll('[data-event-id]').length).toBe(5);
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

  it('toggles the overflow popover closed from its own trigger', async () => {
    // No backdrop, and the trigger is excluded from the popup service's dismiss
    // listener, so a second press re-enters `_openMore` with the panel still
    // open: without the toggle it closes and immediately reopens, dropping
    // focus on the first panel chip instead of returning it to the button.
    const more = moreButton(8);
    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      document.querySelector('.mlv-scheduler-month__popover'),
    ).not.toBeNull();
    expect(host.moreClicks).toHaveLength(1);

    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.mlv-scheduler-month__popover')).toBeNull();
    expect(document.activeElement).toBe(more);
    // A toggle-close is not an open: `moreClick` means "the button opened its
    // popover".
    expect(host.moreClicks).toHaveLength(1);
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
    const focusedCell = focused();
    expect(focusedCell.getAttribute('aria-label')).toBe(
      adapter.getDateLabel(m(23, 0, 0, 1)),
    );
    key(focusedCell, 'PageDown'); // back to March, same day-of-month logic: 23 Mar
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.date()).toEqual(m(23));
    expect(focused().getAttribute('aria-label')).toBe(
      adapter.getDateLabel(m(23)),
    );
  });

  it('pages onto a rendered weekday when the same day of month is hidden', async () => {
    host.hiddenDays.set([0, 6]);
    host.date.set(m(3, 0, 0, 3)); // Thu 3 Apr 2031
    fixture.detectChanges();
    await fixture.whenStable();
    const thursday = cellFor(m(3, 0, 0, 3));
    thursday.focus();
    key(thursday, 'PageDown'); // 3 May 2031 is a Saturday — not rendered
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.date()).toEqual(m(5, 0, 0, 4)); // Mon 5 May
    expect(focused().getAttribute('aria-label')).toBe(
      adapter.getDateLabel(m(5, 0, 0, 4)),
    );
    key(focused(), 'PageUp'); // 5 Apr is a Saturday
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.date()).toEqual(m(4, 0, 0, 3)); // Fri 4 Apr
    expect(focused().getAttribute('aria-label')).toBe(
      adapter.getDateLabel(m(4, 0, 0, 3)),
    );
  });

  it('clears a focus request no rendered cell can satisfy', async () => {
    scheduler().pendingFocus.set({
      kind: 'cell',
      date: m(1, 0, 0, 8), // September 2031, outside the rendered range
      minutes: null,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scheduler().pendingFocus()).toBeNull();
  });

  it('subscribes the row-size observer once, whatever the events do', async () => {
    expect(observeCount).toBe(1);
    host.events.update((events) => [
      ...events,
      { id: 't5', title: 'E', start: m(4, 17), end: m(4, 18) },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      cell(8).querySelector('.mlv-scheduler-month__more')?.textContent?.trim(),
    ).toBe('+4 more'); // the write did re-render the grid
    expect(observeCount).toBe(1);
  });

  it('re-measures the lane budget when the week-row count changes', async () => {
    // Six same-day events pack lanes 0–5, so "+N more" reads the lane budget
    // back out: 3 lanes → threshold 2 → "+4 more", 4 lanes → "+3 more".
    const crowd = (month: number, day: number) =>
      Array.from({ length: 6 }, (_unused, index) => ({
        id: `${month}-${index}`,
        title: `E${index}`,
        start: m(day, 9 + index, 0, month),
        end: m(day, 10 + index, 0, month),
      }));
    host.events.set([...crowd(2, 4), ...crowd(3, 9)]);
    fixture.detectChanges();
    await fixture.whenStable();
    const more = (date: Date) =>
      cellFor(date)
        .querySelector('.mlv-scheduler-month__more')
        ?.textContent?.trim();
    expect(more(m(4))).toBe('+4 more'); // the un-measured fallback, 3 lanes

    // jsdom reports every box as zero, so `_measureLanes` is inert until the
    // three heights it reads are stubbed. March 2031 spans 6 week rows (row
    // 100 → 3 lanes), April 2031 only 5 (row 120 → 4 lanes) — and the row
    // container keeps its 600px box across that transition, exactly the case
    // no `ResizeObserver` reports.
    const rows = root.querySelector<HTMLElement>('.mlv-scheduler-month__rows');
    if (!rows) throw new Error('no week-row container');
    const offsetHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight',
    );
    if (!offsetHeight) throw new Error('no HTMLElement.prototype.offsetHeight');
    Object.defineProperty(rows, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList.contains('mlv-scheduler-month__lane-probe'))
          return 20;
        if (this.classList.contains('mlv-scheduler-month__day-number'))
          return 24;
        return 0;
      },
    });
    try {
      host.date.set(m(9, 0, 0, 3)); // April 2031 — 5 week rows
      fixture.detectChanges();
      await fixture.whenStable();
      expect(root.querySelectorAll('.mlv-scheduler-month__row').length).toBe(5);
      expect(more(m(9, 0, 0, 3))).toBe('+3 more');

      host.date.set(m(10)); // back to March 2031 — 6 week rows
      fixture.detectChanges();
      await fixture.whenStable();
      expect(root.querySelectorAll('.mlv-scheduler-month__row').length).toBe(6);
      expect(more(m(4))).toBe('+4 more');
    } finally {
      Object.defineProperty(
        HTMLElement.prototype,
        'offsetHeight',
        offsetHeight,
      );
    }
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

  it('Enter focuses the chip in the pressed cell, not the first bar of a multi-row event', async () => {
    // Sat 1 – Wed 4 Mar all-day: `sliceRows` cuts it into one segment per week
    // row, and BOTH bars carry `data-event-id="cross"`. Pressing Enter on a
    // cell of the second row must land on that row's bar — an id-only lookup
    // resolves to the row-0 bar and throws focus into another week.
    host.events.set([
      { id: 'cross', title: 'Trip', start: m(1), end: m(5), allDay: true },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const bars = root.querySelectorAll<HTMLElement>('[data-event-id="cross"]');
    expect(bars).toHaveLength(2);
    expect(bars[0].closest('[data-day-index]')).toBe(cell(5)); // Sat 1 Mar
    const monday = cell(7); // Mon 3 Mar, first day of the second week row
    monday.focus();
    key(monday, 'Enter');
    expect(document.activeElement).toBe(bars[1]);
    expect(document.activeElement?.closest('[data-day-index]')).toBe(monday);
  });

  it('leaves keys that originate on a chip to the chip', () => {
    // The cell's own handler must filter by target rather than trust the chip
    // to stop propagation: a plain ArrowRight on a chip is not a grid move.
    const owner = cell(8);
    owner.focus();
    const chipEl = chip(owner, 't1');
    chipEl.focus();
    key(chipEl, 'ArrowRight');
    expect(document.activeElement).toBe(chipEl);
    expect(tabbable().map((c) => c.dataset['dayIndex'])).toEqual(['8']);
  });

  it('emits slotDoubleClick and slotContextMenu from empty cell space only', () => {
    const empty = cell(10); // Thu 6 Mar
    empty.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    empty.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(host.slotDoubleClicks.map((e) => e.date)).toEqual([m(6)]);
    expect(host.slotContextMenus.map((e) => e.date)).toEqual([m(6)]);

    chip(cell(8), 't1').dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true }),
    );
    expect(host.slotDoubleClicks).toHaveLength(1);
    expect(host.eventDoubleClicks.map((e) => e.event.id)).toEqual(['t1']);
  });

  it('does not emit slotClick for a click that landed on a chip', () => {
    const chipEl = chip(cell(8), 't1');
    chipEl.click();
    expect(host.eventClicks.length).toBe(1);
    expect(host.slotClicks.length).toBe(0);
  });

  it('gates the today highlight on showCurrentTime', async () => {
    // The month has no now-line, so this input is the whole of what
    // `showCurrentTime` means here: ungated, it would be a no-op in this view.
    const highlighted = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>('.mlv-scheduler-month__cell--today'),
      );
    const plainLabel = adapter.getDateLabel(adapter.today());

    host.date.set(adapter.today());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0].getAttribute('aria-label')).toBe(
      `${plainLabel}, today`,
    );

    host.showCurrentTime.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(highlighted()).toHaveLength(0);
    // The ", today" suffix goes with the pill — `cellFor` matches the plain
    // date label, so finding the cell at all is half the assertion.
    expect(cellFor(adapter.today()).getAttribute('aria-label')).toBe(
      plainLabel,
    );
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
        Sortable.get(present(chipEl.parentElement, "the chip's lane")),
      ).toBeTruthy();
    }
  });

  it('registers the overflow popover as a drop list so its chips can be dragged out', async () => {
    // The spec requires the panel's chips to belong to a list of the same
    // Sortable group ("so they can be dragged out"): SortableJS starts a drag
    // only from a DIRECT child of a container that owns an instance, so without
    // this an overflowed event has no pointer move path at all.
    const more = moreButton(8);
    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = popover();
    expect(Sortable.get(panel)).toBeTruthy();
    const chips = Array.from(
      panel.querySelectorAll<HTMLElement>('mlv-scheduler-event'),
    );
    expect(chips.length).toBe(5);
    for (const chipEl of chips) {
      expect(chipEl.parentElement).toBe(panel);
      expect(Sortable.get(panel)).toBeTruthy();
    }
  });

  it('hides the popover while a drag runs and disposes it once the drag settles', async () => {
    const more = moreButton(8);
    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = popover();

    // Closing the panel on drag START would destroy the very SortableJS
    // instance that owns the in-flight drag, and `unregister()` releases such a
    // drag — the chip would snap back the instant it moved. It is hidden
    // instead, which also keeps `elementFromPoint` reaching the grid below.
    scheduler().setDragging(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(popover()).toBe(panel);
    expect(panel.classList).toContain('mlv-scheduler-month__popover--dragging');

    scheduler().setDragging(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.mlv-scheduler-month__popover')).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('re-derives the open popover from the live events instead of a snapshot', async () => {
    const more = moreButton(8);
    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const ids = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '.mlv-scheduler-month__popover [data-event-id]',
        ),
      ).map((el) => el.dataset['eventId']);
    expect(ids()).toEqual(['span', 't1', 't2', 't3', 't4']);

    // An `[(events)]` edit while the panel is open — what a drag commit does.
    host.events.update((events) => events.filter((e) => e.id !== 't3'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(ids()).toEqual(['span', 't1', 't2', 't4']);
  });

  it('declares the grid multi-selectable exactly while selection is enabled', () => {
    // Several cells carry `aria-selected` during a range selection, and a
    // `role="grid"` without `aria-multiselectable` advertises single-select.
    const grid = query<HTMLElement>(root, '[role="grid"]');
    expect(grid.getAttribute('aria-multiselectable')).toBe('true');
    host.selectable.set(false);
    fixture.detectChanges();
    expect(grid.getAttribute('aria-multiselectable')).toBeNull();
  });

  it('names the "+N more" button with its visible label first (WCAG 2.5.3)', () => {
    const more = moreButton(8);
    const visible = present(more.textContent, "the button's text").trim();
    expect(visible).toBe('+3 more');
    expect(more.getAttribute('aria-label')).toBe(
      `${visible}, 3 more events on ${adapter.getDateLabel(m(4))}`,
    );
    expect(more.getAttribute('aria-label')).toContain(visible);
  });

  it('announces the "+N more" popup and its expanded state', async () => {
    const more = moreButton(8);
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.getAttribute('aria-controls')).toBeNull();

    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = popover();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(more.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.id).toBeTruthy();
    // Only the owning cell's button claims the panel.
    const other = cell(7).querySelector('.mlv-scheduler-month__more');
    expect(other?.getAttribute('aria-expanded') ?? 'false').toBe('false');
  });

  it('closes the intra-cell ring from the "+N more" button', () => {
    const owner = cell(8);
    const chipEl = chip(owner, 't1');
    const more = moreButton(8);

    more.focus();
    const back = key(more, 'Tab', { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(chipEl);

    more.focus();
    const escape = key(more, 'Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(owner);
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

    it('selects whole days across rows and emits an all-day range', () => {
      cell(7).dispatchEvent(pointerEvent('pointerdown', 10, 10)); // Mon 3 Mar 2031 (grid starts Mon 24 Feb)
      cell(14).dispatchEvent(pointerEvent('pointermove', 10, 120)); // Mon 10 Mar
      fixture.detectChanges();
      expect(
        root.querySelectorAll(
          '.mlv-scheduler-month__cell[aria-selected="true"]',
        ),
      ).toHaveLength(8);
      cell(14).dispatchEvent(pointerEvent('pointerup', 10, 120));
      expect(host.ranges[0]).toEqual({
        start: m(3),
        end: m(11),
        allDay: true,
        source: 'pointer',
      });
      cell(14).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(host.slotClicks).toHaveLength(0);
    });

    it('paints nothing, commits nothing and swallows no click when selection is off', () => {
      host.selectable.set(false);
      fixture.detectChanges();
      cell(7).dispatchEvent(pointerEvent('pointerdown', 10, 10));
      cell(14).dispatchEvent(pointerEvent('pointermove', 10, 120));
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      cell(14).dispatchEvent(pointerEvent('pointerup', 10, 120));
      expect(host.ranges).toHaveLength(0);

      // The drag armed no selection, so it must not eat the click that trails
      // it the way a real range-drag does.
      cell(14).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(host.slotClicks).toHaveLength(1);
    });

    it('abandons a pending selection on a press outside it', () => {
      const c = cell(7);
      c.focus();
      key(c, 'ArrowRight', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(2);

      cell(20).dispatchEvent(pointerEvent('pointerdown', 10, 200));
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      expect(host.ranges).toHaveLength(0);
    });

    it('keeps a pending selection when the press lands inside it', () => {
      const c = cell(7);
      c.focus();
      key(c, 'ArrowRight', { shiftKey: true });
      cell(8).dispatchEvent(pointerEvent('pointerdown', 10, 10));
      fixture.detectChanges();
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(2);
    });

    it('does not start from a chip or the more button', () => {
      const bar = query<HTMLElement>(root, '[data-event-id="span"]');
      bar.dispatchEvent(pointerEvent('pointerdown', 10, 10));
      cell(12).dispatchEvent(pointerEvent('pointermove', 10, 60));
      cell(12).dispatchEvent(pointerEvent('pointerup', 10, 60));
      expect(host.ranges).toHaveLength(0);
    });
  });

  describe('keyboard range selection', () => {
    it('Shift+Arrow selects days, Enter emits an all-day range with source keyboard', () => {
      const c = cell(7); // 3 Mar 2031
      c.focus();
      key(c, 'ArrowRight', { shiftKey: true });
      key(c, 'ArrowDown', { shiftKey: true });
      fixture.detectChanges();
      expect(
        root.querySelectorAll(
          '.mlv-scheduler-month__cell[aria-selected="true"]',
        ),
      ).toHaveLength(9); // 3 → 11 Mar
      key(focused(), 'Enter');
      expect(host.ranges[0]).toEqual({
        start: m(3),
        end: m(12),
        allDay: true,
        source: 'keyboard',
      });
    });

    it('Escape clears a pending selection without emitting', () => {
      const c = cell(7);
      c.focus();
      key(c, 'ArrowRight', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(2);
      key(focused(), 'Escape');
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      expect(host.ranges).toHaveLength(0);
    });

    it('clamps the head on the axis the key moves', () => {
      // Down from the last row must stay put. Clamping the flat index into
      // range instead would slide the head sideways to the last day of the
      // grid — from Wed 2 Apr (38) to Sun 6 Apr (41), selecting four days for
      // a key that means "one week down".
      const lastRow = cell(38);
      lastRow.focus();
      key(lastRow, 'ArrowDown', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
      expect(cell(38).getAttribute('aria-selected')).toBe('true');
      expect(cell(41).getAttribute('aria-selected')).toBeNull();

      // Same on the other edge: Up from the first row would slide backwards.
      key(lastRow, 'Escape');
      const firstRow = cell(3);
      firstRow.focus();
      key(firstRow, 'ArrowUp', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
      expect(cell(0).getAttribute('aria-selected')).toBeNull();

      // A horizontal step is clamped, not frozen: it stops at the grid edge.
      key(firstRow, 'Escape');
      const last = cell(41);
      last.focus();
      key(last, 'ArrowRight', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);

      // And the vertical clamp is per direction, not a freeze.
      key(last, 'ArrowUp', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(8);
    });

    it('mirrors Shift+Arrow in RTL and leaves the vertical pair alone', () => {
      rtl.setDirection('rtl');
      fixture.detectChanges();
      const c = cell(7); // Mon 3 Mar
      c.focus();
      key(c, 'ArrowLeft', { shiftKey: true }); // "next" in RTL
      expect(cell(8).getAttribute('aria-selected')).toBe('true');
      expect(cell(6).getAttribute('aria-selected')).toBeNull();

      key(c, 'ArrowDown', { shiftKey: true }); // never mirrors
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(9);
      expect(cell(15).getAttribute('aria-selected')).toBe('true');
    });

    it('abandons a pending selection on plain navigation', () => {
      const c = cell(7); // Mon 3 Mar
      c.focus();
      key(c, 'ArrowRight', { shiftKey: true });
      key(c, 'ArrowRight', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(3);

      key(c, 'ArrowLeft'); // plain navigation: focus Sun 2 Mar, selection gone
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(0);
      expect(document.activeElement).toBe(cell(6));

      // Enter activates the focused cell instead of committing the stale range.
      key(cell(6), 'Enter');
      expect(host.ranges).toHaveLength(0);
      expect(host.slotClicks.at(-1)?.date).toEqual(m(2));

      // And the next Shift+Arrow re-anchors on the live focus rather than
      // growing from the abandoned head.
      key(cell(6), 'ArrowRight', { shiftKey: true });
      expect(root.querySelectorAll('[aria-selected="true"]')).toHaveLength(2);
      expect(cell(6).getAttribute('aria-selected')).toBe('true');
      expect(cell(8).getAttribute('aria-selected')).toBeNull();
    });
  });

  it('focuses "+N more" with Enter when spanning bars leave the cell no chip', async () => {
    // Two Mon→Wed bars take lanes 0 and 1 of the 3-lane row (threshold 2), so
    // Tuesday's own events are all hidden and its cell renders no chip at all —
    // the overflow button is then its only keyboard stop.
    host.events.set([
      { id: 'span1', title: 'Offsite', start: m(3), end: m(6), allDay: true },
      { id: 'span2', title: 'Retreat', start: m(3), end: m(6), allDay: true },
      { id: 't1', title: 'A', start: m(4, 9), end: m(4, 10) },
      { id: 't2', title: 'B', start: m(4, 11), end: m(4, 12) },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const tuesday = cell(8);
    expect(tuesday.querySelectorAll('.mlv-scheduler-event')).toHaveLength(0);
    const more = moreButton(8);
    expect(more.textContent?.trim()).toBe('+2 more');

    tuesday.focus();
    const enter = key(tuesday, 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(more);
    expect(host.slotClicks).toHaveLength(0);
  });

  it('reaches "+N more" through the intra-cell Tab ring and round-trips focus through the popover', async () => {
    const owner = cell(8); // Tue 4 Mar: one visible chip plus the overflow button
    const chipEl = chip(owner, 't1');
    const more = moreButton(8);
    chipEl.focus();
    const tab = key(chipEl, 'Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(more);

    more.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = popover();
    expect(document.activeElement).toBe(
      panel.querySelector('.mlv-scheduler-event'),
    );

    // Escape on the focused panel chip: the chip finds no owning grid cell
    // above it (the pane is portaled to <body>), so it leaves the key to the
    // popup's own dismissal instead of swallowing it.
    focused().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.mlv-scheduler-month__popover')).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  describe('axe', () => {
    // One default-state run over the grid is not coverage: the overflow panel
    // is portaled OUT of `root` and closed at that point, `aria-selected` only
    // exists while a selection is live, and `hiddenDays` rebuilds the row into
    // five columnheaders and five cells. Each of those is its own state.
    const violations = async (target: Element) =>
      (
        await axe.run(target, {
          runOnly: { type: 'rule', values: AXE_RULES },
        })
      ).violations;

    it('passes in the default state', async () => {
      expect(await violations(root)).toEqual([]);
    });

    it('passes with a range selected', async () => {
      const c = cell(7);
      c.focus();
      key(c, 'ArrowRight', { shiftKey: true });
      key(c, 'ArrowDown', { shiftKey: true });
      await fixture.whenStable();
      expect(
        root.querySelectorAll('[aria-selected="true"]').length,
      ).toBeGreaterThan(1);
      expect(await violations(root)).toEqual([]);
    });

    it('passes with hidden weekdays', async () => {
      host.hiddenDays.set([0, 6]);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(await violations(root)).toEqual([]);
    });

    it('passes with the overflow popover open', async () => {
      moreButton(8).click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(popover()).toBeTruthy();
      // The panel lives in the CDK overlay container, so the run has to start
      // above both it and the scheduler root it points `aria-describedby` into.
      expect(await violations(document.body)).toEqual([]);
    });
  });
});

// jsdom paints nothing and models no text selection, so the parts of the
// pointer contract that live purely in CSS are asserted on the compiled text.
describe('MlvSchedulerMonth styles', () => {
  let css: string;

  beforeAll(() => {
    // Joined at runtime so Vite's asset rewrite never turns the stylesheet
    // path into an http(s) URL under jsdom (same trick as compare.spec).
    css = stripCssLayersFromText(
      compile(
        fileURLToPath(
          new URL(['.', 'scheduler-month.scss'].join('/'), import.meta.url),
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

  it('sizes a spanning bar in cell pitches, not in its own padded box', () => {
    // `100%` is the `__lanes` content box: one cell pitch MINUS the cell's two
    // inline paddings and its inline-end border. A bar therefore has to add
    // that gap back once per crossed boundary, and the terms it adds must be
    // the very declarations the cell uses — that is what this asserts, so the
    // two cannot drift (jsdom lays nothing out, so the formula is the subject).
    const cellRule = block('.mlv-scheduler-month__cell');
    expect(cellRule).toMatch(/padding:\s*var\(--mlv-spacing-1\)/);
    expect(cellRule).toMatch(/border-inline-end:\s*var\(--mlv-stroke-width\)/);

    const bar = block('.mlv-scheduler-month__event--spanning').replace(
      /\s+/g,
      ' ',
    );
    expect(bar).toContain('100% * var(--mlv-scheduler-span, 1)');
    expect(bar).toContain(
      '(var(--mlv-scheduler-span, 1) - 1) * (2 * var(--mlv-spacing-1) + var(--mlv-stroke-width))',
    );
  });

  it('lifts the today pill off the identical selected-cell fill', () => {
    // `--mlv-background-selected` is `--mlv-background-accent-1-pale` in both
    // themes, which is exactly what the pill paints, so a selected today cell
    // would show no pill at all without this override.
    expect(
      block(
        '.mlv-scheduler-month__cell--today.mlv-scheduler-month__cell--selected .mlv-scheduler-month__day-number',
      ),
    ).toMatch(/background:\s*var\(--mlv-background-accent-1\)/);
  });

  it('suppresses native text selection while a range-drag crosses the rows', () => {
    // Every cell a drag passes over carries a day number; without this the
    // browser highlight smears across the grid on top of the selected-cell
    // paint. It must sit on the rows, not on a `--selecting` modifier: a class
    // set once the drag threshold is crossed arrives after the browser has
    // already started selecting.
    expect(block('.mlv-scheduler-month__rows')).toMatch(/user-select:\s*none/);
  });
});
