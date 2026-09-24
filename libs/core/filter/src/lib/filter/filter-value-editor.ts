import { Directive, inject, input, TemplateRef } from '@angular/core';
import type { MlvFilterCondition, MlvFilterOperator } from '../filter.types';

/** Template context available to a custom condition value editor. */
export interface MlvFilterValueEditorContext {
  /** Current condition value (scalar, or the range array for `between`). */
  $implicit: unknown;
  /** Full condition being edited. */
  condition: MlvFilterCondition;
  /** Condition index within the editor. */
  index: number;
  /** Current operator of the condition. */
  operator: MlvFilterOperator;
  /** Whether the editor must reject changes (filter disabled or loading). */
  disabled: boolean;
  /** Resolved value placeholder. */
  placeholder: string;
  /**
   * Localized accessible name for this condition's value control — the name
   * the built-in input carries ("Status, condition 1 value"). Bind it to the
   * custom control so the operator select and the value are told apart.
   */
  ariaLabel: string;
  /**
   * Localized accessible names for the lower and upper control of a
   * `between` range ("Status, condition 1 from" / "… to"), in that order.
   * Supplied for every operator, so a template can bind it before switching.
   */
  rangeAriaLabels: readonly [from: string, to: string];
  /** Writes the draft value; commits immediately in live apply mode. */
  setValue: (value: unknown) => void;
  /** Applies the draft in explicit mode (Enter-equivalent). No-op in live mode. */
  commit: () => void;
}

/**
 * Marks an `ng-template` as the value editor for free-form filter conditions.
 * Standalone `mlv-filter`: project the template as content. Inside
 * `mlv-smart-filter-bar`: set the input to a definition key to target one
 * field; an empty key is the fallback for every free-form field.
 *
 * ```html
 * <mlv-filter label="Renewal" editor="text">
 *   <ng-template mlvFilterValueEditor let-value let-set="setValue">
 *     <mlv-day-picker [value]="$any(value)" (valueChange)="set($event)" />
 *   </ng-template>
 * </mlv-filter>
 * ```
 */
@Directive({ selector: '[mlvFilterValueEditor]' })
export class MlvFilterValueEditorDef {
  /** Definition key this editor targets; empty targets all free-form fields. */
  readonly mlvFilterValueEditor = input<string>('');

  /** The template rendered in place of the built-in value input. */
  readonly templateRef = inject(TemplateRef<MlvFilterValueEditorContext>);

  /**
   * Type guard for template context inference.
   * @internal
   */
  static ngTemplateContextGuard(
    _dir: MlvFilterValueEditorDef,
    _ctx: unknown,
  ): _ctx is MlvFilterValueEditorContext {
    return true;
  }
}
