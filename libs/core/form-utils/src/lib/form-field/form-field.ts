import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  forwardRef,
  inject,
  input,
  isDevMode,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { ValidationErrors } from '@angular/forms';
import {
  FormGroupDirective,
  NgControl,
  NgForm,
  PristineChangeEvent,
  StatusChangeEvent,
  TouchedChangeEvent,
} from '@angular/forms';
import { FormField } from '@angular/forms/signals';
import type { MlvFormState } from '../models/form-state';
import type { MlvErrorDisplayStrategy } from '../models/error-display-strategy';
import { MlvMessage } from '../message/message';
import { MlvLabel } from '../label/label';
import { MLV_FORM_CONTROL } from '../models/form-control-connector';
import type { MlvFormFieldAccessor } from '../models/form-field-connector';
import { MLV_FORM_FIELD } from '../models/form-field-connector';
import { MLV_FORM_UTILS_I18N } from '@malva-ui/i18n';
import { mlvNextId } from '@malva-ui/cdk/utils';

const DEFAULT_ERROR_MESSAGES: Record<string, (err: unknown) => string> = {
  required: () => 'This field is required',
  email: () => 'Please enter a valid email address',
  min: (err) => `Value must be at least ${(err as { min: number }).min}`,
  max: (err) => `Value must be at most ${(err as { max: number }).max}`,
  minlength: (err) => {
    const e = err as { requiredLength: number };
    return `Must be at least ${e.requiredLength} characters`;
  },
  maxlength: (err) => {
    const e = err as { requiredLength: number };
    return `Must be at most ${e.requiredLength} characters`;
  },
  pattern: () => 'Invalid format',
};

/**
 * Validator keys already reported through {@link MlvFormField}'s dev-mode
 * warning. Module-scoped so a key is named once per application run rather than
 * on every change-detection pass.
 */
const WARNED_UNMAPPED_KEYS = new Set<string>();

/**
 * Control class names already reported through {@link MlvFormField}'s dev-mode
 * "unassociated label" warning. Module-scoped for the same reason as
 * {@link WARNED_UNMAPPED_KEYS}: a repeated composition is named once per
 * application run, not once per rendered field.
 */
const WARNED_UNASSOCIATED_LABELS = new Set<string>();

/**
 * Control class names already reported through {@link MlvFormField}'s dev-mode
 * "two labels" warning. A separate set from {@link WARNED_UNASSOCIATED_LABELS}
 * on purpose: the two diagnostics describe different defects, and a shared key
 * would let whichever fired first silence the other for the rest of the run.
 */
const WARNED_DOUBLE_LABELS = new Set<string>();

@Component({
  selector: 'mlv-form-field',
  imports: [MlvMessage],
  template: `
    <div class="mlv-form-field" [class]="'mlv-form-field--' + resolvedState()">
      <ng-content select="mlv-label" />
      <div class="mlv-form-field__control">
        <ng-content />
      </div>
      <ng-content select="mlv-message" />
      @if (autoErrorMessage()) {
        <mlv-message state="error" [id]="_errorMessageId">{{
          autoErrorMessage()
        }}</mlv-message>
      }
    </div>
  `,
  styleUrl: './form-field.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_FIELD,
      useExisting: forwardRef(() => MlvFormField),
    },
  ],
})
export class MlvFormField implements MlvFormFieldAccessor {
  /** Visual state of the field. Overridden to `'error'` when an auto error message is shown. */
  readonly state = input<MlvFormState>('default');
  /** Custom validator-key → message map (string or factory) overriding the built-in defaults. */
  readonly errorMessages = input<
    Record<string, string | ((err: unknown) => string)>
  >({});
  /** Controls when validation errors become visible. */
  readonly displayStrategy = input<MlvErrorDisplayStrategy>('touched');

  /**
   * @private The form-utils i18n strings. Optional so `mlv-form-field` keeps
   * rendering in applications that never called `provideMlvI18n()`.
   */
  private readonly _i18n = inject(MLV_FORM_UTILS_I18N, { optional: true });

