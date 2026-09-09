import type { ConnectedPosition } from '@angular/cdk/overlay';
import { mlvMirrorInlineOffsets } from './mirror-inline-offsets';

/**
 * #180 — the properties every overlay owner relies on when it hands CDK a
 * mirrored position list. The *geometry* the mirroring produces is pinned
 * end-to-end in `popup.service.spec.ts` and `tooltip.spec.ts`, against the
 * `transform` CDK writes on the pane; what is pinned here is the contract those
 * two inherit.
 */
describe('mlvMirrorInlineOffsets', () => {
  /** A `left-start` popup: the 8px gap points toward the trigger's start edge. */
  const inlineGap: ConnectedPosition = {
    originX: 'start',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'top',
    offsetX: -8,
  };

  /** A `bottom-start` popup: the gap is purely on the block axis. */
  const blockGap: ConnectedPosition = {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: 8,
  };

  it('negates the inline offset in RTL', () => {
    expect(mlvMirrorInlineOffsets([inlineGap], 'rtl')[0].offsetX).toBe(8);
  });

  it('leaves the block offset and every alignment alone', () => {
    const [mirrored] = mlvMirrorInlineOffsets(
      [{ ...inlineGap, offsetY: 4 }],
      'rtl',
    );

    // Only `offsetX` is physical. `originX` / `overlayX` are mirrored by CDK
    // itself against the pane's direction, so mirroring them here would undo it.
    expect(mirrored).toEqual({ ...inlineGap, offsetX: 8, offsetY: 4 });
  });

  it('returns the same array in LTR', () => {
    const positions = [inlineGap, blockGap];

    expect(mlvMirrorInlineOffsets(positions, 'ltr')).toBe(positions);
  });

  it('returns the same array in RTL when no entry carries an inline offset', () => {
    // `MENU_POSITIONS` and `DROPDOWN_POSITIONS` are this shape. CDK
    // deduplicates `positionChanges` by the identity of the chosen
    // `ConnectedPosition`, so a mirrored copy of a list that needs no mirroring
    // would report a position change on every direction flip.
    const positions = [blockGap, { ...blockGap, offsetY: -8 }];

    expect(mlvMirrorInlineOffsets(positions, 'rtl')).toBe(positions);
  });

  it('keeps the identity of the entries it does not have to touch', () => {
    const mirrored = mlvMirrorInlineOffsets([inlineGap, blockGap], 'rtl');

    expect(mirrored[1]).toBe(blockGap);
    expect(mirrored[0]).not.toBe(inlineGap);
  });

  it('treats a zero offset as no gap rather than producing -0', () => {
    const zero: ConnectedPosition = { ...blockGap, offsetX: 0 };
    const positions = [zero];

    // `-0` would serialise as `translateX(0px)` all the same, but it would
    // cost the entry its identity for no change in geometry.
    expect(mlvMirrorInlineOffsets(positions, 'rtl')).toBe(positions);
  });

  it('never mutates the list it is given', () => {
    // Every caller passes a shared, module-level constant — `TOOLTIP_POSITIONS`,
    // `SUBMENU_POSITIONS`, an entry of `POPUP_POSITION_MAP` — so a mutation
    // would leak into every later overlay, in either direction.
    const positions = [{ ...inlineGap }, { ...blockGap }];
    const before = positions.map((position) => ({ ...position }));

    mlvMirrorInlineOffsets(positions, 'rtl');

    expect(positions).toEqual(before);
  });

  it('is its own inverse', () => {
    const positions = [inlineGap, blockGap];

    expect(
      mlvMirrorInlineOffsets(mlvMirrorInlineOffsets(positions, 'rtl'), 'rtl'),
    ).toEqual(positions);
  });
});
