import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvSegmentedItem } from './segmented-item/segmented-item';

/**
 * Contract `mlvSegmentedItem` uses to talk to its `mlv-segmented` parent
 * without importing the concrete class (avoids the item ↔ container import
 * cycle).
 */
export interface MlvSegmentedAccessor {
  /** Current group value (radio mode). */
  readonly value: Signal<unknown>;
  /** Group-level disabled state (input or form field). */
  readonly computedDisabled: Signal<boolean>;
  /** Group-level readonly state — items stay focusable, selection is blocked. */
  readonly readonly: Signal<boolean>;
  /** Selects `item` (radio mode). No-op for disabled/readonly groups. */
  selectItem(item: MlvSegmentedItem): void;
  /** Keeps the key manager's active item in sync with DOM focus. */
  onItemFocus(item: MlvSegmentedItem): void;
}

/** Injection token through which items reach their `mlv-segmented`. */
export const MLV_SEGMENTED = new InjectionToken<MlvSegmentedAccessor>(
  'MLV_SEGMENTED',
);
