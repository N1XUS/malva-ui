import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';

/**
 * How an `<mlv-label>` rendered **outside** a control — projected beside it
 * into `mlv-form-field` — is able to name that control.
 *
 * Only the control knows: the answer depends on which element inside its
 * template carries {@link MlvFormControl.labelTarget}'s id, and that element is
 * private to the control's view.
 *
 * - `'native'` — the id lands on an HTML **labelable** element (`button`,
 *   `input`, `meter`, `output`, `progress`, `select`, `textarea`), so a plain
 *   `<label for>` names it. Preferred: it is the native association, and it
 *   also makes clicking the label focus the control.
 * - `'aria'` — the id lands on an element that `<label for>` cannot name (a
 *   `div[role="combobox"]`, a `role="radiogroup"` host, …), so the control
 *   references the label through `aria-labelledby` instead.
 * - `'none'` — no single element outside the control can be pointed at (the
 *   control is a composite such as `mlv-slider`'s two thumbs or
 *   `mlv-pin-input`'s cells, or it already names itself from projected content
 *   like `mlv-checkbox`). `mlv-form-field` then emits no association at all —
 *   never a dangling `for` — and warns in dev mode so the author reaches for
 *   the control's own `label` / `ariaLabel` input.
 */
export type MlvFormControlLabelStrategy = 'native' | 'aria' | 'none';

/**
 * The element inside a control that takes an accessible name from a label
 * rendered outside it. See {@link MlvFormControlLabelStrategy}.
 */
export interface MlvFormControlLabelTarget {
  /** HTML id of the element that carries the control's accessible name. */
  readonly id: string;
  /**
   * Whether that element is HTML-labelable, i.e. whether `<label for>` names
   * it. `false` means the control consumes the label through
   * `aria-labelledby` instead.
   */
  readonly labelable: boolean;
}

/**
 * The half of `MlvFormField` its two projected children read.
 *
 * `mlv-form-field` is the only component that sees both an `<mlv-label>` and a
 * control, so it is the only place the association between them can be made —
 * but content projection means it cannot bind inputs on either. Both sides
 * therefore **pull** from the field through this token, following
 * `.claude/rules/angular-directive.md` § _Injection Tokens for Parent–Child
 * Communication_: the field provides itself, the children inject it optionally
 * and keep working standalone when it is absent.
 */
export interface MlvFormFieldAccessor {
  /**
   * Id of the `<label>` element rendered by the `<mlv-label>` projected into
   * this field — `null` when the field has no projected label. Controls whose
   * {@link MlvFormControlLabelStrategy} is `'aria'` point `aria-labelledby` at
   * it.
   */
  readonly labelId: Signal<string | null>;

  /**
   * Id the projected `<mlv-label>` should put in its `for` attribute — `null`
   * unless the projected control reports a `'native'`
   * {@link MlvFormControlLabelStrategy}. Never a best guess: emitting a `for`
   * that names nothing is the defect this exists to remove (#197).
   */
  readonly labelableControlId: Signal<string | null>;

  /**
   * Id of the auto error `<mlv-message>` this field is **currently
   * rendering** — `null` whenever it renders none, so a control that
   * references it never emits a dangling IDREF. Every control built on
   * `MlvSignalFormUiControlBase` appends it to its `aria-describedby`, which
   * is what keeps the reason attached to the control after the message's
   * one-time `role="alert"` announcement (#320).
   *
   * Optional so an externally-authored accessor stays valid: adding a
   * required member to the value an exported token carries is its own major.
   * `mlv-form-field` always provides it.
   */
  readonly errorMessageId?: Signal<string | null>;
}

export const MLV_FORM_FIELD = new InjectionToken<MlvFormFieldAccessor>(
  'MLV_FORM_FIELD',
);
