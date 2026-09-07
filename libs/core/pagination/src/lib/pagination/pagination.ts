import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
  model,
  inject,
  computed,
  effect,
  contentChild,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvPaginationService } from './pagination.service';
import type { MlvPaginationObject } from './pagination.model';
import {
  MlvPaginationCount,
  MlvPaginationPerPageItem,
} from './pagination.directives';
import { NgTemplateOutlet } from '@angular/common';
import { MlvButton } from '@malva-ui/core/button';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { MlvInput } from '@malva-ui/core/input';
import { MlvClick } from '@malva-ui/cdk/accessibility';
import { mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvDropdownPanel } from '@malva-ui/core/dropdown';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MLV_PAGINATION_I18N, MlvI18nResolverService } from '@malva-ui/i18n';

/** Constant representing the default number of items per page. */
const DEFAULT_ITEMS_PER_PAGE = 10;

const DEFAULT_ITEMS_PER_PAGE_OPTIONS = [10, 30, 60, 100, Infinity];

/**
 * Pagination control: an item-count line with an items-per-page selector, and a
 * page-navigation strip with prev/next arrows and numbered page buttons.
 *
 * Both `currentPage` and `itemsPerPage` are two-way bindable models — the
 * component owns no data, only the position within it. `totalItems` is the one
 * required input.
 *
 * The page strip collapses on **page count**, not on width: once there are more
 * pages than fit the fixed window, `MlvPaginationService` replaces the middle
 * runs with an ellipsis marker that renders as a small numeric field. Type a
 * page number there and press Enter to jump. The whole strip is hidden while
 * there is only one page, and the per-page selector is hidden while
 * `totalItems` is at or below the smallest `perPageOptions` entry.
 *
 * @example Basic
 * ```html
 * <mlv-pagination [totalItems]="total" [(currentPage)]="page" />
 * ```
 *
 * @example Custom per-page choices, including "all items"
 * ```html
 * <mlv-pagination
 *   [totalItems]="total"
 *   [(currentPage)]="page"
 *   [(itemsPerPage)]="perPage"
 *   [perPageOptions]="[10, 25, 50, Infinity]"
 * />
 * ```
 *
 * @example Replacing the item-count text
 * ```html
 * <mlv-pagination [totalItems]="total" [(currentPage)]="page">
 *   <ng-template mlvPaginationCount let-page let-start="start" let-end="end">
 *     Showing {{ start }}–{{ end }} on page {{ page }}
 *   </ng-template>
 * </mlv-pagination>
 * ```
 */
@Component({
  selector: 'mlv-pagination',
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `mlv-dropdown-panel` injects `MlvSelectionService` non-optionally and expects
  // its owner to provide it, the same way `mlv-select` and `mlv-combobox` do. The
  // panel only uses it as a focus-first channel, so nothing here reads selection
  // state from it — `selectedValues` stays the single source of truth.
  providers: [MlvPaginationService, MlvSelectionService],
  imports: [
    NgTemplateOutlet,
    MlvButton,
    LucideChevronLeft,
    LucideChevronRight,
    MlvInput,
    MlvClick,
    MlvPopup,
    MlvDropdownPanel,
    MlvPopupTrigger,
    MlvPopupContent,
  ],
  host: {
    class: 'mlv-pagination',
    '[class.mlv-pagination--mobile]': 'mobile()',
  },
})
export class MlvPagination {
  /** @protected Projected custom item-count template, if any. */
  protected readonly _itemsCountRef = contentChild(MlvPaginationCount);

  /** @protected Projected custom items-per-page template, if any. */
  protected readonly _itemsPerPageRef = contentChild(MlvPaginationPerPageItem);

  /**
   * Unique id for this pagination instance, defaulted to a generated one.
   *
   * **Currently inert** — nothing reads it. The per-page trigger and its
   * listbox pair through their own generated `_perPageListboxId`, and the id is
   * not reflected onto the host. Binding it compiles but changes nothing.
   */
  readonly id = input<string>(mlvNextId('mlv-pagination'));

