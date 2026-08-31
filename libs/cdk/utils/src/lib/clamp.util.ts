/**
 * Clamps a number to the inclusive range `[min, max]`.
 *
 * If `min` is greater than `max` the bounds are treated as-is; callers are
 * responsible for passing a valid range.
 *
 * @param value The number to clamp
 * @param min The lower bound (inclusive)
 * @param max The upper bound (inclusive)
 * @returns `value` constrained so that `min <= result <= max`
 *
 * @example
 * clamp(5, 0, 10)   // 5
 * clamp(-3, 0, 10)  // 0
 * clamp(42, 0, 10)  // 10
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
