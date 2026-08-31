import { Directive, TemplateRef, inject } from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';

/**
 * The template context provided to `[mlvTokenTemplate]` templates.
 * Use `let-option` to bind `$implicit` (the token's MlvSelectOption).
 */
export interface MlvTokenTemplateContext<T = unknown> {
  /** The token's MlvSelectOption value — also bound to `let-option`. */
  $implicit: MlvSelectOption<T>;
  /** Zero-based index of this token in the visible tokens list. */
  index: number;
  /** Whether the remove button is active (false when the tokenizer is disabled). */
  removable: boolean;
  /** Call this to programmatically remove the token. */
  remove: () => void;
}

@Directive({
  selector: '[mlvTokenTemplate]',
})
export class MlvTokenTemplate<T = unknown> {
  /** The template reference for the custom token rendering slot. */
  readonly templateRef = inject(TemplateRef<MlvTokenTemplateContext<T>>);

  /**
   * Type guard for correct template variable inference.
   * Allows `let-option`, `let-index`, `let-removable`, and `let-remove` to be
   * strongly-typed in the consuming template.
   */
  static ngTemplateContextGuard<T>(
    _dir: MlvTokenTemplate<T>,
    _ctx: unknown,
  ): _ctx is MlvTokenTemplateContext<T> {
    return true;
  }
}
