import { createRequire } from 'node:module';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTimePicker } from './time-picker';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The `--mlv-tp-*` → `--mlv-scrubber-*` alias layer, exercised as a **cascade**
 * rather than as stylesheet text (#129).
 *
 * The promise the extraction made was not "every published name is still
 * declared somewhere" but *no consumer override breaks*. Before #129 the drum
 * leaf read `var(--mlv-tp-*)` directly, so an override inherited from any
 * ancestor reached it. Now the leaf reads `--mlv-scrubber-*`, and a custom
 * property's `var()`s are substituted on the element that **declares** it — so
 * an alias declared on `.mlv-time-picker__panel` resolves against the panel's
 * own values and inherits downward already frozen, dropping every `--mlv-tp-*`
 * override placed below it. A consumer cannot include a Sass mixin to opt back
 * in, so the include site *is* the contract. Measured in Chrome while the
 * aliases lived on the panel: `--mlv-tp-visible-rows: 7` on
 * `.mlv-time-picker__columns` was a no-op in the anchored dropdown (stripe 72px,
 * track 180px), and `--mlv-tp-font-size: 2rem` moved the `:` divider — which
 * still reads the `tp` names directly — while the drum beside it stayed at 14px.
 *
 * ### How this runs without a browser
 *
 * The vitest setup for this project does not inline component stylesheets, so
 * the compiled `time-picker.scss` is injected here and matched against the real
 * rendered overlay. jsdom then does the part that must not be faked — selector
 * matching and inline styles — but neither inherits custom properties nor
 * substitutes `var()`. Those two steps are spelled out in {@link resolveToken}
 * below, straight from the CSS rules quoted above, and they are the only
 * hand-written part: what is under test is *where the alias is declared*, and
 * that comes entirely from the stylesheet and the DOM.
 */

/**
 * The nearest self-or-ancestor element that actually declares `name`, with the
 * raw declaration. This is custom-property inheritance: jsdom reports a matched
 * declaration's text on the element it matched and `''` everywhere else.
 */
function declarationOf(
  from: Element,
  name: string,
): { node: Element; value: string } | null {
  for (let node: Element | null = from; node; node = node.parentElement) {
    const value = getComputedStyle(node).getPropertyValue(name).trim();
    if (value !== '') return { node, value };
  }
  return null;
}

/** Substitutes every `var()` in `value` against `node`, recursively. */
function substitute(value: string, node: Element, depth: number): string {
  if (depth > 16) throw new Error(`var() recursion resolving \`${value}\``);

  let out = '';
  let cursor = 0;
  for (;;) {
    const start = value.indexOf('var(', cursor);
    if (start === -1) {
      out += value.slice(cursor);
      return out;
    }
    out += value.slice(cursor, start);

    let nesting = 1;
    let end = start + 'var('.length;
    for (; end < value.length && nesting > 0; end++) {
      if (value[end] === '(') nesting++;
      else if (value[end] === ')') nesting--;
    }
    const inner = value.slice(start + 'var('.length, end - 1);

    let comma = -1;
    for (let i = 0, depthInside = 0; i < inner.length; i++) {
      if (inner[i] === '(') depthInside++;
      else if (inner[i] === ')') depthInside--;
      else if (inner[i] === ',' && depthInside === 0) {
        comma = i;
        break;
      }
    }
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? null : inner.slice(comma + 1).trim();

    // The whole point: substitution happens on the *declaring* element, so a
    // reference resolves against what is visible there — not against what is
    // visible at the element that finally reads the result.
    const declaration = declarationOf(node, name);
    if (declaration) {
      out += substitute(declaration.value, declaration.node, depth + 1);
    } else if (fallback !== null) {
      out += substitute(fallback, node, depth + 1);
    }
    cursor = end;
  }
}

/** The value `el` computes for the custom property `name`. */
function resolveToken(el: Element, name: string): string {
  const declaration = declarationOf(el, name);
  if (!declaration) return '';
  // Sass wraps long `calc()`s across lines, so collapse its indentation rather
  // than pinning it — the same normalisation the compiled-CSS specs use.
  return substitute(declaration.value, declaration.node, 0)
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/**
 * Narrows a query result to a non-null element, failing with the reason the
 * spec cannot continue instead of a `TypeError` several lines later.
 */
function must<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(`${what} — the cascade spec has nothing to resolve`);
  }
  return value;
}

