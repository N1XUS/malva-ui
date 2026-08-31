import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import { JSDOM, VirtualConsole } from 'jsdom';

import { stripCssLayersFromText } from './strip-css-layers.js';

const collapse = (css) => css.replace(/\s+/g, ' ').trim();

/**
 * Loads `css` into a fresh jsdom document and reads back the computed `prop` of
 * the single `.probe` element. Returns `''` when jsdom discarded the sheet.
 */
const computed = (css, prop = 'color') => {
  // Unparseable CSS is the phenomenon under test, so jsdom's error for it is
  // expected output rather than something to print.
  const { window } = new JSDOM(
    `<style>${css}</style><div class="probe"></div>`,
    { virtualConsole: new VirtualConsole() },
  );
  return window.getComputedStyle(window.document.querySelector('.probe'))[prop];
};

describe('stripCssLayersFromText', () => {
  it('unwraps a layered rule block', () => {
    assert.equal(
      collapse(
        stripCssLayersFromText('@layer mlv.components {\n.probe { color: red }\n}'),
      ),
      '.probe { color: red }',
    );
  });

  it('drops a bare @layer order statement', () => {
    assert.equal(
      stripCssLayersFromText('@layer mlv.tokens, mlv.base, mlv.components;').trim(),
      '',
    );
  });

  it('unwraps nested and anonymous layers', () => {
    const out = stripCssLayersFromText('@layer a { @layer { .probe { color: red } } }');
    assert.ok(!out.includes('@layer'), out);
    assert.ok(out.includes('color: red'), out);
  });

  it('keeps the at-rules that wrap a layer', () => {
    const out = stripCssLayersFromText(
      '@media (min-width: 40rem) { @layer mlv.components { .probe { color: red } } }',
    );
    assert.ok(out.includes('@media (min-width: 40rem)'), out);
    assert.ok(!out.includes('@layer'), out);
  });

  it('preserves the document order of flattened rules', () => {
    const out = stripCssLayersFromText(
      '@layer mlv.tokens { .probe { color: red } }\n@layer mlv.components { .probe { color: blue } }',
    );
    assert.ok(out.indexOf('red') < out.indexOf('blue'), out);
  });

  it('removes the indentation the wrapper added', () => {
    const flattened = stripCssLayersFromText(
      [
        '@layer mlv.components {',
        '  .probe {',
        '    color: red;',
        '  }',
        '  @keyframes spin {',
        '    to {',
        '      rotate: 1turn;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );

    // Specs that read the compiled text anchor selectors and closing braces to
    // the start of a line, so a layer must leave no indentation behind.
    assert.ok(flattened.includes('\n.probe {'), flattened);
    assert.ok(flattened.includes('\n  color: red;'), flattened);
    assert.ok(flattened.includes('\n@keyframes spin {'), flattened);
    assert.ok(flattened.includes('\n}'), flattened);
  });

  it('dedents only by the wrapper depth for a nested layer', () => {
    const flattened = stripCssLayersFromText(
      ['@media print {', '  @layer mlv.components {', '    .probe {', '      color: red;', '    }', '  }', '}'].join('\n'),
    );

    assert.ok(flattened.includes('\n  .probe {'), flattened);
    assert.ok(flattened.includes('@media print {'), flattened);
  });

  it('leaves other at-rules untouched', () => {
    const css =
      '@supports (display: grid) { .probe { display: grid } }\n@keyframes spin { to { rotate: 1turn } }';
    assert.equal(stripCssLayersFromText(css), css);
  });

  it('returns unlayered css byte-identical', () => {
    const css = '.probe {\n  color: red;\n}\n';
    assert.equal(stripCssLayersFromText(css), css);
  });

  it('does not mistake a layer-ish identifier for the at-rule', () => {
    const css = '.probe { --mlv-layer-color: red; }\n';
    assert.equal(stripCssLayersFromText(css), css);
  });
});

// The regression this whole module exists for.
describe('jsdom @layer support', () => {
  it('still cannot parse a layered stylesheet', () => {
    assert.equal(computed('@layer mlv.components { .probe { color: red } }'), '');
    assert.equal(computed('.probe { color: red }'), 'rgb(255, 0, 0)');
  });

  it('reads a flattened stylesheet again', () => {
    assert.equal(
      computed(stripCssLayersFromText('@layer mlv.components { .probe { color: red } }')),
      'rgb(255, 0, 0)',
    );
  });
});

describe('setup-strip-css-layers', () => {
  /** @type {import('jsdom').DOMWindow} */
  let window;

  before(async () => {
    const dom = new JSDOM('<div class="probe"></div>');
    window = dom.window;
    // The setup file patches the ambient DOM globals vitest installs.
    globalThis.HTMLStyleElement = window.HTMLStyleElement;
    globalThis.Node = window.Node;
    globalThis.Element = window.Element;
    await import('./setup-strip-css-layers.js');
  });

  const probeColor = () =>
    window.getComputedStyle(window.document.querySelector('.probe')).color;

  const attach = (mutate) => {
    const style = window.document.createElement('style');
    mutate(style);
    window.document.head.appendChild(style);
    const color = probeColor();
    style.remove();
    return color;
  };

  it('strips layers assigned through textContent', () => {
    assert.equal(
      attach((style) => {
        style.textContent = '@layer mlv.components { .probe { color: red } }';
      }),
      'rgb(255, 0, 0)',
    );
  });

  it('strips layers assigned through innerHTML', () => {
    assert.equal(
      attach((style) => {
        style.innerHTML = '@layer mlv.components { .probe { color: red } }';
      }),
      'rgb(255, 0, 0)',
    );
  });

  it('strips layers appended as a text node', () => {
    assert.equal(
      attach((style) => {
        style.appendChild(
          window.document.createTextNode(
            '@layer mlv.components { .probe { color: red } }',
          ),
        );
      }),
      'rgb(255, 0, 0)',
    );
  });

  it('strips layers passed to append as a string', () => {
    assert.equal(
      attach((style) => {
        style.append('@layer mlv.components { .probe { color: red } }');
      }),
      'rgb(255, 0, 0)',
    );
  });

  it('reads back the flattened text, not the original', () => {
    const style = window.document.createElement('style');
    style.textContent = '@layer mlv.components { .probe { color: red } }';
    assert.ok(!style.textContent.includes('@layer'), style.textContent);
  });

  it('leaves unlayered stylesheets alone', () => {
    assert.equal(
      attach((style) => {
        style.textContent = '.probe { color: blue }';
      }),
      'rgb(0, 0, 255)',
    );
  });
});
