import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  contentChild,
  contentChildren,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { LucideChevronDown } from '@lucide/angular';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { MlvRtlService, mlvNextId } from '@malva-ui/cdk/utils';
import {
  MlvPopup,
  MlvPopupContainer,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvExpand } from '@malva-ui/core/expand';
import { MlvBadge, type MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';
import { MLV_SIDEBAR_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import {
  SIDEBAR_CONTEXT,
  type MlvSidebarContextValue,
} from '../sidebar-context';
import type { MlvSidebarMode } from '../sidebar-mode';
import { MlvSidebarItemIcon } from '../sidebar-item-icon';
import { MlvSidebarItem } from '../sidebar-item/sidebar-item';

@Component({
  selector: 'mlv-sidebar-group',
  imports: [
    NgTemplateOutlet,
    LucideChevronDown,
    MlvPopupContainer,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvExpand,
    MlvBadge,
    MlvStatusIndicator,
  ],
  templateUrl: './sidebar-group.html',
  styleUrl: './sidebar-group.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-sidebar-group-host' },
  // Re-provide SIDEBAR_CONTEXT for descendants, injecting inFlyout from this group.
  // Children inside the flyout popup see inFlyout=true and render in expanded mode.
  providers: [
    {
      provide: SIDEBAR_CONTEXT,
      useFactory: (): MlvSidebarContextValue => {
        const group = inject(forwardRef(() => MlvSidebarGroup));
        const parentCtx = inject(SIDEBAR_CONTEXT, {
          skipSelf: true,
          optional: true,
        });
        return {
          collapsed: parentCtx?.collapsed ?? signal(false),
          inFlyout: group.flyoutOpen,
          mode: parentCtx?.mode ?? signal<MlvSidebarMode>('icon'),
          effectiveMode: parentCtx?.effectiveMode ?? parentCtx?.mode,
          // Proxy to parent — intentionally no-op when group is the root context provider
          toggle: () => parentCtx?.toggle(),
          setWidth: (px: number) => parentCtx?.setWidth(px),
        };
      },
    },
  ],
})
export class MlvSidebarGroup {
  /** @private Parent sidebar context (skipSelf) used to read collapsed/mode state and proxy toggles. */
  private readonly _parentCtx = inject(SIDEBAR_CONTEXT, {
    skipSelf: true,
    optional: true,
  });

  /** @private Document handle used to resolve the overlay-rendered flyout panel by id. */
  private readonly _document = inject(DOCUMENT);
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element — the scope the flyout's horizontal arrow keys
   * resolve their direction against. The panel itself is portaled into a CDK
   * overlay outside any `[dir]` the group sits in, so the group's own host is
   * the only element that still carries the authored scope.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @protected Stable id linking the collapsed-mode flyout panel so its focusable items can be resolved. */
  protected readonly _flyoutId = mlvNextId('mlv-sidebar-flyout');

  /** Required label for the group header and flyout title. */
  readonly label = input.required<string>();

  /**
   * Optional badge/count for the group. Rendered as a trailing `mlv-badge` in
   * the expanded accordion header and next to the flyout title, and as a
   * `mlv-status-indicator` dot (top-right of the icon button) when the sidebar
   * is collapsed. `null`/`''` renders nothing.
   */
  readonly badge = input<string | number | null>(null);

  /** Semantic tone applied to the group badge and the collapsed status dot. */
  readonly badgeTone = input<MlvBadgeTone>('default');

  /** When true, the collapsed-mode status dot pulses to draw attention. */
  readonly badgePulse = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @private Sidebar i18n slice (used to phrase the badge count in the aria-label). */
  private readonly _i18n = inject(MLV_SIDEBAR_I18N);
  /** @private ICU resolver for the pluralised notification count. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @protected True when a non-empty badge value is set. */
  protected readonly _hasBadge = computed(() => {
    const b = this.badge();
    return b !== null && b !== '';
  });

  /**
   * @protected Collapsed icon-button `aria-label`: the group `label()` with the
   * badge count folded in (e.g. `"Projects, 3 notifications"`), since the
   * collapsed dot is decorative and carries no text.
   */
  protected readonly _resolvedAriaLabel = computed(() => {
    const base = this.label();
    if (!this._hasBadge()) return base;
    return `${base}, ${this._announceBadge(this.badge() as string | number)}`;
  });

  /** @protected Projected group icon template, rendered in the header and flyout. */
  protected readonly iconRef = contentChild(MlvSidebarItemIcon);
  /** @protected Projected sidebar items, used to derive the active-child highlight. */
  protected readonly _childItems = contentChildren(MlvSidebarItem, {
    descendants: true,
  });
  /** @protected Template of the group's child items, rendered in the accordion and flyout. */
  protected readonly childrenTpl =
    viewChild.required<TemplateRef<unknown>>('childrenRef');
  /** @protected Icon trigger button element, used as the flyout/tooltip anchor and focus target. */
  protected readonly _triggerBtn =
    viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');

  /** @protected Reference to the flyout popup container (collapsed mode). */
  protected readonly _flyoutContainer =
    viewChild<MlvPopupContainer>('flyoutContainer');
  /** @protected Reference to the flyout popup component for state reading. */
  protected readonly _flyoutPopup = viewChild<MlvPopup>('flyoutPopup');
  /** @protected Tooltip popup shown on hover in collapsed mode. */
  protected readonly _tooltipContainer =
    viewChild<MlvPopupContainer>('tooltipContainer');

  /** Whether the accordion is expanded (expanded sidebar mode). */
  readonly expanded = signal(false);

  /**
   * Whether the flyout popup is currently open.
   * Derived from the popup component's `opened` signal.
   */
  readonly flyoutOpen = computed(() => this._flyoutPopup()?.opened() ?? false);

  /** True when the parent sidebar is in collapsed (icon-only) mode. */
  readonly isSidebarCollapsed = computed(
    () => this._parentCtx?.collapsed() ?? false,
  );

  /** True when at least one child item is active — drives active highlight on the group. */
  readonly hasActiveChild = computed(() =>
    this._childItems().some((item) => item.computedActive()),
  );

  /**
   * @protected Effective open state of the accordion panel.
   *
   * `expanded` is public and writable, so a host that auto-expands the group
   * owning the active route can set it while the sidebar is collapsed. The
   * accordion stays mounted in that state (its header fades but keeps the icon
   * column in place), so honouring the write would open an empty panel inside
   * the icon rail — a ghost tree line and reserved height — and, because
   * `#childrenRef` can only be projected once, it would also pull the children
   * out of the open flyout and leave it showing just its header. Gating on the
   * collapsed state here makes that unreachable regardless of write order; the
   * constructor effect still resets `expanded` when collapse begins.
   */
  protected readonly _accordionOpen = computed(
    () => this.expanded() && !this.isSidebarCollapsed(),
  );

  constructor() {
    // Close whichever disclosure belongs to the representation that is
    // becoming inactive. The group header itself remains mounted so its label
    // can fade while the fixed icon track stays in place.
    effect(() => {
      if (this.isSidebarCollapsed()) {
        this.expanded.set(false);
      } else {
        this._flyoutContainer()?.close();
      }
    });

    // Register the icon button as the anchor for the tooltip.
    effect(() => {
      const btn = this._triggerBtn();
      const tooltipContainer = this._tooltipContainer();
      if (btn && tooltipContainer) {
        tooltipContainer.registerTrigger(btn, false);
      }
    });

    // Dismiss tooltip and move focus into the flyout when it opens (menu-button
    // pattern). The panel is rendered into a CDK overlay, so wait one frame for
    // the portal to attach before focusing its first item.
    effect(() => {
      if (this.flyoutOpen()) {
        this._tooltipContainer()?.close();
        requestAnimationFrame(() => {
          if (this.flyoutOpen()) this._focusFirstFlyoutItem();
        });
      }
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

  // ─── Accordion (expanded sidebar) ──────────────────────────────────────────

  /** Toggles the accordion open/closed state. */
  toggle(): void {
    this.expanded.update((v) => !v);
  }

  // ─── Flyout (collapsed sidebar) ─────────────────────────────────────────────

  /** @protected Roving keyboard navigation (Arrow/Home/End/Escape) within the open flyout panel. */
  protected onFlyoutKeydown(event: Event): void {
    const e = event as KeyboardEvent;
    const panel = e.currentTarget as HTMLElement;
    const key = this._rtlService.normalizeArrowKey(e, this._elementRef);

    // Close flyout and return focus to trigger
    if (key === LEFT_ARROW || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this._flyoutContainer()?.close();
      this._triggerBtn()?.nativeElement.focus();
      return;
    }

    // Sidebar items in the flyout may be focusable via their own host
    // (button-style rows) or via a projected link/button (navigational rows).
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]'),
    ).filter((el) => !el.hasAttribute('disabled'));
    if (!items.length) return;

    const idx = items.indexOf(document.activeElement as HTMLElement);

    if (key === DOWN_ARROW) {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (key === UP_ARROW) {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  }

  /**
   * @protected Handles Enter/Space (toggle) and ArrowRight (open) on the
   * collapsed-mode icon trigger. When the flyout is already open, ArrowDown
   * enters it (focuses the first item) instead of bubbling to the sidebar
   * container's roving nav — so an open flyout is never skipped past.
   */
  protected onTriggerKeydown(event: Event): void {
    const e = event as KeyboardEvent;
    const key = this._rtlService.normalizeArrowKey(e, this._elementRef);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._flyoutContainer()?.toggle();
    } else if (key === RIGHT_ARROW) {
      e.preventDefault();
      if (this.flyoutOpen()) {
        this._focusFirstFlyoutItem();
      } else {
        this._flyoutContainer()?.open();
      }
    } else if (key === DOWN_ARROW && this.flyoutOpen()) {
      // Enter the open flyout rather than letting the sidebar container move
      // focus to the next trigger (which would orphan this flyout).
      e.preventDefault();
      e.stopPropagation();
      this._focusFirstFlyoutItem();
    }
  }

  /**
   * @protected Closes the flyout and returns focus to the icon trigger when a
   * child item inside it is activated.
   *
   * The menu-button pattern expects the menu to close once a command is
   * chosen — without this a `routerLink` navigation left the flyout hanging
   * over the new page. Enter/Space are covered too: `MlvSidebarItem` activates
   * a button-style row by calling `.click()` on its host, and a projected
   * anchor dispatches a real click, so both reach this bubbling handler.
   *
   * Clicks on the flyout header or on empty panel space are ignored — only a
   * target inside a `.mlv-sidebar-item` (its host, projected link or button)
   * counts as an activation.
   */
  protected onFlyoutClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.mlv-sidebar-item')) return;
    this._flyoutContainer()?.close();
    this._triggerBtn()?.nativeElement.focus();
  }

  /**
   * @protected Closes the flyout when keyboard focus leaves it entirely (Tab
   * out, or focus moving to another trigger) so it is never left orphaned-open.
   * Focus moves between items inside the panel, or back to the owning trigger,
   * are ignored.
   */
  protected onFlyoutFocusOut(event: Event): void {
    const next = (event as FocusEvent).relatedTarget as HTMLElement | null;
    // Focus lost to nothing (e.g. window blur) — keep the flyout open.
    if (!next) return;
    const panel = this._document.getElementById(this._flyoutId);
    const trigger = this._triggerBtn()?.nativeElement ?? null;
    if (panel?.contains(next) || next === trigger) return;
    this._flyoutContainer()?.close();
  }

  /** @private Moves focus to the first focusable item inside the open flyout panel. */
  private _focusFirstFlyoutItem(): void {
    const panel = this._document.getElementById(this._flyoutId);
    const first = panel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex="0"]',
    );
    first?.focus();
  }

  /** Opens the tooltip when hovering the icon button (collapsed mode, flyout not open). */
  protected onIconBtnMouseEnter(): void {
    if (!this.flyoutOpen()) {
      this._tooltipContainer()?.open();
    }
  }

  /** Closes the tooltip when the pointer leaves the icon button. */
  protected onIconBtnMouseLeave(): void {
    this._tooltipContainer()?.close();
  }
}
