import { InjectionToken } from '@angular/core';
import type { Signal } from '@angular/core';

import type { MlvTileTreeNode } from './tile-tree.types';

/** @internal Typed bridge from an enclosing tile item to nested tiles. */
export interface MlvTileItemContext<TProps> {
  readonly tile: Signal<MlvTileTreeNode<TProps>>;
}

/** @internal Task 4 makes `MlvTile` provide this item context. */
export const MLV_TILE_ITEM_CONTEXT = new InjectionToken<
  MlvTileItemContext<unknown>
>('MLV_TILE_ITEM_CONTEXT');
