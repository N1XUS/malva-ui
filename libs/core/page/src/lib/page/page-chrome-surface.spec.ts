import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import * as sass from 'sass';
import { MlvPage } from './page';
import { MlvPageSnapController } from './page-snap-controller';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

/**
 * The chrome bars — page header, summary strip, dock, and `mlv-action-bar`
 * outside this project — used to stack four separation signals each, all
 * saying the same thing: a translucent `elevation-bg-3` fill,
 * `backdrop-filter: blur(1.25rem)`, a hairline, and a shadow deepening
 * `raised` → `floating` once scrolled. Four copies of one recipe, so changing
 * it cost four edits, and the shell had to unset two of the four by hand on its
 * own topbar.
 *
 * There are two signals now — a hairline saying where the bar ends, a one-rung
 * fill step saying it is over content — and the state that switches the second
 * on is declared **once**, on the page host, so the three bars cannot answer
 * "am I over content" differently.
 *
 * The blur staying gone is pinned here too, and it is not a style preference:
 * `backdrop-filter` establishes a containing block for `position: fixed`
 * descendants, so a consumer's overlay rendered inside a bar was anchored to
 * the bar rather than to the viewport. (`mlv-action-bar` pins its own half —
 * see `action-bar.spec.ts` — because a cross-project stylesheet read here
 * would fail in a project `nx affected` never selects for that change.)
 *
 * Component styles are not injected into the DOM under the vitest/jsdom setup,
 * so the compiled stylesheet is the observable surface for the CSS half.
 */

const PAGE_DIR = dirname(fileURLToPath(import.meta.url));

/** Whitespace-stripped, matching how the compiled CSS is normalised below. */
function strip(value: string): string {
  return value.replace(/\s+/g, '');
}

function compile(relativePath: string): string {
  return sass
    .compile(join(PAGE_DIR, relativePath), { style: 'expanded' })
    .css.replace(/\s+/g, '');
}

/** The three page bars that share the chrome surface. */
const BARS: readonly (readonly [string, string])[] = [
  ['page-header', '../page-header/page-header.scss'],
  ['page-summary', '../page-summary/page-summary.scss'],
  ['page-dock', '../page-dock/page-dock.scss'],
];

@Component({
  template: `<main mlvPage><p>Page content</p></main>`,
  imports: [MlvPage],
})
class ChromeHost {}

describe('page chrome surface', () => {
  // Page chrome reads its accessible names from the language pack, and
  // every `MLV_*_I18N` token is a bare `InjectionToken` with no factory.
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it.each(BARS)(
    '%s resolves the one shared fill, consumer knob first',
    (_name, stylesheet) => {
      // Three steps, each with a reason: a consumer override wins over the
      // page's state; the page's state wins over the rest value; and the rest
      // value is what a bar rendered outside a page resolves.
      expect(compile(stylesheet)).toContain(
        strip(`background-color: var(
          --mlv-page-chrome-bg,
          var(--mlv-page-chrome-surface, var(--mlv-background-bar))
        );`),
      );
    },
  );

  it.each(BARS)('%s paints no backdrop filter', (_name, stylesheet) => {
    expect(compile(stylesheet)).not.toContain('backdrop-filter:blur(');
  });

  it('declares the over-content step once, on the page host', () => {
    const css = compile('page.scss');

    // Declared on the page and *not* on the bars: a custom property an element
    // declares itself beats the inherited one, so a bar that re-declared it
    // could never be reached by a page-level state.
    expect(css).toContain(
      strip('--mlv-page-chrome-surface: var(--mlv-background-bar);'),
    );
    expect(css).toContain(
      strip(`.mlv-page--overlapped {
        --mlv-page-chrome-surface: var(--mlv-background-bar-overlapped);
      }`),
    );

    for (const [, stylesheet] of BARS) {
      expect(compile(stylesheet)).not.toContain(
        '--mlv-page-chrome-surface:var(',
      );
    }
  });

  it('keeps the shell chrome on semantic tokens, not raw palette stops', () => {
    const css = compile('../page-shell/page-shell.scss');

    // `neutral-900` / `neutral-50` literals followed no theme: the frame read
    // as near-maximum contrast in light and resolved to exactly the canvas
    // colour in dark, where it disappeared.
    expect(css).toContain(
      strip(
        '--mlv-page-shell-chrome-background: var(--mlv-background-chrome);',
      ),
    );
    expect(css).toContain(
      strip('--mlv-page-shell-chrome-foreground: var(--mlv-text-on-chrome);'),
    );
    expect(css).not.toContain('var(--mlv-palette-neutral-900)');
  });

  it('gives the chrome tokens a real step off the canvas in both themes', () => {
    // The finding this replaces was two *identical* values, so the assertion
    // has to be that they differ — a token that merely exists proves nothing.
    const theme = readFileSync(
      join(PAGE_DIR, '../../../../../styles/src/lib/theme.scss'),
      'utf8',
    );

    // Light: the canvas is `neutral-50`, the frame `neutral-200`.
    expect(theme).toContain(
      '--mlv-background-base: var(--mlv-palette-neutral-50);',
    );
    expect(theme).toContain(
      '--mlv-background-chrome: var(--mlv-palette-neutral-100);',
    );

    // Dark: the canvas is `neutral-900`, the frame `neutral-950`.
    expect(theme).toContain(
      '--mlv-background-base: var(--mlv-palette-neutral-900);',
    );
    expect(theme).toContain(
      '--mlv-background-chrome: var(--mlv-palette-neutral-950);',
    );

    // Both bar fills are re-declared in the dark map rather than inherited,
    // because their values are `var()` references and those resolve in the
    // scope they are *declared* in — a scoped `[mlvTheme='dark']` island would
    // otherwise paint the light theme's answers. Two occurrences, one per
    // theme; high contrast declares its own literals.
    expect(
      theme.match(/--mlv-background-bar: var\(--mlv-background-base\);/g)
        ?.length,
    ).toBe(2);
    expect(
      theme.match(
        /--mlv-background-bar-overlapped: var\(--mlv-background-raised\);/g,
      )?.length,
    ).toBe(2);
  });

  it('flips the page host class from `overlapped`, never from progress', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ChromeHost],
    }).createComponent(ChromeHost);
    await fixture.whenStable();

    const page = fixture.nativeElement.querySelector('main') as HTMLElement;
    const controller = fixture.debugElement
      .query(By.directive(MlvPage))
      .injector.get(MlvPageSnapController);

    expect(page.classList).not.toContain('mlv-page--overlapped');

    // Nothing registered a collapsing region, so the collapse fraction is and
    // stays zero. That is exactly the case the second signal exists for: chrome
    // pinned at full height still has to say it is sitting over content.
    controller.updateFromScroll(240);
    await fixture.whenStable();

    expect(controller.progress()).toBe(0);
    expect(page.classList).toContain('mlv-page--overlapped');

    controller.updateFromScroll(0);
    await fixture.whenStable();

    expect(page.classList).not.toContain('mlv-page--overlapped');
  });
});
