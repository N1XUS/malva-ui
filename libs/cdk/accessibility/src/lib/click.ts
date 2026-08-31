import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
  Renderer2,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge, Subject } from 'rxjs';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

@Directive({
  selector: '[mlvClick]',
  host: {
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[attr.role]': 'hostRole() || null',
  },
})
export class MlvClick {
  /**
   * When `true`, sets `tabindex="-1"` so the element is removed from the tab
   * order. The `mlvClick` output is not suppressed by this flag at the
   * directive level — the consumer should gate logic if needed.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * ARIA role applied to the host element. Defaults to `'button'` for
   * keyboard-accessible click semantics. Set to `null` when the host
   * already has an appropriate semantic role (e.g. `role="combobox"`).
   */
  readonly hostRole = input<string | null>('button');

  /** Emits on native click, Enter keydown, or Space keydown. */
  readonly mlvClick = output<MouseEvent | KeyboardEvent>();

  /**
   * @protected The host `ElementRef`, used to attach keyboard/click listeners
   * and as the click event source.
   */
  protected readonly _elementRef = inject(ElementRef);

  constructor() {
    const renderer = inject(Renderer2);
    const destroyRef = inject(DestroyRef);
    const enter$ = new Subject<KeyboardEvent>();
    const space$ = new Subject<KeyboardEvent>();

    destroyRef.onDestroy(
      renderer.listen(this._elementRef.nativeElement, 'keydown.enter', (e) =>
        enter$.next(e),
      ),
    );
    destroyRef.onDestroy(
      renderer.listen(this._elementRef.nativeElement, 'keydown.space', (e) =>
        space$.next(e),
      ),
    );

    destroyRef.onDestroy(() => {
      enter$.complete();
      space$.complete();
    });

    // Subscribe to merged events and emit through output. Cleanup is handled
    // automatically by takeUntilDestroyed().
    merge(
      fromEvent<MouseEvent>(this._elementRef.nativeElement, 'click'),
      enter$,
      space$,
    )
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        this.mlvClick.emit(event);
      });
  }
}
