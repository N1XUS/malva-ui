import { Component, Directive, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  MLV_DENSITY_CONTEXT,
  MlvDensityDirective,
  MlvDensityService,
} from '@malva-ui/cdk/density';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvPage } from './page';

// #364: the page stamps `mlv-page--<density>` from `mlvDensity`, else the
// nearest density scope, else the service, and an explicit `mlvDensity`
// scopes everything inside the page.

/** Reads the density scope a descendant of the page resolves. */
@Directive({ selector: '[mlvDensityProbe]' })
class DensityProbe {
  readonly scope = inject(MLV_DENSITY_CONTEXT, { optional: true });
}

@Component({
  imports: [DensityProbe, MlvDensityDirective, MlvPage],
  template: `
    <div mlvDensity="spacious">
      <main
        mlvPage
        class="consumer"
        mlvDensity="compact"
        [stickyHeader]="false"
      >
        <p mlvDensityProbe>Content</p>
      </main>
    </div>
  `,
})
class ExplicitHost {}

@Component({
  imports: [MlvDensityDirective, MlvPage],
  template: `
    <div mlvDensity="spacious">
      <main mlvPage [stickyHeader]="false"><p>Content</p></main>
    </div>
  `,
})
class InheritedHost {}

const densityOf = (el: Element) =>
  [...el.classList].filter((c) =>
    /^mlv-page--(tight|compact|comfortable|spacious|airy)$/.test(c),
  );

describe('MlvPage density (#364)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    TestBed.inject(MlvDensityService).setDensity('airy');
  });

  it('stamps its own mlvDensity and scopes the content with it', async () => {
    const fixture = TestBed.createComponent(ExplicitHost);
    await fixture.whenStable();
    const page = (fixture.nativeElement as HTMLElement).querySelector(
      'main',
    ) as HTMLElement;

    expect(densityOf(page)).toEqual(['mlv-page--compact']);
    expect(page.classList.contains('consumer')).toBe(true);
    expect(page.classList.contains('mlv-page')).toBe(true);
    const probe = fixture.debugElement
      .query(By.directive(DensityProbe))
      .injector.get(DensityProbe);
    expect(probe.scope?.()).toBe('compact');
  });

  it('stamps the nearest scope when it sets none', async () => {
    const fixture = TestBed.createComponent(InheritedHost);
    await fixture.whenStable();
    const page = (fixture.nativeElement as HTMLElement).querySelector(
      'main',
    ) as HTMLElement;

    expect(densityOf(page)).toEqual(['mlv-page--spacious']);
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(ExplicitHost);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
