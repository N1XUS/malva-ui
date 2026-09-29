import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TreeItem, TreeItemGroup } from '@angular/aria/tree';
import type { Tree } from '@angular/aria/tree';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvExpand } from '@malva-ui/core/expand';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import {
  LucideChevronRight,
  LucideChevronDown,
  LucideDynamicIcon,
} from '@lucide/angular';
import { MLV_TREE_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import type { MlvTreeI18n } from '@malva-ui/i18n';
import type { MlvFlatTreeNode, MlvTreeNode } from './tree-node';
import { MLV_TREE } from './tree-context';
import type { MlvTreeAccessor } from './tree-context';

/** The valid `parent` reference for a subtree's items: the tree root or a group. */
type TreeParent = Tree<string | number> | TreeItemGroup<string | number>;

/**
 * @private English fallbacks for the `tree` slice, used when there is no
 * `provideMlvI18n()`, or the active pack omits the slice or a key. Every key of
 * the slice is optional, so `Required<>` makes a new key fail to compile
 * without one. The strings are the English pack's and the old literals'.
 */
const OPTIONAL_MESSAGE_FALLBACKS: Readonly<Required<MlvTreeI18n>> = {
  expandNode: 'Expand {label}',
  collapseNode: 'Collapse {label}',
  loadingChildren: 'Loading children',
  selectNode: 'Select {label}',
};

/**
 * Internal recursive subtree component used by `MlvTree`.
 *
 * Renders one level of `<div ngTreeItem>` rows using the `@angular/aria`
 * `Tree`/`TreeItem`/`TreeItemGroup` headless directives (applied here so aria
 * owns roles, `aria-level`/`setsize`/`posinset`, roving `tabindex`, keyboard
 * navigation, typeahead and selection). Children are wrapped in
 * `<ng-template ngTreeItemGroup>` + `mlv-expand` for the animated height
 * transition; `[preserveContent]="true"` keeps aria's `DeferredContent` from
 * unmounting the group so `mlv-expand` can own the enter/leave animation.
 *
 * The recursion is expressed as **nested components** (not a self-referential
 * `ngTemplateOutlet`, which throws `createEmbeddedViewImpl is not a function`
 * when rendered through aria's `DeferredContent`).
 *
 * @internal Not part of the public API — use `MlvTree` instead.
 */
@Component({
  selector: 'mlv-tree-subtree',
  templateUrl: './tree-subtree.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    TreeItem,
    TreeItemGroup,
    MlvLoader,
    MlvExpand,
    LucideChevronRight,
    LucideChevronDown,
    LucideDynamicIcon,
    MlvCheckbox,
    MlvTreeSubtree,
  ],
  host: {
    class: 'mlv-tree__subtree',
  },
})
export class MlvTreeSubtree {
  /** The nodes to render at this level. */
  readonly nodes = input<MlvTreeNode[]>([]);

  /**
   * The aria parent for this level's items — the `Tree` root for the top level,
   * or the owning `TreeItemGroup` for a nested level. Required: aria's
   * `TreeItem` needs a defined `parent` from creation (its `level`/`selected`
   * patterns dereference it) — an undefined parent crashes rendering.
   */
  readonly parent = input.required<TreeParent>();

  /** The depth of this level (0 = root). Drives indentation and connectors. */
  readonly depth = input<number>(0);

  /** @protected The parent tree context injected via `MLV_TREE`. */
  protected readonly tree = inject<MlvTreeAccessor>(MLV_TREE);

  /**
   * @private The active pack's `tree` slice. Optional: without
   * `provideMlvI18n()` the names are English.
   */
  private readonly _i18n = inject(MLV_TREE_I18N, { optional: true });

  /** @private Formats the ICU names in the active pack's locale. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @protected Every name, from the pack or the English fallbacks. */
  protected readonly _messages = computed<Required<MlvTreeI18n>>(() => {
    const i18n = this._i18n?.();
    return {
      expandNode: i18n?.expandNode ?? OPTIONAL_MESSAGE_FALLBACKS.expandNode,
      collapseNode:
        i18n?.collapseNode ?? OPTIONAL_MESSAGE_FALLBACKS.collapseNode,
      loadingChildren:
        i18n?.loadingChildren ?? OPTIONAL_MESSAGE_FALLBACKS.loadingChildren,
      selectNode: i18n?.selectNode ?? OPTIONAL_MESSAGE_FALLBACKS.selectNode,
    };
  });

  /**
   * @protected Accessible name of a node's expand/collapse toggle: the pack's
   * `collapseNode` while it is expanded, `expandNode` otherwise.
   */
  protected _toggleLabel(node: MlvTreeNode, expanded: boolean): string {
    return this._label(expanded ? 'collapseNode' : 'expandNode', node);
  }

  /** @protected Accessible name of a node's checkbox in multi-select mode. */
  protected _selectLabel(node: MlvTreeNode): string {
    return this._label('selectNode', node);
  }

  /** @private Resolves one `{label}` message for `node`. */
  private _label(
    key: 'expandNode' | 'collapseNode' | 'selectNode',
    node: MlvTreeNode,
  ): string {
    return this._resolver.resolve(
      this._messages() as unknown as Record<string, string>,
      key,
      { label: node.label },
    );
  }

  /**
   * @private Per-node cache of the `[mlvTreeNodeDef]` template context and its
   * `ngTemplateOutlet` wrapper, keyed by node identity. The entry is rebuilt for
   * a node only when one of its derived fields actually changes, so the context
   * object identity stays stable across change detection — the custom template
   * (and any OnPush children inside it) is not re-stamped against a freshly
   * allocated context object on every pass.
   */
  private readonly _contextCache = new WeakMap<
    MlvTreeNode,
    { ctx: MlvFlatTreeNode; wrapper: { $implicit: MlvFlatTreeNode } }
  >();

  /**
   * @protected Returns the identity-stable `ngTemplateOutlet` context wrapper for
   * a node's `[mlvTreeNodeDef]` template. Preserves the public context shape
   * (`let-flatNode` → `MlvFlatTreeNode`). Derived from the node + component state
   * rather than aria's `TreeItem` patterns (which are only available after the
   * item's `ngOnInit`). A new wrapper (and `MlvFlatTreeNode`) is produced only when
   * a field changes, so unchanged rows keep a stable context reference across
   * change detection.
   */
  protected _nodeContext(node: MlvTreeNode): { $implicit: MlvFlatTreeNode } {
    const depth = this.depth();
    const isExpanded = this.tree._isExpanded(node.id);
    const hasChildren = this.tree._hasChildren(node);
    const isLoading = this.tree._isLoading(node.id);

    const cached = this._contextCache.get(node);
    if (
      cached &&
      cached.ctx.depth === depth &&
      cached.ctx.isExpanded === isExpanded &&
      cached.ctx.hasChildren === hasChildren &&
      cached.ctx.isLoading === isLoading
    ) {
      return cached.wrapper;
    }

    const ctx: MlvFlatTreeNode = {
      node,
      depth,
      isExpanded,
      hasChildren,
      isLoading,
      key: node.id,
    };
    const wrapper = { $implicit: ctx };
    this._contextCache.set(node, { ctx, wrapper });
    return wrapper;
  }
}
