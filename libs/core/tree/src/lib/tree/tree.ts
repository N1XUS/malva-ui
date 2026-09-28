import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
  type OnInit,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { Tree } from '@angular/aria/tree';
import type {
  MlvTreeLoadError,
  MlvTreeNode,
  MlvTreeSelectMode,
} from './tree-node';
import { MlvTreeNodeDef } from './tree-node-def';
import { MLV_TREE } from './tree-context';
import type { MlvTreeAccessor } from './tree-context';
import { MlvTreeSubtree } from './tree-subtree';
import type { TreeItem } from '@angular/aria/tree';
import { provideMlvScopedDirectionality } from '@malva-ui/cdk/utils';

// Re-export for convenience
export { MLV_TREE };
export type { MlvTreeAccessor };

/** `aria-current` type surfaced when the tree is used as a navigation tree. */
export type MlvTreeCurrentType =
  | 'page'
  | 'step'
  | 'location'
  | 'date'
  | 'time'
  | 'true'
  | 'false';

/**
 * Hierarchical data tree component for displaying nested data.
 *
 * Built on the `@angular/aria` headless `Tree`/`TreeItem`/`TreeItemGroup`
 * directives (applied inside the component — consumers never see `ng*`
 * selectors). aria owns roles, `aria-level`/`setsize`/`posinset`, roving
 * `tabindex`, keyboard navigation (arrows, Home/End), text typeahead, and
 * selection; the component keeps the Malva UI data-driven `nodes` API, the
 * `mlv-expand` animated expand/collapse, lazy loading, custom node templates,
 * and multi-select checkboxes.
 *
 * Features:
 * - Expand/collapse nodes with smooth animated height transition via `mlv-expand`
 * - Single-select and multi-select checkbox mode
 * - Lazy loading via `loadChildren` callbacks with spinner
 * - Full keyboard navigation and text typeahead (owned by `@angular/aria`)
 * - Custom node templates via `[mlvTreeNodeDef]`
 * - Optional navigation-tree mode (`nav` + `currentType`) for sidebar-style trees
 * - Generic typed `MlvTreeNode<T>` interface
 * - Recursive rendering via internal `MlvTreeSubtree`
 *
 * @example
 * ```html
 * <mlv-tree [nodes]="treeData" selectMode="multi" (selectionChange)="onSelect($event)" />
 * ```
 */
@Component({
  selector: 'mlv-tree',
  // The aria `Tree` directive is applied to an inner `[ngTree]` element rather
  // than as a `hostDirective`: aria's config inputs (`multi`, `selectionMode`,
  // `softDisabled`) are derived internally from `selectMode` and CANNOT be set
  // on a host directive from the component's own `host` metadata (silently
  // ignored — verified). Binding them on an in-template element works. aria owns
  // `role="tree"`, `aria-multiselectable/orientation/disabled/activedescendant`,
  // the roving tabindex and all keyboard/pointer handling on `.mlv-tree__root`.
  template: `
    <div
      class="mlv-tree__root"
      ngTree
      #root="ngTree"
      [multi]="selectMode() === 'multi'"
      [selectionMode]="'explicit'"
      [softDisabled]="true"
      [wrap]="false"
      [nav]="nav()"
      [currentType]="currentType()"
      [value]="_value()"
      (valueChange)="_onAriaValueChange($event)"
    >
      <mlv-tree-subtree [nodes]="nodes()" [parent]="root" [depth]="0" />
    </div>
  `,
  styleUrl: './tree.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Tree, MlvTreeSubtree],
  providers: [
    {
      provide: MLV_TREE,
      useExisting: forwardRef(() => MlvTree),
    },
  ],
  // `@angular/aria`'s `Tree` (`ngTree` in this template) injects the CDK
  // `Directionality`: in RTL it swaps ArrowRight / ArrowLeft for expand /
  // collapse (and for next / previous in a horizontal tree). The scoped
  // provider makes that follow the nearest `[dir]` above the tree, as the
  // indent and the mirrored chevrons already do. `viewProviders`: the pattern
  // lives in the view, so consumer node templates keep their own.
  viewProviders: [provideMlvScopedDirectionality()],
  host: {
    class: 'mlv-tree',
    '[class.mlv-tree--connectors]': 'showConnectors()',
  },
})
export class MlvTree<T = unknown> implements OnInit, MlvTreeAccessor {
  /** The tree nodes to render. Supports nested children. */
  readonly nodes = input<MlvTreeNode<T>[]>([]);

