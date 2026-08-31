import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  MlvAccordion,
  MlvAccordionItem,
  MlvAccordionHeader,
} from '@malva-ui/core/accordion';
import { LucideUser, LucideBell, LucideShield } from '@lucide/angular';

@Component({
  selector: 'docs-accordion-rich-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvAccordion,
    MlvAccordionItem,
    MlvAccordionHeader,
    LucideUser,
    LucideBell,
    LucideShield,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class AccordionRichExampleComponent {}
