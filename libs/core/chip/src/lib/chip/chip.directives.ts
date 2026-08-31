import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Template slot directive for content rendered **before** the chip text label.
 * Use with `<ng-template mlvChipPrepend>` inside a chip element.
 */
@Directive({
  selector: '[mlvChipPrepend]',
})
export class MlvChipPrepend extends MlvStructural {}

/**
 * Template slot directive for content rendered **after** the chip text label.
 * Use with `<ng-template mlvChipAppend>` inside a chip element.
 */
@Directive({
  selector: '[mlvChipAppend]',
})
export class MlvChipAppend extends MlvStructural {}
