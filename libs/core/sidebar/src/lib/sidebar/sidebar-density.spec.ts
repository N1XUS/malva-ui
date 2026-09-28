import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvDensityDirective, MlvDensityService } from '@malva-ui/cdk/density';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvSidebar } from './sidebar';

// #364: the sidebar stamps `mlv-sidebar--<density>` from `mlvDensity`, else
// the nearest density scope, else the service. The density directive's host
// `[class]` binding and the sidebar's own mode binding share the element.

@Component({
  imports: [MlvDensityDirective, MlvSidebar],
  // Three navigation landmarks on one page need three names
  // (`landmark-unique`); an app renders one sidebar.
  template: `
    <div mlvDensity="compact">
      <mlv-sidebar
        class="inherited consumer"
        mode="floating"
        ariaLabel="Inherited"
      >
        Views
      </mlv-sidebar>
    </div>
    <mlv-sidebar class="own" mlvDensity="tight" ariaLabel="Own"
      >Views</mlv-sidebar
    >
    <mlv-sidebar class="service" ariaLabel="Service">Views</mlv-sidebar>
  `,
})
class Host {}

const densityOf = (root: HTMLElement, selector: string) =>
  [...(root.querySelector(selector)?.classList ?? [])].filter((c) =>
    /^mlv-sidebar--(tight|compact|comfortable|spacious|airy)$/.test(c),
  );

describe('MlvSidebar density (#364)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    TestBed.inject(MlvDensityService).setDensity('spacious');
  });

  it('stamps own input, then nearest scope, then the service', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(densityOf(root, '.inherited')).toEqual(['mlv-sidebar--compact']);
    expect(densityOf(root, '.own')).toEqual(['mlv-sidebar--tight']);
    expect(densityOf(root, '.service')).toEqual(['mlv-sidebar--spacious']);
  });

  it('keeps the mode and consumer classes beside the density modifier', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const sidebar = (fixture.nativeElement as HTMLElement).querySelector(
      '.inherited',
    ) as HTMLElement;

    expect(sidebar.classList.contains('mlv-sidebar')).toBe(true);
    expect(sidebar.classList.contains('mlv-sidebar--floating')).toBe(true);
    expect(sidebar.classList.contains('consumer')).toBe(true);
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