  /**
   * Adds `mlv-pagination--mobile` to the host.
   *
   * The library ships **no rules** for that class — the component's own layout
   * is identical either way. Treat it as a styling hook for the consumer, not
   * as a built-in responsive mode.
   */
  readonly mobile = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Total number of items across all pages. Required.
   *
   * Drives the page count (`totalItems / itemsPerPage`), the "X–Y of Z" range
   * text, and which `perPageOptions` are offered: the list is cut after the
   * first option that covers `totalItems`, and the selector disappears entirely
   * when `totalItems` is at or below the smallest option.
   *
   * Not coerced: bind a `number`, not a route-param string.
   */
  readonly totalItems = input.required<number>();

  /**
   * Items shown per page. Two-way bindable; also set by the per-page selector.
   * `Infinity` means "all items on one page".
   */
  readonly itemsPerPage = model<number>(DEFAULT_ITEMS_PER_PAGE);

  /**
   * Choices offered by the items-per-page selector.
   *
   * The list is cut after the first option that covers `totalItems` — so one
   * "show everything" choice always survives and the rest are dropped. Include
   * `Infinity` to offer "All (Z)" for datasets larger than every option.
   */
  readonly perPageOptions = input<number[]>(DEFAULT_ITEMS_PER_PAGE_OPTIONS);

  /**
   * **Currently inert** — nothing reads it. The item count is always rendered;
   * project an `[mlvPaginationCount]` template to change or suppress the text.
   */
  readonly displayTotalItems = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Currently active page, 1-based. Two-way bindable. */
  readonly currentPage = model<number>(1);

  /**
   * Density applied to the items-per-page dropdown list.
   *
   * The dropdown panel is portaled to the CDK overlay container, outside the
   * component's DOM tree, so ancestor density classes cannot cascade into it.
   * Forwarded to the underlying `mlv-popup`, which stamps the resolved
   * `mlv--{density}` class on the detached panel. When omitted, the global
   * `MlvDensityService` density applies.
   */
  readonly mlvDensity = input<MlvDensity | undefined>(undefined);