  /**
   * Selection mode:
   * - `'none'` — no selection (default); rows are activated (`nodeActivate`)
   * - `'single'` — click/Space/Enter selects one node at a time
   * - `'multi'` — checkbox-based multi-select
   */
  readonly selectMode = input<MlvTreeSelectMode>('none');

  /** Indentation per depth level in `rem`. Defaults to `1.5`. */
  readonly indentSize = input<number>(1.5);

  /**
   * When true, renders vertical and horizontal connector lines between parent and child nodes
   * (file-explorer pattern). Defaults to `false`.
   */
  readonly showConnectors = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When true, the tree renders as a navigation tree: selected rows expose
   * `aria-current` (of `currentType`) instead of `aria-selected`. Suited to
   * sidebar-style navigation trees. Defaults to `false`.
   */
  readonly nav = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** The `aria-current` type used when `nav` is enabled. Defaults to `'page'`. */
  readonly currentType = input<MlvTreeCurrentType>('page');

  /** Emits the set of selected node IDs whenever the selection changes. */
  readonly selectionChange = output<Set<string | number>>();

  /** Emits when a node is activated (clicked or Enter in single-select/none mode). */
  readonly nodeActivate = output<MlvTreeNode<T>>();

  /**
   * Emits when a node's expanded state changes — by the user, or by the tree
   * itself when it collapses a node whose `loadChildren()` failed. Not
   * emitted for the programmatic `expandNode` / `collapseNode` /
   * `expandAll` / `collapseAll`.
   */
  readonly nodeToggle = output<{ node: MlvTreeNode<T>; expanded: boolean }>();

  /**
   * Emits when a node's `loadChildren()` rejects or throws. By then the tree
   * has cleared the loading spinner, collapsed the node if it was still
   * expanded (emitting `nodeToggle` with `expanded: false` first) and cached
   * nothing, so the next expand calls `loadChildren()` again. The tree shows
   * no error text of its own: use this to tell the user, or to log.
   */
  readonly loadError = output<MlvTreeLoadError<T>>();

  /**
   * @public Selected node ids, mirrored to the aria `Tree.value` model (aria
   * selection is always an array — a single-select tree holds at most one id).
   */
  readonly _value = signal<(string | number)[]>([]);

  /**
   * @private Selection membership set derived from `_value`. Rebuilt only when
   * the selection changes, giving `_isSelected` an O(1) lookup instead of an
   * O(selected) array scan on every node (twice per row) per change-detection
   * pass. Mirrors the `_expandedIds`/`_loadingIds` Set pattern.
   */
  private readonly _selectedIdSet = computed(() => new Set(this._value()));

  /** @public Internal expansion state set (node id → expanded). */
  readonly _expandedIds = signal<Set<string | number>>(new Set());

  /** @public Map of node id → loaded children (for lazy nodes). */
  readonly _loadedChildren = signal<Map<string | number, MlvTreeNode<T>[]>>(
    new Map(),
  );

  /** @private Set of node ids currently loading lazy children. */
  private readonly _loadingIds = signal<Set<string | number>>(new Set());

  /** @public The custom node template if provided. */
  readonly _nodeDefDirective = contentChild(MlvTreeNodeDef<T>);

