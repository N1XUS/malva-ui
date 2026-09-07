import type { ModelSignal, Signal } from '@angular/core';
import {
  computed,
  contentChild,
  Directive,
  inject,
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
import type {
  MlvFormControlLabelStrategy,
  MlvFormControlLabelTarget,
} from '../models/form-field-connector';
import { MLV_FORM_FIELD } from '../models/form-field-connector';
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

  /**
   * @private The enclosing `mlv-form-field`, when this control is projected
   * into one. Optional — every control still works standalone.
   */
  private readonly _formField = inject(MLV_FORM_FIELD, { optional: true });

  /**
   * @protected How an `<mlv-label>` projected beside this control into
   * `mlv-form-field` may name it. `'none'` by default, which is the only safe
   * default: guessing `'native'` would emit a `for` that names nothing on
   * every composite control, and guessing `'aria'` would publish an
   * `aria-labelledby` no template consumes. Concrete controls override it —
   * see `MlvFormControlLabelStrategy` for what each value asserts.
   *
   * A method rather than a field so an override may read signals (`mlv-select`
   * is `'native'` while its native `<select>` is the live surface and `'aria'`
   * behind its `div[role="combobox"]`) without depending on subclass field
   * initialisation order.
   */
  protected _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'none';
  }

  /**
   * @protected Id of the element {@link labelTarget} points at. Defaults to
   * {@link id}, because a control normally puts that id on its own focus
   * target.
   *
   * Overridden where the focus target cannot carry {@link id} itself:
   * `[mlvTitle]`'s host is the consumer's own heading, and a **static** `id`
   * attribute both feeds this input and stays on that heading — so the
   * `<textarea>` takes a derived id and reports it here, keeping the two
   * elements distinct.
   */
  protected _labelTargetId(): string {
    return this.id();
  }

  /**
   * The element inside this control that a label rendered outside it may name,
   * and how — `null` when nothing can. Read by `mlv-form-field`; see
   * {@link MlvFormControl.labelTarget}.
   */
  readonly labelTarget = computed<MlvFormControlLabelTarget | null>(() => {
    const strategy = this._externalLabelStrategy();
    if (strategy === 'none') return null;
    return { id: this._labelTargetId(), labelable: strategy === 'native' };
  });

  /**
   * @protected Whether an `<mlv-label>` projected beside this control into
   * `mlv-form-field` is naming it — through **either** association strategy.
   *
   * {@link _fieldLabelId} cannot answer this: it is populated only on the
   * `'aria'` path. A `'native'` control reads `null` there and keeps emitting
   * whatever `aria-label` fallback its template supplies — and `aria-label`
   * outranks `<label for>` in the accessible-name computation, so the field's
   * label would deliver click-to-focus and no name at all (#197 review).
   *
   * Templates read it to suppress a **non-nullable** `aria-label` fallback:
   * `[attr.aria-label]="_externallyLabelled() ? null : (ariaLabel() ?? _i18n().x)"`.
   * A control whose fallback is already `ariaLabel()` alone needs nothing: a
   * consumer who wrote one asked for it.
   */
  protected readonly _externallyLabelled = computed<boolean>(() => {
    if (this._externalLabelStrategy() === 'none') return false;
    return this._formField?.labelId() != null;
  });

  /**
   * @protected Id of an `<mlv-label>` projected beside this control into
   * `mlv-form-field`, for controls whose focus target `<label for>` cannot
   * name. `null` for every other case — including when the control renders its
   * own label from {@link label}, which wins because it is the nearer,
   * explicitly-authored name.
   *
   * Templates read it as `[attr.aria-labelledby]="label() ? labelId() : _fieldLabelId()"`.
   */
  protected readonly _fieldLabelId = computed<string | null>(() => {
    if (this._externalLabelStrategy() !== 'aria') return null;
    return this._formField?.labelId() ?? null;
  });

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