  /** @private The projected `NgControl` whose validation state this field reflects. */
  private readonly _ngControl = contentChild(NgControl);

  /**
   * @private The projected `<mlv-label>`, when the consumer composed one. Only
   * a **content** child matches: a control that renders its own `<mlv-label>`
   * from its `label` input does so in its own view, which no content query of
   * this field can reach — so the two never collide.
   */
  private readonly _label = contentChild(MlvLabel);

  /**
   * @private The projected control, resolved through the connector token every
   * Malva control provides. `contentChild` accepts a `ProviderToken`, so this
   * matches by what the node injector can supply rather than by class — the
   * same mechanism as {@link _ngControl}, and the reason a raw `<input>` or a
   * third-party control simply resolves `null` instead of erroring.
   */
  private readonly _control = contentChild(MLV_FORM_CONTROL);

  /**
   * Id of the `<label>` rendered by the projected `<mlv-label>` — `null` when
   * the consumer composed none. Controls whose focus target is not
   * HTML-labelable point `aria-labelledby` at it.
   */
  readonly labelId = computed<string | null>(
    () => this._label()?.labelId ?? null,
  );

  /**
   * Id the projected `<mlv-label>` renders as its `for` — `null` unless the
   * projected control reports a **labelable** name target.
   *
   * Both halves of the association are needed and they are not
   * interchangeable. `<label for>` only names a *labelable* element (`button`,
   * `input`, `meter`, `output`, `progress`, `select`, `textarea`); it does not
   * name `mlv-select`'s `div[role="combobox"]`, and pointing it there is worse
   * than omitting it, because the label then reads as associated while
   * focusing nothing. `aria-labelledby` names both but is ARIA layered over
   * native semantics, so it is used only where the native form cannot work.
   * The control decides which applies — see `MlvFormControlLabelStrategy`.
   */
  readonly labelableControlId = computed<string | null>(() => {
    const target = this._control()?.labelTarget?.();
    return target?.labelable ? target.id : null;
  });

  /**
   * @private The projected signal-forms `[formField]` directive, when the
   * child control is bound through `@angular/forms/signals` instead of an
   * `NgControl`. Takes precedence over the NgControl path when present.
   */
  private readonly _signalField = contentChild(FormField);

  /**
   * @private The bound signal-forms `FieldState`, or `null` while no
   * `[formField]` child is projected. `field()` is the `FieldTree`; calling it
   * yields the reactive `FieldState`.
   */
  private readonly _signalFieldState = computed(() => {
    const formField = this._signalField();
    return formField ? formField.field()() : null;
  });
  /** @private The ancestor form directive, used to observe submission state. */
  private readonly _formDirective =
    inject(FormGroupDirective, { optional: true }) ??
    inject(NgForm, { optional: true });

  /** @private Current validation errors of the projected control. */
  private readonly _controlErrors = signal<ValidationErrors | null>(null);
  /** @private Whether the projected control has been touched. */
  private readonly _controlTouched = signal(false);
  /** @private Whether the projected control is dirty. */
  private readonly _controlDirty = signal(false);
  /** @private Whether the ancestor form has been submitted. */
  private readonly _formSubmitted = signal(false);

