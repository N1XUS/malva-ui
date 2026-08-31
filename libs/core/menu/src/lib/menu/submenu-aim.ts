/** Cursor history used by the submenu safe-triangle algorithm. */
export interface MlvSubmenuAimState {
  lastX: number;
  lastY: number;
  submenuRect: DOMRect;
  side: 'right' | 'left';
  cursorEnteredSubmenu: boolean;
}

/**
 * Minimum horizontal travel, in CSS pixels, that counts as aiming at the submenu.
 *
 * Without it a purely vertical move qualifies: `deltaX === 0` is not "away from"
 * the submenu, and the cone between the panel's top and bottom corners is very
 * wide when measured from the far side of the item, so sliding straight down the
 * item column read as heading toward the panel and kept cancelling the close.
 *
 * Small enough that a genuine diagonal still registers on the first move, large
 * enough that jitter along one axis does not.
 */
const MIN_HORIZONTAL_PROGRESS = 2;

/** Returns whether the current pointer trajectory is heading into a submenu. */
export function isCursorHeadingToSubmenu(
  currentX: number,
  currentY: number,
  state: MlvSubmenuAimState,
): boolean {
  const { lastX, lastY, submenuRect, side } = state;
  const deltaX = currentX - lastX;
  const progress = side === 'right' ? deltaX : -deltaX;
  if (progress < MIN_HORIZONTAL_PROGRESS) return false;

  const edgeX = side === 'right' ? submenuRect.left : submenuRect.right;
  const edgeDelta = edgeX - lastX;
  if (Math.abs(edgeDelta) < 1) return true;

  const currentSlope = (currentY - lastY) / edgeDelta;
  const topSlope = (submenuRect.top - lastY) / edgeDelta;
  const bottomSlope = (submenuRect.bottom - lastY) / edgeDelta;
  return (
    currentSlope >= Math.min(topSlope, bottomSlope) &&
    currentSlope <= Math.max(topSlope, bottomSlope)
  );
}
