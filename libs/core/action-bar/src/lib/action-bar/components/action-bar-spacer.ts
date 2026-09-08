import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

@Component({
  // Attribute-selector component — camelCase [mlvX] is the documented pattern
  // (see .claude/rules/angular-component.md); the rule only models kebab-case.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[mlvActionBarSpacer]',
  // A stylesheet, not an inline `styles: []` array: `libs/styles`' layer guard
  // walks `.css` / `.scss` files only, so an inline rule ships unlayered — and
  // an unlayered library rule outranks every layered one, taking the override
  // slot that belongs to the consumer.
  styleUrl: './action-bar-spacer.scss',
  host: {
    class: 'mlv-action-bar__spacer',
  },
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MlvActionBarSpacer {}
