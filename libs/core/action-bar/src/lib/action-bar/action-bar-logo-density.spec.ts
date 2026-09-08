import { createRequire } from 'node:module';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  MlvDensityRootDirective,
  MlvDensityService,
} from '@malva-ui/cdk/density';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { MlvActionBar } from './action-bar';
import { MlvActionBarLogo } from './components/action-bar-logo';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The logo's density has to be the **bar's**, not the nearest density-modified
 * ancestor's (#25 review, B1).
 *
 * ### The defect this pins
 *
 * `density.density-*` emits two branches: a self branch `&[class*='--x']` and
 * an ancestor branch `[class*='--x'] &:not(<the other four>)`. The bar always
 * carries its own stamped `mlv-action-bar--<density>`, so the `:not()` excludes
 * every ancestor branch that disagrees with it — the bar is safe. The logo
 * carries **no** density class of its own, so *every* ancestor branch matched
 * it, all at `(0,3,0)`, and source order picked the winner: airy > spacious >
 * compact > tight, whatever the bar had resolved. In the shipped docs app —
 * `<mlv-layout mlvDensityRoot>` around a `<header mlvActionBar mlvDensity="…">`
 * — a global `spacious` gave an 18px logo and `airy` a 20px one inside a bar
 * the consumer had asked to be compact.
 *
 * ### Why it is asserted here and not on stylesheet text
 *
 * Every other assertion in this slice reads compiled SCSS *text* or class
 * names, and neither can see this: the text was correct, the class names were
 * correct, and the bug lived entirely in which rule won for a DOM the specs
 * never built. So this file renders the real nested DOM, injects the real
 * compiled stylesheets, and lets jsdom do the one part that must not be faked —
 * selector matching and the cascade.
 *
 * jsdom's limits shape what can be read back. `cssstyle` **rejects** a `var()`
 * value for `font-size` (`getPropertyValue('font-size')` returns `''`) and
 * implements neither `padding-block` nor `padding-inline`, but it passes `gap`
 * through verbatim and stores custom properties per element. `gap` is therefore
 * the property the cascade is measured on; `font-size` rides the identical
 * mechanism and is pinned structurally instead, by the selector-shape test
 * below.
 */

/** Compiled component CSS, layers flattened the way the jsdom setup expects. */
function compile(file: string): string {
  return stripCssLayersFromText(sass.compile(resolvePath(HERE, file)).css);
}

const BAR_CSS = compile('./action-bar.scss');
const LOGO_CSS = compile('./components/action-bar-logo.scss');

/**
 * Resolves `value` through custom-property indirection, the way a browser
 * substitutes `var()` — on the nearest self-or-ancestor element that actually
 * declares the name, or on the fallback when nothing does.
 *
 * Terminal `--mlv-spacing-*` / `--mlv-font-size-*` references are left as
 * written: the global theme is not injected here, so the token *name* is the
 * value under test. That is exactly the granularity the density scale is
 * specified at.
 */
function resolveValue(el: Element, value: string): string {
  const match = /^var\((--[\w-]+)(?:,\s*(.*))?\)$/.exec(value.trim());
  if (!match) return value.trim();

  const [, name, fallback] = match;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const declared = getComputedStyle(node).getPropertyValue(name).trim();
    if (declared !== '') return resolveValue(node, declared);
  }
  return fallback === undefined ? value.trim() : resolveValue(el, fallback);
}

/** The `gap` `el` ends up with, custom-property indirection followed. */
function effectiveGap(el: Element): string {
  return resolveValue(el, getComputedStyle(el).getPropertyValue('gap'));
}

/**
 * The nearest self-or-ancestor element declaring `name`, or `null`. Custom
 * properties inherit, so *where* one is declared is what decides whether a
 * descendant can be reached by something above the bar.
 */
function declaringElement(from: Element, name: string): Element | null {
  for (let node: Element | null = from; node; node = node.parentElement) {
    if (getComputedStyle(node).getPropertyValue(name).trim() !== '')
      return node;
  }
  return null;
}

/** Gap token each density step specifies, for the bar and for the logo. */
const SCALE: Readonly<
  Record<MlvDensity, { readonly bar: string; readonly logo: string }>
> = {
  tight: { bar: 'var(--mlv-spacing-0-5)', logo: 'var(--mlv-spacing-1)' },
  compact: { bar: 'var(--mlv-spacing-1)', logo: 'var(--mlv-spacing-1-5)' },
  comfortable: { bar: 'var(--mlv-spacing-1)', logo: 'var(--mlv-spacing-2)' },
  spacious: { bar: 'var(--mlv-spacing-2)', logo: 'var(--mlv-spacing-2-5)' },
  airy: { bar: 'var(--mlv-spacing-3)', logo: 'var(--mlv-spacing-3)' },
};

