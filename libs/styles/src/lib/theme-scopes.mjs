/**
 * Simulates how the theme's custom properties compute, element by element,
 * down a chain of theme scopes — a `[mlvTheme]` island inside a page, a
 * high-contrast subtree inside a dark one, a shadow host that adopts the
 * stylesheet.
 *
 * `theme-contrast.mjs` answers "what does this token resolve to in theme X?"
 * by looking the token up in that theme's region of `theme.scss`. That is the
 * right answer only at the document root. A custom property's `var()`s are
 * substituted on the element that *declares* it, and descendants inherit the
 * already-substituted value. So an alias declared once on `:root` keeps the
 * root theme's answer inside every nested island that does not redeclare the
 * alias itself, however theme-aware the tokens it reads are. That is the
 * dark-island bug class, and no per-theme lookup can see it.
 *
 * This module reads the compiled stylesheet instead and applies the real rules:
 *
 * - the rules whose selector matches an element declare on it, later rules
 *   winning. Every scope selector the theme uses (`:root`, `:host`,
 *   `[mlvTheme=…]`, `[data-theme=…]`, `[dir=…]`) has specificity (0,1,0), so
 *   source order is the whole cascade — `loadTokenRules` refuses any other
 *   selector rather than guess;
 * - a declared property's `var()`s resolve against the same element's
 *   computed values, taking the `var()` fallback when a name is unset or
 *   guaranteed-invalid;
 * - a property whose `var()` names an unset property with no fallback, and
 *   every member of a reference cycle, are invalid at computed-value time and
 *   compute to the guaranteed-invalid value (`undefined` here). Cycles are
 *   found lazily, the way Chrome 153 finds them: properties resolve in the
 *   element's declaration order (a name a later rule redeclares keeps its
 *   first position), a `var()` inside a fallback is followed only when that
 *   fallback is taken, and a value keeps substituting past a failed `var()`
 *   rather than stopping at it. So `--b: var(--a, red)` in a cycle is invalid
 *   whatever its fallback. A reader outside the cycle, `--c: var(--b, blue)`,
 *   computes `blue` only when it is resolved after the cycle has closed;
 *   declared first, it is still being substituted when a cycle member's later
 *   `var()` reaches it, and the cycle catches it too. Declaration order thus
 *   decides membership through that continued substitution. CSS Custom
 *   Properties Level 1 counts every `var()` as an edge, fallbacks included;
 *   this follows the browser instead. Cross-checked against Chrome 153 on 39
 *   declarations across 15 arrangements, and for the order across several
 *   matching rules on 15 values across 5 two-rule arrangements, all agreeing;
 *   no arrangement in the published stylesheet contains a cycle today;
 * - an undeclared property inherits the parent's computed value verbatim.
 *
 * What it does not model, and therefore refuses rather than guess at:
 *
 * - a selector other than the bare scope selectors below, and a bare scope
 *   selector outside `@layer mlv.tokens`;
 * - a scope rule inside `@media`, `@supports` or `@container`, whose condition
 *   it cannot evaluate;
 * - `!important` on a token, which would reorder the cascade;
 * - a token registered through `@property`, whose `inherits` and `syntax`
 *   change both inheritance and substitution.
 *
 * And what it does not model, silently:
 *
 * - `:host` is a flag on an element, not a shadow tree: it neither loses to
 *   the outer document's rules on the host element, as a shadow stylesheet's
 *   normal declarations do, nor sees any consumer rule — only the published
 *   stylesheet is read;
 * - values are compared as whitespace-normalised text after substitution, so
 *   two spellings of one colour (`#fff`, `#ffffff`) differ. That errs towards
 *   a spurious failure, never a spurious pass.
 */
import postcss from 'postcss';

/**
 * The scope selectors the token layer is allowed to use, each with the
 * element state it matches.
 */
const SCOPE_SELECTORS = {
  ':root': (el) => el.root === true,
  ':host': (el) => el.host === true,
  '[mlvTheme=light]': (el) => el.mlvTheme === 'light',
  '[mlvTheme=dark]': (el) => el.mlvTheme === 'dark',
  '[data-theme=high-contrast]': (el) => el.dataTheme === 'high-contrast',
  '[dir=rtl]': (el) => el.dir === 'rtl',
  '[dir=ltr]': (el) => el.dir === 'ltr',
};

/** @private True when `rule` sits inside `@layer mlv.tokens`. */
const inTokenLayer = (rule) => {
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent)
    if (
      p.type === 'atrule' &&
      p.name === 'layer' &&
      p.params.trim() === 'mlv.tokens'
    )
      return true;
  return false;
};

/** @private The first conditional group rule around `rule`, if any. */
const conditionOf = (rule) => {
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent)
    if (
      p.type === 'atrule' &&
      ['media', 'supports', 'container'].includes(p.name)
    )
      return `@${p.name} ${p.params}`;
  return null;
};

/**
 * Collects every rule that declares a custom property on a theme scope, in
 * source order.
 *
 * Throws on a token-layer rule whose selector is not a bare scope selector, on
 * a bare scope-selector rule outside the token layer or inside a conditional
 * group rule, on `!important` in a scope rule and on an `@property`
 * registration of a name a scope rule declares: each would put something in
 * play that the simulation silently ignores (see the module notes).
 *
 * @param css Compiled CSS text (e.g. `libs/core/styles/malva-ui.scss`).
 * @returns `{ matches, declarations }[]` — `matches(element)` and the rule's
 *          custom properties as `[name, value]` pairs, whitespace-normalised.
 */
