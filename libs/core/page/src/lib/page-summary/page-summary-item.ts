import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
} from '@angular/core';

/**
 * One labelled key fact inside `mlv-page-summary`. The label renders above
 * the projected value content.
 */
@Component({
  selector: 'mlv-page-summary-item',
  template: `
    <span class="mlv-page-summary-item__label">{{ label() }}</span>
    <div class="mlv-page-summary-item__value"><ng-content /></div>
  `,
  styleUrl: './page-summary-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-summary-item',
    'data-slot': 'page-summary-item',
  },
})
export class MlvPageSummaryItem {
  /** Visible label describing the projected value. */
  readonly label = input.required<string>();
}