  /**
   * @private Read when a lazy load fails, so a load that outlives the tree
   * does not emit on its destroyed outputs.
   */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private The host element; a failed lazy load checks that the node's aria
   * item is still rendered inside it before collapsing it through its model.
   */
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit(): void {
    // Seed expansion state from nodes flagged `expanded: true`.
    const initialExpanded = new Set<string | number>();
    this._collectInitialExpanded(this.nodes(), initialExpanded);
    this._expandedIds.set(initialExpanded);
  }

  /** @private Collect nodes that have `expanded: true` initially. */
  private _collectInitialExpanded(
    nodes: MlvTreeNode<T>[],
    result: Set<string | number>,
  ): void {
    for (const node of nodes) {
      if (node.expanded) {
        result.add(node.id);
      }
      if (node.children?.length) {
        this._collectInitialExpanded(node.children, result);
      }
    }
  }

  // --- MlvTreeAccessor: state queries -------------------------------------

  /** @public Whether the given node id is currently expanded. */
  _isExpanded(id: string | number): boolean {
    return this._expandedIds().has(id);
  }

  /** @public Whether the given node id is currently loading lazy children. */
  _isLoading(id: string | number): boolean {
    return this._loadingIds().has(id);
  }

  /** @public Whether the given node id is currently selected. */
  _isSelected(id: string | number): boolean {
    return this._selectedIdSet().has(id);
  }

  /**
   * @public Effective children of a node — lazily-loaded children when present,
   * otherwise the static `children` array.
   */
  _children(node: MlvTreeNode<T>): MlvTreeNode<T>[] {
    return this._loadedChildren().get(node.id) ?? node.children ?? [];
  }

  /** @public Whether a node renders an expandable group (static/loaded/lazy children). */
  _hasChildren(node: MlvTreeNode<T>): boolean {
    return this._children(node).length > 0 || !!node.loadChildren;
  }

  // --- MlvTreeAccessor: interaction ---------------------------------------

  /**
   * @public Reacts to the aria `TreeItem.expanded` model changing (keyboard,
   * pointer, chevron, or programmatic). Syncs the expansion set, triggers lazy
   * loading, and emits `nodeToggle`. `item` is handed to the lazy load, whose
   * failure path collapses the node through it.
   */
  _onExpandedChange(
    node: MlvTreeNode<T>,
    expanded: boolean,
    item: TreeItem<string | number>,
  ): void {
    if (expanded) {
      this._expandedIds.update((s) => {
        const next = new Set(s);
        next.add(node.id);
        return next;
      });
      if (
        node.loadChildren &&
        !this._loadedChildren().has(node.id) &&
        !this._loadingIds().has(node.id)
      ) {
        this._loadLazy(node, item);
      }
      this.nodeToggle.emit({ node, expanded: true });
    } else {
      this._expandedIds.update((s) => {
        const next = new Set(s);
        next.delete(node.id);
        return next;
      });
      this.nodeToggle.emit({ node, expanded: false });
    }
  }

  /**
   * @public Chevron toggle handler. Guards disabled nodes, stops propagation so
   * the aria tree does not also select the row, and flips the aria item's
   * `expanded` model (which routes through `_onExpandedChange`).
   */
  _onToggle(
    node: MlvTreeNode<T>,
    item: TreeItem<string | number>,
    event: Event,
  ): void {
    event.stopPropagation();
    if (node.disabled) return;
    item.expanded.set(!item.expanded());
  }

