import {
  ChangeDetectionStrategy,
  Component,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { MlvTooltipTone, MlvTooltipPlacement } from './tooltip.types';

/**
 * Internal tooltip panel component.
 *
 * This component is not intended for direct consumer use — it is created
 * programmatically by `MlvTooltip` and attached to a CDK overlay.
 *
 * Renders the floating tooltip panel with optional directional arrow.
 * Placement and tone variant are controlled via inputs set by the directive.
 */
@Component({
  selector: 'mlv-tooltip-panel',
  template: `
    <div
      class="mlv-tooltip"
      [class]="'mlv-tooltip--tone-' + tone()"
      [class.mlv-tooltip--no-arrow]="!showArrow()"
      [class.mlv-tooltip--placement-top]="placement() === 'top'"
      [class.mlv-tooltip--placement-bottom]="placement() === 'bottom'"
      [class.mlv-tooltip--placement-left]="placement() === 'left'"
      [class.mlv-tooltip--placement-right]="placement() === 'right'"
      role="tooltip"
      [attr.id]="tooltipId()"
    >
      <span class="mlv-tooltip__content">{{ content() }}</span>
      @if (showArrow()) {
        <span class="mlv-tooltip__arrow" aria-hidden="true"></span>
      }
    </div>
  `,
  styleUrl: './tooltip-panel.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MlvTooltipPanel {
  /** The text content to display inside the tooltip panel. */
  readonly content = input.required<string>();

  /** The tone variant of the tooltip panel. */
  readonly tone = input<MlvTooltipTone>('neutral');

  /** Whether the directional arrow is visible. */
  readonly showArrow = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** The preferred placement of the tooltip relative to the trigger. */
  readonly placement = input<MlvTooltipPlacement>('top');

  /** Unique ID for the tooltip panel, used by `aria-describedby` on the trigger. */
  readonly tooltipId = input.required<string>();
}
