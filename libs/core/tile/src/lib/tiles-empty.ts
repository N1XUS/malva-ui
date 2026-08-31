import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/** Marks a template as the empty-target prompt rendered by `mlv-tiles`. */
@Directive({ selector: '[mlvTilesEmpty]' })
export class MlvTilesEmpty extends MlvStructural {}
