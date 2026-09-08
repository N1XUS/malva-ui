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

/**
 * Every style rule in the compiled sheet, read once.
 *
 * `attachStylesheet()` is reused so the `:has()` rules are dropped the same way
 * — nwsapi cannot match them (see the note on that helper and on the corner
 * rule's own spec below).
 */
const COMPILED_RULES: readonly CSSStyleRule[] = (() => {
  const style = attachStylesheet();
  const collected = [...(style.sheet?.cssRules ?? [])].filter(
    (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule,
  );
  style.remove();
  return collected;
})();

/**
 * Whether any rule in the compiled sheet that declares `property: value`
 * targets `el`.
 *
 * Read through the selector engine rather than `getComputedStyle` because
 * jsdom resolves the cascade by **document order alone**: for these
 * declarations the base rule sits further down the file and wins the computed
 * value whether or not the state rule reached the element, so the computed
 * value cannot answer "did this rule apply here?". `element.matches()` can —
 * it resolves the child combinator correctly (only `:scope` and
 * `:has(… :not(…))` are broken in nwsapi).
 *
 * A trailing pseudo-element (`::-webkit-scrollbar`) is stripped so such a rule
 * is attributed to the element it decorates, and `:hover` is swapped for the
 * `HOVERED` marker class: jsdom never enters a hover state, so `matches()`
 * answers `false` for every `:hover` selector and a leak assertion written
 * against one would pass whatever its combinator said. Put `HOVERED` on the
 * host the pointer would be over; the combinator under test is untouched.
 *
 * Fails loudly when the declaration is absent from the sheet, so a renamed or
 * deleted property cannot turn a leak assertion vacuously green.
 */
const HOVERED = 'test-hovered';

function isTargetedBy(el: Element, property: string, value: string): boolean {
  const declaring = COMPILED_RULES.filter(
    (rule) =>
      rule.style.getPropertyValue(property).replace(/\s+/g, ' ').trim() ===
      value,
  );

  expect(
    declaring.length,
    `no compiled rule declares \`${property}: ${value}\``,
  ).toBeGreaterThan(0);

  return declaring.some((rule) =>
    el.matches(
      rule.selectorText
        .replace(/::[a-z-]+$/, '')
        .replaceAll(':hover', `.${HOVERED}`),
    ),
  );
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
  it('keeps the opacity transition on the track', () => {
    const track = COMPILED_RULES.find(
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

describe('MlvScrollbar — a host state does not leak into a nested scrollbar', () => {
  let fixture: ComponentFixture<NestedScrollbarHost>;
  let outerHostEl: HTMLElement;
  let innerHostEl: HTMLElement;
  let outerTrackV: HTMLElement;
  let innerTrackV: HTMLElement;
  let outerViewport: HTMLElement;
  let innerViewport: HTMLElement;
  let outerThumbV: HTMLElement;
  let innerThumbV: HTMLElement;
  let styleEl: HTMLStyleElement;

  const opacityOf = (el: HTMLElement): string => getComputedStyle(el).opacity;

  /**
   * Computed `--mlv-sb-thumb-bg` on a thumb, with whitespace stripped — a
   * custom property is preserved verbatim, so the value carries whatever line
   * wrapping the source happened to have.
   *
   * Readable through `getComputedStyle` where the thumb's other drag
   * declarations are not: jsdom does not inherit custom properties, so the
   * value is `''` unless a rule set it on the thumb itself — exactly the
   * question these specs ask. The host's own `--mlv-sb-thumb-bg` never shows
   * up here, and the `--dragging` thumb rule is the only other declaration of
   * it in the sheet.
   */
  const thumbBg = (el: HTMLElement): string =>
    getComputedStyle(el)
      .getPropertyValue('--mlv-sb-thumb-bg')
      .replace(/\s+/g, '');

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
    outerViewport = ownChild(outerHostEl, 'mlv-scrollbar__viewport');
    innerViewport = ownChild(innerHostEl, 'mlv-scrollbar__viewport');
    // The thumb is a *grandchild* of the host — one `>` is not enough to reach
    // it, which is the part of the fix these thumb specs pin.
    outerThumbV = ownChild(outerTrackV, 'mlv-scrollbar__thumb');
    innerThumbV = ownChild(innerTrackV, 'mlv-scrollbar__thumb');

    // Each track really belongs to its own host — the assertions below compare
    // two different elements, not one element with itself.
    expect(outerTrackV).not.toBe(innerTrackV);
    expect(outerThumbV).not.toBe(innerThumbV);
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

  it("leaves a nested scrollbar's track alone while the outer one is disabled", () => {
    // A consumer disables an outer scrollbar *so that* a region nested inside
    // it can own the scrolling. Stripping that region's track is therefore the
    // opposite of what the flag is for — and with `mlv-textarea` the field
    // suppresses its own native bar, so the content would scroll with no
    // visible scrollbar at all: issue #90 all over again.
    outerHostEl.classList.add('mlv-scrollbar--disabled');

    expect(getComputedStyle(outerTrackV).display).toBe('none');
    expect(getComputedStyle(innerTrackV).display).not.toBe('none');
  });

  it('still hides the track of a nested scrollbar that is itself disabled', () => {
    // The scoping must not cost a nested scrollbar its own disabled state.
    innerHostEl.classList.add('mlv-scrollbar--disabled');

    expect(getComputedStyle(innerTrackV).display).toBe('none');
    expect(getComputedStyle(outerTrackV).display).not.toBe('none');
  });

  it("does not hand a nested scrollbar's viewport back its native bar", () => {
    // The other half of `--disabled`, and it compounds with the track rule
    // above: an inner scrollbar would lose its themed track and be handed an
    // unthemed OS bar in the same breath, for a state set on an ancestor.
    outerHostEl.classList.add('mlv-scrollbar--disabled');

    expect(isTargetedBy(outerViewport, 'scrollbar-width', 'auto')).toBe(true);
    expect(isTargetedBy(innerViewport, 'scrollbar-width', 'auto')).toBe(false);
  });

  it("still restores the native bar on a nested scrollbar's own viewport", () => {
    // The scoping must not cost a nested scrollbar its own disabled state.
    innerHostEl.classList.add('mlv-scrollbar--disabled');

    expect(isTargetedBy(innerViewport, 'scrollbar-width', 'auto')).toBe(true);
    expect(isTargetedBy(outerViewport, 'scrollbar-width', 'auto')).toBe(false);
  });

  it("does not stop a nested scrollbar's viewport from scrolling", () => {
    // `--external` says *this* scrollbar decorates a foreign scroll box, so its
    // own viewport must not scroll or clip. Reaching a nested viewport with
    // that turns a scrollbar nobody decorated into a non-scrolling box whose
    // content overflows its host and whose tracks never leave `--hidden`.
    // Latent rather than live today — `mlv-textarea` is the only `[scroller]`
    // consumer and it decorates a bare `<textarea>` — but `[scroller]` is
    // public API and nothing stops a consumer from projecting an `mlv-chat`.
    outerHostEl.classList.add('mlv-scrollbar--external');

    expect(isTargetedBy(outerViewport, 'overflow', 'visible')).toBe(true);
    expect(isTargetedBy(innerViewport, 'overflow', 'visible')).toBe(false);
  });

  it("still frees a nested scrollbar's own viewport when it is itself external", () => {
    // The scoping must not cost a nested scrollbar its own external mode.
    innerHostEl.classList.add('mlv-scrollbar--external');

    expect(isTargetedBy(innerViewport, 'overflow', 'visible')).toBe(true);
    expect(isTargetedBy(outerViewport, 'overflow', 'visible')).toBe(false);
  });

  it('does not widen a nested thumb while the pointer rests on the outer host', () => {
    // Since issue #96 an inner track is revealed by the inner scrollbar's own
    // `--scrolling` / `--dragging`, with no pointer near it — so an outer hover
    // now lands on a *painted* inner thumb. Worse, `.mlv-scrollbar:hover
    // .mlv-scrollbar__thumb` outranks the inner's own `--scrolling` /
    // `--dragging` thumb rules, so it does not merely add to the inner
    // scrollbar's appearance, it overrides it.
    outerHostEl.classList.add(HOVERED);

    expect(isTargetedBy(outerThumbV, 'opacity', '0.8')).toBe(true);
    expect(isTargetedBy(innerThumbV, 'opacity', '0.8')).toBe(false);
  });

  it('still widens a nested thumb while the pointer rests on the nested host', () => {
    // The scoping must not cost a nested scrollbar its own hover ramp.
    innerHostEl.classList.add(HOVERED);

    expect(isTargetedBy(innerThumbV, 'opacity', '0.8')).toBe(true);
    expect(isTargetedBy(outerThumbV, 'opacity', '0.8')).toBe(false);
  });

  it('does not pin a nested thumb opaque while the outer host is scrolling', () => {
    // `opacity: 1` is also declared by the track reveal rule and by the
    // `--dragging` thumb rule; neither can match a thumb here — the first
    // takes a track as its subject, and `--dragging` is not on any host — so
    // this reads the `--scrolling` thumb rule alone.
    outerHostEl.classList.add('mlv-scrollbar--scrolling');

    expect(isTargetedBy(outerThumbV, 'opacity', '1')).toBe(true);
    expect(isTargetedBy(innerThumbV, 'opacity', '1')).toBe(false);
  });

  it('still pins a nested thumb opaque while the nested host is scrolling', () => {
    // The scoping must not cost a nested scrollbar its own scrolling ramp.
    innerHostEl.classList.add('mlv-scrollbar--scrolling');

    expect(isTargetedBy(innerThumbV, 'opacity', '1')).toBe(true);
    expect(isTargetedBy(outerThumbV, 'opacity', '1')).toBe(false);
  });

  it('does not recolour a nested thumb while the outer thumb is dragged', () => {
    // The sharpest of the thumb rules: it is the only place in the sheet that
    // sets `--mlv-sb-thumb-bg` or `cursor: grabbing`, so no inner rule can win
    // either back at any specificity. A drag holds its modifier for the whole
    // gesture — seconds, against `--scrolling`'s 150 ms — and `opacity: 0`
    // never removed hit-testing, so the grabbing cursor also lands on
    // still-invisible inner thumbs the pointer crosses on the way.
    outerHostEl.classList.add('mlv-scrollbar--dragging');

    expect(thumbBg(outerThumbV)).toBe('var(--mlv-text-secondary)');
    expect(thumbBg(innerThumbV)).toBe('');
    expect(isTargetedBy(innerThumbV, 'cursor', 'grabbing')).toBe(false);
  });

  it('still recolours a nested thumb while that nested thumb is dragged', () => {
    // The scoping must not cost a nested scrollbar its own drag appearance.
    innerHostEl.classList.add('mlv-scrollbar--dragging');

    expect(thumbBg(innerThumbV)).toBe('var(--mlv-text-secondary)');
    expect(thumbBg(outerThumbV)).toBe('');
    expect(isTargetedBy(innerThumbV, 'cursor', 'grabbing')).toBe(true);
  });
});

/**
 * The corner-avoidance rule keeps the two tracks from overlapping where they
 * meet. Both halves of it are nesting-sensitive: the `:has()` probes ask
 * whether *a* vertical and *a* horizontal track are showing, and the
 * declaration block then shortens *a* track — so a vertical-only scrollbar
 * containing an `orientation="both"` one would satisfy both probes on the
 * inner scrollbar's tracks and cut a 12px dead gap into its own.
 *
 * Asserted against the compiled selector rather than the DOM because nwsapi
 * cannot match `:has(… :not(…))` at all: `element.matches()` answers a silent
 * `false` for it (probed directly), and jsdom's CSSOM re-serialises the
 * selector with the outer `:has(` dropped, which is why `attachStylesheet()`
 * deletes these rules before any spec above reads a computed style.
 */
describe("MlvScrollbar — corner avoidance is scoped to the host's own tracks", () => {
  const cornerSelectors = [...COMPILED_CSS.matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .map(([, selector]) => selector.replace(/\s+/g, ' ').trim())
    .filter((selector) => selector.includes(':has('));

  it('probes only the tracks the host owns', () => {
    // One rule per axis, each probing both axes.
    expect(cornerSelectors).toHaveLength(2);

    for (const selector of cornerSelectors) {
      expect(selector.match(/:has\(/g)).toHaveLength(2);
      expect(selector.match(/:has\(\s*>/g)).toHaveLength(2);
    }
  });

  it('shortens only the track the host owns', () => {
    for (const selector of cornerSelectors) {
      expect(selector).toMatch(
        /\)\s*>\s*\.mlv-scrollbar__track--(vertical|horizontal)$/,
      );
    }
  });

  /** The arguments of every `:has(...)` clause in `selector`, parens balanced. */
  function hasArguments(selector: string): string[] {
    const args: string[] = [];

    for (
      let i = selector.indexOf(':has(');
      i !== -1;
      i = selector.indexOf(':has(', i + 1)
    ) {
      let depth = 0;
      for (let j = i + 4; j < selector.length; j++) {
        if (selector[j] === '(') depth++;
        else if (selector[j] === ')' && --depth === 0) {
          args.push(selector.slice(i + 5, j).trim());
          break;
        }
      }
    }

    return args;
  }

  /** `selector` with every `:has(...)` clause removed, parens balanced. */
  function withoutHas(selector: string): string {
    let out = selector;

    for (const arg of hasArguments(selector))
      out = out.replace(`:has(${arg})`, '');

    return out.replace(/\s+/g, ' ').trim();
  }

  /** Evaluates a `:has(> …)` predicate by hand — nwsapi cannot match `:has()`. */
  function satisfies(host: HTMLElement, selector: string): boolean {
    return hasArguments(selector).every((arg) =>
      [...host.children].some((child) =>
        child.matches(arg.replace(/^>\s*/, '')),
      ),
    );
  }

  it('fires for a host that owns both tracks, and not for a nested one that does not', () => {
    // Built raw: this describe never reads a computed style, and the compiled
    // sheet drops the `:has()` rules before jsdom ever sees them.
    const outer = document.createElement('div');
    outer.className = 'mlv-scrollbar';
    outer.innerHTML = `
      <div class="mlv-scrollbar__viewport">
        <div class="mlv-scrollbar__content">
          <div class="mlv-scrollbar" id="inner">
            <div class="mlv-scrollbar__viewport"></div>
            <div class="mlv-scrollbar__track mlv-scrollbar__track--vertical"></div>
            <div class="mlv-scrollbar__track mlv-scrollbar__track--horizontal mlv-scrollbar__track--hidden"></div>
          </div>
        </div>
      </div>
      <div class="mlv-scrollbar__track mlv-scrollbar__track--vertical"></div>
      <div class="mlv-scrollbar__track mlv-scrollbar__track--horizontal"></div>`;
    document.body.appendChild(outer);

    try {
      const inner = outer.querySelector<HTMLElement>('#inner');

      expect(inner).not.toBeNull();

      for (const selector of cornerSelectors) {
        // One rule per axis — match the track this rule actually targets.
        const axis = selector.match(/track--(vertical|horizontal)$/)?.[1];
        const outerTrack = [...outer.children].find((el) =>
          el.classList.contains(`mlv-scrollbar__track--${axis}`),
        );

        expect(axis).toBeDefined();
        expect(outerTrack).toBeDefined();

        // Own-host direction: the outer owns a visible track on both axes, so
        // the rule must still fire for it. Without this, an over-scope that
        // stops the rule matching anything at all passes every other spec here.
        expect(satisfies(outer, selector)).toBe(true);
        expect(outerTrack!.matches(withoutHas(selector))).toBe(true);

        // Nested direction: the inner's horizontal track is hidden, so it does
        // not satisfy the predicate on its own parts — and must not inherit the
        // outer's satisfaction of it.
        expect(satisfies(inner!, selector)).toBe(false);
      }
    } finally {
      outer.remove();
    }
  });
});
