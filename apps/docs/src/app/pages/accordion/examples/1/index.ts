import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAccordion, MlvAccordionItem } from '@malva-ui/core/accordion';

@Component({
  selector: 'docs-accordion-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAccordion, MlvAccordionItem],
  templateUrl: './index.html',
})
export default class AccordionBasicExampleComponent {}
