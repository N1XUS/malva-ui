import { InjectionToken } from '@angular/core';
import type { ElementRef, WritableSignal } from '@angular/core';
import type { FocusableOption } from '@angular/cdk/a11y';
import type { MlvDataSource } from '@malva-ui/cdk/data-source';
import type { MlvMenuItemData, MlvMenubarEntry } from './menu-data.types';

/** Data source accepted by a data-driven menubar. */
export type MlvMenubarDataSource<
  TItem extends MlvMenuItemData<unknown> = MlvMenuItemData<unknown>,
> = MlvMenubarEntry<TItem>[] | MlvDataSource<MlvMenubarEntry<TItem>>;

/**
 * The subset of the `MlvMenuTrigger` API a `mlv-menubar` needs to
 * coordinate its top-level items (roving tabindex, arrow navigation, and the
 * "open-follow" behaviour where moving to a sibling while a menu is open opens
 * that sibling's menu).
 *
 * `MlvMenuTrigger` implements this shape at runtime when it is a direct
 * child of a `mlv-menubar` (i.e. it can inject {@link MENUBAR_TOKEN}).
 */
export interface MlvMenubarItem extends FocusableOption {
  /** Optional host element used to keep registry order aligned with the DOM. */
  readonly _elementRef?: ElementRef<HTMLElement>;
  /** Whether this top-level item is disabled — used by the bar's `skipPredicate`. */
  readonly disabledBoolean: boolean;

  /**
   * Roving tabindex signal for this item — `0` for the currently active item,
   * `-1` for every other item. Written by the parent `mlv-menubar`.
   */
  readonly _tabIndex: WritableSignal<number>;

  /** Whether this item's dropdown menu is currently open. */
  isMenuOpen(): boolean;

  /** Opens this item's dropdown without moving focus into the panel. */
  openMenu(): void;

  /** Closes this item's dropdown. */
  closeMenu(): void;

  /** Opens this item's dropdown and moves focus to the first menu item. */
  openMenuWithFirstItemFocused(): void;

  /** Opens this item's dropdown and moves focus to the last menu item. */
  openMenuWithLastItemFocused(): void;

  /** Returns the item's visible text label, used for menubar type-ahead. */
  getLabel(): string;
}

/**
 * Accessor a `mlv-menubar` exposes to its child triggers via {@link MENUBAR_TOKEN}.
 * Child triggers use it to report open/close state and to request sibling-menu
 * navigation, without importing the concrete `MlvMenubar`.
 */
export interface MlvMenubarAccessor {
  /**
   * Host element of the menubar. Passed to `MlvPopupService` as a click-outside
   * exclusion so that clicking a sibling top-level item switches menus instead
   * of dismissing the open dropdown.
   */
  readonly hostElement: HTMLElement;

  /**
   * Called by a child when its dropdown opens. The bar records the open item,
   * closes any previously-open sibling, and syncs the roving tabindex.
   */
  notifyItemOpened(item: MlvMenubarItem): void;

  /** Called by a child when its dropdown closes. */
  notifyItemClosed(item: MlvMenubarItem): void;

  /**
   * Called on `mouseenter` of a child. Opens the hovered item's dropdown **only
   * while another dropdown in the bar is already open** (hover-follow); does
   * nothing when the bar is fully closed.
   */
  onItemPointerEnter(item: MlvMenubarItem): void;

  /** Whether any dropdown in the bar is currently open. */
  hasOpenMenu(): boolean;

  /**
   * Moves to the item adjacent to `from` (wrapping over disabled items) and
   * opens its dropdown with focus on the first item. Called from within an open
   * dropdown on ArrowRight (`dir = 1`) or ArrowLeft (`dir = -1`) to cross to a
   * sibling menubar menu.
   */
  openAdjacentItemMenu(from: MlvMenubarItem, dir: 1 | -1): void;
}

/**
 * Controller a menubar dropdown uses to cross to a sibling menubar menu when
 * ArrowRight / ArrowLeft is pressed at the top level of the open dropdown.
 * Registered on the `MlvMenu` by the opening `MlvMenuTrigger` when
 * (and only when) that trigger is a menubar child.
 */
export interface MlvMenubarMenuController {
  /** Cross to the next menubar item's menu (in-menu ArrowRight). */
  openNextItemMenu(): void;

  /** Cross to the previous menubar item's menu (in-menu ArrowLeft). */
  openPreviousItemMenu(): void;
}

/** Injection token for the parent `mlv-menubar`. */
export const MENUBAR_TOKEN = new InjectionToken<MlvMenubarAccessor>(
  'MENUBAR_TOKEN',
);
