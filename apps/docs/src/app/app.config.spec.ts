import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CssVarNamespacer } from '@angular/platform-browser';
import { appConfig } from './app.config';

/**
 * Stands in for a Malva component: `ViewEncapsulation.None`, a component
 * stylesheet reading a global `--mlv-*` token, and a `[style.--mlv-*]` host
 * binding. The compiler and the renderer treat it exactly as they treat every
 * library component — which is the point, because the test environment does
 * not inject a library component's compiled `styleUrl` into the document.
 */
@Component({
  selector: 'docs-css-var-namespacing-probe',
  template: '',
  styles: [
    `
      .docs-css-var-namespacing-probe {
        color: var(--mlv-text-primary);
        inline-size: var(--mlv-probe-size);
      }
    `,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'docs-css-var-namespacing-probe',
    '[style.--mlv-probe-size]': '"1rem"',
  },
})
class CssVarNamespacingProbe {}

/**
 * CSS-variable namespacing is unsupported (D32, #293).
 *
 * From Angular 22.1 the compiler rewrites every custom property in a
 * component stylesheet (`var(--mlv-x)` → `var(--%NS%mlv-x)`) and in every
 * `[style.--x]` binding, for every encapsulation mode; the linker does the
 * same to the partial-compiled FESM a consumer installs. The renderer fills
 * `%NS%` with `''` by default, so nothing changes — until an application opts
 * in with `provideCssVarNamespacing()`. Then every component reads
 * `--<ns>_mlv-*` while the global token sheet (`malva-ui.css`) still declares
 * only `--mlv-*`, and `style.setProperty('--mlv-…')` writes (tabs indicator,
 * drawer resize, scheduler geometry) stay un-namespaced. Measured in Chromium
 * on the docs build: the primary button loses its fill, radius and height,
 * and the tabs indicator collapses to 0px.
 *
 * jsdom resolves no `var()`, so these assertions read names instead: the
 * namespace the docs providers resolve, and the custom-property names a
 * component actually writes into the document.
 */
describe('appConfig — CSS variable namespacing (unsupported)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
  });

  it('resolves no namespace for --mlv-* names', () => {
    expect(
      TestBed.inject(CssVarNamespacer).namespace('--mlv-background-accent-1'),
    ).toBe('--mlv-background-accent-1');
  });

  it('writes component styles and style bindings under the global --mlv-* names', async () => {
    const fixture = TestBed.createComponent(CssVarNamespacingProbe);
    await fixture.whenStable();

    const css = [...document.head.querySelectorAll('style')]
      .map((style) => style.textContent ?? '')
      .filter((text) => text.includes('.docs-css-var-namespacing-probe'))
      .join('\n');
    // Seeded: the probe's stylesheet is in the document and reads the token…
    expect(css).toContain('var(--mlv-text-primary)');
    // …and no read in it has been namespaced away from the global name.
    expect(css.match(/var\(--[\w-]*?_mlv-[\w-]+/g) ?? []).toEqual([]);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--mlv-probe-size')).toBe('1rem');
  });
});
