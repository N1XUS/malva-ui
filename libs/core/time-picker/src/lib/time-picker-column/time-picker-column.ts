import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  untracked,
  viewChild,
  viewChildren,
  ViewEncapsulation,
  type AfterViewInit,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { Listbox, Option } from '@angular/aria/listbox';
import { clamp } from '@malva-ui/cdk/utils';

/**
 * A single scrollable column for the time picker (hours, minutes, seconds).
 *
 * Renders a `<ul>` backed by `@angular/aria`'s headless `ngListbox`/`ngOption`
 * pattern in **`focusMode="activedescendant"`** — focus stays on the `<ul>`
 * container while `aria-activedescendant` tracks the active item. aria owns the
 * roles (`listbox`/`option`), `aria-selected`, `aria-activedescendant`, roving
 * `aria-activedescendant`, and all keyboard navigation (ArrowUp/Down wrap,
 * Home/End, Enter/Space, and additive type-ahead).
 *
 * The CSS scroll-snap **drum-roll** UX is retained on top of aria: in
 * `activedescendant` mode aria never moves DOM focus and never scrolls (its
 * `scrollActiveItemIntoView()` is opt-in and is not called here), so it cannot
 * fight the snap scrolling. Programmatic scroll (on external value change) and
 * pointer/wheel scroll-to-select stay component-owned; on a scroll-driven change
 * the aria active item is re-synced via {@link Listbox.gotoIndex} so a following
 * Arrow key moves from the centered value rather than a stale one.
 *
 * @internal This component is not part of the public API and should not be used directly.
 */
@Component({
  selector: 'mlv-time-picker-column',
  templateUrl: './time-picker-column.html',
  styleUrl: './time-picker-column.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Listbox, Option],
  host: {
    class: 'mlv-time-picker-column',
  },
})
export class MlvTimePickerColumn implements AfterViewInit {
  /** The accessible label for the column (e.g. "Hours", "Minutes"). */
  readonly label = input.required<string>();

  /** The list of numeric values to display in the column. */
  readonly items = input.required<number[]>();

  /** The currently selected value in this column. */
  readonly selectedValue = input.required<number>();

  /** Whether the column is disabled. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emitted when the user selects a new value via scroll, click, or keyboard. */
  readonly valueChange = output<number>();

  /** @private Reference to the scrollable list element. */
  private readonly _listRef =
    viewChild<ElementRef<HTMLUListElement>>('listRef');

  /**
   * @private The component's own `@for`-rendered `<li>` option elements, in DOM
   * order. Replaces `querySelectorAll('.mlv-time-picker-column__item')` over the
   * host — the items belong to this component's template, so a signal view query
   * is the correct mechanism.
   */
  private readonly _itemEls = viewChildren('itemRef', { read: ElementRef });

  /**
   * @private The aria `Listbox` instance on the `<ul>`. Used to keep aria's
   * internal active item aligned with the drum-roll scroll position.
   */
  private readonly _ariaListbox = viewChild(Listbox);

  /** @private DestroyRef for cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Zone reference; the scroll listener is registered outside it. */
  private readonly _ngZone = inject(NgZone);

  /** @protected Sanitized label key for use in element IDs (spaces replaced with hyphens). */
  protected readonly _labelKey = computed(() =>
    this.label().toLowerCase().replace(/\s+/g, '-'),
  );

  /** @protected Formatted display items (zero-padded two digits). */
  protected readonly _displayItems = computed(() =>
    this.items().map((v) => ({ value: v, label: String(v).padStart(2, '0') })),
  );

  /**
   * @protected Bridges the scalar `selectedValue` input into aria's array-based
   * (`V[]`) single-select value model. Single-select always holds ≤1 entry.
   */
  protected readonly _ariaValue = computed(() => [this.selectedValue()]);

  /**
   * @protected Listbox tabindex. Forced to `-1` when disabled to preserve the
   * historical contract; otherwise `undefined` so aria's pattern manages it
   * (`0` in activedescendant mode — the container is the tab stop).
   */
  protected readonly _listboxTabIndex = computed(() =>
    this.disabled() ? -1 : undefined,
  );

