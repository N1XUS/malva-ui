/**
 * Malva UI — the one way a spec asserts accessibility.
 *
 * Before this helper there were five different axe call shapes across the
 * library: a bare full sweep, a full sweep with one rule off, a full sweep with
 * two rules off, `runOnly` a single rule, and `not.toContain` a single rule id.
 * The last two are the reason this exists — they read as "this component is axe
 * clean" while checking exactly one rule, and nothing distinguished a
 * deliberately narrow probe from an untightened one. Route every sweep through
 * `expectNoAxeViolations()` so the scope of the check is the same everywhere
 * and any narrowing has to be written down at the call site.
 *
 * Two things this helper is careful about:
 *
 * 1. **The failure message is a string.** `expect(results.violations).toEqual([])`
 *    hands vitest axe's `Result[]` — every node carries `element`, a live DOM
 *    reference, so the pretty-printer walks the rendered component (and, for a
 *    fixture, its injector graph). That is minutes of CPU for one failed
 *    assertion. `expectNoAxeViolations()` reduces the violations to a short
 *    report first and asserts on that, so a failure prints rule id, impact,
 *    help text and the offending selectors and nothing else.
 *
 * 2. **The disabled rules are central and each carries its reason.** See
 *    {@link AXE_JSDOM_DISABLED_RULES}. A rule is disabled here only when it
 *    cannot produce a trustworthy answer in this environment — never because a
 *    component fails it. A real violation is either fixed or narrowed at the
 *    call site with a comment naming the rule and the selector.
 *
 * Coverage is enforced by `scripts/check-axe-coverage.mjs` (see #47).
 */

import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Rules switched off for every jsdom sweep, with the reason each one cannot be
 * evaluated here. Merged *under* the caller's own `rules`, so a spec can
 * re-enable one deliberately.
 *
 * @type {Readonly<Record<string, { enabled: false }>>}
 */
export const AXE_JSDOM_DISABLED_RULES = Object.freeze({
  // Under jsdom axe reports `color-contrast` as INAPPLICABLE: its matcher
  // selects no node, so the rule yields no violation, no pass and no
  // `incomplete` entry — not even with a stubbed `getBoundingClientRect`.
  // (Measured: flipping this to `enabled: true` and re-running `core-table`,
  // `core-select` and `scheduler` leaves all three green.) So it is listed
  // here deliberately rather than because something fails, for two reasons:
  //
  //   1. It could not answer even if it did match. Every colour in this
  //      library comes from a token, and jsdom resolves no `var()`: for a
  //      `color: var(--mlv-text-primary)` element `getComputedStyle(el).color`
  //      is the empty string. `Range.prototype.getClientRects`, which axe's
  //      text measurement reaches for, is `undefined` here as well.
  //   2. `inapplicable` is a property of this jsdom, not a contract. A jsdom
  //      that grew layout would switch the rule on for every component at
  //      once, judging colours it still cannot resolve.
  //
  // Contrast is checked in a real browser instead — see
  // `libs/editor/e2e/editor.spec.ts`, which injects `axe.source` into the
  // Playwright page.
  'color-contrast': { enabled: false },

  // "All page content should be contained by landmarks." A component spec
  // mounts one component into an otherwise empty `<body>` with no `<main>`,
  // `<header>` or `<nav>` around it, so the rule fires on the fixture root of
  // essentially every component — it is judging the harness, not the
  // component. Whether the consuming page wraps the component in a landmark is
  // the consumer's decision and is checked in the docs app / e2e layer.
  region: { enabled: false },
});

/**
 * Nodes listed per violated rule before the report elides the rest. Enough to
 * see the pattern, bounded so the assertion payload stays small.
 */
const MAX_NODES_PER_RULE = 5;

/**
 * Reduces axe's `Result[]` to a short, stable, human-readable report.
 * Returns the empty string when there are no violations, so the assertion is a
 * plain string comparison with a readable diff.
 *
 * @param {readonly import('axe-core').Result[]} violations
 * @returns {string}
 */
export function formatAxeViolations(violations) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes.slice(0, MAX_NODES_PER_RULE).map((node) => {
        const selector = Array.isArray(node.target)
          ? node.target.flat().join(' >>> ')
          : String(node.target);
        return `    · ${selector}`;
      });
      const elided = violation.nodes.length - nodes.length;
      if (elided > 0) nodes.push(`    · …and ${elided} more node(s)`);
      return [
        `${violation.id} [${violation.impact ?? 'unknown'}] — ${violation.help}`,
        ...nodes,
      ].join('\n');
    })
    .join('\n');
}

/**
 * Runs axe over `root` with the shared disabled-rule list applied.
 *
 * Prefer {@link expectNoAxeViolations}; reach for this only when a spec needs
 * the raw result (for instance to assert on `incomplete`, or to inspect the
 * related nodes of a violation it deliberately expects).
 *
 * @param {Element | Document} root Element or document to analyse.
 * @param {import('axe-core').RunOptions} [options] Standard axe run options.
 *   Any `rules` given here are merged over {@link AXE_JSDOM_DISABLED_RULES}.
 * @returns {Promise<import('axe-core').AxeResults>}
 */
export function runAxe(root, options = {}) {
  return axe.run(root, {
    ...options,
    rules: { ...AXE_JSDOM_DISABLED_RULES, ...(options.rules ?? {}) },
  });
}

/**
 * Asserts that `root` has no axe violations.
 *
 * The default is a **full sweep**: every rule axe ships, minus
 * {@link AXE_JSDOM_DISABLED_RULES}. That is the assertion a component is
 * expected to carry.
 *
 * Narrowing it is allowed only for a violation that is real and cannot be
 * fixed in the change at hand. Narrow with an explicit
 * `rules: { '<id>': { enabled: false } }` and a comment naming the rule id and
 * the offending selector, so the exclusion is greppable and reviewable. Do not
 * use `runOnly` to hide a failure — a `runOnly` sweep asserts nothing about
 * every rule it omits, and reads like full coverage.
 *
 * @param {Element | Document} root Element or document to analyse.
 * @param {import('axe-core').RunOptions} [options] Standard axe run options.
 * @returns {Promise<void>}
 */
export async function expectNoAxeViolations(root, options = {}) {
  const results = await runAxe(root, {
    // Only `violations` is read, and `resultTypes` caps the node detail axe
    // collects for the other three buckets — a measurable saving on a sweep
    // over a whole overlay container. Overridable, because a caller that also
    // wants full `incomplete` detail should ask for it.
    resultTypes: ['violations'],
    ...options,
  });
  expect(formatAxeViolations(results.violations)).toBe('');
}