export const loadTokenRules = (css) => {
  const rules = [];
  const root = postcss.parse(css);
  const registered = new Set();
  root.walkAtRules('property', (at) => registered.add(at.params.trim()));
  root.walkRules((rule) => {
    const custom = rule.nodes.filter(
      (n) => n.type === 'decl' && n.prop.startsWith('--'),
    );
    if (custom.length === 0) return;
    const selectors = rule.selectors.map((s) => s.trim().replace(/["']/g, ''));
    const known = selectors.filter((s) => s in SCOPE_SELECTORS);
    const tokenLayer = inTokenLayer(rule);
    if (!tokenLayer && known.length === 0) return; // component-scoped properties
    if (known.length !== selectors.length)
      throw new Error(
        `unsupported selector in a theme scope: "${rule.selector}"`,
      );
    if (!tokenLayer)
      throw new Error(
        `theme scope outside @layer mlv.tokens: "${rule.selector}"`,
      );
    const condition = conditionOf(rule);
    if (condition)
      throw new Error(
        `conditional theme scope: "${rule.selector}" inside ${condition}`,
      );
    for (const d of custom) {
      if (d.important)
        throw new Error(`!important on a theme token: ${d.prop}`);
      if (registered.has(d.prop))
        throw new Error(`theme token registered with @property: ${d.prop}`);
    }
    const tests = selectors.map((s) => SCOPE_SELECTORS[s]);
    rules.push({
      matches: (el) => tests.some((t) => t(el)),
      declarations: custom.map((d) => [
        d.prop,
        d.value.replace(/\s+/g, ' ').trim(),
      ]),
    });
  });
  return rules;
};

/** @private Index of the first top-level comma in `input`, or -1. */
const topLevelComma = (input) => {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++;
    else if (input[i] === ')') depth--;
    else if (input[i] === ',' && depth === 0) return i;
  }
  return -1;
};

/**
 * @private Replaces every `var()` in `value` with `lookup(name)`, taking the
 * fallback when the name is unset. An unset name with no fallback leaves an
 * `<unset --name>` marker, which makes the whole declaration invalid at
 * computed-value time (see `computeChain`).
 */
const substitute = (value, lookup) => {
  let out = '';
  for (let i = 0; i < value.length; ) {
    if (!value.startsWith('var(', i)) {
      out += value[i++];
      continue;
    }
    let level = 0;
    let j = i + 3;
    for (; j < value.length; j++) {
      if (value[j] === '(') level++;
      else if (value[j] === ')' && --level === 0) break;
    }
    const inner = value.slice(i + 4, j);
    const comma = topLevelComma(inner);
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const hit = lookup(name);
    out +=
      hit ??
      (comma < 0
        ? `<unset ${name}>`
        : substitute(inner.slice(comma + 1).trim(), lookup));
    i = j + 1;
  }
  return out;
};

/**
 * Computed custom properties on the last element of `chain`.
 *
 * @param rules From `loadTokenRules`.
 * @param chain Elements from the document root down, each an object such as
 *              `{ root: true, mlvTheme: 'dark' }`, `{ dataTheme: 'high-contrast' }`
 *              or `{ host: true }`.
 * @returns name → fully substituted value, or `undefined` for a property that
 *          is invalid at computed-value time (the guaranteed-invalid value).
 */
export const computeChain = (rules, chain) => {
  let inherited = new Map();
  for (const el of chain) {
    const declared = new Map();
    for (const rule of rules)
      if (rule.matches(el))
        for (const [name, value] of rule.declarations)
          declared.set(name, value);

    const parent = inherited;
    const resolved = new Map();
    // Names being substituted right now, outermost first. A reference to one
    // of them closes a cycle: that name and everything above it on the stack
    // become invalid, and the reference itself resolves as unset, so its
    // fallback (if any) is still substituted. `substitute` reaches a fallback
    // only when it is taken, so a reference sitting in an untaken fallback is
    // no edge — the lazy rule Chrome applies (see the module notes).
    const stack = [];
    const cyclic = new Set();
    const lookup = (name) => {
      if (!declared.has(name)) return parent.get(name);
      if (resolved.has(name)) return resolved.get(name);
      const at = stack.indexOf(name);
      if (at >= 0) {
        for (const member of stack.slice(at)) cyclic.add(member);
        return undefined;
      }
      stack.push(name);
      const value = substitute(declared.get(name), lookup);
      stack.pop();
      const valid = !cyclic.has(name) && !value.includes('<unset ');
      resolved.set(name, valid ? value : undefined);
      return resolved.get(name);
    };

    const computed = new Map(parent);
    for (const name of declared.keys()) computed.set(name, lookup(name));
    inherited = computed;
  }
  return inherited;
};

/** Every name whose value differs between two computed maps, sorted. */
export const differingTokens = (actual, expected) =>
  [...new Set([...actual.keys(), ...expected.keys()])]
    .filter((name) => actual.get(name) !== expected.get(name))
    .sort();
