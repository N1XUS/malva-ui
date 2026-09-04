import { fileURLToPath } from 'node:url';
import { computed, inject, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { compile } from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { MlvNativeDateAdapter } from '@malva-ui/core/date';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import { MlvSchedulerEventChip } from './scheduler-event';
import { MLV_SCHEDULER_CONTEXT } from '../scheduler/scheduler-context';
import { MlvSchedulerEventDef } from '../scheduler/scheduler-defs';
import {
  normalizeEvent,
  type MlvSchedulerNormalizedEvent,
} from '../layout/scheduler-layout';
import type { MlvSchedulerEvent } from '../scheduler/scheduler.types';
import { createSchedulerTestContext } from '../testing/scheduler-test-context';
import { closest, present, query } from '../testing/scheduler-test-dom';

const d = (day: number, h = 0, m = 0) => new Date(2026, 8, day, h, m);

@Component({
  imports: [MlvSchedulerEventChip, MlvSchedulerEventDef],
  template: `
    <ng-template mlvSchedulerEventDef let-event let-allDay="allDay">
      <em class="custom">{{ event.title }}/{{ allDay }}</em>
      <button type="button" class="custom-action">edit</button>
    </ng-template>

    <!-- Unchanged Task 9 chip, now inside a fake time-grid column. -->
    <div class="mlv-scheduler-time-grid__column" data-day-index="2">
      <div class="mlv-scheduler-time-grid__events">
        <mlv-scheduler-event
          [normalized]="normalized()"
          [lane]="lane()"
          [continuesBefore]="before()"
          [continuesAfter]="after()"
          [dayIndex]="2"
          style="--mlv-scheduler-event-top: 37.5%; --mlv-scheduler-event-height: 8.333%"
        />
      </div>
    </div>

    <!-- NEW: the all-day bar the lane-resize and lane-keyboard cases drive. -->
    <div
      class="mlv-scheduler-month__cell"
      data-day-index="1"
      data-minutes="all-day"
    >
      <div class="mlv-scheduler-month__lanes">
        <mlv-scheduler-event
          [normalized]="laneEvent()"
          [lane]="true"
          [dayIndex]="1"
          style="--mlv-scheduler-span: 2"
        />
      </div>
    </div>
  `,
})
class Host {
  /**
   * The timed chip's event. Left `null` until `beforeEach` seeds it — the chip
   * is only created once the template runs, so nothing reads it before then.
   */
  readonly normalized = signal(null as unknown as MlvSchedulerNormalizedEvent);
  readonly lane = signal(false);
  readonly before = signal(false);
  readonly after = signal(false);

  /** @private The fake context, so the lane bar can be derived from the model. */
  private readonly _ctx = inject(MLV_SCHEDULER_CONTEXT);

  /**
   * The all-day bar. A `computed()` over the context's normalized events — the
   * test context's `commitChange` writes back into `events`, so this chip
   * re-normalizes after every commit, which the "already minimal" resize case
   * in Task 14 depends on. The first chip's `normalized` stays a plain writable
   * signal so the Task 9 cases keep `.set()`-ing it and so repeated presses on
   * the timed chip always start from the same range.
   */
  readonly laneEvent = computed(() =>
    present(
      this._ctx.normalizedEvents().find((n) => n.event.id === 'lane'),
      "the 'lane' event",
    ),
  );
}

describe('MlvSchedulerEventChip', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  /** The host element — Tasks 13/14 query chips out of it after the template grows a second chip. */
  let root: HTMLElement;
  /** The single chip rendered by the Task 9 template; later tasks keep it pointing at the timed chip. */
  let chip: HTMLElement;
  let ctx: ReturnType<typeof createSchedulerTestContext>;
  let rtl: MlvRtlService;
  const norm = (e: MlvSchedulerEvent) =>
    normalizeEvent(TestBed.inject(MlvNativeDateAdapter), e, 60);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MLV_SCHEDULER_CONTEXT,
          useFactory: () =>
            (ctx = createSchedulerTestContext({
              // All-day Tue 1 Sep → Thu 3 Sep 2026 exclusive: span 2, starting at
              // dayIndex 1 of the Mon 31 Aug week. `snap` stays the default 30.
              events: [
                {
                  id: 'lane',
                  title: 'Offsite',
                  start: d(1),
                  end: d(3),
                  allDay: true,
                },
              ],
            })).context,
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.normalized.set(
      norm({
        id: 'a',
        title: 'Standup',
        start: d(2, 9),
        end: d(2, 9, 30),
        tone: 'success',
      }),
    );
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
    chip = query(root, 'mlv-scheduler-event');
    rtl = TestBed.inject(MlvRtlService);
  });
  afterEach(() => rtl.setDirection('ltr'));

  it('renders time + title with button semantics and tone / data attributes', () => {
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.getAttribute('tabindex')).toBe('-1');
    expect(chip.getAttribute('data-event-id')).toBe('a');
    expect(chip.hasAttribute('data-draggable')).toBe(false);
    expect(chip.classList).toContain('mlv-scheduler-event--timed');
    expect(chip.classList).toContain('mlv-scheduler-event--tone-success');
    expect(
      chip.querySelector('.mlv-scheduler-event__time')?.textContent,
    ).toMatch(/9:00.*9:30/);
    expect(chip.querySelector('.mlv-scheduler-event__title')?.textContent).toBe(
      'Standup',
    );
    expect(chip.getAttribute('aria-label')).toMatch(
      /^Standup, 9:00 AM to 9:30 AM$/,
    );
    expect(chip.getAttribute('aria-describedby')).toBe(
      'mlv-scheduler-hint-test',
    );
    expect(
      chip
        .querySelector('.mlv-scheduler-event__resize-handle')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('labels all-day and multi-day events with dates and shows continuation glyphs in lanes', () => {
    host.normalized.set(
      norm({ id: 'b', title: 'Offsite', start: d(2), end: d(5), allDay: true }),
    );
    host.lane.set(true);
    host.before.set(true);
    fixture.detectChanges();
    expect(chip.classList).toContain('mlv-scheduler-event--all-day');
    expect(chip.classList).toContain('mlv-scheduler-event--continues-before');
    expect(chip.getAttribute('aria-label')).toContain('all day');
    expect(chip.querySelector('.mlv-scheduler-event__time')).toBeNull();
    expect(
      chip.querySelector('.mlv-scheduler-event__continuation--before'),
    ).not.toBeNull();
    expect(
      chip.querySelector('.mlv-scheduler-event__continuation--after'),
    ).toBeNull();
    host.normalized.set(
      norm({ id: 'c', title: 'Trip', start: d(2, 22), end: d(3, 2) }),
    );
    fixture.detectChanges();
    expect(chip.getAttribute('aria-label')).toMatch(
      /Trip, Sep 2, 10:00 PM to Sep 3, 2:00 AM/,
    );
  });

  it('drops drag / resize affordances when the event or the scheduler is not editable', () => {
    host.normalized.set(
      norm({
        id: 'a',
        title: 'Locked',
        start: d(2, 9),
        end: d(2, 10),
        draggable: false,
        resizable: false,
      }),
    );
    fixture.detectChanges();
    expect(chip.getAttribute('data-draggable')).toBe('false');
    expect(
      chip.querySelector('.mlv-scheduler-event__resize-handle'),
    ).toBeNull();
    expect(chip.hasAttribute('aria-describedby')).toBe(false);
    host.normalized.set(
      norm({ id: 'a', title: 'Free', start: d(2, 9), end: d(2, 10) }),
    );
    ctx.editable.set(false);
    fixture.detectChanges();
    expect(chip.getAttribute('data-draggable')).toBe('false');
    expect(
      chip.querySelector('.mlv-scheduler-event__resize-handle'),
    ).toBeNull();
  });

  it('paints a custom colour through the component variable', () => {
    host.normalized.set(
      norm({
        id: 'a',
        title: 'Custom',
        start: d(2, 9),
        end: d(2, 10),
        color: 'rgb(1, 2, 3)',
      }),
    );
    fixture.detectChanges();
    expect(chip.classList).toContain('mlv-scheduler-event--custom-color');
    expect(chip.style.getPropertyValue('--mlv-scheduler-event-color')).toBe(
      'rgb(1, 2, 3)',
    );
  });

  it('emits click / dblclick / contextmenu with the chip element and swallows a post-drag click once', () => {
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    chip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const menu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    chip.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
    const calls = (ctx.context.emitEventInteraction as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(calls.map((c) => c[0])).toEqual([
      'click',
      'dblclick',
      'contextmenu',
    ]);
    expect(calls[0][1]).toMatchObject({ event: { id: 'a' }, element: chip });
    ctx.context.suppressNextClick();
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls.length).toBe(4);
  });

  it('activates on Enter and Space (Space does not scroll)', () => {
    chip.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    const space = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    chip.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    const calls = (ctx.context.emitEventInteraction as ReturnType<typeof vi.fn>)
      .mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[1][1].nativeEvent).toBe(space);
  });

  it('renders a custom event def instead of the default content', () => {
    const def = fixture.debugElement
      .queryAllNodes((n) => !!n.injector.get(MlvSchedulerEventDef, null))[0]
      .injector.get(MlvSchedulerEventDef).templateRef;
    ctx.eventDef.set(def);
    fixture.detectChanges();
    expect(chip.querySelector('.custom')?.textContent).toBe('Standup/false');
    expect(chip.querySelector('.mlv-scheduler-event__title')).toBeNull();
  });

  function pointerEvent(type: string, x: number, y: number): Event {
    return Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
      clientX: x,
      clientY: y,
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });
  }
  const columnRect = {
    top: 0,
    height: 960,
    left: 0,
    width: 100,
    bottom: 960,
    right: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
  const cellRect = {
    top: 0,
    height: 100,
    left: 100,
    width: 120,
    bottom: 100,
    right: 220,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  const key = (el: Element, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    el.dispatchEvent(event);
    return event;
  };

  describe('pointer resize', () => {
    it('previews a timed resize as --mlv-scheduler-event-height and commits the snapped end', () => {
      const chipEl = query<HTMLElement>(
        root,
        '.mlv-scheduler-time-grid__column .mlv-scheduler-event',
      );
      vi.spyOn(
        closest<HTMLElement>(chipEl, '.mlv-scheduler-time-grid__column'),
        'getBoundingClientRect',
      ).mockReturnValue(columnRect);
      const handle = query<HTMLElement>(
        chipEl,
        '.mlv-scheduler-event__resize-handle--end',
      );

      handle.dispatchEvent(pointerEvent('pointerdown', 50, 440));
      handle.dispatchEvent(pointerEvent('pointermove', 50, 500)); // 12:30 (snap 30)
      // Never assert the exact float text: the view writes `endPct - top`
      // (52.083333333333336 - 37.5 = 14.583333333333336) while the literal
      // `((12.5 - 9) / 24) * 100` is 14.583333333333334 — a `toBe` on those
      // strings encodes a bit pattern, not the behaviour.
      expect(
        parseFloat(
          chipEl.style.getPropertyValue('--mlv-scheduler-event-height'),
        ),
      ).toBeCloseTo(14.5833, 3);
      handle.dispatchEvent(pointerEvent('pointerup', 50, 500));

      expect(ctx.commits).toHaveLength(1);
      const { kind, next, source } = ctx.commits[0];
      expect(kind).toBe('resize');
      expect(source).toBe('pointer');
      expect(next.end).toEqual(new Date(2026, 8, 2, 12, 30));
    });

    it('restores the geometry when the commit is vetoed', () => {
      ctx.state.commitResult = false;
      const chipEl = query<HTMLElement>(
        root,
        '.mlv-scheduler-time-grid__column .mlv-scheduler-event',
      );
      vi.spyOn(
        closest<HTMLElement>(chipEl, '.mlv-scheduler-time-grid__column'),
        'getBoundingClientRect',
      ).mockReturnValue(columnRect);
      const handle = query<HTMLElement>(
        chipEl,
        '.mlv-scheduler-event__resize-handle--end',
      );
      handle.dispatchEvent(pointerEvent('pointerdown', 50, 440));
      handle.dispatchEvent(pointerEvent('pointermove', 50, 600));
      handle.dispatchEvent(pointerEvent('pointerup', 50, 600));
      expect(
        chipEl.style.getPropertyValue('--mlv-scheduler-event-height'),
      ).toBe('8.333%');
    });

    it('resizes a lane bar by whole days from the pointer travel, mirrored in RTL', () => {
      const chipEl = query<HTMLElement>(
        root,
        '.mlv-scheduler-month__lanes .mlv-scheduler-event',
      );
      vi.spyOn(
        closest<HTMLElement>(chipEl, '[data-day-index]'),
        'getBoundingClientRect',
      ).mockReturnValue(cellRect);
      const handle = query<HTMLElement>(
        chipEl,
        '.mlv-scheduler-event__resize-handle--end',
      );

      handle.dispatchEvent(pointerEvent('pointerdown', 330, 10));
      handle.dispatchEvent(pointerEvent('pointermove', 470, 10)); // +140 px ≈ +1 day
      expect(chipEl.style.getPropertyValue('--mlv-scheduler-span')).toBe('3');
      handle.dispatchEvent(pointerEvent('pointerup', 470, 10));
      expect(present(ctx.commits.at(-1), 'a commit').next.end).toEqual(
        new Date(2026, 8, 4),
      ); // exclusive end Sep 3 → Sep 4

      rtl.setDirection('rtl');
      fixture.detectChanges();
      // `--mlv-scheduler-span` is read off the chip's inline style at `onStart`
      // (`baseSpan`); the template's static `style="--mlv-scheduler-span: 2"`
      // is never re-evaluated by Angular, and the LTR drag above left `3`
      // there — reset it, or the mirrored press starts from `3` and previews `4`.
      chipEl.style.setProperty('--mlv-scheduler-span', '2');
      handle.dispatchEvent(pointerEvent('pointerdown', 330, 10));
      handle.dispatchEvent(pointerEvent('pointermove', 190, 10)); // −140 px on screen = +1 day in RTL
      expect(chipEl.style.getPropertyValue('--mlv-scheduler-span')).toBe('3');
      handle.dispatchEvent(pointerEvent('pointerup', 190, 10));
    });

    it('resizes the start edge of a timed chip, keeping the end pinned', () => {
      const chipEl = query<HTMLElement>(
        root,
        '.mlv-scheduler-time-grid__column .mlv-scheduler-event',
      );
      vi.spyOn(
        closest<HTMLElement>(chipEl, '.mlv-scheduler-time-grid__column'),
        'getBoundingClientRect',
      ).mockReturnValue(columnRect);
      const handle = query<HTMLElement>(
        chipEl,
        '.mlv-scheduler-event__resize-handle--start',
      );

      // The chip is 09:00-09:30 at top 37.5% / height 8.333%. y = 320 of 960 is
      // 8:00, so the start moves back an hour and the end must not move.
      handle.dispatchEvent(pointerEvent('pointerdown', 50, 440));
      handle.dispatchEvent(pointerEvent('pointermove', 50, 320));
      expect(
        parseFloat(chipEl.style.getPropertyValue('--mlv-scheduler-event-top')),
      ).toBeCloseTo(33.3333, 3);
      expect(
        parseFloat(
          chipEl.style.getPropertyValue('--mlv-scheduler-event-height'),
        ),
      ).toBeCloseTo(12.5, 3);
      handle.dispatchEvent(pointerEvent('pointerup', 50, 320));

      expect(ctx.commits).toHaveLength(1);
      expect(ctx.commits[0].kind).toBe('resize');
      expect(ctx.commits[0].next.start).toEqual(new Date(2026, 8, 2, 8));
      expect(ctx.commits[0].next.end).toEqual(new Date(2026, 8, 2, 9, 30));
    });

    it('resizes the start edge of a lane bar by whole days, mirrored in RTL', () => {
      const chipEl = query<HTMLElement>(
        root,
        '.mlv-scheduler-month__lanes .mlv-scheduler-event',
      );
      vi.spyOn(
        closest<HTMLElement>(chipEl, '[data-day-index]'),
        'getBoundingClientRect',
      ).mockReturnValue(cellRect);
      const handle = query<HTMLElement>(
        chipEl,
        '.mlv-scheduler-event__resize-handle--start',
      );

      // The bar is Sep 1 -> Sep 3 exclusive at dayIndex 1, span 2. Travelling
      // one cell toward inline-end pulls the START forward to Sep 2: span 1,
      // and the bar slides one cell so it still ends where it did.
      handle.dispatchEvent(pointerEvent('pointerdown', 330, 10));
      handle.dispatchEvent(pointerEvent('pointermove', 470, 10));
      expect(chipEl.style.getPropertyValue('--mlv-scheduler-span')).toBe('1');
      expect(chipEl.style.getPropertyValue('--mlv-scheduler-lane-shift')).toBe(
        '120px',
      );
      handle.dispatchEvent(pointerEvent('pointerup', 470, 10));
      expect(present(ctx.commits.at(-1), 'a commit').next.start).toEqual(
        new Date(2026, 8, 2),
      );
      expect(present(ctx.commits.at(-1), 'a commit').next.end).toEqual(
        new Date(2026, 8, 3),
      );

      // Put the two-day bar back so the mirrored gesture makes the SAME
      // transition, not one that starts from the already-resized range.
      ctx.events.set([
        { id: 'lane', title: 'Offsite', start: d(1), end: d(3), allDay: true },
      ]);
      rtl.setDirection('rtl');
      fixture.detectChanges();
      chipEl.style.setProperty('--mlv-scheduler-span', '2');
      // The same day step is the mirrored physical direction in RTL.
      handle.dispatchEvent(pointerEvent('pointerdown', 330, 10));
      handle.dispatchEvent(pointerEvent('pointermove', 190, 10));
      expect(chipEl.style.getPropertyValue('--mlv-scheduler-span')).toBe('1');
      expect(chipEl.style.getPropertyValue('--mlv-scheduler-lane-shift')).toBe(
        '120px',
      );
      handle.dispatchEvent(pointerEvent('pointerup', 190, 10));
      // The preview vars alone would still pass if the commit resolved the
      // unmirrored cell, so assert the committed range too: an unmirrored RTL
      // step would push the start back to Aug 31 and stretch the end instead.
      expect(present(ctx.commits.at(-1), 'a commit').next.start).toEqual(
        new Date(2026, 8, 2),
      );
      expect(present(ctx.commits.at(-1), 'a commit').next.end).toEqual(
        new Date(2026, 8, 3),
      );
    });

    it('reads the owning column geometry once per gesture, not per pointermove', () => {
      const chipEl = query<HTMLElement>(
        root,
        '.mlv-scheduler-time-grid__column .mlv-scheduler-event',
      );
      const rects = vi
        .spyOn(
          closest<HTMLElement>(chipEl, '.mlv-scheduler-time-grid__column'),
          'getBoundingClientRect',
        )
        .mockReturnValue(columnRect);
      const handle = query<HTMLElement>(
        chipEl,
        '.mlv-scheduler-event__resize-handle--end',
      );
      handle.dispatchEvent(pointerEvent('pointerdown', 50, 440));
      for (const y of [500, 520, 540, 560]) {
        handle.dispatchEvent(pointerEvent('pointermove', 50, y));
      }
      handle.dispatchEvent(pointerEvent('pointerup', 50, 560));
      expect(rects).toHaveBeenCalledTimes(1);
    });

    it('restores the geometry and swallows the trailing click when Escape cancels', () => {
      const chipEl = query<HTMLElement>(
        root,
        '.mlv-scheduler-time-grid__column .mlv-scheduler-event',
      );
      vi.spyOn(
        closest<HTMLElement>(chipEl, '.mlv-scheduler-time-grid__column'),
        'getBoundingClientRect',
      ).mockReturnValue(columnRect);
      const handle = query<HTMLElement>(
        chipEl,
        '.mlv-scheduler-event__resize-handle--end',
      );
      handle.dispatchEvent(pointerEvent('pointerdown', 50, 440));
      handle.dispatchEvent(pointerEvent('pointermove', 50, 600));
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      expect(
        chipEl.style.getPropertyValue('--mlv-scheduler-event-height'),
      ).toBe('8.333%');
      expect(ctx.commits).toHaveLength(0);
      // The pointer is still down: its release still produces a click, which
      // must not reach `eventClick`.
      chipEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(
        (ctx.context.emitEventInteraction as ReturnType<typeof vi.fn>).mock
          .calls,
      ).toHaveLength(0);
    });

    it('renders one handle per resizable edge and drops the ones that continue', () => {
      const handles = () =>
        Array.from(
          chip.querySelectorAll('.mlv-scheduler-event__resize-handle'),
        ).map((el) =>
          el.classList.contains('mlv-scheduler-event__resize-handle--start')
            ? 'start'
            : 'end',
        );
      expect(handles()).toEqual(['start', 'end']);
      expect(chip.querySelectorAll('.mlv-scheduler-event__grip')).toHaveLength(
        2,
      );

      host.before.set(true);
      fixture.detectChanges();
      expect(handles()).toEqual(['end']);

      host.before.set(false);
      host.after.set(true);
      fixture.detectChanges();
      expect(handles()).toEqual(['start']);

      host.before.set(true);
      fixture.detectChanges();
      expect(handles()).toEqual([]);
    });

    it('does not render a handle when not resizable', () => {
      ctx.editable.set(false);
      fixture.detectChanges();
      expect(
        root.querySelector('.mlv-scheduler-event__resize-handle'),
      ).toBeNull();
    });
  });
  describe('keyboard move and resize', () => {
    /** The Task 9 chip, now wrapped in a fake time-grid column: `a`, Wed 2 Sep 09:00–09:30. */
    const timedChip = () =>
      query<HTMLElement>(
        root,
        '.mlv-scheduler-time-grid__column .mlv-scheduler-event',
      );
    /** The Task 13 chip: `lane`, all-day Tue 1 Sep -> Thu 3 Sep exclusive. */
    const laneChip = () =>
      query<HTMLElement>(
        root,
        '.mlv-scheduler-month__lanes .mlv-scheduler-event',
      );

    it('moves a timed chip by one snap step with Alt+ArrowDown and keeps focus on it', () => {
      const event = key(timedChip(), 'ArrowDown', { altKey: true });
      expect(event.defaultPrevented).toBe(true);
      const { kind, next, source } = ctx.commits[0];
      expect(kind).toBe('move');
      expect(source).toBe('keyboard');
      // snap defaults to 30 in the test context (= slotDuration), so 09:00 -> 09:30.
      expect(next).toEqual({
        start: new Date(2026, 8, 2, 9, 30),
        end: new Date(2026, 8, 2, 10, 0),
        allDay: false,
      });
      // `dayIndex` is the segment the move was made from, carried so a
      // multi-day event restores focus onto that chip rather than its first.
      expect(ctx.context.pendingFocus()).toEqual({
        kind: 'event',
        id: 'a',
        dayIndex: 2,
      });
    });

    it('clamps a timed keyboard move to the visible time axis', () => {
      // 09:00 is the first slot of an 09:00-17:00 axis, so Alt+ArrowUp has
      // nowhere to go. Unclamped it wrote 08:30: the chip stopped rendering and
      // the `pendingFocus` armed alongside the commit could never resolve.
      ctx.minMinutes.set(540);
      ctx.maxMinutes.set(1020);
      fixture.detectChanges();
      const event = key(timedChip(), 'ArrowUp', { altKey: true });
      expect(ctx.commits).toHaveLength(0);
      expect(ctx.context.pendingFocus()).toBeNull();
      // Still the chip's key to consume - it must not bubble into the grid and
      // rove the roving focus off the chip.
      expect(event.defaultPrevented).toBe(true);
      // The next placement inside the axis stays reachable.
      key(timedChip(), 'ArrowDown', { altKey: true });
      expect(ctx.commits[0].next.start).toEqual(new Date(2026, 8, 2, 9, 30));
    });

    it('clamps a timed keyboard move at the far end of the axis too', () => {
      ctx.minMinutes.set(540);
      ctx.maxMinutes.set(1020);
      host.normalized.set(
        norm({ id: 'a', title: 'A', start: d(2, 16, 30), end: d(2, 17) }),
      );
      fixture.detectChanges();
      // 16:30 -> 17:00 already ends on `maxTime`, so a downward step would push
      // the chip past the last rendered slot.
      key(timedChip(), 'ArrowDown', { altKey: true });
      expect(ctx.commits).toHaveLength(0);
      key(timedChip(), 'ArrowUp', { altKey: true });
      expect(ctx.commits[0].next.start).toEqual(new Date(2026, 8, 2, 16, 0));
    });

    it('moves a timed chip forward one day with Alt+ArrowRight', () => {
      key(timedChip(), 'ArrowRight', { altKey: true });
      expect(ctx.commits[0].next.start).toEqual(new Date(2026, 8, 3, 9));
    });

    it('mirrors the horizontal move in RTL: Alt+ArrowLeft is "next"', () => {
      // A fresh fixture, so this starts from Sep 2 again. (The timed chip's
      // `normalized` is a plain signal, not derived from `ctx.events()`, so a
      // commit does not move it - but keep the two directions in separate
      // `it` blocks anyway: the assertion must not depend on that detail.)
      rtl.setDirection('rtl');
      fixture.detectChanges();
      key(timedChip(), 'ArrowLeft', { altKey: true });
      expect(ctx.commits[0].next.start).toEqual(new Date(2026, 8, 3, 9));
    });

    it('moves a lane bar by a week with Alt+ArrowDown', () => {
      key(laneChip(), 'ArrowDown', { altKey: true });
      // shiftDays(+7) on both edges: Sep 1 -> Sep 8, Sep 3 -> Sep 10.
      expect(ctx.commits[0].next).toEqual({
        start: new Date(2026, 8, 8),
        end: new Date(2026, 8, 10),
        allDay: true,
      });
    });

    it('moves a lane bar by a day with Alt+ArrowRight', () => {
      // Separate `it` on purpose: `laneEvent()` IS derived from `ctx.events()`,
      // so a preceding commit would move the bar and this expectation would
      // have to be recomputed from Sep 8 instead of Sep 1.
      key(laneChip(), 'ArrowRight', { altKey: true });
      expect(ctx.commits[0].next).toEqual({
        start: new Date(2026, 8, 2),
        end: new Date(2026, 8, 4),
        allDay: true,
      });
    });

    it('resizes a timed chip end edge with Alt+Shift+ArrowDown', () => {
      key(timedChip(), 'ArrowDown', { altKey: true, shiftKey: true });
      expect(ctx.commits[0].kind).toBe('resize');
      expect(ctx.commits[0].source).toBe('keyboard');
      expect(ctx.commits[0].next.end).toEqual(new Date(2026, 8, 2, 10, 0)); // 09:30 + snap 30
    });

    it('shrinks a lane bar to one day and then refuses to go below it', () => {
      const bar = laneChip();
      // Sep 1 -> Sep 3 exclusive; Alt+Shift+ArrowLeft pulls the exclusive end
      // back one calendar day to Sep 2, which is exactly the one-day minimum.
      key(bar, 'ArrowLeft', { altKey: true, shiftKey: true });
      expect(ctx.commits[0].next.end).toEqual(new Date(2026, 8, 2));
      // The test context's `commitChange` already wrote that range back into
      // `events`, and `laneEvent()` is a computed over it, so the bar is now a
      // one-day bar. A second press would produce Sep 1, below `minEnd` (Sep 2),
      // so `_keyboardResize` returns null and nothing commits.
      fixture.detectChanges();
      key(bar, 'ArrowLeft', { altKey: true, shiftKey: true });
      expect(ctx.commits).toHaveLength(1);
    });

    it('navigates when a move leaves the visible range', () => {
      ctx.days.set([new Date(2026, 8, 2)]); // day view: only Sep 2 visible
      fixture.detectChanges();
      key(timedChip(), 'ArrowRight', { altKey: true });
      expect(ctx.context.goTo).toHaveBeenCalledWith(new Date(2026, 8, 3, 9));
    });

    it('ignores modifiers when not editable', () => {
      ctx.editable.set(false);
      fixture.detectChanges();
      const event = key(timedChip(), 'ArrowDown', { altKey: true });
      expect(event.defaultPrevented).toBe(false);
      expect(ctx.commits).toHaveLength(0);
    });

    it('resizes the start edge of a timed chip with Ctrl+Alt+ArrowUp and clamps at one snap', () => {
      key(timedChip(), 'ArrowUp', { altKey: true, ctrlKey: true });
      expect(ctx.commits[0].kind).toBe('resize');
      expect(ctx.commits[0].source).toBe('keyboard');
      expect(ctx.commits[0].next).toEqual({
        start: new Date(2026, 8, 2, 8, 30),
        end: new Date(2026, 8, 2, 9, 30),
        allDay: false,
      });
      // The chip is 09:00-09:30, exactly one snap long: pulling the start
      // forward would leave nothing, so nothing commits.
      key(timedChip(), 'ArrowDown', { altKey: true, ctrlKey: true });
      expect(ctx.commits).toHaveLength(1);
    });

    it('resizes the start edge of a lane bar with Ctrl+Alt+Arrow', () => {
      key(laneChip(), 'ArrowRight', { altKey: true, ctrlKey: true });
      expect(ctx.commits[0].next).toEqual({
        start: new Date(2026, 8, 2),
        end: new Date(2026, 8, 3),
        allDay: true,
      });
    });

    it('leaves Alt+Shift+ArrowLeft on a timed chip to the grid', () => {
      // A timed chip resizes on the block axis only. Swallowing the key here
      // would silently kill the grid's own Shift+Arrow selection.
      const event = key(timedChip(), 'ArrowLeft', {
        altKey: true,
        shiftKey: true,
      });
      expect(event.defaultPrevented).toBe(false);
      expect(ctx.commits).toHaveLength(0);
    });

    it('Escape focuses the owning cell', () => {
      const bar = laneChip();
      const cellEl = closest<HTMLElement>(bar, '[data-day-index]');
      cellEl.tabIndex = -1;
      key(bar, 'Escape');
      expect(document.activeElement).toBe(cellEl);
    });
  });

  describe('projected interactive content', () => {
    /** Renders a focusable control inside every chip through the consumer def. */
    function useButtonDef(): void {
      const def = fixture.debugElement
        .queryAllNodes((n) => !!n.injector.get(MlvSchedulerEventDef, null))[0]
        .injector.get(MlvSchedulerEventDef).templateRef;
      ctx.eventDef.set(def);
      fixture.detectChanges();
    }

    it('leaves clicks and keys from a projected control alone', () => {
      useButtonDef();
      const inner = query<HTMLElement>(chip, '.custom-action');
      inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const enter = key(inner, 'Enter');
      const move = key(inner, 'ArrowDown', { altKey: true });
      expect(
        (ctx.context.emitEventInteraction as ReturnType<typeof vi.fn>).mock
          .calls,
      ).toHaveLength(0);
      expect(enter.defaultPrevented).toBe(false);
      expect(move.defaultPrevented).toBe(false);
      expect(ctx.commits).toHaveLength(0);
      // The chip itself still activates.
      chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(
        (ctx.context.emitEventInteraction as ReturnType<typeof vi.fn>).mock
          .calls,
      ).toHaveLength(1);
    });

    it('marks the drag ghost inert so a projected control leaves the focus and a11y trees', () => {
      useButtonDef();
      host.normalized.set({
        ...norm({
          id: 'a',
          title: 'Standup',
          start: d(2, 9),
          end: d(2, 9, 30),
        }),
        ghost: true,
      });
      fixture.detectChanges();
      expect(chip.getAttribute('inert')).toBe('');
      expect(chip.getAttribute('aria-hidden')).toBe('true');
      expect(chip.hasAttribute('role')).toBe(false);
      expect(chip.querySelector('.custom-action')).not.toBeNull();
    });
  });

  it('shows only the start time on a timed chip rendered in a lane', () => {
    // A timed bar of >= 24 h is laid out in a lane; the end time belongs to
    // another day, so the chip shows the start alone.
    host.normalized.set(
      norm({ id: 'a', title: 'Trip', start: d(2, 9), end: d(4, 17) }),
    );
    host.lane.set(true);
    fixture.detectChanges();
    expect(chip.querySelector('.mlv-scheduler-event__time')?.textContent).toBe(
      '9:00 AM',
    );
    // The default (time-axis) rendering keeps both ends.
    host.lane.set(false);
    fixture.detectChanges();
    expect(
      chip.querySelector('.mlv-scheduler-event__time')?.textContent,
    ).toMatch(/9:00 AM.*5:00 PM/);
  });

  it('isolates the bidi context of the time text', () => {
    // "9:00 AM - 9:30 AM" is a digit + Latin run: inside an RTL paragraph it
    // would reorder to "AM 9:00" without an isolate.
    expect(
      chip.querySelector('.mlv-scheduler-event__time > bdi'),
    ).not.toBeNull();
  });
});

