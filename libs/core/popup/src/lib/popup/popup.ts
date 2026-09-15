import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Subject } from 'rxjs';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type {
  ConnectedPosition,
  HorizontalConnectionPos,
  VerticalConnectionPos,
} from '@angular/cdk/overlay';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { PortalModule } from '@angular/cdk/portal';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import type { MlvBreakpoint, MlvDirection } from '@malva-ui/cdk/utils';
import { MLV_DENSITY_CONTEXT, MlvDensityService } from '@malva-ui/cdk/density';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MLV_POPUP_I18N } from '@malva-ui/i18n';
import { MlvPopupContent } from '../popup-content';
import { MlvPopupHeaderActions } from '../popup-header-actions';
import { MlvPopupHeaderContent } from '../popup-header-content';
import { MlvPopupPinnedContent } from '../popup-pinned-content';
import type {
  MlvPopupScrollStrategy,
  MlvPopupSizeConfig,
} from '../popup.service';
import type { MlvPopupPositionName } from '../popup-positions';
import { MlvPopupPositionResolver, POPUP_POSITIONS } from '../popup-positions';
import { MlvButtonClose } from '@malva-ui/core/button';
import { POPUP_CONTAINER } from '../popup-container/popup-container.token';

/**
 * The edge of the popup panel the arrow is drawn on.
 *
 * **Physical, not a logical alias** — `'left'` is the viewport's left edge in
 * both LTR and RTL, exactly like `'top'` and `'bottom'` are. The panel's
 * `::before` glyph is a square rotated a physical `45deg`, so which edge it
 * hangs off and which two of its borders survive are physical decisions no
 * logical property can express.
 *
 * {@link MlvPopup.updateArrowFromPosition} is where the conversion happens: the
 * `ConnectedPosition` CDK reports is logical, and it is mirrored there against
 * the direction of the pane the panel was rendered into. See
 * `.claude/rules/rtl.md`, "collision-resolved overlay arrow".
 */
export type MlvPopupArrowEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Where along its {@link MlvPopupArrowEdge} the arrow sits.
 *
 * **Physical, not a logical alias**, for the same reason as the edge:
 * `'start'` is the left end of a `top` / `bottom` edge and the top end of a
 * `left` / `right` edge, in both directions; `'end'` is the right / bottom end.
 * A `bottom-start` popup therefore resolves to `'start'` in LTR and `'end'` in
 * RTL — both meaning "the corner nearest the trigger".
 */
export type MlvPopupArrowAlign = 'start' | 'center' | 'end';

/**
 * Maps a resolved `overlayX` onto the physical end of a `top` / `bottom` arrow
 * edge.
 *
 * `overlayX` is logical — CDK mirrors `start` / `end` against the pane's own
 * direction — while {@link MlvPopupArrowAlign} is physical, so the two ends
 * swap in RTL. `'center'` is direction-agnostic.
 */
function toInlineAlign(
  overlayX: HorizontalConnectionPos,
  rtl: boolean,
): MlvPopupArrowAlign {
  if (overlayX === 'center') return 'center';
  const physicallyAtStart = rtl ? overlayX === 'end' : overlayX === 'start';
  return physicallyAtStart ? 'start' : 'end';
}

/**
 * Maps a resolved `overlayY` onto the physical end of a `left` / `right` arrow
 * edge. The block axis never mirrors, so this takes no direction.
 */
function toBlockAlign(overlayY: VerticalConnectionPos): MlvPopupArrowAlign {
  return overlayY === 'top'
    ? 'start'
    : overlayY === 'bottom'
      ? 'end'
      : 'center';
}

/**
 * Fallback delay (ms) after which a pending leave is force-completed when the
 * panel's `animationend` never fires — `prefers-reduced-motion` removes the
 * leave animation entirely, and hidden/background tabs throttle CSS animations.
 * Comfortably above the default leave duration (`--mlv-duration-fast`, 100ms);
 * matches the dialog's `LEAVE_FALLBACK_MS` (250 ms).
 */
export const POPUP_LEAVE_FALLBACK_MS = 250;

