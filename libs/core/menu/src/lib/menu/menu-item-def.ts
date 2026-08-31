import { Directive, TemplateRef, inject } from '@angular/core';
import type { MlvMenuItemData, MlvMenuItemDefContext } from './menu-data.types';

/** Marks a custom template for rendering reactive menu items. */
@Directive({
  selector: '[mlvMenuItemDef]',
})
export class MlvMenuItemDef<
  T extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>,
> {
  /** The template reference used for each rendered menu row. */
  readonly templateRef = inject(TemplateRef<MlvMenuItemDefContext<T>>);

  /** Type guard so `let-` variables infer from `MlvMenuItemDefContext<T>`. */
  static ngTemplateContextGuard<T extends MlvMenuItemData<unknown>>(
    _directive: MlvMenuItemDef<T>,
    _context: unknown,
  ): _context is MlvMenuItemDefContext<T> {
    return true;
  }
}
