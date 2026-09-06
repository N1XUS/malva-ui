import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import axe from 'axe-core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MLV_DATE_LOCALE } from '@malva-ui/core/date';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenuItem } from '@malva-ui/core/menu';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvScheduler } from './scheduler';
import {
  MlvSchedulerEventMenuDef,
  MlvSchedulerSlotMenuDef,
} from './scheduler-defs';
import type {
  MlvSchedulerEvent,
  MlvSchedulerEventInteraction,
  MlvSchedulerNextRange,
  MlvSchedulerRangeSelectEvent,
  MlvSchedulerSlotEvent,
  MlvSchedulerView,
} from './scheduler.types';
import { focused, query } from '../testing/scheduler-test-dom';

const d = (day: number, h = 0, m = 0, month = 8) =>
  new Date(2026, month, day, h, m);

/** A `contextmenu` event that looks like a real right-click. */
function rightClick(x = 120, y = 90): MouseEvent {
  return new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 2,
    buttons: 2,
    detail: 0,
  });
}

/** The `contextmenu` event browsers synthesise for Shift+F10 / the ContextMenu key. */
function keyboardContextMenu(): MouseEvent {
  return new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 0,
    clientY: 0,
    button: 0,
    buttons: 0,
    detail: 0,
  });
}

/**
 * The `keydown` of Shift+F10 — on macOS the only event a browser delivers for
 * it, so the scheduler must open its menu from the key itself.
 */
function shiftF10(): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'F10',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
}

