import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';

import { MlvDrawerSection } from '../drawer-section/drawer-section';
import { MlvDrawerSections } from './drawer-sections';
import { MlvDrawerSectionsService } from '../drawer-sections.service';

@Component({
  imports: [MlvDrawerSections, MlvDrawerSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MlvDrawerSectionsService],
  template: `
    <mlv-drawer-sections />
    @for (label of labels(); track label) {
      <section mlvDrawerSection [label]="label">Content</section>
    }
  `,
})
class SectionsHostComponent {
  readonly labels = signal<string[]>([]);
}

describe('MlvDrawerSections', () => {
  let fixture: ComponentFixture<SectionsHostComponent>;
  let host: SectionsHostComponent;

  beforeAll(() => {
    // jsdom ships no IntersectionObserver; MlvDrawerSectionsService constructs
    // one eagerly to track the scrolled section. Scroll tracking is not what
    // these tests exercise, so a no-op double is enough.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe(): void {
          /* no-op */
        }
        unobserve(): void {
          /* no-op */
        }
        disconnect(): void {
          /* no-op */
        }
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SectionsHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SectionsHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function trigger(): HTMLElement | null {
    return fixture.nativeElement.querySelector('mlv-drawer-sections button');
  }

  it('renders nothing when no section is registered', async () => {
    await fixture.whenStable();

    expect(trigger()).toBeNull();
  });

  it('renders nothing for a single section — there is nowhere to navigate', async () => {
    host.labels.set(['Meta']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger()).toBeNull();
  });

  it('renders the navigator once there is more than one section', async () => {
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger()).not.toBeNull();
    expect(trigger()?.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('hides the navigator again when sections drop back to one', async () => {
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger()).not.toBeNull();

    host.labels.set(['Meta']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trigger()).toBeNull();
  });
});
