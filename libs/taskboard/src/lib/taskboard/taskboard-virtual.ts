/**
 * The window of cards one virtualized cell currently has in the DOM.
 *
 * A virtual cell renders a moving slice of its bucket, so an index read back
 * from the DOM counts only the cards inside that slice. Every DOM-derived
 * index therefore passes through this module before the board treats it as a
 * bucket position.
 */
export interface MlvTaskboardVirtualWindow {
  /** Bucket index of the first card currently in the DOM. */
  readonly start: number;
  /** How many cards the window holds. */
  readonly rendered: number;
  /** How many cards the whole bucket holds. */
  readonly total: number;
}

/**
 * Translates an index among a cell's rendered card elements into an index in
 * the whole bucket. A `null` window means the cell renders every card, so the
 * DOM index already is the bucket index.
 *
 * The result is clamped to `0..total`, because a bucket offers one slot more
 * than it has cards: the tail.
 */
export function mlvTaskboardBucketIndex(
  domIndex: number,
  window: MlvTaskboardVirtualWindow | null,
): number {
  if (window === null) return domIndex;
  return Math.min(Math.max(window.start + domIndex, 0), window.total);
}

/**
 * Translates a bucket index back into the rendered window, or `null` when
 * that card is currently scrolled out of the DOM — the caller has to scroll
 * it back in before it can focus or measure it.
 */
export function mlvTaskboardRenderedIndex(
  bucketIndex: number,
  window: MlvTaskboardVirtualWindow | null,
): number | null {
  if (window === null) return bucketIndex;
  const rendered = bucketIndex - window.start;
  return rendered < 0 || rendered >= window.rendered ? null : rendered;
}
