import { describe, expect, it } from 'vitest';
import { isPointerInSafeTriangle } from './submenu-aim';

/** A submenu pane to the right of its trigger row, spanning y 20–180. */
const rightRect = { left: 100, right: 220, top: 20, bottom: 180 };
/** The same pane mirrored to the left of the row. */
const leftRect = { left: 0, right: 120, top: 20, bottom: 180 };

describe('isPointerInSafeTriangle', () => {
  it('protects nothing without an apex', () => {
    expect(isPointerInSafeTriangle({ x: 60, y: 100 }, null, rightRect)).toBe(
      false,
    );
  });

  it('covers the whole straight path to a lower row of the panel', () => {
    // The #345 case: from the row toward the panel's bottom row the path
    // passes below the parent row, where the old slope test compared the
    // pointer to the panel's own top and bottom and read it as "away".
    const anchor = { x: 40, y: 30 };
    for (const t of [0.1, 0.4, 0.7, 0.95]) {
      const point = { x: 40 + (100 - 40) * t, y: 30 + (170 - 30) * t };
      expect(isPointerInSafeTriangle(point, anchor, rightRect)).toBe(true);
    }
  });

  it('covers the whole straight path to an upper row of the panel', () => {
    const anchor = { x: 40, y: 170 };
    for (const t of [0.1, 0.5, 0.9]) {
      const point = { x: 40 + (100 - 40) * t, y: 170 + (30 - 170) * t };
      expect(isPointerInSafeTriangle(point, anchor, rightRect)).toBe(true);
    }
  });

  it('counts the lines to both corners as inside', () => {
    const anchor = { x: 40, y: 100 };
    expect(isPointerInSafeTriangle({ x: 70, y: 60 }, anchor, rightRect)).toBe(
      true,
    );
    expect(isPointerInSafeTriangle({ x: 70, y: 140 }, anchor, rightRect)).toBe(
      true,
    );
  });

  it('rejects points outside the corner lines', () => {
    const anchor = { x: 40, y: 100 };
    expect(isPointerInSafeTriangle({ x: 70, y: 59 }, anchor, rightRect)).toBe(
      false,
    );
    expect(isPointerInSafeTriangle({ x: 70, y: 141 }, anchor, rightRect)).toBe(
      false,
    );
  });

  it('rejects purely vertical travel down the item column', () => {
    // Straight down from the apex has zero width at that x.
    const anchor = { x: 40, y: 100 };
    expect(isPointerInSafeTriangle({ x: 40, y: 130 }, anchor, rightRect)).toBe(
      false,
    );
    expect(isPointerInSafeTriangle({ x: 40, y: 70 }, anchor, rightRect)).toBe(
      false,
    );
  });

  it('rejects movement away from the panel', () => {
    const anchor = { x: 40, y: 100 };
    expect(isPointerInSafeTriangle({ x: 20, y: 100 }, anchor, rightRect)).toBe(
      false,
    );
  });

  it('rejects points past the facing edge', () => {
    const anchor = { x: 40, y: 100 };
    expect(isPointerInSafeTriangle({ x: 101, y: 100 }, anchor, rightRect)).toBe(
      false,
    );
  });

  it('keeps a one-pixel jitter toward the panel inside', () => {
    // The apex is fixed, so a small step from it stays inside as long as it
    // does not leave the triangle — no per-step "progress" to fall short of.
    const anchor = { x: 40, y: 100 };
    expect(isPointerInSafeTriangle({ x: 41, y: 101 }, anchor, rightRect)).toBe(
      true,
    );
  });

  it('finds the facing edge from the geometry when the panel is on the left', () => {
    const anchor = { x: 160, y: 30 };
    for (const t of [0.1, 0.5, 0.9]) {
      const point = { x: 160 + (120 - 160) * t, y: 30 + (170 - 30) * t };
      expect(isPointerInSafeTriangle(point, anchor, leftRect)).toBe(true);
    }
    expect(isPointerInSafeTriangle({ x: 180, y: 30 }, anchor, leftRect)).toBe(
      false,
    );
    expect(isPointerInSafeTriangle({ x: 160, y: 60 }, anchor, leftRect)).toBe(
      false,
    );
  });

  it('protects nothing when the apex overlaps the panel horizontally', () => {
    const anchor = { x: 150, y: 100 };
    expect(isPointerInSafeTriangle({ x: 150, y: 101 }, anchor, rightRect)).toBe(
      false,
    );
    expect(isPointerInSafeTriangle({ x: 160, y: 100 }, anchor, rightRect)).toBe(
      false,
    );
  });
});
