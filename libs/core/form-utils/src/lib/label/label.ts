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
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { mlvNextId } from '@malva-ui/cdk/utils';
import { MLV_FORM_UTILS_I18N } from '@malva-ui/i18n';
import { MLV_FORM_CONTROL } from '../models/form-control-connector';
import { MLV_FORM_FIELD } from '../models/form-field-connector';

@Component({
  selector: 'mlv-label',
  template: `
    <label [attr.id]="labelId" [attr.for]="_resolvedFor()">
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
  // Density: stamps `mlv-label--<density>` from the nearest density scope, so
  // two density ancestors resolve by nesting, not stylesheet order (#364).
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'label' }],
  hostDirectives: [MlvDensityDirective],
  host: {
    class: 'mlv-label',
  },
})
export class MlvLabel {
  /**
   * Id of the control this label names, rendered as the native `for`
   * attribute.
   *
   * Leaving it empty no longer means "emit `for=\"\"`". Inside an
   * `mlv-form-field` the field resolves it from the projected control — but
   * only when that control reports a **labelable** name target; otherwise no
   * `for` attribute is rendered at all, because a `for` that names nothing
   * reads as associated in review while focusing nothing (#197). An explicit
   * value always wins.
   *
   * `null` and `undefined` are accepted and mean the same as `''` — emit no
   * `for`. That is what a control binding its own label's
   * `[for]="_ownLabelFor()"` passes while its name target is not labelable
   * (#216); the read type stays `string`, so nothing that consumed this input
   * has to widen.
   */
  readonly for = input<string, string | null | undefined>('', {
    transform: (value) => value ?? '',
  });

  /**
   * Id of the rendered `<label>` element. Stable for the lifetime of the
   * component and always emitted, so an enclosing `mlv-form-field` can point a
   * control's `aria-labelledby` at it — the only association available for a
   * control whose focus target is not HTML-labelable (`mlv-select`'s
   * `div[role="combobox"]`, for instance).
   *
   * It is deliberately on the inner `<label>` rather than the `mlv-label`
   * host: a consumer (and `mlv-select` / `mlv-day-picker` themselves) may bind
   * `[id]` on the host, and two writers of one `id` is a conflict.
   */
  readonly labelId = mlvNextId('mlv-label');

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

  /**
   * @private The enclosing `mlv-form-field`, when this label is projected into
   * one. Optional so a standalone `<mlv-label>` — including the ones controls
   * render inside their own templates — keeps working unchanged.
   */
  private readonly _formField = inject(MLV_FORM_FIELD, { optional: true });

  /**
   * @private The control this label is rendered **inside**, if any.
   *
   * A control's own `<mlv-label>` — the one it renders from its `label` input,
   * in its own view — must not borrow the enclosing field's target: that
   * target is resolved from the field's *first* projected control, which in a
   * field holding more than one control is a different element. The two cases
   * separate cleanly through the node injector, which follows the declaration
   * tree: a label in a control's view is that control's descendant and
   * resolves it here, while a label projected into `mlv-form-field` beside a
   * control is its sibling and resolves `null`.
   */
  private readonly _ownerControl = inject(MLV_FORM_CONTROL, { optional: true });

  /** @protected Translated word announced after the label of a required control. */
  protected readonly _requiredText = computed(
    () => this._i18n?.().required ?? 'required',
  );

  /**
   * @protected The value actually rendered as `for`: the explicit {@link for}
   * input, else the enclosing field's labelable control id, else `null` — and
   * `null` emits no attribute rather than `for=""`.
   */
  protected readonly _resolvedFor = computed<string | null>(() => {
    const explicit = this.for();
    if (explicit) return explicit;
    if (this._ownerControl) return null;
    return this._formField?.labelableControlId() ?? null;
  });
}
