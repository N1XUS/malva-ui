import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { MlvButtonVariant } from '../button.types';
import type { MlvButtonVariantAccessor } from '../button-variant.token';
import { MLV_BUTTON_VARIANT } from '../button-variant.token';

/**
 * Joins a primary action and its related secondary trigger into one control.
 * The component owns layout and shared styling; consumers keep control of the
 * two projected native buttons and any menu or popup attached to the trigger.
 */
@Component({
  selector: 'mlv-button-split',
  template: '<ng-content />',
  styleUrl: './button-split.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_BUTTON_VARIANT,
      useExisting: forwardRef(() => MlvButtonSplit),
    },
  ],
  host: {
    class: 'mlv-button-split',
    role: 'group',
  },
})
export class MlvButtonSplit implements MlvButtonVariantAccessor {
  /**
   * Default visual treatment for both projected buttons. Either child can
   * override it with a local `variant` input.
   */
  readonly variant = input<MlvButtonVariant | undefined>(undefined);

  /** @private Optional variant supplied by an enclosing button container. */
  private readonly _parentVariant = inject(MLV_BUTTON_VARIANT, {
    optional: true,
    skipSelf: true,
  });

  /** The shared variant inherited by projected buttons. */
  readonly effectiveVariant = computed(
    () =>
      this.variant() ?? this._parentVariant?.effectiveVariant() ?? 'primary',
  );
}