  /**
   * @public Row pointer handler. Emits `nodeActivate` in `none` mode and
   * implements the single-select deselect-on-re-click affordance (aria's
   * `selectOne` never deselects on its own).
   */
  _onRowClick(node: MlvTreeNode<T>, event: MouseEvent): void {
    if (node.disabled) return;
    const mode = this.selectMode();
    if (mode === 'none') {
      this.nodeActivate.emit(node);
      return;
    }
    if (mode === 'single') {
      const current = this._value();
      if (current.length === 1 && current[0] === node.id) {
        // Re-clicking the sole selected node clears it. aria's selectOne would
        // re-select it, so clear the model and stop the aria tree click.
        this._value.set([]);
        this.selectionChange.emit(new Set());
        event.stopPropagation();
      }
      // First selection: aria selectOne handles it; `nodeActivate` is emitted
      // from `_onAriaValueChange` (covers pointer and keyboard selection).
    }
    // multi mode: aria toggles selection on row click; no `nodeActivate`.
  }

  /** @public Row Enter/Space handler used to emit `nodeActivate` in `none` mode. */
  _onActivateKey(node: MlvTreeNode<T>): void {
    if (node.disabled) return;
    if (this.selectMode() === 'none') {
      this.nodeActivate.emit(node);
    }
  }

  /**
   * @public Bridges the aria `Tree.value` model to `selectionChange`. Also
   * emits `nodeActivate` for user-driven single-select (pointer or keyboard);
   * programmatic selection goes through `setSelection` instead.
   */
  _onAriaValueChange(value: (string | number)[]): void {
    this._value.set(value);
    this.selectionChange.emit(new Set(value));
    if (this.selectMode() === 'single' && value.length === 1) {
      const node = this._findNode(value[0]);
      if (node) {
        this.nodeActivate.emit(node);
      }
    }
  }

  /**
   * @private Loads a lazy node's children and caches them, leaving the node's
   * expansion alone so a node collapsed during the load stays collapsed.
   *
   * `loadChildren()` runs synchronously here, called as a method of the node
   * so a class-model or object-literal loader keeps `this` — never read into
   * a local first, which would drop the receiver. Its promise goes through
   * `Promise.resolve()`, which hands a native promise back unchanged, so the
   * success callback runs in the same microtask it always did; a synchronous
   * throw becomes a rejected promise instead of escaping into the aria
   * `expandedChange` handler. Both outcomes settle in a later microtask, and
   * either way the id leaves the loading set, so the spinner goes and the
   * retry guard in `_onExpandedChange` lets the next expand call
   * `loadChildren()` again.
   */
  private _loadLazy(
    node: MlvTreeNode<T>,
    item: TreeItem<string | number>,
  ): void {
    if (!node.loadChildren) return;
    this._loadingIds.update((s) => {
      const next = new Set(s);
      next.add(node.id);
      return next;
    });
    let pending: Promise<MlvTreeNode<T>[]>;
    try {
      pending = Promise.resolve(node.loadChildren());
    } catch (error: unknown) {
      pending = Promise.reject(error);
    }
    pending.then(
      (children) => {
        this._loadedChildren.update((m) => {
          const next = new Map(m);
          next.set(node.id, children);
          return next;
        });
        this._clearLoading(node.id);
      },
      (error: unknown) => this._failLazy(node, item, error),
    );
  }

