import { Injectable, signal } from '@angular/core';
import type { TocEntry } from './toc.types';

/**
 * Bridges "On this page" ToC data from the currently-mounted doc panel (inside
 * the router outlet) to the App shell's ToC sidebar (outside the outlet).
 *
 * Under the tabbed doc-page structure only the **active** panel is mounted, so a
 * panel publishes its own headings when it renders and republishes on tab
 * switch. Publishing is **replace**, not append — each panel owns the whole ToC
 * while it is active.
 *
 * An `owner` token guards against tab-switch races: when the outgoing panel is
 * torn down it calls `clear(owner)`, which is a no-op if a newer panel has
 * already published (its token is now the owner). A no-argument `clear()` forces
 * a reset regardless of owner (used when the whole page navigates away).
 */
@Injectable({ providedIn: 'root' })
export class DocsTocService {
  /** The active panel's ToC entries, rendered by the shell's `docs-toc`. */
  readonly entries = signal<TocEntry[]>([]);

  /**
   * @private The token of the panel that last published. Only this owner may
   * `clear()` the entries with a matching token, so a stale teardown cannot wipe
   * a freshly-published panel.
   */
  private _owner: unknown = null;

  /**
   * Replaces the ToC with the given panel's headings and records `owner` as the
   * current publisher. Called by the active panel (examples source directive /
   * API viewer) once its headings exist in the DOM.
   */
  publish(owner: unknown, entries: TocEntry[]): void {
    this._owner = owner;
    this.entries.set(entries);
  }

  /**
   * Clears the ToC. With an `owner` argument it only clears when that owner is
   * still the current publisher (safe teardown on tab switch); with no argument
   * it force-clears (page navigating away entirely).
   */
  clear(owner?: unknown): void {
    if (arguments.length > 0 && owner !== this._owner) return;
    this._owner = null;
    this.entries.set([]);
  }
}
