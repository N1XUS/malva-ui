import { NgTemplateOutlet } from '@angular/common';
import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  afterRenderEffect,
  computed,
  contentChild,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MlvTabbableElementService } from '@malva-ui/cdk/accessibility';
import {
  MlvAutofocus,
  MlvResizeObserverFactory,
  mlvNextId,
} from '@malva-ui/cdk/utils';
import {
  MlvPopup,
  MlvPopupContainer,
  MlvPopupContent,
} from '@malva-ui/core/popup';
import type { MlvItemsMoreItem } from '../item/item';
import { MlvItemsMoreTriggerDef } from '../items-more.directives';
import { MlvItemsMoreSlot } from '../items-more-slot';
import type { MlvItemsMoreAccessor } from '../items-more-token';
import { MLV_ITEMS_MORE } from '../items-more-token';
import { MlvItemsMoreService } from '../items-more.service';
import type { MlvOverflowCandidate } from '../overflow-fit';
import { MLV_FIT_EPSILON_PX, computeHiddenFlags } from '../overflow-fit';

/** @private A computed split and the row width it was computed against. */
interface MlvItemsMoreSplit {
  readonly hidden: ReadonlySet<MlvItemsMoreItem>;
  readonly available: number;
}

/**
 * @private A reveal, remembered long enough to notice that its own render
 * undid it.
 */
interface MlvItemsMoreReveal {
  /** `Date.now()` when the reveal was committed. */
  readonly at: number;
  /** Row width the reveal was computed against. */
  readonly available: number;
  /** How many items were still withheld after it. */
  readonly hiddenCount: number;
}

/**
 * @private The box a split took out from under keyboard focus: a withheld
 * item's slot, or the in-row trigger that left with the last withheld item.
 */
type MlvItemsMoreFocusLoss =
  | { readonly removed: 'item'; readonly item: MlvItemsMoreItem }
  | { readonly removed: 'trigger' };

/**
 * A row that withholds what does not fit and offers it behind a "show more"
 * control.
 *
 * The row is declarative: each `<mlv-items-more-item>` says how it looks in
 * the row (`mlvItemsMoreVisible`) and, optionally, how it looks collapsed
 * (`mlvItemsMoreHidden`). An item with no collapsed form is pinned — see
 * `MlvItemsMoreHiddenDef`. The overflow control's appearance comes from
 * `mlvItemsMoreTriggerDef`, its behaviour from `[mlvItemsMoreTrigger]`, which
 * may sit inside that template or anywhere else the consumer wants it.
 *
 * ## What it guarantees
 *
 * **It never withholds an item that fits.** Every committed split is exact
 * arithmetic over measured widths — the items' own and, when the trigger is in
 * the row, the trigger's. Until all of those exist the row commits nothing and
 * renders everything, so the worst an unmeasured frame can do is clip; it
 * cannot relocate a control the reader was about to press. That is the
 * difference between this and the "reserve 100px for the More button" shape
 * it grew out of, which withholds an item whenever the real trigger is
 * narrower than the guess.
 *
 * There is deliberately **no hysteresis band**. A band is a range of widths in
 * which an item that fits stays withheld, which is the defect by another
 * name. What a band usually buys — a row that cannot oscillate — is bought
 * here by the oscillation guard instead ({@link _revealGuard}), which engages
 * only once a reveal has provably undone itself.
 *
 * **It does not break while you resize.** Hiding is applied as soon as a
 * resize is observed; revealing waits for {@link _REVEAL_DEBOUNCE_MS} of
 * quiet. A row that is late to hide is overflowing, which the row clips
 * rather than lets spill into its neighbours; a row that is late to reveal
 * has some room to spare at the end, which is indistinguishable from a row
 * that is simply not full.
 *
 * **A split hands keyboard focus on.** A split that removes the focused box
 * of the row — a withheld item, or the in-row trigger leaving with the last
 * withheld item — destroys the element the reader is standing on, and the
 * browser drops focus to `<body>`. The row puts it on the trigger or on an
 * item still in the row instead — see {@link _handOffFocus}. Three cases
 * still drop it: a reveal while the panel is open that returns the focused
 * panel item (the panel stays open); a row with no trigger of its own and
 * nothing focusable left in it; and a consumer-placed trigger that the
 * consumer's own `@if` removes on a full reveal, which the row cannot see.
 *
 * **It measures cheaply.** Widths are cached per item and refreshed from the
 * row's own boxes on each resize notification, so a steady-state resize is a
 * `ResizeObserver` callback, one `getComputedStyle`, a handful of rect reads
 * against an already-clean layout, and arithmetic over an array — never a
 * pass that expands the row to re-measure, which is both a layout thrash and
 * a visible flash.
 */
