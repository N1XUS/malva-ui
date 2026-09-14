import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
} from '@angular/core';

/**
 * One labelled key fact inside `mlv-page-summary` — a term above its value.
 *
 * It is an **attribute component on a `<div>`**, not an element of its own,
 * because the strip it lives in is a description list. `<dl>` has a content
 * model: it may directly contain only `<dt>`/`<dd>` groups, `<div>` wrappers,
 * `<script>` and `<template>`. A custom element between the list and its terms
 * is invalid there and fails axe's own `definition-list` and `dlitem` rules —
 * so the wrapper the group needs has to be a real `<div>`, and the component
 * enhances that div instead of replacing it.
 *
 * ```html
 * <mlv-page-summary>
 *   <div mlvPageSummaryItem label="Price">329 USD</div>
 * </mlv-page-summary>
 * ```
 */
@Component({
  // Attribute-selector component: the host must be the `<div>` the `<dl>`
  // content model requires. See the class JSDoc.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'div[mlvPageSummaryItem]',
  exportAs: 'mlvPageSummaryItem',
  template: `
    <dt class="mlv-page-summary-item__label">{{ label() }}</dt>
    <dd class="mlv-page-summary-item__value"><ng-content /></dd>
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
