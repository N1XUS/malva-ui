import type { ConnectedPosition } from '@angular/cdk/overlay';
import type { MlvDirection } from './rtl.service';

/**
 * Mirrors the **inline-axis** offset of a CDK connected-position list against a
 * resolved direction, so a gap written once means the same thing in LTR and RTL.
 *
 * `ConnectedPosition.offsetX` is **physical**.
 * `FlexibleConnectedPositionStrategy` returns it verbatim from `_getOffset()`
 * and applies it as `x += offsetX` while scoring a candidate and as
 * `transform: translateX(${offsetX}px)` on the pane — there is no `_isRtl()`
 * anywhere on that path, unlike `originX` / `overlayX`, which the strategy does
 * mirror. So an entry that expresses "an 8px gap between the panel and the
 * trigger's inline-start edge" keeps pushing the panel the same way on screen
 * once mirroring has moved it to the other side of the trigger: the gap becomes
 * an overlap of the same size, twice the intended error.
 *
 * `offsetY` is the block axis and never mirrors, so it is passed through.
 *
 * The overlay owner calls this with the direction it creates the pane with —
 * the same value `FlexibleConnectedPositionStrategy` will mirror `start` / `end`
 * against — and again whenever that direction changes under an open overlay.
 * Resolving the direction anywhere else would let the two halves disagree.
 *
 * Nothing is mutated, and `positions` is returned **by reference** whenever the
 * mirrored list would be identical — always in LTR, and in RTL for a list whose
 * gap is purely on the block axis. Entries with no `offsetX` keep their identity
 * inside a mirrored list too. CDK deduplicates `positionChanges` by the identity
 * of the chosen `ConnectedPosition`, so this keeps a re-application that changes
 * nothing from looking like a position change.
 *
 * @param positions — The logical position list, ordered by preference.
 * @param direction — The direction the overlay pane resolves against.
 *
 * @example
 * ```ts
 * const direction = this._rtl.resolveDirection(origin);
 * this._overlay
 *   .position()
 *   .flexibleConnectedTo(origin)
 *   .withPositions(mlvMirrorInlineOffsets(positions, direction));
 * this._overlay.create({ positionStrategy, direction });
 * ```
 */
export function mlvMirrorInlineOffsets(
  positions: ConnectedPosition[],
  direction: MlvDirection,
): ConnectedPosition[] {
  if (direction !== 'rtl') return positions;

  let mirrored: ConnectedPosition[] | null = null;

  for (let index = 0; index < positions.length; index++) {
    const position = positions[index];
    // `0` and `undefined` both mean "no inline gap", and negating either would
    // only churn object identity.
    if (!position.offsetX) continue;
    mirrored ??= positions.slice();
    mirrored[index] = { ...position, offsetX: -position.offsetX };
  }

  return mirrored ?? positions;
}
