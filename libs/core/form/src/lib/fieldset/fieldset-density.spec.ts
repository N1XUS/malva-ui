import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Component, Directive, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type * as Sass from 'sass';
import { MLV_DENSITY_CONTEXT, MlvDensityService } from '@malva-ui/cdk/density';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvForm } from '../form/form';
import { MlvFieldset } from './fieldset';

// #364: the fieldset stamps `mlv-fieldset--<density>` from `mlvDensity`, else
// the nearest density scope (the surrounding form), else the service. An
// explicit `mlvDensity` scopes the controls inside it, and the dense legend
// keys on the fieldset's own modifier rather than on any ancestor class.

const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const FIELDSET_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fieldset.scss',
);

/** Reads the density scope an element inside the fieldset resolves. */
@Directive({ selector: '[mlvDensityProbe]' })
class DensityProbe {
  readonly scope = inject(MLV_DENSITY_CONTEXT, { optional: true });
}

@Component({
  imports: [DensityProbe, MlvFieldset, MlvForm],
  template: `
    <form mlvForm mlvDensity="spacious" aria-label="Profile">
      <fieldset
        mlvFieldset
        class="own consumer"
        legend="Own"
        mlvDensity="compact"
      >
        <p mlvDensityProbe>Name</p>
      </fieldset>
      <fieldset mlvFieldset class="inherited" legend="Inherited">
        <p>Email</p>
      </fieldset>
    </form>
  `,
})
class Host {}

const densityOf = (root: HTMLElement, selector: string) =>
  [...(root.querySelector(selector)?.classList ?? [])].filter((c) =>
    /^mlv-fieldset--(tight|compact|comfortable|spacious|airy)$/.test(c),
  );

describe('MlvFieldset density (#364)', () => {
  beforeEach(() => {
    TestBed.inject(MlvDensityService).setDensity('airy');
  });

  it('stamps its own mlvDensity, else the surrounding form’s', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(densityOf(root, '.own')).toEqual(['mlv-fieldset--compact']);
    expect(densityOf(root, '.inherited')).toEqual(['mlv-fieldset--spacious']);
    expect(root.querySelector('.own')?.classList.contains('consumer')).toBe(
      true,
    );
  });

  it('scopes the controls inside it with its own mlvDensity', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const probe = fixture.debugElement
      .query(By.directive(DensityProbe))
      .injector.get(DensityProbe);

    expect(probe.scope?.()).toBe('compact');
  });

  it('keys the dense legend on the fieldset’s own modifier', () => {
    const css = stripCssLayersFromText(sass.compile(FIELDSET_SCSS).css);
    for (const level of ['tight', 'compact']) {
      expect(css).toContain(
        `.mlv-fieldset[class*="--${level}"] > .mlv-fieldset__legend`,
      );
      expect(css).toContain(`.mlv-fieldset[class*="--${level}"] > legend`);
    }
    // No legend selector that *starts* at an ancestor attribute match
    // survives: it would reach the legend past a fieldset pinned to another
    // level. (The block's own gap scale keeps the mixin form — the fieldset's
    // own modifier excludes that ancestor branch.)
    expect(css).not.toMatch(
      /(^|[\s,}])\[class\*=["']?--(tight|compact)["']?\]\s+\.mlv-fieldset(__legend|\s*>\s*legend)/,
    );
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