interface Rendered {
  panel: HTMLElement;
  columns: HTMLElement;
  strip: HTMLElement;
  destroy: () => void;
}

async function render(): Promise<Rendered> {
  await TestBed.configureTestingModule({
    imports: [MlvTimePicker],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();

  const fixture = TestBed.createComponent(MlvTimePicker);
  fixture.detectChanges();
  await fixture.whenStable();

  must(
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.mlv-time-picker__trigger',
    ),
    'the trigger did not render',
  ).click();
  fixture.detectChanges();
  await fixture.whenStable();

  const overlay = TestBed.inject(OverlayContainer).getContainerElement();
  const panel = must(
    overlay.querySelector<HTMLElement>('.mlv-time-picker__panel'),
    'the panel did not render',
  );
  const columns = must(
    overlay.querySelector<HTMLElement>('.mlv-time-picker__columns'),
    'the columns row did not render',
  );
  const strip = must(
    overlay.querySelector<HTMLElement>('mlv-scrubber'),
    'no <mlv-scrubber> rendered',
  );

  expect(panel.contains(columns) && columns.contains(strip)).toBe(true);

  return {
    panel,
    columns,
    strip,
    destroy: () => {
      fixture.destroy();
      TestBed.inject(OverlayContainer).ngOnDestroy();
    },
  };
}

describe('mlv-time-picker — a --mlv-tp-* override still reaches the drum', () => {
  let styleEl: HTMLStyleElement;

  beforeAll(() => {
    styleEl = document.createElement('style');
    styleEl.textContent = stripCssLayersFromText(
      sass.compile(resolvePath(HERE, './time-picker.scss')).css,
    );
    document.head.appendChild(styleEl);
  });

  afterAll(() => styleEl.remove());

  // ---------------------------------------------------------------------------
  // Trigger-anchored dropdown — the case the alias layer silently broke.
  //
  // This project ships no `matchMedia` stub, so `mobileMode="auto"` resolves to
  // full-screen by default; the desktop viewport has to be installed before the
  // component is created, the same shape `time-picker.spec.ts` uses.
  // ---------------------------------------------------------------------------
  describe('in the trigger-anchored dropdown', () => {
    let restoreMatchMedia: (() => void) | undefined;
    let dom: Rendered;

    beforeEach(async () => {
      const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string): MediaQueryList =>
          ({
            matches: /min-width/.test(query),
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
          }) as unknown as MediaQueryList,
      });
      restoreMatchMedia = () => {
        if (original) Object.defineProperty(window, 'matchMedia', original);
        else delete (window as { matchMedia?: unknown }).matchMedia;
      };

      dom = await render();
      expect(dom.panel.classList).not.toContain(
        'mlv-time-picker__panel--sheet',
      );
    });

    afterEach(() => {
      dom.destroy();
      restoreMatchMedia?.();
    });

    it('uses the published defaults when nothing overrides them', () => {
      expect(resolveToken(dom.strip, '--mlv-scrubber-visible-rows')).toBe('5');
      expect(resolveToken(dom.strip, '--mlv-scrubber-item-size')).toBe(
        '2.25rem',
      );
      expect(resolveToken(dom.strip, '--mlv-scrubber-side-rows')).toBe(
        'calc((5 - 1) / 2)',
      );
      expect(resolveToken(dom.strip, '--mlv-scrubber-track-size')).toBe(
        'calc(2.25rem * 5)',
      );
    });

    it('follows --mlv-tp-visible-rows set on .mlv-time-picker__columns', () => {
      // The headline knob, on the element between the panel and the drum that
      // the mobile sheet itself targets — so the natural place for a consumer
      // to write it. Measured broken in Chrome: the strip stayed at 5, the
      // stripe at 72px and the track at 180px.
      dom.columns.style.setProperty('--mlv-tp-visible-rows', '7');

      expect(resolveToken(dom.strip, '--mlv-scrubber-visible-rows')).toBe('7');
      // The stripe offset, the snap port and the list padding are all multiples
      // of the side-row count, so this is the drum moving, not one length.
      expect(resolveToken(dom.strip, '--mlv-scrubber-side-rows')).toBe(
        'calc((7 - 1) / 2)',
      );
    });

    it('follows --mlv-tp-font-size and --mlv-tp-track-height set there too', () => {
      // The pair the review measured against the `:` divider, which reads the
      // `tp` names directly and therefore always followed: divider 14 → 32px
      // and 180 → 300 while the drum beside it did not move at all.
      dom.columns.style.setProperty('--mlv-tp-font-size', '2rem');
      dom.columns.style.setProperty('--mlv-tp-track-height', '300px');

      expect(resolveToken(dom.strip, '--mlv-scrubber-font-size')).toBe('2rem');
      expect(resolveToken(dom.strip, '--mlv-scrubber-track-size')).toBe(
        '300px',
      );
    });

    it('follows an override on the panel, and one on the strip itself', () => {
      // Two more points on the same chain: the outermost element inside the
      // overlay, and the leaf. Any of the three has to work — "an override
      // inherited from *any* ancestor" is what the pre-#129 drum gave.
      dom.panel.style.setProperty('--mlv-tp-item-height', '3rem');
      expect(resolveToken(dom.strip, '--mlv-scrubber-item-size')).toBe('3rem');

      dom.strip.style.setProperty('--mlv-tp-item-height', '4rem');
      expect(resolveToken(dom.strip, '--mlv-scrubber-item-size')).toBe('4rem');
    });

    it('declares the alias layer on the strip and nowhere above it', () => {
      // An alias on an ancestor is not a harmless duplicate — it wins for its
      // whole subtree at the value it froze, which is precisely the bug.
      const ALIASES = [
        '--mlv-scrubber-visible-rows',
        '--mlv-scrubber-side-rows',
        '--mlv-scrubber-item-size',
        '--mlv-scrubber-track-size',
        '--mlv-scrubber-cross-size',
        '--mlv-scrubber-font-size',
      ];
      for (const alias of ALIASES) {
        const declaration = declarationOf(dom.strip, alias);
        expect(declaration, `\`${alias}\` is declared nowhere`).not.toBeNull();
        expect(
          declaration?.node,
          `\`${alias}\` is declared above the strip`,
        ).toBe(dom.strip);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Mobile sheet — the same mechanism, from the one override the library itself
  // ships. It used to work only because the sheet re-included the alias mixin on
  // the very element carrying the overrides.
  // ---------------------------------------------------------------------------
  describe('in the mobile full-screen sheet', () => {
    let dom: Rendered;

    beforeEach(async () => {
      dom = await render();
      expect(dom.panel.classList).toContain('mlv-time-picker__panel--sheet');
    });

    afterEach(() => dom.destroy());

    it('carries the sheet’s seven rows into the drum with no re-include', () => {
      expect(resolveToken(dom.strip, '--mlv-scrubber-visible-rows')).toBe('7');
      expect(resolveToken(dom.strip, '--mlv-scrubber-side-rows')).toBe(
        'calc((7 - 1) / 2)',
      );
      expect(resolveToken(dom.strip, '--mlv-scrubber-item-size')).toBe(
        'max(2.75rem, calc(100cqh / 7))',
      );
      // Re-declared on `__columns` against the sheet's own item height, so the
      // track is seven of *these* rows and not five of the density ones.
      expect(resolveToken(dom.strip, '--mlv-scrubber-track-size')).toBe(
        'calc(max(2.75rem, calc(100cqh / 7)) * 7)',
      );
    });
  });
});
