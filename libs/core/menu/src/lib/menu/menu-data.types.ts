import type { Observable } from 'rxjs';
import type { MlvDataSource } from '@malva-ui/cdk/data-source';

/** Serializable item data consumed by reactive menus. */
export interface MlvMenuItemData<T = unknown> {
  /** Stable item identifier used for tracking and selection. */
  readonly id: string | number;
  /** Visible label rendered for the menu item. */
  readonly label: string;
  /** Optional consumer-owned payload associated with the item. */
  readonly data?: T;
  /** Whether the item is present but not interactive. */
  readonly disabled?: boolean;
  /** Optional lazy child stream for submenu items. */
  readonly children?: Observable<MlvMenuItemData<T>[]>;
}

/** Menu item collections accepted by the reactive menu APIs. */
export type MlvMenuDataSource<T> = T[] | MlvDataSource<T>;

/** Divider row data used by menubars that mix items and separators. */
export interface MlvMenubarDividerData {
  /** Discriminator for separator entries. */
  readonly kind: 'divider';
  /** Stable divider identifier used for tracking. */
  readonly id: string | number;
}

/** One menubar row entry: an item or a visual divider. */
export type MlvMenubarEntry<TItem> = TItem | MlvMenubarDividerData;

/** Context exposed to a custom `[mlvMenuItemDef]` template. */
export interface MlvMenuItemDefContext<T> {
  /** The rendered item data for the current row. */
  $implicit: T;
  /** Zero-based item index within the rendered collection. */
  index: number;
  /** Whether the item currently advertises a child menu. */
  hasChildren: boolean;
  /** Whether child items are still loading for this row. */
  loading: boolean;
}
