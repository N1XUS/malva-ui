import { Injectable, signal } from '@angular/core';
import type { MlvDataTableColumn, MlvPinSide } from '../../types';

/** @private Per-column pin override stored in the service. */
interface PinOverride {
  pinned: boolean;
  pinSide: MlvPinSide;
}

/** @private Normalized replacement entry for component-scoped pin overrides. */
interface PinOverrideEntry extends PinOverride {
  key: string;
}

/**
 * Component-scoped pin-state service for `mlv-data-table`. Holds the
 * user-driven pin/unpin overrides keyed by column key. The component
 * delegates `togglePin`/`pinTo`/`unpin` and the read-side queries to
 * this service while continuing to compute layout offsets internally.
 */
@Injectable()
export class MlvDataTablePinningService {
  /** @private Map of column key → user-applied pin override. */
  private readonly _overrides = signal<Map<string, PinOverride>>(new Map());

  /** Read-only signal exposing the override map for `effect()` consumers. */
  readonly overrides = this._overrides.asReadonly();

  /**
   * Returns the list of sides the user may pin a column to, based on
   * `col.pinnable`.
   */
  getPinnableSides(col: MlvDataTableColumn): MlvPinSide[] {
    const p = col.pinnable;
    if (!p) return [];
    if (p === true) return ['left', 'right'];
    if (typeof p === 'string') return [p];
    return p.slice();
  }

  /** Pin a column to the given side, or unpin if it is already pinned. */
  togglePin(col: MlvDataTableColumn, side: MlvPinSide = 'left'): void {
    const map = new Map(this._overrides());
    const current = map.get(col.key);
    const effectivePinned = current ? current.pinned : !!col.pinned;
    map.set(col.key, { pinned: !effectivePinned, pinSide: side });
    this._overrides.set(map);
  }

  /** Pin a column to a specific side. */
  pinTo(col: MlvDataTableColumn, side: MlvPinSide): void {
    const map = new Map(this._overrides());
    map.set(col.key, { pinned: true, pinSide: side });
    this._overrides.set(map);
  }

  /** Explicitly unpin a column. */
  unpin(col: MlvDataTableColumn): void {
    const map = new Map(this._overrides());
    map.set(col.key, { pinned: false, pinSide: col.pinSide ?? 'left' });
    this._overrides.set(map);
  }

  /** Replaces component-scoped overrides with cloned, normalized entries. */
  replaceOverrides(entries: readonly PinOverrideEntry[]): void {
    this._overrides.set(
      new Map(
        entries.map(({ key, pinned, pinSide }) => [key, { pinned, pinSide }]),
      ),
    );
  }

  /** Whether a column is currently pinned (accounting for overrides). */
  isPinned(col: MlvDataTableColumn): boolean {
    const override = this._overrides().get(col.key);
    return override ? override.pinned : !!col.pinned;
  }

  /** Pin side for a column (considering overrides) or null. */
  getPinSide(col: MlvDataTableColumn): MlvPinSide | null {
    const override = this._overrides().get(col.key);
    const pinned = override ? override.pinned : !!col.pinned;
    if (!pinned) return null;
    return override ? override.pinSide : (col.pinSide ?? 'left');
  }
}
