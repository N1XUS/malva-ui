import { Directive, ElementRef, inject } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { MlvResizeObserverService } from './resize-observer.service';

@Directive({
  selector: '[mlvResizeObserver]',
  exportAs: 'mlvResizeObserver',
})
export class MlvResizeObserver {
  /**
   * The reference to the Resize target element.
   **/
  readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);

  /**
   * Observable that emits when the element is resized.
   * Use this for programmatic subscriptions.
   **/
  readonly resizeEvents$ = inject(MlvResizeObserverService).observe(
    this.elementRef.nativeElement,
  );

  /**
   * When the element is resized, emits an array of ResizeObserverEntry objects.
   **/
  readonly resized = outputFromObservable(this.resizeEvents$);
}
