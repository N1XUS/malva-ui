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
  signal,
  untracked,
  viewChild,
  viewChildren,
  ViewEncapsulation,
  type AfterViewInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { fromEvent, take } from 'rxjs';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  clamp,
  MlvRtlService,
  provideMlvScopedDirectionality,
} from '@malva-ui/cdk/utils';

/** The axis a {@link MlvScrubber} scrolls along. */
export type MlvScrubberOrientation = 'vertical' | 'horizontal';

/** @private Monotonic counter backing per-instance option element ids. */
let nextScrubberId = 0;

/**
 * A one-dimensional scroll-snap selector — the "drum roll" primitive.
 *
 * Renders a `<ul>` backed by `@angular/aria`'s headless `ngListbox`/`ngOption`
 * pattern in **`focusMode="activedescendant"`** — focus stays on the `<ul>`
 * container while `aria-activedescendant` tracks the active item. aria owns the
 * roles (`listbox`/`option`), `aria-selected`, `aria-activedescendant`, roving
 * `aria-activedescendant`, and all keyboard navigation (Arrow keys with wrap,
 * Home/End and additive type-ahead, each selecting as it moves). Enter / Space
 * are bound only in `'explicit'` selection mode — an empty strip that has
 * never had focus (see `_selectionMode`); aria leaves them unbound when
 * selection follows focus.
 *
 * The CSS scroll-snap **drum-roll** UX is retained on top of aria: in
 * `activedescendant` mode aria never moves DOM focus and never scrolls (its
 * `scrollActiveItemIntoView()` is opt-in and is not called here), so it cannot
 * fight the snap scrolling. Programmatic scroll (on external value change) and
 * pointer/wheel scroll-to-select stay component-owned; on a scroll-driven change
 * the aria active item is re-synced via {@link Listbox.gotoIndex} so a following
 * Arrow key moves from the centred value rather than a stale one.
 */
@Component({
  selector: 'mlv-scrubber',
  templateUrl: './scrubber.html',
  styleUrl: './scrubber.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Listbox, Option],
  // `@angular/aria`'s `Listbox` (`<ul ngListbox>` in this template) injects the
  // CDK `Directionality` to pick which horizontal arrow means *next*; the
  // scoped provider keeps it in step with the strip's own scroll maths inside a
  // `[dir]` subtree. Nothing is projected, so `providers` and `viewProviders`
  // reach the same nodes here.
  providers: [provideMlvScopedDirectionality()],
  host: {
    class: 'mlv-scrubber',
    '[class]': '"mlv-scrubber--" + orientation()',
  },
})
export class MlvScrubber<T> implements AfterViewInit {
  /** The accessible label for the strip (e.g. "Hours", "Year"). */
  readonly label = input.required<string>();

  /**
   * The values to display, in scroll order. Values must be distinct — they are
   * both the `@for` track key and aria's option identity.
   */
  readonly items = input.required<readonly T[]>();

  /**
   * The currently selected value — one of {@link items}, or `null` for **no
   * selection**.
   *
   * With `null`, no option is `aria-selected`, the strip does not scroll (it
   * rests on its first item when first rendered, and stays where it is when a
   * selection is removed), and activating any item emits it — the resting one
   * included, since there is nothing for it to echo. `null` is therefore
   * reserved: it cannot also be an item.
   */
  readonly selectedValue = input.required<T | null>();

  /**
   * The axis the strip scrolls along. `'vertical'` is the classic drum roll;
   * `'horizontal'` puts it on the **inline** axis, so it mirrors under `dir="rtl"`.
   */
  readonly orientation = input<MlvScrubberOrientation>('vertical');

  /**
   * Formats an item for display — the visible text of the option and the term
   * aria's type-ahead searches. Defaults to `String(value)`.
   *
   * The zero-padded two-digit numeral the drum used to render unconditionally
   * is a *consumer's* format (the time picker passes it here), not a behaviour
   * of the strip: a year strip wants `2078`, a month strip a localised name.
   */
  readonly displayWith = input<(item: T) => string>((item) => String(item));

