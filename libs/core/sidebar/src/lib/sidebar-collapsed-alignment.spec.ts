import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

/**
 * Collapsed-rail alignment contract.
 *
 * Every glyph in the collapsed rail sits on one vertical line: the centre of
 * `--mlv-sidebar-icon-column-width`, which is the first track of every row and
 * of the workspace trigger alike. Two regressions broke that line, both by
 * changing a row's *layout* rather than its glyph, and both invisible to a
 * declaration-by-declaration reading of either stylesheet on its own.
 *
 * Component styles are not injected into the DOM under the vitest/jsdom setup,
 * so the compiled stylesheet is the observable surface here — as in
 * `sidebar-state-tokens.spec.ts`.
 */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Compiles a stylesheet and strips every whitespace run, so the assertions
 * below survive Prettier rewrapping a long declaration in the source.
 */
function compile(relativePath: string): string {
  // Layers are stripped before the whitespace run: `rule()` only accepts a rule
  // that starts a fresh block, and the first rule inside `@layer mlv.components{`
  // is preceded by an opening brace rather than a closing one.
  return stripCssLayersFromText(
    sass.compile(join(LIB_DIR, relativePath), { style: 'expanded' }).css,
  ).replace(/\s+/g, '');
}

/**
 * Returns the declaration block emitted for exactly `selector` — the whole
 * comma-separated selector list, whitespace-stripped. Only a rule that starts a
 * fresh block counts, so a descendant match cannot satisfy an assertion about
 * the bare selector.
 */
function rule(css: string, selector: string): string {
  const needle = `${selector}{`;
  const blocks: string[] = [];
  let cursor = 0;
  for (;;) {
    const index = css.indexOf(needle, cursor);
    if (index === -1) break;
    const open = index + needle.length;
    const close = css.indexOf('}', open);
    const before = css.slice(0, index);
    if (before === '' || before.endsWith('}'))
      blocks.push(css.slice(open, close));
    cursor = close + 1;
  }
  expect(blocks.length, `rule \`${selector}\` not found`).toBeGreaterThan(0);
  return blocks.join('');
}

describe('collapsed-rail glyph alignment', () => {
  describe('status dot', () => {
    const itemCss = compile('sidebar-item/sidebar-item.scss');
    const indicatorCss = compile(
      '../../../status-indicator/src/lib/status-indicator/status-indicator.scss',
    );

    it('is the tie this rule exists to break: the indicator positions its own host', () => {
      // `mlv-status-indicator` declares `position: relative` on `.mlv-status-indicator`
      // — specificity (0,1,0), cascade layer `mlv.components`. A bare
      // `.mlv-sidebar-item__status` rule is the same on both counts, so which one
      // wins is decided by stylesheet order alone, and the indicator's file loads
      // later. This assertion is what makes the scoped selector below read as a
      // deliberate specificity choice rather than an accident of nesting.
      expect(rule(indicatorCss, '.mlv-status-indicator')).toContain(
        'position:relative',
      );
    });

    it('takes the dot out of flow at a specificity the indicator cannot tie', () => {
      // Scoped under `__icon` → (0,2,0). In flow the dot is a flex sibling of the
      // glyph inside a centred `__icon`, so a badged row's glyph rendered 2px
      // inside the icon column while every unbadged row stayed centred on it
      // (measured in Chrome: 24px vs 28px from the rail's inline-start edge).
      expect(
        rule(itemCss, '.mlv-sidebar-item__icon.mlv-sidebar-item__status'),
      ).toContain('position:absolute');
    });

    it('keeps the icon box as the dot’s positioning context', () => {
      expect(rule(itemCss, '.mlv-sidebar-item__icon')).toContain(
        'position:relative',
      );
    });
  });

  describe('workspace trigger', () => {
    const css = compile('sidebar-workspace/sidebar-workspace.scss');

    it('starts its track set at the row’s inline-start edge', () => {
      // `button[mlvButton]` brings `justify-content: center`, which for a grid
      // container centres the whole track set. Left at `center`, any overflow is
      // split across both edges and the icon column stops starting where every
      // row below it starts.
      expect(
        rule(
          css,
          '.mlv-sidebar-workspace__trigger,.mlv-sidebar-workspace__option.mlv-list-item__content',
        ),
      ).toContain('justify-content:start');
    });

    it('empties the chevron’s track over the same duration as the rail', () => {
      // The chevron owns the third (`auto`) track. Fading it without emptying its
      // box left 38 + 0 + 16 = 54px of tracks in a 38px content box, and the
      // overflow pulled the logo 8px inline-start of the icon column (measured in
      // Chrome: logo centre 20px vs every item glyph at 28px). `inline-size` is
      // transitionable where `grid-template-columns` is not, so the track empties
      // continuously instead of snapping at frame 0.
      const base = rule(css, '.mlv-sidebar-workspace__chevron');
      expect(base).toContain('inline-size:1rem');
      expect(base).toContain(
        'transition:inline-sizevar(--mlv-duration-normal)',
      );

      expect(
        rule(
          css,
          '.mlv-sidebar-workspace--collapsed.mlv-sidebar-workspace__chevron',
        ),
      ).toContain('inline-size:0');
    });
  });
});
