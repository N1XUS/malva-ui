import { Directive, input } from '@angular/core';
import type { MlvFormActionsAlign } from './form.types';

/**
 * Marks the actions row of a `form[mlvForm]` (submit / cancel buttons): a
 * wrapping flex row with the standard button gap.
 *
 * @example
 * ```html
 * <footer mlvFormActions align="end">
 *   <button mlvButton variant="secondary" type="button">Cancel</button>
 *   <button mlvButton type="submit">Save</button>
 * </footer>
 * ```
 */
@Directive({
  selector: '[mlvFormActions]',
  host: {
    class: 'mlv-form__actions',
    '[class.mlv-form__actions--align-end]': 'align() === "end"',
    '[class.mlv-form__actions--align-center]': 'align() === "center"',
    '[class.mlv-form__actions--align-between]': 'align() === "between"',
  },
})
export class MlvFormActions {
  /** Horizontal distribution of the actions. `'start'` (default) hugs the start edge. */
  readonly align = input<MlvFormActionsAlign>('start');
}
