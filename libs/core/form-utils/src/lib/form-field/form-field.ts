import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
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
import { MLV_FORM_UTILS_I18N } from '@malva-ui/i18n';

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
        <mlv-message state="error">{{ autoErrorMessage() }}</mlv-message>
      }
    </div>
  `,
  styleUrl: './form-field.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MlvFormField {
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

  /** The effective visual state: `'error'` when an auto error message is shown, otherwise {@link state}. */
  readonly resolvedState = computed<MlvFormState>(() => {
    if (this.autoErrorMessage()) return 'error';
    return this.state();
  });
}
