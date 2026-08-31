import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const FORM_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './form.scss',
);

describe('form.scss', () => {
  // The stylesheet ships inside `@layer mlv.components`; the assertions below
  // anchor selectors to the start of a line, so the wrapper is flattened away
  // exactly as it is for the jsdom specs.
  const css = stripCssLayersFromText(sass.compile(FORM_SCSS).css);

  // The density mixins prefix the whole selector with an ancestor
  // `[class*='--x'] `, so they can never match the form's own modifier on a
  // selector that starts at `.mlv-form`. These explicit selectors are what
  // gives a bare `<legend>` the form's own density.
  it.each(['--tight', '--compact'])(
    "scales a bare legend from the form's own %s modifier",
    (modifier) => {
      const selector = `.mlv-form[class*="${modifier}"] fieldset:not(.mlv-fieldset) > legend`;
      expect(css).toContain(selector);

      const body = css.slice(css.indexOf(selector));
      const rule = body.slice(0, body.indexOf('}'));
      expect(rule).toContain('font-size: var(--mlv-typography-body-m-size)');
      expect(rule).toContain(
        'line-height: var(--mlv-typography-body-m-line-height)',
      );
    },
  );

  it('keeps the body-l base rule on the bare legend', () => {
    const selector = '.mlv-form fieldset:not(.mlv-fieldset) > legend';
    expect(css).toContain(`\n${selector} {`);
    const body = css.slice(css.indexOf(`\n${selector} {`));
    const rule = body.slice(0, body.indexOf('}'));
    expect(rule).toContain('font-size: var(--mlv-typography-body-l-size)');
  });
});
