import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  PLATFORM_ID,
  type TemplateRef,
  ViewContainerRef,
  ViewEncapsulation,
  computed,
  contentChild,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { LucideDynamicIcon, LucidePlus, LucideX } from '@lucide/angular';
import { MlvButton, type MlvButtonVariant } from '@malva-ui/core/button';
import { MlvTooltip, type MlvTooltipPlacement } from '@malva-ui/core/tooltip';
import { MlvRtlService, mlvNextId } from '@malva-ui/cdk/utils';
import {
  MLV_DENSITY_CONTEXT,
  MlvDensityService,
  type MlvDensity,
} from '@malva-ui/cdk/density';
import { MlvSpeedDialItemDef } from './speed-dial-item-def';
import type {
  MlvSpeedDialDirection,
  MlvSpeedDialItem,
  MlvSpeedDialItemEvent,
  MlvSpeedDialTriggerType,
  MlvSpeedDialType,
} from './speed-dial.types';

/**
 * Time the last action needs to finish its exit transition once its stagger
 * delay has elapsed: `--mlv-duration-normal` (200 ms) plus slack for the
 * change-detection pass and style flush that precede the transition start.
 * The overlay is detached only after `transitionDelay × (n − 1) +
 * CLOSE_SETTLE_MS` so no action is torn out of the DOM mid-transition.
 * @private
 */
const CLOSE_SETTLE_MS = 250;

/**
 * Grace period between the pointer leaving the trigger (or the actions) and a
 * hover-opened dial closing — long enough to cross the gap between the trigger
 * and the nearest action, short enough that the dial does not linger.
 */
const HOVER_CLOSE_DELAY_MS = 200;

/** Arc (start → end, degrees, clockwise from 3 o'clock) per layout/direction. @private */
const SEMI_CIRCLE_ARCS: Record<
  'up' | 'down' | 'left' | 'right',
  [number, number]
> = {
  up: [180, 360],
  down: [0, 180],
  left: [90, 270],
  right: [270, 450],
};

/** @private */
const QUARTER_CIRCLE_ARCS: Record<
  'up-left' | 'up-right' | 'down-left' | 'down-right',
  [number, number]
> = {
  'up-left': [180, 270],
  'up-right': [270, 360],
  'down-left': [90, 180],
  'down-right': [0, 90],
};

/** Collapses a corner direction to its vertical half. @private */
function cardinalDirection(
  direction: MlvSpeedDialDirection,
): 'up' | 'down' | 'left' | 'right' {
  switch (direction) {
    case 'up-left':
    case 'up-right':
      return 'up';
    case 'down-left':
    case 'down-right':
      return 'down';
    default:
      return direction;
  }
}

/**
 * Mirrors the horizontal component of a direction — `left` ↔ `right`,
 * `up-left` ↔ `up-right`, `down-left` ↔ `down-right` — so a logical direction
 * resolves to its physical side under RTL. Vertical values are unchanged.
 * @private
 */
function mirrorDirection(
  direction: MlvSpeedDialDirection,
): MlvSpeedDialDirection {
  switch (direction) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'up-left':
      return 'up-right';
    case 'up-right':
      return 'up-left';
    case 'down-left':
      return 'down-right';
    case 'down-right':
      return 'down-left';
    default:
      return direction;
  }
}

/** Promotes a cardinal direction to the corner a quarter-circle needs. @private */
function cornerDirection(
  direction: MlvSpeedDialDirection,
): 'up-left' | 'up-right' | 'down-left' | 'down-right' {
  switch (direction) {
    case 'up':
    case 'right':
      return 'up-right';
    case 'down':
      return 'down-right';
    case 'left':
      return 'up-left';
    default:
      return direction;
  }
}

/**
 * Unit-circle multiplier as CSS text. Rounded to four decimals so `cos(270°)`
 * reads `0`, not `-1.8369701987210297e-16`; `-0` is normalised to `0`.
 * @private
 */
function unitMultiplier(value: number): string {
  const rounded = Number(value.toFixed(4)) || 0;
  return `calc(${rounded} * var(--mlv-speed-dial-radius))`;
}

