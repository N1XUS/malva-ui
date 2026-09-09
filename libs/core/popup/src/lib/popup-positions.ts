import type { Provider } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { ConnectedPosition } from '@angular/cdk/overlay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The set of named popup positions supported out of the box.
 *
 * Positions follow the `{side}-{alignment}` convention:
 * - **side** — the side of the trigger the popup appears on (`top`, `bottom`,
 *   `left`, `right`)
 * - **alignment** — which pair of the popup's and the trigger's edges is
 *   aligned; _(omitted)_ = centred
 *
 * All positions include an 8px gap between the trigger and the popup.
 *
 * ### `left` / `right` are **logical aliases**, and so is `-start` / `-end` on
 * the inline axis
 *
 * Every entry in {@link POPUP_POSITION_MAP} is written with CDK's logical
 * `'start'` / `'end'`, which `FlexibleConnectedPositionStrategy` mirrors
 * against the pane's own direction — so these names mirror in RTL:
 *
 * | Name          | Maps to                            | LTR                       | RTL                        |
 * | ------------- | ---------------------------------- | ------------------------- | -------------------------- |
 * | `left-*`      | `originX: 'start'`, `offsetX: -8`  | trigger's **left** side   | trigger's **right** side   |
 * | `right-*`     | `originX: 'end'`, `offsetX: 8`     | trigger's **right** side  | trigger's **left** side    |
 * | `top-start`   | `overlayX: 'start'`                | **left** edges aligned    | **right** edges aligned    |
 * | `bottom-end`  | `overlayX: 'end'`                  | **right** edges aligned   | **left** edges aligned     |
 *
 * `top` / `bottom` are the block axis and never mirror; neither does the
 * alignment of a `left-*` / `right-*` position, which rides `originY`
 * (`-start` = top, `-end` = bottom, in both directions).
 *
 * The `offsetX` column is logical **on the same terms**, but CDK is not what
 * makes it so: `FlexibleConnectedPositionStrategy` returns `offsetX` verbatim
 * from `_getOffset()` and applies it as raw physical pixels, with no `_isRtl()`
 * on that path. `MlvPopupService` mirrors it through `mlvMirrorInlineOffsets`
 * against the direction it creates the pane with (#180), so the `-8` on
 * `left-*` reads as "8px away from the trigger, toward inline-start" and
 * survives mirroring along with the alignment it belongs to. The map stores the
 * LTR sign, which is what a consumer overriding an entry through
 * {@link providePopupPositions} writes — and what a consumer feeding these
 * entries to a `FlexibleConnectedPositionStrategy` of their own has to mirror
 * for themselves.
 *
 * Do not confuse this with `MlvPopupArrowAlign`, whose `'start'` /
 * `'end'` are **physical** ends of a physical edge: the conversion from this
 * logical vocabulary to that physical one happens once, in
 * `MlvPopup.updateArrowFromPosition()`. A `bottom-start` popup therefore
 * resolves to `arrowAlign: 'end'` in RTL — both meaning "the corner nearest
 * the trigger". See `.claude/rules/rtl.md` § Public API.
 */
export type MlvPopupPositionName =
  | 'top-start'
  | 'top'
  | 'top-end'
  | 'bottom-start'
  | 'bottom'
  | 'bottom-end'
  | 'left-start'
  | 'left'
  | 'left-end'
  | 'right-start'
  | 'right'
  | 'right-end';

// ---------------------------------------------------------------------------
// Default position map
// ---------------------------------------------------------------------------

/**
 * The default named-position map used when no custom `POPUP_POSITIONS` provider
 * is registered. Contains all twelve standard popup placements.
 *
 * Override globally with `providePopupPositions()`, or per-component via
 * the `POPUP_POSITIONS` injection token.
 */
export const POPUP_POSITION_MAP: ReadonlyMap<
  MlvPopupPositionName,
  ConnectedPosition
> = new Map<MlvPopupPositionName, ConnectedPosition>([
  // ── Top ──────────────────────────────────────────────────────────────────
  [
    'top-start',
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: -8,
    },
  ],
  [
    'top',
    {
      originX: 'center',
      originY: 'top',
      overlayX: 'center',
      overlayY: 'bottom',
      offsetY: -8,
    },
  ],
  [
    'top-end',
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'end',
      overlayY: 'bottom',
      offsetY: -8,
    },
  ],
  // ── Bottom ───────────────────────────────────────────────────────────────
  [
    'bottom-start',
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 8,
    },
  ],
  [
    'bottom',
    {
      originX: 'center',
      originY: 'bottom',
      overlayX: 'center',
      overlayY: 'top',
      offsetY: 8,
    },
  ],
  [
    'bottom-end',
    {
      originX: 'end',
      originY: 'bottom',
      overlayX: 'end',
      overlayY: 'top',
      offsetY: 8,
    },
  ],
  // ── Left ─────────────────────────────────────────────────────────────────
  [
    'left-start',
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'end',
      overlayY: 'top',
      offsetX: -8,
    },
  ],
  [
    'left',
    {
      originX: 'start',
      originY: 'center',
      overlayX: 'end',
      overlayY: 'center',
      offsetX: -8,
    },
  ],
  [
    'left-end',
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'end',
      overlayY: 'bottom',
      offsetX: -8,
    },
  ],
  // ── Right ────────────────────────────────────────────────────────────────
  [
    'right-start',
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'top',
      offsetX: 8,
    },
  ],
  [
    'right',
    {
      originX: 'end',
      originY: 'center',
      overlayX: 'start',
      overlayY: 'center',
      offsetX: 8,
    },
  ],
  [
    'right-end',
    {
      originX: 'end',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetX: 8,
    },
  ],
]);

