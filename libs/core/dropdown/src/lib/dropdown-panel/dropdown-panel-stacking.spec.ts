import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * Paint-order contract between `mlv-dropdown-panel`'s sticky group header and
 * the `:focus-visible` option row underneath it.
 *
 * The two live in the same stacking context: `.mlv-dropdown-panel__group` is a
 * plain `display: block` box, `mlv-list` sets no `z-index` or `transform`, and
 * the scrollbar host is `position: relative` with `z-index: auto` — none of
 * which opens a context. The header and the rows it labels are therefore
 * siblings competing directly, and the header comes **earlier** in DOM order,
 * so it loses every tie.
 *
 * That matters because `list-item.scss` gives a `:focus-visible` row a real
 * `z-index`. Its focus ring is Form A — an outline at a positive
 * `outline-offset`, so it paints *outside* the row's border box — and rows are
 * flush (`margin: 0`), so the ring reaches into the adjacent rows' boxes. An
 * adjacent row that is hovered or selected has an opaque
 * `--mlv-list-item-bg` and, being later in DOM order, would paint over that
 * ring. The row's `z-index` is what stops it, so it cannot simply be dropped
 * to resolve the tie — the header has to outrank it instead.
 *
 * These assertions read the compiled stylesheets rather than computed styles:
 * component styles are not injected into the DOM under this workspace's
 * vitest/jsdom setup, and jsdom does not resolve `var()` in
 * `getComputedStyle`. The `var(--mlv-z-*)` indirection is resolved here
 * against `theme.scss` so the assertion is about the effective numbers, not
 * about the spelling.
 *
 * Regression test for #109.
 */

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));

/** @private Compiles one stylesheet to expanded CSS text. */
function compile(relativePath: string): string {
  return sass.compile(join(SPEC_DIR, relativePath), { style: 'expanded' }).css;
}

/**
 * @private Reads the `z-index` declared on exactly `selector`, as written.
 * Throws when the selector or the declaration is absent, so a renamed class or
 * a deleted declaration fails loudly instead of silently comparing `undefined`.
 */
function declaredZIndex(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`(?:^|[\\s,{}])${escaped}\\s*\\{([^{}]*)\\}`).exec(
    css,
  );

  if (!rule) {
    throw new Error(`No rule found for selector "${selector}".`);
  }

  const declaration = /(?:^|;)\s*z-index\s*:\s*([^;]+)/.exec(rule[1]);

  if (!declaration) {
    throw new Error(`Rule "${selector}" declares no z-index.`);
  }

  return declaration[1].trim();
}

/**
 * @private Resolves a declared `z-index` to its effective integer, following a
 * single `var(--mlv-z-*)` indirection into `theme.scss`.
 */
function resolveZIndex(declared: string, themeCss: string): number {
  const reference = /^var\(\s*(--mlv-z-[a-z0-9-]+)\s*(?:,[^)]*)?\)$/.exec(
    declared,
  );

  if (reference) {
    const token = new RegExp(`${reference[1]}\\s*:\\s*([^;]+);`).exec(themeCss);

    if (!token) {
      throw new Error(`Token "${reference[1]}" is not declared in theme.scss.`);
    }

    return resolveZIndex(token[1].trim(), themeCss);
  }

  const value = Number(declared);

  if (!Number.isInteger(value)) {
    throw new Error(`z-index "${declared}" is not an integer.`);
  }

  return value;
}

describe('mlv-dropdown-panel sticky group header stacking', () => {
  const panelCss = compile('./dropdown-panel.scss');
  const listItemCss = compile(
    '../../../../list/src/lib/list-item/list-item.scss',
  );
  const themeCss = compile('../../../../../styles/src/lib/theme.scss');

  const headerZIndex = resolveZIndex(
    declaredZIndex(panelCss, '.mlv-dropdown-panel__group-header'),
    themeCss,
  );
  const focusedRowZIndex = resolveZIndex(
    declaredZIndex(listItemCss, '.mlv-list-item:focus-visible'),
    themeCss,
  );

  it('paints the sticky group header above a :focus-visible option row', () => {
    // Strictly greater, not merely different: on a tie the header loses,
    // because it precedes the rows it labels in DOM order.
    expect(headerZIndex).toBeGreaterThan(focusedRowZIndex);
  });

  it('keeps the header in the same stacking context as the rows it labels', () => {
    // The fix must be a z-index lift, not a new stacking context on the group
    // wrapper — isolating `__group` would put the header and the rows in one
    // context together and reinstate the same tie.
    const group = /\.mlv-dropdown-panel__group\s*\{([^{}]*)\}/.exec(panelCss);

    expect(group?.[1].replace(/\s+/g, ' ').trim()).toBe('display: block;');
  });

  it('lifts the header to the same level as the list’s own sticky group header', () => {
    // `.mlv-list--inset .mlv-list-item-group__label` is the identical job —
    // a sticky uppercase section label pinned over the rows it groups — and has
    // always cleared the row at this level. The two should not drift apart.
    // (It was `__toggler` until #220 stopped rendering a disclosure button for
    // a section the inset variant pins open; same element, same job.)
    const listGroupCss = compile(
      '../../../../list/src/lib/list-item-group/list-item-group.scss',
    );

    expect(headerZIndex).toBe(
      resolveZIndex(
        declaredZIndex(
          listGroupCss,
          '.mlv-list--inset .mlv-list-item-group__label',
        ),
        themeCss,
      ),
    );
  });

  it('leaves the :focus-visible row a z-index, since its outset ring needs one', () => {
    // Form A ring at a positive offset + flush rows means an adjacent hovered
    // or selected row would paint over it. Dropping this is not a valid way to
    // resolve the tie.
    expect(focusedRowZIndex).toBeGreaterThan(0);
    expect(declaredZIndex(listItemCss, '.mlv-list-item:focus-visible')).toBe(
      '1',
    );
  });
});
