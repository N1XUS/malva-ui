/**
 * Regression guard for issue #96 — "the `--scrolling` modifier is dead code".
 *
 * `.mlv-scrollbar__track` ships at `opacity: 0` and the only rule that ever
 * lifted it was the host `:hover`. The `mlv-scrollbar--scrolling` modifier
 * lifted the **thumb**, which is a DOM child of the track, so the two
 * opacities composited (`1 x 0`) and scrolling without hovering painted
 * nothing at all.
 *
 * These specs therefore assert the **computed** opacity of the track, not the
 * presence of a class — a class-only assertion passed for the whole life of
 * the bug. jsdom never enters `:hover`, so the hover reveal path cannot mask a
 * regression here: whatever opacity the track resolves to is the one the
 * modifier alone produced.
 *
 * The component stylesheet is not injected by the test compiler, so — matching
 * the `mlv-page-content` precedent — the real SCSS is compiled and attached to
 * the document, and the cascade is then read back through `getComputedStyle`.
 * `scripts/testing/setup-strip-css-layers.js` (a `setupFiles` entry) flattens
 * the `@layer mlv.components` wrapper on its way into the `<style>` element,
 * so jsdom keeps the sheet instead of discarding it.
 *
 * One jsdom caveat to know before editing the stylesheet: jsdom resolves the
 * cascade by **document order alone** and ignores specificity, so a reveal rule
 * authored *above* `.mlv-scrollbar__track { opacity: 0 }` reads as `0` here
 * even though a browser would apply it. The stylesheet declares the reveal
 * after the base rule for exactly that reason. If these specs ever start
 * reporting `0` after a stylesheet reshuffle, check the rule order before
 * concluding the selector is wrong.
 */
import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MlvScrollbar } from './scrollbar';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

const SCROLLBAR_DIR = dirname(fileURLToPath(import.meta.url));

const COMPILED_CSS = sass.compile(join(SCROLLBAR_DIR, 'scrollbar.scss'), {
  style: 'expanded',
}).css;

/**
 * Attaches the compiled stylesheet to the document, minus the corner-avoidance
 * rule.
 *
 * That rule is the only `:has()` selector in the sheet and it nests a `:not()`
 * inside — a shape jsdom's CSSOM re-serialises with the outer `:has(` dropped,
 * so nwsapi then throws `SyntaxError: … is not a valid selector` on every
 * `getComputedStyle` call and takes the whole cascade down with it. It only
 * sets `bottom` / `inset-inline-end` on the tracks, never `opacity`, so
 * dropping it changes nothing these specs measure. Its own behaviour is
 * covered by the track-metric caching specs in `scrollbar.spec.ts`.
 */
function attachStylesheet(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = COMPILED_CSS;
  document.head.appendChild(style);

  const sheet = style.sheet;
  for (let index = (sheet?.cssRules.length ?? 0) - 1; index >= 0; index--) {
    const rule = sheet?.cssRules[index];
    if (rule instanceof CSSStyleRule && rule.selectorText.includes(':has(')) {
      sheet?.deleteRule(index);
    }
  }

  return style;
}

/** Recorded so a spec can drive the component's real `_updateGeometry()`. */
const resizeCallbacks: ResizeObserverCallback[] = [];

globalThis.ResizeObserver = class implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
};

