import type { OnDestroy, OnInit } from '@angular/core';
import { Directive, ElementRef, inject, input } from '@angular/core';
import type { MlvInternalBaseToast } from './toast.types';
import { MLV_TOAST_CLOSE } from './toast.types';
import type { MlvIAbstractToastComponent } from './abstract-toast-container';
import { MlvToastTimer } from './toast-timer';

@Directive()
export abstract class MlvAbstractToastItem<
    T extends MlvInternalBaseToast = MlvInternalBaseToast,
  >
  implements MlvIAbstractToastComponent<T>, OnInit, OnDestroy
{
  toast = input.required<T>();

  /** @protected Auto-dismiss countdown timer for this toast item. */
  protected readonly timer = new MlvToastTimer();

  /** @protected Dismiss callback that closes this item by id. */
  protected readonly _dismiss = inject(MLV_TOAST_CLOSE);

  /**
   * @protected Host element ref, used to detect whether focus stays within the
   * item when handling `focusout` (so intra-item focus moves do not resume the
   * timer prematurely).
   */
  protected readonly _elementRef = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    if (this.toast().displayTime > 0) {
      this.timer.start(this.toast().displayTime, () => this.onClose());
    }
  }

  ngOnDestroy(): void {
    this.timer.clear();
  }

  /** @protected Closes this toast item via the injected dismiss callback. */
  protected onClose(): void {
    this._dismiss(this.toast().id);
  }

  /** @protected Pauses the auto-dismiss timer on pointer enter when `pauseOnHover` is set. */
  protected onMouseEnter(): void {
    if (this.toast().pauseOnHover) {
      this.timer.pause();
    }
  }

  /** @protected Resumes the auto-dismiss timer on pointer leave. */
  protected onMouseLeave(): void {
    this._resumeTimer();
  }

  /**
   * @protected Pauses the auto-dismiss timer when keyboard focus enters the
   * item, so keyboard users are not raced by the countdown (WCAG 2.2.1).
   */
  protected onFocusIn(): void {
    if (this.toast().pauseOnHover) {
      this.timer.pause();
    }
  }

  /**
   * @protected Resumes the auto-dismiss timer when focus leaves the item
   * entirely. Focus moves between elements inside the same item are ignored.
   */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this._elementRef.nativeElement.contains(next)) {
      return;
    }
    this._resumeTimer();
  }

  /**
   * @private Restarts the countdown from the full `displayTime` when pausing is
   * enabled and the item is auto-dismissable.
   */
  private _resumeTimer(): void {
    if (this.toast().pauseOnHover && this.toast().displayTime > 0) {
      this.timer.start(this.toast().displayTime, () => this.onClose());
    }
  }
}