/**
 * Angles (degrees) of `count` actions for a radial layout. A full circle
 * starts at 12 o'clock and distributes evenly; an arc spreads its endpoints
 * inclusive, and a single action sits at the arc's midpoint.
 * @private
 */
function radialAngles(
  type: Exclude<MlvSpeedDialType, 'linear'>,
  direction: MlvSpeedDialDirection,
  count: number,
): number[] {
  if (count === 0) return [];
  if (type === 'circle') {
    const step = 360 / count;
    return Array.from({ length: count }, (_, i) => -90 + i * step);
  }
  const [start, end] =
    type === 'semi-circle'
      ? SEMI_CIRCLE_ARCS[cardinalDirection(direction)]
      : QUARTER_CIRCLE_ARCS[cornerDirection(direction)];
  if (count === 1) return [(start + end) / 2];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/** One action resolved for rendering. @private */
interface MlvSpeedDialEntry {
  readonly item: MlvSpeedDialItem;
  readonly index: number;
  readonly key: string | number;
  readonly disabled: boolean;
  /** Radial layouts only — `calc(<cos> * var(--mlv-speed-dial-radius))`. */
  readonly x: string | null;
  readonly y: string | null;
  /** `--mlv-stagger-index`: ascending while opening, descending while closing. */
  readonly delayIndex: number;
}

/**
 * Floating action button that unfolds into a set of related actions
 * (`mlv-speed-dial`). The actions render in a CDK overlay centred on the
 * trigger, so they are never clipped by an `overflow: hidden` ancestor and the
 * optional `mask` is a real backdrop.
 *
 * Layouts: `linear` (a row/column in `direction`), `circle`, `semi-circle`
 * and `quarter-circle` (actions on an arc of `radius` px). Actions enter and
 * leave with a per-item stagger (`transitionDelay` ms), reversed on close so
 * the farthest action leaves first.
 *
 * Follows the WAI-ARIA menu-button pattern: the trigger is a native
 * `<button>` with `aria-haspopup="menu"` / `aria-expanded` / `aria-controls`;
 * the actions are `role="menuitem"` buttons inside a `role="menu"` list.
 * Arrow keys move between enabled actions (wrapping), Home/End jump, Escape
 * closes and restores focus to the trigger, Tab closes without trapping.
 *
 * @example
 * ```html
 * <mlv-speed-dial
 *   [items]="[
 *     { label: 'New file', icon: 'file-plus', command: create },
 *     { label: 'Upload', icon: 'upload', command: upload },
 *   ]"
 *   type="semi-circle"
 *   direction="up"
 *   ariaLabel="Create"
 * />
 * ```
 */
@Component({
  selector: 'mlv-speed-dial',
  templateUrl: './speed-dial.html',
  styleUrl: './speed-dial.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    MlvButton,
    MlvTooltip,
    LucidePlus,
    LucideX,
    LucideDynamicIcon,
  ],
  host: {
    class: 'mlv-speed-dial',
    '[class.mlv-speed-dial--open]': 'opened()',
    '[class.mlv-speed-dial--masked]': '_overlayAttached() && mask()',
    '[class.mlv-speed-dial--disabled]': 'disabled()',
    '(pointerenter)': '_onHoverEnter($event)',
    '(pointerleave)': '_onHoverLeave($event)',
    '(focusin)': '_onFocusIn()',
    '(focusout)': '_onFocusOut($event)',
    '(pointerdown)': '_onPointerDown()',
  },
})
export class MlvSpeedDial {
  // ─── Inputs ───────────────────────────────────────────────────────────────

  /** The actions to render, in reading order. */
  readonly items = input.required<readonly MlvSpeedDialItem[]>();

  /** Layout of the actions around the trigger. */
  readonly type = input<MlvSpeedDialType>('linear');

