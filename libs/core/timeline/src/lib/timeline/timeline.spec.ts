import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvTimeline } from './timeline';
import { MlvTimelineItem } from './timeline-item';
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
