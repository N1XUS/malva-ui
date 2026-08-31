import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvTileI18n {
  /** aria-label for the close button. */
  close: string;
  /** Generic accessible label used when the consumer does not name a tile. */
  tileLabel: string;
  /** aria-label for a registered tile drag handle. ICU: "Move {label}". */
  moveTile: string;
  /** Keyboard instructions associated with every registered tile handle. */
  keyboardInstructions: string;
  /** Polite successful upward-move announcement. ICU: "Moved {label} up.". */
  movedUp: string;
  /** Polite successful downward-move announcement. ICU: "Moved {label} down.". */
  movedDown: string;
  /** Polite successful outdent announcement. ICU parameter: `{label}`. */
  movedOut: string;
  /** Polite successful indent announcement. ICU parameter: `{label}`. */
  movedInto: string;
  /** Polite rejected-move announcement. ICU parameter: `{label}`. */
  moveRejected: string;
  /** Prompt rendered inside a drop target that currently holds no tiles. */
  emptyTarget: string;
  /** Short marker shown on a drop target that rejects the dragged tile. */
  restrictedTarget: string;
}

export const MLV_TILE_I18N = new InjectionToken<Signal<MlvTileI18n>>(
  'MLV_TILE_I18N',
);

export const MLV_TILE_I18N_CONTEXT: Record<
  keyof MlvTileI18n,
  MlvTranslationContext
> = {
  close: {
    component: 'mlv-tile',
    usage: 'aria-label',
    description: 'Close/dismiss the tile',
  },
  tileLabel: {
    component: 'mlv-tile',
    usage: 'aria-label',
    description: 'Generic accessible tile name when no ariaLabel is provided',
  },
  moveTile: {
    component: 'mlv-tile',
    usage: 'aria-label',
    icuParams: ['label'],
    description: 'Keyboard and pointer drag handle label for a named tile',
  },
  keyboardInstructions: {
    component: 'mlv-tiles',
    usage: 'message',
    description: 'Alt+Arrow keyboard commands for moving compound tiles',
  },
  movedUp: {
    component: 'mlv-tiles',
    usage: 'live-announcement',
    icuParams: ['label'],
    description: 'Announcement after moving a tile earlier among siblings',
  },
  movedDown: {
    component: 'mlv-tiles',
    usage: 'live-announcement',
    icuParams: ['label'],
    description: 'Announcement after moving a tile later among siblings',
  },
  movedOut: {
    component: 'mlv-tiles',
    usage: 'live-announcement',
    icuParams: ['label'],
    description: 'Announcement after moving a tile out one nesting level',
  },
  movedInto: {
    component: 'mlv-tiles',
    usage: 'live-announcement',
    icuParams: ['label'],
    description:
      'Announcement after moving a tile into the nearest eligible container',
  },
  moveRejected: {
    component: 'mlv-tiles',
    usage: 'live-announcement',
    icuParams: ['label'],
    description: 'Announcement when a requested keyboard move is rejected',
  },
  emptyTarget: {
    component: 'mlv-tiles',
    usage: 'message',
    description: 'Prompt shown inside a container that currently has no tiles',
  },
  restrictedTarget: {
    component: 'mlv-tiles',
    usage: 'message',
    description: 'Marker shown on a drop target that rejects the dragged tile',
  },
};
