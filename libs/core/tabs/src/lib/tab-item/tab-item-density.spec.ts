import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvDensityDirective, MlvDensityService } from '@malva-ui/cdk/density';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTab } from '../tab/tab';
import { MlvTabContentDef } from '../tab-content-def';
import { MlvTabDef } from '../tab-def';
import { MlvTabGroup } from '../tabs/tabs';

// #364: a tab item stamps `mlv-tab-item--<density>` from the tab group's
// explicit `mlvDensity`, else the nearest scope above the group, else the
// service. Before, it carried no class and sized from whichever ancestor
// density class sorted last in the stylesheet.

@Component({
  imports: [
    MlvDensityDirective,
    MlvTab,
    MlvTabContentDef,
    MlvTabDef,
    MlvTabGroup,
  ],
  template: `
    <div mlvDensity="spacious">
      <mlv-tab-group class="own" mlvDensity="compact">
        <mlv-tab value="a">
          <ng-template mlvTabDef>A</ng-template>
          <ng-template mlvTabContent><p>A</p></ng-template>
        </mlv-tab>
      </mlv-tab-group>
      <mlv-tab-group class="inherited">
        <mlv-tab value="b">
          <ng-template mlvTabDef>B</ng-template>
          <ng-template mlvTabContent><p>B</p></ng-template>
        </mlv-tab>
      </mlv-tab-group>
    </div>
  `,
})
class Host {}

const itemDensity = (root: HTMLElement, group: string) =>
  [...(root.querySelector(`${group} mlv-tab-item`)?.classList ?? [])].filter(
    (c) => /^mlv-tab-item--(tight|compact|comfortable|spacious|airy)$/.test(c),
  );

describe('MlvTabItem density (#364)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    TestBed.inject(MlvDensityService).setDensity('airy');
  });

  it('stamps the tab group’s density, explicit or inherited', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(itemDensity(root, '.own')).toEqual(['mlv-tab-item--compact']);
    expect(itemDensity(root, '.inherited')).toEqual(['mlv-tab-item--spacious']);
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
