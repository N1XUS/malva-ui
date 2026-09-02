/**
 * The page owns one `mlv-scrollbar` and styles its viewport twice: once for the
 * page's own scroll behaviour, and once more under `scroll="none"`, which
 * clips it so a **consumer-owned nested region** owns the scrolling instead
 * (see this library's CLAUDE.md).
 *
 * Neither may reach past the page's own viewport. Scrollbars nest — `mlv-chat`
 * and an external-scroller `mlv-textarea` bring their own, and the nested
 * region in question usually *is* one — so a descendant combinator would clip
 * every nested viewport, kill its horizontal axis and pad its scroll snapping,
 * for a page-level decision nobody made about it. Same defect shape as the five
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

const PAGE_DIR = dirname(fileURLToPath(import.meta.url));

const COMPILED_CSS = sass.compile(join(PAGE_DIR, 'page.scss'), {
  style: 'expanded',
}).css;

/**
 * The single selector in the compiled sheet that both declares
 * `property: value` and targets the page's scrollbar.
 *
 * `overflow: clip` is also declared on the page host itself under
 * `--scroll-auto` / `--scroll-none`, hence the second filter. Fails loudly when
 * the result is absent or ambiguous, so a renamed rule cannot turn a leak
 * assertion vacuously green.
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
    <main mlvPage scroll="none">
      <mlv-scrollbar class="region"><div>content</div></mlv-scrollbar>
    </main>
  `,
})
class NestedScrollbarPageHost {}

describe('MlvPage — page scrollbar rules do not reach a nested scrollbar', () => {
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
    expect(pageEl.classList).toContain('mlv-page--scroll-none');

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
  });

  it('clips only the page\'s own viewport under scroll="none"', () => {
    const selector = scrollbarSelectorDeclaring('overflow', 'clip');

    expect(pageViewport.matches(selector)).toBe(true);
    expect(regionViewport.matches(selector)).toBe(false);
  });

  it("suppresses the horizontal axis only on the page's own viewport", () => {
    // The same rule carries `scroll-padding-top` and `overflow-anchor: none`,
    // both page-snap concerns. Reaching a nested viewport with `overflow-x:
    // hidden` would silently kill the horizontal axis of every `orientation`
    // `"horizontal"` / `"both"` scrollbar placed on a page.
    const selector = scrollbarSelectorDeclaring('overflow-x', 'hidden');

    expect(pageViewport.matches(selector)).toBe(true);
    expect(regionViewport.matches(selector)).toBe(false);
  });
});
