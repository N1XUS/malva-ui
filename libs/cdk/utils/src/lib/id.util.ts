/**
 * Monotonic counter backing {@link mlvNextId}. Increments once per call and is
 * never reset for the lifetime of the module, guaranteeing process-unique ids.
 */
let _idCounter = 0;

/**
 * Generates a process-unique, stable id string with the given prefix.
 *
 * Ids are of the form `<prefix>-<n>` where `<n>` is a monotonically increasing
 * integer. Because the counter is module-scoped and never reset, every call
 * within a single JS runtime returns a distinct value — suitable for DOM
 * `id`/`for`/`aria-*` wiring without the overhead or SSR-hydration mismatch
 * risk of random uuids.
 *
 * @param prefix The id prefix (e.g. `'mlv-tooltip'`, `'mlv-radio-group'`)
 * @returns A unique id such as `mlv-tooltip-3`
 *
 * @example
 * mlvNextId('mlv-tooltip')      // 'mlv-tooltip-0'
 * mlvNextId('mlv-tooltip')      // 'mlv-tooltip-1'
 */
export function mlvNextId(prefix: string): string {
  return `${prefix}-${_idCounter++}`;
}
