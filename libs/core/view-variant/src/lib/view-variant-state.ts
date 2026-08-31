/**
 * Compares two host-owned view states after host-provided normalization.
 *
 * The normalizer must exclude transient values and return stable object-key
 * and array ordering. This deliberately uses JSON serialization rather than
 * generic deep equality and does not reorder values internally.
 */
export function mlvViewStateEqual<TState, TNormalized>(
  first: TState,
  second: TState,
  normalize: (state: TState) => TNormalized,
): boolean {
  return JSON.stringify(normalize(first)) === JSON.stringify(normalize(second));
}
