import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvDropdownPanel } from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvButton } from '@malva-ui/core/button';

/** How many builds the fake backend holds in total. */
const TOTAL = 42;

/** How many builds each page returns. */
const PAGE_SIZE = 8;

/** Deterministic stand-in for a paged API response. */
function fetchPage(offset: number): MlvSelectOption<number>[] {
  const stages = ['deploy web', 'deploy api', 'run migrations', 'smoke tests'];
  return Array.from(
    { length: Math.min(PAGE_SIZE, TOTAL - offset) },
    (_, index) => {
      const build = TOTAL - offset - index;
      return {
        label: `#${1000 + build} — ${stages[build % stages.length]}`,
        value: build,
      };
    },
  );
}

@Component({
  selector: 'docs-dropdown-paging-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDropdownPanel, MlvButton],
  providers: [MlvSelectionService],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DropdownPagingExampleComponent {
  /** Pages accumulated so far. */
  readonly options = signal<MlvSelectOption<number>[]>([]);

  /** First page (or a reload) is in flight. */
  readonly loading = signal(true);

  /** A page beyond the first is in flight. */
  readonly loadingMore = signal(false);

  /** Committed selection. */
  readonly selected = signal<number[]>([]);

  /** Whether the fake backend still has rows left. */
  readonly hasMore = computed(() => this.options().length < TOTAL);

  /** Loaded-row counter shown under the panel. */
  readonly status = computed(
    () => `${this.options().length} of ${TOTAL} builds loaded`,
  );

  /** @private Pending fake request, cleared on destroy and before a reload. */
  private _timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this._cancel());
    this._loadFirstPage();
  }

  /** Appends the next page; the panel fires this from its scroll sentinel. */
  onLoadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;

    this.loadingMore.set(true);
    this._request(700, () => {
      this.options.update((current) => [
        ...current,
        ...fetchPage(current.length),
      ]);
      this.loadingMore.set(false);
    });
  }

  /** Throws the accumulated pages away and reloads from the first one. */
  reload(): void {
    this._loadFirstPage();
  }

  /** Keeps the last picked value; single-select emits at most one. */
  onValueChange(values: readonly number[]): void {
    this.selected.set(values.length ? [values[values.length - 1]] : []);
  }

  /** @private Resets to the loading state and fetches page one. */
  private _loadFirstPage(): void {
    this.loadingMore.set(false);
    this.loading.set(true);
    this._request(600, () => {
      this.options.set(fetchPage(0));
      this.loading.set(false);
    });
  }

  /** @private Runs `work` after `delay`, superseding any pending request. */
  private _request(delay: number, work: () => void): void {
    this._cancel();
    this._timer = setTimeout(() => {
      this._timer = null;
      work();
    }, delay);
  }

  /** @private Drops a pending fake request. */
  private _cancel(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
}
