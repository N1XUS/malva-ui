import {
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import type { Signal } from '@angular/core';
import { isObservable } from 'rxjs';
import type { Observable, Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import { toOptionsResult } from './options-result';

/**
 * A function producing option items for a query. May return a synchronous
 * array, a `Promise`, or an `Observable`. Async results drive the loading
 * affordance; a newer query supersedes an in-flight one.
 */
export type MlvOptionsSearchFn<T> = (
  query: string,
) => T[] | Promise<T[]> | Observable<T[]>;

/** Everything an option control accepts as its `options` input. */
export type MlvOptionsInput<T> =
  | readonly T[]
  | Observable<readonly T[]>
  | MlvDataSource<T>
  | null
  | undefined;

/**
 * `'local'` — the consumer filters `items` itself (arrays / observables).
 * `'remote'` — the source owns filtering; the consumer calls `search()` and
 * renders `items` as-is (`MlvDataSource` / `searchFn`).
 */
export type MlvOptionsMode = 'local' | 'remote';

/**
 * Everything `MlvOptionsAdapter` reads from its owner. Every field is a
 * `Signal`, so an option control passes its own `input()`s straight through and
 * the adapter reacts to each of them — a swapped `source` reconnects, a swapped
 * `searchFn` re-arms the lazy gate, and `debounce` / `eager` are read at the
 * moment they matter rather than captured at construction.
 */
export interface MlvOptionsAdapterConfig<T> {
  /** The control's `options` input. */
  source: Signal<MlvOptionsInput<T>>;
  /** Optional remote search function; when set it supersedes `source`. */
  searchFn: Signal<MlvOptionsSearchFn<T> | null | undefined>;
  /** Debounce (ms) applied to remote searches only. */
  debounce: Signal<number>;
  /** When `true`, a `searchFn` runs `searchFn('')` on construction instead of lazily. */
  eager: Signal<boolean>;
}

/** @private Which of the four supported source shapes the current inputs select. */
type SourceKind = 'array' | 'observable' | 'ds' | 'fn';

/** @private A connected `MlvDataSource` paired with the signal returned by its `connect()`. */
interface ConnectedSource<T> {
  readonly ds: MlvDataSource<T>;
  readonly items: Signal<T[]>;
}

/**
 * Normalises `T[] | Observable<T[]> | MlvDataSource<T>` (+ optional
 * `searchFn`) into one reactive shape shared by `mlv-select`, `mlv-combobox`
 * and `[mlvAutocomplete]`. Construct it inside an injection context (a
 * component field initialiser or constructor) — it uses `effect()` and
 * `DestroyRef`.
 *
 * Paging (`MlvDataSource` only): `connect()` emits the current page's slice and
 * the adapter accumulates, tracking the **applied page** — the page whose slice
 * is currently in `items` — alongside the items accumulated before it:
 *
 * - `page <= 1` → the slice replaces `items` and accumulation restarts.
 * - `page === appliedPage` → the source re-emitted the page already shown (a
 *   backing array changed, a refetch landed): its **tail is replaced**, never
 *   appended, so rows are not duplicated.
 * - `page > appliedPage` → the slice is appended.
 * - A run where the slice reference has not changed (a `page` bump whose data
 *   has not arrived yet) applies nothing.
 *
 * `loadMore()` is therefore a no-op while a page is pending — a scroll sentinel
 * firing repeatedly cannot skip a page.
 *
 * Swapping the `searchFn` **only re-arms the lazy gate** (the next
 * `ensureLoaded()` calls the new function): the in-flight call is left running
 * and `items` / `ready` / `loading` are untouched, so results stay on screen
 * until the new function answers and a control bound to an inline arrow — a
 * fresh reference on every change detection run — is not reset on every pass.
 */
export class MlvOptionsAdapter<T> {
  /** @private Lifetime for the in-flight `searchFn` subscription / debounce timer. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Which branch the current inputs select. `searchFn` wins over the source. */
  private readonly _kind = computed<SourceKind>(() => {
    if (this._config.searchFn()) return 'fn';
    const source = this._config.source();
    if (source instanceof MlvDataSource) return 'ds';
    if (isObservable(source)) return 'observable';
    return 'array';
  });

  // ─── observable branch ────────────────────────────────────────────────────
  /** @private Latest emission of the observable source. */
  private readonly _obsItems = signal<readonly T[]>([]);
  /** @private Whether the observable source has emitted at least once. */
  private readonly _obsReady = signal(false);

  // ─── data-source branch ───────────────────────────────────────────────────
  /** @private The connected source and its (memoised) `connect()` signal. */
  private readonly _connected = signal<ConnectedSource<T> | null>(null);
  /** @private Accumulated pages. */
  private readonly _dsItems = signal<readonly T[]>([]);
  /** @private Whether the source has been observed not-loading at least once since connect. */
  private readonly _dsReady = signal(false);
  /** @private Last slice reference applied — a `page` bump whose slice has not arrived yet must not append. */
  private _dsLastSlice: readonly T[] | null = null;
  /** @private The page whose slice is currently applied (`0` = none yet). Distinguishes an append from a re-emit of the page already shown. */
  private _dsAppliedPage = 0;
  /** @private Items accumulated *before* the applied page — the prefix a re-emit of that page is re-appended to. */
  private _dsBase: readonly T[] = [];

  // ─── searchFn branch ──────────────────────────────────────────────────────
  /** @private Last `searchFn` result. */
  private readonly _fnItems = signal<readonly T[]>([]);
  /** @private Whether a `searchFn` call is in flight. */
  private readonly _fnLoading = signal(false);
  /** @private Whether `searchFn` has produced (or failed) at least once. */
  private readonly _fnReady = signal(false);
  /** @private Whether `searchFn` has been invoked at least once (lazy-load gate). */
  private _fnStarted = false;
  /**
   * @private The `searchFn` reference the swap effect last observed, normalised
   * to `null` when unset. Stays `undefined` until that effect's first run, which
   * is how `undefined → fn` at construction is told apart from a genuine swap.
   */
  private _fnSeen: MlvOptionsSearchFn<T> | null | undefined;
  /** @private In-flight `searchFn` subscription (superseded by a newer query). */
  private _fnSub: Subscription | null = null;
  /** @private Monotonic token discarding stale `searchFn` results. */
  private _fnToken = 0;
  /** @private Pending debounce timer for remote searches. */
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** @private Last query handed to `search()`; replayed by `ensureLoaded()`. */
  private _lastQuery = '';

  /** `'local'` for arrays / observables (consumer filters); `'remote'` for a data source or `searchFn`. */
  readonly mode = computed<MlvOptionsMode>(() => {
    const kind = this._kind();
    return kind === 'array' || kind === 'observable' ? 'local' : 'remote';
  });

  /** The current raw items (accumulated pages for a data source). */
  readonly items = computed<readonly T[]>(() => {
    switch (this._kind()) {
      case 'fn':
        return this._fnItems();
      case 'ds':
        return this._dsItems();
      case 'observable':
        return this._obsItems();
      default:
        return (this._config.source() as readonly T[] | null | undefined) ?? [];
    }
  });

  /** Source-owned "first page / search in flight" flag (drives the top spinner row). */
  readonly loading = computed<boolean>(() => {
    switch (this._kind()) {
      case 'fn':
        return this._fnLoading();
      case 'ds': {
        const connected = this._connected();
        return (
          !!connected && connected.ds.loading() && connected.ds.page() === 1
        );
      }
      case 'observable':
        return !this._obsReady();
      default:
        return false;
    }
  });

  /** A page beyond the first is in flight (drives the bottom spinner row). Data source only. */
  readonly loadingMore = computed<boolean>(() => {
    if (this._kind() !== 'ds') return false;
    const connected = this._connected();
    return !!connected && connected.ds.loading() && connected.ds.page() > 1;
  });

  /** The first payload has arrived — arrays immediately, observables on first emit, data sources once observed not-loading, `searchFn` after its first result. */
  readonly ready = computed<boolean>(() => {
    switch (this._kind()) {
      case 'fn':
        return this._fnReady();
      case 'ds':
        return this._dsReady();
      case 'observable':
        return this._obsReady();
      default:
        return true;
    }
  });

  /** More pages exist (`items.length < totalItems`). Data source only. */
  readonly hasMore = computed<boolean>(() => {
    if (this._kind() !== 'ds') return false;
    const connected = this._connected();
    return !!connected && this._dsItems().length < connected.ds.totalItems();
  });

  constructor(private readonly _config: MlvOptionsAdapterConfig<T>) {
    // Observable source: (re)subscribe whenever the reference changes.
    effect((onCleanup) => {
      const source = this._config.source();
      if (!isObservable(source)) return;
      untracked(() => {
        this._obsReady.set(false);
        this._obsItems.set([]);
      });
      const sub = source.subscribe((items) => {
        this._obsItems.set(items);
        this._obsReady.set(true);
      });
      onCleanup(() => sub.unsubscribe());
    });

    // Data source: connect once per source — but only while the data source is
    // the branch in use. A `searchFn` supersedes it, and connecting anyway would
    // fire a fetch whose slice is never read.
    effect(() => {
      const kind = this._kind();
      const source = this._config.source();
      untracked(() => {
        if (kind === 'ds' && source instanceof MlvDataSource) {
          this._resetDataSource();
          this._connected.set({ ds: source, items: source.connect() });
        } else if (this._connected()) {
          this._resetDataSource();
          this._connected.set(null);
        }
      });
    });

    // Data source: accumulate slices against the applied page.
    effect(() => {
      const connected = this._connected();
      if (!connected) return;
      const slice = connected.items();
      const page = connected.ds.page();
      const loading = connected.ds.loading();
      untracked(() => {
        // A page bump whose slice has not arrived yet applies nothing.
        if (slice === this._dsLastSlice) {
          if (!loading) this._dsReady.set(true);
          return;
        }
        if (page <= 1) {
          this._dsBase = [];
          this._dsItems.set([...slice]);
        } else if (page === this._dsAppliedPage) {
          // Same page re-emitted — replace its tail rather than duplicating it.
          this._dsItems.set([...this._dsBase, ...slice]);
        } else {
          this._dsBase = this._dsItems();
          this._dsItems.set([...this._dsBase, ...slice]);
        }
        this._dsAppliedPage = page;
        this._dsLastSlice = slice;
        if (!loading) this._dsReady.set(true);
      });
    });

    // searchFn: a swapped function re-arms the lazy gate so the next
    // `ensureLoaded()` calls it — and nothing else. Tearing down the in-flight
    // call or clearing `items` would make the control sensitive to the
    // *reference* identity of the bound function, and an inline arrow
    // (`[search]="(q) => api.find(q)"`) is a fresh reference on every change
    // detection run. Stale items therefore stay until the new function answers,
    // matching the "results kept while loading" contract; once the new function
    // starts, a late result from the old one is discarded by the monotonic
    // token. The effect's first run is `undefined → fn` at construction, which
    // is not a swap.
    effect(() => {
      const fn = this._config.searchFn() ?? null;
      untracked(() => {
        const previous = this._fnSeen;
        this._fnSeen = fn;
        if (previous === undefined || previous === fn) return;
        this._fnStarted = false;
        if (this._kind() === 'fn' && this._config.eager()) this.ensureLoaded();
      });
    });

    // searchFn: eager first load.
    effect(() => {
      if (this._kind() === 'fn' && this._config.eager()) {
        untracked(() => this.ensureLoaded());
      }
    });

    this._destroyRef.onDestroy(() => {
      this._fnSub?.unsubscribe();
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
    });
  }

  /**
   * Remote-mode search entry point (debounced). Data source → `setSearch({ query, keys: [] })`
   * (or `null` for a blank query); `searchFn` → invoked with the query. No-op in local mode.
   */
  search(query: string): void {
    this._lastQuery = query;
    const kind = this._kind();
    if (kind === 'ds') this._debounced(() => this._searchDataSource(query));
    else if (kind === 'fn') this._debounced(() => this._runSearchFn(query));
  }

  /** Runs the initial `searchFn` load if it has not run yet (data sources connect eagerly; local modes need nothing). */
  ensureLoaded(): void {
    if (this._kind() === 'fn' && !this._fnStarted)
      this._runSearchFn(this._lastQuery);
  }

  /**
   * Requests the next data-source page. No-op unless `hasMore()`, nothing is in
   * flight, and the source's current page is the one already applied — a page
   * requested but not yet accumulated (or a search that reset the source to page
   * one) blocks the next bump, so a scroll sentinel cannot skip a page.
   */
  loadMore(): void {
    const connected = this._connected();
    if (
      !connected ||
      !this.hasMore() ||
      connected.ds.loading() ||
      connected.ds.page() !== this._dsAppliedPage
    )
      return;
    connected.ds.setPage(connected.ds.page() + 1);
  }

  /** @private Clears every accumulation bookkeeping field — on connect, and when a source is disconnected. */
  private _resetDataSource(): void {
    this._dsLastSlice = null;
    this._dsAppliedPage = 0;
    this._dsBase = [];
    this._dsItems.set([]);
    this._dsReady.set(false);
  }

  /** @private Schedules `run` after `debounce` ms (immediately when 0), cancelling a pending one. */
  private _debounced(run: () => void): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    const ms = Math.max(0, this._config.debounce());
    if (ms === 0) {
      run();
      return;
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      run();
    }, ms);
  }

  /** @private Forwards a query to the connected data source using the option-control contract (`keys: []`). */
  private _searchDataSource(query: string): void {
    const connected = this._connected();
    if (!connected) return;
    connected.ds.setSearch(query.trim() ? { query, keys: [] } : null);
  }

  /** @private Invokes `searchFn`, superseding any in-flight call; keeps stale items until the result. */
  private _runSearchFn(query: string): void {
    const fn = this._config.searchFn();
    if (!fn) return;
    this._fnStarted = true;
    const token = ++this._fnToken;
    this._fnSub?.unsubscribe();
    this._fnLoading.set(true);
    this._fnSub = toOptionsResult(fn(query))
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          if (token !== this._fnToken) return;
          this._fnItems.set(items);
          this._fnLoading.set(false);
          this._fnReady.set(true);
        },
        error: () => {
          if (token !== this._fnToken) return;
          this._fnItems.set([]);
          this._fnLoading.set(false);
          this._fnReady.set(true);
        },
      });
  }
}
