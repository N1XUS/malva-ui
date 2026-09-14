/**
 * Rewrites CSS into the subset the vitest/jsdom environment can actually parse.
 *
 * jsdom parses CSS with `rrweb-cssom`, which does not implement `@layer`. On
 * encountering it jsdom logs "Could not parse CSS stylesheet" and discards the
 * **entire** stylesheet, so every rule inside becomes invisible to
 * `getComputedStyle`. Because the component stylesheets under `libs/` are
 * wrapped in `@layer mlv.components { … }`, that silently disabled the
 * library's whole styling test suite.
 *
 * `@container` is the same failure with a different keyword: rrweb-cssom does
 * not implement it either, so one container query anywhere in a stylesheet
 * discards the whole thing. It cannot be flattened the way a layer can — jsdom
 * performs no layout, so no container has a size and no query inside one could
 * ever match — so those blocks are *dropped*, which is the outcome jsdom would
 * have produced for them anyway. Assert a container query on the compiled text
 * instead (`stripCssLayersFromText` leaves it in place); a `getComputedStyle`
 * assertion could only ever have been asserting the fallback.
 *
 * Both rewrites are only applied to the test environment; the shipped CSS keeps
 * its layers and its container queries. Flattening does change cascade
 * semantics — an unlayered rule outranks every layered one — but the layers
 * exist to lose to consumer/Tailwind styles that a unit test never loads, and
 * flattening preserves document order, so rules within one stylesheet (and
 * across stylesheets injected in layer order) keep resolving exactly as they do
 * in a browser.
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

/**
 * PostCSS plugin removing every `@container` block.
 *
 * Unlike a layer, a container query cannot be hoisted: its rules apply only
 * when a named ancestor's size matches, and jsdom lays nothing out, so every
 * such query is unmatched by construction. Hoisting the children would make
 * them apply unconditionally, which is a different stylesheet; dropping them
 * leaves the element with exactly the styles jsdom would have resolved if it
 * could parse the query at all.
 *
 * @returns {import('postcss').Plugin}
 */
export function dropContainerQueries() {
  return {
    postcssPlugin: 'mlv-drop-container-queries',
    AtRule: {
      container: (atRule) => atRule.remove(),
    },
  };
}
dropContainerQueries.postcss = true;

/** Matches `@layer` as an at-rule keyword rather than inside an identifier. */
const LAYER_AT_RULE = /@layer\b/i;

/** Matches `@container` as an at-rule keyword, not `container-name` etc. */
const CONTAINER_AT_RULE = /@container\b/i;

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

/**
 * Returns `css` in the form a jsdom document can parse: layers flattened and
 * container queries dropped. This is what the `<style>` shim applies, and it is
 * deliberately *not* what {@link stripCssLayersFromText} does — a spec reading
 * compiled text is asserting on the shipped stylesheet and should still see its
 * container queries.
 *
 * @param {string} css
 * @returns {string}
 */
export function flattenCssForJsdom(css) {
  const hasLayers = LAYER_AT_RULE.test(css);
  const hasContainers = CONTAINER_AT_RULE.test(css);
  if (!hasLayers && !hasContainers) {
    return css;
  }

  const plugins = [];
  if (hasLayers) {
    plugins.push(stripCssLayers());
  }
  if (hasContainers) {
    plugins.push(dropContainerQueries());
  }
  return postcss(plugins).process(css, { from: undefined }).css;
}