describe('MlvScrollbar — track visibility (issue #96)', () => {
  let fixture: ComponentFixture<MlvScrollbar>;
  let hostEl: HTMLElement;
  let trackV: HTMLElement;
  let styleEl: HTMLStyleElement;

  /** Computed opacity of the vertical track, as a number. */
  const trackOpacity = (): number =>
    Number.parseFloat(getComputedStyle(trackV).opacity);

  beforeEach(async () => {
    resizeCallbacks.length = 0;

    styleEl = attachStylesheet();

    await TestBed.configureTestingModule({
      imports: [MlvScrollbar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    // TestBed's DOMTestComponentRenderer already inserts the fixture root into
    // `document.body`, so nothing is appended here — the cascade reaches the
    // host as it stands. The control assertion below would fail loudly (an
    // element outside the document computes `''`, not `'0'`) if that stopped
    // being true.
    fixture = TestBed.createComponent(MlvScrollbar);
    fixture.detectChanges();
    await fixture.whenStable();

    hostEl = fixture.nativeElement;
    trackV = hostEl.querySelector(
      '.mlv-scrollbar__track--vertical',
    ) as HTMLElement;

    // Real vertical overflow, so the track is not `--hidden` (`display: none`).
    const viewportEl = hostEl.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
    Object.defineProperty(viewportEl, 'clientHeight', {
      get: () => 100,
      configurable: true,
    });
    Object.defineProperty(viewportEl, 'scrollHeight', {
      get: () => 400,
      configurable: true,
    });

    resizeCallbacks.at(-1)?.([], {} as ResizeObserver);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(trackV.classList).not.toContain('mlv-scrollbar__track--hidden');
  });

  afterEach(() => {
    fixture.destroy();
    styleEl.remove();
  });

  it('resolves the track stylesheet at all (control for the assertions below)', () => {
    // Proves the layered component stylesheet reached jsdom and cascaded — if
    // it had not, `opacity` would read `''` and every assertion below would be
    // vacuous rather than meaningful.
    expect(getComputedStyle(trackV).opacity).toBe('0');
  });

  it('paints the track while the host carries --scrolling', () => {
    hostEl.classList.add('mlv-scrollbar--scrolling');

    expect(trackOpacity()).toBeGreaterThan(0);
  });

  it('paints the track for a real scroll event, not just a hand-applied class', async () => {
    const viewportEl = hostEl.querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;

    viewportEl.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(hostEl.classList).toContain('mlv-scrollbar--scrolling');
    expect(trackOpacity()).toBeGreaterThan(0);
  });

  it('paints the track while the host carries --dragging', () => {
    // A drag keeps pointer capture when the pointer leaves the host, at which
    // point `:hover` drops and only this modifier is left holding the track up.
    hostEl.classList.add('mlv-scrollbar--dragging');

    expect(trackOpacity()).toBeGreaterThan(0);
  });

  it("keeps a disabled scrollbar's track hidden even while --scrolling", () => {
    // The reveal rule is declared after `--disabled`'s `display: none`, so pin
    // that the reveal cannot resurrect a track the disabled state removed.
    hostEl.classList.add('mlv-scrollbar--disabled', 'mlv-scrollbar--scrolling');

    expect(getComputedStyle(trackV).display).toBe('none');
  });

  it('returns the track to fully transparent once --scrolling clears', () => {
    hostEl.classList.add('mlv-scrollbar--scrolling');
    expect(trackOpacity()).toBeGreaterThan(0);

    hostEl.classList.remove('mlv-scrollbar--scrolling');

    // The end state is 0; the existing `transition: opacity ...` on the track
    // carries it there. No bespoke delay or timer is involved.
    expect(getComputedStyle(trackV).opacity).toBe('0');
  });
});

describe('MlvScrollbar — track reveal is animated, not instant', () => {
  // The fade in and out is the existing `transition` on `.mlv-scrollbar__track`
  // — the fix must not replace it with an instant flip. Asserted against the
  // compiled declarations because jsdom does not resolve a `transition`
  // shorthand containing `var()` through `getComputedStyle`.
  const rules = (() => {
    const style = attachStylesheet();
    const collected = [...(style.sheet?.cssRules ?? [])].filter(
      (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
    );
    style.remove();
    return collected;
  })();

  it('keeps the opacity transition on the track', () => {
    const track = rules.find(
      ({ selectorText }) => selectorText === '.mlv-scrollbar__track',
    );

    expect(track?.style.getPropertyValue('transition').trim()).toBe(
      'opacity var(--mlv-duration-normal) var(--mlv-ease-default)',
    );
  });

  it('keeps the track inside the reduced-motion net', () => {
    // `mixins.reduced-motion('mlv-scrollbar')` collapses the duration for
    // `[class^='mlv-scrollbar__']`, which is where the track lives.
    expect(COMPILED_CSS).toContain('prefers-reduced-motion');
    expect(COMPILED_CSS).toMatch(/\[class\^=["']?mlv-scrollbar__["']?\]/);
    expect(COMPILED_CSS).toContain(
      'transition-duration: var(--mlv-duration-instant) !important',
    );
  });
});

/**
 * Host for the nesting case. `main[mlvPage]` wraps all page content in one
 * `mlv-scrollbar`, and that content routinely brings its own — `mlv-chat`, or
 * an external-scroller `mlv-textarea`. The inner scrollbar therefore sits in
 * the *descendant* subtree of the outer one.
 */
@Component({
  imports: [MlvScrollbar],
  template: `
    <mlv-scrollbar class="outer">
      <mlv-scrollbar class="inner"><div>content</div></mlv-scrollbar>
    </mlv-scrollbar>
  `,
})
class NestedScrollbarHost {}

describe('MlvScrollbar — a reveal state does not leak into a nested scrollbar', () => {
  let fixture: ComponentFixture<NestedScrollbarHost>;
  let outerHostEl: HTMLElement;
  let innerHostEl: HTMLElement;
  let outerTrackV: HTMLElement;
  let innerTrackV: HTMLElement;
  let styleEl: HTMLStyleElement;

  const opacityOf = (el: HTMLElement): string => getComputedStyle(el).opacity;

  /**
   * Returns one scrollbar's **own** part, walking `children` rather than
   * querying `:scope > …`.
   *
   * nwsapi (jsdom's selector engine) mis-resolves `:scope` here: on the outer
   * host, `querySelector(':scope > .mlv-scrollbar__track--vertical')` returns
   * the *inner* scrollbar's track — which comes first in document order — so
   * both lookups below would land on the same element and every assertion in
   * this describe would compare a track against itself. Probed directly; the
   * CSS side of the same nesting is matched correctly (`element.matches()` on
   * the child combinator answers `false` for an inner track).
   */
  function ownChild(scrollbarEl: HTMLElement, className: string): HTMLElement {
    const found = [...scrollbarEl.children].find((child) =>
      child.classList.contains(className),
    );
    expect(found).toBeInstanceOf(HTMLElement);
    return found as HTMLElement;
  }

  /** Gives a scrollbar's own viewport real vertical overflow. */
  function stubOverflow(scrollbarEl: HTMLElement): void {
    const viewportEl = ownChild(scrollbarEl, 'mlv-scrollbar__viewport');
    Object.defineProperty(viewportEl, 'clientHeight', {
      get: () => 100,
      configurable: true,
    });
    Object.defineProperty(viewportEl, 'scrollHeight', {
      get: () => 400,
      configurable: true,
    });
  }

  beforeEach(async () => {
    resizeCallbacks.length = 0;

    styleEl = attachStylesheet();

    await TestBed.configureTestingModule({
      imports: [NestedScrollbarHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NestedScrollbarHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const [outer, inner] = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'mlv-scrollbar',
      ),
    ];
    outerHostEl = outer;
    innerHostEl = inner;

    // The inner scrollbar really is a descendant of the outer one — the whole
    // point of the case. Asserted so the fixture cannot quietly stop nesting.
    expect(outerHostEl.contains(innerHostEl)).toBe(true);

    stubOverflow(outerHostEl);
    stubOverflow(innerHostEl);
    for (const run of resizeCallbacks) run([], {} as ResizeObserver);
    fixture.detectChanges();
    await fixture.whenStable();

    outerTrackV = ownChild(outerHostEl, 'mlv-scrollbar__track--vertical');
    innerTrackV = ownChild(innerHostEl, 'mlv-scrollbar__track--vertical');

    // Each track really belongs to its own host — the assertions below compare
    // two different elements, not one element with itself.
    expect(outerTrackV).not.toBe(innerTrackV);
    expect(outerTrackV.parentElement).toBe(outerHostEl);
    expect(innerTrackV.parentElement).toBe(innerHostEl);

    // Neither track is `--hidden`, so a `0` below is the reveal not reaching
    // it, never `display: none` making the question moot.
    expect(outerTrackV.classList).not.toContain('mlv-scrollbar__track--hidden');
    expect(innerTrackV.classList).not.toContain('mlv-scrollbar__track--hidden');
  });

  afterEach(() => {
    fixture.destroy();
    styleEl.remove();
  });

  it('reveals only the scrolling scrollbar, not the one nested inside it', () => {
    // One PageDown on the page scrollbar must not light up the chat's and the
    // textarea's scrollbars as well.
    outerHostEl.classList.add('mlv-scrollbar--scrolling');

    expect(opacityOf(outerTrackV)).toBe('1');
    expect(opacityOf(innerTrackV)).toBe('0');
  });

  it('reveals only the dragged scrollbar, not the one nested inside it', () => {
    // A drag holds its modifier for the whole gesture, so a descendant
    // combinator would keep every inner scrollbar lit for seconds at a time.
    outerHostEl.classList.add('mlv-scrollbar--dragging');

    expect(opacityOf(outerTrackV)).toBe('1');
    expect(opacityOf(innerTrackV)).toBe('0');
  });

  it('still reveals the inner scrollbar from its own state', () => {
    // The scoping must not cost a nested scrollbar its own reveal.
    innerHostEl.classList.add('mlv-scrollbar--scrolling');

    expect(opacityOf(innerTrackV)).toBe('1');
    expect(opacityOf(outerTrackV)).toBe('0');
  });
});
