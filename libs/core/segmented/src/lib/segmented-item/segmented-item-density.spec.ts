import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvDensityDirective, MlvDensityService } from '@malva-ui/cdk/density';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvSegmented } from '../segmented/segmented';
import { MlvSegmentedItem } from './segmented-item';

// #364: a segmented item stamps `mlv-segmented-item--<density>` from the
// control's explicit `mlvDensity`, else the nearest scope above it, else the
// service. Before, it carried no class and sized from whichever ancestor
// density class sorted last in the stylesheet.

@Component({
  imports: [MlvDensityDirective, MlvSegmented, MlvSegmentedItem],
  template: `
    <div mlvDensity="spacious">
      <mlv-segmented class="own" mlvDensity="compact" ariaLabel="Own">
        <button mlvSegmentedItem class="consumer" value="a">A</button>
      </mlv-segmented>
      <mlv-segmented class="inherited" ariaLabel="Inherited">
        <button mlvSegmentedItem value="b">B</button>
      </mlv-segmented>
    </div>
  `,
})
class Host {}

const itemDensity = (root: HTMLElement, group: string) =>
  [
    ...(root.querySelector(`${group} .mlv-segmented-item`)?.classList ?? []),
  ].filter((c) =>
    /^mlv-segmented-item--(tight|compact|comfortable|spacious|airy)$/.test(c),
  );

describe('MlvSegmentedItem density (#364)', () => {
  beforeEach(() => {
    TestBed.inject(MlvDensityService).setDensity('airy');
  });

  it('stamps the control’s density, explicit or inherited', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(itemDensity(root, '.own')).toEqual(['mlv-segmented-item--compact']);
    expect(itemDensity(root, '.inherited')).toEqual([
      'mlv-segmented-item--spacious',
    ]);
    expect(
      root
        .querySelector('.own .mlv-segmented-item')
        ?.classList.contains('consumer'),
    ).toBe(true);
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
