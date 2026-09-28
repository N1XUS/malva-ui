import type { MlvOverflowCandidate, MlvOverflowFit } from './overflow-types';
import {
  MLV_FIT_EPSILON_PX,
  mlvComputeHiddenFlags,
  mlvCssPx,
  mlvInlineContentSize,
} from './overflow-fit';

/** Collapsible candidates of the given widths. */
function items(...widths: number[]): MlvOverflowCandidate[] {
  return widths.map((width) => ({ width, collapsible: true }));
}

function fit(overrides: Partial<MlvOverflowFit>): boolean[] {
  return mlvComputeHiddenFlags({
    candidates: items(100, 100, 100),
    available: 1000,
    gap: 8,
    triggerWidth: 40,
    ...overrides,
  });
}

describe('mlvComputeHiddenFlags', () => {
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

  // Fractional rect widths do not sum exactly: 10.1 + 16.1 is
  // 26.200000000000003 in binary floating point, over a row measured at
  // exactly 26.2. The tolerance is what keeps the second item.
  it('absorbs floating-point error in a row that fits exactly', () => {
    expect(10.1 + 16.1).toBeGreaterThan(26.2);
    expect(
      mlvComputeHiddenFlags({
        candidates: items(10.1, 16.1),
        available: 26.2,
        gap: 0,
        triggerWidth: 10,
      }),
    ).toEqual([false, false]);
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

  // #358's table: a boxed tab track of 5 × 100px tabs with 3px of padding
  // either side and 2px gaps. At border-box width W the content box is
  // W − 6 and the row needs 5 × 100 + 4 × 2 = 508, so all five need W ≥ 514.
  describe('boxed tab track, 5 × 100px (#358)', () => {
    const track = (borderBox: number): boolean[] =>
      mlvComputeHiddenFlags({
        candidates: items(100, 100, 100, 100, 100),
        available: borderBox - 6,
        gap: 2,
        triggerWidth: 60,
      });

    it.each([505, 510, 513])('withholds the last tab at W = %ipx', (width) => {
      expect(track(width)).toEqual([false, false, false, false, true]);
    });

    it('keeps all five at W = 514px, the exact boundary', () => {
      expect(track(514)).toEqual([false, false, false, false, false]);
    });
  });

  it('withholds a suffix: a later narrow item never skips ahead of an earlier wide one', () => {
    const flags = mlvComputeHiddenFlags({
      candidates: items(100, 200, 20),
      available: 200,
      gap: 0,
      triggerWidth: 0,
    });
    // 20 would fit after 100, but the row would then have a hole at 200.
    expect(flags).toEqual([false, true, true]);
  });

  it('reserves pinned widths first, wherever the pinned item sits', () => {
    const flags = mlvComputeHiddenFlags({
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
    const flags = mlvComputeHiddenFlags({
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
    const first = mlvComputeHiddenFlags(input);
    for (let i = 0; i < 5; i++) {
      expect(mlvComputeHiddenFlags(input)).toEqual(first);
    }
  });
});

describe('mlvCssPx', () => {
  it('parses a px length', () => {
    expect(mlvCssPx('3px')).toBe(3);
    expect(mlvCssPx('0.5px')).toBe(0.5);
  });

  it('reads `normal` and an empty value as zero', () => {
    expect(mlvCssPx('normal')).toBe(0);
    expect(mlvCssPx('')).toBe(0);
  });
});

describe('mlvInlineContentSize', () => {
  const styles = (
    paddingStart: string,
    paddingEnd: string,
    borderStart: string,
    borderEnd: string,
  ) =>
    ({
      paddingInlineStart: paddingStart,
      paddingInlineEnd: paddingEnd,
      borderInlineStartWidth: borderStart,
      borderInlineEndWidth: borderEnd,
    }) as CSSStyleDeclaration;

  it('subtracts the inline padding and border from the border box', () => {
    expect(mlvInlineContentSize(505, styles('3px', '3px', '0px', '0px'))).toBe(
      499,
    );
    expect(mlvInlineContentSize(200, styles('4px', '6px', '1px', '2px'))).toBe(
      187,
    );
  });

  it('treats unresolved values as zero', () => {
    expect(mlvInlineContentSize(120.5, styles('', '', '', ''))).toBe(120.5);
  });
});