  /** Whether the strip is disabled. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emitted when the user selects a new value via scroll, click, or keyboard. */
  readonly valueChange = output<T>();

  /** @private Reference to the scrollable list element. */
  private readonly _listRef =
    viewChild<ElementRef<HTMLUListElement>>('listRef');

  /**
   * @private The component's own `@for`-rendered `<li>` option elements, in DOM
   * order. A signal view query rather than a `querySelectorAll` over the host —
   * the items belong to this component's template.
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

  /** @private Prefix for this instance's option element ids. */
  private readonly _idPrefix = `mlv-scrubber-${nextScrubberId++}`;

  /** @private Host element; the scope direction resolves against. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private The direction applying to this host, following the global
   * direction and any `[dir]` scope above it. Only the inline axis reads it —
   * a vertical strip is on the block axis and never mirrors.
   */
  private readonly _direction = inject(MlvRtlService).elementDirection(
    this._elementRef,
  );

  /** @protected Whether the strip scrolls along the inline axis. */
  protected readonly _horizontal = computed(
    () => this.orientation() === 'horizontal',
  );

  /** @protected Rendered items, paired with their formatted labels. */
  protected readonly _displayItems = computed(() => {
    const format = this.displayWith();
    return this.items().map((value) => ({ value, label: format(value) }));
  });

  /**
   * @protected Bridges the scalar `selectedValue` input into aria's array-based
   * (`V[]`) single-select value model. Single-select always holds ≤1 entry;
   * `null` (no selection) is the empty array.
   */
  protected readonly _ariaValue = computed((): T[] => {
    const selected = this.selectedValue();
    return selected === null ? [] : [selected];
  });

  /**
   * @private Whether focus has entered the listbox — the moment aria's own
   * `hasBeenInteracted` latches. Never reset.
   */
  private readonly _interacted = signal(false);

  /**
   * @protected aria's selection mode: `'follow'` (Arrow keys select), except
   * while the strip holds **no selection and has not yet been focused**.
   *
   * aria's `setDefaultState()` runs as an after-render effect until the
   * listbox is first focused, and in `'follow'` mode it **selects** the first
   * item whenever none is selected — so a `null` strip would pick its first
   * item on its own, and emit it, with no user input. In `'explicit'` mode the
   * same pass only makes the first item active. The first `focusin` flips the
   * strip to `'follow'` — by then aria's latch has stopped the default pass —
   * so every keyboard path behaves as before; a click selects in either mode.
   * A strip holding a value is `'follow'` from its first render, unchanged.
   */
  protected readonly _selectionMode = computed(() =>
    this.selectedValue() === null && !this._interacted()
      ? 'explicit'
      : 'follow',
  );

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

    // Latch `_interacted` on the first focus inside the strip. On the host, not
    // the `<ul>`, and from the constructor rather than `afterNextRender`: a
    // parent may focus the list mid-pass, before the list's own after-render
    // hook has run (`mlv-time-picker` does, through its popup's open handler),
    // and `focusin` bubbles from the list — or an option — to the host, which
    // holds nothing else.
    fromEvent(this._elementRef.nativeElement, 'focusin')
      .pipe(take(1), takeUntilDestroyed())
      .subscribe(() => this._interacted.set(true));

    // Sync the scroll position AND aria's active item when selectedValue
    // changes externally (forms value write, mode switch). gotoIndex only moves
    // the active descendant (no selection), so it never re-emits valueChange.
    // Without it, aria's active item would drift from the centred value once
    // the user has interacted (setDefaultState no longer re-syncs
    // post-interaction).
    //
    // It also depends on `_direction`: a horizontal strip's scroll offset is
    // physical, and mirroring moves the content without resizing it, so no
    // `ResizeObserver` fires and no query changes — nothing else would tell the
    // strip that its offset now points at the wrong item.
    //
    // No selection (`null`) scrolls nowhere: the strip stays where it is. A
    // programmatic scroll would come back through `_syncIndexFromScroll` and
    // select whatever item it landed on, 150ms later, with no user input.
    // For the same reason it drops a read-back still pending from a scroll
    // before the selection went away (a flick, then a form reset within
    // 150ms), which would otherwise commit the landed item right after the
    // reset. A pending read-back also dies with an item-list or direction
    // change while empty: the offset it measured no longer names the same
    // item.
    effect(() => {
      const items = this.items();
      const selected = this.selectedValue();
      this._direction();
      if (selected === null) {
        untracked(() => this._cancelScrollReadBack());
        return;
      }
      const idx = items.indexOf(selected);
      const newIdx = idx >= 0 ? idx : 0;
      untracked(() => {
        this._ariaListbox()?.gotoIndex(newIdx);
        this._scrollToIndex(newIdx, true);
      });
    });

