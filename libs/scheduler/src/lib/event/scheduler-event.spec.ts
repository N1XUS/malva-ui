import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MlvNativeDateAdapter } from '@malva-ui/core/date';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import type { vi } from 'vitest';
import { MlvSchedulerEventChip } from './scheduler-event';
import { MLV_SCHEDULER_CONTEXT } from '../scheduler/scheduler-context';
import { MlvSchedulerEventDef } from '../scheduler/scheduler-defs';
import {
  normalizeEvent,
  type MlvSchedulerNormalizedEvent,
} from '../layout/scheduler-layout';
import type { MlvSchedulerEvent } from '../scheduler/scheduler.types';
import { createSchedulerTestContext } from '../testing/scheduler-test-context';

const d = (day: number, h = 0, m = 0) => new Date(2026, 8, day, h, m);

@Component({
  imports: [MlvSchedulerEventChip, MlvSchedulerEventDef],
  template: `
    <ng-template mlvSchedulerEventDef let-event let-allDay="allDay">
      <em class="custom">{{ event.title }}/{{ allDay }}</em>
    </ng-template>
    <mlv-scheduler-event
      [normalized]="normalized()"
      [lane]="lane()"
      [continuesBefore]="before()"
      [continuesAfter]="after()"
      [dayIndex]="2"
    />
  `,
})
class Host {
  readonly normalized = signal<MlvSchedulerNormalizedEvent>(null!);
  readonly lane = signal(false);
  readonly before = signal(false);
  readonly after = signal(false);
}

describe('MlvSchedulerEventChip', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  /** The host element — Tasks 13/14 query chips out of it after the template grows a second chip. */
  let root: HTMLElement;
  /** The single chip rendered by the Task 9 template; later tasks keep it pointing at the timed chip. */
  let chip: HTMLElement;
  let ctx: ReturnType<typeof createSchedulerTestContext>;
  const norm = (e: MlvSchedulerEvent) =>
    normalizeEvent(TestBed.inject(MlvNativeDateAdapter), e, 60);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MLV_SCHEDULER_CONTEXT,
          useFactory: () => (ctx = createSchedulerTestContext()).context,
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
    chip = root.querySelector('mlv-scheduler-event')!;
  });

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
});
