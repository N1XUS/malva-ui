import { computed, Injectable, signal } from '@angular/core';
import type { MlvTab } from './tab/tab';

@Injectable()
export class MlvTabsService {
  readonly tabs = signal<MlvTab[]>([]);

  /** How many tabs fit in the header. -1 means no overflow (all fit). */
  readonly maxVisibleCount = signal<number>(-1);

  /** A tab value forced into the visible area (selected from overflow popup). */
  readonly forcedVisibleValue = signal<string | null>(null);

  /**
   * Visible tabs with swap logic:
   * - If a forced tab exists and is beyond maxVisibleCount,
   *   it replaces the last naturally-visible tab.
   *
   * Example: tabs=[t1,t2,t3,t4,t5], max=3, forced=t4
   *   visible=[t1,t2,t4], overflow=[t3,t5]
   */
  readonly visibleTabs = computed(() => {
    const all = this.tabs();
    const max = this.maxVisibleCount();

    if (max < 0 || max >= all.length) return all;

    const forced = this.forcedVisibleValue();
    const forcedIndex =
      forced !== null ? all.findIndex((t) => t.value() === forced) : -1;

    // Forced tab is already in the visible range or doesn't exist
    if (forcedIndex < 0 || forcedIndex < max) {
      return all.slice(0, max);
    }

    // Swap: take first (max-1), then the forced tab. `Math.max(0, …)` guards the
    // `max === 0` case (all tabs overflow) so the forced/active tab is the sole
    // visible tab instead of duplicating the last natural tab.
    const visible = all.slice(0, Math.max(0, max - 1));
    visible.push(all[forcedIndex]);
    return visible;
  });

  readonly overflowTabs = computed(() => {
    const all = this.tabs();
    const max = this.maxVisibleCount();

    if (max < 0 || max >= all.length) return [];

    const forced = this.forcedVisibleValue();
    const forcedIndex =
      forced !== null ? all.findIndex((t) => t.value() === forced) : -1;

    // No forced tab or forced is already visible
    if (forcedIndex < 0 || forcedIndex < max) {
      return all.slice(max);
    }

    // The last naturally-visible tab (index max-1) goes to overflow, plus all
    // original overflow tabs except the forced one. When `max === 0` there is no
    // last-natural tab to demote (guarded below).
    const overflow: MlvTab[] = [];
    if (max - 1 >= 0) {
      overflow.push(all[max - 1]);
    }
    for (let i = max; i < all.length; i++) {
      if (i !== forcedIndex) {
        overflow.push(all[i]);
      }
    }
    return overflow;
  });

  register(tab: MlvTab): void {
    this.tabs.update((tabs) => [...tabs, tab]);
  }

  unregister(tab: MlvTab): void {
    this.tabs.update((tabs) => tabs.filter((t) => t !== tab));
    if (this.forcedVisibleValue() === tab.value()) {
      this.forcedVisibleValue.set(null);
    }
  }

  forceVisible(value: string): void {
    this.forcedVisibleValue.set(value);
  }
}