  /**
   * What opens the dial — one type or several, like `[mlvPopupTrigger]`'s
   * `triggerOn`. The trigger's click (pointer or Enter/Space) always toggles,
   * whatever is listed, so the menu button stays keyboard- and
   * touch-operable; `'hover'` and `'focus'` add openers on top:
   *
   * - `'hover'` opens when a mouse/pen pointer enters the trigger and closes
   *   200 ms after it has left both the trigger and the actions (touch
   *   pointers are ignored, focus never moves).
   * - `'focus'` opens when the trigger receives focus and closes when focus
   *   leaves both the trigger and the actions. Focus is not moved into the
   *   menu; ArrowDown/ArrowUp do that as usual.
   */
  readonly triggerOn = input<
    MlvSpeedDialTriggerType | readonly MlvSpeedDialTriggerType[]
  >('click');

  /** @private `triggerOn` normalised to a set. */
  private readonly _triggers = computed(() => {
    const value = this.triggerOn();
    return new Set<MlvSpeedDialTriggerType>(
      typeof value === 'string' ? [value] : value,
    );
  });

  /**
   * Where the actions unfold. Cardinal values drive `linear`/`semi-circle`;
   * corner values drive `quarter-circle` — see {@link MlvSpeedDialDirection}
   * for how a mismatched value resolves.
   *
   * Horizontal values are **logical**: `left` is inline-start, so under RTL
   * (a `dir="rtl"` ancestor or the global `MlvRtlService` direction) `left`,
   * `right` and the corner values are mirrored. `up` and `down` never change.
   */
  readonly direction = input<MlvSpeedDialDirection>('up');

  /**
   * Distance in px from the trigger's centre to each action's centre for the
   * radial layouts (`circle`, `semi-circle`, `quarter-circle`). Ignored by
   * `linear`, which spaces actions with the density gap instead.
   */
  readonly radius = input<number>(80);

  /**
   * Stagger in ms between consecutive actions' enter/leave transitions. The
   * order reverses on close so the farthest action leaves first. `0` moves
   * every action at once; `prefers-reduced-motion` drops the stagger entirely.
   */
  readonly transitionDelay = input<number>(30);

  /**
   * Dims the page behind the open dial with a backdrop that closes it on click.
   * The trigger is lifted above the overlay container so it stays legible
   * through the mask — an ancestor stacking context defeats that lift.
   */
  readonly mask = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Disables the trigger and closes the dial if it is open. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Accessible name of the trigger button when no `ariaLabelledby` is set. */
  readonly ariaLabel = input<string | undefined>(undefined);

  /** Id of the element that labels the trigger; wins over `ariaLabel`. */
  readonly ariaLabelledby = input<string | undefined>(undefined);

  /** `mlv-button` variant of the trigger. */
  readonly variant = input<MlvButtonVariant>('primary');

  /** `mlv-button` variant of every action. */
  readonly itemVariant = input<MlvButtonVariant>('secondary');

  /** Shows each action's `label` as a tooltip on hover/focus. */
  readonly showTooltips = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Tooltip placement for the actions. Defaults to the side that does not
   * overlap the neighbouring actions: `left` for vertical linear layouts,
   * `top` for everything else.
   */
  readonly tooltipPlacement = input<MlvTooltipPlacement | undefined>(undefined);

  /**
   * Density for the trigger and the actions. The actions are portaled to the
   * CDK overlay container, outside the page's density cascade, so the resolved
   * density is stamped as `mlv--{density}` on the panel. Omitted → the nearest
   * density context, then the global `MlvDensityService`.
   */
  readonly mlvDensity = input<MlvDensity | undefined>(undefined);

  // ─── Model / outputs ──────────────────────────────────────────────────────

  /** Two-way open state. Setting it `true` while `disabled` is a no-op. */
  readonly opened = model(false);

  /** Emits after an action's `command` ran and before the dial closes. */
  readonly itemSelect = output<MlvSpeedDialItemEvent>();

  // ─── Injected services ────────────────────────────────────────────────────

  /** @private CDK overlay factory for the actions panel. */
  private readonly _overlay = inject(Overlay);

