import {
  mlvCarrySplitPaneSizes,
  mlvInitialSplitPaneSizes,
} from './split-pane-sizes';

/**
 * #359 — the size arithmetic behind a change to the panel list, pinned
 * without the DOM so a regression in heir or donor order reads as a number,
 * not as a grid-template string.
 */

interface FakePanel {
  readonly id: string;
  size(): number | undefined;
  minSize(): number;
}

function panel(id: string, size?: number, minSize = 5): FakePanel {
  return { id, size: () => size, minSize: () => minSize };
}

/** Rounds to two decimals so float noise cannot fail an exact comparison. */
function round(sizes: number[]): number[] {
  return sizes.map((s) => Math.round(s * 100) / 100);
}

describe('mlvInitialSplitPaneSizes', () => {
  it('keeps explicit sizes and shares the remainder equally', () => {
    expect(
      round(mlvInitialSplitPaneSizes([panel('a', 30), panel('b'), panel('c')])),
    ).toEqual([30, 35, 35]);
  });
});

describe('mlvCarrySplitPaneSizes', () => {
  it('gives a removed first panel’s size to the panel after it', () => {
    const a = panel('a', 20);
    const b = panel('b', 30);
    const c = panel('c');

    expect(mlvCarrySplitPaneSizes([a, b, c], [20, 30, 50], [b, c])).toEqual([
      50, 50,
    ]);
  });

  it('gives a removed panel’s size to the panel before it when there is one', () => {
    const a = panel('a', 20);
    const b = panel('b', 30);
    const c = panel('c');

    expect(mlvCarrySplitPaneSizes([a, b, c], [20, 30, 50], [a, c])).toEqual([
      50, 50,
    ]);
  });

  it('restores the layout exactly when a removed panel is added back', () => {
    const a = panel('a', 20);
    const b = panel('b', 30);
    const c = panel('c');

    const without = mlvCarrySplitPaneSizes([a, b, c], [20, 30, 50], [a, c]);
    expect(mlvCarrySplitPaneSizes([a, c], without, [a, b, c])).toEqual([
      20, 30, 50,
    ]);
  });

  it('gives an added panel nothing — below its own minSize — when every donor is at its floor', () => {
    // The donors win: taking a donor below its floor is what the floor
    // forbids, and nothing else can pay for the added panel.
    const a = panel('a', undefined, 60);
    const b = panel('b', undefined, 40);
    const c = panel('c', undefined, 10);

    expect(mlvCarrySplitPaneSizes([a, b], [60, 40], [a, b, c])).toEqual([
      60, 40, 0,
    ]);
  });

  it('gives an added panel only what the donors can give above their floors', () => {
    const a = panel('a', undefined, 45);
    const b = panel('b', undefined, 45);
    const c = panel('c', 20);

    // b is nearest before c and gives 5; a gives the next 5.
    expect(mlvCarrySplitPaneSizes([a, b], [50, 50], [a, b, c])).toEqual([
      45, 45, 10,
    ]);
  });

  it('starts over from the inputs when the previous list was not split (2 → 1 → 2)', () => {
    const a = panel('a', 30);
    const b = panel('b');

    // Down to one panel: it inherits everything.
    expect(mlvCarrySplitPaneSizes([a, b], [60, 40], [a])).toEqual([100]);
    // Back to two: a single panel was never split, so nothing is carried and
    // the dragged 60 / 40 is not restored — the inputs are read again.
    expect(round(mlvCarrySplitPaneSizes([a], [100], [a, b]))).toEqual([30, 70]);
  });

  it('keeps the total when panels are removed and added in one change', () => {
    const a = panel('a', 25);
    const b = panel('b', 25);
    const c = panel('c', 25);
    const d = panel('d', 25);
    const e = panel('e');

    const sizes = mlvCarrySplitPaneSizes(
      [a, b, c, d],
      [25, 25, 25, 25],
      [a, c, e, d],
    );
    expect(round([sizes.reduce((sum, s) => sum + s, 0)])).toEqual([100]);
  });
});
