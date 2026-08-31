import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvAccordion, MlvAccordionItem } from '@malva-ui/core/accordion';
import { MlvButton } from '@malva-ui/core/button';
import { MlvBadge } from '@malva-ui/core/badge';

@Component({
  selector: 'docs-accordion-control-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAccordion, MlvAccordionItem, MlvButton, MlvBadge],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class AccordionControlExampleComponent {
  /** Two-way bound expanded state of the first item. */
  readonly firstOpen = signal(false);
}
