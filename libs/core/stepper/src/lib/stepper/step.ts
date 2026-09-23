import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { MlvStepState } from './stepper.types';

/**
 * `mlv-step` — a step definition component. Declare steps as children of
 * `mlv-stepper`. The stepper renders the headers and content panels itself;
 * the projected content of each `<mlv-step>` is shown in the active panel.
 */
@Component({
  selector: 'mlv-step',
  template: `<ng-template #contentTpl><ng-content /></ng-template>`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-step' },
})
export class MlvStep {
  /**
   * Step label displayed in the step header.
   */
  readonly label = input.required<string>();

  /**
   * Optional descriptive sub-label shown below the main label.
   */
  readonly description = input<string | undefined>(undefined);

  /**
   * Explicit state override. When provided, takes precedence over the derived
   * state from the stepper's `activeIndex`.
   */
  readonly state = input<MlvStepState | undefined>(undefined);

  /**
   * When `true`, this step is optional and can be skipped even in linear mode.
   */
  readonly optional = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, this step represents an alternative/deviative path.
   * The connector after this step is rendered with a dashed warning-color border,
   * and the indicator receives a visual warning badge overlay.
   */
  readonly deviative = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, marks this deviative step's deviation as resolved.
   * The connector AFTER this step reverts to the normal (solid, neutral) style
   * instead of dashed/warning. Has no visual effect unless `deviative` is also true.
   * When the user returns to this step and `deviationResolved` becomes false again,
   * the connector reverts to the dashed/warning style.
   */
  readonly deviationResolved = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @internal Template reference holding this step's projected content. */
  readonly contentTpl = viewChild.required<TemplateRef<unknown>>('contentTpl');
}
