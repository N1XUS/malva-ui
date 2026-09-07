import {
  DestroyRef,
  Directive,
  ElementRef,
  computed,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import type { MlvSidebarContextValue } from '../sidebar-context';
import { SIDEBAR_CONTEXT } from '../sidebar-context';
import type { MlvSidebarMode } from '../sidebar-mode';
import { MLV_SIDEBAR_I18N } from '@malva-ui/i18n';

/**
 * Turns any element into a control that toggles a sidebar's collapsed state.
 *
 * The directive renders nothing and owns no chrome — the host element is the
 * button. Inside the rail that host is an ordinary `mlv-sidebar-item`, so the
 * toggle is a normal row with an icon and a label rather than a bespoke
 * glyph-only button; outside it, it is usually a `button[mlvButton]`.
 *
 * It contributes only behaviour: a click listener that calls
 * {@link MlvSidebarContextValue.toggle}, an `aria-expanded` state, and
 * `display: none` while the sidebar's effective mode is `'fixed'` (where the
 * sidebar cannot collapse at all). The host keeps its own accessible name —
 * `mlv-sidebar-item`'s `label` input, or an `aria-label` on a bare button —
 * and {@link label} hands the call site the localized string for it, so the
 * visible text and the accessible name stay the same string.
 *
 * ```html
 * <mlv-sidebar [(collapsed)]="collapsed">
 *   <mlv-sidebar-item
 *     mlvSidebarTrigger
 *     #trigger="mlvSidebarTrigger"
 *     [label]="trigger.label()"
 *   >
 *     <ng-template mlvSidebarItemIcon>
 *       @if (trigger.collapsed()) {
 *         <svg lucidePanelLeftOpen [size]="20" />
 *       } @else {
 *         <svg lucidePanelLeftClose [size]="20" />
 *       }
 *     </ng-template>
 *   </mlv-sidebar-item>
 * </mlv-sidebar>
 * ```
 *
 * An offcanvas sidebar renders none of its projected content while closed, so
 * a trigger that must reopen the drawer has to live outside `<mlv-sidebar>`.
 * Point it at the sidebar with the `sidebar` input:
 *
 * ```html
 * <mlv-sidebar #nav collapseBelow="md">…</mlv-sidebar>
 *
 * <button
 *   mlvButton
 *   variant="transparent"
 *   shape="square"
 *   mlvSidebarTrigger
 *   #trigger="mlvSidebarTrigger"
 *   [sidebar]="nav"
 *   [attr.aria-label]="trigger.label()"
 * >
 *   <svg lucideMenu [size]="20" />
 * </button>
 * ```
 */
@Directive({
  selector: '[mlvSidebarTrigger]',
  exportAs: 'mlvSidebarTrigger',
  host: {
    '[attr.aria-expanded]': '!collapsed()',
    // Inline, rather than a `--hidden` class: the host is the consumer's own
    // element (an `mlv-sidebar-item` carries `display: grid`, a `mlvButton`
    // `inline-flex`), so a class-based `display: none` would have to outrank
    // whatever that element already declares.
    '[style.display]': 'isHidden() ? "none" : null',
  },
})
export class MlvSidebarTrigger {
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

  /** @private Host element — the element this directive turns into the toggle. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

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

  /**
   * Whether the sidebar is collapsed — the drawer closed, in offcanvas mode.
   * Read it to pick the host's icon and, where the copy differs from
   * {@link label}, its text.
   */
  readonly collapsed = computed(() => this._context()?.collapsed() ?? false);

  /** @private The sidebar's effective layout mode, responsive override included. */
  private readonly _mode = computed<MlvSidebarMode>(() => {
    const context = this._context();
    if (!context) return 'icon';
    return context.effectiveMode?.() ?? context.mode();
  });

  /**
   * True when the sidebar currently behaves as an overlay drawer, so the host
   * should read as a menu button rather than a rail collapse toggle. Follows a
   * `collapseBelow` override, not only an authored `mode="offcanvas"`.
   */
  readonly isDrawerTrigger = computed(() => this._mode() === 'offcanvas');

  /**
   * True while the sidebar cannot collapse at all (`mode="fixed"`), which
   * hides the host. A `collapseBelow` override therefore reveals it again on a
   * narrow viewport, where the sidebar does become a drawer.
   */
  readonly isHidden = computed(() => this._mode() === 'fixed');

  /**
   * The localized name for the action in its current state — `expand` /
   * `collapse` on a rail, `openNavigation` / `closeNavigation` while the
   * sidebar is a drawer. Bind it to the host's label (`mlv-sidebar-item`'s
   * `label` input, or `aria-label` on a bare button); the directive
   * deliberately does not write the name itself, so it never fights the host
   * component for the attribute.
   */
  readonly label = computed(() => {
    const strings = this._i18n();
    if (this.isDrawerTrigger()) {
      return this.collapsed()
        ? strings.openNavigation
        : strings.closeNavigation;
    }
    return this.collapsed() ? strings.expand : strings.collapse;
  });

  /**
   * The host element acting as this trigger. Pass it to an overlay's explicit
   * focus-restoration option when the activating control can disappear with an
   * offcanvas view.
   */
  readonly focusTarget = computed<HTMLElement>(
    () => this._elementRef.nativeElement,
  );

  constructor() {
    // `fromEvent`, not a host `(click)` binding: a listener binding is wrapped
    // in Angular's mark-dirty scheduler notification, and this handler runs on
    // a plain element the consumer owns. Enter/Space arrive here too —
    // `mlv-sidebar-item` turns them into a real click on its host.
    fromEvent<MouseEvent>(this._elementRef.nativeElement, 'click')
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this._context()?.toggle());
  }

  /**
   * The connected host element while its sidebar currently behaves as an
   * offcanvas drawer; otherwise `null`. Use this as an explicit overlay focus
   * fallback when a projected activator can disappear with the drawer, while
   * retaining the overlay's default opener restoration in inline modes.
   */
  offcanvasFocusTarget(): HTMLElement | null {
    const target = this.focusTarget();
    return this.isDrawerTrigger() && target.isConnected ? target : null;
  }

  /**
   * Late-bound overlay focus policy. Pass the function itself to a dynamic
   * restore-focus option: it resolves to the connected external trigger in
   * offcanvas mode and to the overlay's captured-opener default otherwise.
   */
  readonly restoreFocusResolver = (): true | HTMLElement =>
    this.offcanvasFocusTarget() ?? true;
}
