/**
 * Represents a single node in the tree data structure.
 * The generic parameter `T` is the type of the node's data payload.
 */
export interface MlvTreeNode<T = unknown> {
  /** Unique identifier for the node. Used for tracking and key management. */
  id: string | number;

  /** The data payload associated with this node. */
  data: T;

  /** Human-readable label shown in the default node template. */
  label: string;

  /** Pre-loaded children of this node. If omitted and `loadChildren` is set, children are loaded lazily. */
  children?: MlvTreeNode<T>[];

  /**
   * Async callback for lazy-loading child nodes.
   * When defined, the node shows a loading spinner on first expand until the promise resolves.
   */
  loadChildren?: () => Promise<MlvTreeNode<T>[]>;

  /** When true, the node is rendered as disabled — not selectable or expandable via keyboard. */
  disabled?: boolean;

  /** Optional icon name (Lucide icon) shown before the label in the default template. */
  icon?: string;

  /** When true, the node starts expanded. Only applies to initial render. */
  expanded?: boolean;
}

/**
 * Internal flat-list representation of a tree node used for rendering.
 * Calculated from the tree data by depth and expansion state.
 */
export interface MlvFlatTreeNode<T = unknown> {
  /** Reference to the original tree node. */
  node: MlvTreeNode<T>;

  /** Depth level (0 = root). Used for indentation. */
  depth: number;

  /** Whether this node is currently expanded. */
  isExpanded: boolean;

  /** Whether this node has children (loaded or lazy). */
  hasChildren: boolean;

  /** Whether this node is currently loading children (lazy load in progress). */
  isLoading: boolean;

  /** Unique key for `@for` tracking. */
  key: string | number;
}

/** Selection mode for the tree component. */
export type MlvTreeSelectMode = 'none' | 'single' | 'multi';
