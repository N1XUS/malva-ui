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
   * keyboard-accessible click semantics.
   *
   * A non-`button` role goes **through this input** (`mlv-select` passes
   * `'combobox'`), not into a `role` attribute written beside the directive:
   * this is a host `[attr.role]` binding, so it wins over a static `role` and a
   * `null` here removes it. Pass `null` only when the host's semantics are
   * native — an `<a href>`, a `<button>` — and so cannot be written away.
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
