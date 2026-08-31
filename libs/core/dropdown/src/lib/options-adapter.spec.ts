import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvArrayDataSource, MlvDataSource } from '@malva-ui/cdk/data-source';
import type { MlvSearchState } from '@malva-ui/cdk/data-source';
import { Subject } from 'rxjs';
import { MlvOptionsAdapter } from './options-adapter';
import type { MlvOptionsInput, MlvOptionsSearchFn } from './options-adapter';
import { MlvSelectDataSource } from './select-data-source';

/** Remote source stub: pages of `perPage` from a fixed list, async via a Subject per request. */
class RemoteStub extends MlvDataSource<string> {
  readonly requests: Array<{
    page: number;
    query: string;
    resolve: () => void;
  }> = [];
  /** How many times `connect()` was called — a `searchFn` must suppress it entirely. */
  connectCount = 0;
  private readonly _slice = signal<string[]>([]);
  readonly totalItems = signal(0);
  constructor(private readonly _all: string[]) {
    super();
    this._perPage.set(2);
  }
  connect(): Signal<string[]> {
    this.connectCount++;
    this._fetch();
    return this._slice.asReadonly();
  }
  override setSearch(search: MlvSearchState | null): void {
    super.setSearch(search);
    this._fetch();
  }
  override setPage(page: number): void {
    super.setPage(page);
    this._fetch();
  }
  private _fetch(): void {
    this._loading.set(true);
    const page = this._page();
    const query = this._search()?.query ?? '';
    this.requests.push({
      page,
      query,
      resolve: () => {
        const filtered = this._all.filter((s) =>
          s.toLowerCase().includes(query.toLowerCase()),
        );
        this.totalItems.set(filtered.length);
        const start = (page - 1) * this._perPage();
        this._slice.set(filtered.slice(start, start + this._perPage()));
        this._loading.set(false);
      },
    });
  }
}

function make<T>(cfg: {
  source?: MlvOptionsInput<T>;
  searchFn?: MlvOptionsSearchFn<T> | null;
  debounce?: number;
  eager?: boolean;
}) {
  const source = signal<MlvOptionsInput<T>>(cfg.source ?? []);
  const searchFn = signal<MlvOptionsSearchFn<T> | null | undefined>(
    cfg.searchFn ?? null,
  );
  const debounce = signal(cfg.debounce ?? 0);
  const eager = signal(cfg.eager ?? false);
  const injector = TestBed.inject(Injector);
  const adapter = runInInjectionContext(
    injector,
    () => new MlvOptionsAdapter<T>({ source, searchFn, debounce, eager }),
  );
  const flush = () => TestBed.tick();
  flush();
  return { adapter, source, searchFn, debounce, eager, flush };
}

