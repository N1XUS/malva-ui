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
 * Visually joins related buttons and provides a shared variant to children.
 * Use the native `aria-label` or `aria-labelledby` attribute to name the group
 * when its purpose is not clear from surrounding content.
 */
@Component({
  selector: 'mlv-button-group',
  template: '<ng-content />',
  styleUrl: './button-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_BUTTON_VARIANT,
      useExisting: forwardRef(() => MlvButtonGroup),
    },
  ],
  host: {
    class: 'mlv-button-group',
    role: 'group',
  },
})
export class MlvButtonGroup implements MlvButtonVariantAccessor {
  /**
   * Default visual treatment for descendant buttons. An individual button can
   * still override it with its own `variant` input.
   */
  readonly variant = input<MlvButtonVariant | undefined>(undefined);

  /** @private Optional variant supplied by an enclosing button container. */
  private readonly _parentVariant = inject(MLV_BUTTON_VARIANT, {
    optional: true,
    skipSelf: true,
  });

  /** The shared variant inherited by descendants without a local override. */
  readonly effectiveVariant = computed(
    () =>
      this.variant() ?? this._parentVariant?.effectiveVariant() ?? 'primary',
  );
}