/**
 * Delay (ms) after which an overlay owner force-detaches a popup whose leave
 * animation never completed. Sits just past {@link POPUP_LEAVE_FALLBACK_MS} so
 * the normal `animationend` / fallback path always wins when it works.
 */
export const POPUP_DETACH_WATCHDOG_MS = POPUP_LEAVE_FALLBACK_MS + 100;

/**
 * Controls whether the popup renders as a full-screen mobile sheet.
 *
 * - `'off'` (default) — always anchored to the trigger (byte-identical to the
 *   original popup behaviour). Consumers must opt in to enable the mechanism.
 * - `'auto'` — full-screen when the viewport is below {@link MlvPopup.mobileBreakpoint},
 *   anchored otherwise.
 * - `'fullscreen'` — always full-screen regardless of viewport (useful for demos/forcing).
 */
export type MlvPopupMobileMode = 'auto' | 'fullscreen' | 'off';

@Component({
  selector: 'mlv-popup',
  imports: [
    OverlayModule,
    A11yModule,
    PortalModule,
    NgTemplateOutlet,
    MlvScrollbar,
    MlvButtonClose,
  ],
  templateUrl: './popup.html',
  styleUrl: './popup.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    // The panel is not the container's trigger area, so nothing inside it may
    // claim the container (#225).
    //
    // `<ng-template mlvPopupContent>` is declared lexically inside
    // `<mlv-popup-container>`, and portaling the panel into the CDK overlay
    // moves DOM, not the node injector: a directive in the panel still
    // resolves `POPUP_CONTAINER` up the *declaration* tree and finds the
    // container the panel belongs to. A `[mlvPopupTrigger]` in there — the
    // `mlv-tab-group` overflow button inside `mlv-color-picker`, inside
    // `mlv-color-picker-popup`, is the reported case — therefore switched into
    // container mode: it drove `container.toggle()` instead of its own popup,
    // and registered its host as the container's overlay origin. That element
    // dies with the panel, so the next open anchored to a detached node whose
    // `getBoundingClientRect()` is all zeros, and the panel rendered at the
    // top-left corner of the viewport.
    //
    // `null` rather than omitting the provider: `inject(POPUP_CONTAINER,
    // { optional: true })` has to stop *here* rather than keep walking to the
    // container above. A trigger declared as a sibling of `<mlv-popup>` — the
    // ordinary container-mode arrangement, `mlv-sidebar-group`'s flyout
    // included — is outside this boundary and is unaffected.
    { provide: POPUP_CONTAINER, useValue: null },
  ],
})
export class MlvPopup {
  /** @private Active named-position map (overridable via `POPUP_POSITIONS` token). */
  private readonly _positionMap = inject(POPUP_POSITIONS);

  /**
   * Named position(s) controlling where the popup appears relative to its trigger.
   *
   * Accepts a single {@link MlvPopupPositionName} or an ordered array of names.
   * CDK tries positions in array order and uses the first one that fits in the
   * viewport — useful for automatic flip behaviour.
   *
   * When set, takes precedence over the raw {@link positions} input.
   * When both are omitted, all twelve default positions are passed to CDK.
   *
   * An unrecognised name is skipped and a `console.warn` is emitted in dev mode.
   *
   * @example Single preferred position
   * ```html
   * <mlv-popup position="bottom-end" />
   * ```
   *
   * @example Preferred + fallback
   * ```html
   * <mlv-popup [position]="['bottom-end', 'top-end']" />
   * ```
   */
  readonly position = input<
    MlvPopupPositionName | MlvPopupPositionName[] | undefined
  >(undefined);

  /**
   * Raw CDK `ConnectedPosition` array for advanced use cases where named
   * positions are insufficient.
   *
   * When set and `position` is not set, these positions are passed directly
   * to the CDK overlay. Prefer `position` for standard placements.
   */
  readonly positions = input<ConnectedPosition[] | undefined>(undefined);

