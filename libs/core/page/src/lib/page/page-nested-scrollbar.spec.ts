/**
 * The page owns one `mlv-scrollbar` and aims several rules at its viewport —
 * `overflow-x: hidden`, the WCAG scroll padding, the snap progress chain and,
 * while chrome actually collapses, `overflow-anchor: none`.
 *
 * None of them may reach past the page's own viewport. Scrollbars nest —
 * `mlv-chat` and an external-scroller `mlv-textarea` bring their own, and a
 * pane that donates its scroll through `[mlvPageScroller]` usually *is* one —
 * so a descendant combinator would kill every nested viewport's horizontal
 * axis, pad its scroll snapping and take away its scroll anchoring, for a
 * page-level decision nobody made about it. Same defect shape as the five
 * `mlv-scrollbar` rules scoped in issue #98.
 *
 * Read through the selector engine rather than `getComputedStyle`: component
 * styles are not injected under the vitest/jsdom setup, and jsdom resolves the
 * cascade by document order regardless, so "did this rule reach the element?"
 * is a question only `element.matches()` answers. It resolves the child
 * combinator correctly (only `:scope` is broken in nwsapi).
 */
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvPage } from './page';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

const PAGE_DIR = dirname(fileURLToPath(import.meta.url));

const COMPILED_CSS = sass.compile(join(PAGE_DIR, 'page.scss'), {
  style: 'expanded',
}).css;

/**
 * The single selector in the compiled sheet that both declares
 * `property: value` and targets the page's scrollbar.
 *
 * Fails loudly when the result is absent or ambiguous, so a renamed rule
 * cannot turn a leak assertion vacuously green.
 */
function scrollbarSelectorDeclaring(property: string, value: string): string {
  const matched = [...COMPILED_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , declarations]) =>
      new RegExp(`${property}:\\s*${value}\\s*;`).test(declarations),
    )
    .map(([, selector]) => selector.replace(/\s+/g, ' ').trim())
    .filter((selector) => selector.includes('.mlv-page__scrollbar'));

  expect(
    matched,
    `\`${property}: ${value}\` on the page scrollbar`,
  ).toHaveLength(1);
  return matched[0];
}

@Component({
  imports: [MlvPage, MlvScrollbar],
  template: `
    <main mlvPage>
      <mlv-scrollbar class="region"><div>content</div></mlv-scrollbar>
    </main>
  `,
})
class NestedScrollbarPageHost {}

describe('MlvPage — page scrollbar rules do not reach a nested scrollbar', () => {
  // Page chrome reads its accessible names from the language pack, and
  // every `MLV_*_I18N` token is a bare `InjectionToken` with no factory.
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });
  let pageViewport: HTMLElement;
  let regionViewport: HTMLElement;

  /**
   * One scrollbar's own viewport, walking `children`: nwsapi mis-resolves
   * `:scope` on a nested host and would return the inner viewport for both.
   */
  const ownViewport = (scrollbarEl: Element): HTMLElement =>
    [...scrollbarEl.children].find((child) =>
      child.classList.contains('mlv-scrollbar__viewport'),
    ) as HTMLElement;

  beforeEach(async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [NestedScrollbarPageHost],
    }).createComponent(NestedScrollbarPageHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const pageEl = fixture.nativeElement.querySelector('main') as HTMLElement;
    expect(pageEl.classList).toContain('mlv-page--scroll-page');

    const pageScrollbar = pageEl.querySelector(
      '.mlv-page__scrollbar',
    ) as HTMLElement;
    const regionScrollbar = pageEl.querySelector(
      'mlv-scrollbar.region',
    ) as HTMLElement;

    // The nested scrollbar really is inside the page's own one — the whole
    // point of the case.
    expect(pageScrollbar.contains(regionScrollbar)).toBe(true);

    pageViewport = ownViewport(pageScrollbar);
    regionViewport = ownViewport(regionScrollbar);
    expect(pageViewport).not.toBe(regionViewport);

    // The anchoring rule is gated on the page having a timeline at all, so the
    // element has to carry the class for the selector to be testable.
    pageEl.classList.add('mlv-page--snapping');
  });

  it("suppresses the horizontal axis only on the page's own viewport", () => {
    // The same rule carries `scroll-padding-block-start` and the snap progress
    // chain, both page-snap concerns. Reaching a nested viewport with
    // `overflow-x: hidden` would silently kill the horizontal axis of every
    // `orientation="horizontal"` / `"both"` scrollbar placed on a page.
    const selector = scrollbarSelectorDeclaring('overflow-x', 'hidden');

    expect(pageViewport.matches(selector)).toBe(true);
    expect(regionViewport.matches(selector)).toBe(false);
  });

  it("takes scroll anchoring only from the page's own viewport", () => {
    // Scroll anchoring is a real accessibility feature — it keeps a reader's
    // place when content above them resizes. The page suppresses it only
    // because the snap timeline is resizing the chrome, which is a fact about
    // the page's scroller and about nothing nested inside it.
    const selector = scrollbarSelectorDeclaring('overflow-anchor', 'none');

    expect(pageViewport.matches(selector)).toBe(true);
    expect(regionViewport.matches(selector)).toBe(false);
  });
});
