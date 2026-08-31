import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import TimelineAlternatingExampleComponent from './index';

describe('TimelineAlternatingExampleComponent', () => {
  const setup = async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [TimelineAlternatingExampleComponent],
      providers: [provideMlvI18nTesting()],
    }).createComponent(TimelineAlternatingExampleComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('keeps the three-column layout by mixing item directions', async () => {
    const fixture = await setup();
    const timeline = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-timeline',
    ) as HTMLElement;

    expect(timeline).toBeTruthy();
    expect(timeline.classList.contains('mlv-timeline--single-left')).toBe(
      false,
    );
    expect(timeline.classList.contains('mlv-timeline--single-right')).toBe(
      false,
    );
  });

  it('alternates sides across consecutive items', async () => {
    const fixture = await setup();
    const items = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        'mlv-timeline-item',
      ),
    ];

    expect(items).toHaveLength(4);

    const sides = items.map((item) =>
      item.querySelector('.mlv-timeline-item__col--left') ? 'left' : 'right',
    );
    expect(sides).toEqual(['left', 'right', 'left', 'right']);

    // Both columns are in use, so neither is rendered as an empty box.
    expect(items[0].querySelector('.mlv-timeline-item__col--right')).toBeNull();
    expect(items[1].querySelector('.mlv-timeline-item__col--left')).toBeNull();
  });
});
