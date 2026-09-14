import type { MlvOverflowCandidate, MlvOverflowFit } from './overflow-fit';
import { MLV_FIT_EPSILON_PX, computeHiddenFlags } from './overflow-fit';

/** Collapsible candidates of the given widths. */
function items(...widths: number[]): MlvOverflowCandidate[] {
  return widths.map((width) => ({ width, collapsible: true }));
}

function fit(overrides: Partial<MlvOverflowFit>): boolean[] {
  return computeHiddenFlags({
    candidates: items(100, 100, 100),
    available: 1000,
    gap: 8,
    triggerWidth: 40,
    ...overrides,
  });
}

describe('computeHiddenFlags', () => {
  it('returns no flags for no candidates', () => {
    expect(fit({ candidates: [] })).toEqual([]);
  });

  it('withholds nothing when the row fits, gaps included', () => {
    // 3 × 100 + 2 × 8 = 316.
    expect(fit({ available: 316 })).toEqual([false, false, false]);
  });

  it('does not reserve the trigger when everything fits without it', () => {
    // 316 fits; reserving 40 + 8 for a trigger that would not render would
    // withhold the last item.
    expect(fit({ available: 316, triggerWidth: 40 })).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('counts the gaps: a row that fits only without them overflows', () => {
    // The widths alone sum to 300, which fits 310 — the two gaps do not.
    expect(fit({ available: 310, triggerWidth: 0 })).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('keeps an item that overflows by less than the tolerance', () => {
    expect(fit({ available: 316 - MLV_FIT_EPSILON_PX })).toEqual([
      false,
      false,
      false,
    ]);
    expect(fit({ available: 316 - MLV_FIT_EPSILON_PX - 0.01 })).not.toEqual([
      false,
      false,
      false,
    ]);
  });

  it('reserves the trigger and its gap once something has to go', () => {
    // Budget 250 − (40 + 8) = 202: the first item fits (100), two do not (208).
    expect(fit({ available: 250 })).toEqual([false, true, true]);
  });

  it('reserves nothing for a trigger that is not in the row', () => {
    // Same width, no in-row trigger: two items (208) fit 250.
    expect(fit({ available: 250, triggerWidth: 0 })).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('withholds exactly at the boundary the arithmetic draws, not before it', () => {
    // Two items plus trigger and gaps: 100 + 8 + 100 + 8 + 40 = 256.
    expect(fit({ available: 256 })).toEqual([false, false, true]);
    expect(fit({ available: 255 })).toEqual([false, true, true]);
  });

  it('withholds a suffix: a later narrow item never skips ahead of an earlier wide one', () => {
    const flags = computeHiddenFlags({
      candidates: items(100, 200, 20),
      available: 200,
      gap: 0,
      triggerWidth: 0,
    });
    // 20 would fit after 100, but the row would then have a hole at 200.
    expect(flags).toEqual([false, true, true]);
  });

  it('reserves pinned widths first, wherever the pinned item sits', () => {
    const flags = computeHiddenFlags({
      candidates: [
        { width: 100, collapsible: true },
        { width: 100, collapsible: true },
        { width: 120, collapsible: false },
      ],
      available: 250,
      gap: 0,
      triggerWidth: 20,
    });
    // Budget 230, minus the pinned 120 leaves 110: one collapsible fits.
    expect(flags).toEqual([false, true, false]);
  });

  it('never withholds a pinned item, even when it alone overflows', () => {
    const flags = computeHiddenFlags({
      candidates: [
        { width: 100, collapsible: true },
        { width: 500, collapsible: false },
      ],
      available: 200,
      gap: 0,
      triggerWidth: 20,
    });
    expect(flags).toEqual([true, false]);
  });

  it('withholds every collapsible item when none fits beside the trigger', () => {
    expect(fit({ available: 120 })).toEqual([true, true, true]);
  });

  it('is a pure function of its input — repeated evaluation agrees', () => {
    const input: MlvOverflowFit = {
      candidates: items(90, 110, 70, 130),
      available: 333,
      gap: 6,
      triggerWidth: 32,
    };
    const first = computeHiddenFlags(input);
    for (let i = 0; i < 5; i++) {
      expect(computeHiddenFlags(input)).toEqual(first);
    }
  });
});
