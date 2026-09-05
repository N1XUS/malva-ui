import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import axe from 'axe-core';
import { MLV_DATE_LOCALE, MlvNativeDateAdapter } from '@malva-ui/core/date';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvScheduler } from './scheduler';
import { MlvSchedulerHeaderDef } from './scheduler-defs';
import type {
  MlvSchedulerEvent,
  MlvSchedulerEventChange,
  MlvSchedulerView,
  MlvSchedulerVisibleRange,
} from './scheduler.types';
import { normalizeEvent } from '../layout/scheduler-layout';
import { focused, query } from '../testing/scheduler-test-dom';

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
  'aria-toggle-field-name',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'button-name',
  'duplicate-id-aria',
  'link-name',
  'nested-interactive',
  'tabindex',
];

async function expectNoAxeViolations(root: HTMLElement): Promise<void> {
  const results = await axe.run(root, {
    runOnly: { type: 'rule', values: AXE_RULES },
  });
  expect(results.violations).toEqual([]);
}

const d = (day: number, h = 0, m = 0, month = 8) =>
  new Date(2026, month, day, h, m);

@Component({
  imports: [MlvScheduler, MlvSchedulerHeaderDef],
  template: `
    <mlv-scheduler
      [(events)]="events"
      [(view)]="view"
      [(date)]="date"
      [hiddenDays]="hiddenDays()"
      [minTime]="minTime()"
      [maxTime]="maxTime()"
      [toolbar]="toolbar()"
      [ariaLabel]="ariaLabel()"
      [canMove]="canMove()"
      [mlvDensity]="density()"
      (visibleRangeChange)="ranges.push($event)"
      (eventMove)="moves.push($event)"
      (eventResize)="resizes.push($event)"
    >
      @if (customHeader()) {
        <ng-template mlvSchedulerHeaderDef let-api>
          <div class="custom-header">
            <span class="custom-title">{{ api.title }}</span>
            <button type="button" class="custom-next" (click)="api.next()">
              n
            </button>
          </div>
        </ng-template>
      }
    </mlv-scheduler>
  `,
})
class Host {
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'a', title: 'Standup', start: d(2, 9), end: d(2, 9, 30) },
  ]);
  readonly view = signal<MlvSchedulerView>('month');
  readonly date = signal(d(2));
  readonly hiddenDays = signal<readonly number[]>([]);
  readonly minTime = signal('00:00');
  readonly maxTime = signal('24:00');
  readonly toolbar = signal(true);
  readonly ariaLabel = signal<string | undefined>(undefined);
  readonly customHeader = signal(false);
  readonly density = signal<'compact' | undefined>(undefined);
  readonly canMove = signal<
    | ((
        e: MlvSchedulerEvent,
        n: { start: Date; end: Date; allDay: boolean },
      ) => boolean)
    | null
  >(null);
  readonly ranges: MlvSchedulerVisibleRange[] = [];
  readonly moves: MlvSchedulerEventChange[] = [];
  readonly resizes: MlvSchedulerEventChange[] = [];
}

/** The bare attribute form of the boolean inputs: `<mlv-scheduler scrollToCurrentTime>`. */
@Component({
  imports: [MlvScheduler],
  template: `<mlv-scheduler scrollToCurrentTime />`,
})
class AttributeHost {}

