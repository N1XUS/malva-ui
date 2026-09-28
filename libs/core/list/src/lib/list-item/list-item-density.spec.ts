import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvDensityDirective, MlvDensityService } from '@malva-ui/cdk/density';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvList } from '../list/list';
import { MlvListItem } from './list-item';

// #364: a list item stamps `mlv-list-item--<density>` from the nearest density
// scope, else the service. Before, it carried no class and every density rule
// reached it through whichever ancestor class sorted last in the stylesheet.

@Component({
  imports: [MlvDensityDirective, MlvList, MlvListItem],
  template: `
    <div mlvDensity="spacious">
      <div mlvDensity="compact">
        <mlv-list>
          <mlv-list-item class="nearest consumer">Nearest</mlv-list-item>
        </mlv-list>
      </div>
      <mlv-list>
        <mlv-list-item class="outer">Outer</mlv-list-item>
      </mlv-list>
    </div>
    <mlv-list>
      <mlv-list-item class="service">Service</mlv-list-item>
    </mlv-list>
  `,
})
class Host {}

const densityOf = (root: HTMLElement, selector: string) =>
  [...(root.querySelector(selector)?.classList ?? [])].filter((c) =>
    /^mlv-list-item--(tight|compact|comfortable|spacious|airy)$/.test(c),
  );

describe('MlvListItem density (#364)', () => {
  beforeEach(() => {
    TestBed.inject(MlvDensityService).setDensity('tight');
  });

  it('stamps the nearest scope, else the service', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(densityOf(root, '.nearest')).toEqual(['mlv-list-item--compact']);
    expect(densityOf(root, '.outer')).toEqual(['mlv-list-item--spacious']);
    expect(densityOf(root, '.service')).toEqual(['mlv-list-item--tight']);
    expect(root.querySelector('.nearest')?.classList.contains('consumer')).toBe(
      true,
    );
  });

  it('follows a service flip where no scope applies', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    TestBed.inject(MlvDensityService).setDensity('comfortable');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(densityOf(root, '.service')).toEqual(['mlv-list-item--comfortable']);
    expect(densityOf(root, '.nearest')).toEqual(['mlv-list-item--compact']);
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
