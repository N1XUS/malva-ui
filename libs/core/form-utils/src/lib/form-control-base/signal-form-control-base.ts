import type { ModelSignal, Signal } from '@angular/core';
import {
  computed,
  contentChild,
  Directive,
  input,
  output,
  signal,
} from '@angular/core';
import type {
  FormCheckboxControl,
  FormValueControl,
  ValidationError,
} from '@angular/forms/signals';
import type { MlvFormState } from '../models/form-state';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvFormControl } from '../models/form-control-connector';
import { MlvFormControlAppend } from '../form-control-sides';
import { MlvFormControlInset } from '../form-control-sides';
import { MlvFormControlPrepend } from '../form-control-sides';

/**
 * Shared, forms-transport-agnostic surface for **signal-forms** Malva controls.
 * Owns everything EXCEPT the value/checked model: the
 * Malva field surface (`state`, `label`, `hint`, `message`, `clearable`,
 * `id`, prepend/append slots), the wrapper connector contract
 * ({@link MlvFormControl}), and the signal-forms field↔control bindings —
 * `errors` / `disabled` / `readonly` / `touched` / `dirty` input signals the
 * `[formField]` directive binds automatically, plus the `touch` output the
 * control emits when the user leaves the field.
 *
 * Per the signal-forms contract a component must NOT implement both
 * `ControlValueAccessor` and `FormValueControl`; controls therefore adopt
 * either {@link MlvSignalFormControlBase} or {@link MlvSignalCheckboxControlBase}
 * atomically. Reactive (`[formControl]`)
 * and template-driven (`ngModel`) bindings keep working — Angular binds the
 * signal contract from those directives without extra compatibility code.
 */
@Directive()
export abstract class MlvSignalFormUiControlBase implements MlvFormControl {
  /** @protected Backing signal for {@link focused}. */
  protected readonly _focused = signal(false);

  /** Whether the control currently has focus (drives the wrapper's focus ring). */
  readonly focused: Signal<boolean> = this._focused;

  /** Sets the control's focus state (wired to the focus target's focus/blur). */
  setFocused(value: boolean): void {
    this._focused.set(value);
  }

  /** Explicit consumer-authored visual validation state. */
  readonly state = input<MlvFormState>('default');

  /**
   * Whether the control is read-only. Also a signal-forms field binding: when
   * bound via `[formField]`, a `readonly` schema rule drives this input.
   */
  readonly readonly = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /**
   * Whether the control is disabled. Also a signal-forms field binding: when
   * bound via `[formField]`, the field's disabled state drives this input.
   */
  readonly disabled = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /**
   * Whether the control must be filled in. Renders the required marker in
   * `mlv-label` and sets `aria-required` on the control's focus target. Also a
   * signal-forms field binding: when bound via `[formField]`, a `required()`
   * schema rule drives this input.
   */
  readonly required = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /** Whether the control shows its loading affordance. */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether the control renders a clear (X) affordance while it has a value. */
  readonly clearable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Fully rounded (stadium) control container. Shared by every control that
   * renders through `mlv-form-control-wrapper`, mirroring `shape="pill"` on
   * buttons and the pill action bar.
   */
  readonly pill = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Signal-forms field binding: current validation errors of the bound field
   * (`[formField]` binds them automatically). Empty when unbound.
   */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Signal-forms field binding: whether the bound field is touched. */
  readonly touched = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /** Signal-forms field binding: whether the bound field is dirty. */
  readonly dirty = input<boolean, unknown>(false, {
    transform: (value: unknown) => coerceBooleanProperty(value as BooleanInput),
  });

  /**
   * Effective visual state exposed through the Malva form-control connector.
   * An explicit non-default state wins; otherwise a signal-form validation
   * error becomes visible after the field is touched, matching the default
   * `MlvFormField` error-display strategy.
   */
  readonly resolvedState = computed<MlvFormState>(() => {
    const explicitState = this.state();
    if (explicitState !== 'default') return explicitState;
    return this.errors().length > 0 && this.touched() ? 'error' : 'default';
  });

