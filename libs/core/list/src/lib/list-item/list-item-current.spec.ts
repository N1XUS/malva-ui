import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * A row that names the state its context is already in marks itself with
 * `aria-current` — the active heading level in the editor's heading menu, the
 * active list type, the active alignment, the current saved view. Until this
 * rule existed the attribute was announced but never painted, so the heading
 * menu highlighted whatever row happened to be `aria-selected` (Paragraph)
 * while the trigger showed H2.
 *
 * It belongs on `mlv-list-item` rather than in `menu.scss`: menus, listboxes
 * and link lists all render the same row, so one rule covers every consumer.
 *
 * Component styles are not injected into the DOM under the vitest/jsdom setup,
 * so the compiled stylesheet is the observable surface here.
 */

const LIST_ITEM_DIR = dirname(fileURLToPath(import.meta.url));

describe('list item current state', () => {
  const css = sass
    .compile(join(LIST_ITEM_DIR, 'list-item.scss'), { style: 'expanded' })
    .css.replace(/\s+/g, '');

  it('paints an aria-current row with the selected pair, like a router-active row', () => {
    // `aria-current` is an enumerated token — `page`, `step`, `location`,
    // `date`, `time`, `true`. Only `false` means "not current", so the
    // selector matches presence and excludes that one value rather than
    // testing for `true` alone.
    // Sass drops the quotes around an identifier-safe attribute value.
    const selector = '.mlv-list-item[aria-current]:not([aria-current=false])';

    expect(css).toContain(selector);

    const open = css.indexOf('{', css.indexOf(selector));
    const declarations = css.slice(open + 1, css.indexOf('}', open));

    // SF-R1: a persistent current-state row takes the selected pair, never a
    // pressed `-active` fill.
    expect(declarations).toContain(
      '--mlv-list-item-bg:var(--mlv-list-item-bg-selected);',
    );
    expect(declarations).toContain(
      '--mlv-list-item-color:var(--mlv-text-on-selected);',
    );
  });
});
