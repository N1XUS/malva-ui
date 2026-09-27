/** A pointer position in viewport coordinates (`clientX` / `clientY`). */
export interface MlvSubmenuAimPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Hover-intent state of one open submenu, owned by `MlvMenuOverlayController`.
 */
export interface MlvSubmenuAimState {
  /**
   * Apex of the safe triangle: the last pointer position seen on the submenu's
   * trigger row, or — when the pointer left the row before any move over it
   * was seen — the point it left at. `null` until one of the two is known, and
   * a `null` apex protects nothing.
   */
  anchor: MlvSubmenuAimPoint | null;
  /** Whether the pointer has reached the submenu panel since it opened. */
  cursorEnteredSubmenu: boolean;
}

/**
 * Whether `point` lies inside the submenu's safe triangle: the triangle whose
 * apex is `anchor` and whose base is the whole edge of `submenuRect` facing it.
 *
 * A pointer travelling in a straight line from the trigger row to any row of
 * the submenu — the first, the last, or one in between — stays inside that
 * triangle for the whole path, including the part that crosses other rows of
 * the parent menu below or above the trigger. The edges are inclusive, so a
 * pointer exactly on the line to the panel's top or bottom corner counts.
 *
 * The apex is fixed rather than re-based on every move: judging each step from
 * the previous one reads a slow diagonal, or one that pauses, as a sequence of
 * steps too short to be heading anywhere, and a one-pixel jitter as a change of
 * course.
 *
 * The side is derived from the geometry, not from the requested placement or
 * the direction: the panel edge facing the apex is its left edge when the apex
 * lies to its left, its right edge when the apex lies to its right. That covers
 * a submenu CDK moved to its fallback side (`left-start`) and a mirrored one
 * inside a `[dir="rtl"]` scope alike, with no direction read at all — both
 * inputs are measured in the same physical viewport space, and the side CDK
 * finally chose is only knowable from the rect. An apex that overlaps the
 * panel horizontally has no facing edge and protects nothing.
 *
 * @param point - Current pointer position.
 * @param anchor - Triangle apex; `null` protects nothing.
 * @param submenuRect - The submenu pane's viewport rect, measured when asked.
 * @returns `true` when `point` is inside the triangle or on its boundary.
 */
export function isPointerInSafeTriangle(
  point: MlvSubmenuAimPoint,
  anchor: MlvSubmenuAimPoint | null,
  submenuRect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>,
): boolean {
  if (!anchor) return false;

  // physical: pointer coordinates and the pane rect share viewport space, and
  // the facing edge is whichever side CDK's collision handling put the pane on.
  const edgeX =
    anchor.x < submenuRect.left
      ? submenuRect.left
      : anchor.x > submenuRect.right
        ? submenuRect.right
        : null;
  if (edgeX === null) return false;

  const top = { x: edgeX, y: submenuRect.top };
  const bottom = { x: edgeX, y: submenuRect.bottom };

  const d1 = cross(anchor, top, point);
  const d2 = cross(top, bottom, point);
  const d3 = cross(bottom, anchor, point);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

/**
 * @private Z component of `(b - a) × (p - a)`: which side of the line `a → b`
 * the point `p` lies on, `0` when it lies on the line.
 */
function cross(
  a: MlvSubmenuAimPoint,
  b: MlvSubmenuAimPoint,
  p: MlvSubmenuAimPoint,
): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