  constructor() {
    effect((onCleanup) => {
      // Signal-forms path: state is read reactively from the FieldState — no
      // event subscriptions. (The signals interop also exposes a shim
      // NgControl whose `.control` lacks the `events` stream, so the legacy
      // path below must not run for a [formField]-bound child.)
      if (this._signalField()) return;
      const control = this._ngControl()?.control;
      if (!control) return;

      this._controlErrors.set(control.errors);
      this._controlTouched.set(control.touched);
      this._controlDirty.set(control.dirty);
      this._formSubmitted.set(this._formDirective?.submitted ?? false);

      const subscription = control.events.subscribe((event) => {
        if (event instanceof StatusChangeEvent) {
          this._controlErrors.set(control.errors);
        } else if (event instanceof TouchedChangeEvent) {
          this._controlTouched.set(event.touched);
        } else if (event instanceof PristineChangeEvent) {
          this._controlDirty.set(!event.pristine);
        }
      });

      const formDirective = this._formDirective;
      if (formDirective) {
        const formControl = (formDirective as FormGroupDirective | NgForm).form;
        const formSub = formControl.events.subscribe(() => {
          this._formSubmitted.set(formDirective.submitted);
        });
        subscription.add(formSub);
      }

      onCleanup(() => subscription.unsubscribe());
    });

    // Dev-only diagnostic: a projected label that names nothing. This is the
    // silent half of #197 — the field renders exactly the same either way, so
    // without a warning an unnamed control ships looking correct.
    effect(() => {
      if (!isDevMode()) return;
      const label = this._label();
      // Nothing to associate, or the consumer already wired it by hand.
      if (!label || label.for()) return;
      // A native `<label for>` resolved.
      if (this.labelableControlId()) return;
      // An `aria-labelledby` resolved: the control reports a non-labelable
      // target, which it names itself from `labelId()`.
      if (this._control()?.labelTarget?.()) return;
      // The control does name itself, from its own [label] — a different
      // defect, reported by the effect below. Telling the author to reach for
      // [label] when they already have would be actively misleading.
      if (this._hasDoubleLabel()) return;

      const name = this._controlName();
      if (WARNED_UNASSOCIATED_LABELS.has(name)) return;
      WARNED_UNASSOCIATED_LABELS.add(name);
      console.warn(
        `[mlv-form-field] The projected <mlv-label> names nothing: ${name} ` +
          'reports no label target, so neither a native `for` nor an ' +
          '`aria-labelledby` could be resolved. Give the control its own ' +
          '[label] or [ariaLabel], or set [for] on the <mlv-label> and a ' +
          'matching [id] on the control.',
      );
    });

    // Dev-only diagnostic: the control names itself *and* a label is projected
    // beside it. Both render, and on a labelable control both `<label>`s carry
    // the same `for`, so the accessible name becomes their concatenation
    // ("Start Meeting time") rather than either one.
    effect(() => {
      if (!isDevMode() || !this._hasDoubleLabel()) return;

      const name = this._controlName();
      if (WARNED_DOUBLE_LABELS.has(name)) return;
      WARNED_DOUBLE_LABELS.add(name);
      console.warn(
        `[mlv-form-field] The control has two labels: ${name} renders its own ` +
          'from [label] and an <mlv-label> is projected beside it. Both are ' +
          'visible, and the accessible name is their concatenation rather ' +
          'than either one. Keep one — drop the projected <mlv-label>, or ' +
          "clear the control's [label].",
      );
    });

    // Dev-only diagnostic: a validator key with no mapped message renders the
    // generic fallback, which is correct for users but usually a gap for the
    // author. Warned once per key per application run.
    effect(() => {
      const key = this._unmappedErrorKey();
      if (!key || !isDevMode() || WARNED_UNMAPPED_KEYS.has(key)) return;
      WARNED_UNMAPPED_KEYS.add(key);
      console.warn(
        `[mlv-form-field] No message is mapped for the validator key "${key}"; ` +
          `showing the generic message instead. Supply one through [errorMessages].`,
      );
    });
  }

  /** @private Whether validation errors should currently be displayed, per {@link displayStrategy}. */
  private readonly _shouldDisplay = computed(() => {
    const signalState = this._signalFieldState();
    switch (this.displayStrategy()) {
      case 'touched':
        return signalState ? signalState.touched() : this._controlTouched();
      case 'dirty':
        return signalState ? signalState.dirty() : this._controlDirty();
      case 'submit':
        // Signal forms: submission is field-tree-level state; the closest
        // per-field proxy is touched (submit() marks all fields touched).
        return signalState ? signalState.touched() : this._formSubmitted();
      case 'immediate':
        return true;
    }
  });