const DENSITIES = Object.keys(SCALE) as readonly MlvDensity[];

@Component({
  imports: [MlvDensityRootDirective, MlvActionBar, MlvActionBarLogo],
  template: `
    <div mlvDensityRoot>
      <header mlvActionBar [mlvDensity]="barDensity()" aria-label="Application">
        <a mlvActionBarLogo href="/">Malva</a>
      </header>
    </div>
  `,
})
class NestedDensityHost {
  readonly barDensity = signal<MlvDensity | undefined>(undefined);
}

describe('mlv-action-bar — the logo follows the bar, not an ancestor', () => {
  let styleEl: HTMLStyleElement;
  let fixture: ComponentFixture<NestedDensityHost>;
  let service: MlvDensityService;
  let root: HTMLElement;
  let bar: HTMLElement;
  let logo: HTMLElement;

  beforeAll(() => {
    styleEl = document.createElement('style');
    styleEl.textContent = `${BAR_CSS}\n${LOGO_CSS}`;
    document.head.appendChild(styleEl);
  });

  afterAll(() => styleEl.remove());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NestedDensityHost],
    }).compileComponents();

    service = TestBed.inject(MlvDensityService);
    fixture = TestBed.createComponent(NestedDensityHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    root = host.querySelector('[mlvDensityRoot]') as HTMLElement;
    bar = host.querySelector('header') as HTMLElement;
    logo = host.querySelector('a') as HTMLElement;

    // The stylesheet has to be reaching the DOM at all, or every assertion
    // below would pass vacuously on an empty computed value.
    expect(effectiveGap(bar)).not.toBe('');
    expect(effectiveGap(logo)).not.toBe('');
  });

  afterEach(() => service.setDensity('comfortable'));

  it.each(DENSITIES)(
    'sizes the logo from the bar at %s, against every conflicting ancestor',
    async (barDensity) => {
      fixture.componentInstance.barDensity.set(barDensity);

      for (const ancestorDensity of DENSITIES) {
        service.setDensity(ancestorDensity);
        fixture.detectChanges();
        await fixture.whenStable();

        // Precondition: the two really do disagree in the DOM, so a pass is
        // not the ancestor happening to agree with the bar.
        expect(root.classList).toContain(`mlv--${ancestorDensity}`);
        expect(bar.classList).toContain(`mlv-action-bar--${barDensity}`);

        const scale = SCALE[barDensity];
        expect(effectiveGap(bar), `bar gap under mlv--${ancestorDensity}`).toBe(
          scale.bar,
        );
        expect(
          effectiveGap(logo),
          `logo gap in a ${barDensity} bar under mlv--${ancestorDensity}`,
        ).toBe(scale.logo);
      }
    },
  );

  it('never lets a value reach the logo from above the bar', async () => {
    // The failure mode is not "the logo is unstyled" but "the logo is styled by
    // something outside the bar". Whatever carries the logo's density has to be
    // declared on the bar or below it — never on the density root.
    fixture.componentInstance.barDensity.set('tight');
    service.setDensity('airy');
    fixture.detectChanges();
    await fixture.whenStable();

    for (const property of [
      '--mlv-action-bar-logo-gap',
      '--mlv-action-bar-logo-font-size',
    ]) {
      const node = declaringElement(logo, property);
      expect(node, `\`${property}\` is declared nowhere`).not.toBeNull();
      expect(
        node === bar || bar.contains(node as Node),
        `\`${property}\` is declared above the bar`,
      ).toBe(true);
    }
  });
});

describe('action-bar-logo.scss selector shape', () => {
  /**
   * `font-size` cannot be measured in jsdom — `cssstyle` rejects a `var()`
   * value for it — so the property that the density scale moves most visibly is
   * pinned structurally instead: no rule in the logo stylesheet may be selected
   * by a density class on an *ancestor*. An ancestor-anchored selector is
   * precisely the shape that made the logo follow the wrong element, and it is
   * the shape `density.density-*`'s ancestor branch emits.
   */
  it('anchors every rule at the logo or the bar, never at an ancestor class', () => {
    const selectors = [...LOGO_CSS.matchAll(/^([^@{}\n][^{}]*)\{/gm)].map(
      ([, selector]) => selector.trim(),
    );
    expect(selectors.length).toBeGreaterThan(0);

    for (const selector of selectors) {
      for (const compound of selector.split(',')) {
        const leftmost = compound.trim().split(/\s+|(?=>)/)[0];
        expect(
          leftmost,
          `\`${compound.trim()}\` is selected by an ancestor, not by the bar`,
        ).toMatch(/^\.mlv-action-bar/);
      }
    }
  });
});