    // Clears without nulling the handle: `scrubber.spec.ts` watches it to
    // prove no listener outlives the component.
    this._destroyRef.onDestroy(() => {
      if (this._scrollTimer) clearTimeout(this._scrollTimer);
    });
  }

  ngAfterViewInit(): void {
    const items = this.items();
    const selected = this.selectedValue();
    const idx = selected === null ? -1 : items.indexOf(selected);
    // No selection rests on the first item.
    const startIdx = idx >= 0 ? idx : 0;
    // Seed aria's active item to the selected value now that the options are
    // registered. aria's own `setDefaultState` is defeated once a consumer's
    // open handler focuses the list (focusin → hasBeenInteracted), so we can't
    // rely on it — without this, the active item stays `undefined` and the
    // first Arrow key navigates from index -1. Pinned by
    // `scrubber-a11y.spec.ts`, which focuses the strip from the host's own
    // `ngAfterViewInit` — mid-pass, before aria's effect has flushed, which is
    // exactly what `mlv-time-picker`'s open handler does through the popup.
    this._ariaListbox()?.gotoIndex(startIdx);
    this._scrollToIndex(startIdx, false);
  }

  /**
   * Focus the strip's listbox element.
   * Used by a parent for inter-strip keyboard navigation.
   */
  focusList(): void {
    this._listRef()?.nativeElement.focus();
  }

  /**
   * The strip's scrollable `<ul>` listbox element, or `null` before view init.
   * Exposed so a parent can identify which strip currently holds focus
   * (comparing against `document.activeElement`) without reaching into child
   * DOM by class name.
   */
  get listElement(): HTMLElement | null {
    return this._listRef()?.nativeElement ?? null;
  }

  /** @protected The DOM id of the option at `index`, unique per instance. */
  protected _optionId(index: number): string {
    return `${this._idPrefix}-${index}`;
  }

  /**
   * @protected Bridge aria's array `valueChange` back to the scalar output.
   * Guards against no-op echoes so a parent form control is only touched on
   * genuine changes.
   */
  protected _onAriaValueChange(values: readonly T[]): void {
    if (this.disabled()) return;
    const next = values[0];
    if (next === undefined) return;
    if (next !== this.selectedValue()) {
      this.valueChange.emit(next);
    }
  }

  /**
   * @private Binds the drum-roll scroll listener outside the template, as an
   * `rxjs` `fromEvent` stream, instead of through a `(scroll)` binding.
   *
   * A template listener runs inside Angular's
   * `wrapListenerIn_markDirtyAndPreventDefault` wrapper, which marks the
   * ancestor view chain dirty and notifies the change-detection scheduler on
   * every single event. This handler only resets a debounce timer — it writes
   * nothing reactive at all — so each of those passes was pure waste, at
   * momentum-scroll frequency. `fromEvent` registers a plain
   * `addEventListener`, with no such wrapper. `runOutsideAngular` keeps the
   * same guarantee for consumers still on zone-based change detection.
   *
   * `{ passive: true }` is forwarded to `addEventListener` — a non-passive
   * scroll listener is its own performance bug, so it is not optional here.
   *
   * `takeUntilDestroyed` takes the `DestroyRef` explicitly: this runs from an
   * `afterNextRender` callback, which is not an injection context.
   *
   * `#listRef` is unconditional in the template, so the element resolved here
   * lives for the component's whole lifetime.
   */
  private _registerScrollListener(): void {
    const listEl = this._listRef()?.nativeElement;
    if (!listEl) return;

    this._ngZone.runOutsideAngular(() => {
      fromEvent(listEl, 'scroll', { passive: true })
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => this._onScroll());
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

  /** @private Drops a pending scroll read-back, if any. */
  private _cancelScrollReadBack(): void {
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = null;
  }

  /**
   * @private Read the current scroll position and update the selected value.
   * Also re-aligns aria's active item so a subsequent Arrow key moves from the
   * centred value.
   */
  private _syncIndexFromScroll(): void {
    const listEl = this._listRef()?.nativeElement;
    if (!listEl) return;

    const items = this._itemEls();
    if (!items.length) return;

    const itemSize = this._itemSize(items[0].nativeElement);
    if (itemSize === 0) return;

    const closestIndex = Math.round(this._scrollOffset(listEl) / itemSize);
    const clampedIndex = clamp(closestIndex, 0, this.items().length - 1);
    const newValue = this.items()[clampedIndex];

    if (newValue !== this.selectedValue()) {
      // Keep aria's active item aligned with the scrolled position first, then
      // emit — selection flows back through selectedValue → _ariaValue.
      this._ariaListbox()?.gotoIndex(clampedIndex);
      this.valueChange.emit(newValue);
    }
  }

  /** @private The extent of one item along the scroll axis, in pixels. */
  private _itemSize(itemEl: HTMLElement): number {
    return this._horizontal() ? itemEl.offsetWidth : itemEl.offsetHeight;
  }

  /**
   * @private Distance already scrolled, measured from the **inline-start** (or
   * block-start) edge of the scrolling content — the one physical → logical
   * conversion, done once at the boundary.
   *
   * `scrollTop` is block-axis and never mirrors. `scrollLeft` is physical: per
   * CSSOM-View an RTL scroller reports `0` at its inline-start (right) edge and
   * counts **down** toward the end, so the raw value has to be negated to
   * become a distance.
   */
  private _scrollOffset(listEl: HTMLElement): number {
    if (!this._horizontal()) return listEl.scrollTop;
    return this._direction() === 'rtl' ? -listEl.scrollLeft : listEl.scrollLeft;
  }

  /**
   * @private Whether the user has asked for reduced motion.
   *
   * Read here rather than left to CSS. `mixins.reduced-motion` emits
   * `scroll-behavior: auto !important` across the block, but per CSSOM-View an
   * explicit `behavior` passed to `scrollTo()` **overrides** the computed
   * `scroll-behavior` — the property is only consulted for `behavior: 'auto'`.
   * So a hardcoded `'smooth'` animates the drum however loudly the stylesheet
   * says otherwise, and the media query has to be resolved at the call site to
   * mean anything.
   *
   * Guarded for SSR the same way `mlv-tiles` guards its own reduced-motion
   * read: there is no `matchMedia` on the server, and `_scrollToIndex` runs
   * from `ngAfterViewInit`, which does execute there.
   */
  private _prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * @private Scroll the list to bring the item at the given index onto the
   * centre stripe.
   * @param index - The index to scroll to.
   * @param smooth - Whether to animate the scroll. Downgraded to an instant
   *   jump under `prefers-reduced-motion: reduce`.
   */
  private _scrollToIndex(index: number, smooth: boolean): void {
    const listEl = this._listRef()?.nativeElement;
    if (!listEl) return;

    const targetItem = this._itemEls()[index]?.nativeElement;
    if (!targetItem) return;

    const offset = index * this._itemSize(targetItem);
    const behavior: ScrollBehavior =
      smooth && !this._prefersReducedMotion() ? 'smooth' : 'instant';

    if (!this._horizontal()) {
      if (typeof listEl.scrollTo === 'function') {
        listEl.scrollTo({ top: offset, behavior });
      } else {
        listEl.scrollTop = offset;
      }
      return;
    }

    // The inverse of `_scrollOffset`: a logical distance back to a physical
    // `scrollLeft`, which is negative throughout an RTL scroller's range.
    const left = this._direction() === 'rtl' ? -offset : offset;
    if (typeof listEl.scrollTo === 'function') {
      listEl.scrollTo({ left, behavior });
    } else {
      listEl.scrollLeft = left;
    }
  }
}