  /** @private Owns the panel's embedded view so view queries and DI resolve through this component. */
  private readonly _viewContainerRef = inject(ViewContainerRef);

  /** @private Resolves the trigger's text direction for the detached pane. */
  private readonly _rtl = inject(MlvRtlService);

  /** @private The host element — the scope the reading direction is resolved for. */
  private readonly _hostRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Direction applying to the host, recomputed on a global flip or a
   * `dir` attribute change anywhere in the document.
   */
  private readonly _hostDirection = this._rtl.elementDirection(this._hostRef);

  /**
   * @protected `direction` resolved to its physical side: mirrored horizontally
   * under RTL, unchanged in LTR. Every layout decision reads this, never the
   * raw input.
   */
  protected readonly _resolvedDirection = computed<MlvSpeedDialDirection>(() =>
    this._hostDirection() === 'rtl'
      ? mirrorDirection(this.direction())
      : this.direction(),
  );

  /** @private Used for `activeElement` and the reduced-motion media query. */
  private readonly _document = inject(DOCUMENT);

  /** @private Overlay creation touches the DOM; skipped during server rendering. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** @private Global density fallback for the detached panel. */
  private readonly _densityService = inject(MlvDensityService);

  /** @private Nearest ancestor density context (e.g. `form[mlvForm]`), if any. */
  private readonly _densityContext = inject(MLV_DENSITY_CONTEXT, {
    optional: true,
  });

  // ─── Queries ──────────────────────────────────────────────────────────────

  /** @protected Optional custom action content. */
  protected readonly _itemDef = contentChild(MlvSpeedDialItemDef);

  /** @private The trigger `<button>`; overlay origin and focus-return target. */
  private readonly _triggerRef = viewChild.required('trigger', {
    // `#trigger` sits on a `button[mlvButton]`, so the bare ref would resolve
    // to the MlvButton instance rather than the element.
    read: ElementRef<HTMLButtonElement>,
  });

  /** @private The actions panel template, portaled into the overlay while open. */
  private readonly _panelTemplate =
    viewChild.required<TemplateRef<unknown>>('panelTemplate');

  // ─── State ────────────────────────────────────────────────────────────────

  /** @protected `id` of the trigger, referenced by the menu's `aria-labelledby`. */
  protected readonly _triggerId = mlvNextId('mlv-speed-dial-trigger');

  /** @protected `id` of the `role="menu"` list, referenced by `aria-controls`. */
  protected readonly _menuId = mlvNextId('mlv-speed-dial-menu');

  /**
   * @private Whether the panel shows its open state. Lags `opened` on close:
   * it flips false immediately (starting the exit transition) while the overlay
   * stays attached until the transition settles.
   */
  private readonly _panelOpen = signal(false);

  /**
   * @protected Whether an overlay is attached — stays `true` through the exit
   * transition, unlike `opened()`. Drives the `--masked` lift so the trigger
   * stays above the backdrop until the backdrop is actually gone.
   */
  protected readonly _overlayAttached = signal(false);

  /** @private Live overlay while attached (also during the exit transition). */
  private _overlayRef: OverlayRef | null = null;

  /** @private Pending overlay disposal scheduled after the exit transition. */
  private _closeTimer: ReturnType<typeof setTimeout> | null = null;

  /** @private Pending hover close (`'hover'` trigger type), or `null`. */
  private _hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @private Set while the component itself moves focus back to the trigger
   * (Escape, keyboard activation, Tab, hover close), so that focus does not
   * read as a `'focus'`-trigger open and reopen the dial just closed.
   */
  private _suppressFocusOpen = false;

  /**
   * @private A pointer press is in progress on the trigger (`pointerdown`
   * seen, no `click`/`pointerleave` yet). Only then does a `'focus'` open
   * count as caused by the press — see `_focusJustOpened`.
   */
  private _pointerPressed = false;

  /**
   * @private Set when a `'focus'` trigger opened the dial because of a pointer
   * press (browsers that focus a button on `mousedown` fire `focusin` before
   * `click`); consumed by that press's `click` so it does not toggle the dial
   * shut again. A keyboard focus-open never sets it, so the next mouse click
   * is a normal toggle.
   */
  private _focusJustOpened = false;

