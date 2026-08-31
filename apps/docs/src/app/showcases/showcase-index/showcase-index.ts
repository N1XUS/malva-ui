import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { SHOWCASE_CATEGORIES, SHOWCASES } from '../showcase.registry';
import type { ShowcaseCategory } from '../showcase.types';

type ShowcaseCategoryFilter = ShowcaseCategory | 'all';

function isShowcaseCategoryFilter(
  value: string | null,
): value is ShowcaseCategoryFilter {
  return SHOWCASE_CATEGORIES.some((category) => category.value === value);
}

@Component({
  selector: 'docs-showcase-index',
  imports: [NgOptimizedImage, RouterLink, MlvSegmented, MlvSegmentedItem],
  templateUrl: './showcase-index.html',
  styleUrl: './showcase-index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseIndexComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _queryParamMap = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });

  /** All linkable category choices rendered by the catalog segmented control. */
  readonly categories = SHOWCASE_CATEGORIES;

  /** Active catalog category; invalid or absent URL values intentionally show all. */
  readonly activeCategory = computed<ShowcaseCategoryFilter>(() => {
    const value = this._queryParamMap().get('category');
    return isShowcaseCategoryFilter(value) ? value : 'all';
  });

  /** Cards visible for the category resolved from the current URL. */
  readonly visibleShowcases = computed(() => {
    const category = this.activeCategory();
    return category === 'all'
      ? SHOWCASES
      : SHOWCASES.filter((showcase) => showcase.category === category);
  });
}
