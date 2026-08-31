import { InjectionToken } from '@angular/core';

/**
 * Interface that a menu exposes to its child `MenuItemComponent` instances.
 * Used via the `MENU_TOKEN` injection token for decoupled parent–child communication.
 */
export interface MlvMenuAccessor {
  /** Closes this menu panel. */
  close(): void;

  /** Closes this menu panel and any ancestor menu panels. */
  closeAll(): void;
}

/** Injection token for the parent menu. */
export const MENU_TOKEN = new InjectionToken<MlvMenuAccessor>('MENU_TOKEN');

/** Internal data-row controller injected into generated `mlvMenuItem` views. */
export interface MlvMenuDataItemContext {
  /** Whether the generated row currently owns a submenu. */
  hasChildren(): boolean;

  /** Whether the submenu's first child payload is still loading. */
  loading(): boolean;

  /** Whether the submenu overlay is currently open. */
  isOpen(): boolean;

  /** Stable submenu panel id used for `aria-controls`. */
  panelId(): string | null;

  /** Whether the generated row should be treated as disabled. */
  isDisabled(): boolean;

  /** Opens the generated submenu. */
  open(): void;

  /** Closes the generated submenu. */
  close(): void;

  /** Toggles the generated submenu. */
  toggle(): void;

  /** Opens the submenu and focuses its first enabled child row. */
  openWithFirstItemFocused(): void;

  /** Opens the submenu and focuses its last enabled child row. */
  openWithLastItemFocused(): void;

  /** Delegates pointer entry to the shared submenu controller. */
  onMouseEnter(): void;

  /** Delegates pointer exit to the shared submenu controller. */
  onMouseLeave(event: MouseEvent): void;
}

/** Internal injector token for generated menu-row submenu behaviour. */
export const MLV_MENU_DATA_ITEM = new InjectionToken<MlvMenuDataItemContext>(
  'MLV_MENU_DATA_ITEM',
);
