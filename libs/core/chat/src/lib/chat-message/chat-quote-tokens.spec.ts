import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * Citation (reply-quote) palette contract for `mlv-chat-message`.
 *
 * The citation renders a *second* `mlv-chat-message` host, which redeclares
 * every `--mlv-chat-message-*` variable and therefore cannot inherit the parent
 * bubble's values through that prefix. The `--mlv-chat-quote-*` set exists to
 * cross that boundary: it is declared on `.mlv-chat-message__reply` — an
 * ancestor of the nested host that never redeclares it — and consumed inside
 * the quote with the standalone value as the `var()` fallback.
 *
 * Deriving the surface from the parent bubble's own text colour is what lets a
 * single rule set cover the neutral other-bubble and the accent own-bubble in
 * both themes. Regressing any of this reintroduces the original defect: a bare
 * `<button>` painting the UA `buttonface` surface, which is light in *both*
 * themes.
 *
 * Component styles are not injected into the DOM under the vitest/jsdom setup,
 * so the compiled stylesheet is the observable surface here.
 */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

/** Compiles a stylesheet and strips whitespace so Prettier rewraps cannot break assertions. */
function compile(relativePath: string): string {
  return sass
    .compile(join(LIB_DIR, relativePath), { style: 'expanded' })
    .css.replace(/\s+/g, '');
}

/** Returns every declaration block emitted for exactly `selector`, concatenated. */
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

describe('chat citation palette contract', () => {
  const css = compile('chat-message.scss');

  it('declares the citation palette on the reply button, derived from the bubble colour', () => {
    const declarations = rule(css, '.mlv-chat-message__reply');

    expect(declarations).toContain(
      '--mlv-chat-quote-fg:var(--mlv-chat-message-color);',
    );
    expect(declarations).toContain(
      '--mlv-chat-quote-accent:var(--mlv-background-accent-1);',
    );
    expect(declarations).toContain(
      '--mlv-chat-quote-author:var(--mlv-text-action);',
    );
    expect(declarations).toContain(
      '--mlv-chat-quote-surface:color-mix(insrgb,var(--mlv-chat-message-color)8%,transparent);',
    );
    expect(declarations).toContain(
      '--mlv-chat-quote-surface-hover:color-mix(insrgb,var(--mlv-chat-message-color)14%,transparent);',
    );
  });

  it('paints and resets the reply button so the UA button surface never shows', () => {
    const declarations = rule(css, '.mlv-chat-message__reply');

    expect(declarations).toContain(
      'background-color:var(--mlv-chat-quote-surface);',
    );
    expect(declarations).toContain('border:0;');
    expect(css.replace(/\s+/g, '')).toContain(
      '.mlv-chat-message__reply:hover{background-color:var(--mlv-chat-quote-surface-hover);}',
    );
  });

  it('remaps the accent channel on the own bubble so it is not blue-on-blue', () => {
    // Whitespace stripping collapses the descendant combinator, so this reads
    // as one token — it is `.mlv-chat-message--own .mlv-chat-message__reply`.
    const own = rule(css, '.mlv-chat-message--own.mlv-chat-message__reply');

    expect(own).toContain(
      '--mlv-chat-quote-accent:var(--mlv-text-primary-on-accent-1);',
    );
    expect(own).toContain(
      '--mlv-chat-quote-author:var(--mlv-text-primary-on-accent-1);',
    );
    expect(own).toContain(
      '--mlv-border-focus:var(--mlv-text-primary-on-accent-1);',
    );
  });

  it('consumes the palette inside the quote, with the standalone value as fallback', () => {
    const quote = rule(css, '.mlv-chat-message--quote');

    expect(quote).toContain(
      '--mlv-chat-message-color:var(--mlv-chat-quote-fg,var(--mlv-text-primary));',
    );
    expect(quote).toContain(
      'border-inline-start:0.1875remsolidvar(--mlv-chat-quote-accent,var(--mlv-background-accent-1));',
    );

    expect(rule(css, '.mlv-chat-message__quote-author')).toContain(
      'color:var(--mlv-chat-quote-author,var(--mlv-text-action));',
    );
    expect(rule(css, '.mlv-chat-message__quote-audio')).toContain(
      'color:var(--mlv-chat-quote-fg,var(--mlv-text-primary));',
    );
  });
});
