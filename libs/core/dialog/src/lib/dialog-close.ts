import { computed, Directive, ElementRef, inject, input } from '@angular/core';

import { injectDialogRef } from './inject-dialog-ref';

/**
 * Closes the enclosing dialog when the host is clicked, optionally with a
 * result: `<button mlvDialogClose>` closes with `undefined`,
 * `<button mlvDialogClose="saved">` / `[mlvDialogClose]="value"` closes with
 * that value. On a `<button>` without an explicit `type` it sets
 * `type="button"` so it never submits a surrounding form.
 *
 * Put it on a `<button>` (or an `<a href>`): the directive listens to `click`
 * only and adds no keyboard handling of its own.
 */
@Directive({
  selector: '[mlvDialogClose]',
  host: {
    '(click)': '_close()',
    '[attr.type]': '_type()',
  },
})
export class MlvDialogClose<R = unknown> {
  /** Result passed to `MlvDialogRef.close()`. A bare attribute (`''`) means `undefined`. */
  readonly mlvDialogClose = input<R | undefined, R | '' | undefined>(
    undefined,
    {
      transform: (value) =>
        value === '' ? undefined : (value as R | undefined),
    },
  );

  /** `type` attribute applied when the host is a `<button>`. Defaults to `'button'`. */
  readonly type = input<string>('button');

  /** @private The dialog to close. */
  private readonly _ref = injectDialogRef<R, unknown>('[mlvDialogClose]');
  /** @private Whether the host is a native button (only then is `type` meaningful). */
  private readonly _isButton =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName ===
    'BUTTON';
  /** @protected `type` attribute value, `null` on non-button hosts. */
  protected readonly _type = computed(() =>
    this._isButton ? this.type() : null,
  );

  /** @protected Closes the dialog with the configured result. */
  protected _close(): void {
    this._ref.close(this.mlvDialogClose());
  }
}
