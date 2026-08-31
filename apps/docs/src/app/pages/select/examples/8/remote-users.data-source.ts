import { computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import type { MlvSearchState } from '@malva-ui/cdk/data-source';

export interface DemoUser {
  id: number;
  name: string;
  email: string;
}

const ALL_USERS: DemoUser[] = Array.from({ length: 57 }, (_, i) => ({
  id: i + 1,
  name: `User ${String(i + 1).padStart(2, '0')}`,
  email: `user${i + 1}@example.com`,
}));

/**
 * Fake remote source: 600 ms latency, server-side search on name/email,
 * paged (perPage from the base, default 10). Sets `_loading` synchronously.
 */
export class RemoteUsersDataSource extends MlvDataSource<DemoUser> {
  private readonly _slice = signal<DemoUser[]>([]);
  private readonly _total = signal(0);
  private _timer: ReturnType<typeof setTimeout> | null = null;

  readonly totalItems: Signal<number> = computed(() => this._total());

  connect(): Signal<DemoUser[]> {
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
    if (this._timer) clearTimeout(this._timer);
    this._loading.set(true);
    const query = (this._search()?.query ?? '').trim().toLowerCase();
    const page = this._page();
    const perPage = this._perPage();
    this._timer = setTimeout(() => {
      const filtered = ALL_USERS.filter(
        (u) =>
          !query ||
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      );
      this._total.set(filtered.length);
      const start = (page - 1) * perPage;
      this._slice.set(filtered.slice(start, start + perPage));
      this._loading.set(false);
    }, 600);
  }
}
