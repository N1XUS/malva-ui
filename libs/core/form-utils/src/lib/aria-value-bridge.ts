/**
 * Forms ↔ `@angular/aria` value bridge.
 *
 * The headless `@angular/aria` selection patterns (`ngListbox`, `ngMenu`,
 * `ngTree`, …) always model their selection as an **array** of values
 * (`value: ModelSignal<V[]>`), even in single-select mode where the array holds
 * at most one entry. Malva UI form controls expose the idiomatic public shape:
 * a bare `T` for single-select and a `T[]` for multi-select, with `null` used
 * to represent "no selection".
 *
 * These helpers translate between the two representations so a component can
 * keep its public single/multi forms contract while driving an aria pattern
 * underneath. They are pure and allocation-light, and are designed to
 * round-trip: `fromAriaValues(toAriaValues(v, multi), multi)` yields the
 * canonical form of `v`.
 *
 * @remarks
 * `toAriaValues` treats an incoming array as an already-expanded multi-select
 * value. If your single-select `T` is itself an array type, wrap it before
 * bridging — this is the same ambiguity the aria patterns themselves carry.
 */

/**
 * Normalises a control value (`T`, `T[]`, or `null`/`undefined`) into the flat
 * `V[]` array that `@angular/aria` selection patterns expect.
 *
 * - `null` / `undefined` → `[]` (cleared selection)
 * - an array → a shallow copy of that array (multi-select)
 * - any other value → a single-element array (single-select)
 *
 * @param value The control-side value to convert.
 * @returns A fresh array suitable for assigning to an aria `value` model.
 */
export function toAriaValues<V>(
  value: V | readonly V[] | null | undefined,
): V[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? [...(value as readonly V[])] : [value as V];
}

/**
 * Collapses the flat `V[]` array produced by an `@angular/aria` selection
 * pattern back into the control-side value shape.
 *
 * - `multiple === true` → a shallow copy of the array (empty array stays `[]`)
 * - `multiple === false` → the first entry, or `null` when the array is empty
 *
 * @param values The aria-side selection array.
 * @param multiple Whether the control is in multi-select mode.
 * @returns The control-side value: `V[]` for multi-select, `V | null` for single.
 */
export function fromAriaValues<V>(
  values: readonly V[] | null | undefined,
  multiple: boolean,
): V | V[] | null {
  const list = values ?? [];
  if (multiple) {
    return [...list];
  }
  return list.length > 0 ? list[0] : null;
}