  /** @private Subscriptions and listeners torn down with the overlay. */
  private _cleanups: (() => void)[] = [];

  /** @private Which action to focus once the panel attaches after a keyboard open. */
  private _pendingFocus: 'first' | 'last' | null = null;

  /** @private The `mask` value the live overlay was created with (`hasBackdrop` is fixed at creation). */
  private _overlayMasked = false;

  // ─── Derived ──────────────────────────────────────────────────────────────

  /** @protected The actions with their radial offsets and stagger indices resolved. */
  protected readonly _entries = computed<readonly MlvSpeedDialEntry[]>(() => {
    const items = this.items();
    const type = this.type();
    const direction = this._resolvedDirection();
    const opening = this._panelOpen();
    const count = items.length;
    const angles =
      type === 'linear' ? null : radialAngles(type, direction, count);

    return items.map((item, index) => {
      const angle = angles ? (angles[index] * Math.PI) / 180 : null;
      return {
        item,
        index,
        key: item.id ?? index,
        disabled: !!item.disabled,
        x: angle === null ? null : unitMultiplier(Math.cos(angle)),
        y: angle === null ? null : unitMultiplier(Math.sin(angle)),
        delayIndex: opening ? index : count - 1 - index,
      };
    });
  });

  /**
   * @protected Density applied to the trigger and every action: the input,
   * else the nearest `MLV_DENSITY_CONTEXT`, else the global service. Resolved
   * once here because the actions are portaled out of the page cascade and
   * `MlvButton` stamps its own `mlv-button--{density}` — an ancestor class on
   * the panel would never reach them.
   */
  protected readonly _density = computed<MlvDensity>(
    () =>
      this.mlvDensity() ??
      this._densityContext?.() ??
      this._densityService.density(),
  );

  /** @protected Modifier classes of the panel, plus the resolved density cascade class. */
  protected readonly _panelClass = computed(() => {
    const classes = [
      `mlv-speed-dial__panel--${this.type()}`,
      `mlv--${this._density()}`,
    ];
    if (this._panelOpen()) classes.push('mlv-speed-dial__panel--open');
    return classes.join(' ');
  });

  /** @protected Layout modifier classes of the `role="menu"` list. */
  protected readonly _listClass = computed(() =>
    this.type() === 'linear'
      ? `mlv-speed-dial__list--linear mlv-speed-dial__list--linear-${cardinalDirection(this._resolvedDirection())}`
      : 'mlv-speed-dial__list--radial',
  );

  /** @protected Resolved tooltip placement — explicit input, else layout-aware default. */
  protected readonly _tooltipPlacement = computed<MlvTooltipPlacement>(() => {
    const explicit = this.tooltipPlacement();
    if (explicit) return explicit;
    if (this.type() !== 'linear') return 'top';
    const direction = cardinalDirection(this._resolvedDirection());
    return direction === 'up' || direction === 'down' ? 'left' : 'top';
  });

