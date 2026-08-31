import { InjectionToken } from '@angular/core';
import type { Signal } from '@angular/core';

/**
 * @internal Cascading structural lock published by `MlvTiles` and `MlvTile`.
 *
 * Every compound level provides its own resolved signal, so a descendant reads
 * the closest enclosing state with `skipSelf` and combines it with its own
 * `locked` input. Deliberately absent from the public barrel, mirroring
 * `MLV_TILE_ITEM_CONTEXT`.
 */
export const MLV_TILE_LOCKED = new InjectionToken<Signal<boolean>>(
  'MLV_TILE_LOCKED',
);
