import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MLV_FORM_UTILS_I18N } from '@malva-ui/i18n';

@Component({
  selector: 'mlv-label',
  template: `
    <label [attr.for]="for()">
      <ng-content />
      @if (required()) {
        <span class="mlv-label__required" aria-hidden="true">*</span>
        <span class="cdk-visually-hidden">{{ _requiredText() }}</span>
      }
      <span class="mlv-label__hint">
        <ng-content select="mlv-hint" />
      </span>
    </label>
  `,
  styleUrl: './label.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-label',
  },
})
export class MlvLabel {
  /** Id of the control this label names, rendered as the native `for` attribute. */
  readonly for = input<string>('');

  /**
   * Whether the labelled control is required. Renders a visual `*` marker plus
   * a visually-hidden, translated "required" word so the requirement is
   * announced even where `aria-required` is not surfaced. Controls extending
   * `MlvSignalFormUiControlBase` forward their own `required` input here.
   */
  readonly required = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * @private The form-utils i18n strings. Optional so a bare `mlv-label` still
   * renders in applications that never called `provideMlvI18n()`.
   */
  private readonly _i18n = inject(MLV_FORM_UTILS_I18N, { optional: true });

  /** @protected Translated word announced after the label of a required control. */
  protected readonly _requiredText = computed(
    () => this._i18n?.().required ?? 'required',
  );
}
