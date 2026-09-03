import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import axe from 'axe-core';
import { MLV_DATE_LOCALE, MlvNativeDateAdapter } from '@malva-ui/core/date';
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
  });

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
    const status = el.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('');
    scheduler.next();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    expect(status.textContent?.trim()).toBe('Showing October 2026');
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
    await Promise.resolve();
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      'Standup moved to',
    );
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
    await Promise.resolve();
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent).toBe(
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
    await Promise.resolve();
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent).toBe(
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
    await Promise.resolve();
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Standup cannot be placed there',
    );
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

  it('passes axe on the toolbar', async () => {
    await expectNoAxeViolations(el);
  });
});
