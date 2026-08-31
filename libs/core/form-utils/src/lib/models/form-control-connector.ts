import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvFormState } from './form-state';
import type { MlvFormControlPrepend } from '../form-control-sides';
import type { MlvFormControlAppend } from '../form-control-sides';
import type { MlvFormControlInset } from '../form-control-sides';

export interface MlvFormControl {
  readonly focused: Signal<boolean>;
  readonly disabled: Signal<boolean>;
  readonly readonly: Signal<boolean>;
  readonly state: Signal<MlvFormState>;
  /**
   * Effective state after field-bound errors/touched state are considered.
   * Signal-form controls provide this; legacy controls fall back to `state`.
   */
  readonly resolvedState?: Signal<MlvFormState>;
  readonly loading: Signal<boolean>;
  readonly clearable: Signal<boolean>;
  /**
   * Fully rounded (stadium) control container. Optional — absent means the
   * regular radius.
   */
  readonly pill?: Signal<boolean>;
  /**
   * Whether the control currently holds a clearable (non-empty) value. The
   * wrapper renders the clear button only while `clearable() && hasValue()` —
   * an empty control never shows a dangling X.
   */
  readonly hasValue: Signal<boolean>;
  /**
   * When `true`, the control renders its own clear button inside its template
   * (e.g. select/combobox place it before the chevron) and the wrapper must
   * NOT render its default one. Optional — absent means wrapper-rendered.
   */
  readonly ownsClearButton?: Signal<boolean>;
  readonly prepend: Signal<MlvFormControlPrepend | undefined>;
  readonly append: Signal<MlvFormControlAppend | undefined>;
  /** Optional full-width content rendered inside the control border. */
  readonly inset: Signal<MlvFormControlInset | undefined>;
}

export const MLV_FORM_CONTROL = new InjectionToken<MlvFormControl>(
  'MLV_FORM_CONTROL',
);
