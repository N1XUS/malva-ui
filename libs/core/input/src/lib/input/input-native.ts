import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Marks a consumer-provided native `<input>` that should be adopted as the
 * control element of a `<mlv-input projectControl>`.
 *
 * `mlv-input` normally renders and owns its own internal `<input>`. Some
 * headless behaviours — most notably `@angular/aria`'s combobox family, whose
 * trigger directive (`[ngCombobox]`, formerly `input[ngComboboxInput]`) must
 * sit directly on the interactive `<input>` element — need to attach their own
 * attribute directives to that input. Because Angular cannot attach an external
 * directive to a component's *internal* template element, `mlv-input` instead
 * exposes an opt-in projection slot: set `projectControl` on `<mlv-input>` and
 * project your own `<input mlvInputNative …>` carrying whatever directives you
 * need. This directive applies the shared `mlv-input__native` styling hook and
 * makes the element discoverable to the host `mlv-input` so focus/selection
 * helpers keep working.
 *
 * @example
 * ```html
 * <mlv-input bare projectControl>
 *   <input mlvInputNative ngCombobox [(value)]="query" [(expanded)]="open" />
 * </mlv-input>
 * ```
 */
@Directive({
  selector: 'input[mlvInputNative]',
  exportAs: 'mlvInputNative',
  host: {
    class: 'mlv-input__native',
  },
})
export class MlvInputNative {
  /**
   * @protected The projected native `<input>` element reference, used by the
   * host `mlv-input` to forward `focus()` / `select()` calls.
   */
  protected readonly _elementRef =
    inject<ElementRef<HTMLInputElement>>(ElementRef);

  /** The projected native `<input>` element. */
  get nativeElement(): HTMLInputElement {
    return this._elementRef.nativeElement;
  }
}
