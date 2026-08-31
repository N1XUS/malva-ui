import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/** Marks content rendered in the complementary page-aside landmark. */
@Directive({ selector: '[mlvPageAside]' })
export class MlvPageAside extends MlvStructural {}
