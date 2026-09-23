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

  /**
   * @private Ids of the `mlv-drawer-header` titles currently registered as
   * the drawer's label, in registration order.
   */
  private readonly _labelIds: string[] = [];

  /**
   * @private The panel's `aria-label` before a header title replaced it — the
   * i18n fallback `MlvDrawerService` writes at open. Restored when the last
   * title withdraws, so the `role="dialog"` is never left nameless.
   */
  private _fallbackLabel: string | null = null;

  /**
   * @internal The overlay pane the drawer renders into. `mlv-drawer-header`
   * checks it to tell a service-opened drawer from a declarative one it is
   * nested in.
   */
  get _paneElement(): HTMLElement | null {
    return this._overlayRef.overlayElement ?? null;
  }

  constructor(
    overlayRef: OverlayRef,
    /** @private The edge the drawer slides from. */
    private readonly _position = 'right',
    /**
     * @private Configured close-animation duration in milliseconds. Stored but
     * read by nothing — the close is timed by the panel's `animationend` or
     * `_leaveFallbackMs` (#277).
     */
    private readonly _animationDuration = 300,
  ) {
    super(overlayRef);
  }

  /**
   * @internal Registers a header title `id` in the panel's `aria-labelledby`.
   * Used by `mlv-drawer-header` so a service-opened drawer is named by its
   * visible title.
   */
  _labelBy(id: string): void {
    if (!this._labelIds.includes(id)) {
      this._labelIds.push(id);
    }
    this._applyLabel();
  }

  /** @internal Reverses {@link _labelBy} when the header title empties or is destroyed. */
  _unlabelBy(id: string): void {
    const index = this._labelIds.indexOf(id);
    if (index === -1) {
      return;
    }
    this._labelIds.splice(index, 1);
    this._applyLabel();
  }

  /**
   * @private Writes the registered ids onto the drawer panel — the
   * `role="dialog"` element inside the pane — as `aria-labelledby`, parking
   * its `aria-label` meanwhile (the two must never coexist), and swaps them
   * back when the last id withdraws.
   */
  private _applyLabel(): void {
    const panelEl = this._panelElement;
    if (!panelEl) {
      return;
    }
    if (this._labelIds.length) {
      this._fallbackLabel ??= panelEl.getAttribute('aria-label');
      panelEl.removeAttribute('aria-label');
      panelEl.setAttribute('aria-labelledby', this._labelIds.join(' '));
    } else {
      panelEl.removeAttribute('aria-labelledby');
      if (this._fallbackLabel !== null) {
        panelEl.setAttribute('aria-label', this._fallbackLabel);
      }
    }
  }
}
