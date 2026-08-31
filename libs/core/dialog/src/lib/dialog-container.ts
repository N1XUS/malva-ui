import { CdkDialogContainer, DialogConfig } from '@angular/cdk/dialog';
import { CdkPortalOutlet } from '@angular/cdk/portal';
import { _getFocusedElementPierceShadowDom } from '@angular/cdk/platform';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
  ViewEncapsulation,
} from '@angular/core';
import { MlvOverlayInitialFocusResolver } from '@malva-ui/cdk/overlay';

import {
  DIALOG_CONFIG,
  type MlvDialogRestoreFocusTarget,
} from './dialog-config';

/**
 * @internal Malva's CDK dialog container: focus trap, ARIA attributes and
 * focus restore come from `CdkDialogContainer`; this subclass adds Malva's
 * `initialFocus` strategy on top of the CDK's container focus and restates the
 * host bindings. Ivy does inherit host bindings and attributes from a
 * superclass, so that restatement is belt-and-braces — it mirrors what Angular
 * Material's `MatDialogContainer` does, and keeps the contract visible next to
 * the styles that depend on it.
 *
 * **Deliberate exception to the repo's "OnPush on every library component"
 * rule:** `changeDetection` is `Eager`, matching `CdkDialogContainer` and
 * `MatDialogContainer`. This container's view is the change-detection parent of
 * arbitrary consumer content (the portal outlet's `ViewContainerRef` lives in
 * it), so an OnPush, non-dirty container would skip refreshing embedded or
 * component content whose bindings are driven by non-signal, zone-based state.
 *
 * Not exported — `MlvDialogService` passes it as `DialogConfig.container`.
 */
@Component({
  selector: 'mlv-dialog-container',
  template: '<ng-template cdkPortalOutlet />',
  imports: [CdkPortalOutlet],
  styleUrl: './dialog-container.scss',
  encapsulation: ViewEncapsulation.None,
  // See the class docs: Eager, not OnPush, because this view is the CD parent
  // of arbitrary consumer content — the same reason CdkDialogContainer and
  // MatDialogContainer are Eager.
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    class: 'mlv-dialog-container',
    tabindex: '-1',
    '[attr.id]': '_config.id || null',
    '[attr.role]': '_config.role',
    '[attr.aria-modal]': '_config.ariaModal',
    '[attr.aria-labelledby]':
      '_config.ariaLabel ? null : _ariaLabelledByQueue[0]',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
  },
})
export class MlvDialogContainer extends CdkDialogContainer {
  /** @private The consumer's Malva config for initial and dynamic restore focus. */
  private readonly _mlvConfig = inject(DIALOG_CONFIG);
  /** @private The mutable CDK config consumed by the inherited destroy hook. */
  private readonly _cdkConfig = inject(DialogConfig);
  /** @private The opener captured before the CDK moves focus into this dialog. */
  private readonly _capturedOpener = _getFocusedElementPierceShadowDom();
  /** @private Shared overlay initial-focus strategy (`'auto'` skips the close button and scroll viewport). */
  private readonly _initialFocus = inject(MlvOverlayInitialFocusResolver);
  /** @private Injector for `afterNextRender` (the CDK's own is private). */
  private readonly _hostInjector = inject(Injector);
  /** @private Set on destroy so a pending focus callback becomes a no-op. */
  private _destroyed = false;

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => (this._destroyed = true));
  }

  /**
   * @protected The CDK first focuses the container (`autoFocus: 'dialog'`,
   * emitting `_focusTrapped` so the CDK hides the rest of the page from AT),
   * then — after the same render, before paint — Malva moves focus to the
   * resolved `initialFocus` target.
   */
  protected override _captureInitialFocus(): void {
    super._captureInitialFocus();
    afterNextRender(
      () => {
        if (this._destroyed) {
          return;
        }
        this._initialFocus.focus(
          this._elementRef.nativeElement,
          this._mlvConfig.initialFocus ?? 'auto',
        );
      },
      { injector: this._hostInjector },
    );
  }

  /**
   * Resolves a dynamic restore-focus policy at actual disposal, then delegates
   * the focus operation and focus-trap cleanup to the Angular CDK.
   */
  override ngOnDestroy(): void {
    const restoreFocus = this._mlvConfig.restoreFocus;
    if (typeof restoreFocus === 'function') {
      try {
        this._cdkConfig.restoreFocus =
          this._connectedRestoreTarget(restoreFocus());
      } catch {
        // Consumer code must not abort the CDK/overlay disposal lifecycle.
        this._cdkConfig.restoreFocus = false;
      }
    }
    // Keep CDK teardown outside the consumer-error boundary so its own errors
    // remain observable instead of being mistaken for resolver failures.
    super.ngOnDestroy();
  }

  /** @private Prevents a dynamic policy from focusing a detached element. */
  private _connectedRestoreTarget(
    target: MlvDialogRestoreFocusTarget,
  ): MlvDialogRestoreFocusTarget {
    if (target === true) {
      return this._capturedOpener?.isConnected ? this._capturedOpener : false;
    }
    if (target === false || typeof target === 'string') {
      return target;
    }
    return target.isConnected ? target : false;
  }
}
