import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvExpand } from '@malva-ui/core/expand';
import { LucideChevronDown } from '@lucide/angular';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'docs-expand-accordion-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvExpand, LucideChevronDown],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ExpandAccordionExampleComponent {
  readonly activeIndex = signal<number | null>(null);

  readonly items: FaqItem[] = [
    {
      question: 'Getting Started',
      answer:
        'Install via npm: npm install @malva-ui/core/expand. Import MlvExpand and use <mlv-expand> in your template.',
    },
    {
      question: 'Configuration',
      answer:
        'All tokens are customisable via CSS custom properties. Override --mlv-border-normal, --mlv-radius-m, and typography tokens to match your design system.',
    },
    {
      question: 'Accessibility',
      answer:
        'The trigger is your responsibility — use a native <button> with aria-expanded reflecting the open state. The body panel should have role="region" or aria-label.',
    },
    {
      question: 'Browser Support',
      answer:
        'The grid-template-rows animation is supported in all modern browsers (Chrome 57+, Firefox 52+, Safari 10.1+). No polyfills required.',
    },
  ];

  toggle(index: number): void {
    this.activeIndex.update((current) => (current === index ? null : index));
  }

  isOpen(index: number): boolean {
    return this.activeIndex() === index;
  }
}
