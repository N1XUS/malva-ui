import { Directive } from '@angular/core';

/**
 * Marks the title row of a `form[mlvForm]`: a wrapping flex row that keeps a
 * heading (`h*[mlvTitle]`) on the start side and accessories (badges,
 * segmented controls) on the end side.
 *
 * @example
 * ```html
 * <header mlvFormHeader>
 *   <h2 mlvTitle>Registration</h2>
 *   <mlv-badge tone="info" muted>Step 1 of 3</mlv-badge>
 * </header>
 * ```
 */
@Directive({
  selector: '[mlvFormHeader]',
  host: { class: 'mlv-form__header' },
})
export class MlvFormHeader {}
