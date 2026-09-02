/** How the actions are laid out around the trigger. */
export type MlvSpeedDialType =
  | 'linear'
  | 'circle'
  | 'semi-circle'
  | 'quarter-circle';

/**
 * Where the actions unfold. The four cardinal values drive `linear` and
 * `semi-circle` layouts; the four corner values drive `quarter-circle`.
 * A cardinal value on a quarter-circle resolves to the matching corner
 * (`up` → `up-right`, `down` → `down-right`, `left` → `up-left`,
 * `right` → `up-right`); a corner value on a linear/semi-circle layout
 * resolves to its vertical half (`up-left` → `up`, `down-right` → `down`).
 */
export type MlvSpeedDialDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right';

/**
 * What opens the dial. `'click'` toggles on the trigger's click (and keyboard
 * activation). `'hover'` additionally opens when a mouse or pen pointer enters
 * the trigger and closes shortly after it has left both the trigger and the
 * actions; touch pointers keep the click behaviour.
 */
export type MlvSpeedDialOpenOn = 'click' | 'hover';

/** One action rendered by `mlv-speed-dial`. */
export interface MlvSpeedDialItem {
  /** Stable identity used for `@for` tracking; falls back to the array index. */
  readonly id?: string | number;
  /** Lucide icon name (e.g. `'pencil'`). Ignored when a `[mlvSpeedDialItemDef]` template is projected. */
  readonly icon?: string;
  /** Accessible name of the action; also the tooltip text. */
  readonly label: string;
  /** Renders the action but keeps it non-interactive and out of keyboard navigation. */
  readonly disabled?: boolean;
  /** Invoked when the action is activated, before `itemSelect` emits. */
  readonly command?: (event: MlvSpeedDialItemEvent) => void;
}

/** Payload of `MlvSpeedDial.itemSelect` and of an item's `command` callback. */
export interface MlvSpeedDialItemEvent {
  /** The activated action. */
  readonly item: MlvSpeedDialItem;
  /** Zero-based index of the action within `items`. */
  readonly index: number;
  /** The DOM event that activated the action (a `click`, also for Enter/Space). */
  readonly originalEvent: Event;
}

/** Template context of a projected `[mlvSpeedDialItemDef]`. */
export interface MlvSpeedDialItemDefContext {
  /** The action being rendered. */
  $implicit: MlvSpeedDialItem;
  /** Zero-based index of the action within `items`. */
  index: number;
}