  /**
   * @private Unified error view: `[key, errorPayload]` pairs from whichever
   * forms API the projected control is bound through. Signal-forms
   * `ValidationError`s are keyed by their lower-cased `kind` (matching the
   * legacy reactive keys: `minLength` → `minlength`); the payload is the
   * error object itself (it carries `message` when a rule supplied one).
   */
  private readonly _errorEntries = computed<[string, unknown][]>(() => {
    const signalState = this._signalFieldState();
    if (signalState) {
      return signalState
        .errors()
        .map((error) => [error.kind.toLowerCase(), error]);
    }
    const errors = this._controlErrors();
    return errors ? Object.entries(errors) : [];
  });

  /** The resolved auto error message for the projected control, or `''` when none should show. */
  readonly autoErrorMessage = computed(() => {
    const entries = this._errorEntries();
    if (entries.length === 0 || !this._shouldDisplay()) return '';

    const customMessages = this.errorMessages();
    const [key, payload] = entries[0];
    const custom = customMessages[key];
    if (custom) {
      return typeof custom === 'function' ? custom(payload) : custom;
    }
    // Signal-forms rules can carry their own message — prefer it.
    const ruleMessage = (payload as { message?: string } | null)?.message;
    if (ruleMessage) return ruleMessage;
    const defaultFn = DEFAULT_ERROR_MESSAGES[key];
    if (defaultFn) {
      return defaultFn(payload);
    }
    // Unknown validator key: never surface the raw key to end users.
    return this._genericErrorMessage();
  });

  /**
   * @private Neutral, translated message shown when a validator key has no
   * consumer-supplied, rule-supplied or built-in message.
   */
  private readonly _genericErrorMessage = computed(
    () => this._i18n?.().invalidValue ?? 'This value is invalid',
  );

  /**
   * @private The currently displayed validator key that has no mapped message
   * and therefore falls back to {@link _genericErrorMessage} — `null` when a
   * specific message applies. Drives the dev-mode warning only.
   */
  private readonly _unmappedErrorKey = computed<string | null>(() => {
    const entries = this._errorEntries();
    if (entries.length === 0 || !this._shouldDisplay()) return null;
    const [key, payload] = entries[0];
    if (this.errorMessages()[key]) return null;
    if ((payload as { message?: string } | null)?.message) return null;
    if (DEFAULT_ERROR_MESSAGES[key]) return null;
    return key;
  });

  /**
   * @private Class name of the projected control, for the dev-mode warnings —
   * also their de-duplication key. A plain method, not a `computed`: both
   * callers already read `_control()` inside a tracked effect, and the value
   * is wanted at most once per class per application run.
   *
   * `constructor.name` rather than the host element's tag, so no extra content
   * query has to be registered and matched in production builds just to feed a
   * message `isDevMode()` gates off there. Minification is not a risk for the
   * same reason it is not for the message text: nothing reads this unless
   * `isDevMode()` is true, and ng-packagr does not minify the published
   * bundles. Falls back to a description of the shape rather than an empty
   * string, so the message always says what it looked at.
   */
  private _controlName(): string {
    return this._control()?.constructor.name ?? 'the projected control';
  }

  /**
   * @private Whether a projected `<mlv-label>` and the projected control's own
   * `label` input both name that control. Drives the dev-mode warning only —
   * the field emits the same markup either way, which is what makes the shape
   * worth reporting.
   */
  private readonly _hasDoubleLabel = computed(() => {
    if (!this._label()) return false;
    return !!this._control()?.label?.();
  });

  /**
   * @protected Id stamped on the auto error `<mlv-message>`. Generated once per
   * field, so every field on a page names its own message.
   */
  protected readonly _errorMessageId = `${mlvNextId('mlv-form-field')}-error`;

  /**
   * Id of the auto error message while it is rendered, `null` otherwise — see
   * {@link MlvFormFieldAccessor.errorMessageId}. The projected control appends
   * it to its `aria-describedby`, so the reason stays attached to the control
   * after the message's one-time `role="alert"` announcement (#320).
   */
  readonly errorMessageId = computed<string | null>(() =>
    this.autoErrorMessage() ? this._errorMessageId : null,
  );

  /** The effective visual state: `'error'` when an auto error message is shown, otherwise {@link state}. */
  readonly resolvedState = computed<MlvFormState>(() => {
    if (this.autoErrorMessage()) return 'error';
    return this.state();
  });
}