  /** @private Timer ID for scroll debounce. */
  private _scrollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => this._registerScrollListener());

    // Sync the drum scroll AND aria's active item when selectedValue changes
    // externally (forms value write, mode switch). gotoIndex only moves the active
    // descendant (no selection), so it never re-emits valueChange. Without it,
    // aria's active item would drift from the centered value once the user has
    // interacted (setDefaultState no longer re-syncs post-interaction).
    effect(() => {
      const items = this.items();
      const selected = this.selectedValue();
      const idx = items.indexOf(selected);
      const newIdx = idx >= 0 ? idx : 0;
      untracked(() => {
        this._ariaListbox()?.gotoIndex(newIdx);
        this._scrollToIndex(newIdx, true);
      });
    });

    this._destroyRef.onDestroy(() => {
      if (this._scrollTimer) clearTimeout(this._scrollTimer);
    });
  }

  ngAfterViewInit(): void {
    const items = this.items();
    const idx = items.indexOf(this.selectedValue());
    const startIdx = idx >= 0 ? idx : 0;
    // Seed aria's active item to the selected value now that the options are
    // registered. aria's own `setDefaultState` is defeated once the popup's
    // open handler focuses the list (focusin → hasBeenInteracted), so we can't
    // rely on it — without this, the active item stays `undefined` and the
    // first Arrow key navigates from index -1.
    this._ariaListbox()?.gotoIndex(startIdx);
    this._scrollToIndex(startIdx, false);
  }

  /**
   * Focus the column's listbox element.
   * Used by the parent component for inter-column keyboard navigation.
   */
  focusList(): void {
    this._listRef()?.nativeElement.focus();
  }

  /**
   * The column's scrollable `<ul>` listbox element, or `null` before view init.
   * Exposed so the parent time picker can identify which column currently holds
   * focus (comparing against `document.activeElement`) when moving focus between
   * columns, without reaching into child DOM by class name.
   */
  get listElement(): HTMLElement | null {
    return this._listRef()?.nativeElement ?? null;
  }

  /**
   * @protected Bridge aria's array `valueChange` back to the scalar output.
   * Guards against no-op echoes so the parent form control is only touched on
   * genuine changes.
   */
  protected _onAriaValueChange(values: number[]): void {
    if (this.disabled()) return;
    const next = values[0];
    if (next === undefined) return;
    if (next !== this.selectedValue()) {
      this.valueChange.emit(next);
    }
  }

  /**
   * @private Binds the drum-roll scroll listener natively instead of through a
   * `(scroll)` binding in the template.
   *
   * A template listener runs inside Angular's
   * `wrapListenerIn_markDirtyAndPreventDefault` wrapper, which marks the
   * ancestor view chain dirty and notifies the change-detection scheduler on
   * every single event. This handler only resets a debounce timer — it writes
   * nothing reactive at all — so each of those passes was pure waste, at
   * momentum-scroll frequency. `runOutsideAngular` keeps the same guarantee for
   * consumers still on zone-based change detection.
   *
   * The debounced `_syncIndexFromScroll()` does not need the zone either: it
   * only writes aria's active-item signal and emits the `valueChange` output.
   * Angular wraps a parent's output binding in the very same listener wrapper,
   * so the emit still marks the parent dirty and notifies the scheduler no
   * matter which zone it was raised from.
   *
   * `#listRef` is unconditional in the template, so the element resolved here
   * lives for the component's whole lifetime.
   */
  private _registerScrollListener(): void {
    const listEl = this._listRef()?.nativeElement;
    if (!listEl) return;

    const onScroll = (): void => this._onScroll();
    this._ngZone.runOutsideAngular(() => {
      listEl.addEventListener('scroll', onScroll, { passive: true });
    });
    this._destroyRef.onDestroy(() => {
      listEl.removeEventListener('scroll', onScroll);
    });
  }

  /**
   * @private Handle scroll events — debounced to avoid fighting with CSS
   * scroll-snap during large swipes. aria attaches no scroll listener of its
   * own, so this remains the sole owner of scroll-driven selection.
   */
  private _onScroll(): void {
    if (this.disabled()) return;
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      this._syncIndexFromScroll();
    }, 150);
  }

  /**
   * @private Read the current scroll position and update the selected value.
   * Also re-aligns aria's active item so a subsequent Arrow key moves from the
   * centered value.
   */
  private _syncIndexFromScroll(): void {
    const listEl = this._listRef()?.nativeElement;
    if (!listEl) return;

    const items = this._itemEls();
    if (!items.length) return;

    const itemHeight = items[0].nativeElement.offsetHeight;
    if (itemHeight === 0) return;

    const scrollTop = listEl.scrollTop;
    const closestIndex = Math.round(scrollTop / itemHeight);
    const clampedIndex = clamp(closestIndex, 0, this.items().length - 1);
    const newValue = this.items()[clampedIndex];

    if (newValue !== this.selectedValue()) {
      // Keep aria's active item aligned with the scrolled position first, then
      // emit — selection flows back through selectedValue → _ariaValue.
      this._ariaListbox()?.gotoIndex(clampedIndex);
      this.valueChange.emit(newValue);
    }
  }

  /**
   * @private Scroll the list to bring item at the given index into view.
   * @param index - The index to scroll to.
   * @param smooth - Whether to use smooth scroll behavior.
   */
  private _scrollToIndex(index: number, smooth: boolean): void {
    const listEl = this._listRef()?.nativeElement;
    if (!listEl) return;

    const targetItem = this._itemEls()[index]?.nativeElement;
    if (!targetItem) return;

    const itemHeight = targetItem.offsetHeight;
    const scrollTop = index * itemHeight;

    if (typeof listEl.scrollTo === 'function') {
      listEl.scrollTo({
        top: scrollTop,
        behavior: smooth ? 'smooth' : 'instant',
      });
    } else {
      listEl.scrollTop = scrollTop;
    }
  }
}