@Component({
  selector: 'mlv-items-more',
  templateUrl: './items-more.html',
  styleUrl: './items-more.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    MlvPopup,
    MlvPopupContainer,
    MlvPopupContent,
    MlvAutofocus,
    MlvItemsMoreSlot,
  ],
  providers: [
    MlvItemsMoreService,
    { provide: MLV_ITEMS_MORE, useExisting: MlvItemsMore },
  ],
  host: { class: 'mlv-items-more' },
})
export class MlvItemsMore implements MlvItemsMoreAccessor {
  /**
   * @private Trailing debounce (ms) applied to *revealing* an item. Hiding is
   * not debounced at all.
   */
  private static readonly _REVEAL_DEBOUNCE_MS = 64;

  /**
   * @private How soon (ms) after a reveal a hide must follow for the pair to
   * count as the reveal undoing itself. Long enough to cover the render and
   * the layout the reveal causes — a couple of frames — and short enough that
   * a person reversing a window drag does not trip it.
   */
  private static readonly _OSCILLATION_WINDOW_MS = 100;

  /** @private The row's own registry and split state. */
  private readonly _service = inject(MlvItemsMoreService);

  /**
   * @private DI seam for the platform `ResizeObserver`. `create()` answers
   * `null` where the constructor is absent — server rendering — so the split
   * simply never engages there and every item renders, which is the correct
   * server payload: the server cannot know the viewport, and a row that
   * withheld items on the server would hydrate with controls missing.
   */
  private readonly _resizeObserverFactory = inject(MlvResizeObserverFactory);

  /** @private For teardown of the observer and the debounce timer. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Scopes the post-close focus hand-off to this component. */
  private readonly _injector = inject(Injector);

  /** @private Where focus is read from when the panel closes. */
  private readonly _document = inject(DOCUMENT);

  /** @private Finds a focusable element in a returned item. */
  private readonly _tabbable = inject(MlvTabbableElementService);

  /**
   * Accessible name for the overflow panel. When set, the panel is a named
   * `role="group"`; when unset it carries no role at all, because an unnamed
   * group tells a reader nothing it did not already know from the contents.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /** @protected Appearance of the overflow trigger, supplied by the consumer. */
  protected readonly _triggerDef = contentChild(MlvItemsMoreTriggerDef);

  /** @protected The row element — the width every fit is measured against. */
  protected readonly _rowRef = viewChild<ElementRef<HTMLElement>>('rowRef');

  /** @protected One box per rendered item, each naming the item it renders. */
  protected readonly _slots = viewChildren(MlvItemsMoreSlot);

  /** @protected The in-row overflow trigger's box, while one is rendered. */
  protected readonly _triggerRef =
    viewChild<ElementRef<HTMLElement>>('triggerRef');

  /**
   * @protected An off-flow copy of the trigger, rendered while nothing is
   * withheld. See {@link _triggerWidth}.
   */
  protected readonly _triggerProbeRef =
    viewChild<ElementRef<HTMLElement>>('triggerProbeRef');

  /** @protected The overlay host for the panel. */
  protected readonly _panelContainer = viewChild(MlvPopupContainer);

  /** @protected The panel popup, whose `opened` signal is the panel's state. */
  protected readonly _popup = viewChild(MlvPopup);