  /**
   * Emits when the user finishes interacting with the field (blur) — the
   * signal-forms replacement for the CVA `onTouched` callback; `[formField]`
   * subscribes and marks the bound field touched.
   */
  readonly touch = output<void>();

  /**
   * Whether the control currently holds a clearable (non-empty) value.
   */
  abstract readonly hasValue: Signal<boolean>;

  /** HTML id applied to the control's focus target. */
  readonly id = input<string>(mlvNextId('mlv-control'));
  /** Label text rendered above the control. */
  readonly label = input('');
  /** Hint text rendered inside the label. */
  readonly hint = input('');
  /**
   * Persistent help text rendered **below** the control, in front of the
   * validation message. Unlike {@link hint} (a short inline aside inside the
   * label) this is meant for sentence-length descriptions, and it stays
   * visible while {@link message} is shown. Referenced by `aria-describedby`.
   */
  readonly description = input('');
  /** Validation/status message rendered below the control. */
  readonly message = input('');

  /**
   * Accessible name applied to the control's focus target (`aria-label`).
   * Use it when the control renders no visible `<mlv-label>`.
   */
  readonly ariaLabel = input<string | null>(null);

  /** @protected Id of the rendered `<mlv-description>` element. */
  protected readonly _descriptionId = computed(
    () => `${this.id()}-description`,
  );

  /** @protected Id of the rendered `<mlv-message>` element. */
  protected readonly _messageId = computed(() => `${this.id()}-message`);

  /**
   * @protected Space-separated `aria-describedby` value covering the rendered
   * description and message elements — `null` when neither is rendered, so no
   * dangling IDREF is emitted.
   */
  protected readonly _describedBy = computed(() => {
    const ids: string[] = [];
    if (this.description()) ids.push(this._descriptionId());
    if (this.message()) ids.push(this._messageId());
    return ids.length > 0 ? ids.join(' ') : null;
  });

  /** Projected prefix slot. */
  readonly prepend = contentChild(MlvFormControlPrepend);
  /** Projected suffix slot. */
  readonly append = contentChild(MlvFormControlAppend);
  /** Projected full-width content rendered inside the control border. */
  readonly inset = contentChild(MlvFormControlInset);

  /**
   * Effective disabled state. In the signal base there is no CVA
   * `setDisabledState` side channel — the `disabled` input is the single
   * source (consumer-bound or field-bound), kept as a computed so existing
   * control templates retain one consistent disabled-state signal.
   */
  readonly computedDisabled = computed(() => this.disabled());

  /** @protected Notifies the field that the user left the control. */
  protected _markTouched(): void {
    this.touch.emit();
  }
}

/**
 * Signal-forms base for **value** controls: adds the required
 * `value: ModelSignal<T>` of the `FormValueControl` contract. Each control
 * supplies the model itself (`readonly value = model<T>(initial)`), mirroring
 * how `hasValue` is supplied.
 */
@Directive()
export abstract class MlvSignalFormControlBase<T>
  extends MlvSignalFormUiControlBase
  implements FormValueControl<T>
{
  /** The control's value — kept in sync with the bound field by `[formField]`. */
  abstract readonly value: ModelSignal<T>;
}

/**
 * Signal-forms base for **checkbox-shaped** controls (checkbox, switch): adds
 * the required `checked: ModelSignal<boolean>` of the `FormCheckboxControl`
 * contract. The contract forbids a `value` member on this variant.
 */
@Directive()
export abstract class MlvSignalCheckboxControlBase
  extends MlvSignalFormUiControlBase
  implements FormCheckboxControl
{
  /** The control's checked state — kept in sync with the bound field by `[formField]`. */
  abstract readonly checked: ModelSignal<boolean>;
}
