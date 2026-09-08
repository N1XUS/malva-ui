import { Component, Directive, inject, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  MLV_DENSITY_CONTEXT,
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
  MlvDensityService,
} from '@malva-ui/cdk/density';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvActionBar } from './action-bar';
import { MlvActionBarActions } from './components/action-bar-actions';
import { MlvActionBarLogo } from './components/action-bar-logo';
import { MlvActionBarSpacer } from './components/action-bar-spacer';

/**
 * Stand-in for any directive-bearing control a consumer projects into the bar
 * (`button[mlvButton]`, `mlv-select`, …). It resolves density exactly the way
 * those do — explicit input, then the ancestor `MLV_DENSITY_CONTEXT`, then the
 * service — so asserting on its stamped class proves the bar projects its
 * density without pulling another library into this project's dependency graph.
 */
@Directive({
  selector: '[mlvTestDensityChild]',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'test-child' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class TestDensityChild {
  /** The ancestor-projected density this child resolved, or `null` when none. */
  readonly context = inject(MLV_DENSITY_CONTEXT, { optional: true });
}

@Component({
  imports: [
    MlvActionBar,
    MlvActionBarLogo,
    MlvActionBarSpacer,
    TestDensityChild,
  ],
  template: `
    <header mlvActionBar [mlvDensity]="density()" aria-label="Application">
      <a mlvActionBarLogo href="/">Malva</a>
      <div mlvActionBarSpacer></div>
      <button type="button" mlvTestDensityChild>Save</button>
    </header>
  `,
})
class ActionBarDensityHost {
  readonly density = signal<MlvDensity | undefined>(undefined);
}

describe('MlvActionBar density', () => {
  let fixture: ComponentFixture<ActionBarDensityHost>;
  let bar: HTMLElement;
  let child: HTMLButtonElement;
  let service: MlvDensityService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionBarDensityHost],
    }).compileComponents();

    service = TestBed.inject(MlvDensityService);
    fixture = TestBed.createComponent(ActionBarDensityHost);
    fixture.detectChanges();
    await fixture.whenStable();

    bar = fixture.nativeElement.querySelector('header') as HTMLElement;
    child = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  });

  afterEach(() => service.setDensity('comfortable'));

  it('stamps the service density modifier by default', () => {
    expect(bar.classList).toContain('mlv-action-bar');
    expect(bar.classList).toContain('mlv-action-bar--comfortable');
  });

  it.each(['tight', 'compact', 'comfortable', 'spacious', 'airy'] as const)(
    'stamps the explicit %s modifier and drops the previous one',
    async (density) => {
      fixture.componentInstance.density.set(density);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(bar.classList).toContain(`mlv-action-bar--${density}`);
      // Exactly one density modifier at a time — the directive clears the
      // previous step rather than accumulating them.
      const densityClasses = [...bar.classList].filter((c) =>
        /^mlv-action-bar--(tight|compact|comfortable|spacious|airy)$/.test(c),
      );
      expect(densityClasses).toEqual([`mlv-action-bar--${density}`]);
    },
  );

  it('follows the service when no explicit density is set', async () => {
    service.setDensity('tight');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(bar.classList).toContain('mlv-action-bar--tight');
  });

  it('projects its density to directive-bearing children', async () => {
    fixture.componentInstance.density.set('tight');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(child.classList).toContain('mlv-test-child--tight');
    expect(child.classList).not.toContain('mlv-test-child--comfortable');
  });

  it('provides MLV_DENSITY_CONTEXT to projected content', () => {
    const debugChild = fixture.debugElement.query(
      (candidate) => candidate.name === 'button',
    );
    const context = debugChild.injector.get(MLV_DENSITY_CONTEXT);
    expect(context()).toBe('comfortable');
  });
});

/**
 * Accessibility sweep for the density-modified rendering. Density only ever
 * changes geometry, so the bar must still be the consumer's own named landmark
 * with the same tree underneath it at the tightest step.
 */
describe('MlvActionBar density accessibility', () => {
  @Component({
    imports: [
      MlvActionBar,
      MlvActionBarLogo,
      MlvActionBarSpacer,
      MlvActionBarActions,
    ],
    template: `
      <header mlvActionBar mlvDensity="tight" aria-label="Application">
        <a mlvActionBarLogo href="/">Malva</a>
        <div mlvActionBarSpacer></div>
        <div mlvActionBarActions>
          <button type="button">Sign in</button>
        </div>
      </header>

      <nav
        mlvActionBar
        mlvDensity="tight"
        shape="pill"
        contrast
        aria-label="Bulk actions"
      >
        <span><strong>3</strong> assets selected</span>
        <div mlvActionBarSpacer></div>
        <button type="button">Delete</button>
      </nav>
    `,
  })
  class ActionBarTightA11yHost {}

  it('has no axe violations at tight density', async () => {
    await TestBed.configureTestingModule({
      imports: [ActionBarTightA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(ActionBarTightA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: both bars carry the tight modifier and are still the consumer's
    // own separately-named landmarks.
    const bars = [...host.querySelectorAll('.mlv-action-bar')];
    expect(bars.map((el) => el.tagName.toLowerCase())).toEqual([
      'header',
      'nav',
    ]);
    expect(
      bars.every((el) => el.classList.contains('mlv-action-bar--tight')),
    ).toBe(true);

    await expectNoAxeViolations(host);
  });
});