  /**
   * @private Natural in-row width of each item, keyed by the item instance.
   *
   * A signal so the width a split was computed from is always the one on
   * record; rewritten as a new `Map` only when a value actually changes. `n`
   * is the number of controls in one row, so the copy is not a cost worth an
   * escape hatch.
   */
  private readonly _widths = signal<ReadonlyMap<MlvItemsMoreItem, number>>(
    new Map(),
  );

  /**
   * @private Measured width of the overflow trigger, or `null` while it has
   * never been measured.
   *
   * `null` is load-bearing: it is the state in which no hide may be
   * committed. The trigger only renders in the row once something is
   * withheld, so without a probe the first hide would have to be decided from
   * a guessed width — and a guess that runs high withholds an item that fits.
   *
   * The probe renders with a count of `1` whenever nothing is withheld, so
   * the width on record at the moment of a first hide is the trigger's
   * *narrowest* plausible form, never a wide one left over from a previous
   * `+12`. Under-reserving can only keep an item visible for the one frame
   * until the real trigger is measured; over-reserving would withhold it.
   */
  private readonly _triggerWidth = signal<number | null>(null);

  /** @private The live observer, or `null` before first use / on the server. */
  private _resizeObserver: ResizeObserver | null = null;

  /**
   * @private The elements {@link _resizeObserver} currently watches, kept in
   * lockstep with it: every `add` here is paired with an `observe()` and
   * every `delete` with an `unobserve()`. Diffed rather than
   * `disconnect()`-and-re-observe, because a fresh observation always
   * delivers an initial notification, so disconnecting re-notifies every
   * settled box on each repartition and retains the detached ones until the
   * next callback.
   */
  private readonly _observedTargets = new Set<Element>();

  /** @private Trailing debounce timer, used for revealing only. */
  private _revealTimer: ReturnType<typeof setTimeout> | null = null;

  /** @private The element to return focus to when the panel closes. */
  private _focusReturn: HTMLElement | null = null;

  /**
   * @private The origin this row registered with the panel's container, held
   * so it can be withdrawn — on the next open from a different opener, and on
   * close. The container reads a registration only while attaching, so nothing
   * needs it once the panel is shut, and holding it would keep a destroyed
   * in-row trigger's element alive until the next open.
   */
  private _panelOrigin: ElementRef<HTMLElement> | null = null;

  /** @private Previous `opened()` reading, so the close edge can be detected. */
  private _wasOpen = false;

  /**
   * @private What the last committed split took out from under focus, while
   * the render that removes it — and the hand-off after that render — is
   * still pending. `null` otherwise.
   */
  private _focusLoss: MlvItemsMoreFocusLoss | null = null;

  /** @private The most recent reveal, while it may still undo itself. */
  private _lastReveal: MlvItemsMoreReveal | null = null;

  /**
   * @private A reveal that undid itself, and so may not be repeated.
   *
   * The failure it answers is a feedback loop outside the row: returning an
   * item makes the row taller, a page scrollbar appears, the row narrows, the
   * item no longer fits, the scrollbar goes, and round again — forever, a
   * flicker per frame. Arithmetic alone cannot see it, because at the width it
   * is computed against the item really does fit; it is the reveal's own
   * render that changes the width.
   *
   * So the guard records what was learned — "revealing down to
   * `hiddenCount` at `available` px or less makes it not fit" — and refuses to
   * commit that reveal again until the row is wider than it was. It is not a
   * band: nothing is held back that has not already been shown, by an actual
   * render, not to fit.
   */
  private _revealGuard: Pick<
    MlvItemsMoreReveal,
    'available' | 'hiddenCount'
  > | null = null;

  /** Items rendered in the row, in declaration order. */
  readonly visibleItems = this._service.visibleItems;

  /** Items withheld from the row, in declaration order. */
  readonly hiddenItems = this._service.hiddenItems;

  /** How many items are withheld. `0` while everything fits. */
  readonly hiddenCount = computed(() => this.hiddenItems().length);

