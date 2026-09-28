import { InjectionToken } from '@angular/core';
import type { TreeItem } from '@angular/aria/tree';
import type { MlvTreeNode, MlvTreeSelectMode } from './tree-node';
import type { MlvTreeNodeDef } from './tree-node-def';

/**
 * Public accessor interface that the recursive `MlvTreeSubtree` uses to
 * communicate with its parent `MlvTree` via the `MLV_TREE` injection
 * token.
 *
 * All members map to the corresponding public members of `MlvTree`.
 * Selection, roving focus, keyboard navigation, expansion state and all ARIA
 * attributes are owned by the `@angular/aria` `Tree`/`TreeItem`/`TreeItemGroup`
 * directives applied inside the subtree template; this accessor only surfaces
 * the Malva UI-specific glue (lazy loading, custom templates, `nodeActivate`,
 * `nodeToggle`, and the single-select deselect-on-re-click affordance).
 */
export interface MlvTreeAccessor {
  /** Current selection mode. */
  selectMode(): MlvTreeSelectMode;

  /** Indentation size in rem per depth level. */
  indentSize(): number;

  /** Whether the given node id is currently expanded. */
  _isExpanded(id: string | number): boolean;

  /** Whether the given node id is currently loading lazy children. */
  _isLoading(id: string | number): boolean;

  /** Whether the given node id is currently selected. */
  _isSelected(id: string | number): boolean;

  /**
   * Returns the effective children of a node: lazily-loaded children when
   * present, otherwise the static `children` array.
   */
  _children(node: MlvTreeNode): MlvTreeNode[];

  /** Whether a node renders an expandable group (static, loaded, or lazy children). */
  _hasChildren(node: MlvTreeNode): boolean;

  /** Custom node template directive, if any. */
  _nodeDefDirective(): MlvTreeNodeDef | undefined;

  /**
   * Reacts to the aria `TreeItem.expanded` model changing (keyboard, pointer,
   * chevron, or programmatic). Syncs the expansion set, triggers lazy loading,
   * and emits `nodeToggle`. `item` is the node's aria item, which a failed
   * lazy load collapses.
   */
  _onExpandedChange(
    node: MlvTreeNode,
    expanded: boolean,
    item: TreeItem<string | number>,
  ): void;

  /**
   * Chevron toggle handler. Guards disabled nodes, stops propagation so the
   * aria tree does not also select the row, and flips the aria item's
   * `expanded` model (which routes through `_onExpandedChange`).
   */
  _onToggle(
    node: MlvTreeNode,
    item: TreeItem<string | number>,
    event: Event,
  ): void;

  /**
   * Row pointer handler. Emits `nodeActivate` in `none` mode and implements the
   * single-select deselect-on-re-click affordance (aria's `selectOne` never
   * deselects on its own).
   */
  _onRowClick(node: MlvTreeNode, event: MouseEvent): void;

  /** Row Enter/Space handler used to emit `nodeActivate` in `none` mode. */
  _onActivateKey(node: MlvTreeNode): void;
}

/**
 * Injection token that provides the parent `MlvTree` as a
 * `MlvTreeAccessor` to nested `MlvTreeSubtree` instances.
 */
export const MLV_TREE = new InjectionToken<MlvTreeAccessor>('MLV_TREE');
