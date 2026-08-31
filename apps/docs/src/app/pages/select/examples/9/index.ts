import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvSelect } from '@malva-ui/core/select';
import type { MlvOptionsSearchFn } from '@malva-ui/core/select';
import { timer } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';

const FRUITS = [
  'Apple',
  'Apricot',
  'Banana',
  'Blackberry',
  'Blueberry',
  'Cherry',
  'Cranberry',
  'Fig',
  'Grape',
  'Grapefruit',
  'Kiwi',
  'Lemon',
  'Lime',
  'Mango',
  'Melon',
  'Nectarine',
  'Orange',
  'Papaya',
  'Peach',
  'Pear',
  'Pineapple',
  'Plum',
  'Raspberry',
  'Strawberry',
  'Watermelon',
];

@Component({
  selector: 'docs-select-search-fn-example',
  imports: [MlvSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SelectSearchFnExampleComponent {
  /** Owned by this component — `searchFn` reports no loading state of its own. */
  readonly loading = signal(false);

  /**
   * Simulates a 500ms server round-trip. Bound as a stable class field, not an
   * inline arrow, so the reference does not change on every change detection.
   */
  readonly searchFn: MlvOptionsSearchFn<string> = (query) =>
    timer(500).pipe(
      map(() => {
        const needle = query.trim().toLowerCase();
        return FRUITS.filter((fruit) => fruit.toLowerCase().includes(needle));
      }),
      tap({ subscribe: () => this.loading.set(true) }),
      finalize(() => this.loading.set(false)),
    );
}
