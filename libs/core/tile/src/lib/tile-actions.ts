import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/** Marks a template as the action area rendered in a tile header. */
@Directive({ selector: '[mlvTileActions]' })
export class MlvTileActions extends MlvStructural {}