  /**
   * @private Recovers from a rejected (or throwing) `loadChildren()`: clears
   * the loading state, collapses the node if it is still expanded — so an
   * expanded row never sits over an empty group, and one expand retries —
   * emitting `nodeToggle` for that collapse, then emits `loadError`. Nothing
   * is cached, so the next expand calls `loadChildren()` again. Handling the
   * rejection here is what keeps it from surfacing as an unhandled one.
   *
   * Two steps collapse the node:
   *
   * 1. While the item is rendered in this tree and its node is still in
   *    `nodes`, the aria item's `expanded` model is set to `false`. That routes
   *    back into `_onExpandedChange` (id dropped, `nodeToggle` emitted).
   *    Dropping the id alone is not enough when the load fails before change
   *    detection has run since the expand — a synchronous throw, an
   *    already-rejected promise: the `[expanded]` binding then still holds its
   *    last value, `false`, so the drop changes nothing it pushes and the item
   *    stays open. "Inside the tree's host" alone does not prove the item is
   *    alive: a leave animation (`animate.leave` in a consumer node template)
   *    keeps a destroyed row's element attached until it ends, and a destroyed
   *    item's model reaches no listener and warns NG0953. So the node must
   *    also still be in the data.
   * 2. If the id is still expanded after that — the item was destroyed, sits
   *    under a collapsed ancestor, or step 1 reached no listener — it is
   *    dropped directly and `nodeToggle` is emitted here; change detection has
   *    run since the expand in each of those cases, so the binding carries
   *    the drop. When step 1 did collapse the node, the id is already gone and
   *    this step emits nothing, so `nodeToggle` fires once.
   *
   * Residual: a node moved to another parent (or re-added elsewhere in the
   * tree) while its old row's leave animation is still running passes both
   * checks through the old item, so step 1 writes to a destroyed item and
   * Angular logs one NG0953 warning — in production too, with the message
   * text only in dev mode. Step 2 still collapses the node's new row. A
   * re-add in the same position does not reach this: Angular drops the
   * leaving row at once.
   *
   * Once the tree is destroyed nothing is emitted (a destroyed `OutputRef`
   * warns NG0953).
   */
  private _failLazy(
    node: MlvTreeNode<T>,
    item: TreeItem<string | number>,
    error: unknown,
  ): void {
    this._clearLoading(node.id);
    if (this._destroyRef.destroyed) return;
    if (
      item.expanded() &&
      this._elementRef.nativeElement.contains(item.element) &&
      this._findNode(node.id) !== undefined
    ) {
      item.expanded.set(false);
    }
    if (this._expandedIds().has(node.id)) {
      this._expandedIds.update((s) => {
        const next = new Set(s);
        next.delete(node.id);
        return next;
      });
      this.nodeToggle.emit({ node, expanded: false });
    }
    this.loadError.emit({ node, error });
  }

  /** @private Removes a node id from the loading set. */
  private _clearLoading(id: string | number): void {
    this._loadingIds.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  /** @private Recursively find a node by id across static and loaded children. */
  private _findNode(id: string | number): MlvTreeNode<T> | undefined {
    const search = (list: MlvTreeNode<T>[]): MlvTreeNode<T> | undefined => {
      for (const node of list) {
        if (node.id === id) return node;
        const children =
          this._loadedChildren().get(node.id) ?? node.children ?? [];
        const found = search(children);
        if (found) return found;
      }
      return undefined;
    };
    return search(this.nodes());
  }

  // --- Programmatic API -----------------------------------------------------

  /** @public Exposes the currently selected node ids. */
  get selectedIds(): Set<string | number> {
    return new Set(this._value());
  }

  /** Programmatically set the selected node IDs. */
  setSelection(ids: Set<string | number>): void {
    this._value.set([...ids]);
    this.selectionChange.emit(new Set(ids));
  }

  /** Programmatically expand a node by ID. */
  expandNode(nodeId: string | number): void {
    this._expandedIds.update((s) => {
      const next = new Set(s);
      next.add(nodeId);
      return next;
    });
  }

  /** Programmatically collapse a node by ID. */
  collapseNode(nodeId: string | number): void {
    this._expandedIds.update((s) => {
      const next = new Set(s);
      next.delete(nodeId);
      return next;
    });
  }

  /** Expand all nodes. */
  expandAll(): void {
    const allIds = new Set<string | number>();
    this._collectAllIds(this.nodes(), allIds);
    this._expandedIds.set(allIds);
  }

  /** Collapse all nodes. */
  collapseAll(): void {
    this._expandedIds.set(new Set());
  }

  /** @private Collect all node IDs recursively. */
  private _collectAllIds(
    nodes: MlvTreeNode<T>[],
    result: Set<string | number>,
  ): void {
    for (const node of nodes) {
      result.add(node.id);
      if (node.children?.length) {
        this._collectAllIds(node.children, result);
      }
    }
  }
}
