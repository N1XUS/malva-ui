import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  ElementRef,
  forwardRef,
  HostAttributeToken,
  inject,
  input,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
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
import { MLV_BREADCRUMB } from './breadcrumb-token';
import type { MlvBreadcrumbAccessor } from './breadcrumb-token';
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
 * @internal One slot of the rendered data-driven trail: a crumb, or the
 * ellipsis standing in for the collapsed run.
 */
type BreadcrumbTrailSlot = MlvBreadcrumbEntry & { _isEllipsis?: boolean };

/** @internal The data-driven trail split by `maxItems`. */
interface BreadcrumbTrailSplit {
  /** Slots rendered in the `<ol>`, the ellipsis included, in trail order. */
  readonly visible: readonly BreadcrumbTrailSlot[];
  /** Crumbs collapsed behind the ellipsis, in trail order. */
  readonly hidden: readonly MlvBreadcrumbEntry[];
}

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
 * 2. **Projected** — nest `<mlv-breadcrumb-item>` elements directly (or native
 *    `<li mlvBreadcrumbItem>`s — never inside an `<ol>` of your own; this
 *    component renders the list). Use **one shape per trail**: separators are
 *    placed between `<mlv-breadcrumb-item>`s only, so an `<li mlvBreadcrumbItem>`
 *    after them is not separated from the last one. Declare the items in the
 *    same template as the `<nav>`; a wrapper component re-projecting them
 *    through its own `<ng-content>` is not supported (see `MlvBreadcrumbItem`).
 *
 * The separator can be customised by placing `<ng-template mlvSeparator>` inside
 * the `<nav>`. When no separator directive is present, a `LucideChevronRight` icon
 * is used as the default. Both modes render it after every crumb but the last:
 * data-driven `<li>`s and projected `<mlv-breadcrumb-item>`s alike.
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
  // Published for projected `<mlv-breadcrumb-item>`s, which render the gap
  // after themselves from this breadcrumb's separator template (#325). The
  // token is internal and not exported from the barrel.
  providers: [
    { provide: MLV_BREADCRUMB, useExisting: forwardRef(() => MlvBreadcrumb) },
  ],
  host: {
    class: 'mlv-breadcrumb',
    role: 'navigation',
    '[attr.aria-label]': '_landmarkLabel()',
  },
})
export class MlvBreadcrumb implements MlvBreadcrumbAccessor {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_BREADCRUMB_I18N);

  /**
   * @private The `aria-label` a consumer wrote directly on the `<nav>`,
   * captured before the host binding runs. The binding owns the attribute, so
   * without this capture it would overwrite the consumer's name on the first
   * change detection. `null` for a `createComponent(…, { hostElement })` root
   * host, whose attributes the token never sees.
   */
  private readonly _hostAriaLabel = inject(
    new HostAttributeToken('aria-label'),
    { optional: true },
  );

  /**
   * Accessible name of the `navigation` landmark.
   *
   * Set it whenever a page renders more than one breadcrumb (or another
   * `navigation` landmark), so assistive technology can tell them apart. When
   * unset or empty, a static `aria-label` written on the `<nav>` is used, then
   * the localized `MLV_BREADCRUMB_I18N.label` ("Breadcrumb"). Bind this input
   * rather than `[attr.aria-label]`, which races the host binding.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * @protected The landmark's `aria-label`: {@link ariaLabel}, else the static
   * host attribute, else the localized default.
   */
  protected readonly _landmarkLabel = computed(
    () => this.ariaLabel() || this._hostAriaLabel || this._i18n().label,
  );

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
   * Maximum number of items to display before truncating, the ellipsis
   * counting as one.
   * When the total count exceeds this value, the middle items are collapsed
   * into an ellipsis (`…`) button placed right after the first item; the
   * remaining slots show the items nearest the current page, so the trail
   * keeps its order (`Home › … › Frontend › Components`). Clicking the button
   * opens a popover listing all hidden items, in trail order. Always shows the
   * first and last items. A fractional value never shows more items than it
   * allows, and `NaN` disables truncation.
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
   * @protected Projected `mlv-breadcrumb-item` elements from content, in
   * document order — `@for` / `@if` blocks and `<ng-container>` wrappers
   * included. Used when the component is operated in projected mode instead
   * of data-driven, to tell which crumb is last.
   */
  protected readonly _projectedItems = contentChildren(MlvBreadcrumbItem);

  /**
   * @internal The separator template both modes stamp — declared once in
   * `breadcrumb.html` as `#separator`. Read by projected crumbs through
   * `MLV_BREADCRUMB`; see {@link MlvBreadcrumbAccessor._separatorTemplate}.
   */
  readonly _separatorTemplate = viewChild<TemplateRef<unknown>>('separator');

  /**
   * @internal The last projected crumb, the one with no separator after it.
   * See {@link MlvBreadcrumbAccessor._lastProjectedItem}.
   */
  readonly _lastProjectedItem = computed<MlvBreadcrumbItem | undefined>(() => {
    const items = this._projectedItems();
    return items[items.length - 1];
  });

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
   * @private The data-driven trail split by `maxItems` into the slots rendered
   * in the `<ol>` and the crumbs collapsed behind the ellipsis. One
   * computation, so the two halves cannot disagree about where the cut falls —
   * two parallel copies of this arithmetic did, and put the ellipsis before
   * crumbs that come earlier in the path than the ones it hid (#316).
   *
   * The cut keeps document order: the ellipsis stands in for one contiguous
   * run straight after the first crumb, and every slot left over once the
   * first crumb, the ellipsis and the current page are placed goes to the
   * crumbs just before the current page — the nearest ancestors, the likeliest
   * "up" targets. Putting `hidden` back where the ellipsis sits yields `items`
   * unchanged.
   */
  private readonly _split = computed<BreadcrumbTrailSplit>(() => {
    const allItems = this.items();
    const max = this.maxItems();
    // The first and the last crumb always show, so the budget never drops
    // below two slots.
    const budget = Math.max(max, 2);

    // `!(max > 0)` rather than `max <= 0`, so a `NaN` budget (a computed
    // binding such as `width() / 120` can yield one) truncates nothing.
    if (!(max > 0) || allItems.length <= budget) {
      return { visible: allItems, hidden: [] };
    }

    // One slot each for the first crumb, the ellipsis and the current page.
    // A budget of 2 cannot hold all three and still renders them: collapsing
    // stops at `first › … › last`. Slots are whole, so a fractional budget
    // rounds down — `slice()` would otherwise round the tail up and render
    // more crumbs than `maxItems` allows.
    const tailSlots = Math.max(Math.floor(budget) - 3, 0);
    const tailStart = allItems.length - 1 - tailSlots;

    return {
      visible: [
        allItems[0],
        { label: '…', _isEllipsis: true },
        ...allItems.slice(tailStart),
      ],
      hidden: allItems.slice(1, tailStart),
    };
  });

  /**
   * @protected The slots rendered in the trail for data-driven mode, in trail
   * order: the full list when nothing collapses, otherwise the first crumb,
   * the ellipsis, then the crumbs nearest the current page.
   */
  protected readonly _visibleItems = computed(() => this._split().visible);

  /**
   * @protected The crumbs collapsed behind the ellipsis, in trail order — the
   * run between the first crumb and the first crumb shown after the ellipsis.
   * Listed in the popover when the ellipsis button is clicked.
   */
  protected readonly _hiddenItems = computed(() => this._split().hidden);

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
