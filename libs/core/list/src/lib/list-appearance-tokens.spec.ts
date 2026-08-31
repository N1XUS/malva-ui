import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * `appearance="menu"` styling contract for the list stylesheets (see
 * `MlvListAppearance` on `MlvList`).
 *
 * `mlv-list` is a shared primitive: standalone rich lists want the airy
 * SL-R5 look (hairline separators, taller rows, square corners), while every
 * overlay panel consumer (select/combobox/menu dropdowns, popover menus)
 * wants the compact pre-harmonization dropdown rhythm instead. This asserts
 * both halves of that contract directly on the compiled stylesheets, since
 * component styles are not injected into the DOM under the vitest/jsdom
 * setup used by this workspace's component specs.
 */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Compiles a stylesheet and strips every whitespace run, so the assertions
 * below survive Prettier rewrapping a long declaration in the source.
 */
function compile(relativePath: string): string {
  return sass
    .compile(join(LIB_DIR, relativePath), { style: 'expanded' })
    .css.replace(/\s+/g, '');
}

describe('mlv-list appearance="menu" stylesheet contract', () => {
  const listCss = compile('list/list.css');
  const itemCss = compile('list-item/list-item.scss');

  it('suppresses the SL-R5 hairline separator for the menu appearance', () => {
    expect(listCss).toContain(
      '.mlv-list:not(.mlv-list--inset):not(.mlv-list--appearance-menu)>.mlv-list-item+.mlv-list-item{border-top:var(--mlv-stroke-width)solidvar(--mlv-border-subtle);}',
    );
  });

  it('still draws the hairline for the default (non-menu) appearance', () => {
    // The plain, unqualified rule must not exist — every hairline rule is
    // scoped away from `--appearance-menu`.
    expect(listCss).not.toContain(
      '.mlv-list:not(.mlv-list--inset)>.mlv-list-item+.mlv-list-item{',
    );
  });

  it('restores the pre-harmonization compact row padding and radius for the menu appearance', () => {
    expect(itemCss).toContain(
      '.mlv-list--appearance-menu.mlv-list-item{--mlv-list-item-padding-block:var(--mlv-spacing-2);--mlv-list-item-radius:var(--mlv-radius-m);}',
    );
  });

  it('keeps the SL-R5 airy defaults (taller padding, zero radius) for the base block', () => {
    const declarations = itemCss.slice(
      itemCss.indexOf('.mlv-list-item{') + '.mlv-list-item{'.length,
      itemCss.indexOf('}'),
    );

    expect(declarations).toContain(
      '--mlv-list-item-padding-block:var(--mlv-spacing-3);',
    );
    expect(declarations).toContain('--mlv-list-item-radius:0;');
  });
});
