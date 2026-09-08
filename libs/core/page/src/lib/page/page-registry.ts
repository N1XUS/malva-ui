import { computed, Injectable, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { MlvPageGeometry } from './page-geometry';
import type { MlvPageSnapState } from './page-snap-state';

/** One live `main[mlvPage]`, as the router-facing providers see it. */
export interface MlvPageEntry {
  /** The `<main>` landmark element itself — the focus and skip-link target. */
  readonly element: HTMLElement;

  /** That page's geometry coordinator, including its registered scrollport. */
  readonly geometry: MlvPageGeometry;

  /** That page's snap state, so a route arrival can expand collapsed chrome. */
  readonly snap: MlvPageSnapState;
}

/**
 * Registry of the pages currently mounted in the application.
 *
 * Route focus, the skip link and scroll restoration all need to reach "the
 * page on screen" from outside it, and none of them can inject `MlvPage`: a
 * provider runs in the environment injector and a skip link lives in the
 * application shell, above every route. Each `main[mlvPage]` therefore
 * registers itself here for its lifetime.
 *
 * **The active page is the most recently registered one that is still alive.**
 * Angular destroys an outgoing route component before creating the incoming
 * one for a plain outlet, so there is usually exactly one; while a route
 * animation or a view transition holds both, the newer registration is the one
 * arriving, which is the one a route focus handler means. A page that opts out
 * of being a route target — a secondary page inside a split view — should not
 * be the one focused, so `active` is a heuristic the providers document rather
 * than a guarantee they hide.
 */
@Injectable({ providedIn: 'root' })
export class MlvPageRegistry {
  /** Every live page, in registration order. */
  readonly pages: Signal<readonly MlvPageEntry[]> = computed(() =>
    this._pages(),
  );

  /** The most recently registered live page, or `null` when there is none. */
  readonly active: Signal<MlvPageEntry | null> = computed(() => {
    const pages = this._pages();
    return pages.length > 0 ? pages[pages.length - 1] : null;
  });

  /** @private Writable source behind {@link pages}. */
  private readonly _pages = signal<readonly MlvPageEntry[]>([]);

  /**
   * @internal Registers a page for its lifetime. Called by `MlvPage`; the
   * entry is identity-keyed, so two pages sharing an element still deregister
   * exactly.
   *
   * @param entry The page to register.
   * @returns A teardown that withdraws it.
   */
  register(entry: MlvPageEntry): () => void {
    this._pages.update((pages) => [...pages, entry]);
    return () =>
      this._pages.update((pages) => pages.filter((p) => p !== entry));
  }
}
