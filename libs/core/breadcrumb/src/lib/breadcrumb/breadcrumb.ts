import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  ElementRef,
  inject,
  input,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { LucideChevronRight } from '@lucide/angular';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvList, MlvListItem, MlvListItemLink } from '@malva-ui/core/list';
import { MlvBreadcrumbItem } from './breadcrumb-item';
import { MlvBreadcrumbSeparator } from './breadcrumb-separator';
import type { MlvBreadcrumbEntry } from './breadcrumb.types';
import { MLV_BREADCRUMB_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { MlvRtlService, mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvDensity } from '@malva-ui/cdk/density';

/**
 * Navigation breadcrumb component.
 *
 * Use with `nav[mlvBreadcrumb]` selector applied to a `<nav>` element.
 * Renders a list of breadcrumb trail items with a customisable separator,
 * optional overflow truncation with a popover for hidden items, and router
 * integration.
 *
 * Supports two usage modes:
 * 1. **Data-driven** — pass an array of `MlvBreadcrumbEntry` objects via `[items]`.
 * 2. **Projected** — nest `<mlv-breadcrumb-item>` elements directly.
 *
 * The separator can be customised by placing `<ng-template mlvSeparator>` inside
 * the `<nav>`. When no separator directive is present, a `LucideChevronRight` icon
 * is used as the default.
 *
 * @example Data-driven
 * ```html
 * <nav mlvBreadcrumb [items]="breadcrumbs"></nav>
 * ```
 *
 * @example Custom separator via structural directive
 * ```html
 * <nav mlvBreadcrumb [items]="breadcrumbs">
 *   <ng-template mlvSeparator>›</ng-template>
 * </nav>
 * ```
 *
 * @example Projected items
 * ```html
 * <nav mlvBreadcrumb>
 *   <mlv-breadcrumb-item href="/">Home</mlv-breadcrumb-item>
 *   <mlv-breadcrumb-item [routerLink]="['/products']">Products</mlv-breadcrumb-item>
 *   <mlv-breadcrumb-item [current]="true">Widget Pro</mlv-breadcrumb-item>
 * </nav>
 * ```
 *
 * @example With overflow truncation
 * ```html
 * <nav mlvBreadcrumb [items]="longBreadcrumbs" [maxItems]="4"></nav>
 * ```
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'nav[mlvBreadcrumb]',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    LucideChevronRight,
    MlvPopup,
    MlvPopupTrigger,
    MlvPopupContent,
    MlvList,
    MlvListItem,
    MlvListItemLink,
  ],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-breadcrumb',
    role: 'navigation',
    '[attr.aria-label]': '_i18n().label',
  },
})
export class MlvBreadcrumb {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_BREADCRUMB_I18N);

  /** @private Resolver for ICU parameterized i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /**
   * @protected Resolved aria-label for the overflow ellipsis button, e.g.
   * "Show 3 more breadcrumb items".
   */
  protected readonly _showMoreLabel = computed(() =>
    this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'showMore',
      { count: this._hiddenItems().length },
    ),
  );

  /** @private Document reference used for focus navigation checks. */
  private readonly _document = inject(DOCUMENT);
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element; the scope horizontal arrow keys resolve their
   * direction against. The overflow menu they drive renders in a CDK overlay
   * pane portaled to `<body>` and stamped with its own `dir`, so reading the
   * document direction there would mirror neither that pane nor a `[dir]`
   * subtree the breadcrumb sits in.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Direction applying to this breadcrumb, resolved once and cached
   * behind the shared `dir` observer rather than re-walked on every arrow
   * keypress.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  /**
   * Data-driven list of breadcrumb items.
   * When provided, items are rendered from this array.
   * The last item in the array is automatically treated as the current page.
   */
  readonly items = input<MlvBreadcrumbEntry[]>([]);

  /**
   * Density applied to the overflow popover's item list.
   *
   * The popover is portaled to the CDK overlay container, outside the
   * component's DOM tree, so ancestor density classes cannot cascade into it.
   * Forwarded to the overflow `mlv-popup`, which stamps the resolved
   * `mlv--{density}` class on the detached panel. When omitted, the global
   * `MlvDensityService` density applies.
   */
  readonly mlvDensity = input<MlvDensity | undefined>(undefined);

  /**
   * Maximum number of items to display before truncating.
   * When the total count exceeds this value, the middle items are collapsed
   * into an ellipsis (`…`) button. Clicking the button opens a popover
   * listing all hidden items. Always shows the first and last items.
   * Set to `0` to disable truncation (show all items). Defaults to `0`.
   */
  readonly maxItems = input<number>(0);

  /**
   * When `true`, makes the separator `aria-hidden` to prevent screen readers
   * from announcing it. Defaults to `true`.
   */
  readonly hideSeparatorFromScreenReaders = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * @protected Custom separator template projected via `<ng-template mlvSeparator>`.
   * When absent, a `LucideChevronRight` icon is rendered as the default separator.
   */
  protected readonly _separatorDef = contentChild(MlvBreadcrumbSeparator);

  /**
   * @protected Projected `mlv-breadcrumb-item` elements from content.
   * Used when the component is operated in projected mode instead of data-driven.
   */
  protected readonly _projectedItems = contentChildren(MlvBreadcrumbItem);

  /** @protected Ellipsis trigger used to restore focus after keyboard close. */
  protected readonly _overflowTriggerRef =
    viewChild<HTMLButtonElement>('overflowTrigger');

  /**
   * @private The focusable overflow-popover link elements, in DOM order. They are
   * rendered by this component's own template (inside `mlvPopupContent`), so a
   * signal view query resolves them — even though the popover content renders in
   * a detached overlay. Replaces a `getElementById` + `querySelectorAll` lookup.
   */
  private readonly _overflowNavItems = viewChildren('overflowNavItem', {
    read: ElementRef,
  });

  /** @protected Stable id applied to the overflow list element (menu container). */
  protected readonly _overflowListId = mlvNextId('mlv-breadcrumb-overflow');

  /**
   * @protected The computed visible items for data-driven mode, with overflow applied.
   * Returns the full list when `maxItems` is 0 or not set.
   */
  protected readonly _visibleItems = computed<
    Array<MlvBreadcrumbEntry & { _isEllipsis?: boolean }>
  >(() => {
    const allItems = this.items();
    const max = this.maxItems();

    if (!allItems.length || max <= 0 || allItems.length <= max) {
      return allItems;
    }

    // Always show at least first and last item
    const effectiveMax = Math.max(max, 2);
    const totalCount = allItems.length;

    if (effectiveMax >= totalCount) {
      return allItems;
    }

    // effectiveMax includes the ellipsis as one slot.
    // Available visible item slots after reserving first, ellipsis, and last:
    const firstCount = 1;
    const lastCount = 1;
    const ellipsisCount = 1;
    const middleSlots = effectiveMax - firstCount - ellipsisCount - lastCount;

    if (middleSlots <= 0) {
      // Only show first, ellipsis, last
      return [
        allItems[0],
        { label: '…', _isEllipsis: true },
        allItems[totalCount - 1],
      ];
    }

    const lastStart = totalCount - lastCount;
    const visibleMiddle = allItems.slice(firstCount, firstCount + middleSlots);

    return [
      ...allItems.slice(0, firstCount),
      { label: '…', _isEllipsis: true },
      ...visibleMiddle,
      ...allItems.slice(lastStart),
    ];
  });

  /**
   * @protected The hidden items that are collapsed behind the ellipsis.
   * These are shown in the popover when the ellipsis button is clicked.
   */
  protected readonly _hiddenItems = computed<MlvBreadcrumbEntry[]>(() => {
    const allItems = this.items();
    const max = this.maxItems();

    if (!allItems.length || max <= 0 || allItems.length <= max) {
      return [];
    }

    const effectiveMax = Math.max(max, 2);
    const totalCount = allItems.length;

    if (effectiveMax >= totalCount) {
      return [];
    }

    const firstCount = 1;
    const lastCount = 1;
    const ellipsisCount = 1;
    const middleSlots = effectiveMax - firstCount - ellipsisCount - lastCount;

    if (middleSlots <= 0) {
      // All middle items are hidden (exclude first and last)
      return allItems.slice(firstCount, totalCount - lastCount);
    }

    // The items shown in the ellipsis are those NOT shown in _visibleItems
    // visible middle is: allItems[firstCount .. firstCount + middleSlots - 1]
    // so hidden middle is: allItems[firstCount + middleSlots .. totalCount - lastCount - 1]
    return allItems.slice(firstCount + middleSlots, totalCount - lastCount);
  });

  /**
   * @protected Whether the component is used in data-driven mode (items provided via input).
   * When false, rendered items come from projected `<mlv-breadcrumb-item>` elements.
   */
  protected readonly _isDataDriven = computed(() => this.items().length > 0);

  /**
   * @protected Moves focus to the first actionable item after the overflow popup opens.
   */
  protected _focusFirstOverflowItem(): void {
    queueMicrotask(() => {
      this._focusOverflowItem(0);
    });
  }

  /**
   * @protected Handles arrow-key navigation within the overflow popup.
   */
  protected _onOverflowKeydown(event: KeyboardEvent, popup: MlvPopup): void {
    const items = this._overflowItemElements();
    if (!items.length) return;

    const currentIndex = items.indexOf(
      this._document.activeElement as HTMLElement,
    );
    const activeIndex = currentIndex >= 0 ? currentIndex : 0;
    let nextIndex = activeIndex;

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case DOWN_ARROW:
      case RIGHT_ARROW:
        nextIndex = (activeIndex + 1) % items.length;
        break;
      case UP_ARROW:
      case LEFT_ARROW:
        nextIndex = (activeIndex - 1 + items.length) % items.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = items.length - 1;
        break;
      case 'Escape':
        event.preventDefault();
        popup.opened.set(false);
        this._overflowTriggerRef()?.focus();
        return;
      default:
        return;
    }

    event.preventDefault();
    items[nextIndex]?.focus();
  }

  /**
   * @protected Closes the overflow popup after an item is activated.
   */
  protected _closeOverflowPopup(popup: MlvPopup): void {
    popup.opened.set(false);
  }

  /**
   * @private Focuses an overflow item by index when it exists.
   */
  private _focusOverflowItem(index: number): void {
    this._overflowItemElements()[index]?.focus();
  }

  /**
   * @private Returns currently rendered focusable overflow item elements.
   */
  private _overflowItemElements(): HTMLElement[] {
    return this._overflowNavItems().map((ref) => ref.nativeElement);
  }
}
