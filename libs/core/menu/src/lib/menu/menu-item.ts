import {
  DestroyRef,
  Directive,
  ElementRef,
  afterRenderEffect,
  effect,
  inject,
  input,
  output,
  Renderer2,
  signal,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { DOWN_ARROW, RIGHT_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MLV_MENU_ITEM_REGISTRY } from './menu-item-registry';
import { MLV_MENU_DATA_ITEM, MENU_TOKEN } from './menu.types';
import { MlvMenuTrigger } from './menu-trigger';
import { MENUBAR_TOKEN } from './menubar.types';

/**
 * Menu item directive — applied to `mlv-list-item` to give it menu-item semantics
 * and behavior.
 *
 * Overrides the list item's default `role="listitem"` with `role="menuitem"`,
 * wires into the parent menu's `FocusKeyManager` (via `focus()` / `disabledBoolean`),
 * and closes the parent menu stack on leaf activation. A co-hosted enabled
 * submenu trigger owns its own activation so opening a child menu keeps the
 * ancestor open; a disabled submenu trigger falls back to leaf activation.
 *
 * Use `[mlvListItemPrefix]` for leading icons and `[mlvListItemSuffix]` for
 * trailing content (chevron, shortcut label, etc.).
 *
 * @example
 * ```html
 * <mlv-list-item mlvMenuItem (itemClick)="onSave()">Save</mlv-list-item>
 *
 * <mlv-list-item mlvMenuItem disabled>Unavailable</mlv-list-item>
 *
 * <mlv-list-item mlvMenuItem (itemClick)="onEdit()">
 *   <svg mlvListItemPrefix lucideEdit [size]="14" />
 *   Edit
 * </mlv-list-item>
 * ```
 */
@Directive({
  selector: 'mlv-list-item[mlvMenuItem]',
  host: {
    '[attr.role]': '"menuitem"',
    '[attr.tabindex]': '_isDisabled() ? -1 : _tabIndex()',
    '[attr.aria-disabled]': '_isDisabled() || null',
    '[class.mlv-list-item--disabled]': '_isDisabled()',
    '[class.mlv-menu-data-renderer__submenu-trigger]': '_hasAutomaticSubmenu()',
    '(click)': '_onClick()',
    '(mouseenter)': '_onMouseEnter()',
    '(mouseleave)': '_onMouseLeave($event)',
    '(keydown.enter)': '_onActivate($event)',
    '(keydown)': '_onKeydown($event)',
    '(keydown.space)': '_onActivate($event)',
  },
})
export class MlvMenuItem {
  /** @private Normalizes horizontal submenu navigation for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  /** @private Reference to parent menu, if any. Used to close on activation. */
  private readonly _menu = inject(MENU_TOKEN, { optional: true });
  private readonly _registry = inject(MLV_MENU_ITEM_REGISTRY, {
    optional: true,
  });
  private readonly _renderer = inject(Renderer2);
  private readonly _dataItemContext = inject(MLV_MENU_DATA_ITEM, {
    optional: true,
  });
  private readonly _menubar = inject(MENUBAR_TOKEN, { optional: true });

  /** @private A co-hosted submenu trigger owns activation instead of this leaf item. */
  private readonly _submenuTrigger = inject(MlvMenuTrigger, {
    optional: true,
    self: true,
  });

  /** @private Host element used to call `focus()` for `FocusKeyManager`. */
  readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Direction applying to this row, resolved once and cached behind
   * the shared `dir` observer rather than re-walked on every arrow keypress.
   * A row is created with the overlay pane it renders into and disposed with
   * it, so the cached walk cannot outlive the pane whose `dir` it read.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  constructor() {
    this._registry?.register(this);
    afterRenderEffect(() => this._registry?.resync());
    inject(DestroyRef).onDestroy(() => this._registry?.unregister(this));

    if (this._dataItemContext && !this._submenuTrigger) {
      effect(() => {
        const element = this._elementRef.nativeElement;

        if (!this._dataItemContext?.hasChildren()) {
          this._renderer.removeAttribute(element, 'aria-haspopup');
          this._renderer.removeAttribute(element, 'aria-expanded');
          this._renderer.removeAttribute(element, 'aria-controls');
          return;
        }

        this._renderer.setAttribute(element, 'aria-haspopup', 'menu');
        this._renderer.setAttribute(
          element,
          'aria-expanded',
          String(this._dataItemContext.isOpen()),
        );

        const panelId = this._dataItemContext.panelId();
        if (this._dataItemContext.isOpen() && panelId) {
          this._renderer.setAttribute(element, 'aria-controls', panelId);
        } else {
          this._renderer.removeAttribute(element, 'aria-controls');
        }
      });
    }
  }

  // ─── Inputs ───────────────────────────────────────────────────────────────

  /**
   * When true, disables the item — removes it from the tab order and
   * prevents activation. Supports attribute syntax: `<mlv-list-item mlvMenuItem disabled>`.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  // ─── Outputs ──────────────────────────────────────────────────────────────

  /**
   * Emits when a leaf item is activated (click or Enter/Space key).
   * The parent menu stack closes automatically after this event. Submenu-trigger
   * rows delegate activation to `MlvMenuTrigger` and do not emit this output
   * while that trigger is enabled.
   */
  readonly itemClick = output<void>();

  // ─── FocusKeyManager interface ────────────────────────────────────────────

  /**
   * @private Tabindex managed by the parent menu's `FocusKeyManager`.
   * `0` for the active (focused) item, `-1` for all others (roving tabindex).
   * A signal so the host `[attr.tabindex]` binding updates under OnPush.
   */
  readonly _tabIndex = signal(-1);

  /**
   * Boolean getter for `FocusKeyManager.skipPredicate`.
   * The key manager calls `item.disabledBoolean` so this bridges
   * the signal API to the CDK interface.
   */
  get disabledBoolean(): boolean {
    return this._isDisabled();
  }

  /**
   * Focuses the host element.
   * Required by CDK `FocusableOption` for `FocusKeyManager`.
   */
  focus(): void {
    this._elementRef.nativeElement.focus();
  }

  /**
   * Returns the item's visible text label, used by the parent menu's
   * `FocusKeyManager` type-ahead (type a letter to jump to the first matching
   * item). Reads the host element's trimmed `textContent`.
   * Required by CDK `FocusKeyManager.withTypeAhead()`.
   */
  getLabel(): string {
    return this._elementRef.nativeElement.textContent?.trim() ?? '';
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  /**
   * @protected Handles click activation.
   */
  protected _onClick(): void {
    if (this._isDisabled()) return;
    if (this._hasAutomaticSubmenu()) {
      this._dataItemContext?.toggle();
      return;
    }
    if (this._enabledSubmenuOwnsActivation()) return;
    this.itemClick.emit();
    this._menu?.closeAll();
  }

  /**
   * @protected Handles Enter / Space keyboard activation.
   * Prevents default scroll on Space and triggers the same logic as a click.
   */
  protected _onActivate(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this._isDisabled()) return;
    if (this._hasAutomaticSubmenu()) {
      if (this._dataItemContext?.isOpen()) {
        this._dataItemContext.close();
      } else {
        this._dataItemContext?.openWithFirstItemFocused();
      }
      return;
    }
    if (this._enabledSubmenuOwnsActivation()) return;
    this.itemClick.emit();
    this._menu?.closeAll();
  }

  /** @protected Delegates hover-open behavior for generated submenu rows. */
  protected _onMouseEnter(): void {
    if (this._isDisabled() || !this._hasAutomaticSubmenu()) return;
    this._dataItemContext?.onMouseEnter();
  }

  /** @protected Delegates hover-close intent for generated submenu rows. */
  protected _onMouseLeave(event: MouseEvent): void {
    if (this._isDisabled() || !this._hasAutomaticSubmenu()) return;
    this._dataItemContext?.onMouseLeave(event);
  }

  /** @protected Handles submenu keyboard opening for generated rows. */
  protected _onKeydown(event: KeyboardEvent): void {
    if (this._isDisabled() || !this._hasAutomaticSubmenu()) return;

    // Resolved against this row's own host — inside the overlay pane, which
    // CDK stamps with the direction its trigger was in — so a generated
    // submenu opens toward the inline end in a scoped `[dir="rtl"]` subtree.
    const key =
      this._rtlService.normalizeArrowKey(event, this._direction()) ?? event.key;
    if (this._isMenubarDataItem()) {
      if (key === DOWN_ARROW && !this._dataItemContext?.isOpen()) {
        event.preventDefault();
        event.stopPropagation();
        this._dataItemContext?.openWithFirstItemFocused();
      } else if (key === UP_ARROW && !this._dataItemContext?.isOpen()) {
        event.preventDefault();
        event.stopPropagation();
        this._dataItemContext?.openWithLastItemFocused();
      }
      return;
    }

    if (key !== RIGHT_ARROW || this._dataItemContext?.isOpen()) return;

    event.preventDefault();
    event.stopPropagation();
    this._dataItemContext?.openWithFirstItemFocused();
  }

  /** @private Whether a co-hosted trigger can handle submenu activation. */
  private _enabledSubmenuOwnsActivation(): boolean {
    return !!(
      this._submenuTrigger?.isSubmenuTrigger() &&
      !this._submenuTrigger.menuTriggerDisabled()
    );
  }

  /** @private Whether this row is a generated submenu row without an explicit trigger. */
  protected _hasAutomaticSubmenu(): boolean {
    return !this._submenuTrigger && !!this._dataItemContext?.hasChildren();
  }

  /** @private Whether this generated row is a root item of a reactive menubar. */
  private _isMenubarDataItem(): boolean {
    return !!this._dataItemContext && this._menubar !== null;
  }

  /** @private Resolved disabled state from explicit input or generated row data. */
  protected _isDisabled(): boolean {
    return !!(this.disabled() || this._dataItemContext?.isDisabled());
  }
}