  /** Whether the overflow panel is open. */
  readonly panelOpened = computed(() => this._popup()?.opened() ?? false);

  /** DOM id of the overflow panel, stable for this component's lifetime. */
  readonly panelId = mlvNextId('mlv-items-more-panel');

  /**
   * @protected Whether the off-flow trigger copy renders: while a trigger
   * template exists and nothing is withheld, which is exactly while no real
   * trigger is in the row to measure instead.
   */
  protected readonly _needsTriggerProbe = computed(
    () => this._triggerDef() !== undefined && this.hiddenCount() === 0,
  );

  constructor() {
    // Keep the observer pointed at every box the split reads: the row (the
    // width available), each rendered item and the in-row trigger (the width
    // consumed), and the probe. Observing only the row is the mistake #232
    // fixed in `mlv-tab-group`: the split is a function of the *items'*
    // widths, and a row whose width comes from its parent never resizes when
    // its children finally get theirs.
    //
    // `afterRenderEffect`, not `effect`: the body constructs a
    // `ResizeObserver`, which must not happen during a server render, and
    // this is the primitive that structurally cannot run there.
    afterRenderEffect(() => {
      const row = this._rowRef();
      const slots = this._slots();
      const trigger = this._triggerRef();
      const probe = this._triggerProbeRef();
      untracked(() => this._syncResizeTargets(row, slots, trigger, probe));
    });

    // Re-derive the split whenever the rendered structure changes — an item
    // registered or left, a template swapped, an item pinned. The `read`
    // phase is where layout reads belong: writes have already flushed, so
    // nothing here forces a second layout in the same frame.
    //
    // A split committed here re-renders the row within the same
    // `ApplicationRef.tick()`, before the browser paints, so an item that
    // registers into a full row is never painted in a position it will not
    // keep.
    afterRenderEffect({
      read: () => {
        this._slots();
        this._triggerRef();
        this._triggerProbeRef();
        this._triggerDef();
        for (const item of this._service.items()) item.collapsible();
        untracked(() => {
          this._captureWidths();
          this._commit(this._computeSplit());
        });
      },
    });

    // An empty panel is not a state worth keeping open: everything it held
    // has returned to the row.
    effect(() => {
      if (this.hiddenCount() === 0 && this.panelOpened()) {
        untracked(() => this.closePanel());
      }
    });

    // Return focus to whatever opened the panel, however it closed — Escape
    // and an outside press never go through `closePanel()`.
    effect(() => {
      const open = this.panelOpened();
      untracked(() => {
        if (this._wasOpen && !open) {
          this._releasePanelOrigin();
          // After the render that detaches the panel, so the check for where
          // focus went reads the settled document rather than a panel that is
          // about to leave it.
          afterNextRender(() => this._restoreFocus(), {
            injector: this._injector,
          });
        }
        this._wasOpen = open;
      });
    });

    this._destroyRef.onDestroy(() => this._teardown());
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Opens the panel, anchoring the overlay on `origin` and remembering it as
   * the element to return focus to when the panel closes.
   */
  openPanel(origin: ElementRef<HTMLElement>): void {
    const container = this._panelContainer();
    if (!container) return;
    this._focusReturn = origin.nativeElement;
    // The container anchors the overlay on the latest registered origin, and
    // falls back to its own host when that origin has left the document. It
    // keeps every registration until it is withdrawn (#230), so the previous
    // opener is withdrawn first: the in-row trigger is re-created each time
    // items are withheld again, and a registration per open would pin every
    // one of them.
    if (this._panelOrigin) container.unregisterTrigger(this._panelOrigin);
    container.registerTrigger(origin, false);
    this._panelOrigin = origin;
    container.open();
  }

  /** Closes the panel. Focus returns to the element that opened it. */
  closePanel(): void {
    this._panelContainer()?.close();
  }

  /** {@link openPanel} or {@link closePanel}, whichever the state calls for. */
  togglePanel(origin: ElementRef<HTMLElement>): void {
    if (this.panelOpened()) {
      this.closePanel();
    } else {
      this.openPanel(origin);
    }
  }

  // ─── Measurement ─────────────────────────────────────────────────────────

  /**
   * @private Reads the natural width of every rendered box into the cache.
   *
   * `getBoundingClientRect().width` rather than `offsetWidth`: the latter
   * rounds to an integer, and a row of eight items can accumulate four pixels
   * of rounding — enough to withhold an item that fits.
   *
   * A zero width is ignored rather than cached. A box inside a subtree that
   * is not rendered measures zero, and a zero in the cache reads as "this
   * item is free", which would keep every item visible and the row
   * overflowing for as long as the entry survived.
   *
   * Entries for items that have left the registry are dropped here, so the
   * cache never retains a destroyed component.
   */
  private _captureWidths(): void {
    const registered = new Set(this._service.items());
    const current = this._widths();
    let next: Map<MlvItemsMoreItem, number> | null = null;

    if (current.size > 0) {
      for (const item of current.keys()) {
        if (registered.has(item)) continue;
        next ??= new Map(current);
        next.delete(item);
      }
    }

    for (const slot of this._slots()) {
      const item = slot.item();
      if (!registered.has(item)) continue;
      const width = slot.elementRef.nativeElement.getBoundingClientRect().width;
      if (width <= 0 || (next ?? current).get(item) === width) continue;
      next ??= new Map(current);
      next.set(item, width);
    }

    if (next) this._widths.set(next);

    // The real trigger is the better source once it exists — it carries the
    // real count; the probe covers the time nothing is withheld.
    const triggerEl =
      this._triggerRef()?.nativeElement ??
      this._triggerProbeRef()?.nativeElement;
    if (triggerEl) {
      const width = triggerEl.getBoundingClientRect().width;
      if (width > 0 && width !== this._triggerWidth()) {
        this._triggerWidth.set(width);
      }
    }
  }

  /**
   * @private Computes the split from cached widths, or `null` when it cannot
   * be computed honestly — no row element, a row that is not rendered, an
   * item whose width has never been measured, or a trigger declared but not
   * yet measured.
   *
   * `null` means "commit nothing", not "hide nothing": an existing split
   * stands, and a newly-registered item stays visible because it is not in
   * it. That is the invariant behind the no-false-positive-hides promise —
   * an item is only ever withheld by arithmetic over widths that were all
   * really measured.
   *
   * A row with no box at all (inside a `display: none` tab panel, say)
   * measures zero wide, and against zero every collapsible item "does not
   * fit". Committing that would repaint the row collapsed the moment the
   * panel is shown, and reveal it again a debounce later.
   */
  private _computeSplit(): MlvItemsMoreSplit | null {
    const row = this._rowRef()?.nativeElement;
    if (!row) return null;

    const rowRect = row.getBoundingClientRect();
    if (rowRect.width <= 0 && rowRect.height <= 0) return null;

    const items = this._service.items();
    if (items.length === 0) return { hidden: new Set(), available: 0 };

    const widths = this._widths();
    const candidates: MlvOverflowCandidate[] = [];
    for (const item of items) {
      const width = widths.get(item);
      if (width === undefined) return null;
      candidates.push({ width, collapsible: item.collapsible() });
    }

    // No trigger template means the trigger is not in the row — a
    // consumer-placed `[mlvItemsMoreTrigger]` lives in their own layout and
    // consumes none of this row's width, so reserving for it would withhold
    // an item that fits.
    let triggerWidth = 0;
    if (this._triggerDef()) {
      const measured = this._triggerWidth();
      if (measured === null) return null;
      triggerWidth = measured;
    }

    const styles = getComputedStyle(row);
    const available =
      rowRect.width -
      MlvItemsMore._px(styles.paddingInlineStart) -
      MlvItemsMore._px(styles.paddingInlineEnd) -
      MlvItemsMore._px(styles.borderInlineStartWidth) -
      MlvItemsMore._px(styles.borderInlineEndWidth);

    const flags = computeHiddenFlags({
      candidates,
      available,
      gap: MlvItemsMore._px(styles.columnGap),
      triggerWidth,
    });

    const hidden = new Set<MlvItemsMoreItem>();
    flags.forEach((isHidden, index) => {
      if (isHidden) hidden.add(items[index]);
    });
    return { hidden, available };
  }

  /**
   * @private `column-gap: normal` and an unresolved length both parse to
   * `NaN`; the used value of both is zero.
   */
  private static _px(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // ─── Committing ──────────────────────────────────────────────────────────

  /**
   * @private Commits a split through the oscillation guard, or does nothing
   * when there is no split to commit.
   *
   * A hide always commits. A reveal commits unless {@link _revealGuard} has
   * already seen that same reveal, at this width or narrower, undo itself.
   */
  private _commit(split: MlvItemsMoreSplit | null): void {
    if (!split) return;
    const { hidden, available } = split;
    const currentCount = this._service.hidden().size;

    // The row has grown past the width that failed: whatever was learned
    // there says nothing about this width.
    if (
      this._revealGuard &&
      available > this._revealGuard.available + MLV_FIT_EPSILON_PX
    ) {
      this._revealGuard = null;
    }

    if (hidden.size < currentCount) {
      const guard = this._revealGuard;
      if (guard && hidden.size <= guard.hiddenCount) return;
      this._lastReveal = {
        at: Date.now(),
        available,
        hiddenCount: hidden.size,
      };
    } else if (hidden.size > currentCount) {
      const last = this._lastReveal;
      if (last && Date.now() - last.at <= MlvItemsMore._OSCILLATION_WINDOW_MS) {
        this._revealGuard = {
          available: last.available,
          hiddenCount: last.hiddenCount,
        };
      }
      this._lastReveal = null;
    }

    // Read before committing: afterwards the split no longer says which boxes
    // the coming render removes.
    const loss = this._focusLossIn(hidden);
    this._service.commit(hidden);
    if (loss) this._scheduleFocusHandOff(loss);
  }

  /**
   * @private Handles one batch of resize notifications.
   *
   * Asymmetric on purpose. Withholding more is applied in the same task the
   * notification arrived in, because the state it corrects — a row wider than
   * its box — is the one a reader can see is broken. Returning items to the
   * row is deferred to a trailing timer, because the state it corrects is
   * merely a row with room to spare, and because a drag produces a burst of
   * notifications that would otherwise re-render the row on every one.
   */
  private _onResizeBatch(): void {
    // The notification may be an item's own content changing width — a label
    // swapped, a web font landing — with no structural change for the render
    // effect to react to. Layout is clean inside a `ResizeObserver` callback,
    // so these reads are cheap.
    this._captureWidths();
    const next = this._computeSplit();
    if (!next) return;

    if (next.hidden.size >= this._service.hidden().size) {
      this._clearRevealTimer();
      this._commit(next);
      return;
    }

    this._clearRevealTimer();
    this._revealTimer = setTimeout(() => {
      this._revealTimer = null;
      // Recomputed rather than replayed: the box has kept moving for the
      // whole debounce window, and the split from the first frame of it is
      // the stalest answer available.
      this._captureWidths();
      this._commit(this._computeSplit());
    }, MlvItemsMore._REVEAL_DEBOUNCE_MS);
  }

  // ─── Focus across a split ────────────────────────────────────────────────

  /**
   * @private The box the render after committing `hidden` removes from under
   * focus, or `null` when focus is not inside one — outside the row, on an
   * item the split keeps, or already on `<body>`.
   *
   * Two kinds of box leave the row: the slot of every item `hidden` holds
   * (the row renders only the rest), and the in-row trigger, which renders
   * only while something is withheld and so goes with the last item to
   * return. Read against the rendered boxes, not against the previous split,
   * so focus placed on a box an earlier commit already doomed still counts.
   */
  private _focusLossIn(
    hidden: ReadonlySet<MlvItemsMoreItem>,
  ): MlvItemsMoreFocusLoss | null {
    const active = this._document.activeElement;
    const row = this._rowRef()?.nativeElement;
    if (!active || !row?.contains(active)) return null;

    if (hidden.size === 0) {
      return this._triggerRef()?.nativeElement.contains(active)
        ? { removed: 'trigger' }
        : null;
    }

    for (const slot of this._slots()) {
      const item = slot.item();
      if (hidden.has(item) && slot.elementRef.nativeElement.contains(active)) {
        return { removed: 'item', item };
      }
    }
    return null;
  }

  /**
   * @private Queues {@link _handOffFocus} for after the render that removes
   * the box. One queued hand-off per render; a later loss found before that
   * render replaces the recorded one, since it reflects where focus is now.
   */
  private _scheduleFocusHandOff(loss: MlvItemsMoreFocusLoss): void {
    const queued = this._focusLoss !== null;
    this._focusLoss = loss;
    if (queued) return;
    afterNextRender(
      () => {
        const pending = this._focusLoss;
        this._focusLoss = null;
        if (pending) this._handOffFocus(pending);
      },
      { injector: this._injector },
    );
  }

  /**
   * @private Puts focus back after a split removed the focused box — but only
   * when the browser dropped it.
   *
   * Nothing here moves focus the reader still has. It runs after the render
   * that destroyed the box, and returns unless focus is on `<body>`: a box
   * that survived after all (a reveal landed first) still holds it, and focus
   * placed anywhere since stays where it was placed. What it replaces is not
   * "focus where the reader left it" but "focus nowhere" — nothing is
   * announced, nothing in the row is focused, and where the next Tab lands is
   * left to whether the browser keeps a navigation starting point (WCAG
   * 2.4.3).
   *
   * Where it lands:
   *
   * - **An item was withheld → the trigger.** It is the control that now
   *   holds the item, at the end of the row, announcing its label (a count
   *   only where the trigger template renders one). With no trigger in the
   *   row (a consumer-placed one, or none), the nearest item still in the
   *   row — the one before it, else the one after; with none left, focus
   *   stays on `<body>`.
   * - **The trigger left with the last item → the last item in the row**, the
   *   one that just came back and now stands where the trigger was. The same
   *   target {@link _restoreFocus} picks when the panel closes for that reason.
   *
   * The alternative — keeping the focused item in the row, as if pinned,
   * until focus leaves it — was rejected. At a width where it cannot fit
   * beside the trigger it would overflow the clipping row, a focused control
   * nobody can see (WCAG 2.4.11); and where it can, the row would reshuffle
   * the moment focus moved on — Tab onto the trigger would withhold the item
   * just left and hand its place to another — a layout change caused by
   * nothing but moving focus.
   */
  private _handOffFocus(loss: MlvItemsMoreFocusLoss): void {
    const active = this._document.activeElement;
    if (active && active !== this._document.body) return;

    const target =
      loss.removed === 'trigger'
        ? this._lastItemTabbable()
        : (this._triggerTabbable() ?? this._tabbableBeside(loss.item));
    target?.focus();
  }

  /** @private The in-row trigger's focusable control, while one renders. */
  private _triggerTabbable(): HTMLElement | null {
    const trigger = this._triggerRef()?.nativeElement;
    return trigger ? this._tabbable.getTabbableElement(trigger) : null;
  }

  /**
   * @private The focusable control nearest to where `item` stood in the row:
   * the last one in the closest item before it, else the first one in the
   * closest item after it. Before wins because the next Tab from there reaches
   * exactly what the next Tab from the withheld item would have. `n` is one
   * row of controls, so the scan is not worth an index.
   */
  private _tabbableBeside(item: MlvItemsMoreItem): HTMLElement | null {
    const order = this._service.items();
    const at = order.indexOf(item);
    let before: HTMLElement | null = null;
    let after: HTMLElement | null = null;
    for (const slot of this._slots()) {
      const element = slot.elementRef.nativeElement;
      if (order.indexOf(slot.item()) < at) {
        before = this._tabbable.getTabbableElement(element, true) ?? before;
      } else {
        after ??= this._tabbable.getTabbableElement(element);
      }
    }
    return before ?? after;
  }

  /** @private The last focusable control of the last item in the row. */
  private _lastItemTabbable(): HTMLElement | null {
    const slots = this._slots();
    const lastSlot = slots[slots.length - 1]?.elementRef.nativeElement;
    return lastSlot ? this._tabbable.getTabbableElement(lastSlot, true) : null;
  }

  // ─── Observation ─────────────────────────────────────────────────────────

  /** @private Creates the observer on first use, or returns the existing one. */
  private _ensureResizeObserver(): ResizeObserver | null {
    this._resizeObserver ??= this._resizeObserverFactory.create(() =>
      this._onResizeBatch(),
    );
    return this._resizeObserver;
  }

  /** @private Points the observer at every box the split reads, by diffing. */
  private _syncResizeTargets(
    row: ElementRef<HTMLElement> | undefined,
    slots: readonly MlvItemsMoreSlot[],
    trigger: ElementRef<HTMLElement> | undefined,
    probe: ElementRef<HTMLElement> | undefined,
  ): void {
    const observer = this._ensureResizeObserver();
    if (!observer) return;

    const targets = new Set<Element>();
    if (row) targets.add(row.nativeElement);
    for (const slot of slots) targets.add(slot.elementRef.nativeElement);
    if (trigger) targets.add(trigger.nativeElement);
    if (probe) targets.add(probe.nativeElement);

    // Deleting the element the `for…of` stands on is well-defined for a Set,
    // so both passes mutate `_observedTargets` in place and it stays the
    // observer's target list rather than a snapshot of it.
    for (const element of this._observedTargets) {
      if (!targets.has(element)) {
        observer.unobserve(element);
        this._observedTargets.delete(element);
      }
    }
    for (const element of targets) {
      if (!this._observedTargets.has(element)) {
        observer.observe(element);
        this._observedTargets.add(element);
      }
    }
  }

  /** @private Releases the observer, the timer and the focus references. */
  private _teardown(): void {
    this._clearRevealTimer();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._observedTargets.clear();
    this._focusReturn = null;
    this._focusLoss = null;
    this._panelOrigin = null;
  }

  /**
   * @private Withdraws the opener this row registered with the panel's
   * container, if any. Called on the close edge; see {@link _panelOrigin}.
   */
  private _releasePanelOrigin(): void {
    const origin = this._panelOrigin;
    if (!origin) return;
    this._panelOrigin = null;
    this._panelContainer()?.unregisterTrigger(origin);
  }

  /** @private Cancels a pending reveal, if one is scheduled. */
  private _clearRevealTimer(): void {
    if (this._revealTimer === null) return;
    clearTimeout(this._revealTimer);
    this._revealTimer = null;
  }

  /**
   * @private Puts focus back after the panel closes — but only when focus
   * would otherwise be lost.
   *
   * Focus that has already landed somewhere deliberate stays there: pressing
   * outside the panel onto a text field closes the panel *by* focusing that
   * field, and yanking focus back to the trigger would undo what the user
   * just did. Focus left on `<body>`, or still inside the panel that is
   * leaving, is lost focus.
   *
   * The opener may itself be gone: closing the panel because the last
   * withheld item returned to the row destroys the in-row trigger in the same
   * pass, and focusing a detached node silently moves focus to `<body>`. The
   * natural place to land then is the last item in the row — the one that
   * just came back.
   */
  private _restoreFocus(): void {
    const opener = this._focusReturn;
    this._focusReturn = null;

    const active = this._document.activeElement;
    const panel = this._document.getElementById(this.panelId);
    const lost =
      !active ||
      active === this._document.body ||
      (panel?.contains(active) ?? false);
    if (!lost) return;

    if (opener?.isConnected) {
      opener.focus();
      return;
    }

    this._lastItemTabbable()?.focus();
  }
}