describe('MlvScheduler (root)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let scheduler: MlvScheduler;
  /** The `mlv-scheduler` host element. */
  let el: HTMLElement;
  /**
   * The same node as `el`, under the name the blocks Tasks 13–15 append use.
   * Declared here so those appends compile without touching Task 8's assertions.
   */
  let root: HTMLElement;
  /** Direction service; every case that flips it restores `ltr` in `afterEach`. */
  let rtl: MlvRtlService;
  /**
   * The announced text. `announce()` alternates between two polite regions so
   * an identical repeat still reads as a DOM change, so a spec must join them
   * rather than query the first one.
   */
  const liveText = () =>
    Array.from(el.querySelectorAll('[role="status"]'))
      .map((node) => node.textContent ?? '')
      .join('')
      .trim();

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
    scheduler = fixture.debugElement.query(
      By.directive(MlvScheduler),
    ).componentInstance;
    el = fixture.nativeElement.querySelector('mlv-scheduler');
    root = el;
    rtl = TestBed.inject(MlvRtlService);
  });

  afterEach(() => rtl.setDirection('ltr'));

  it('renders the default toolbar with the month title and view switch', () => {
    expect(el.querySelector('.mlv-scheduler__title')?.textContent?.trim()).toBe(
      'September 2026',
    );
    expect(el.querySelector('.mlv-scheduler__toolbar')).not.toBeNull();
    expect(
      el.querySelectorAll('.mlv-scheduler__view-switch [mlvSegmentedItem]')
        .length,
    ).toBe(3);
    expect(el.getAttribute('aria-label')).toBe('Scheduler');
    expect(el.classList).toContain('mlv-scheduler--month');
  });

  it('navigates with the toolbar buttons and writes the date model', () => {
    (el.querySelector('.mlv-scheduler__next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.date()).toEqual(new Date(2026, 9, 2));
    expect(el.querySelector('.mlv-scheduler__title')?.textContent?.trim()).toBe(
      'October 2026',
    );
    (el.querySelector('.mlv-scheduler__previous') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.date()).toEqual(d(2));
    (el.querySelector('.mlv-scheduler__today') as HTMLButtonElement).click();
    fixture.detectChanges();
    const today = TestBed.inject(MlvNativeDateAdapter).today();
    expect(host.date().toDateString()).toBe(today.toDateString());
  });

  it('steps by week / day in the other views and formats their titles', () => {
    host.view.set('week');
    fixture.detectChanges();
    expect(el.classList).toContain('mlv-scheduler--week');
    const title = el.querySelector('.mlv-scheduler__title')?.textContent ?? '';
    expect(title).toMatch(/Aug 31/);
    expect(title).toMatch(/Sep 6/);
    scheduler.next();
    fixture.detectChanges();
    expect(host.date()).toEqual(d(9));
    host.view.set('day');
    fixture.detectChanges();
    scheduler.previous();
    fixture.detectChanges();
    expect(host.date()).toEqual(d(8));
    expect(el.querySelector('.mlv-scheduler__title')?.textContent?.trim()).toBe(
      TestBed.inject(MlvNativeDateAdapter).getDateLabel(d(8)),
    );
  });

  it('switches the view through the segmented control', () => {
    const items = el.querySelectorAll<HTMLButtonElement>(
      '.mlv-scheduler__view-switch [mlvSegmentedItem]',
    );
    items[1].click();
    fixture.detectChanges();
    expect(host.view()).toBe('week');
    expect(el.querySelector('mlv-scheduler-time-grid')).not.toBeNull();
    expect(el.querySelector('mlv-scheduler-month')).toBeNull();
  });

  it('emits visibleRangeChange on init and only when the range actually changes', () => {
    expect(host.ranges.length).toBe(1);
    expect(host.ranges[0]).toMatchObject({
      view: 'month',
      start: new Date(2026, 7, 31),
      end: new Date(2026, 9, 5),
    });
    scheduler.goTo(d(20));
    fixture.detectChanges();
    expect(host.ranges.length).toBe(1);
    scheduler.next();
    fixture.detectChanges();
    expect(host.ranges.length).toBe(2);
    expect(host.ranges[1].view).toBe('month');
  });

  it('renders a header def instead of the toolbar and exposes the header api', () => {
    host.customHeader.set(true);
    fixture.detectChanges();
    expect(el.querySelector('.mlv-scheduler__toolbar')).toBeNull();
    expect(el.querySelector('.custom-title')?.textContent).toBe(
      'September 2026',
    );
    (el.querySelector('.custom-next') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.custom-title')?.textContent).toBe('October 2026');
  });

  it('hides the toolbar with toolbar=false and honours ariaLabel / density', () => {
    host.toolbar.set(false);
    host.ariaLabel.set('Team calendar');
    host.density.set('compact');
    fixture.detectChanges();
    expect(el.querySelector('.mlv-scheduler__toolbar')).toBeNull();
    expect(el.getAttribute('aria-label')).toBe('Team calendar');
    expect(el.classList).toContain('mlv-scheduler--compact');
  });

  it('announces navigation through the polite live region', async () => {
    expect(liveText()).toBe('');
    scheduler.next();
    await fixture.whenStable();
    expect(liveText()).toBe('Showing October 2026');
  });

  it('commits a move: writes a new events array, emits eventMove and announces', async () => {
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    const before = host.events();
    const normalized = normalizeEvent(adapter, before[0], 60);
    const ok = scheduler.commitChange(
      'move',
      normalized,
      { start: d(3, 10), end: d(3, 10, 30), allDay: false },
      'keyboard',
    );
    fixture.detectChanges();
    expect(ok).toBe(true);
    expect(host.events()).not.toBe(before);
    expect(host.events()[0]).toEqual({
      id: 'a',
      title: 'Standup',
      start: d(3, 10),
      end: d(3, 10, 30),
      allDay: false,
    });
    expect(before[0].start).toEqual(d(2, 9)); // never mutated in place
    expect(host.moves).toEqual([
      {
        event: host.events()[0],
        previous: { start: d(2, 9), end: d(2, 9, 30), allDay: false },
        source: 'keyboard',
      },
    ]);
    await fixture.whenStable();
    expect(liveText()).toContain('Standup moved to');
  });

  it('commits a resize: writes a new events array, emits eventResize and announces', async () => {
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    const before = host.events();
    const normalized = normalizeEvent(adapter, before[0], 60);
    const ok = scheduler.commitChange(
      'resize',
      normalized,
      { start: d(2, 9), end: d(2, 10), allDay: false },
      'pointer',
    );
    fixture.detectChanges();
    expect(ok).toBe(true);
    expect(host.events()).not.toBe(before);
    expect(host.events()[0]).toEqual({
      id: 'a',
      title: 'Standup',
      start: d(2, 9),
      end: d(2, 10),
      allDay: false,
    });
    expect(before[0].end).toEqual(d(2, 9, 30)); // never mutated in place
    expect(host.resizes).toEqual([
      {
        event: host.events()[0],
        previous: { start: d(2, 9), end: d(2, 9, 30), allDay: false },
        source: 'pointer',
      },
    ]);
    expect(host.moves).toEqual([]); // eventResize, never eventMove
    await fixture.whenStable();
    expect(liveText()).toBe(
      `Standup now ends at ${scheduler.formatDateTime(d(2, 10))}`,
    );
  });

  it('announces the inclusive end date for an all-day resize', async () => {
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    host.events.set([
      { id: 'b', title: 'Offsite', start: d(2), end: d(3), allDay: true },
    ]);
    fixture.detectChanges();
    const normalized = normalizeEvent(adapter, host.events()[0], 60);
    const ok = scheduler.commitChange(
      'resize',
      normalized,
      { start: d(2), end: d(5), allDay: true }, // exclusive end Sep 5 → inclusive label Sep 4
      'pointer',
    );
    fixture.detectChanges();
    expect(ok).toBe(true);
    expect(host.events()[0].end).toEqual(d(5)); // the model keeps the exclusive end
    await fixture.whenStable();
    expect(liveText()).toBe(
      `Offsite now ends at ${adapter.getDateLabel(d(4))}`,
    );
  });

  it('vetoes through canMove without writing and announces the rejection', async () => {
    host.canMove.set(() => false);
    fixture.detectChanges();
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    const before = host.events();
    const ok = scheduler.commitChange(
      'move',
      normalizeEvent(adapter, before[0], 60),
      { start: d(3, 10), end: d(3, 10, 30), allDay: false },
      'pointer',
    );
    fixture.detectChanges();
    expect(ok).toBe(false);
    expect(host.events()).toBe(before);
    expect(host.moves).toEqual([]);
    await fixture.whenStable();
    expect(liveText()).toBe('Standup cannot be placed there');
  });

  it('ignores a commit for an event that is no longer in the model', () => {
    const adapter = TestBed.inject(MlvNativeDateAdapter);
    const ghost = normalizeEvent(
      adapter,
      { id: 'zzz', title: 'Gone', start: d(2, 9), end: d(2, 10) },
      60,
    );
    expect(
      scheduler.commitChange(
        'resize',
        ghost,
        { start: d(2, 9), end: d(2, 11), allDay: false },
        'pointer',
      ),
    ).toBe(false);
    expect(host.moves).toEqual([]);
  });

  it('parses minTime / maxTime into minutes and defaults the snap to slotDuration', () => {
    expect(scheduler.minMinutes()).toBe(0);
    expect(scheduler.maxMinutes()).toBe(1440);
    expect(scheduler.snap()).toBe(30);
  });

  it('defaults scrollToCurrentTime to false and coerces the bare attribute', () => {
    expect(scheduler.scrollToCurrentTime()).toBe(false);

    const attr = TestBed.createComponent(AttributeHost);
    attr.detectChanges();
    const bare = attr.debugElement.query(By.directive(MlvScheduler))
      .componentInstance as MlvScheduler;
    expect(bare.scrollToCurrentTime()).toBe(true);
    attr.destroy();
  });

  describe('hiddenDays', () => {
    it('never blanks the day view and steps over hidden weekdays', async () => {
      host.hiddenDays.set([0, 6]); // weekend
      host.view.set('day');
      host.date.set(d(4)); // Friday 4 Sep 2026
      await fixture.whenStable();
      expect(scheduler.days()).toEqual([d(4)]);

      // One "next" from Friday reaches Monday, not the blank Saturday.
      scheduler.next();
      await fixture.whenStable();
      expect(host.date()).toEqual(d(7));
      expect(scheduler.days()).toEqual([d(7)]);
      expect(
        el.querySelectorAll('.mlv-scheduler-time-grid__column'),
      ).toHaveLength(1);

      scheduler.previous();
      await fixture.whenStable();
      expect(host.date()).toEqual(d(4));
    });

    it('still renders an anchor pointed straight at a hidden weekday', async () => {
      host.hiddenDays.set([0, 6]);
      host.view.set('day');
      host.date.set(d(5)); // Saturday — asked for explicitly
      await fixture.whenStable();
      expect(scheduler.days()).toEqual([d(5)]);
      expect(
        el.querySelectorAll('.mlv-scheduler-time-grid__column'),
      ).toHaveLength(1);
      expect(el.querySelectorAll('[role="gridcell"]').length).toBeGreaterThan(
        0,
      );
    });

    it('keeps filtering the week view', async () => {
      host.hiddenDays.set([0, 6]);
      host.view.set('week');
      await fixture.whenStable();
      expect(scheduler.days()).toHaveLength(5);
    });
  });

  describe('announcements', () => {
    it('announces the same message twice without a render in between', async () => {
      host.canMove.set(() => false);
      await fixture.whenStable(); // the guard is an input; let it reach the component
      const adapter = TestBed.inject(MlvNativeDateAdapter);
      const normalized = normalizeEvent(adapter, host.events()[0], 60);
      const reject = () =>
        scheduler.commitChange(
          'move',
          normalized,
          { start: d(3, 10), end: d(3, 10, 30), allDay: false },
          'pointer',
        );

      reject();
      await fixture.whenStable();
      expect(liveText()).toBe('Standup cannot be placed there');
      const first = Array.from(el.querySelectorAll('[role="status"]')).map(
        (node) => node.textContent,
      );

      reject();
      await fixture.whenStable();
      // Same text, but it moved to the other region — an insertion into a
      // previously empty live region, which is what actually gets spoken.
      expect(liveText()).toBe('Standup cannot be placed there');
      expect(
        Array.from(el.querySelectorAll('[role="status"]')).map(
          (node) => node.textContent,
        ),
      ).not.toEqual(first);
    });

    it('announces a period change once, from wherever the range moved', async () => {
      // The initial range is emitted but never announced: it is what the user
      // is already looking at.
      expect(liveText()).toBe('');

      host.date.set(new Date(2026, 9, 2)); // a bound write, not next()/goTo()
      await fixture.whenStable();
      expect(liveText()).toBe('Showing October 2026');

      // A jump that resolves to the period already on screen stays silent.
      scheduler.goTo(new Date(2026, 9, 20));
      await fixture.whenStable();
      expect(liveText()).toBe('Showing October 2026');
      expect(host.ranges).toHaveLength(2);
    });
  });

  describe('keyboard focus restore across segments', () => {
    /** The day column (or month cell) the focused element sits in. */
    const focusedDayIndex = () =>
      focused().closest<HTMLElement>('[data-day-index]')?.dataset['dayIndex'];

    it('returns focus to the segment the move was made from, not the first one', async () => {
      // Wed 23:00 → Thu 01:00 is sliced into one chip per day column, both
      // carrying `data-event-id="x"`. Visible week: Mon 31 Aug (0) … Sun 6 Sep.
      host.view.set('week');
      host.events.set([
        { id: 'x', title: 'Night shift', start: d(2, 23), end: d(3, 1) },
      ]);
      await fixture.whenStable();
      const segments = () =>
        Array.from(
          el.querySelectorAll<HTMLElement>(
            '.mlv-scheduler-time-grid__event[data-event-id="x"]',
          ),
        );
      expect(
        segments().map(
          (chip) =>
            chip.closest<HTMLElement>('[data-day-index]')?.dataset['dayIndex'],
        ),
      ).toEqual(['2', '3']);

      const second = segments()[1];
      second.focus();
      second.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await fixture.whenStable();

      // The event moved to Thu 23:00 → Fri 01:00, so the segment the user was
      // standing on is now the Fri column (4). Without the segment identity in
      // the focus request this landed on the event's first chip (3).
      expect(host.moves).toHaveLength(1);
      expect(focusedDayIndex()).toBe('4');
    });

    it('keeps both announcements when the same move also changes the period', async () => {
      // `commitChange()` announces the move and the `visibleRangeChange`
      // effect announces the new period, both before anything is painted. With
      // one live region — or with two that clear each other unconditionally —
      // only the period survives to the render, and the move is never spoken.
      host.view.set('week');
      host.events.set([
        { id: 'x', title: 'Night shift', start: d(6, 9), end: d(6, 10) },
      ]);
      await fixture.whenStable();

      const chip = el.querySelector<HTMLElement>('[data-event-id="x"]');
      expect(chip).not.toBeNull();
      chip?.focus();
      chip?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await fixture.whenStable();

      // Sun 6 Sep → Mon 7 Sep leaves the rendered week, so the chip's own
      // `goTo()` runs in the same synchronous block as the commit.
      expect(host.moves).toHaveLength(1);
      const regions = Array.from(el.querySelectorAll('[role="status"]')).map(
        (node) => node.textContent?.trim() ?? '',
      );
      expect(regions.filter((text) => text !== '')).toHaveLength(2);
      expect(
        regions.some((text) => text.includes('Night shift moved to')),
      ).toBe(true);
      expect(regions.some((text) => text.startsWith('Showing'))).toBe(true);
    });
  });

  describe('time window', () => {
    // `[minTime, maxTime)` is validated as one pair, so BOTH ends report the
    // same error: the time grid divides by the span for every hour line and
    // every chip offset, and a non-ascending window would silently write
    // `NaN%` / `Infinity%` into the geometry custom properties instead.
    it('rejects a window that is not strictly ascending', async () => {
      host.minTime.set('09:00');
      host.maxTime.set('09:00');
      await fixture.whenStable();
      expect(() => scheduler.minMinutes()).toThrow(
        /minTime must be earlier than maxTime/,
      );
      expect(() => scheduler.maxMinutes()).toThrow(
        /minTime must be earlier than maxTime/,
      );
    });

    it('rejects an inverted window', async () => {
      host.minTime.set('18:00');
      host.maxTime.set('09:00');
      await fixture.whenStable();
      expect(() => scheduler.maxMinutes()).toThrow(
        /minTime must be earlier than maxTime/,
      );
    });

    it('accepts a strictly ascending window', async () => {
      host.minTime.set('08:00');
      host.maxTime.set('18:00');
      await fixture.whenStable();
      expect(scheduler.minMinutes()).toBe(480);
      expect(scheduler.maxMinutes()).toBe(1080);
    });
  });

  describe('scrollToTime', () => {
    // jsdom lays nothing out, so the time grid can only turn minutes into
    // pixels if the slot rows report a height: 40 px per 30 minute row, every
    // other box (the hour label's headroom included) zero.
    const measureSlots = () =>
      vi
        .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
        .mockImplementation(function (this: HTMLElement) {
          return this.classList.contains('mlv-scheduler-time-grid__slot')
            ? 40
            : 0;
        });

    afterEach(() => vi.restoreAllMocks());

    it('drops a request the settled view still shows the month for', async () => {
      measureSlots();
      expect(scheduler.view()).toBe('month');
      scheduler.scrollToTime('14:00');
      await fixture.whenStable();
      // Recorded at call time, dropped once the view has settled on the month:
      // a request left standing would be replayed by the next time grid that
      // appears, beating its initial scroll with a time asked for in another
      // view.
      expect(scheduler.scrollRequest()).toBeNull();
      host.view.set('week');
      await fixture.whenStable();
      expect(query<HTMLElement>(el, '.mlv-scrollbar__viewport').scrollTop).toBe(
        640, // the documented 08:00 initial scroll, not the dropped 14:00
      );
    });

    it('wins over the initial scroll when issued in the same tick as the view switch', async () => {
      measureSlots();
      // `scheduler.html` renders the month view from another branch, so this
      // pair writes both signals before the week grid exists.
      scheduler.setView('week');
      scheduler.scrollToTime('14:00');
      await fixture.whenStable();
      expect(query<HTMLElement>(el, '.mlv-scrollbar__viewport').scrollTop).toBe(
        1120, // 14:00 top-aligned at 30 min rows, not 08:00 (640)
      );
      // Applied once and cleared, so a later week ↔ day switch re-runs the
      // documented initial scroll instead of landing back on 14:00.
      expect(scheduler.scrollRequest()).toBeNull();
    });

    it('wins when the same-tick switch comes through the [(view)] binding', async () => {
      measureSlots();
      // The binding, not `setView()`. A consumer's `view.set('week')` reaches
      // the model input during the NEXT change detection, so at call time
      // `view()` still reads `'month'` — deciding there would drop the request
      // the consumer had just made. The decision belongs to the settled view.
      host.view.set('week');
      scheduler.scrollToTime('14:00');
      await fixture.whenStable();
      expect(query<HTMLElement>(el, '.mlv-scrollbar__viewport').scrollTop).toBe(
        1120, // 14:00 top-aligned at 30 min rows, not 08:00 (640)
      );
      expect(scheduler.scrollRequest()).toBeNull();
    });

    it('drops a request paired with a same-tick switch into the month view', async () => {
      measureSlots();
      host.view.set('week');
      await fixture.whenStable();
      // Same tick, the other way round: the settled view is the month, so the
      // request goes, even though `view()` still read `'week'` at call time.
      host.view.set('month');
      scheduler.scrollToTime('14:00');
      await fixture.whenStable();
      expect(scheduler.scrollRequest()).toBeNull();
      // And nothing survives for the next grid: coming back to the week opens
      // on the documented initial scroll, not on the 14:00 asked for on the
      // way out.
      host.view.set('week');
      await fixture.whenStable();
      expect(query<HTMLElement>(el, '.mlv-scrollbar__viewport').scrollTop).toBe(
        640,
      );
    });
  });

  describe('direction and accessibility', () => {
    it.each(['month', 'week', 'day'] as const)(
      'passes axe in the %s view',
      async (view) => {
        host.view.set(view);
        fixture.detectChanges();
        await fixture.whenStable();
        await expectNoAxeViolations(root);
      },
    );

    it('keeps the toolbar order and semantics in RTL and mirrors the nav chevrons via CSS only', () => {
      expect(rtl.resolveDirection(root)).toBe('ltr');
      rtl.setDirection('rtl');
      fixture.detectChanges();
      // Anchors the case on the flip itself: without it every assertion below
      // passes identically in LTR, so a `setDirection` that stopped working
      // would go unnoticed. The toolbar's DOM order and its labels are then
      // asserted to be exactly what they are in LTR — the mirroring is CSS.
      expect(rtl.resolveDirection(root)).toBe('rtl');
      const buttons = Array.from(
        root.querySelectorAll<HTMLButtonElement>('.mlv-scheduler__nav button'),
      );
      expect(
        buttons.map(
          (b) => b.getAttribute('aria-label') ?? b.textContent?.trim(),
        ),
      ).toEqual([
        expect.stringMatching(/^Previous/),
        expect.stringMatching(/^Next/),
        'Today',
      ]);
      expect(root.querySelectorAll('.mlv-scheduler__nav-icon')).toHaveLength(2);
      query<HTMLButtonElement>(root, '.mlv-scheduler__next').click();
      fixture.detectChanges();
      expect(query(root, '.mlv-scheduler__title').textContent).toContain(
        'October 2026',
      );
    });

    it('follows a [dir] scope on an ancestor while the document stays LTR', () => {
      root.setAttribute('dir', 'rtl'); // `root` IS the mlv-scheduler host, an ancestor of every cell
      host.view.set('week');
      fixture.detectChanges();
      // The scoped attribute never reaches the document-level signal, but the
      // element-scoped accessor the pointer maths uses does see it.
      expect(rtl.direction()).toBe('ltr');
      expect(rtl.resolveDirection(root)).toBe('rtl');
      // The keyboard axis is deliberately NOT asserted here. `normalizeArrowKey`
      // resolves against the document direction for every component in the
      // library, so a scoped `[dir]` does not currently mirror arrow keys —
      // an open gap against `.claude/rules/rtl.md`'s scoped-mirroring contract
      // that belongs to `MlvRtlService`, not to the scheduler. The document-flip
      // mirror is covered by `scheduler-time-grid.spec.ts` ("roves focus through
      // slots: … horizontal by day (mirrored in RTL) …").
    });
  });
});
