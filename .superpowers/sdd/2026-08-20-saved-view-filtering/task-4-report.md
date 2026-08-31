# Task 4 — Filter expressions and compatibility adapters

## Delivered

- Added the public recursive readonly `MlvFilterExpression` model without
  changing `MlvFilterFieldState` or the existing operator union.
- Added `mlvFilterFieldsToExpression()`,
  `mlvFilterExpressionToFields()`, and the domain-neutral
  `mlvMatchesFilterExpression()` evaluator, then exported them from
  `@malva-ui/core/filter`.
- Documented expression conversion, evaluator semantics, empty-group identity,
  invalid numeric/range behavior, and intentionally lossy reverse-conversion
  cases in the filter library documentation.

## RED / GREEN evidence

### RED

The first uncached `yarn nx test core-filter --skipNxCache` run failed only
because the new test suite could not resolve `./filter-expression`; the three
pre-existing test files still reported 37 passing tests. This established the
new public module and API as the missing behavior.

Two focused regression checks were also observed red before their minimal
implementations:

- Disabling nested same-field OR flattening returned `null` where the adapter
  must return the ordered `EU`, `UK`, `US` field state.
- Treating a singleton OR group as strategy `or` failed the canonicalization
  expectation; it is now normalized to the semantically-neutral `and` leaf.

### GREEN

The final uncached core-filter suite reports 4 test files and 62 tests passed.
It covers recursive AND/OR trees, empty groups, flat/expression adapters,
same-field nesting, non-representable structures, the supplied value reader,
and the complete operator matrix.

## Operator matrix

| Operators | Verified behavior |
| --- | --- |
| `contains`, `not-contains`, `starts-with`, `ends-with` | Stringifies nullish values as `''` and uses case/diacritic-insensitive matching, mirroring the data source's text normalization. |
| `equals`, `not-equals` | Strict identity comparison. |
| `greater-than`, `greater-than-or-equal`, `less-than`, `less-than-or-equal` | Compare only finite numeric values or nonblank numeric strings; invalid values do not match. |
| `between` | Inclusive exact-two-value finite range; reversed or invalid bounds do not match. |
| `in`, `not-in` | Strict membership requiring an array operand, matching the data source; an array-valued field is not implicitly expanded. |
| `empty`, `not-empty` | Ignore operand; empty is nullish, `''`, or an empty array. |

Empty expression groups follow boolean identity: AND is true and OR is false.

## Reverse conversion review

- Top-level and nested AND groups are flattened while retaining first field
  occurrence and same-field condition order.
- Same-field nested OR groups are flattened into one flat OR field.
- Singleton groups normalize to a direct AND leaf because a one-condition
  strategy is semantically irrelevant.
- Cross-field OR, false empty OR, and a same field split between AND and a
  multi-condition OR return `null`, avoiding a misleading flat model.

## Files

- `libs/core/filter/src/lib/filter.types.ts`
- `libs/core/filter/src/lib/filter-expression.ts`
- `libs/core/filter/src/lib/filter-expression.spec.ts`
- `libs/core/filter/src/index.ts`
- `.claude/projects/libs-filter.md` (backing document for `libs/core/filter/CLAUDE.md`)

## Verification

Successful uncached commands:

```sh
yarn nx test core-filter --skipNxCache
yarn nx lint core-filter --skipNxCache
yarn nx typecheck core-filter --skipNxCache
yarn nx typecheck core --skipNxCache
yarn nx build core --skipNxCache
yarn nx run docs:check-doc-api --skipNxCache
git diff --check
```

`docs:check-doc-api` completed with 0 failures and the workspace's existing
240 documentation warnings. The grouped core build included
`@malva-ui/core/filter` and completed successfully.

## Concerns

- `yarn tsc --noEmit -p libs/core/filter/tsconfig.spec.json` remains blocked
  by two pre-existing TS18047 errors in
  `smart-filter-bar/smart-filter-bar.spec.ts` (lines 425 and 426: `search` is
  possibly `null`); the new expression suite introduces no spec type errors.
