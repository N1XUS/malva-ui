import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';
import type { MlvCompareOrientation } from './compare/compare';

/**
 * Template context handed to a `*mlvCompareHandleDef` template, so a custom
 * handle can react to the surface's live state.
 */
export interface MlvCompareHandleContext {
  /** The current orientation — also available as `orientation`. */
  $implicit: MlvCompareOrientation;
  /** Axis the divider travels along. */
  orientation: MlvCompareOrientation;
  /** `true` while a pointer drag is in progress (not while merely hovering). */
  dragging: boolean;
}

/**
 * Structural template that replaces the default chevron glyph inside the
 * `mlv-compare` handle. The handle keeps its size, shape, shadow, press
 * feedback and focus ring; the template only supplies what sits inside it.
 * It is decorative — the slider's accessible name still comes from
 * `ariaLabel` / `ariaLabelledby`. Keep it non-interactive: it renders inside
 * the `aria-hidden`, `pointer-events: none` divider, so a focusable element
 * there would be unreachable by pointer yet still tabbable (an
 * `aria-hidden-focus` violation).
 *
 * @example
 * ```html
 * <mlv-compare [(value)]="position" ariaLabel="Before and after">
 *   <img mlvCompareBefore src="raw.jpg" alt="Untouched" />
 *   <img mlvCompareAfter src="graded.jpg" alt="Graded" />
 *   <ng-template mlvCompareHandleDef let-dragging="dragging">
 *     <svg lucideMoveHorizontal [size]="20" [class.spread]="dragging" />
 *   </ng-template>
 * </mlv-compare>
 * ```
 */
@Directive({
  selector: '[mlvCompareHandleDef]',
})
export class MlvCompareHandleDef extends MlvStructural<MlvCompareHandleContext> {
  /** Type guard so `let-` variables in the template are correctly inferred. */
  static ngTemplateContextGuard(
    _directive: MlvCompareHandleDef,
    _context: unknown,
  ): _context is MlvCompareHandleContext {
    return true;
  }
}
