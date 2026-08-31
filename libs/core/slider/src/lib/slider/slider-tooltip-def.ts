import { Directive, inject, TemplateRef } from '@angular/core';

/**
 * Identifies the thumb whose tooltip is being rendered.
 *
 * Single-value sliders use `'value'`; range sliders use `'min'` and `'max'`.
 */
export type MlvSliderTooltipThumb = 'value' | 'min' | 'max';

/**
 * Context provided to a custom `[mlvSliderTooltipDef]` template.
 */
export interface MlvSliderTooltipDefContext {
  /** Current thumb value, also exposed as `let-value`. */
  $implicit: number;
  /** Current thumb value exposed as the named `value` property. */
  value: number;
  /** Semantic identity of the thumb being rendered. */
  thumb: MlvSliderTooltipThumb;
}

/**
 * Structural directive that provides custom slider tooltip text.
 *
 * @example
 * ```html
 * <mlv-slider tooltip>
 *   <ng-template mlvSliderTooltipDef let-value>
 *     {{ value }}%
 *   </ng-template>
 * </mlv-slider>
 * ```
 */
@Directive({
  selector: '[mlvSliderTooltipDef]',
})
export class MlvSliderTooltipDef {
  /** Template used to render the current thumb value. */
  readonly templateRef = inject(TemplateRef<MlvSliderTooltipDefContext>);

  /** Type guard for `let-value`, `let-value="value"`, and `let-thumb="thumb"`. */
  static ngTemplateContextGuard(
    _dir: MlvSliderTooltipDef,
    _ctx: unknown,
  ): _ctx is MlvSliderTooltipDefContext {
    return true;
  }
}
