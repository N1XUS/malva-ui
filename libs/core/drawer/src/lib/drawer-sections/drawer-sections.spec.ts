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

  /** Elements handed to `IntersectionObserver.observe` by the double below. */
  const observedElements: Element[] = [];

  beforeAll(() => {
    // jsdom ships no IntersectionObserver; MlvDrawerSectionsService constructs
    // one from a render hook to track the scrolled section. Scroll tracking is
    // not what these tests exercise, so a recording double is enough — it only
    // notes what was observed, which is what proves the hook ran at all.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe(target: Element): void {
          observedElements.push(target);
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

  it('observes every registered section in a browser', async () => {
    // The service moved off a constructor `effect` onto `afterRenderEffect`
    // so it cannot construct an `IntersectionObserver` during server
    // rendering (see the SSR smoke suite in `@malva-ui/core`). Render hooks do
    // not run on the server — but they must still run here, otherwise the fix
    // would have silently turned scroll tracking off in the browser too.
    observedElements.length = 0;
    host.labels.set(['Meta', 'Details']);
    fixture.detectChanges();
    await fixture.whenStable();

    // The distinct set, not the call count: one section observed twice across
    // two render passes is still correct behaviour, and asserting `2` calls
    // would fail on a scheduling change that regressed nothing.
    const sections = fixture.nativeElement.querySelectorAll('section');
    const observed = new Set(observedElements);

    expect(observed.has(sections[0])).toBe(true);
    expect(observed.has(sections[1])).toBe(true);
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
