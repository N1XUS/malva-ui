import { Directive, inject, TemplateRef } from '@angular/core';
import type { MlvSpeedDialItemDefContext } from './speed-dial.types';

/**
 * Projects a custom template into every action button of `mlv-speed-dial`,
 * replacing the default Lucide icon. The action button itself (its `role`,
 * accessible name, tooltip and disabled state) is still owned by the speed
 * dial — the template only supplies the button's content.
 *
 * @example
 * ```html
 * <mlv-speed-dial [items]="items">
 *   <ng-template mlvSpeedDialItemDef let-item let-index="index">
 *     <mlv-avatar [name]="item.label" size="s" />
 *   </ng-template>
 * </mlv-speed-dial>
 * ```
 */
@Directive({ selector: '[mlvSpeedDialItemDef]' })
export class MlvSpeedDialItemDef {
  /** The projected template, rendered once per action. */
  readonly templateRef = inject(TemplateRef<MlvSpeedDialItemDefContext>);

  /** Type guard so `let-item` / `let-index` infer the right types. */
  static ngTemplateContextGuard(
    _dir: MlvSpeedDialItemDef,
    _ctx: unknown,
  ): _ctx is MlvSpeedDialItemDefContext {
    return true;
  }
}