  /** @protected Component-scoped pagination state service. */
  protected readonly _service = inject(MlvPaginationService);

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_PAGINATION_I18N);

  /** @private Resolver for ICU parameterized i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @protected Index of the first item shown on the current page (1-based). */
  protected readonly _currentItemsStart = computed(
    () => (this.currentPage() - 1) * this.itemsPerPage() + 1,
  );
  /** @protected Index of the last item shown on the current page (clamped to total). */
  protected readonly _currentItemsEnd = computed(() => {
    const calculatedEnd = this._currentItemsStart() + this.itemsPerPage() - 1;
    return Math.min(calculatedEnd, this.totalItems());
  });

  /** @protected `Infinity` constant exposed for the "All items" per-page option comparison in the template. */
  protected readonly infinity = Infinity;

  /** @protected Resolved total item count display (e.g. "50 items"). */
  protected readonly _resolvedItemCount = computed(() => {
    const i18n = this._i18n();
    return this._resolver.resolve(
      i18n as unknown as Record<string, string>,
      'itemCount',
      {
        count: this.totalItems(),
      },
    );
  });

  /** @protected Resolved "X–Y of Z" range display. */
  protected readonly _resolvedRange = computed(() => {
    const i18n = this._i18n();
    return this._resolver.resolve(
      i18n as unknown as Record<string, string>,
      'itemRange',
      {
        start: this._currentItemsStart(),
        end: this._currentItemsEnd(),
        total: this.totalItems(),
      },
    );
  });

  /** @protected Resolved "All (Z)" label for the Infinity per-page option in the trigger button. */
  protected readonly _resolvedAllItems = computed(() => {
    const i18n = this._i18n();
    return this._resolver.resolve(
      i18n as unknown as Record<string, string>,
      'allItems',
      {
        total: this.totalItems(),
      },
    );
  });

  /** @protected Resolves per-page option label (e.g. "10 items per page" or "All (50)"). */
  protected _resolvedPerPageLabel(option: number): string {
    const i18n = this._i18n();
    if (option === Infinity) {
      return this._resolver.resolve(
        i18n as unknown as Record<string, string>,
        'allItems',
        {
          total: this.totalItems(),
        },
      );
    }
    return this._resolver.resolve(
      i18n as unknown as Record<string, string>,
      'itemsPerPage',
      {
        count: option,
      },
    );
  }

  /**
   * @protected Per-page choices in the shape `mlv-dropdown-panel` consumes.
   *
   * Labels come from {@link _resolvedPerPageLabel}, so the `Infinity` entry keeps
   * its "All (Z)" wording rather than rendering as a number.
   */
  protected readonly _perPageOptions = computed<MlvSelectOption<number>[]>(() =>
    this._service.normalizedItemsPerPageOptions().map((option) => ({
      label: this._resolvedPerPageLabel(option),
      value: option,
    })),
  );

  /** @protected Currently selected per-page value, as the panel's array shape. */
  protected readonly _selectedPerPage = computed<number[]>(() => [
    this.itemsPerPage(),
  ]);

  /** @protected Id linking the trigger's `aria-controls` to the panel's listbox. */
  protected readonly _perPageListboxId = mlvNextId('mlv-pagination-per-page');

  /**
   * @protected Accessible name for the per-page listbox inside the popup.
   *
   * `mlv-dropdown-panel` renders an `mlv-list[selectable]` whose host claims
   * `role="listbox"`, and a listbox owes an accessible name (axe
   * `aria-input-field-name`, WCAG 4.1.2). The panel takes that name through its
   * `ariaLabel` input and invents none of its own, so without this the popup
   * opened an unnamed listbox.
   *
   * The wording is the current selection's own label — "10 items per page", or
   * "All (Z)" for `Infinity` — which reuses {@link _resolvedPerPageLabel} and
   * so needs no new i18n key and stays translated in every pack. It is also
   * what a screen reader would announce if the panel could be labelled by the
   * trigger it belongs to, which it cannot: the panel exposes `ariaLabel` only.
   */
  protected readonly _perPageListboxLabel = computed(() =>
    this._resolvedPerPageLabel(this.itemsPerPage()),
  );

  /** @private Aggregated pagination inputs pushed into the pagination service. */
  private readonly _paginationObject = computed<MlvPaginationObject>(() => ({
    totalItems: this.totalItems(),
    currentPage: this.currentPage(),
    itemsPerPage: this.itemsPerPage(),
    itemsPerPageOptions: this.perPageOptions(),
  }));

  constructor() {
    effect(() => {
      this._service.pagination.set(this._paginationObject());
    });
  }

  /**
   * Template context handed to a projected `[mlvPaginationCount]` or
   * `[mlvPaginationPerPageItem]` slot.
   *
   * `$implicit` is the current page; `start`/`end` are the 1-based indices of
   * the first and last item on it (`end` clamped to `totalItems`); `options` is
   * the per-page list after trimming against `totalItems`.
   */
  getCellContext() {
    return {
      $implicit: this.currentPage(),
      total: this.totalItems(),
      start: this._currentItemsStart(),
      end: this._currentItemsEnd(),
      options: this._service.normalizedItemsPerPageOptions(),
    };
  }

  /**
   * Sets `currentPage`. Performs no clamping — callers inside the component
   * only reach it from enabled controls, so the page is already in range.
   */
  goToPage(page: number) {
    this.currentPage.set(page);
  }

  /** Sets `itemsPerPage`. `Infinity` puts every item on one page. */
  setItemsPerPage(itemsPerPage: number): void {
    this.itemsPerPage.set(itemsPerPage);
  }

  /**
   * @protected Applies a per-page choice from the dropdown panel.
   *
   * The panel's selection model is array-shaped even for single select, so the
   * one value is unwrapped here. An empty emission means the panel deselected
   * rather than selected, which is not a per-page choice.
   */
  protected _onPerPageChange(values: readonly number[]): void {
    const [next] = values;
    if (next === undefined) return;

    this.setItemsPerPage(next);
  }

  /**
   * Jumps to the page typed into an ellipsis page-jump field (Enter keydown).
   * Out-of-range values are ignored — the field keeps its text and the page
   * does not change.
   */
  setPageFromInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);

    const totalPages = this._service.totalPages();

    if (value < 1 || value > totalPages) {
      return;
    }

    this.goToPage(value);
  }

  /** @protected Resolves the accessible label for a numbered page button. */
  protected _pageAriaLabel(page: number): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'page',
      { page },
    );
  }
}