  constructor() {
    effect(() => {
      const opened = this.opened();
      const disabled = this.disabled();
      untracked(() => {
        if (opened && disabled) {
          this.opened.set(false);
          return;
        }
        if (opened) this._attach();
        else this._scheduleDetach();
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this._cancelHoverClose();
      this._disposeOverlay();
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Opens the dial unless it is disabled. */
  open(): void {
    if (this.disabled()) return;
    this.opened.set(true);
  }

  /** Closes the dial. */
  close(): void {
    this.opened.set(false);
  }

  /** Toggles the dial; a closed, disabled dial stays closed. */
  toggle(): void {
    if (this.opened()) this.close();
    else this.open();
  }

  // ─── Hover handlers (host and panel) ──────────────────────────────────────

  /**
   * @protected Opens on a mouse/pen pointer entering the host or the panel
   * while `'hover'` is a trigger type; cancels a pending hover close.
   */
  protected _onHoverEnter(event: PointerEvent): void {
    if (!this._hoverApplies(event)) return;
    this._cancelHoverClose();
    this.open();
  }

  /**
   * @protected Schedules the hover close when the pointer leaves the host or
   * the panel. Re-entering either within the grace period cancels it.
   */
  protected _onHoverLeave(event: PointerEvent): void {
    // A press that is dragged off the trigger never clicks; forget it.
    this._pointerPressed = false;
    this._focusJustOpened = false;
    if (!this._hoverApplies(event)) return;
    this._cancelHoverClose();
    this._hoverCloseTimer = setTimeout(() => {
      this._hoverCloseTimer = null;
      // Re-check at fire time: the mode may have flipped during the grace
      // period, in which case the pointer no longer owns the open state.
      if (!this._hasTrigger('hover')) return;
      // Keyboard focus may have moved into the menu meanwhile; disposing the
      // overlay under it would drop focus to <body>.
      const active = document.activeElement;
      if (active && this._overlayRef?.overlayElement.contains(active)) {
        this._closeAndRefocus();
      } else {
        this.close();
      }
    }, HOVER_CLOSE_DELAY_MS);
  }

  /** @private Hover applies only in hover mode, for non-touch pointers, while enabled. */
  private _hoverApplies(event: PointerEvent): boolean {
    return (
      this._hasTrigger('hover') &&
      event.pointerType !== 'touch' &&
      !this.disabled()
    );
  }

  /** @private Whether `type` is one of the configured trigger types. */
  private _hasTrigger(type: MlvSpeedDialTriggerType): boolean {
    return this._triggers().has(type);
  }

  // ─── Focus handlers (host and panel) ──────────────────────────────────────

  /** @protected Marks a pointer press on the trigger (see `_pointerPressed`). */
  protected _onPointerDown(): void {
    this._pointerPressed = true;
  }

  /**
   * @protected Opens when the trigger receives focus while `'focus'` is a
   * trigger type. Focus stays on the trigger.
   */
  protected _onFocusIn(): void {
    if (
      !this._hasTrigger('focus') ||
      this._suppressFocusOpen ||
      this.disabled()
    ) {
      return;
    }
    this._focusJustOpened = this._pointerPressed && !this.opened();
    this.open();
  }

  /**
   * @protected Closes when focus leaves both the trigger and the actions
   * while `'focus'` is a trigger type. Focus moving between the trigger and
   * the (portaled) actions is not a leave.
   */
  protected _onFocusOut(event: FocusEvent): void {
    if (!this._hasTrigger('focus')) return;
    const next = event.relatedTarget;
    if (
      next instanceof Node &&
      (this._hostRef.nativeElement.contains(next) ||
        this._overlayRef?.overlayElement.contains(next))
    ) {
      return;
    }
    this.close();
  }

  /** @private Clears a pending hover close. */
  private _cancelHoverClose(): void {
    if (this._hoverCloseTimer === null) return;
    clearTimeout(this._hoverCloseTimer);
    this._hoverCloseTimer = null;
  }

  // ─── Trigger handlers ─────────────────────────────────────────────────────

  /**
   * @protected Toggles on click. A keyboard activation (Enter/Space become a
   * `click` with `detail === 0`) that opens the dial also moves focus to the
   * first action, per the menu-button pattern; a pointer click leaves focus
   * on the trigger.
   */
  protected _onTriggerClick(event: MouseEvent): void {
    if (this.disabled()) return;
    // An explicit click wins over a pending hover close.
    this._cancelHoverClose();
    // The click of the very pointer press that focused (and thereby opened)
    // the dial is not a toggle request.
    this._pointerPressed = false;
    if (this._focusJustOpened) {
      this._focusJustOpened = false;
      if (this.opened()) return;
    }
    const willOpen = !this.opened();
    if (willOpen && event.detail === 0) this._pendingFocus = 'first';
    this.toggle();
  }

  /** @protected ArrowDown/ArrowUp open the dial (if closed) and focus the first/last action. */
  protected _onTriggerKeydown(event: KeyboardEvent): void {
    // A key press after a focus-open means the next Enter/Space is deliberate.
    this._focusJustOpened = false;
    if (this.disabled()) return;
    let target: 'first' | 'last' | null = null;
    if (event.key === 'ArrowDown') target = 'first';
    else if (event.key === 'ArrowUp') target = 'last';
    if (!target) return;

    event.preventDefault();
    if (this.opened() && this._overlayRef?.hasAttached()) {
      this._focusAction(target);
      return;
    }
    this._pendingFocus = target;
    this.open();
  }

  // ─── Menu handlers ────────────────────────────────────────────────────────

  /**
   * @protected Roving focus between enabled actions: ArrowDown/ArrowRight →
   * next, ArrowUp/ArrowLeft → previous (both wrapping; the horizontal pair is
   * mirrored under RTL), Home/End → first/last, Tab → close and park focus on
   * the trigger, unprevented, so the browser's sequential navigation continues
   * from the trigger's place in the page rather than from the overlay
   * container at the end of `<body>`. Escape is handled once, by the overlay's
   * `keydownEvents` (see `_attach`), which also covers focus on the trigger.
   */
  protected _onMenuKeydown(event: KeyboardEvent): void {
    const rtl = this._hostDirection() === 'rtl';
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this._moveFocus(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this._moveFocus(-1);
        return;
      case 'ArrowRight':
        event.preventDefault();
        this._moveFocus(rtl ? -1 : 1);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        this._moveFocus(rtl ? 1 : -1);
        return;
      case 'Home':
        event.preventDefault();
        this._focusAction('first');
        return;
      case 'End':
        event.preventDefault();
        this._focusAction('last');
        return;
      case 'Tab':
        this._closeAndRefocus();
        return;
      default:
        return;
    }
  }

  /**
   * @protected Runs the action's `command`, emits `itemSelect`, then closes.
   * A keyboard activation returns focus to the trigger so it is not lost when
   * the actions leave the DOM.
   */
  protected _onItemClick(entry: MlvSpeedDialEntry, event: MouseEvent): void {
    if (entry.disabled) return;
    const payload: MlvSpeedDialItemEvent = {
      item: entry.item,
      index: entry.index,
      originalEvent: event,
    };
    entry.item.command?.(payload);
    this.itemSelect.emit(payload);
    if (event.detail === 0) this._closeAndRefocus();
    else this.close();
  }

  // ─── Overlay lifecycle ────────────────────────────────────────────────────

  /**
   * @private Creates the overlay centred on the trigger and attaches the panel.
   * If the overlay is still attached from an in-flight close, the pending
   * disposal is cancelled and the panel simply reopens.
   */
  private _attach(): void {
    if (!this._isBrowser) return;
    this._cancelScheduledDispose();

    // `hasBackdrop` is fixed at creation; a `mask` change since then means the
    // attached-but-closing overlay cannot be reused.
    if (this._overlayRef && this._overlayMasked !== this.mask()) {
      this._disposeOverlay();
    }

    if (!this._overlayRef) {
      const triggerEl = this._triggerRef().nativeElement;
      this._overlayMasked = this.mask();
      const rect = triggerEl.getBoundingClientRect();
      const overlayRef = this._overlay.create({
        positionStrategy: this._overlay
          .position()
          .flexibleConnectedTo(triggerEl)
          .withPositions([
            {
              originX: 'center',
              originY: 'center',
              overlayX: 'center',
              overlayY: 'center',
            },
          ])
          .withPush(false)
          .withFlexibleDimensions(false)
          .withViewportMargin(0)
          .withLockedPosition(),
        scrollStrategy: this._overlay.scrollStrategies.reposition(),
        // The pane is exactly the trigger's box; the actions hang off it.
        width: rect.width,
        height: rect.height,
        direction: this._rtl.resolveDirection(triggerEl),
        hasBackdrop: this.mask(),
        backdropClass: 'mlv-speed-dial__backdrop',
        panelClass: 'mlv-speed-dial__pane',
      });
      this._overlayRef = overlayRef;
      this._overlayAttached.set(true);

      overlayRef.attach(
        new TemplatePortal(this._panelTemplate(), this._viewContainerRef),
      );

      const backdrop = overlayRef.backdropClick().subscribe(() => this.close());
      const outside = overlayRef.outsidePointerEvents().subscribe((event) => {
        // The trigger toggles on its own click; treating it as "outside" would
        // close here and immediately reopen in the click handler.
        if (triggerEl.contains(event.target as Node)) return;
        this.close();
      });
      const keys = overlayRef.keydownEvents().subscribe((event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        this._closeAndRefocus();
      });
      this._cleanups.push(
        () => backdrop.unsubscribe(),
        () => outside.unsubscribe(),
        () => keys.unsubscribe(),
      );

      // Flush the freshly attached panel's closed styles before flipping to the
      // open modifier, so the enter transition actually runs.
      void overlayRef.overlayElement.offsetWidth;
    }

    this._panelOpen.set(true);

    const focus = this._pendingFocus;
    this._pendingFocus = null;
    if (focus) this._focusAction(focus);
  }

  /**
   * @private Starts the exit transition and disposes the overlay once the
   * slowest action has finished — immediately under reduced motion.
   */
  private _scheduleDetach(): void {
    // A focus request that never got to run must not leak into a later
    // pointer-initiated open.
    this._pendingFocus = null;
    if (!this._overlayRef) return;
    this._panelOpen.set(false);
    this._cancelScheduledDispose();
    const count = this.items().length;
    const settle = this._prefersReducedMotion()
      ? 0
      : this.transitionDelay() * Math.max(count - 1, 0) + CLOSE_SETTLE_MS;
    this._closeTimer = setTimeout(() => this._disposeOverlay(), settle);
  }

  /** @private Clears a pending overlay disposal. */
  private _cancelScheduledDispose(): void {
    if (this._closeTimer === null) return;
    clearTimeout(this._closeTimer);
    this._closeTimer = null;
  }

  /** @private Tears down listeners and the overlay. Safe to call repeatedly. */
  private _disposeOverlay(): void {
    this._cancelScheduledDispose();
    for (const cleanup of this._cleanups) cleanup();
    this._cleanups = [];
    this._overlayRef?.dispose();
    this._overlayRef = null;
    this._overlayAttached.set(false);
    this._panelOpen.set(false);
  }

  /** @private Whether the user agent asks for reduced motion (no stagger, no settle wait). */
  private _prefersReducedMotion(): boolean {
    return (
      this._document.defaultView?.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches ?? false
    );
  }

  // ─── Focus helpers ────────────────────────────────────────────────────────

  /** @private Enabled action buttons in DOM order, or none while detached. */
  private _enabledActions(): HTMLButtonElement[] {
    const pane = this._overlayRef?.overlayElement;
    if (!pane) return [];
    return Array.from(
      pane.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ).filter((button) => !button.disabled);
  }

  /** @private Focuses the first or last enabled action. */
  private _focusAction(which: 'first' | 'last'): void {
    const actions = this._enabledActions();
    if (actions.length === 0) return;
    actions[which === 'first' ? 0 : actions.length - 1].focus();
  }

  /** @private Moves focus by `delta` among enabled actions, wrapping at both ends. */
  private _moveFocus(delta: 1 | -1): void {
    const actions = this._enabledActions();
    if (actions.length === 0) return;
    const current = actions.indexOf(
      this._document.activeElement as HTMLButtonElement,
    );
    const next =
      current === -1
        ? delta === 1
          ? 0
          : actions.length - 1
        : (current + delta + actions.length) % actions.length;
    actions[next].focus();
  }

  /** @private Closes and returns focus to the trigger (Escape, keyboard activation). */
  private _closeAndRefocus(): void {
    this.close();
    // `focusin` fires synchronously inside `focus()`.
    this._suppressFocusOpen = true;
    try {
      this._triggerRef().nativeElement.focus();
    } finally {
      this._suppressFocusOpen = false;
    }
  }
}
