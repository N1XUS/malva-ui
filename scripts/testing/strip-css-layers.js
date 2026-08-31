/**
 * Flattens CSS cascade layers so the vitest/jsdom environment can read them.
 *
 * jsdom parses CSS with `rrweb-cssom`, which does not implement `@layer`. On
 * encountering it jsdom logs "Could not parse CSS stylesheet" and discards the
 * **entire** stylesheet, so every rule inside becomes invisible to
 * `getComputedStyle`. Because the component stylesheets under `libs/` are
 * wrapped in `@layer mlv.components { … }`, that silently disabled the
 * library's whole styling test suite.
 *
 * Flattening is only applied to the test environment; the shipped CSS keeps its
 * layers. It does change cascade semantics — an unlayered rule outranks every
 * layered one — but the layers exist to lose to consumer/Tailwind styles that a
 * unit test never loads, and flattening preserves document order, so rules
 * within one stylesheet (and across stylesheets injected in layer order) keep
 * resolving exactly as they do in a browser.
 */

import postcss from 'postcss';

/**
 * PostCSS plugin replacing every `@layer name { … }` block with its children
 * and removing bare `@layer a, b, c;` ordering statements.
 *
 * @returns {import('postcss').Plugin}
 */
export function stripCssLayers() {
  return {
    postcssPlugin: 'mlv-strip-css-layers',
    AtRule: {
      layer: (atRule) => {
        // A bare `@layer a, b;` only declares order — nothing to hoist.
        if (!atRule.nodes) {
          atRule.remove();
          return;
        }

        // Hoisting keeps each child's authored indentation, which would leave
        // the flattened rules one level too deep. Specs that assert on the
        // compiled text anchor selectors to the start of a line, so the
        // indentation the wrapper added is removed with it.
        dedent(atRule.nodes, indentWidthOf(atRule));

        // `replaceWith` splices the children into the parent in place, so a
        // layer nested inside `@media`/`@supports` keeps that wrapper, and the
        // visitor re-runs over the hoisted nodes to unwrap nested layers.
        atRule.replaceWith(atRule.nodes);
      },
    },
  };
}
stripCssLayers.postcss = true;

/** Trailing indentation of the last line of a raw whitespace string. */
function indentOf(raw) {
  const match = /\n([ \t]*)$/.exec(raw ?? '');
  return match ? match[1] : '';
}

/**
 * How much deeper than `atRule` its children are authored, i.e. the indentation
 * the layer wrapper itself contributes.
 *
 * @param {import('postcss').AtRule} atRule
 * @returns {number}
 */
function indentWidthOf(atRule) {
  const inner = indentOf(atRule.first?.raws?.before);
  const outer = indentOf(atRule.raws?.before);
  return Math.max(0, inner.length - outer.length);
}

/**
 * Removes `width` columns of indentation from every raw whitespace slot in
 * `nodes` and their descendants, so hoisted rules read as if the layer had
 * never wrapped them.
 *
 * @param {readonly import('postcss').ChildNode[]} nodes
 * @param {number} width
 */
function dedent(nodes, width) {
  if (width <= 0) {
    return;
  }

  const indent = new RegExp(`\\n {${width}}`, 'g');
  const shrink = (raw) =>
    typeof raw === 'string' ? raw.replace(indent, '\n') : raw;

  for (const node of nodes) {
    node.raws.before = shrink(node.raws.before);
    node.raws.after = shrink(node.raws.after);
    if (node.nodes) {
      dedent(node.nodes, width);
    }
  }
}

/** Matches `@layer` as an at-rule keyword rather than inside an identifier. */
const LAYER_AT_RULE = /@layer\b/i;

/**
 * Returns `css` with every cascade layer flattened away. Input without any
 * `@layer` is returned untouched, so the common case costs one regex test
 * rather than a full PostCSS round trip.
 *
 * @param {string} css
 * @returns {string}
 */
export function stripCssLayersFromText(css) {
  if (!LAYER_AT_RULE.test(css)) {
    return css;
  }

  return postcss([stripCssLayers()]).process(css, { from: undefined }).css;
}
