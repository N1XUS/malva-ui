import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

@Directive({ selector: '[mlvFormControlPrepend]' })
export class MlvFormControlPrepend extends MlvStructural {}

@Directive({ selector: '[mlvFormControlAppend]' })
export class MlvFormControlAppend extends MlvStructural {}

/**
 * Full-width content rendered inside the bordered control, after its main row.
 *
 * Use for secondary, non-interactive control presentation such as strength
 * meters. Prefix and suffix actions remain in their dedicated slots.
 */
@Directive({ selector: '[mlvFormControlInset]' })
export class MlvFormControlInset extends MlvStructural {}
