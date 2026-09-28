/**
 * @internal `String(value)`, or `null` when that conversion throws.
 *
 * `String()` throws a `TypeError` for an object it cannot turn into a
 * primitive: one with no callable `toString` / `valueOf` — a null-prototype
 * object (`Object.create(null)`), which the smart filter bar keeps as it is
 * since #351 — or one whose `Symbol.toPrimitive` / `toString` throws.
 */
export function mlvFilterTryString(value: unknown): string | null {
  try {
    return String(value);
  } catch {
    return null;
  }
}

/**
 * @internal `String(value)` that never throws. A value `String()` cannot
 * convert is summarised by its `Object.prototype.toString` tag —
 * `[object Object]` for a null-prototype object, the text the same data gave
 * on an ordinary prototype — so a summary, a native input or a text predicate
 * never throws on an operand the consumer wrote.
 */
export function mlvFilterDisplayString(value: unknown): string {
  return mlvFilterTryString(value) ?? Object.prototype.toString.call(value);
}
