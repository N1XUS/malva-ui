/**
 * Vitest setup file: makes cascade-layered CSS readable inside jsdom.
 *
 * jsdom's CSS parser does not implement `@layer` and throws away any stylesheet
 * that uses it, which makes every `getComputedStyle` assertion in the library's
 * style specs silently resolve to `''`. This patches the one place layered CSS
 * enters a jsdom document — the text of a `<style>` element — and flattens the
 * layers away. See `./strip-css-layers.mjs` for why flattening is safe here.
 *
 * Installed through `test.setupFiles` in every project's `vite.config.mts` so
 * specs need no per-file opt-in and a newly added style spec is covered by
 * default. The shipped CSS is untouched — this never runs outside vitest.
 */

import { stripCssLayersFromText } from './strip-css-layers.js';

const INSTALLED = Symbol.for('mlv.stripCssLayersInstalled');

/** Normalises a DOM string-reflecting value the way the HTML spec does. */
function asCssText(value) {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Shadows an inherited accessor on `HTMLStyleElement.prototype` with one that
 * strips cascade layers on write. The original setter still performs the
 * insertion, so jsdom's "re-parse the style block" steps run as usual.
 */
function patchStyleAccessor(source, property) {
  const descriptor = Object.getOwnPropertyDescriptor(source.prototype, property);
  if (!descriptor?.set) {
    return;
  }

  Object.defineProperty(HTMLStyleElement.prototype, property, {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value) {
      descriptor.set.call(this, stripCssLayersFromText(asCssText(value)));
    },
  });
}

/**
 * Wraps a node-insertion method so text appended straight into a `<style>`
 * element is stripped too. Angular's `DomRendererFactory` and hand-written
 * specs both take this path.
 */
function patchStyleInsertion(source, method) {
  const original = source.prototype[method];
  if (typeof original !== 'function') {
    return;
  }

  Object.defineProperty(HTMLStyleElement.prototype, method, {
    configurable: true,
    writable: true,
    value: function (...nodes) {
      for (const node of nodes) {
        if (typeof node === 'string') {
          continue;
        }
        if (node?.nodeType === Node.TEXT_NODE) {
          node.data = stripCssLayersFromText(asCssText(node.data));
        }
      }

      return original.apply(
        this,
        nodes.map((node) =>
          typeof node === 'string' ? stripCssLayersFromText(node) : node,
        ),
      );
    },
  });
}

if (
  typeof HTMLStyleElement !== 'undefined' &&
  !HTMLStyleElement.prototype[INSTALLED]
) {
  patchStyleAccessor(Node, 'textContent');
  patchStyleAccessor(Element, 'innerHTML');
  patchStyleInsertion(Node, 'appendChild');
  patchStyleInsertion(Element, 'append');

  Object.defineProperty(HTMLStyleElement.prototype, INSTALLED, {
    value: true,
  });
}
