import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * State-surface contract for the sidebar stylesheets.
 *
 * Hover, active and tree-line fills must resolve from the three
 * `--mlv-sidebar-*` variables declared by `mlv-sidebar`, so a host that paints
 * the sidebar on its own chrome (`mlv-page-shell`) can remap them without
 * touching the global theme tokens. Every consumer must repeat the global as
 * the `var()` fallback: the group flyout is portalled into the CDK overlay
 * container, where the declarations on `.mlv-sidebar` do not reach.
 *
 * Component styles are not injected into the DOM under the vitest/jsdom setup,
 * so the compiled stylesheet is the observable surface here.
 */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

const HOVER = 'var(--mlv-sidebar-hover-bg,var(--mlv-background-neutral-1))';
const ACTIVE = 'var(--mlv-sidebar-active-bg,var(--mlv-background-selected))';
const RAIL = 'var(--mlv-sidebar-rail-color,var(--mlv-border-normal))';

/**
 * Compiles a stylesheet and strips every whitespace run, so the assertions
 * below survive Prettier rewrapping a long `var()` in the source.
 */
function compile(relativePath: string): string {
  return sass
    .compile(join(LIB_DIR, relativePath), { style: 'expanded' })
    .css.replace(/\s+/g, '');
}

/**
 * Returns every declaration block emitted for exactly `selector` — the whole
 * comma-separated selector list, whitespace-stripped — concatenated. A selector
 * can be emitted more than once (mixins split rules apart). Descendant matches
 * (`.mlv-drawer.mlv-sidebar{`) are rejected: only a rule that starts a fresh
 * block counts.
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

describe('sidebar state surface contract', () => {
  const sidebarCss = compile('sidebar/sidebar.scss');
  const itemCss = compile('sidebar-item/sidebar-item.scss');
  const groupCss = compile('sidebar-group/sidebar-group.scss');
  const triggerCss = compile('sidebar-trigger/sidebar-trigger.scss');
  const workspaceCss = compile('sidebar-workspace/sidebar-workspace.scss');
  const themeCss = compile('../../../../styles/src/lib/theme.scss');

  it('declares the three state variables on the sidebar block, defaulting to the globals', () => {
    const declarations = rule(sidebarCss, '.mlv-sidebar');

    expect(declarations).toContain(
      '--mlv-sidebar-hover-bg:var(--mlv-background-neutral-1);',
    );
    expect(declarations).toContain(
      '--mlv-sidebar-active-bg:var(--mlv-background-selected);',
    );
    expect(declarations).toContain(
      '--mlv-sidebar-rail-color:var(--mlv-border-normal);',
    );
  });

  it.each([
    [
      'item',
      () => itemCss,
      '.mlv-sidebar-item:hover,.mlv-sidebar-item:focus-visible',
    ],
    [
      'group accordion header',
      () => groupCss,
      '.mlv-sidebar-group__header:hover,.mlv-sidebar-group__header:focus-visible',
    ],
    [
      'collapsed group icon button',
      () => groupCss,
      '.mlv-sidebar-group__icon-btn:hover,.mlv-sidebar-group__icon-btn:focus-visible',
    ],
    ['collapse trigger', () => triggerCss, '.mlv-sidebar-trigger__btn:hover'],
    [
      'workspace trigger',
      () => workspaceCss,
      '.mlv-sidebar-workspacebutton.mlv-sidebar-workspace__trigger:hover,.mlv-sidebar-workspacebutton.mlv-sidebar-workspace__trigger:focus-visible',
    ],
  ])(
    'fills the %s hover state from the hover variable',
    (_name, css, selector) => {
      expect(rule(css(), selector)).toContain(`background-color:${HOVER};`);
    },
  );

  it('no longer reaches for the raw neutral globals in a row hover state', () => {
    for (const css of [itemCss, groupCss, triggerCss, workspaceCss]) {
      expect(css).not.toContain(
        'background-color:var(--mlv-background-neutral-1);',
      );
      expect(css).not.toContain(
        'background-color:var(--mlv-background-neutral-1-hover);',
      );
    }
  });

  it('paints an active item with the active pill and keeps it through hover', () => {
    expect(
      rule(
        itemCss,
        '.mlv-sidebar-item.mlv-sidebar-item--active,.mlv-sidebar-item.mlv-sidebar-item--active:hover,.mlv-sidebar-item.mlv-sidebar-item--active:focus-visible',
      ),
    ).toContain(`background-color:${ACTIVE};`);

    // Colour and weight stay on the single-class modifier.
    const modifier = rule(itemCss, '.mlv-sidebar-item--active');
    expect(modifier).toContain('color:var(--mlv-text-on-selected)!important;');
    expect(modifier).toContain('font-weight:600;');
  });

  it('paints an active collapsed group trigger with the active pill and keeps it through hover', () => {
    const declarations = rule(
      groupCss,
      '.mlv-sidebar-group__icon-btn.mlv-sidebar-group__icon-btn--active,.mlv-sidebar-group__icon-btn.mlv-sidebar-group__icon-btn--active:hover,.mlv-sidebar-group__icon-btn.mlv-sidebar-group__icon-btn--active:focus-visible',
    );

    expect(declarations).toContain(`background-color:${ACTIVE};`);
    expect(declarations).toContain('color:var(--mlv-text-on-selected);');
  });

  it('keeps the expanded group header text-only — no second active pill', () => {
    expect(rule(groupCss, '.mlv-sidebar-group__header--active')).not.toContain(
      'background',
    );
  });

  it('draws the expanded accordion tree line from the rail variable', () => {
    expect(
      rule(groupCss, '.mlv-sidebar-group__content.mlv-expand--open'),
    ).toContain(`border-color:${RAIL};`);
  });

  /**
   * `--mlv-sidebar-active-bg` falls back to the raw `--mlv-background-selected`
   * global (asserted above), which is only safe when that global itself keeps
   * theme parity. A scoped `[mlvTheme='dark']` *island* nested inside a light
   * document — e.g. this showcase's dark navigation rail
   * (`<mlv-sidebar mlvTheme="dark">`, not routed through `mlv-page-shell`) —
   * only recomputes custom properties actually redeclared at that scope. A
   * token declared once in the light block freezes its resolved colour there
   * and is inherited unchanged, even when a nested `var()` it references is
   * itself theme-aware. `--mlv-background-selected`/`-hover` and
   * `--mlv-text-on-selected` were missing from the dark token block for
   * exactly this reason, which floated a light lavender active pill (with
   * navy text) on the dark rail. Full-document dark mode never showed the
   * bug — there the light and dark declarations land on the same element, so
   * the later (dark) one already won the cascade — which is why this needs
   * its own guard rather than relying on a full-page dark screenshot.
   */
  it('keeps the selected-state tokens theme-parous so a scoped dark island resolves them, not just full-page dark mode', () => {
    // Dart Sass drops the quotes from an attribute selector value that is
    // already a valid CSS identifier, so the compiled selector is
    // `[mlvTheme=dark]`, not `[mlvTheme='dark']` as authored in theme.scss.
    const darkDeclarations = rule(themeCss, '[mlvTheme=dark]');

    expect(darkDeclarations).toContain(
      '--mlv-background-selected:var(--mlv-background-accent-1-pale);',
    );
    expect(darkDeclarations).toContain(
      '--mlv-background-selected-hover:var(--mlv-background-accent-1-pale-hover);',
    );
    expect(darkDeclarations).toContain(
      '--mlv-text-on-selected:var(--mlv-text-action);',
    );
  });
});