- Nx/Vite emits existing deprecation and missing `tsconfig.app.json` warnings;
  they do not produce test, lint, typecheck, build, or documentation-check
  failures.

## Fix Round 1/5 — lossless boolean identity normalization

### Review finding addressed

The first reverse collector rejected a singleton AND wrapper inside a
multi-child OR, even when it was equivalent to a single field condition. It
also treated an empty OR as indistinguishable from an unrepresentable shape,
so it could not apply OR's false identity or AND's true identity recursively.

The collector now returns one of four explicit normalization outcomes:
`true`, `false`, `terms`, or `unrepresentable`. AND skips true children and
propagates false; OR skips false children, short-circuits true children, and
flattens only same-key one-term alternatives. This preserves the existing
rejections for cross-field OR and mixed same-field AND/OR composition.

### TDD evidence

**RED:** The added adapter cases made the uncached leaf suite fail because
`or(region=EU, and(region=UK))` returned `null` rather than the single OR
field state. The suite reported 62 passing tests and this one failure.

**GREEN:** After replacing the collector, `yarn nx test core-filter
--skipNxCache` passed all 63 tests. The new assertions cover singleton AND
wrappers, true/false dominance in OR, neutral empty AND children, ignored
false OR children, and false AND children remaining non-representable.

### Fix-round verification

```sh
yarn nx test core-filter --skipNxCache
yarn nx lint core-filter --skipNxCache
yarn nx typecheck core-filter --skipNxCache
yarn nx build core --skipNxCache
yarn nx run docs:check-doc-api --skipNxCache
git diff --check
```

The standalone spec TypeScript check remains blocked only by the two
pre-existing nullable `search` errors listed above.

## Fix Round 2/5 — order-independent identity dominance

### Review finding addressed

The AND collector returned as soon as it encountered an unrepresentable child.
That made normalization depend on child order: a later empty OR (false) could
not dominate the earlier ambiguity, even though `false AND anything` is false.

AND now scans every child, tracking false and unrepresentable outcomes
separately. It resolves false first after the scan, then propagates an
unrepresentable outcome only when no dominating false identity exists. This
matches the existing OR collector's true-identity dominance and retains all
genuine ambiguity when no identity determines the result.

### TDD evidence

**RED:** Both-order regressions made the uncached suite fail: an outer OR
containing `AND(cross-field OR, empty OR)` returned `null` instead of the
single UK field. The suite reported 63 passing tests and this failure.

**GREEN:** The completed uncached suite reports 64 passing tests. It verifies
both orders of `AND(unrepresentable, false)`, OR's resulting false-child
elision, both orders of `OR(unrepresentable, true)`, and continued propagation
of unrepresentable expressions when no identity dominates.

### Fix-round verification

```sh
yarn nx test core-filter --skipNxCache
yarn nx lint core-filter --skipNxCache
yarn nx typecheck core-filter --skipNxCache
yarn nx build core --skipNxCache
git diff --check
```

## Fix Round 3/5 — nested true identity conversion coverage

### Review finding addressed

Fix Round 2 verified that a true child dominates an OR by converting the OR
itself to `[]`, but did not prove that the normalized true result stays neutral
when the OR is nested inside an outer AND with another field.

The adapter suite now covers both child orders for
`AND(OR(unrepresentableCrossField, emptyANDTrue), region=UK)`. Each converts
to the single UK field, while the existing direct `[]` assertions remain in
place.

### Sensitivity evidence

A temporary negative control disabled OR's true-child dominance. The focused
uncached suite then failed the new outer assertion with `expected` the UK
field and `received null`; the direct true-identity checks also failed. The
normal collector was restored before the final run.

### Verification

```sh
yarn nx test core-filter --skipNxCache
yarn nx lint core-filter --skipNxCache
yarn nx typecheck core-filter --skipNxCache
git diff --check
```

The final uncached suite reports 64 passing tests.
