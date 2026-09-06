import type { ConnectedPosition } from '@angular/cdk/overlay';

/**
 * Ordered CDK positions for an option panel anchored to its field. Shared by
 * `mlv-select`, `mlv-combobox` and `[mlvAutocomplete]`, which all render
 * `mlv-dropdown-panel` into a flexible connected overlay.
 *
 * The preferred pair opens below the field and flips above it, both anchored to
 * the field's inline-**start** edge so the panel grows toward inline-end. The
 * trailing pair anchors the panel's inline-**end** edge to the field instead so
 * it grows back toward inline-start; CDK falls through to it when the room
 * after the field cannot hold the panel — a narrow field near the viewport's
 * inline-end edge (#154). Without that pair the panel is free to grow (#150)
 * but has nowhere to grow into: `withFlexibleDimensions` sizes the bounding box
 * to the space between the anchored edge and the viewport edge, and every
 * position was anchored to the same edge.
 *
 * Order matters, but only on the first of the two paths through
 * `FlexibleConnectedPositionStrategy.apply()`. A candidate whose box lies
 * wholly inside the viewport is applied on the spot and the loop returns, so
 * **a panel that fits never flips**: a field with room keeps the start-aligned
 * placement it has always had, and only a field without room reaches the
 * fallbacks. When nothing fits outright, order is merely the tie-break — CDK
 * scores every candidate `_canFitWithFlexibleDimensions` accepts (a `minWidth`
 * has been on the config since #150, so usually all of them) by bounding-box
 * area and keeps the largest, `score > bestScore` giving the earlier entry the
 * tie. Ties there are the exception rather than the rule: the `start` box spans
 * from the field's inline-start edge to the viewport's inline-end edge and the
 * `end` box from the viewport's inline-start edge to the field's inline-end
 * edge, equal only for a field centred on the viewport — past that midline the
 * `end` entry wins on area outright, which is exactly the #154 case.
 *
 * Positions are logical. The overlay pane is portaled to `<body>` and carries a
 * `direction` resolved from its trigger, so CDK mirrors `start`/`end` against
 * that. There is deliberately **no `offsetX`**: CDK adds `offsetX` as raw
 * physical pixels and does not flip it in RTL, so an `end`-aligned entry would
 * need the opposite sign from its `start`-aligned twin. The gap between field
 * and panel is purely on the block axis, where `offsetY` means the same thing
 * in both directions.
 *
 * The same four placements back menu panels as `MENU_POSITIONS` in
 * `@malva-ui/core/popup`, resolved there out of the named popup map. They are
 * spelled out here so `@malva-ui/core/dropdown` — and with it
 * `[mlvAutocomplete]`, which builds its overlay directly — needs no dependency
 * on the popup package.
 */
export const DROPDOWN_POSITIONS: ConnectedPosition[] = [
  // Below the field, growing toward inline-end — the preferred placement.
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: 8,
  },
  // Above the field, growing toward inline-end — the block-axis flip.
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetY: -8,
  },
  // Below the field, growing toward inline-start — the inline-axis fallback.
  {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'top',
    offsetY: 8,
  },
  // Above the field, growing toward inline-start — both axes flipped.
  {
    originX: 'end',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'bottom',
    offsetY: -8,
  },
];
