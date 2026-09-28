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
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { MLV_FORM_UTILS_I18N } from '@malva-ui/i18n';

@Component({
  selector: 'mlv-form-control-wrapper',
  imports: [NgTemplateOutlet, MlvButtonClose],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-control-wrapper.html',
  styleUrl: './form-control-wrapper.scss',
  // Density: the wrapper stamps `mlv-form-control-wrapper--<density>` from the
  // nearest density scope (DI), so two density ancestors resolve by nesting,
  // not by stylesheet order (#364). No input: the owning control decides.
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'form-control-wrapper' },
  ],
  hostDirectives: [MlvDensityDirective],
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
   * @protected Whether the trailing clear button renders: the control is
   * `clearable`, holds a value, does not draw its own clear button, **and a
   * user may write it right now**.
   *
   * The last term is the control's `_canWrite` rule — `!readonly() &&
   * !computedDisabled()` — read through the connector, the only surface the
   * wrapper sees (#301). For every `MlvSignalFormUiControlBase` subclass the
   * connector's `disabled()` *is* `computedDisabled()`, so the two agree, and
   * a spec pins that they do; a term added to `_canWrite` must be added here
   * too. It is restated rather than exposed as a connector member because a
   * public member on the base would land on a documented subclassing
   * contract, where a subclass's own `canWrite` would stop compiling.
   *
   * Hidden rather than rendered `disabled`: the wrapper already hides the X on
   * an empty control, `mlv-select`, `mlv-combobox` and `mlv-search-field` hide
   * theirs the same way, and an X that cannot act in the current state is
   * noise to assistive tech even out of the tab order. Enforcement is not this
   * computed's job — each control's `(clear)` handler still writes through
   * `_write`, which refuses independently.
   */
  protected readonly _showClear = computed(() => {
    const control = this.formControl;
    if (!control) return false;
    return (
      control.clearable() &&
      control.hasValue() &&
      !control.ownsClearButton?.() &&
      !control.readonly() &&
      !control.disabled()
    );
  });

  /**
   * Emits when the user activates the clear button. The button renders only
   * while the control is clearable, holds a value and is neither readonly nor
   * disabled, so a bound handler is reached only from a writable control — it
   * should still write through the control's `_write`, which is the
   * enforcement (a click can land on a stale button in the same task that
   * flipped the control readonly).
   */
  readonly clear = output<void>();

  /** @protected Handles the clear-button click by emitting the `clear` output. */
  protected _onClearClick(): void {
    this.clear.emit();
  }
}
