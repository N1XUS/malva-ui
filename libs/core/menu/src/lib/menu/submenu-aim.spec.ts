import { describe, expect, it } from 'vitest';
import {
  isCursorHeadingToSubmenu,
  type MlvSubmenuAimState,
} from './submenu-aim';

const rect = {
  left: 100,
  right: 220,
  top: 20,
  bottom: 180,
} as DOMRect;

describe('isCursorHeadingToSubmenu', () => {
  const rightState: MlvSubmenuAimState = {
    lastX: 40,
    lastY: 100,
    submenuRect: rect,
    side: 'right',
    cursorEnteredSubmenu: false,
  };

  it('accepts a pointer trajectory inside the safe triangle', () => {
    expect(isCursorHeadingToSubmenu(70, 110, rightState)).toBe(true);
  });

  it('rejects movement away from a right-side submenu', () => {
    expect(isCursorHeadingToSubmenu(20, 100, rightState)).toBe(false);
  });

  it('rejects purely vertical travel down the item column', () => {
    // The reported bug: sliding straight down from the item's far edge toward the
    // next item. `deltaX === 0` is not movement *away* from the submenu, and the
    // cone from x=40 to a panel spanning y 20–180 is wide enough to swallow the
    // trajectory, so this used to read as "heading to submenu" and kept the panel
    // open while the cursor sat on a sibling row.
    expect(isCursorHeadingToSubmenu(40, 130, rightState)).toBe(false);
    expect(isCursorHeadingToSubmenu(40, 70, rightState)).toBe(false);
  });

  it('rejects sub-pixel horizontal jitter', () => {
    // A 1px twitch is not aim. The grace timer, not the cone, is what protects
    // the user here.
    expect(isCursorHeadingToSubmenu(41, 101, rightState)).toBe(false);
  });

  it('mirrors direction handling for a left-side submenu', () => {
    const leftState = { ...rightState, lastX: 260, side: 'left' as const };
    expect(isCursorHeadingToSubmenu(230, 100, leftState)).toBe(true);
    expect(isCursorHeadingToSubmenu(280, 100, leftState)).toBe(false);
  });
});