// ---------------------------------------------------------------------------
// Injection token
// ---------------------------------------------------------------------------

/**
 * Injection token that holds the active named-position map.
 *
 * Defaults to {@link POPUP_POSITION_MAP}. Override at the application or
 * component level with {@link providePopupPositions} to add, remove, or
 * replace named positions.
 *
 * @example Override globally in app providers
 * ```ts
 * providePopupPositions(new Map([
 *   ['bottom', { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 4 }],
 * ]))
 * ```
 */
export const POPUP_POSITIONS = new InjectionToken<
  ReadonlyMap<MlvPopupPositionName, ConnectedPosition>
>('POPUP_POSITIONS', {
  providedIn: 'root',
  factory: () => POPUP_POSITION_MAP,
});

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Registers a custom named-position map as the active `POPUP_POSITIONS`.
 *
 * Call in the root `providers` array (or a component's `providers`) to
 * replace all default positions with a custom set.
 *
 * @param positions — A `Map` of {@link MlvPopupPositionName} → CDK `ConnectedPosition`.
 *
 * @example
 * ```ts
 * // app.config.ts
 * providers: [
 *   providePopupPositions(new Map([
 *     ...POPUP_POSITION_MAP,
 *     ['bottom', { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 4 }],
 *   ]))
 * ]
 * ```
 */
export function providePopupPositions(
  positions: ReadonlyMap<MlvPopupPositionName, ConnectedPosition>,
): Provider {
  return { provide: POPUP_POSITIONS, useValue: positions };
}

// ---------------------------------------------------------------------------
// Static helper — MlvPopupPositionResolver
// ---------------------------------------------------------------------------

/**
 * Static utility class for resolving named popup positions.
 *
 * Centralises all lookup logic so that {@link MlvPopup} and
 * {@link MlvPopupService} share one consistent resolution path.
 */
export class MlvPopupPositionResolver {
  /**
   * Resolves one or more {@link MlvPopupPositionName} strings to CDK
   * `ConnectedPosition` objects using the provided map.
   *
   * - Positions are returned in the same order as `names`.
   * - If a name is not found in the map, it is skipped and a warning is
   *   emitted in dev mode via `console.warn`.
   * - Returns an empty array if no names resolve successfully.
   *
   * @param names      — A single name or ordered array of names (CDK uses
   *                     the first one that fits in the viewport).
   * @param positionMap — The active position map (from `POPUP_POSITIONS` token).
   */
  static resolve(
    names: MlvPopupPositionName | MlvPopupPositionName[],
    positionMap: ReadonlyMap<MlvPopupPositionName, ConnectedPosition>,
  ): ConnectedPosition[] {
    const nameList = Array.isArray(names) ? names : [names];
    const resolved: ConnectedPosition[] = [];

    for (const name of nameList) {
      const pos = positionMap.get(name);
      if (pos !== undefined) {
        resolved.push(pos);
      } else if (typeof ngDevMode !== 'undefined' && ngDevMode) {
        console.warn(
          `[MlvPopup] Position "${name}" was not found in the POPUP_POSITIONS map. ` +
            `Available positions: [${Array.from(positionMap.keys()).join(', ')}].`,
        );
      }
    }

    return resolved;
  }

  /**
   * Returns all positions in the map as an ordered array.
   * Used as the CDK fallback sequence when no explicit `position` is set.
   *
   * @param positionMap — The active position map (from `POPUP_POSITIONS` token).
   */
  static allPositions(
    positionMap: ReadonlyMap<MlvPopupPositionName, ConnectedPosition>,
  ): ConnectedPosition[] {
    return Array.from(positionMap.values());
  }
}

// ---------------------------------------------------------------------------
// Shared named-position sequences
// ---------------------------------------------------------------------------

/**
 * Ordered CDK positions for a dropdown menu panel that opens below its trigger:
 * `bottom-start` preferred, flipping vertically (`top-start`) then aligning to
 * the trigger's end edge (`bottom-end`, `top-end`) when space is constrained.
 *
 * Derived from {@link POPUP_POSITION_MAP} so menu overlays stay consistent with
 * the rest of the Malva UI overlay system. Consumed by `MlvMenuTrigger`.
 */
export const MENU_POSITIONS: ConnectedPosition[] =
  MlvPopupPositionResolver.resolve(
    ['bottom-start', 'top-start', 'bottom-end', 'top-end'],
    POPUP_POSITION_MAP,
  );

/**
 * Ordered CDK positions for a submenu panel that opens to the right of its
 * parent item (`right-start`), flipping to the left (`left-start`) when there
 * is no room on the right.
 *
 * Derived from {@link POPUP_POSITION_MAP}. Consumed by `MlvMenuTrigger`.
 */
export const SUBMENU_POSITIONS: ConnectedPosition[] =
  MlvPopupPositionResolver.resolve(
    ['right-start', 'left-start'],
    POPUP_POSITION_MAP,
  );