/** Waits for the macrotask queue so `setTimeout(…, 0)` focus hops settle. */
function flushTimers(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function key(
  target: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

@Component({
  imports: [
    MlvScheduler,
    MlvSchedulerSlotMenuDef,
    MlvSchedulerEventMenuDef,
    MlvListItem,
    MlvMenuItem,
  ],
  template: `
    <mlv-scheduler
      [(events)]="events"
      [(view)]="view"
      [date]="date()"
      [maxTime]="maxTime()"
      [slotDuration]="slotDuration()"
      [mlvDensity]="density()"
      (slotContextMenu)="slotMenus.push($event)"
      (eventContextMenu)="eventMenus.push($event)"
      (rangeSelect)="ranges.push($event)"
      style="block-size: 36rem"
    >
      @if (withSlotMenu()) {
        <ng-template
          mlvSchedulerSlotMenuDef
          let-range
          let-selection="selection"
          let-view="view"
        >
          <mlv-list-item
            mlvMenuItem
            class="slot-item"
            (itemClick)="created.push(range)"
          >
            New event in {{ view }}
          </mlv-list-item>
          @if (selection) {
            <mlv-list-item mlvMenuItem class="selection-item">
              Block selection
            </mlv-list-item>
          }
        </ng-template>
      }
      @if (withEventMenu()) {
        <ng-template mlvSchedulerEventMenuDef let-event let-view="view">
          <mlv-list-item
            mlvMenuItem
            class="event-item"
            (itemClick)="edited.push(event)"
          >
            Edit {{ event.title }} in {{ view }}
          </mlv-list-item>
        </ng-template>
      }
    </mlv-scheduler>
  `,
})
class Host {
  readonly events = signal<MlvSchedulerEvent[]>([
    { id: 'a', title: 'Standup', start: d(2, 9), end: d(2, 9, 30) },
    { id: 'b', title: 'Offsite', start: d(3), end: d(5), allDay: true },
  ]);
  readonly view = signal<MlvSchedulerView>('month');
  readonly date = signal(d(2));
  readonly maxTime = signal('24:00');
  readonly slotDuration = signal(30);
  readonly density = signal<MlvDensity | undefined>(undefined);
  readonly withSlotMenu = signal(true);
  readonly withEventMenu = signal(true);
  readonly slotMenus: MlvSchedulerSlotEvent[] = [];
  readonly eventMenus: MlvSchedulerEventInteraction[] = [];
  readonly ranges: MlvSchedulerRangeSelectEvent[] = [];
  readonly created: MlvSchedulerNextRange[] = [];
  readonly edited: MlvSchedulerEvent[] = [];
}

describe('MlvScheduler context menus', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let el: HTMLElement;
  let overlayContainer: OverlayContainer;
  let overlay: HTMLElement;

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
    await fixture.whenStable();
    el = fixture.nativeElement.querySelector('mlv-scheduler');
    overlayContainer = TestBed.inject(OverlayContainer);
    overlay = overlayContainer.getContainerElement();
  });

  afterEach(() => overlayContainer.ngOnDestroy());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Month cell / all-day cell of visible day `index` (0 = Mon 31 Aug 2026). */
  const dayCell = (index: number) =>
    query(el, `[data-day-index="${index}"][data-minutes="all-day"]`);
  /** Time-grid slot of visible day `index` starting at `minutes`. */
  const slot = (index: number, minutes: number) =>
    query(el, `[data-day-index="${index}"][data-minutes="${minutes}"]`);
  const chip = (id: string) =>
    query(el, `.mlv-scheduler-event[data-event-id="${id}"]`);
  const panel = () => overlay.querySelector<HTMLElement>('[role="menu"]');

  /** Completes the popup's leave animation by hand — jsdom fires no `animationend`. */
  async function finishLeave(): Promise<void> {
    await settle();
    overlay
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await settle();
  }

  it('opens the event menu on a chip right-click with the event as $implicit and still emits eventContextMenu', async () => {
    const event = rightClick();
    chip('a').dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(panel()).toBeTruthy();
    expect(query(overlay, '.event-item').textContent?.trim()).toBe(
      'Edit Standup in month',
    );
    expect(overlay.querySelector('.slot-item')).toBeNull();
    expect(host.eventMenus.map((e) => e.event.id)).toEqual(['a']);
    expect(panel()?.getAttribute('aria-label')).toBe('Actions for Standup');
  });

  it('opens the slot menu on an empty month cell with the whole day as the range, and closes on activation', async () => {
    const event = rightClick();
    dayCell(10).dispatchEvent(event); // Thu 10 Sep
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(query(overlay, '.slot-item').textContent?.trim()).toBe(
      'New event in month',
    );
    expect(overlay.querySelector('.selection-item')).toBeNull();
    expect(overlay.querySelector('.event-item')).toBeNull();
    expect(host.slotMenus.map((e) => e.date)).toEqual([d(10)]);
    expect(panel()?.getAttribute('aria-label')).toBe(
      'Actions for Thursday, September 10, 2026',
    );

    query(overlay, '.slot-item').click();
    await finishLeave();

    expect(host.created).toEqual([{ start: d(10), end: d(11), allDay: true }]);
    expect(panel()).toBeNull();
  });

  it('uses the slot duration as the range on the time grid', async () => {
    host.view.set('week');
    await settle();

    slot(2, 570).dispatchEvent(rightClick()); // Wed 2 Sep, 09:30
    await settle();
    expect(query(overlay, '.slot-item').textContent?.trim()).toBe(
      'New event in week',
    );
    expect(panel()?.getAttribute('aria-label')).toBe(
      'Actions for Sep 2, 9:30 AM',
    );

    query(overlay, '.slot-item').click();
    await finishLeave();

    expect(host.created).toEqual([
      { start: d(2, 9, 30), end: d(2, 10), allDay: false },
    ]);
  });

  it('hands a pending keyboard selection to the slot menu when the cell is inside it', async () => {
    const anchor = dayCell(10);
    anchor.focus();
    key(anchor, 'ArrowRight', { shiftKey: true });
    key(anchor, 'ArrowRight', { shiftKey: true });
    await settle();
    expect(dayCell(12).getAttribute('aria-selected')).toBe('true');

    dayCell(11).dispatchEvent(rightClick());
    await settle();
    expect(overlay.querySelector('.selection-item')).toBeTruthy();
    query(overlay, '.slot-item').click();
    await finishLeave();
    expect(host.created).toEqual([{ start: d(10), end: d(13), allDay: true }]);

    // A cell outside the selection gets its own day, not the selection.
    dayCell(5).dispatchEvent(rightClick());
    await settle();
    expect(overlay.querySelector('.selection-item')).toBeNull();
    query(overlay, '.slot-item').click();
    await finishLeave();
    expect(host.created.at(-1)).toEqual({
      start: d(5),
      end: d(6),
      allDay: true,
    });
  });

  it('releases the pending month selection once the menu that took it is activated, so Enter commits nothing', async () => {
    const anchor = dayCell(10);
    anchor.focus();
    key(anchor, 'ArrowRight', { shiftKey: true });
    await settle();
    expect(dayCell(11).getAttribute('aria-selected')).toBe('true');

    dayCell(11).dispatchEvent(rightClick());
    await settle();
    query(overlay, '.selection-item').click();
    await finishLeave();

    expect(panel()).toBeNull();
    expect(dayCell(10).getAttribute('aria-selected')).toBeNull();
    expect(dayCell(11).getAttribute('aria-selected')).toBeNull();
    key(focused(), 'Enter');
    await settle();
    expect(host.ranges).toEqual([]);
  });

  it('releases the pending month selection when the menu that took it is dismissed with Escape', async () => {
    const anchor = dayCell(10);
    anchor.focus();
    key(anchor, 'ArrowRight', { shiftKey: true });
    await settle();

    dayCell(10).dispatchEvent(keyboardContextMenu());
    await settle();
    await flushTimers();
    await settle();
    expect(focused()).toBe(query(overlay, '.slot-item'));

    focused().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await finishLeave();

    expect(panel()).toBeNull();
    expect(focused()).toBe(dayCell(10));
    expect(dayCell(10).getAttribute('aria-selected')).toBeNull();
    expect(dayCell(11).getAttribute('aria-selected')).toBeNull();
  });

  it('keeps a pending selection the menu did not take', async () => {
    const anchor = dayCell(10);
    anchor.focus();
    key(anchor, 'ArrowRight', { shiftKey: true });
    await settle();

    dayCell(5).dispatchEvent(rightClick());
    await settle();
    expect(overlay.querySelector('.selection-item')).toBeNull();
    query(overlay, '.slot-item').click();
    await finishLeave();

    expect(dayCell(10).getAttribute('aria-selected')).toBe('true');
    expect(dayCell(11).getAttribute('aria-selected')).toBe('true');
  });

  it('hands a pending time-grid selection to the slot menu and releases it on close', async () => {
    host.view.set('week');
    await settle();

    const anchor = slot(2, 540);
    anchor.focus();
    key(anchor, 'ArrowDown', { shiftKey: true });
    key(anchor, 'ArrowDown', { shiftKey: true });
    await settle();
    expect(slot(2, 600).getAttribute('aria-selected')).toBe('true');

    slot(2, 570).dispatchEvent(rightClick());
    await settle();
    expect(overlay.querySelector('.selection-item')).toBeTruthy();
    expect(panel()?.getAttribute('aria-label')).toBe(
      'Actions for Sep 2, 9:00 AM',
    );
    query(overlay, '.slot-item').click();
    await finishLeave();

    expect(host.created).toEqual([
      { start: d(2, 9), end: d(2, 10, 30), allDay: false },
    ]);
    expect(slot(2, 540).getAttribute('aria-selected')).toBeNull();
    expect(slot(2, 600).getAttribute('aria-selected')).toBeNull();
  });

  it('uses the whole day as the range on an all-day cell of the week view', async () => {
    host.view.set('week');
    await settle();

    dayCell(2).dispatchEvent(rightClick()); // Wed 2 Sep all-day cell
    await settle();

    expect(panel()?.getAttribute('aria-label')).toBe(
      'Actions for Wednesday, September 2, 2026',
    );
    query(overlay, '.slot-item').click();
    await finishLeave();

    expect(host.created).toEqual([{ start: d(2), end: d(3), allDay: true }]);
  });

  it('clamps the slot range to maxTime and maps the end of the axis to the next midnight', async () => {
    host.view.set('week');
    host.maxTime.set('09:30');
    host.slotDuration.set(60);
    await settle();

    slot(2, 540).dispatchEvent(rightClick()); // 09:00, the axis ends at 09:30
    await settle();
    query(overlay, '.slot-item').click();
    await finishLeave();
    expect(host.created.at(-1)).toEqual({
      start: d(2, 9),
      end: d(2, 9, 30),
      allDay: false,
    });

    host.maxTime.set('24:00');
    host.slotDuration.set(30);
    await settle();

    slot(2, 1410).dispatchEvent(rightClick()); // 23:30, the last slot
    await settle();
    query(overlay, '.slot-item').click();
    await finishLeave();
    expect(host.created.at(-1)).toEqual({
      start: d(2, 23, 30),
      end: d(3),
      allDay: false,
    });
  });

  it('forwards the resolved density to the detached panel', async () => {
    host.density.set('compact');
    await settle();

    chip('a').dispatchEvent(rightClick());
    await settle();

    expect(
      overlay.querySelector('.mlv-popup')?.classList.contains('mlv--compact'),
    ).toBe(true);
  });

  it('opens from the keyboard anchored to the focused chip, focuses the first item and returns focus on Escape', async () => {
    const target = chip('a');
    target.focus();

    target.dispatchEvent(keyboardContextMenu());
    await settle();
    await flushTimers();
    await settle();

    expect(focused()).toBe(query(overlay, '.event-item'));

    focused().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await finishLeave();

    expect(panel()).toBeNull();
    expect(focused()).toBe(target);
  });

  it('opens the event menu on Shift+F10 on a focused chip, anchored with the first item focused, and returns focus on Escape', async () => {
    const target = chip('a');
    target.focus();

    const event = shiftF10();
    target.dispatchEvent(event);
    await settle();
    await flushTimers();
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(panel()?.getAttribute('aria-label')).toBe('Actions for Standup');
    expect(focused()).toBe(query(overlay, '.event-item'));
    expect(host.eventMenus.map((e) => e.event.id)).toEqual(['a']);

    focused().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await finishLeave();

    expect(panel()).toBeNull();
    expect(focused()).toBe(target);
  });

  it('opens the slot menu on the ContextMenu key on a focused month cell with the whole day as the range', async () => {
    const cell = dayCell(10);
    cell.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'ContextMenu',
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(event);
    await settle();
    await flushTimers();
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(panel()?.getAttribute('aria-label')).toBe(
      'Actions for Thursday, September 10, 2026',
    );
    expect(focused()).toBe(query(overlay, '.slot-item'));
    expect(host.slotMenus.map((e) => e.date)).toEqual([d(10)]);

    // Released with focus already inside the panel: the keyup Windows would
    // synthesise a second contextmenu from is claimed there too.
    const release = new KeyboardEvent('keyup', {
      key: 'ContextMenu',
      bubbles: true,
      cancelable: true,
    });
    focused()?.dispatchEvent(release);
    expect(release.defaultPrevented).toBe(true);

    query(overlay, '.slot-item').click();
    await finishLeave();
    expect(host.created).toEqual([{ start: d(10), end: d(11), allDay: true }]);
    expect(focused()).toBe(cell);
  });

  it('hands a pending selection to the slot menu on Shift+F10 inside it and keeps it until the menu closes', async () => {
    const anchor = dayCell(10);
    anchor.focus();
    key(anchor, 'ArrowRight', { shiftKey: true });
    key(anchor, 'ArrowRight', { shiftKey: true });
    await settle();
    expect(dayCell(12).getAttribute('aria-selected')).toBe('true');

    // Focus stays on the anchor while the head moves, so the key lands there.
    anchor.dispatchEvent(shiftF10());
    await settle();
    await flushTimers();
    await settle();

    expect(overlay.querySelector('.selection-item')).toBeTruthy();
    // Opening did not abandon the selection the way a plain key would.
    expect(dayCell(12).getAttribute('aria-selected')).toBe('true');

    query(overlay, '.slot-item').click();
    await finishLeave();
    expect(host.created).toEqual([{ start: d(10), end: d(13), allDay: true }]);
    expect(dayCell(12).getAttribute('aria-selected')).toBeNull();
  });

  it('opens the slot menu on Shift+F10 on a focused time-grid slot', async () => {
    host.view.set('week');
    await settle();

    const target = slot(2, 570);
    target.focus();
    const event = shiftF10();
    target.dispatchEvent(event);
    await settle();
    await flushTimers();
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(panel()?.getAttribute('aria-label')).toBe(
      'Actions for Sep 2, 9:30 AM',
    );
    expect(focused()).toBe(query(overlay, '.slot-item'));
    query(overlay, '.slot-item').click();
    await finishLeave();
    expect(host.created).toEqual([
      { start: d(2, 9, 30), end: d(2, 10), allDay: false },
    ]);
  });

  it('claims the key without a def — prevented, so the browser synthesises no second contextmenu — opens nothing and emits once', async () => {
    host.withEventMenu.set(false);
    await settle();

    const target = chip('a');
    target.focus();
    const event = shiftF10();
    target.dispatchEvent(event);
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(panel()).toBeNull();
    expect(host.eventMenus.map((e) => e.event.id)).toEqual(['a']);
    expect(host.eventMenus[0].nativeEvent).toBe(event);

    // The ContextMenu key: Windows synthesises from its keyup, so that is
    // claimed too — on whatever element it lands.
    const press = new KeyboardEvent('keydown', {
      key: 'ContextMenu',
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(press);
    await settle();
    expect(press.defaultPrevented).toBe(true);
    expect(host.eventMenus.length).toBe(2);
    const release = new KeyboardEvent('keyup', {
      key: 'ContextMenu',
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(release);
    expect(release.defaultPrevented).toBe(true);

    // A held key's repeats are claimed but emit nothing more.
    const repeat = shiftF10();
    Object.defineProperty(repeat, 'repeat', { value: true });
    target.dispatchEvent(repeat);
    await settle();
    expect(repeat.defaultPrevented).toBe(true);
    expect(host.eventMenus.length).toBe(2);
  });

  it('re-targets an open menu on a second right-click instead of stacking a panel', async () => {
    chip('a').dispatchEvent(rightClick());
    await settle();
    expect(overlay.querySelector('.event-item')).toBeTruthy();

    dayCell(10).dispatchEvent(rightClick(300, 300));
    await settle();

    expect(overlay.querySelectorAll('[role="menu"]').length).toBe(1);
    expect(overlay.querySelector('.event-item')).toBeNull();
    expect(overlay.querySelector('.slot-item')).toBeTruthy();
  });

  it('leaves the native event alone and opens nothing when the matching def is missing', async () => {
    host.withEventMenu.set(false);
    await settle();

    const onChip = rightClick();
    chip('a').dispatchEvent(onChip);
    await settle();
    expect(onChip.defaultPrevented).toBe(false);
    expect(panel()).toBeNull();
    expect(host.eventMenus.map((e) => e.event.id)).toEqual(['a']);

    // The slot def is still there, so cells keep their menu.
    const onCell = rightClick();
    dayCell(10).dispatchEvent(onCell);
    await settle();
    expect(onCell.defaultPrevented).toBe(true);
    expect(overlay.querySelector('.slot-item')).toBeTruthy();
  });

  it('renders no menu plumbing at all without any def', async () => {
    host.withEventMenu.set(false);
    host.withSlotMenu.set(false);
    await settle();

    expect(el.querySelector('mlv-menu')).toBeNull();
    const event = rightClick();
    dayCell(10).dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(false);
    expect(panel()).toBeNull();
    expect(host.slotMenus.map((e) => e.date)).toEqual([d(10)]);
  });

  it('passes axe with the menu open', async () => {
    chip('a').dispatchEvent(rightClick());
    await settle();

    const results = await axe.run(document.body, {
      runOnly: {
        type: 'rule',
        values: [
          'aria-allowed-attr',
          'aria-allowed-role',
          'aria-required-children',
          'aria-required-parent',
          'aria-roles',
          'aria-valid-attr',
          'aria-valid-attr-value',
          'nested-interactive',
        ],
      },
    });
    expect(results.violations).toEqual([]);
  });
});
