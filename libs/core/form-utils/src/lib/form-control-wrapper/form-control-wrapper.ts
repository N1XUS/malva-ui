import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  output,
  ViewEncapsulation,
} from '@angular/core';
import { MlvFormControlWrapperControl } from './form-control-wrapper-control';
import { NgTemplateOutlet } from '@angular/common';
import { MLV_FORM_CONTROL } from '../models/form-control-connector';
import { MlvButtonClose } from '@malva-ui/core/button';
import { MLV_FORM_UTILS_I18N } from '@malva-ui/i18n';

@Component({
  selector: 'mlv-form-control-wrapper',
  imports: [NgTemplateOutlet, MlvButtonClose],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-control-wrapper.html',
  styleUrl: './form-control-wrapper.scss',
  host: {
    class: 'mlv-form-control-wrapper',
    '[class]': '_stateClass()',
    '[class.mlv-form-control-wrapper--focused]': 'formControl?.focused()',
    '[class.mlv-form-control-wrapper--disabled]': 'formControl?.disabled()',
    '[class.mlv-form-control-wrapper--readonly]': 'formControl?.readonly()',
    '[class.mlv-form-control-wrapper--loading]': 'formControl?.loading()',
    '[class.mlv-form-control-wrapper--pill]': 'formControl?.pill?.() ?? false',
  },
})
export class MlvFormControlWrapper {
  /** @protected Optional injected form control connector for state/focus/disabled bindings. */
  protected readonly formControl = inject(MLV_FORM_CONTROL, {
    optional: true,
  });

  /** @protected Computed BEM state modifier class derived from the control's validation state. */
  protected readonly _stateClass = computed(
    () =>
      `mlv-form-control-wrapper--state-${
        this.formControl?.resolvedState?.() ??
        this.formControl?.state() ??
        'default'
      }`,
  );

  /** @protected Required projected control-slot directive rendered inside the wrapper. */
  protected readonly renderer = contentChild.required(
    MlvFormControlWrapperControl,
  );

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_FORM_UTILS_I18N);

  /**
   * Clear event emitter. Emits when user clicks on clear button
   */
  readonly clear = output<void>();

  /** @protected Handles the clear-button click by emitting the `clear` output. */
  protected _onClearClick(): void {
    this.clear.emit();
  }
}
