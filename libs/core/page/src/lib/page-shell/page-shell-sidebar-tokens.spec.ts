import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * Chrome remap contract for a sidebar projected into `mlv-page-shell`.
 *
 * The shell paints the sidebar on its own chrome colour, so every sidebar state
 * surface has to be derived from the chrome's computed foreground rather than
 * from the theme tokens, which resolve against the page surface. Component
 * styles are not injected into the DOM under the vitest/jsdom setup, so the
 * compiled stylesheet is the observable surface here.
 */

const SHELL_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * The rule that carries the whole sidebar remap. `:not([mlvTheme])` — a rail
 * the consumer has scoped to its own theme is withdrawn from the derivation,
 * because every mix below reads `--mlv-page-shell-effective-*`, which is
 * declared on the shell host and therefore already substituted in the
 * document's theme scope by the time an island further down is resolved.
 */
const SIDEBAR_RULE = '.mlv-page-shell__sidebar.mlv-sidebar:not([mlvTheme]){';

/**
 * Chrome-foreground tint, whitespace-stripped like the compiled output.
 * SF-R2: every remap mixes against the chrome's own computed background
 * (never `transparent`), so a portalled flyout renders opaque and the
 * formula stays polarity-correct on a light, dark, or brand chrome.
 */
function tint(percentage: number): string {
  return `color-mix(insrgb,var(--mlv-page-shell-effective-foreground)${percentage}%,var(--mlv-page-shell-effective-background))`;
}

describe('page shell sidebar chrome remap', () => {
  // Whitespace is stripped so the assertions survive Prettier rewrapping a long
  // `color-mix()` in the source.
  const css = sass
    .compile(join(SHELL_DIR, 'page-shell.scss'), { style: 'expanded' })
    .css.replace(/\s+/g, '');

  const index = css.indexOf(SIDEBAR_RULE);
  const declarations =
    index === -1
      ? ''
      : css.slice(
          index + SIDEBAR_RULE.length,
          css.indexOf('}', index + SIDEBAR_RULE.length),
        );

  it('emits the sidebar rule', () => {
    expect(index, `rule \`${SIDEBAR_RULE}\` not found`).toBeGreaterThan(-1);
  });

  // SF-R2 authoritative percentage table: row-state fills are lower than the
  // field-fill/border/foreground mixes — never darker than the darkest
  // resting surface (SL-R5) — hover 15%→8%, active 24%→12%, rail 30%→24%.
  it.each([
    ['--mlv-sidebar-hover-bg', 8],
    ['--mlv-sidebar-active-bg', 12],
    ['--mlv-sidebar-rail-color', 24],
  ])('remaps %s onto the chrome foreground', (property, percentage) => {
    expect(declarations).toContain(`${property}:${tint(percentage)};`);
  });

  it('remaps the neutral interactive ramp so projected chrome keeps no grey pill', () => {
    expect(declarations).toContain(`--mlv-background-neutral-1:${tint(8)};`);
    expect(declarations).toContain(
      `--mlv-background-neutral-1-hover:${tint(8)};`,
    );
    expect(declarations).toContain(
      `--mlv-background-neutral-1-active:${tint(12)};`,
    );
  });

  it('keeps the pre-existing text and focus remaps', () => {
    expect(declarations).toContain(
      '--mlv-text-primary:var(--mlv-page-shell-effective-foreground);',
    );
    expect(declarations).toContain(
      '--mlv-text-action:var(--mlv-page-shell-effective-foreground);',
    );
    expect(declarations).toContain(`--mlv-text-secondary:${tint(78)};`);
    expect(declarations).toContain(
      '--mlv-border-focus:var(--mlv-page-shell-effective-foreground);',
    );
  });

  /**
   * The active row's label colour. `--mlv-text-on-selected` is declared once
   * per theme block as `var(--mlv-text-action)`, so it resolves in the scope it
   * is declared in — the document root. Remapping `--mlv-text-action` on the
   * sidebar therefore never reaches it, and the active row keeps the theme
   * accent: a lavender label sitting on the chrome-derived 12% pill, which is
   * unreadable on a coloured chrome and ignores a `color`/`foreground`
   * override. It has to be remapped in its own right.
   */
  it('remaps the selected-state pair onto the chrome so an active row stays readable', () => {
    expect(declarations).toContain(
      '--mlv-text-on-selected:var(--mlv-page-shell-effective-foreground);',
    );
    expect(declarations).toContain(`--mlv-background-selected:${tint(12)};`);
    expect(declarations).toContain(
      `--mlv-background-selected-hover:${tint(8)};`,
    );
  });

  /**
   * The remap may *declare* the selected-state globals (it must — see above),
   * but it must never *read* them. Those globals are declared once per theme
   * block (`libs/styles/src/lib/theme.scss`) and only recompute for a
   * document-level theme switch — a *scoped* theme override nested deeper in
   * the DOM (a dark sidebar rail inside a light document, or this shell's own
   * `color`/`foreground` chrome override) freezes them to whatever theme was
   * active where they were declared. Deriving the chrome remap directly from
   * `--mlv-page-shell-effective-foreground/-background` — itself always
   * recomputed on the shell — sidesteps that class of bug entirely; routing
   * back through the raw selected token would reintroduce it for any shell
   * whose own theme differs from the document's. See `core-sidebar`'s
   * `sidebar-state-tokens.spec.ts` for the token-level guard.
   */
  it('never reads the raw selected-state globals for the chrome remap', () => {
    expect(declarations).not.toContain('var(--mlv-background-selected');
    expect(declarations).not.toContain('var(--mlv-text-on-selected');
  });
});

/**
 * The seam between two adjacent start sidebars (an icon rail followed by an
 * expanded navigation panel). It is a line drawn *on the chrome*, so like every
 * other chrome surface it has to be derived from the chrome's own computed
 * foreground — `--mlv-border-subtle` resolves against the page surface and
 * paints a near-white hairline across a coloured or dark chrome.
 */
describe('page shell sidebar seam', () => {
  const SEAM_RULE = '.mlv-page-shell__body>[mlvPageSidebar]+[mlvPageSidebar]{';

  const css = sass
    .compile(join(SHELL_DIR, 'page-shell.scss'), { style: 'expanded' })
    .css.replace(/\s+/g, '');

  const index = css.indexOf(SEAM_RULE);
  const declarations =
    index === -1
      ? ''
      : css.slice(
          index + SEAM_RULE.length,
          css.indexOf('}', index + SEAM_RULE.length),
        );

  it('emits the seam rule', () => {
    expect(index, `rule \`${SEAM_RULE}\` not found`).toBeGreaterThan(-1);
  });

  // Between the 8/12% row-state fills and the 24% group rail line: present as a
  // hairline on every chrome, never a bright edge on a dark or brand one.
  it('derives the seam colour from the chrome foreground', () => {
    expect(declarations).toContain(
      `border-inline-start:var(--mlv-stroke-width)solid${tint(16)};`,
    );
  });

  it('never paints the seam with a page-surface border token', () => {
    expect(declarations).not.toContain('--mlv-border-subtle');
    expect(declarations).not.toContain('--mlv-border-normal');
  });
});
