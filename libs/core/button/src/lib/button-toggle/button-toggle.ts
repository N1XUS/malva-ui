import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
  ViewEncapsulation,
} from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButton } from '../button/button';
import type { MlvButtonShape, MlvButtonVariant } from '../button.types';
import type { MlvButtonVariantAccessor } from '../button-variant.token';
import { MLV_BUTTON_VARIANT } from '../button-variant.token';

/** A two-state button that exposes native `aria-pressed` semantics. */
@Component({
  selector: 'mlv-button-toggle',
  imports: [MlvButton],
  template: `
    <button
      mlvButton
      type="button"
      [shape]="shape()"
      [mlvDensity]="mlvDensity()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() ?? null"
      [attr.aria-labelledby]="ariaLabelledBy() ?? null"
      [attr.aria-pressed]="pressed()"
      (click)="toggle()"
    >
      <ng-content />
    </button>
  `,
  styleUrl: './button-toggle.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_BUTTON_VARIANT,
      useExisting: forwardRef(() => MlvButtonToggle),
    },
  ],
  host: {
    class: 'mlv-button-toggle',
    '[class.mlv-button-toggle--pressed]': 'pressed()',
    '[class.mlv-button-toggle--disabled]': 'disabled()',
  },
})
export class MlvButtonToggle implements MlvButtonVariantAccessor {
  /** Two-way bindable pressed state reflected by the inner native button. */
  readonly pressed = model(false);

  /** Whether the inner native button is disabled. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Visual treatment for the toggle. When omitted, it inherits the closest
   * button container variant and otherwise falls back to `primary`.
   */
  readonly variant = input<MlvButtonVariant | undefined>(undefined);

  /** Shape of the inner button. */
  readonly shape = input<MlvButtonShape>('default');

  /** Density level forwarded to the inner button. */
  readonly mlvDensity = input<MlvDensity | undefined>(undefined);

  /** Accessible name for an icon-only toggle. */
  readonly ariaLabel = input<string | undefined>(undefined);

  /** Id reference(s) naming the inner native button. */
  readonly ariaLabelledBy = input<string | undefined>(undefined);

  /** @private Optional variant supplied by an enclosing button container. */
  private readonly _parentVariant = inject(MLV_BUTTON_VARIANT, {
    optional: true,
    skipSelf: true,
  });

  /** The visual treatment inherited by the inner button. */
  readonly effectiveVariant = computed(
    () =>
      this.variant() ?? this._parentVariant?.effectiveVariant() ?? 'primary',
  );

  /** Toggles the pressed state unless the control is disabled. */
  toggle(): void {
    if (this.disabled()) return;
    this.pressed.update((pressed) => !pressed);
  }
}
