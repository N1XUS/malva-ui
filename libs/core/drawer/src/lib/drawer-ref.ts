import type { OverlayRef } from '@angular/cdk/overlay';
import { MlvOverlayRef } from '@malva-ui/cdk/overlay';

/**
 * Reference to an imperatively opened drawer; exposes `close()`, `afterClosed()`,
 * and `beforeClose()`.
 *
 * Thin subclass of {@link MlvOverlayRef} that supplies the drawer surface's
 * leave-animation class names and fallback duration; all close/afterClosed/
 * beforeClose logic is inherited.
 *
 * @typeParam R - The result type emitted by `afterClosed()`. Defaults to `unknown`.
 */
export class MlvDrawerRef<R = unknown> extends MlvOverlayRef<R> {
  /** @protected Backdrop leave-animation class for drawers. */
  protected override readonly _backdropLeavingClass =
    'mlv-drawer-backdrop--leaving';
  /** @protected Panel leave-animation class for drawers. */
  protected override readonly _panelLeaveClass = 'mlv-drawer--leave';
  /** @protected Fallback close-animation duration (ms) for drawers. */
  protected override readonly _leaveFallbackMs = 350;

  constructor(
    overlayRef: OverlayRef,
    /** @private The edge the drawer slides from. */
    private readonly _position = 'right',
    /** @private Configured close-animation duration in milliseconds. */
    private readonly _animationDuration = 300,
  ) {
    super(overlayRef);
  }
}
