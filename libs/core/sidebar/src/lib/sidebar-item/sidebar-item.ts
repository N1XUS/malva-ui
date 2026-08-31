import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  contentChild,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import {
  MlvPopup,
  MlvPopupContainer,
  MlvPopupContent,
} from '@malva-ui/core/popup';
import { MlvBadge, type MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';
import { MLV_SIDEBAR_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import { SIDEBAR_CONTEXT } from '../sidebar-context';
import { MlvSidebarItemIcon } from '../sidebar-item-icon';
import { MlvSidebarItemTitle } from '../sidebar-item-host';

@Component({
  selector: 'mlv-sidebar-item',
  imports: [
    NgTemplateOutlet,
    MlvPopupContainer,
    MlvPopup,
    MlvPopupContent,
    MlvBadge,
    MlvStatusIndicator,
  ],
  templateUrl: './sidebar-item.html',
  styleUrl: './sidebar-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-sidebar-item',
    '[class.mlv-sidebar-item--active]': 'computedActive()',
    '[class.mlv-sidebar-item--collapsed]': 'isCollapsed()',
    '[attr.role]': '_hostRole()',
    '[attr.tabindex]': '_interactiveHost() ? 0 : null',
    '[attr.aria-label]': '_resolvedAriaLabel()',
    '[attr.aria-current]': 'computedActive() ? "page" : null',
    '(keydown.enter)': '_onKeyActivate($event)',
    '(keydown.space)': '_onKeyActivate($event)',
    '(mouseenter)': '_onMouseEnter()',
    '(mouseleave)': '_onMouseLeave()',
    '(focusin)': '_onMouseEnter()',
    '(focusout)': '_onMouseLeave()',
  },
})
export class MlvSidebarItem {
  /** @private Parent sidebar context providing collapsed/flyout state. */
  private readonly _ctx = inject(SIDEBAR_CONTEXT, { optional: true });

  /** @private Host element, scanned for a genuinely focusable projected control. */
  private readonly _host = inject(ElementRef<HTMLElement>);

  /** Accessible label; used as aria-label, fallback text, and tooltip in collapsed mode. */
  readonly label = input.required<string>();

  /** Explicit active state; combined with router link detection in computedActive. */
  readonly active = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Optional badge/count shown on this item. Rendered as a trailing
   * `mlv-badge` when the sidebar is expanded, and as a `mlv-status-indicator`
   * dot (top-right of the icon) when the sidebar is collapsed — where a full
   * badge does not fit the icon rail. `null`/`''` renders nothing.
   *
   * This is the sanctioned way to attach a badge; it composes with a projected
   * `[mlvSidebarItemTitle]` (the badge renders after the custom title).
   */
  readonly badge = input<string | number | null>(null);

  /** Semantic tone applied to both the expanded badge and the collapsed status dot. */
  readonly badgeTone = input<MlvBadgeTone>('default');

  /** When true, the collapsed-mode status dot pulses to draw attention. */
  readonly badgePulse = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @private Sidebar i18n slice (used to phrase the badge count in the aria-label). */
  private readonly _i18n = inject(MLV_SIDEBAR_I18N);
  /** @private ICU resolver for the pluralised notification count. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @protected Icon slot template projected via `[mlvSidebarItemIcon]`. */
  protected readonly iconRef = contentChild(MlvSidebarItemIcon);
  /** @protected Custom title template projected via `[mlvSidebarItemTitle]`. */
  protected readonly titleRef = contentChild(MlvSidebarItemTitle);

  /** @private Detects Angular router active state from a projected routerLinkActive directive. */
  private readonly _routerLink = contentChild(RouterLinkActive, {
    descendants: true,
  });

  /** True if active() or the nested RouterLinkActive reports active. */
  readonly computedActive = computed(() => {
    return this.active() || this._routerLinkActive();
  });

  /** True when the sidebar is collapsed and this item is not inside a flyout. */
  readonly isCollapsed = computed(() => {
    const collapsed = this._ctx?.collapsed() ?? false;
    const inFlyout = this._ctx?.inFlyout?.() ?? false;
    return collapsed && !inFlyout;
  });

  /**
   * @private True when the projected content contains a genuinely focusable
   * control (an `<a href>`, `<button>`, form field, or `[tabindex="0"]`).
   * Populated after render by scanning the host subtree — a projected
   * `[mlvSidebarItemTitle]` that only contains text/badges does NOT count.
   */
  protected readonly _hasProjectedFocusable = signal(false);

  /**
   * Whether the host itself is the interactive control. `true` unless the
   * projected content already contains its own focusable control — the host
   * then behaves as a `role="button"` (or `role="menuitem"` inside a flyout)
   * row with `tabindex="0"` and an `aria-label`. When a focusable control IS
   * projected (e.g. a router `<a>` link), that element is the single
   * interactive target and the host stays a presentational wrapper, avoiding an
   * invalid `role="listitem"` (no `role="list"` ancestor) and nested focusable
   * controls. Detection is by actual focusable content, not by the mere
   * presence of a title template, so text/badge-only titles stay interactive.
   */
  protected readonly _interactiveHost = computed(
    () => !this._hasProjectedFocusable(),
  );

  /** @protected True while this item renders inside a collapsed-mode group flyout (a `role="menu"`). */
  protected readonly _inFlyout = computed(
    () => this._ctx?.inFlyout?.() ?? false,
  );

  /**
   * @protected Resolved host `role`. `null` when the host is a presentational
   * wrapper around a projected focusable control; otherwise `menuitem` inside a
   * flyout menu, or `button` for a standalone interactive row.
   */
  protected readonly _hostRole = computed(() => {
    if (!this._interactiveHost()) return null;
    return this._inFlyout() ? 'menuitem' : 'button';
  });

  /** @protected True when a non-empty badge value is set. */
  protected readonly _hasBadge = computed(() => {
    const b = this.badge();
    return b !== null && b !== '';
  });

  /**
   * @protected Resolved host `aria-label`. `null` when the host is a
   * presentational wrapper around a projected control. Otherwise the item
   * `label()`, with the badge folded in when set (e.g. `"Inbox, 3
   * notifications"`) — since the host `aria-label` overrides the visible badge
   * text, this keeps the count announced in both expanded and collapsed states,
   * and is the only carrier of the count when the collapsed dot replaces the
   * badge.
   */
  protected readonly _resolvedAriaLabel = computed<string | null>(() => {
    if (!this._interactiveHost()) return null;
    const base = this.label();
    if (!this._hasBadge()) return base;
    return `${base}, ${this._announceBadge(this.badge() as string | number)}`;
  });

  /** @private Router link active state tracked via afterRenderEffect. */
  private readonly _routerLinkActive = signal(false);

  /** @private Reference to the tooltip container for programmatic open/close. */
  protected readonly _tooltipContainer =
    viewChild<MlvPopupContainer>('tooltipContainer');

  /** @private Registered for automatic cleanup of the routerLinkActive subscription. */
  private readonly _destroyRef = inject(DestroyRef);
  constructor() {
    // Detect whether the projected content contributes its own focusable control.
    // Re-runs when the title template or collapsed state changes, since the
    // collapsed link overlay can alter the row's focusable descendants.
    afterRenderEffect(() => {
      this.titleRef();
      this.isCollapsed();
      // `querySelector` inspects descendants only, so the host's own (reactive)
      // tabindex is never matched — we detect a genuinely focusable *projected*
      // control (e.g. a router `<a href>`), independent of layout geometry.
      const focusable = this._host.nativeElement.querySelector(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      this._hasProjectedFocusable.set(!!focusable);
    });

    afterRenderEffect(() => {
      const rla = this._routerLink();
      rla?.isActiveChange
        .pipe(startWith(rla.isActive), takeUntilDestroyed(this._destroyRef))
        .subscribe((isActive) => {
          this._routerLinkActive.set(isActive);
        });
    });
  }

  /**
   * @private Phrases a badge value for the accessible name. A pure numeric
   * value is pluralised via the `notifications` ICU key (e.g. `"3
   * notifications"`); any other value is announced verbatim (e.g. `"New"`).
   */
  private _announceBadge(badge: string | number): string {
    const str = String(badge).trim();
    if (/^\d+$/.test(str)) {
      return this._resolver.resolve(
        this._i18n() as unknown as Record<string, string>,
        'notifications',
        { count: Number(str) },
      );
    }
    return str;
  }

  /** @protected Activates the host on Enter/Space when it is the interactive control. */
  protected _onKeyActivate(event: Event): void {
    // When a projected title link is present it is the interactive element and
    // handles its own keyboard activation natively — do nothing here to avoid
    // activating twice.
    if (!this._interactiveHost()) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).click();
  }

  /** @protected Opens the collapsed-mode tooltip on hover/focus. */
  protected _onMouseEnter(): void {
    if (this.isCollapsed()) {
      this._tooltipContainer()?.open();
    }
  }

  /** @protected Closes the collapsed-mode tooltip on mouse-leave/blur. */
  protected _onMouseLeave(): void {
    this._tooltipContainer()?.close();
  }
}
