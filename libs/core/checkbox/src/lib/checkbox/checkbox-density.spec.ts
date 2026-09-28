import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvDensityDirective, MlvDensityService } from '@malva-ui/cdk/density';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvCheckbox } from './checkbox';

// #364: the checkbox stamps `mlv-checkbox--<density>` from its own
// `mlvDensity`, else the nearest density scope, else the service — never from
// whichever ancestor class sorts last in the stylesheet.

@Component({
  imports: [MlvCheckbox, MlvDensityDirective],
  template: `
    <div mlvDensity="spacious">
      <div mlvDensity="compact">
        <mlv-checkbox class="nearest consumer" label="Nearest" />
      </div>
      <mlv-checkbox class="outer" label="Outer" />
      <mlv-checkbox class="own" mlvDensity="tight" label="Own" />
    </div>
    <mlv-checkbox class="service" label="Service" />
  `,
})
class Host {}

const densityOf = (root: HTMLElement, selector: string) =>
  [...(root.querySelector(selector)?.classList ?? [])].filter((c) =>
    /^mlv-checkbox--(tight|compact|comfortable|spacious|airy)$/.test(c),
  );

describe('MlvCheckbox density (#364)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    TestBed.inject(MlvDensityService).setDensity('airy');
  });

  it('resolves own input, then nearest scope, then the service', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(densityOf(root, '.nearest')).toEqual(['mlv-checkbox--compact']);
    expect(densityOf(root, '.outer')).toEqual(['mlv-checkbox--spacious']);
    expect(densityOf(root, '.own')).toEqual(['mlv-checkbox--tight']);
    expect(densityOf(root, '.service')).toEqual(['mlv-checkbox--airy']);
  });

  it('keeps consumer classes and follows a service flip where no scope applies', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    TestBed.inject(MlvDensityService).setDensity('compact');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(densityOf(root, '.service')).toEqual(['mlv-checkbox--compact']);
    const nearest = root.querySelector('.nearest') as HTMLElement;
    expect(nearest.classList.contains('consumer')).toBe(true);
    expect(nearest.classList.contains('mlv-checkbox')).toBe(true);
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
