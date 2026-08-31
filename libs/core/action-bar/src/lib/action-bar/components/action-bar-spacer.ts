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
  styles: [
    `
      .mlv-action-bar__spacer {
        display: inline-flex;
        flex-grow: 1;
      }
    `,
  ],
  host: {
    class: 'mlv-action-bar__spacer',
  },
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MlvActionBarSpacer {}
