import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, PLATFORM_ID, signal } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvLayout } from './layout';
import { MlvLayoutSide } from './directives/MlvLayoutSide';
import { MlvLayoutTop } from './directives/MlvLayoutTop';
import { MlvThemeService } from './services/theme.service';

describe('Layout', () => {
  let component: MlvLayout;
  let fixture: ComponentFixture<MlvLayout>;

  beforeEach(async () => {
    // MlvThemeService calls window.matchMedia at field-init level; mock it for jsdom.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    });

    await TestBed.configureTestingModule({
      imports: [MlvLayout],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reflects the resolved theme on its own host element', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.getAttribute('mlvTheme')).toBe(
      TestBed.inject(MlvThemeService).currentTheme(),
    );
  });

  it('should not access documentElement when rendered on the server', async () => {
    TestBed.resetTestingModule();
    const setAttribute = vi.spyOn(document.documentElement, 'setAttribute');
    await TestBed.configureTestingModule({
      imports: [MlvLayout],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    const serverFixture = TestBed.createComponent(MlvLayout);
    serverFixture.detectChanges();
    await serverFixture.whenStable();

    expect(setAttribute).not.toHaveBeenCalled();
  });
});

@Component({
  imports: [MlvLayout, MlvLayoutTop, MlvLayoutSide],
  template: `
    <mlv-layout>
      @if (withTop()) {
        <ng-template mlvLayoutTop>
          <a href="#main">Skip to content</a>
        </ng-template>
      }
      @if (withSide()) {
        <ng-template mlvLayoutSide>
          <nav aria-label="Sections">
            <a href="#one">One</a>
          </nav>
        </ng-template>
      }
      <main id="main"><h1>Page</h1></main>
    </mlv-layout>
  `,
})
class LayoutA11yHost {
  readonly withTop = signal(false);
  readonly withSide = signal(false);
}

/**
 * Accessibility sweeps — `mlv-layout`.
 *
 * The component's DOM contribution is landmark structure: a `<header>` when a
 * `[mlvLayoutTop]` template is projected and an `<aside>` inside its
 * `<section>` container when a `[mlvLayoutSide]` one is. Landmark rules are
 * decided by nesting, so each sweep is rooted at the fixture root — above the
 * `<mlv-layout>` element — and the slots are swept in every combination that
 * changes which landmarks exist: neither, header only, aside only, and both.
 * `plain` only toggles a class, so it is not a state here.
 */
describe('MlvLayout accessibility', () => {
  let a11yFixture: ComponentFixture<LayoutA11yHost>;
  let root: HTMLElement;

  beforeEach(async () => {
    // `MlvThemeService` reads `window.matchMedia` in a field initializer, and
    // jsdom does not implement it — same stub the suite above installs.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }),
    });

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LayoutA11yHost],
    }).compileComponents();

    a11yFixture = TestBed.createComponent(LayoutA11yHost);
    root = a11yFixture.nativeElement as HTMLElement;
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();
  });

  /** Applies the current slot flags and renders. */
  async function render(top: boolean, side: boolean): Promise<void> {
    a11yFixture.componentInstance.withTop.set(top);
    a11yFixture.componentInstance.withSide.set(side);
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();
  }

  it('has no axe violations with neither slot projected', async () => {
    // State: no header, no aside — only the container section and content.
    expect(root.querySelector('.mlv-layout__header')).toBeNull();
    expect(root.querySelector('.mlv-layout__side')).toBeNull();
    expect(root.querySelector('.mlv-layout__container')).not.toBeNull();

    await expectNoAxeViolations(root);
  });

  it('has no axe violations with only the header slot', async () => {
    await render(true, false);

    // State: a <header> landmark now sits above the container section.
    expect(root.querySelector('header.mlv-layout__header')).not.toBeNull();
    expect(root.querySelector('.mlv-layout__side')).toBeNull();

    await expectNoAxeViolations(root);
  });

  it('has no axe violations with only the side slot', async () => {
    await render(false, true);

    // State: an <aside> landmark nested inside the container <section>, which
    // is the nesting a landmark rule would judge.
    const side = root.querySelector('aside.mlv-layout__side') as HTMLElement;
    expect(side.closest('.mlv-layout__container')).not.toBeNull();

    await expectNoAxeViolations(root);
  });

  it('has no axe violations with both slots projected', async () => {
    await render(true, true);

    expect(root.querySelector('header.mlv-layout__header')).not.toBeNull();
    expect(root.querySelector('aside.mlv-layout__side')).not.toBeNull();
    expect(root.querySelector('main')).not.toBeNull();

    await expectNoAxeViolations(root);
  });
});
