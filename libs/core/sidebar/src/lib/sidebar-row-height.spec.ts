import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * Row-rhythm contract for the sidebar stylesheets.
 *
 * Every navigable row (item, group accordion header, collapsed group icon
 * button, collapse trigger) must resolve its height from the single
 * `--mlv-sidebar-row-height` custom property declared by `mlv-sidebar`, and a
 * closed group accordion must not add stray vertical space. Component styles
 * are not injected into the DOM under the vitest/jsdom setup, so the compiled
 * stylesheet is the observable surface here.
 */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

function compile(relativePath: string): string {
  return sass.compile(join(LIB_DIR, relativePath), { style: 'expanded' }).css;
}

/**
 * Returns every declaration block emitted for exactly `selector`, concatenated.
 * A selector can be emitted more than once (mixins split rules apart).
 */
function block(css: string, selector: string): string {
  const blocks: string[] = [];
  let cursor = 0;
  for (;;) {
    const index = css.indexOf(selector + ' {', cursor);
    if (index === -1) break;
    const isStandalone = index === 0 || /[\s}]/.test(css[index - 1]);
    const open = css.indexOf('{', index);
    const close = css.indexOf('}', open);
    if (isStandalone) blocks.push(css.slice(open + 1, close));
    cursor = close + 1;
  }
  expect(blocks.length, `selector ${selector} not found`).toBeGreaterThan(0);
  return blocks.join('\n');
}

describe('sidebar row height contract', () => {
  const sidebarCss = compile('sidebar/sidebar.scss');
  const itemCss = compile('sidebar-item/sidebar-item.scss');
  const groupCss = compile('sidebar-group/sidebar-group.scss');
  const triggerCss = compile('sidebar-trigger/sidebar-trigger.scss');

  it('declares the shared row height on the sidebar block', () => {
    expect(block(sidebarCss, '.mlv-sidebar')).toContain(
      '--mlv-sidebar-row-height: 2.25rem;',
    );
  });

  it('scales the shared row height with every non-default density level', () => {
    for (const level of ['tight', 'compact', 'spacious', 'airy']) {
      expect(sidebarCss).toMatch(
        new RegExp(
          `\\[class\\*="--${level}"\\][^{]*\\{[^}]*--mlv-sidebar-row-height:`,
        ),
      );
    }
  });

  it.each([
    ['item', () => block(itemCss, '.mlv-sidebar-item')],
    ['group header', () => block(groupCss, '.mlv-sidebar-group__header')],
    [
      'group icon button',
      () => block(groupCss, '.mlv-sidebar-group__icon-btn'),
    ],
    ['trigger button', () => block(triggerCss, '.mlv-sidebar-trigger__btn')],
  ])('sizes the %s row from --mlv-sidebar-row-height', (_name, read) => {
    const declarations = read();
    expect(declarations).toContain(
      'min-height: var(--mlv-sidebar-row-height, 2.25rem);',
    );
    expect(declarations).not.toMatch(/min-height:\s*2\.25rem/);
  });

  it('adds no vertical padding to a closed group accordion panel', () => {
    expect(block(groupCss, '.mlv-sidebar-group__content')).toContain(
      'padding-top: 0;',
    );
    expect(
      block(groupCss, '.mlv-sidebar-group__content.mlv-expand--open'),
    ).toContain('padding-top: 0.125rem;');
  });
});