describe('MlvOptionsAdapter', () => {
  describe('array source', () => {
    it('is local, ready, not loading, items = array', () => {
      const { adapter } = make({ source: ['a', 'b'] });
      expect(adapter.mode()).toBe('local');
      expect(adapter.items()).toEqual(['a', 'b']);
      expect(adapter.loading()).toBe(false);
      expect(adapter.ready()).toBe(true);
      expect(adapter.hasMore()).toBe(false);
      expect(adapter.loadingMore()).toBe(false);
    });

    it('treats null/undefined as an empty local list', () => {
      const { adapter } = make<string>({ source: null });
      expect(adapter.items()).toEqual([]);
      expect(adapter.ready()).toBe(true);
    });

    it('search() is a no-op in local mode', () => {
      const { adapter } = make({ source: ['a'] });
      adapter.search('zzz');
      expect(adapter.items()).toEqual(['a']);
    });
  });

  describe('observable source', () => {
    it('is loading until the first emission, then ready with the latest items', () => {
      const subject = new Subject<readonly string[]>();
      const { adapter, flush } = make<string>({
        source: subject.asObservable(),
      });
      expect(adapter.mode()).toBe('local');
      expect(adapter.loading()).toBe(true);
      expect(adapter.ready()).toBe(false);
      subject.next(['x']);
      flush();
      expect(adapter.items()).toEqual(['x']);
      expect(adapter.loading()).toBe(false);
      expect(adapter.ready()).toBe(true);
      subject.next(['x', 'y']);
      flush();
      expect(adapter.items()).toEqual(['x', 'y']);
    });

    it('re-subscribes and resets ready when the observable reference changes', () => {
      const first = new Subject<readonly string[]>();
      const second = new Subject<readonly string[]>();
      const { adapter, source, flush } = make<string>({
        source: first.asObservable(),
      });
      first.next(['a']);
      flush();
      expect(adapter.ready()).toBe(true);
      source.set(second.asObservable());
      flush();
      expect(adapter.ready()).toBe(false);
      expect(adapter.items()).toEqual([]);
      first.next(['stale']);
      flush();
      expect(adapter.items()).toEqual([]);
      second.next(['b']);
      flush();
      expect(adapter.items()).toEqual(['b']);
    });
  });

  describe('MlvDataSource source', () => {
    it('MlvSelectDataSource: remote mode, ready immediately, source-side search with keys []', () => {
      const ds = new MlvSelectDataSource(['Apple', 'Banana', 'Cherry']);
      const { adapter, flush } = make<string>({ source: ds });
      expect(adapter.mode()).toBe('remote');
      expect(adapter.ready()).toBe(true);
      expect(adapter.items()).toEqual(['Apple', 'Banana', 'Cherry']);
      adapter.search('an');
      flush();
      expect(ds.search()).toEqual({ query: 'an', keys: [] });
      expect(adapter.items()).toEqual(['Banana']);
      adapter.search('   ');
      flush();
      expect(ds.search()).toBeNull();
      expect(adapter.hasMore()).toBe(false);
    });

    it('remote source: loading until first slice, then pages accumulate on loadMore', () => {
      const ds = new RemoteStub(['a1', 'a2', 'a3', 'a4', 'a5']);
      const { adapter, flush } = make<string>({ source: ds });
      expect(adapter.loading()).toBe(true);
      expect(adapter.ready()).toBe(false);
      ds.requests[0].resolve();
      flush();
      expect(adapter.items()).toEqual(['a1', 'a2']);
      expect(adapter.ready()).toBe(true);
      expect(adapter.loading()).toBe(false);
      expect(adapter.hasMore()).toBe(true);

      adapter.loadMore();
      flush();
      expect(adapter.loadingMore()).toBe(true);
      expect(adapter.loading()).toBe(false); // top spinner off, bottom on
      expect(adapter.items()).toEqual(['a1', 'a2']); // stale kept
      ds.requests[1].resolve();
      flush();
      expect(adapter.items()).toEqual(['a1', 'a2', 'a3', 'a4']);
      expect(adapter.loadingMore()).toBe(false);

      adapter.loadMore();
      flush();
      ds.requests[2].resolve();
      flush();
      expect(adapter.items()).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
      expect(adapter.hasMore()).toBe(false);
      adapter.loadMore(); // exhausted → no request
      expect(ds.requests.length).toBe(3);
    });

    it('loadMore() is a no-op while a page is in flight', () => {
      const ds = new RemoteStub(['a1', 'a2', 'a3', 'a4']);
      const { adapter, flush } = make<string>({ source: ds });
      ds.requests[0].resolve();
      flush();
      adapter.loadMore();
      flush();
      adapter.loadMore();
      expect(ds.requests.length).toBe(2);
    });

    it('never skips a page when loadMore() fires twice before the slice is applied', () => {
      const ds = new MlvArrayDataSource(
        Array.from({ length: 25 }, (_, i) => i),
      );
      const { adapter, flush } = make<number>({ source: ds });
      expect(adapter.items()).toEqual(Array.from({ length: 10 }, (_, i) => i));

      // A source that never reports `loading` (in-memory) — the second call is
      // blocked by the not-yet-applied page, not by a loading flag.
      adapter.loadMore();
      adapter.loadMore();
      flush();
      expect(ds.page()).toBe(2);
      expect(adapter.items()).toEqual(Array.from({ length: 20 }, (_, i) => i));

      adapter.loadMore();
      flush();
      expect(adapter.items()).toEqual(Array.from({ length: 25 }, (_, i) => i));
      expect(adapter.hasMore()).toBe(false);
    });

    it('replaces the tail when the source re-emits the page already applied', () => {
      const data = signal(['a1', 'a2', 'a3', 'a4', 'a5']);
      const ds = new MlvArrayDataSource(data);
      ds.setPerPage(2);
      const { adapter, flush } = make<string>({ source: ds });
      adapter.loadMore();
      flush();
      expect(adapter.items()).toEqual(['a1', 'a2', 'a3', 'a4']);

      data.set(['a1', 'a2', 'b3', 'b4', 'a5']);
      flush();
      expect(adapter.items()).toEqual(['a1', 'a2', 'b3', 'b4']);
    });

    it('blocks loadMore() until the requested page is applied, then allows the next', () => {
      const ds = new RemoteStub(['a1', 'a2', 'a3', 'a4', 'a5']);
      const { adapter, flush } = make<string>({ source: ds });
      ds.requests[0].resolve();
      flush();

      adapter.loadMore(); // page 2 requested, slice not applied yet
      flush();
      adapter.loadMore(); // pending → no request
      expect(ds.requests.length).toBe(2);

      ds.requests[1].resolve();
      flush();
      expect(adapter.items()).toEqual(['a1', 'a2', 'a3', 'a4']);
      adapter.loadMore(); // page 2 applied → page 3 may be requested
      expect(ds.requests.length).toBe(3);
      expect(ds.requests[2].page).toBe(3);
    });

    it('a new search resets accumulation to page 1 and keeps stale items while loading', () => {
      const ds = new RemoteStub(['a1', 'a2', 'a3', 'b1']);
      const { adapter, flush } = make<string>({ source: ds });
      ds.requests[0].resolve();
      flush();
      adapter.loadMore();
      flush();
      ds.requests[1].resolve();
      flush();
      expect(adapter.items()).toEqual(['a1', 'a2', 'a3', 'b1']);
      adapter.search('b');
      flush();
      expect(adapter.loading()).toBe(true);
      expect(adapter.items()).toEqual(['a1', 'a2', 'a3', 'b1']); // stale until result
      ds.requests[2].resolve();
      flush();
      expect(adapter.items()).toEqual(['b1']);
      expect(ds.page()).toBe(1);
    });

    it('debounces remote searches', () => {
      vi.useFakeTimers();
      try {
        const ds = new RemoteStub(['a', 'b']);
        const { adapter, flush } = make<string>({ source: ds, debounce: 200 });
        ds.requests[0].resolve();
        flush();
        adapter.search('a');
        adapter.search('ab');
        vi.advanceTimersByTime(199);
        expect(ds.requests.length).toBe(1);
        vi.advanceTimersByTime(1);
        flush();
        expect(ds.requests.length).toBe(2);
        expect(ds.requests[1].query).toBe('ab');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('searchFn', () => {
    it('is remote; lazy until ensureLoaded(); loading while in flight; ready after first result', () => {
      const subject = new Subject<string[]>();
      const calls: string[] = [];
      const fn: MlvOptionsSearchFn<string> = (q) => {
        calls.push(q);
        return subject.asObservable();
      };
      const { adapter, flush } = make<string>({
        source: ['ignored'],
        searchFn: fn,
      });
      expect(adapter.mode()).toBe('remote');
      expect(calls).toEqual([]);
      expect(adapter.ready()).toBe(false);
      adapter.ensureLoaded();
      expect(calls).toEqual(['']);
      expect(adapter.loading()).toBe(true);
      subject.next(['r1']);
      flush();
      expect(adapter.items()).toEqual(['r1']);
      expect(adapter.loading()).toBe(false);
      expect(adapter.ready()).toBe(true);
      // paging is a data-source-only affordance
      expect(adapter.hasMore()).toBe(false);
      expect(adapter.loadingMore()).toBe(false);
      adapter.ensureLoaded(); // already started → no second call
      expect(calls).toEqual(['']);
    });

    it('eager runs the initial search on construction', () => {
      const calls: string[] = [];
      const fn: MlvOptionsSearchFn<string> = (q) => {
        calls.push(q);
        return ['x'];
      };
      const { adapter } = make<string>({ searchFn: fn, eager: true });
      expect(calls).toEqual(['']);
      expect(adapter.items()).toEqual(['x']);
      expect(adapter.ready()).toBe(true);
    });

    it('a newer query supersedes an in-flight one and keeps stale items until the result', () => {
      const first = new Subject<string[]>();
      const second = new Subject<string[]>();
      let call = 0;
      const fn: MlvOptionsSearchFn<string> = () =>
        (call++ === 0 ? first : second).asObservable();
      const { adapter, flush } = make<string>({ searchFn: fn });
      adapter.search('a');
      adapter.search('ab');
      first.next(['STALE']);
      flush();
      expect(adapter.items()).toEqual([]);
      expect(adapter.loading()).toBe(true);
      second.next(['fresh']);
      flush();
      expect(adapter.items()).toEqual(['fresh']);
      expect(adapter.loading()).toBe(false);
    });

    it('errors resolve to an empty list and end loading', () => {
      const subject = new Subject<string[]>();
      const { adapter, flush } = make<string>({
        searchFn: () => subject.asObservable(),
      });
      adapter.search('x');
      subject.error(new Error('boom'));
      flush();
      expect(adapter.items()).toEqual([]);
      expect(adapter.loading()).toBe(false);
      expect(adapter.ready()).toBe(true);
    });

    it('a swapped searchFn only re-arms the lazy gate, keeping the previous results until the new one answers', () => {
      const subjectA = new Subject<string[]>();
      const subjectB = new Subject<string[]>();
      const callsA: string[] = [];
      const callsB: string[] = [];
      const fnA: MlvOptionsSearchFn<string> = (q) => {
        callsA.push(q);
        return subjectA.asObservable();
      };
      const fnB: MlvOptionsSearchFn<string> = (q) => {
        callsB.push(q);
        return subjectB.asObservable();
      };
      const { adapter, searchFn, flush } = make<string>({ searchFn: fnA });
      adapter.ensureLoaded();
      subjectA.next(['a1']);
      flush();
      expect(adapter.items()).toEqual(['a1']);
      expect(adapter.ready()).toBe(true);

      searchFn.set(fnB);
      flush();
      // Nothing is torn down or cleared — A's result stays on screen.
      expect(adapter.items()).toEqual(['a1']);
      expect(adapter.ready()).toBe(true);
      expect(adapter.loading()).toBe(false);
      expect(callsB).toEqual([]); // still lazy — nothing runs until asked

      adapter.ensureLoaded();
      expect(callsB).toEqual(['']);
      expect(callsA).toEqual(['']); // A never re-invoked
      expect(adapter.loading()).toBe(true);
      // Still A's items while B is in flight.
      expect(adapter.items()).toEqual(['a1']);
      subjectB.next(['b1']);
      flush();
      expect(adapter.items()).toEqual(['b1']);
      expect(adapter.ready()).toBe(true);
    });

    it('re-binding an equivalent searchFn does not cancel the in-flight call', () => {
      const subject = new Subject<string[]>();
      let calls = 0;
      const { adapter, searchFn, flush } = make<string>({
        searchFn: () => {
          calls++;
          return subject.asObservable();
        },
      });
      adapter.search('x');
      expect(calls).toBe(1);
      expect(adapter.loading()).toBe(true);

      // An inline arrow in a template (`[search]="(q) => api.find(q)"`) is a
      // fresh reference on every change detection run: it must not supersede
      // the call already in flight.
      searchFn.set(() => subject.asObservable());
      flush();
      searchFn.set(() => subject.asObservable());
      flush();
      expect(calls).toBe(1);
      expect(adapter.loading()).toBe(true);

      subject.next(['in-flight-result']);
      flush();
      expect(adapter.items()).toEqual(['in-flight-result']);
      expect(adapter.loading()).toBe(false);
      expect(adapter.ready()).toBe(true);
    });

    it('does not connect a data source while a searchFn supersedes it', () => {
      const ds = new RemoteStub(['a1', 'a2']);
      const calls: string[] = [];
      const fn: MlvOptionsSearchFn<string> = (q) => {
        calls.push(q);
        return ['fn-' + q];
      };
      const { adapter, searchFn, flush } = make<string>({
        source: ds,
        searchFn: fn,
      });
      expect(adapter.mode()).toBe('remote');
      expect(ds.connectCount).toBe(0);
      expect(ds.requests.length).toBe(0);
      adapter.ensureLoaded();
      expect(adapter.items()).toEqual(['fn-']);

      // Clearing the searchFn hands the branch back to the data source.
      searchFn.set(null);
      flush();
      expect(ds.connectCount).toBe(1);
      expect(adapter.items()).toEqual([]);
      expect(adapter.ready()).toBe(false);
      ds.requests[0].resolve();
      flush();
      expect(adapter.items()).toEqual(['a1', 'a2']);
      expect(adapter.ready()).toBe(true);
    });

    it('accepts arrays and promises', async () => {
      const { adapter, flush } = make<string>({
        searchFn: (q) => Promise.resolve([q + '!']),
      });
      adapter.search('hi');
      await Promise.resolve();
      await Promise.resolve();
      flush();
      expect(adapter.items()).toEqual(['hi!']);
      const sync = make<string>({ searchFn: (q) => [q] });
      sync.adapter.search('s');
      sync.flush();
      expect(sync.adapter.items()).toEqual(['s']);
    });
  });
});
