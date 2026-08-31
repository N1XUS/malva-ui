import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvTimelineItem } from './timeline-item';
import { MlvTimelineItemIcon } from './timeline-item-icon';
import { MlvTimelineItemMeta } from './timeline-item-meta';

describe('MlvTimelineItem', () => {
  let fixture: ComponentFixture<MlvTimelineItem>;
  let component: MlvTimelineItem;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTimelineItem],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvTimelineItem);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Test Event');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the title', () => {
    fixture.detectChanges();
    const titleEl = fixture.nativeElement.querySelector(
      '.mlv-timeline-item__title',
    );
    expect(titleEl?.textContent?.trim()).toBe('Test Event');
  });

  it('should apply default tone class', () => {
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-timeline-item--default'),
    ).toBe(true);
  });

  it('should apply tone class when set', () => {
    fixture.componentRef.setInput('tone', 'success');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-timeline-item--success'),
    ).toBe(true);
  });

  it('should render timestamp when provided', () => {
    fixture.componentRef.setInput('timestamp', 'Mar 26, 2025');
    fixture.detectChanges();
    const timeEl = fixture.nativeElement.querySelector(
      'time.mlv-timeline-item__timestamp',
    );
    expect(timeEl).toBeTruthy();
    expect(timeEl.textContent.trim()).toBe('Mar 26, 2025');
  });

  it('should not render timestamp when not provided', () => {
    fixture.detectChanges();
    const timeEl = fixture.nativeElement.querySelector(
      'time.mlv-timeline-item__timestamp',
    );
    expect(timeEl).toBeNull();
  });

  it('should have role="listitem"', () => {
    expect(fixture.nativeElement.getAttribute('role')).toBe('listitem');
  });

  it('should not apply direction-left class by default', () => {
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains(
        'mlv-timeline-item--direction-left',
      ),
    ).toBe(false);
  });

  it('should apply direction-left class when direction is left', () => {
    fixture.componentRef.setInput('direction', 'left');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains(
        'mlv-timeline-item--direction-left',
      ),
    ).toBe(true);
  });
});

@Component({
  template: `
    <mlv-timeline-item title="With Icon">
      <ng-template mlvTimelineItemIcon>
        <span class="test-icon">icon</span>
      </ng-template>
    </mlv-timeline-item>
  `,
  imports: [MlvTimelineItem, MlvTimelineItemIcon],
})
class HostWithIcon {}

describe('MlvTimelineItem with icon slot', () => {
  it('should render icon slot content', async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithIcon],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostWithIcon);
    fixture.detectChanges();
    await fixture.whenStable();

    const iconEl = fixture.nativeElement.querySelector('.test-icon');
    expect(iconEl).toBeTruthy();
    expect(iconEl.textContent.trim()).toBe('icon');
  });
});

@Component({
  template: `
    <mlv-timeline-item title="With Meta">
      <ng-template mlvTimelineItemMeta>
        <span class="test-meta">badge</span>
      </ng-template>
    </mlv-timeline-item>
  `,
  imports: [MlvTimelineItem, MlvTimelineItemMeta],
})
class HostWithMeta {}

describe('MlvTimelineItem with meta slot', () => {
  it('should render meta slot content', async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithMeta],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostWithMeta);
    fixture.detectChanges();
    await fixture.whenStable();

    const metaEl = fixture.nativeElement.querySelector('.test-meta');
    expect(metaEl).toBeTruthy();
    expect(metaEl.textContent.trim()).toBe('badge');
  });
});

describe('MlvTimelineItem column rendering', () => {
  const createItem = async (direction?: 'left' | 'right') => {
    await TestBed.configureTestingModule({
      imports: [MlvTimelineItem],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvTimelineItem);
    fixture.componentRef.setInput('title', 'Test Event');
    if (direction) {
      fixture.componentRef.setInput('direction', direction);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  it('should render only the right column by default', async () => {
    const fixture = await createItem();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.mlv-timeline-item__col--right')).toBeTruthy();
    expect(host.querySelector('.mlv-timeline-item__col--left')).toBeNull();
  });

  it('should render only the left column when direction is left', async () => {
    const fixture = await createItem('left');
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.mlv-timeline-item__col--left')).toBeTruthy();
    expect(host.querySelector('.mlv-timeline-item__col--right')).toBeNull();
  });

  it('should always render the spine', async () => {
    const fixture = await createItem();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.mlv-timeline-item__spine',
      ),
    ).toBeTruthy();
  });
});

@Component({
  template: `
    <div class="standalone-wrapper">
      <mlv-timeline-item title="Standalone"
        >Outside a timeline.</mlv-timeline-item
      >
    </div>
  `,
  imports: [MlvTimelineItem],
})
class HostWithoutTimeline {}

describe('MlvTimelineItem outside a timeline', () => {
  it('should be unaffected by the single-side collapse modifiers', async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithoutTimeline],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostWithoutTimeline);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const item = host.querySelector('mlv-timeline-item') as HTMLElement;

    expect(item).toBeTruthy();
    expect(host.querySelector('.mlv-timeline--single-left')).toBeNull();
    expect(host.querySelector('.mlv-timeline--single-right')).toBeNull();
    expect(item.closest('mlv-timeline')).toBeNull();
    expect(item.querySelector('.mlv-timeline-item__spine')).toBeTruthy();
    expect(item.querySelector('.mlv-timeline-item__col--right')).toBeTruthy();
  });
});

@Component({
  template: `
    <mlv-timeline-item title="Left" direction="left"
      >Left copy.</mlv-timeline-item
    >
    <mlv-timeline-item title="Right" direction="right"
      >Right copy.</mlv-timeline-item
    >
  `,
  imports: [MlvTimelineItem],
})
class HostWithBothDirections {}

describe('MlvTimelineItem content projection', () => {
  it('should project the description regardless of direction', async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithBothDirections],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostWithBothDirections);
    fixture.detectChanges();
    await fixture.whenStable();

    const descriptions = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        '.mlv-timeline-item__description',
      ),
    ].map((el) => el.textContent?.trim());

    expect(descriptions).toEqual(['Left copy.', 'Right copy.']);
  });

  it('should keep projected content when direction flips at runtime', async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTimelineItem],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvTimelineItem);
    fixture.componentRef.setInput('title', 'Flips');
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.mlv-timeline-item__col--right')).toBeTruthy();

    fixture.componentRef.setInput('direction', 'left');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.querySelector('.mlv-timeline-item__col--left')).toBeTruthy();
    expect(host.querySelector('.mlv-timeline-item__col--right')).toBeNull();
    expect(
      host.querySelectorAll('.mlv-timeline-item__description'),
    ).toHaveLength(1);
  });
});
