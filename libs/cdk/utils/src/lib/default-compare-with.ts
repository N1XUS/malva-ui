/**
 * The default value-equality predicate behind every Malva UI selection
 * surface's `compareWith` — the option controls' `compareWith` **input**
 * (`mlv-select`, `mlv-combobox`) and `MlvSelectionService.compareWith`. Plain
 * reference (`===`) equality.
 *
 * Behaviourally identical to the inline `(a, b) => a === b` arrows it replaces.
 * It exists as a **single module-level reference** so that a callee handed a
 * `compareWith` can *recognise* it — `input()` evaluates its default once per
 * component instance and `signal()` once per service instance, so an inline
 * arrow is a fresh function per control and can never be identified.
 *
 * Recognition is what unlocks the keyed fast paths in
 * `@malva-ui/core/dropdown`'s `isReconciliationEmit`, `filteredOutCommitted`
 * and `valueIndex`: they branch on `compare === defaultCompareWith` and swap a
 * nested pairwise scan for O(1) `Set` / `Map` membership. A control that leaves
 * `compareWith` unset therefore gets that automatically; one that supplies its
 * own comparator keeps the pairwise path unchanged.
 *
 * **Do not wrap, bind or re-create this on the way to a consumer.** Every
 * re-export must forward the identical binding (`import` + `export { … }`),
 * because a wrapper compares unequal and silently disables every fast path
 * without changing a single result — nothing would go red.
 *
 * It lives in `@malva-ui/cdk/utils` rather than in the dropdown because
 * `@malva-ui/core/dropdown` depends on `@malva-ui/core/form-utils`
 * (`mlv-dropdown-panel` injects `MlvSelectionService`), so a constant owned by
 * the dropdown could not be shared with the service without inverting that
 * dependency. `@malva-ui/core/dropdown` re-exports it, so its public surface is
 * unchanged.
 *
 * Note it is `===`, not `Object.is`: `defaultCompareWith(NaN, NaN)` is `false`
 * and `defaultCompareWith(0, -0)` is `true`. Both quirks are load-bearing for
 * the fast paths' hazard guards — see `reconciliation.ts`'s `hazardOf`.
 */
export const defaultCompareWith = <T>(a: T, b: T): boolean => a === b;