// jsdom applies no stylesheet and models no hover, so the grip's visibility
// contract is asserted on the compiled CSS text.
describe('MlvSchedulerEventChip styles', () => {
  let css: string;

  beforeAll(() => {
    css = stripCssLayersFromText(
      compile(
        fileURLToPath(
          new URL(['.', 'scheduler-event.scss'].join('/'), import.meta.url),
        ),
      ).css,
    );
  });

  it('hides the grip until the chip is hovered or focused', () => {
    expect(css).toMatch(
      /\.mlv-scheduler-event__grip\s*\{[^}]*opacity:\s*0[;\s}]/,
    );
    expect(css).toMatch(
      /\.mlv-scheduler-event:hover\s+\.mlv-scheduler-event__grip,\s*\.mlv-scheduler-event:focus-visible\s+\.mlv-scheduler-event__grip\s*\{[^}]*opacity:\s*1/,
    );
  });

  it('shows the grip permanently where there is no hover', () => {
    const query = css.slice(css.indexOf('@media (hover: none)'));
    expect(query).toMatch(/\.mlv-scheduler-event__grip\s*\{[^}]*opacity:\s*1/);
  });

  it('keeps the hit strip at least 0.375rem on both edges and off the touch-scroll path', () => {
    expect(css).toMatch(
      /\.mlv-scheduler-event__resize-handle\s*\{[^}]*touch-action:\s*none/,
    );
    expect(css).toMatch(
      /\.mlv-scheduler-event--timed\s+\.mlv-scheduler-event__resize-handle\s*\{[^}]*block-size:\s*0\.375rem/,
    );
    expect(css).toMatch(
      /\.mlv-scheduler-event--all-day\s+\.mlv-scheduler-event__resize-handle\s*\{[^}]*inline-size:\s*0\.375rem/,
    );
  });
});
