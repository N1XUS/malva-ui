import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import type { MlvButtonShape, MlvButtonVariant } from '../button/button';
import { MlvButton } from '../button/button';
import { MlvButtonIcon } from '../button.directives';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'mlv-button-close',
  templateUrl: './button-close.html',
  styleUrl: './button-close.scss',
  imports: [MlvButton, MlvButtonIcon, LucideX],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity: mlvDensity'],
    },
  ],
  providers: [
    {
      provide: MLV_DENSITY_ELEMENT,
      useValue: 'button-close',
    },
  ],
  host: {
    class: 'mlv-button-close',
  },
})
export class MlvButtonClose {
  /**
   * Visual treatment for the inner button. Defaults to `transparent`; binding
   * `undefined` allows the standard button variant inheritance to take over.
   */
  readonly variant = input<MlvButtonVariant | undefined>('transparent');

  /** Shape of the inner close button. */
  readonly shape = input<MlvButtonShape>('circle');

  /** Accessible name applied to the inner native button. */
  readonly ariaLabel = input.required<string>();

  /**
   * @protected Resolved host-directive density forwarded to the inner button.
   *
   * The full five-step directive, not one of the clamped variants: a close
   * button matches the dimensions of an icon-only `mlvButton` at every density.
   */
  protected readonly _density = inject(MlvDensityDirective);
}
