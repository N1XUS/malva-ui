import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { MlvSidebarContextValue } from '../sidebar-context';
import { SIDEBAR_CONTEXT } from '../sidebar-context';
import type { MlvSidebarMode } from '../sidebar-mode';
import {
  LucideMenu,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideX,
} from '@lucide/angular';
import { MLV_SIDEBAR_I18N } from '@malva-ui/i18n';

/**
 * Sidebar trigger button that toggles the sidebar's collapsed state.
 * Renders as a transparent icon button visually matching collapsed sidebar
 * items, so it sits flush with the rest of the sidebar chrome.
 * Automatically hides itself in fixed mode.
 *
 * When the sidebar's effective mode is `'offcanvas'` (either `mode="offcanvas"`
 * or a `collapseBelow` breakpoint override) the trigger renders as a
 * hamburger/close menu button instead of the rail collapse chevrons.
 *
 * Usage:
 * ```html
 * <mlv-sidebar [collapsed]="collapsed()">
 *   <mlv-sidebar-trigger />
 * </mlv-sidebar>
 * ```
 *
 * An offcanvas sidebar does not render its projected content while closed, so
 * a trigger that must reopen the drawer has to live outside `<mlv-sidebar>`.
 * Point it at the sidebar with the `sidebar` input:
 *
 * ```html
 * <mlv-sidebar #nav collapseBelow="md">…</mlv-sidebar>
 * <mlv-sidebar-trigger [sidebar]="nav" />
 * ```
 */
@Component({
  selector: 'mlv-sidebar-trigger',
  template: `
    <button
      #triggerButton
      type="button"
      class="mlv-sidebar-trigger__btn"
      [attr.aria-label]="_resolvedAriaLabel()"
      [attr.aria-expanded]="!_collapsed()"
      (click)="_toggle()"
    >
      @if (_isDrawerTrigger()) {
        @if (_collapsed()) {
          <svg lucideMenu [size]="20" class="mlv-sidebar-trigger__icon" />
        } @else {
          <svg lucideX [size]="20" class="mlv-sidebar-trigger__icon" />
        }
      } @else if (_collapsed()) {
        <svg
          lucidePanelLeftOpen
          [size]="20"
          class="mlv-sidebar-trigger__icon"
        />
      } @else {
        <svg
          lucidePanelLeftClose
          [size]="20"
          class="mlv-sidebar-trigger__icon"
        />
      }
    </button>
  `,
  styleUrl: './sidebar-trigger.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideMenu, LucidePanelLeftClose, LucidePanelLeftOpen, LucideX],
  host: {
    class: 'mlv-sidebar-trigger',
    '[class.mlv-sidebar-trigger--hidden]': '_isHidden()',
    '[class.mlv-sidebar-trigger--menu]': '_isDrawerTrigger()',
  },
})
export class MlvSidebarTrigger {
  /** @private Native button query backing the public focus target. */
  private readonly _triggerButton =
    viewChild<ElementRef<HTMLButtonElement>>('triggerButton');

  /**
   * The sidebar this trigger controls, for triggers rendered outside
   * `<mlv-sidebar>`. Pass the sidebar's template reference
   * (`<mlv-sidebar #nav />` → `[sidebar]="nav"`). Required whenever the sidebar
   * can be an offcanvas drawer, because a closed drawer does not render its
   * projected content — an inner trigger would disappear with it.
   *
   * When omitted, the trigger uses the `SIDEBAR_CONTEXT` of its ancestor
   * sidebar.
   */
  readonly sidebar = input<MlvSidebarContextValue | undefined>(undefined);

  /**
   * The connected native button rendered by this trigger, or `null` before
   * its view exists. Pass this to an overlay's explicit focus-restoration
   * option when the activating control can disappear with an offcanvas view.
   */
  readonly focusTarget = computed(
    () => this._triggerButton()?.nativeElement ?? null,
  );

  /** @protected Localised labels for the sidebar trigger. */
  protected readonly _i18n = inject(MLV_SIDEBAR_I18N);

  /** @private Ancestor sidebar context, when this trigger is nested in one. */
  private readonly _injectedContext = inject(SIDEBAR_CONTEXT, {
    optional: true,
  });

  /**
   * @private The context actually driven by this trigger — the explicit
   * `sidebar` input wins over the injected ancestor context.
   */
  private readonly _context = computed<MlvSidebarContextValue | null>(
    () => this.sidebar() ?? this._injectedContext,
  );

  /** @protected Whether the sidebar is collapsed (drawer closed in offcanvas). */
  protected readonly _collapsed = computed(
    () => this._context()?.collapsed() ?? false,
  );

  /** @private The sidebar's effective layout mode, responsive override included. */
  private readonly _mode = computed<MlvSidebarMode>(() => {
    const context = this._context();
    if (!context) return 'icon';
    return context.effectiveMode?.() ?? context.mode();
  });

  /**
   * @protected True when the sidebar currently behaves as an overlay drawer, so
   * the trigger renders as a menu button rather than a rail collapse toggle.
   */
  protected readonly _isDrawerTrigger = computed(
    () => this._mode() === 'offcanvas',
  );

  /**
   * The connected native trigger button while its sidebar currently behaves
   * as an offcanvas drawer; otherwise `null`. Use this as an explicit overlay
   * focus fallback when a projected activator can disappear with the drawer,
   * while retaining the overlay's default opener restoration in inline modes.
   */
  offcanvasFocusTarget(): HTMLButtonElement | null {
    const target = this.focusTarget();
    return this._isDrawerTrigger() && target?.isConnected ? target : null;
  }

  /**
   * Late-bound overlay focus policy. Pass the function itself to a dynamic
   * restore-focus option: it resolves to the connected external trigger in
   * offcanvas mode and to the overlay's captured-opener default otherwise.
   */
  readonly restoreFocusResolver = (): true | HTMLButtonElement =>
    this.offcanvasFocusTarget() ?? true;

  /** @protected Whether the trigger should be hidden (fixed mode). */
  protected readonly _isHidden = computed(() => this._mode() === 'fixed');

  /** @protected Accessible name matching the current affordance and state. */
  protected readonly _resolvedAriaLabel = computed(() => {
    const strings = this._i18n();
    if (this._isDrawerTrigger()) {
      return this._collapsed()
        ? strings.openNavigation
        : strings.closeNavigation;
    }
    return this._collapsed() ? strings.expand : strings.collapse;
  });

  /** @protected Toggle the sidebar collapsed state. */
  protected _toggle(): void {
    this._context()?.toggle();
  }
}
