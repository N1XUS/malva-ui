import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvDensityDirective, MlvDensityService } from '@malva-ui/cdk/density';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvRadioGroup } from '../radio-group/radio-group';
import { MlvRadio } from './radio';

// #364: the radio stamps `mlv-radio--<density>` from its own `mlvDensity`,
// else the nearest density scope, else the service — its size no longer
// depends on which ancestor class sorts last in the stylesheet.

@Component({
  imports: [MlvDensityDirective, MlvRadio, MlvRadioGroup],
  template: `
    <div mlvDensity="spacious">
      <div mlvDensity="compact">
        <mlv-radio-group aria-label="Nearest">
          <mlv-radio class="nearest consumer" value="a">Nearest</mlv-radio>
        </mlv-radio-group>
      </div>
      <mlv-radio-group aria-label="Outer">
        <mlv-radio class="outer" value="b">Outer</mlv-radio>
        <mlv-radio class="own" value="c" mlvDensity="tight">Own</mlv-radio>
      </mlv-radio-group>
    </div>
    <mlv-radio-group aria-label="Service">
      <mlv-radio class="service" value="d">Service</mlv-radio>
    </mlv-radio-group>
  `,
})
class Host {}

const densityOf = (root: HTMLElement, selector: string) =>
  [...(root.querySelector(selector)?.classList ?? [])].filter((c) =>
    /^mlv-radio--(tight|compact|comfortable|spacious|airy)$/.test(c),
  );

describe('MlvRadio density (#364)', () => {
  beforeEach(() => {
    TestBed.inject(MlvDensityService).setDensity('airy');
  });

  it('resolves own input, then nearest scope, then the service', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(densityOf(root, '.nearest')).toEqual(['mlv-radio--compact']);
    expect(densityOf(root, '.outer')).toEqual(['mlv-radio--spacious']);
    expect(densityOf(root, '.own')).toEqual(['mlv-radio--tight']);
    expect(densityOf(root, '.service')).toEqual(['mlv-radio--airy']);
    expect(root.querySelector('.nearest')?.classList.contains('consumer')).toBe(
      true,
    );
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
