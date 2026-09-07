import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTimeline } from './timeline';
import { MlvTimelineItem } from './timeline-item';
import { MlvTimelineItemIcon } from './timeline-item-icon';
import { MlvTimelineItemMeta } from './timeline-item-meta';
import type { MlvTimelineItemDirection } from './timeline.types';

const SINGLE_LEFT = 'mlv-timeline--single-left';
const SINGLE_RIGHT = 'mlv-timeline--single-right';

@Component({
  template: `
    <mlv-timeline>
      @for (item of items(); track item.title) {
        <mlv-timeline-item [title]="item.title" [direction]="item.direction">
          {{ item.title }}
        </mlv-timeline-item>
      }
    </mlv-timeline>
  `,
  imports: [MlvTimeline, MlvTimelineItem],
})
class TimelineHost {
  readonly items = signal<
    { title: string; direction: MlvTimelineItemDirection }[]
  >([]);
}

describe('MlvTimeline', () => {
  const setup = async (
    items: { title: string; direction: MlvTimelineItemDirection }[],
  ) => {
    await TestBed.configureTestingModule({
      imports: [TimelineHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(TimelineHost);
    fixture.componentInstance.items.set(items);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const timelineEl = fixture.nativeElement.querySelector(
      'mlv-timeline',
    ) as HTMLElement;

    return { fixture, timelineEl };
  };

  it('should create', async () => {
    const { timelineEl } = await setup([]);
    expect(timelineEl).toBeTruthy();
    expect(timelineEl.getAttribute('role')).toBe('list');
  });

  it('should apply neither modifier when it has no items', async () => {
    const { timelineEl } = await setup([]);
    expect(timelineEl.classList.contains(SINGLE_LEFT)).toBe(false);
    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(false);
  });

  it('should apply the single-right modifier when every item is right', async () => {
    const { timelineEl } = await setup([
      { title: 'One', direction: 'right' },
      { title: 'Two', direction: 'right' },
    ]);
    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(true);
    expect(timelineEl.classList.contains(SINGLE_LEFT)).toBe(false);
  });

  it('should apply the single-left modifier when every item is left', async () => {
    const { timelineEl } = await setup([
      { title: 'One', direction: 'left' },
      { title: 'Two', direction: 'left' },
    ]);
    expect(timelineEl.classList.contains(SINGLE_LEFT)).toBe(true);
    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(false);
  });

  it('should apply neither modifier when directions are mixed', async () => {
    const { timelineEl } = await setup([
      { title: 'One', direction: 'left' },
      { title: 'Two', direction: 'right' },
    ]);
    expect(timelineEl.classList.contains(SINGLE_LEFT)).toBe(false);
    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(false);
  });

  it('should update the modifier when an item direction changes at runtime', async () => {
    const { fixture, timelineEl } = await setup([
      { title: 'One', direction: 'right' },
      { title: 'Two', direction: 'right' },
    ]);
    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(true);

    fixture.componentInstance.items.update((items) =>
      items.map((item) =>
        item.title === 'Two'
          ? { ...item, direction: 'left' as MlvTimelineItemDirection }
          : item,
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(false);
    expect(timelineEl.classList.contains(SINGLE_LEFT)).toBe(false);
  });

  it('should update the modifier when an item is added', async () => {
    const { fixture, timelineEl } = await setup([
      { title: 'One', direction: 'right' },
    ]);
    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(true);

    fixture.componentInstance.items.update((items) => [
      ...items,
      { title: 'Two', direction: 'left' as MlvTimelineItemDirection },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(false);
    expect(timelineEl.classList.contains(SINGLE_LEFT)).toBe(false);
  });

  it('should update the modifier when the odd-side item is removed', async () => {
    const { fixture, timelineEl } = await setup([
      { title: 'One', direction: 'right' },
      { title: 'Two', direction: 'left' },
    ]);
    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(false);
    expect(timelineEl.classList.contains(SINGLE_LEFT)).toBe(false);

    fixture.componentInstance.items.update((items) =>
      items.filter((item) => item.title !== 'Two'),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(timelineEl.classList.contains(SINGLE_RIGHT)).toBe(true);
    expect(timelineEl.classList.contains(SINGLE_LEFT)).toBe(false);
  });

  it('should render only the column that carries content', async () => {
    const { timelineEl } = await setup([
      { title: 'One', direction: 'right' },
      { title: 'Two', direction: 'left' },
    ]);

    const items = timelineEl.querySelectorAll('mlv-timeline-item');
    expect(items).toHaveLength(2);

    expect(
      items[0].querySelector('.mlv-timeline-item__col--right'),
    ).toBeTruthy();
    expect(items[0].querySelector('.mlv-timeline-item__col--left')).toBeNull();

    expect(
      items[1].querySelector('.mlv-timeline-item__col--left'),
    ).toBeTruthy();
    expect(items[1].querySelector('.mlv-timeline-item__col--right')).toBeNull();
  });
});

/**
 * Accessibility sweep.
 *
 * The timeline is a hand-rolled `role="list"` / `role="listitem"` pair on two
 * custom elements — nothing native carries those semantics here — so the sweep
 * is checking that the pair actually holds up: `aria-required-children` on the
 * list, `aria-required-parent` on every item, and that the spine (node circle,
 * connector, projected icon) stays `aria-hidden` decoration rather than
 * announcing itself between entries. Both directions are included, since
 * `direction="left"` is the alternating-layout variant, along with the icon and
 * meta slots and a timestamp.
 */
describe('MlvTimeline accessibility', () => {
  @Component({
    imports: [
      MlvTimeline,
      MlvTimelineItem,
      MlvTimelineItemIcon,
      MlvTimelineItemMeta,
    ],
    template: `
      <mlv-timeline>
        <mlv-timeline-item title="Created" timestamp="09:41" tone="success">
          <ng-template mlvTimelineItemIcon>
            <svg></svg>
          </ng-template>
          The record was created.
        </mlv-timeline-item>

        <mlv-timeline-item title="Reviewed" direction="left" tone="info">
          <ng-template mlvTimelineItemMeta>
            <span>2 reviewers</span>
          </ng-template>
          Sent for review.
        </mlv-timeline-item>

        <mlv-timeline-item title="Blocked" tone="danger" timestamp="11:02">
          Waiting on legal.
        </mlv-timeline-item>
      </mlv-timeline>
    `,
  })
  class TimelineA11yHost {}

  it('has no axe violations for a populated timeline', async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(TimelineA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: one list with three items under it, and the spine decoration
    // hidden so the list reads as three entries rather than six.
    const list = host.querySelector('[role="list"]') as HTMLElement;
    expect(list).toBeTruthy();
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    expect(host.querySelectorAll('.mlv-timeline-item__connector')).toHaveLength(
      3,
    );
    expect(
      [...host.querySelectorAll('.mlv-timeline-item__connector')].every(
        (el) => el.getAttribute('aria-hidden') === 'true',
      ),
    ).toBe(true);
    expect(
      host
        .querySelector('.mlv-timeline-item__node-icon')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');

    await expectNoAxeViolations(host);
  });
});
