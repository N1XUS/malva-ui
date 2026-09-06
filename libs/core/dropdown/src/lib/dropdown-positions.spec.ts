import { DROPDOWN_POSITIONS } from './dropdown-positions';

/**
 * #154 — the list every option panel is positioned with. The geometry it
 * produces is pinned end-to-end in `select.spec.ts`, `combobox.spec.ts` and
 * `autocomplete.spec.ts`; what is pinned here is the contract those three
 * inherit by sharing it.
 */
describe('DROPDOWN_POSITIONS', () => {
  it('offers both inline alignments on both sides of the block axis', () => {
    expect(
      DROPDOWN_POSITIONS.map(
        (p) => `${p.overlayX}/${p.originX} ${p.overlayY}/${p.originY}`,
      ),
    ).toEqual([
      // Below, anchored to the field's inline-start edge — preferred.
      'start/start top/bottom',
      // Above, same inline anchor — the block-axis flip.
      'start/start bottom/top',
      // Below, anchored to the field's inline-end edge — the inline fallback.
      'end/end top/bottom',
      // Above, inline-end anchored — both axes flipped.
      'end/end bottom/top',
    ]);
  });

  it('keeps the start-aligned pair first so a field with room is unaffected', () => {
    // CDK applies the first position that fits the viewport outright, so the
    // fallbacks are only reachable once the preferred pair has been rejected.
    // This pins the shape; the *behaviour* the order buys is pinned in
    // `select.spec.ts` — "prefers the start-aligned position on list order
    // alone when both inline candidates fit", the one case geometry cannot
    // decide on its own.
    expect(
      DROPDOWN_POSITIONS.slice(0, 2).every((p) => p.overlayX === 'start'),
    ).toBe(true);
  });

  it('uses logical alignment names only, so CDK mirrors them in RTL', () => {
    const names = DROPDOWN_POSITIONS.flatMap((p) => [p.originX, p.overlayX]);

    expect(names.every((name) => name === 'start' || name === 'end')).toBe(
      true,
    );
  });

  it('puts the trigger gap on the block axis and declares no offsetX', () => {
    // `offsetX` is physical: CDK adds it as raw pixels and never flips it in
    // RTL, so an `end`-aligned entry would silently need the opposite sign
    // from its `start`-aligned twin. `offsetY` means the same in both.
    expect(DROPDOWN_POSITIONS.map((p) => p.offsetX)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(DROPDOWN_POSITIONS.map((p) => p.offsetY)).toEqual([8, -8, 8, -8]);
  });
});
