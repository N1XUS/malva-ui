import type { AfterViewInit } from '@angular/core';
import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvTabbableElementService } from '@malva-ui/cdk/accessibility';

@Directive({
  selector: '[mlvAutofocus]',
})
export class MlvAutofocus implements AfterViewInit {
  readonly mlvAutofocus = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  readonly focusLast = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @private Set to `true` after `ngAfterViewInit`; gates the focus effect. */
  private readonly _initComplete = signal(false);

  /** @private Host element reference — the root of the tabbable-element search. */
  private readonly _elmRef = inject(ElementRef);

  /** @private Service used to locate the first/last tabbable descendant. */
  private readonly _tabbableService = inject(MlvTabbableElementService);

  constructor() {
    effect(() => {
      const enabled = this.mlvAutofocus() && this._initComplete();

      if (enabled) {
        this._focus();
      }
    });
  }

  ngAfterViewInit(): void {
    this._initComplete.set(true);
  }

  /**
   * @hidden
   * Searches for an appropriate focusable element
   */
  private _getFocusableElement(): HTMLElement | null {
    return this._tabbableService.getTabbableElement(
      this._elmRef.nativeElement,
      !!this.focusLast(),
    );
  }

  /** @hidden */
  private _focus(): void {
    if (!this.mlvAutofocus()) {
      return;
    }
    const elm = this._getFocusableElement();
    elm?.focus();
  }
}
