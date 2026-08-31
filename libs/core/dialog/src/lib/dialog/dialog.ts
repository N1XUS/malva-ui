import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  ViewEncapsulation,
} from '@angular/core';

import { DIALOG_CONFIG } from '../dialog-config';
import { injectDialogRef } from '../inject-dialog-ref';

/**
 * The dialog surface — root of every dialog's content, whether the dialog was
 * opened from a template, a component, a string, `confirm()`, or a route.
 *
 * Projects its children (`mlv-dialog-header`, `mlv-dialog-body`,
 * `mlv-dialog-footer`, anything else) and mirrors the ref's animation state as
 * `--enter` / `--leave` so the global dialog keyframes run on it. Consumer
 * `class="…"` lands here; `MlvDialogConfig.panelClass` styles the overlay pane.
 */
@Component({
  selector: 'mlv-dialog',
  template: '<ng-content />',
  styleUrl: './dialog.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-dialog',
    '[class.mlv-dialog--confirm]': "_config.appearance === 'confirm'",
    '[class.mlv-dialog--enter]': "_ref.animationState() === 'enter'",
    '[class.mlv-dialog--leave]': "_ref.animationState() === 'leave'",
    '(animationend)': '_onAnimationEnd($event)',
  },
})
export class MlvDialog {
  /** @protected The dialog this surface belongs to. */
  protected readonly _ref = injectDialogRef('mlv-dialog');
  /** @protected Per-open configuration; `appearance` drives the confirm modifier. */
  protected readonly _config = inject(DIALOG_CONFIG);
  /** @private Host element, used to ignore `animationend` bubbling from descendants. */
  private readonly _host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** @protected Hands the surface's own animation end to the ref (enter → idle, leave → dispose). */
  protected _onAnimationEnd(event: Event): void {
    if (event.target === this._host) {
      this._ref._onSurfaceAnimationEnd();
    }
  }
}