  /** Explicit CSS width of the popup panel. */
  readonly width = input<number | string | undefined>(undefined);
  /** Explicit CSS height of the popup panel. */
  readonly height = input<number | string | undefined>(undefined);
  /** Minimum CSS width of the popup panel. */
  readonly minWidth = input<number | string | undefined>(undefined);
  /** Minimum CSS height of the popup panel. */
  readonly minHeight = input<number | string | undefined>(undefined);
  /** Maximum CSS width of the popup panel. */
  readonly maxWidth = input<number | string | undefined>(undefined);
  /** Maximum CSS height of the popup panel. */
  readonly maxHeight = input<number | string | undefined>(undefined);
  /** When `true`, a directional arrow is rendered pointing toward the trigger. */
  readonly hasArrow = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** When `true` (default), a drop-shadow is applied to the popup panel. */
  readonly hasShadow = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });
  /** Additional CSS classes forwarded to the popup panel host. */
  readonly class = input<string>();

  /**
   * Density applied to the popup's content.
   *
   * The popup panel is portaled to the CDK overlay container on `<body>`, so it
   * sits outside any `mlvDensityRoot` / ancestor density cascade in the page.
   * This input restores the cascade on the detached panel: the resolved density
   * is stamped as a `mlv--{density}` class on the panel element, and every
   * density-aware descendant (e.g. `mlv-list-item` rows in a dropdown panel)
   * responds through the standard CSS cascade.
   *
   * When omitted, the nearest ancestor `MLV_DENSITY_CONTEXT` (e.g. a
   * `form[mlvForm]`) is used, then the global `MlvDensityService`, so popovers
   * follow the surrounding / app-wide density without extra wiring. Components
   * that embed a popup (select, combobox, pagination, menu, …) forward their
   * own `mlvDensity` input here.
   */
  readonly mlvDensity = input<MlvDensity | undefined>(undefined);

  /**
   * @private Global density service — fallback when no explicit
   * {@link mlvDensity} is supplied.
   */
  private readonly _densityService = inject(MlvDensityService);

  /**
   * @private Density projected by an ancestor container (e.g. `form[mlvForm]`).
   * Consulted after the explicit {@link mlvDensity} input, before the service.
   */
  private readonly _densityContext = inject(MLV_DENSITY_CONTEXT, {
    optional: true,
  });

  /**
   * @protected Class list for the detached panel element: consumer classes from
   * {@link class} plus the resolved `mlv--{density}` cascade class.
   */
  protected readonly _panelClasses = computed(() => {
    const density =
      this.mlvDensity() ??
      this._densityContext?.() ??
      this._densityService.density();
    const extra = this.class();
    return extra ? `${extra} mlv--${density}` : `mlv--${density}`;
  });
  /** Allow the overlay panel to grow to fill available viewport space. */
  readonly flexibleDimensions = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Controls overlay behaviour when the page is scrolled.
   *
   * - `'reposition'` (default) — overlay follows the trigger.
   * - `'close'` — overlay closes on scroll.
   * - `'block'` — page scroll is blocked while the overlay is open.
   * - `'noop'` — overlay stays fixed.
   */
  readonly scrollStrategy = input<MlvPopupScrollStrategy>('reposition');

  /**
   * Whether to render a transparent backdrop behind the popup.
   *
   * When `undefined` (default), the trigger decides — click/keyboard triggers
   * use a backdrop; hover triggers do not.
   *
   * Set to `false` to suppress the backdrop while keeping click-outside and
   * Escape detection active.
   */
  readonly hasBackdrop = input<boolean | undefined, BooleanInput | undefined>(
    undefined,
    {
      transform: (v): boolean | undefined =>
        v == null ? undefined : coerceBooleanProperty(v as BooleanInput),
    },
  );

  /**
   * When `true` (default), only the explicitly provided position(s) are passed to CDK.
   * CDK will push the popup into the viewport if none of them fit, but won't try other
   * named positions automatically.
   *
   * When `false`, the provided position(s) are used first and all remaining positions
   * from the active `POPUP_POSITIONS` map are appended as ordered fallbacks. CDK will
   * try them in sequence and use the first one that fits — useful for popups near edges
   * that should freely reposition rather than be pushed.
   *
   * @example Prefer bottom-start, fall back to any position that fits
   * ```html
   * <mlv-popup position="bottom-start" [restrictPosition]="false" />
   * ```
   */
  readonly restrictPosition = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });
  /**
   * ARIA role applied to the popup panel element.
   *
   * Defaults to `null` — the panel is a neutral positioning/chrome container and
   * the semantic role is expected to come from the projected content
   * (e.g. a `role="menu"` list, a `role="listbox"`, or a `role="tooltip"`).
   *
   * Set to `'dialog'` (together with {@link modal}`= true`) for genuine modal
   * dialog surfaces such as a date-picker calendar. When `panelRole === 'dialog'`
   * and {@link modal} is `true`, an accessible name via {@link ariaLabel} (or a
   * projected labelling element) is required.
   */
  readonly panelRole = input<string | null>(null);

  /**
   * Whether the popup panel behaves as a modal surface.
   *
   * When `true`, the panel renders `aria-modal="true"` and enables the CDK focus
   * trap (Tab / Shift+Tab cycle within the panel). When `false` (default), no
   * `aria-modal` is emitted and focus is free to leave the panel — the correct
   * behaviour for menus, listboxes, and tooltips whose focus is managed by their
   * own trigger / roving-tabindex logic.
   */
  readonly modal = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Optional accessible name for the popup panel.
   * Applied as `aria-label` on the popup element.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Extra elements that count as "inside" the popup for click-outside dismissal.
   *
   * When the popup is opened without a backdrop (`[hasBackdrop]="false"`),
   * dismissal is detected by a document-level click listener that closes the
   * popup on any click outside the overlay panel. The trigger/anchor lives in
   * the normal document flow — outside the floating panel — so a click on it
   * (or on any control it owns) would otherwise be treated as "outside" and
   * dismiss the popup. List these elements (typically the trigger) so clicks
   * within them do not close the popup; e.g. `mlv-combobox` passes its input
   * row so caret repositioning while the list is open keeps the list open.
   *
   * Has no effect when a backdrop is used.
   */
  readonly dismissExcludeElements = input<readonly HTMLElement[]>([]);

  // ─── Mobile fullscreen mode ──────────────────────────────────────────────

  /** @private Signal-based viewport breakpoint service (SSR-safe via CDK). */
  private readonly _breakpoint = inject(MlvBreakpointService);

  /**
   * @private Optional popup i18n slice — provides the fullscreen close-button
   * label. Injected optionally so the popup keeps working when no i18n provider
   * is configured (falls back to the English default).
   */
  private readonly _i18n = inject(MLV_POPUP_I18N, { optional: true });

  /**
   * Controls whether the popup renders as a full-screen mobile sheet with a
   * header bar and close button instead of a trigger-anchored panel.
   *
   * Defaults to `'off'` so existing consumers are unaffected — the pickers
   * (day/date-range/time) opt into `'auto'`.
   */
  readonly mobileMode = input<MlvPopupMobileMode>('off');

  /**
   * Breakpoint below which `mobileMode="auto"` switches the popup to full-screen.
   * Defaults to `'md'` (viewport narrower than 768px, per `MLV_BREAKPOINT_CONFIG`).
   */
  readonly mobileBreakpoint = input<MlvBreakpoint>('md');

  /**
   * Optional visible title rendered in the full-screen header bar. When omitted,
   * the header shows only the close button.
   */
  readonly mobileTitle = input<string | undefined>(undefined);

  /**
   * Optional override for the full-screen close-button accessible name.
   * Falls back to the `MLV_POPUP_I18N` `close` string, then to `'Close'`.
   */
  readonly mobileCloseLabel = input<string | undefined>(undefined);

  /**
   * @private Live resolution of the full-screen decision from the current
   * inputs and viewport. Read directly only while the popup is closed —
   * {@link isFullscreen} latches it for the duration of each open.
   */
  private readonly _liveFullscreen = computed<boolean>(() => {
    const mode = this.mobileMode();
    if (mode === 'off') return false;
    if (mode === 'fullscreen') return true;
    return this._breakpoint.isDown(this.mobileBreakpoint())();
  });

  /**
   * @private The mode the currently-open overlay was created with, or `null`
   * while no overlay is attached.
   *
   * Written only by {@link lockFullscreenForOpen} / {@link releaseFullscreenLock},
   * which the overlay owner calls at attach and at dispose. Of the overlay's own
   * full-screen half, CDK can change three parts on an attached overlay — the
   * position strategy, the `mlv-popup-fullscreen-pane` class and the block
   * scroll strategy — but **not the scrim**: `_attachBackdrop()` is private and
   * runs only from `attach()`, and `detachBackdrop()` is one-way. A popup opened
   * anchored with no backdrop therefore cannot grow one mid-open, so this side
   * has to hold still too.
   */
  private readonly _lockedFullscreen = signal<boolean | null>(null);

  /**
   * Whether the popup is currently rendering as a full-screen mobile sheet.
   *
   * `'off'` → always `false`; `'fullscreen'` → always `true`; `'auto'` → `true`
   * when the viewport is below {@link mobileBreakpoint}. Public so consumers with
   * their own inner focus trap (e.g. `mlv-date-range-picker`) can disable it to
   * avoid nesting two traps inside the full-screen panel.
   *
   * **Resolved once per open.** While an overlay is attached this reports the
   * mode that overlay was built with and does not track the viewport, the
   * {@link mobileMode} input or the {@link mobileBreakpoint} input: a sheet the
   * user opened stays a sheet for as long as it is open, and an anchored
   * dropdown stays anchored. A breakpoint crossed *between* opens is picked up
   * by the next open. See `docs/migrations/2026-09-popup-fullscreen-per-open.md`.
   */
  readonly isFullscreen = computed<boolean>(
    () => this._lockedFullscreen() ?? this._liveFullscreen(),
  );

  /**
   * @internal Fixes the full-screen mode for one open and returns it.
   *
   * Assumes **one attached overlay per popup instance** — the latch is a single
   * tri-state, not a refcount. Every owner that attaches an overlay must call
   * this and pair it with {@link releaseFullscreenLock}; an owner that skipped
   * it would leave {@link isFullscreen} live-reactive over an overlay built
   * with a fixed flag, which is #126.
   *
   * Called by the overlay owner (`MlvPopupContainer`, `MlvPopupTrigger`,
   * `MlvMenuOverlayController`) at the
   * moment it builds the overlay, so the flag the CDK overlay is created with
   * and the value {@link isFullscreen} reports for that open are the same read —
   * they cannot drift apart while the overlay lives. Paired with
   * {@link releaseFullscreenLock}, which the owner calls once the overlay is
   * disposed.
   */
  lockFullscreenForOpen(): boolean {
    const resolved = untracked(this._liveFullscreen);
    this._lockedFullscreen.set(resolved);
    return resolved;
  }

  /**
   * @internal Releases the per-open lock so {@link isFullscreen} tracks the
   * inputs and the viewport again. Called by the overlay owner after the
   * overlay is disposed, never during the leave animation — the panel is still
   * on screen then and must keep the chrome it opened with.
   */
  releaseFullscreenLock(): void {
    this._lockedFullscreen.set(null);
  }

  /** @protected Resolved accessible name for the full-screen close button. */
  protected readonly _closeLabel = computed(
    () => this.mobileCloseLabel() ?? this._i18n?.().close ?? 'Close',
  );

  /** Two-way binding for the open/closed state. */
  readonly opened = model(false);
  /** Emitted after the popup enters the view and the enter animation completes. */
  readonly afterOpened = output<void>();
  /** Emitted after the popup leaves the view and the leave animation completes. */
  readonly afterClosed = output<void>();

  readonly animationState = signal<'enter' | 'leave' | 'idle'>('idle');
  /**
   * The physical panel edge the arrow is currently drawn on. Written by
   * {@link updateArrowFromPosition} on every CDK position change.
   */
  readonly arrowEdge = signal<MlvPopupArrowEdge>('top');

  /**
   * Where along {@link arrowEdge} the arrow currently sits — physical, see
   * {@link MlvPopupArrowAlign}.
   */
  readonly arrowAlign = signal<MlvPopupArrowAlign>('start');

  /**
   * A physical offscreen offset derived from {@link arrowEdge} — 4px away from
   * the trigger, on whichever physical side the panel ended up on.
   *
   * Bound to `--mlv-popup-hidden-transform` on the panel.
   *
   * **Currently inert.** No stylesheet in the workspace reads that custom
   * property: the `popup-enter` / `popup-leave` keyframes in
   * `libs/styles/src/lib/animations.scss` read
   * `--mlv-popup-enter-from-translate-y` / `-scale` / `-opacity` and the
   * matching `--mlv-popup-leave-to-*`, which this value has never fed. So the
   * computed is correct but has no visual effect, and it is not part of what
   * #163 fixed — see `.claude/projects/libs-popup.md` → _Arrow geometry is
   * physical_.
   */
  readonly popupHiddenTransform = computed(() => {
    switch (this.arrowEdge()) {
      case 'top':
        return 'translateY(-4px)';
      case 'bottom':
        return 'translateY(4px)';
      case 'left':
        return 'translateX(-4px)';
      case 'right':
        return 'translateX(4px)';
    }
  });

  /** @protected Projected popup content template, rendered into the overlay panel. */
  protected readonly contentRef = contentChild(MlvPopupContent);

  /**
   * @protected Optional header-extension template projected via
   * `[mlvPopupHeaderContent]`. Rendered inside the full-screen header, directly
   * beneath the title/close row. Ignored while the popup is trigger-anchored
   * (only stamped when {@link isFullscreen} is `true`), so anchored popups are
   * byte-identical whether or not the slot is supplied.
   */
  protected readonly headerContentRef = contentChild(MlvPopupHeaderContent);

  /**
   * @protected Optional trailing-action template projected via
   * `[mlvPopupHeaderActions]`. Rendered inside the full-screen header's
   * title/close row, immediately before the close button, and — like
   * {@link headerContentRef} — only stamped while {@link isFullscreen} is
   * `true`, so an anchored popup is unaffected by its presence.
   */
  protected readonly headerActionsRef = contentChild(MlvPopupHeaderActions);

  /**
   * @protected Optional pinned-chrome template projected via
   * `[mlvPopupPinnedContent]`. Rendered in **every** mode, directly above
   * `.mlv-popup__scrollbar`, so it never scrolls with the content (in
   * full-screen it sits below the header). An absent slot stamps nothing —
   * byte-identical markup to a popup that never declared one.
   */
  protected readonly pinnedContentRef = contentChild(MlvPopupPinnedContent);

  /** @internal Emits when the leave animation finishes so the container can dispose the overlay. */
  readonly leaveAnimationDone$ = new Subject<void>();

  /**
   * @private Fallback timer guaranteeing `leaveAnimationDone$` fires even when
   * the panel's `animationend` never arrives — `prefers-reduced-motion` strips
   * the leave animation entirely, and hidden/background tabs throttle CSS
   * animations indefinitely. Without it the overlay would never dispose.
   * Mirrors `MlvOverlayRef`'s `_leaveFallbackMs` used by the drawer, and the
   * dialog's `LEAVE_FALLBACK_MS`.
   */
  private _leaveFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Arm the fallback whenever a leave starts; disarm on any state change
    // (the real `animationend` path resets the state to 'idle' on dispose).
    effect(() => {
      const state = this.animationState();
      if (this._leaveFallbackTimer !== null) {
        clearTimeout(this._leaveFallbackTimer);
        this._leaveFallbackTimer = null;
      }
      if (state === 'leave') {
        this._leaveFallbackTimer = setTimeout(() => {
          this._leaveFallbackTimer = null;
          this.onAnimationEnd();
        }, POPUP_LEAVE_FALLBACK_MS);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      if (this._leaveFallbackTimer !== null) {
        clearTimeout(this._leaveFallbackTimer);
        this._leaveFallbackTimer = null;
      }
    });
  }

  readonly popupTemplate =
    viewChild.required<TemplateRef<unknown>>('popupTemplate');

  // ─── Position resolution ─────────────────────────────────────────────────

  /**
   * Resolves the active CDK `ConnectedPosition[]` to pass to the overlay.
   *
   * **Position source** (first match wins):
   * 1. `position` input — named position(s) looked up in `POPUP_POSITIONS` map.
   * 2. `positions` input — raw CDK positions for advanced use.
   * 3. All defaults — every position in the active `POPUP_POSITIONS` map.
   *
   * **`restrictPosition` modifier:**
   * - `true` (default) — return the resolved positions as-is; CDK pushes the popup
   *   if none fit.
   * - `false` — append all remaining map positions (deduped by reference) after the
   *   resolved ones so CDK can freely choose a fitting position.
   */
  resolvedPositions(): ConnectedPosition[] {
    const named = this.position();
    let preferred: ConnectedPosition[] | undefined;

    if (named !== undefined) {
      preferred = MlvPopupPositionResolver.resolve(named, this._positionMap);
    } else {
      preferred = this.positions();
    }

    const base =
      preferred ?? MlvPopupPositionResolver.allPositions(this._positionMap);

    if (this.restrictPosition()) {
      return base;
    }

    // Append every map position not already present as a fallback.
    // Position objects from the map share the same reference, so Set dedup works.
    const all = MlvPopupPositionResolver.allPositions(this._positionMap);
    const seen = new Set(base);
    return [...base, ...all.filter((p) => !seen.has(p))];
  }

  buildSizeConfig(): MlvPopupSizeConfig {
    const size: MlvPopupSizeConfig = {};
    const width = this.width();
    const height = this.height();
    const minWidth = this.minWidth();
    const minHeight = this.minHeight();
    const maxWidth = this.maxWidth();
    const maxHeight = this.maxHeight();

    if (width !== undefined) size.width = width;
    if (height !== undefined) size.height = height;
    if (minWidth !== undefined) size.minWidth = minWidth;
    if (minHeight !== undefined) size.minHeight = minHeight;
    if (maxWidth !== undefined) size.maxWidth = maxWidth;
    if (maxHeight !== undefined) size.maxHeight = maxHeight;

    return size;
  }

  /**
   * Completes a pending leave — emits {@link leaveAnimationDone$} so the overlay
   * owner disposes the overlay. A no-op in every other state.
   *
   * Two callers, deliberately asymmetric: the panel's own `animationend`
   * arrives through {@link _onPanelAnimationEnd}, which filters out animations
   * that merely bubbled up from the content, while the leave fallback timer
   * calls this **unfiltered** to force-complete a leave whose `animationend`
   * never came (reduced motion, a throttled background tab). Keep it free of
   * any event-shaped guard so that force path stays available.
   */
  onAnimationEnd(): void {
    if (this.animationState() === 'leave') {
      this.leaveAnimationDone$.next();
    }
  }

  /**
   * @protected The panel's `animationend` listener, bound in `popup.html`.
   *
   * **The guard is load-bearing — do not delete it as redundant.**
   * `animationend` bubbles, so any *descendant* finishing a finite CSS
   * animation inside the leave window also reaches this listener; unguarded it
   * completed the leave and detached the overlay mid-animation (#231). Nothing
   * else on this path filters the event. The case is reachable with Malva's own
   * components, not only consumer content: `mlv-message` (rendered by
   * `mlv-input`, `mlv-select` and `mlv-combobox`) plays a finite
   * `mlv-slide-down` over `--mlv-duration-normal` through `animate.enter`, and
   * `mlv-expand` a finite `--mlv-duration-slow` expand/collapse — and the
   * editor's link popup and `mlv-filter`'s popup both host `mlv-input`. Only
   * the `infinite` animations (`mlv-loader`, `mlv-skeleton`,
   * `mlv-status-indicator`) never fire `animationend`.
   *
   * `currentTarget` is the element the listener is bound to (`.mlv-popup`), so
   * the comparison admits exactly the panel's own `popup-enter` / `popup-leave`
   * keyframes and follows the binding if the panel element is ever moved. It is
   * read synchronously, inside the dispatch, where it is still set. Mirrors
   * `MlvDialog._onAnimationEnd`, which compares against its host element for
   * the same reason.
   */
  protected _onPanelAnimationEnd(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onAnimationEnd();
    }
  }

  /**
   * @internal Promotes a freshly attached panel from `'idle'` to `'enter'`.
   *
   * Overlay owners (`MlvPopupContainer`, `MlvPopupTrigger`, `MlvMenuTrigger`)
   * call this from a microtask so the panel is in the DOM before the enter
   * keyframes start. A close requested in the same tick as the attach already
   * moved the state to `'leave'` by then, and overwriting it would strand the
   * overlay: the leave keyframes never play, so no `animationend` arrives, and
   * the write itself cancels the leave fallback timer — leaving no path back to
   * a detach. Promote only from the exact state the attach left behind.
   */
  beginEnterAnimation(): void {
    if (this.animationState() === 'idle') {
      this.animationState.set('enter');
    }
  }

  /**
   * @protected Handles the full-screen header close button. Requests closure via
   * the two-way `opened` model so the consumer's `afterClosed` (focus restore)
   * and the container/trigger leave-animation machinery run — identical to the
   * Escape / backdrop close path.
   */
  protected _onCloseClick(): void {
    this.opened.set(false);
  }

  /**
   * Derives the **physical** {@link arrowEdge} / {@link arrowAlign} from the
   * `ConnectedPosition` CDK actually applied.
   *
   * The pair is **logical**. `FlexibleConnectedPositionStrategy` mirrors
   * `start` / `end` against the pane's own direction (its `_isRtl()` reads
   * `overlayRef.getDirection()`), and the pane is portaled to `<body>`, so that
   * direction is the **trigger's**, not the document's — a popup opened from
   * inside a `dir="rtl"` subtree mirrors while the page around it does not.
   * Copying the pair through therefore inverts both side arrows: in RTL
   * `overlayX: 'end'` + `originX: 'start'` puts the panel to the *right* of the
   * trigger, and an arrow on the right edge points away from it (#163).
   *
   * `direction` is the value the overlay was created with, read back off the
   * overlay by `MlvPopupService` and handed to `onPositionChange`, so the arrow
   * cannot disagree with the geometry CDK produced from it.
   *
   * Detection logic, stated in LTR — the inline axis mirrors in RTL, the block
   * axis never moves:
   * - `overlayX='end'` + `originX='start'` → panel to the trigger's **inline start**
   *   → arrow on the panel's inline-end edge → physical `right` (LTR) / `left` (RTL)
   * - `overlayX='start'` + `originX='end'` → panel to the trigger's **inline end**
   *   → arrow on the panel's inline-start edge → physical `left` (LTR) / `right` (RTL)
   * - `overlayY='top'` (all other cases) → panel **below** the trigger → arrow on top
   * - `overlayY='bottom'` (all other cases) → panel **above** the trigger → arrow on bottom
   *
   * A side arrow's alignment rides `overlayY` (block axis — never mirrors); a
   * top/bottom arrow's rides `overlayX` and mirrors with it.
   *
   * @param pair — the position CDK resolved, from
   *   `ConnectedOverlayPositionChange.connectionPair`.
   * @param direction — the direction of the pane the panel is rendered into.
   *   Optional so the signature stays source-compatible; omitting it assumes
   *   `'ltr'` and reproduces the pre-#163 mapping exactly. Every overlay owner
   *   in this library passes it.
   */
  updateArrowFromPosition(
    pair: ConnectedPosition,
    direction: MlvDirection = 'ltr',
  ): void {
    const { originX, overlayX, overlayY } = pair;
    const rtl = direction === 'rtl';

    if (overlayX === 'end' && originX === 'start') {
      // Panel hangs off the trigger's inline-START side, so the arrow rides the
      // panel's inline-END edge — physically right in LTR, left in RTL.
      this.arrowEdge.set(rtl ? 'left' : 'right');
      this.arrowAlign.set(toBlockAlign(overlayY));
    } else if (overlayX === 'start' && originX === 'end') {
      // Panel hangs off the trigger's inline-END side — the mirror image.
      this.arrowEdge.set(rtl ? 'right' : 'left');
      this.arrowAlign.set(toBlockAlign(overlayY));
    } else if (overlayY === 'top') {
      // Panel is BELOW the trigger — arrow on the top edge.
      this.arrowEdge.set('top');
      this.arrowAlign.set(toInlineAlign(overlayX, rtl));
    } else {
      // Panel is ABOVE the trigger — arrow on the bottom edge.
      this.arrowEdge.set('bottom');
      this.arrowAlign.set(toInlineAlign(overlayX, rtl));
    }
  }
}
