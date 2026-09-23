import type { MlvDrawerPosition } from '../drawer.service';

/**
 * @internal Inputs the drawer panel's inline geometry is resolved from. The
 * same fields on `MlvDrawer` and `MlvDrawerConfig`, so both open paths size
 * the panel through one function.
 */
export interface DrawerPanelGeometryOptions {
  /** Edge the drawer slides from; decides which axis `size` sizes. */
  position: MlvDrawerPosition;
  /** Sizing-axis size while the drawer is not resizable. */
  size: string;
  /** Whether the panel opens at `defaultSnap` and follows the drag handle. */
  resizable: boolean;
  /** Initial viewport percentage of a resizable panel. */
  defaultSnap: number;
  /** Floor on the sizing axis; `'0px'` is no floor. */
  minSize: string;
  /** Ceiling on the sizing axis; `'100%'` is no ceiling beyond the viewport. */
  maxSize: string;
}

/**
 * @internal Transform that parks the panel beyond its edge — the start of the
 * shared `drawer-enter` keyframes and the end of `drawer-leave`
 * (`libs/styles/src/lib/animations.scss`), fed through
 * `--mlv-drawer-hidden-transform`.
 */
export const DRAWER_HIDDEN_TRANSFORMS: Record<MlvDrawerPosition, string> = {
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
};

/**
 * @internal Combines a ceiling with the viewport ceiling for the sizing axis.
 *
 * The viewport ceiling is unconditional: without it a fixed `size` larger than
 * the screen (`size="36rem"` on a 375 px phone) renders a panel that hangs off
 * the edge. `maxSize` is folded in through CSS `min()` so it is honoured on the
 * non-resizable path too. The `'100%'` default is dropped rather than nested —
 * it resolves against the overlay pane, which is itself sized by the panel, so
 * it would add nothing but an indirection.
 */
function resolveMaxSize(maxSize: string, viewportCeiling: string): string {
  return !maxSize || maxSize === '100%'
    ? viewportCeiling
    : `min(${maxSize}, ${viewportCeiling})`;
}

/**
 * @internal Combines `minSize` with the viewport ceiling for the sizing axis.
 *
 * `min-width` / `min-height` beat `max-*`, so an unclamped floor would undo the
 * viewport clamp above. The `'0px'` default is passed through bare.
 */
function resolveMinSize(minSize: string, viewportCeiling: string): string {
  return !minSize || minSize === '0px'
    ? '0px'
    : `min(${minSize}, ${viewportCeiling})`;
}

/**
 * @internal Resolves the panel's inline geometry: the sizing-axis size, the
 * cross-axis viewport fill, the `minSize` floor on the sizing axis and the max
 * ceilings on both axes.
 *
 * A resizable panel opens at `defaultSnap` as a `dvh` / `dvw` percentage and
 * reads its live size from `--mlv-drawer-current-size`, which
 * `MlvDrawerResize` writes on the panel while the user drags; a fixed panel
 * uses `size`.
 */
export function resolveDrawerPanelDimensions(
  options: DrawerPanelGeometryOptions,
): Record<string, string> {
  const { position, resizable } = options;
  const isVertical = position === 'top' || position === 'bottom';
  const initial = resizable
    ? `${options.defaultSnap}${isVertical ? 'dvh' : 'dvw'}`
    : options.size;
  const size = resizable
    ? `var(--mlv-drawer-current-size, ${initial})`
    : initial;

  if (!isVertical) {
    return {
      width: size,
      height: '100dvh',
      minWidth: resolveMinSize(options.minSize, '100dvw'),
      maxWidth: resolveMaxSize(options.maxSize, '100dvw'),
      maxHeight: '100dvh',
    };
  }
  return {
    height: size,
    width: '100dvw',
    minHeight: resolveMinSize(options.minSize, '100dvh'),
    maxHeight: resolveMaxSize(options.maxSize, '100dvh'),
    maxWidth: '100dvw',
  };
}
