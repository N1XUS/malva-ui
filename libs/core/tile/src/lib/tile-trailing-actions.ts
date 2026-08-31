import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/** Marks a template as the trailing action area rendered in a tile header. */
@Directive({ selector: '[mlvTileTrailingActions]' })
export class MlvTileTrailingActions extends MlvStructural {}
