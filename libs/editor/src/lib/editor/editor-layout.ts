import type { MlvEditorToolbarPosition } from '../editor.types';

/**
 * @internal Resolves an `MlvEditor` sizing input to the value its custom
 * property receives, or `null` to write nothing.
 *
 * A finite number is px, matching `mlv-popup`. A string passes through
 * verbatim once trimmed, so any CSS length, `calc()`, `min()` or viewport unit
 * works. `undefined`, `null`, a blank string and a non-finite number all
 * resolve to `null`, so the host binding removes the property and the
 * stylesheet's `var()` fallback applies.
 */
export function mlvEditorCssLength(
  value: number | string | null | undefined,
): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${value}px` : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return null;
}

/** @internal ProseMirror's own default `scrollMargin`, in px (prosemirror-view `scrollRectIntoView`). */
export const MLV_EDITOR_SCROLL_MARGIN = 5;

/** @internal Per-side px lengths in the shape ProseMirror's scroll props accept. */
export interface MlvEditorScrollSides {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * @internal ProseMirror `scrollMargin` / `scrollThreshold` for a toolbar that
 * obscures `obscured` px on its own side (WCAG 2.2 SC 2.4.11). The threshold is
 * the obscured extent: ProseMirror scrolls only once the caret enters it. The
 * margin leaves the default 5px beyond it. Every other side keeps
 * ProseMirror's defaults.
 */
export function mlvEditorScrollSides(
  kind: 'margin' | 'threshold',
  position: MlvEditorToolbarPosition,
  obscured: number,
): MlvEditorScrollSides {
  const base = kind === 'margin' ? MLV_EDITOR_SCROLL_MARGIN : 0;
  const edge = base + Math.max(0, Math.ceil(obscured));
  return {
    top: position === 'top' ? edge : base,
    right: base,
    bottom: position === 'bottom' ? edge : base,
    left: base,
  };
}

/**
 * @internal A scroll-prop object whose sides re-resolve on every read.
 * ProseMirror reads `value[side]` lazily each time it scrolls a rect into view
 * (`getSide()` in prosemirror-view), so one stable object follows density,
 * configuration and consumer CSS offsets without `setProps` churn. Only the
 * toolbar's side measures anything.
 */
export function createMlvEditorLiveScrollSides(
  kind: 'margin' | 'threshold',
  position: () => MlvEditorToolbarPosition,
  obscured: () => number,
): MlvEditorScrollSides {
  const base = kind === 'margin' ? MLV_EDITOR_SCROLL_MARGIN : 0;
  const side = (which: MlvEditorToolbarPosition) =>
    position() === which
      ? mlvEditorScrollSides(kind, which, obscured())[which]
      : base;
  return {
    get top() {
      return side('top');
    },
    get right() {
      return base;
    },
    get bottom() {
      return side('bottom');
    },
    get left() {
      return base;
    },
  };
}
