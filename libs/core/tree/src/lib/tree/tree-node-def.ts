import { Directive, inject, TemplateRef } from '@angular/core';
import type { MlvFlatTreeNode } from './tree-node';

/**
 * Context provided to the `[mlvTreeNodeDef]` template.
 */
export interface MlvTreeNodeDefContext<T = unknown> {
  /** The flat tree node for the current row. */
  $implicit: MlvFlatTreeNode<T>;
}

/**
 * Structural directive that marks a `<ng-template>` as a custom node template.
 *
 * Usage:
 * ```html
 * <mlv-tree [nodes]="nodes">
 *   <ng-template mlvTreeNodeDef let-flatNode>
 *     <span>{{ flatNode.node.label }}</span>
 *   </ng-template>
 * </mlv-tree>
 * ```
 */
@Directive({
  selector: '[mlvTreeNodeDef]',
})
export class MlvTreeNodeDef<T = unknown> {
  /** The template reference for this custom node slot. */
  readonly templateRef = inject(TemplateRef<MlvTreeNodeDefContext<T>>);

  /**
   * Type guard for correct template variable inference.
   * @internal
   */
  static ngTemplateContextGuard<T>(
    _dir: MlvTreeNodeDef<T>,
    _ctx: unknown,
  ): _ctx is MlvTreeNodeDefContext<T> {
    return true;
  }
}
