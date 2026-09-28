import type { TemplateRef } from '@angular/core';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
  linkedSignal,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MlvList,
  MlvListItem,
  MlvListItemSelectable,
  MlvListSelectable,
} from '@malva-ui/core/list';
import { LucideCheck } from '@lucide/angular';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvInfiniteScroll } from '@malva-ui/cdk/infinite-scroll';
import { mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvSelectOption } from '../select-option';
import { hasOptionGroups } from '../select-option';
import { valueIndex } from '../reconciliation';
import { optionId } from '../active-descendant';
import { MlvHighlightMatchPipe } from '../highlight-match.pipe';
import type { DropdownOptionSetPositions } from './option-window';
import {
  ariaDefaultTabStop,
  DROPDOWN_WINDOW_PAGE,
  MIRRORED_LISTBOX_CONFIG,
  optionSetPositions,
  windowLimitFor,
  windowSurvival,
} from './option-window';
import { fromEvent, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MLV_DROPDOWN_PANEL_I18N } from '@malva-ui/i18n';

/**
 * @private English loading text, used when neither `loadingText` nor the
 * active language pack supplies one: the English pack's
 * `dropdownPanel.loading`, and the input's default before #370.
 */
const DROPDOWN_PANEL_LOADING_FALLBACK = 'Loading…';

/**
 * The committed selection split by what the inner aria listbox may be shown
 * while the option window is truncated. See `MlvDropdownPanel._committedSplit`.
 */
interface DropdownCommittedSplit<T> {
  /** Every committed value, resolved onto its option instance, in order. */
  readonly committed: readonly T[];
  /** What aria's `value` is bound to: `committed` minus {@link withheld}. */
  readonly aria: T[];
  /** Committed values whose option exists but is not rendered yet. */
  readonly withheld: ReadonlySet<T>;
}

/**
 * The option window: how many leading options render, and whether aria's
 * listbox has been interacted with since the window last reset. See
 * `MlvDropdownPanel._window`.
 */
interface DropdownWindowState {
  /** How many leading options the panel renders (before clamping to `options().length`). */
  readonly limit: number;
  /**
   * Whether a key, click or focus has reached the listbox since the window last
   * reset — the point after which aria stops re-deriving its default tab stop,
   * so the window stops pinning it.
   */
  readonly interacted: boolean;
}

/** A single printable key, the match aria's listbox runs typeahead on. */
const TYPEAHEAD_KEY = /^.$/;

/**
 * One option within a rendered group, paired with its flat index into the
 * panel's `options()` array. The flat index (not a group-local index) is what
 * the panel forwards to {@link MlvDropdownPanel.optionId} and matches
 * against `activeIndex`, so an owning combobox's activedescendant model stays
 * aligned regardless of grouping.
 */
interface DropdownOptionEntry<T> {
  readonly option: MlvSelectOption<T>;
  readonly index: number;
}

/**
 * A rendered cluster of consecutive options that share the same group label.
 * `label`/`headerId` are `null` for an ungrouped (headerless) run.
 */
interface DropdownOptionGroup<T> {
  readonly label: string | null;
  readonly headerId: string | null;
  readonly entries: DropdownOptionEntry<T>[];
}

@Component({
  selector: 'mlv-dropdown-panel',
  imports: [
    NgTemplateOutlet,
    MlvList,
    MlvListItem,
    MlvListItemSelectable,
    MlvListSelectable,
    LucideCheck,
    MlvHighlightMatchPipe,
    MlvScrollbar,
    MlvInfiniteScroll,
  ],
  templateUrl: './dropdown-panel.html',
  styleUrl: './dropdown-panel.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-dropdown-panel',
    '[class.mlv-dropdown-panel--parent-scroll]': 'scrollMode() === "parent"',
    '[class.mlv-dropdown-panel--loading]': 'loading()',
    '[style.max-height.px]': '_calculatedMaxHeight()',
  },
})
export class MlvDropdownPanel<T> {
  /**
   * Chooses the single scroll owner for this panel.
   *
   * Standalone panels scroll themselves. Panels composed inside `mlv-popup`
   * delegate to the popup so the DOM never contains nested scroll regions.
   *
   * `'parent'` delegates to the nearest ancestor `mlv-scrollbar` viewport. With
   * none, nothing tells the panel it is being scrolled, so it renders every
   * option instead of a window that could only grow by keyboard, and a
   * `hasMore` source is never paged on scroll (a dev-mode warning says so).
   */
  readonly scrollMode = input<'self' | 'parent'>('self');

  /** Minimum panel height in px. `0` (default) leaves the height unconstrained. */
  readonly minHeight = input<number>(0);
  /**
   * Maximum panel height in px. `0` (default) falls back to 40% of the
   * viewport height in a browser; on the server there is no viewport, so no
   * `max-height` is emitted at all.
   */
  readonly maxHeight = input<number>(0);
  /** The options to render, in DOM order. */
  readonly options = input<MlvSelectOption<T>[]>([]);
  /** Whether multiple options can be selected. */
  readonly multiple = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /**
   * The committed selection. Drives both the inner aria listbox's `value` and
   * the per-row check-mark, the latter through {@link compareWith} — a value
   * here need not be the option's own instance, only one the comparator
   * matches to it.
   */
  readonly selectedValues = input<T[]>([]);
  /**
   * Equality predicate deciding which rows render a check-mark: a row is
   * checked when some committed value `v` satisfies
   * `compareWith(v, option.value)` — the same argument order, and the same
   * answer, as `MlvSelectionService.isSelected`. It also decides which
   * committed values are resolved onto their option instance before the inner
   * aria listbox sees them (see {@link _ariaValues}), so it governs
   * `aria-selected` too.
   *
   * `null` (default) **inherits the comparator from the injected
   * {@link MlvSelectionService}**, which is the single source of truth for
   * every other membership check in the stack (`isSelected`, `deselect`, the
   * `select`/`toggle` de-dup path). An owning control that sets its own
   * `compareWith` — `mlv-select`, `mlv-combobox` — already pushes it there, so
   * the check-mark follows automatically and cannot drift from the display
   * value.
   *
   * **When to set it.** On a standalone panel whose comparator is not
   * expressed through the service — and on any panel whose
   * `MlvSelectionService` is *shared*. The service is injected without
   * `{ optional: true }`, so it must be provided above every panel; every host
   * in this repo provides it at component level, which scopes one instance per
   * host. A consumer that answers the same requirement by providing it **once
   * at the application root** gets one instance shared by every panel in the
   * app, and then one host's `service.compareWith.set(...)` silently re-checks
   * the rows of every other. Prefer `providers: [MlvSelectionService]` on the
   * host component; where the service genuinely has to be shared, set this
   * input so the panel's identity rule is local to it.
   *
   * Membership goes through {@link valueIndex}, so the shared
   * `defaultCompareWith` keeps an O(1) keyed lookup per row and only a custom
   * comparator (or a `NaN` on either side of the default) pays a scan of the
   * selection.
   */
  readonly compareWith = input<((a: T, b: T) => boolean) | null>(null);
  /** Custom renderer for an option row. `null` (default) renders the label. */
  readonly itemTemplate = input<TemplateRef<{
    $implicit: MlvSelectOption<T>;
  }> | null>(null);
  /**
   * Focus strategy forwarded to the inner aria listbox.
   *
   * - `'roving'` (default) — DOM focus moves onto the active option (`tabindex`).
   *   Used by `mlv-select`.
   * - `'activedescendant'` — DOM focus stays on the owning trigger/input; the
   *   active option is tracked via `aria-activedescendant`. Used by
   *   `mlv-combobox`, whose text input must retain focus so typing keeps
   *   working while navigating options.
   */
  readonly focusMode = input<'roving' | 'activedescendant'>('roving');
  /**
   * Index of the option that is visually "active" (highlighted) under the
   * activedescendant model. `-1` (default) means no active option. The panel
   * renders a deterministic `[id]` on each option (`<listboxId>-option-<index>`)
   * so an owning combobox can point its input's `aria-activedescendant` at the
   * active row and keep the highlight in sync.
   */
  readonly activeIndex = input<number>(-1);
  /**
   * Optional HTML `id` to assign to the inner `<mlv-list>` listbox element.
   * Allows a parent combobox or select to reference this listbox via `aria-controls`.
   */
  readonly listboxId = input<string | null>(null);

  /**
   * Accessible name rendered as `aria-label` on the inner listbox. `role="listbox"`
   * is an ARIA input field, so a panel that is not already named through an owning
   * control (`mlv-filter`'s popover, for instance) needs one to satisfy WCAG 4.1.2.
   * `null` (default) renders no attribute.
   */
  readonly ariaLabel = input<string | null>(null);

  /**
   * When non-empty, the default option row emphasises the matched substring of
   * this query inside each suggestion label (case- and diacritic-insensitive;
   * see {@link MlvHighlightMatchPipe}). Ignored for rows rendered by a custom
   * {@link itemTemplate}. Empty (default) renders the label as plain text —
   * ungrouped, un-highlighted lists are byte-for-byte unchanged.
   */
  readonly highlightQuery = input<string>('');

  /**
   * When `true`, the panel renders a loading affordance instead of the option
   * list / empty state — used by `[mlvAutocomplete]` while an async `search`
   * resolves. The {@link loadingText} is announced politely.
   */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Text shown (and announced) inside the loading affordance while
   * {@link loading} or {@link loadingMore} is `true`. Unset, it is the active
   * language pack's `dropdownPanel.loading` (`MLV_DROPDOWN_PANEL_I18N`), else
   * English "Loading…" — so a panel outside any `provideMlvI18n()`, or under a
   * pack without the slice, renders exactly what it did before #370.
   * @default undefined — resolved through i18n
   */
  readonly loadingText = input<string | undefined>(undefined);

  /**
   * @private The dropdown-panel i18n slice. Optional: the panel is also used
   * standalone, with no `provideMlvI18n()` in the injector.
   */
  private readonly _i18n = inject(MLV_DROPDOWN_PANEL_I18N, { optional: true });

  /**
   * @protected Text of both loading rows: {@link loadingText}, else the active
   * pack's, else the English fallback.
   */
  protected readonly _resolvedLoadingText = computed(
    () =>
      this.loadingText() ??
      this._i18n?.().loading ??
      DROPDOWN_PANEL_LOADING_FALLBACK,
  );

  /**
   * When `true`, a page beyond the first is being fetched: renders a polite
   * bottom status row (`loadingText`) after the last option. The listbox and
   * existing options stay interactive.
   * @default false
   */
  readonly loadingMore = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether more pages exist. When `true` the panel observes its scroll owner
   * and emits {@link loadMore} as the user nears the end of the list.
   * @default false
   */
  readonly hasMore = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Distance (px) from the end of the scroll owner at which {@link loadMore} fires. */
  readonly infiniteScrollThreshold = input<number>(150);

  /** Emits when the user scrolls within `infiniteScrollThreshold` of the end while `hasMore`. */
  readonly loadMore = output<void>();

  /**
   * @protected Effective listbox id forwarded to the aria `Listbox.id` input on
   * the inner `<mlv-list>`. Uses the consumer-provided {@link listboxId} when
   * set, otherwise a stable generated fallback so the rendered listbox always
   * carries a valid unique DOM id (aria would otherwise mint its own, breaking
   * a parent trigger's `aria-controls` linkage).
   */
  protected readonly _resolvedListboxId = computed(
    () => this.listboxId() ?? this._fallbackListboxId,
  );

  /** @private Stable generated id used when no `listboxId` is supplied. */
  private readonly _fallbackListboxId = mlvNextId('mlv-dropdown-listbox');

  /**
   * @protected Whether the current options declare groups (at least one option
   * carries a non-empty `group`). When `false` the template renders the exact
   * flat option list as before — plain / ungrouped arrays are unaffected.
   */
  protected readonly _isGrouped = computed(() =>
    hasOptionGroups(this.options()),
  );

  /**
   * @private The row `@angular/aria`'s listbox makes its tab stop until it is
   * first interacted with — the first checked option it can focus, else the
   * first option it can focus ({@link ariaDefaultTabStop}) — in roving mode;
   * `-1` in activedescendant mode, where DOM focus never enters the listbox.
   *
   * aria picks only among registered rows, so {@link _window} renders this one
   * while aria still re-derives it. Without it a committed value past the
   * window would move where Tab lands, a disabled checked row would hide an
   * enabled one past it, and a disabled prefix a window long would leave aria
   * no row to land on — it then counts the whole listbox as disabled and takes
   * the tab stop itself.
   */
  private readonly _defaultTabStop = computed(() =>
    this.focusMode() === 'roving'
      ? ariaDefaultTabStop(this._checkedRows(), (index) =>
          this._isFocusable(index),
        )
      : -1,
  );

  /**
   * @private The option window (#318): how many leading options render, and
   * whether the listbox has been interacted with since the window last reset.
   *
   * One {@link DROPDOWN_WINDOW_PAGE} to start with, a page more each time the
   * scroll owner nears the end ({@link _onSentinel}), and as far as a key needs
   * ({@link _onKeydownCapture}). It always reaches {@link activeIndex} — the
   * row an owning combobox points `aria-activedescendant` at, an id that has
   * to resolve — and reaches {@link _defaultTabStop} only until the listbox is
   * interacted with. aria stops re-deriving its tab stop on the first key,
   * click or focus inside the listbox (`hasBeenInteracted`), so pinning it
   * after that would only grow the window — deselecting the first of two
   * checked rows would mount every row up to the second — for a tab stop aria
   * no longer moves. The latch is set by the same three events
   * ({@link _markInteracted}); a snapshot taken once per `options` change was
   * rejected because a committed value arriving after the options (a form
   * patched from a request) would then go unpinned.
   *
   * A `linkedSignal`, so each option change is judged against the rows the
   * window rendered ({@link windowSurvival}). The limit resets to one page
   * when a rendered position holds a different value — a query typed or
   * cleared re-mounts one page instead of every row — and survives a next page
   * appended behind the rows or the same rows regrouped, so a scrolled list
   * does not collapse under the user. The latch resets whenever a rendered
   * row's view is re-created: a different value, a row that changes group
   * run, the list turning grouped or flat, or a `scrollMode` change (which
   * re-creates the listbox itself). aria re-derives its tab stop from the rows
   * it has as soon as its active row's view goes, whether or not it was
   * interacted with, so the window has to pin that tab stop again. A reset
   * that re-creates rows other than the active one only renders further than
   * aria needs. The latch lives in the same state because judging it depends
   * on the window's own limit.
   */
  private readonly _window = linkedSignal<
    {
      options: readonly MlvSelectOption<T>[];
      grouped: boolean;
      scrollMode: 'self' | 'parent';
      active: number;
      defaultTabStop: number;
    },
    DropdownWindowState
  >({
    source: () => ({
      options: this.options(),
      grouped: this._isGrouped(),
      scrollMode: this.scrollMode(),
      active: this.activeIndex(),
      defaultTabStop: this._defaultTabStop(),
    }),
    computation: (source, previous) => {
      const survival = previous
        ? windowSurvival(
            previous.source.options,
            source.options,
            previous.value.limit,
          )
        : 'none';
      // A different value at a rendered position: a new list, one page of it.
      const kept = survival === 'none' ? undefined : previous?.value;
      // Every rendered row keeps its view, and so does the block it renders in.
      const viewsKept =
        survival === 'views' &&
        previous?.source.grouped === source.grouped &&
        previous.source.scrollMode === source.scrollMode;
      const interacted = viewsKept && (kept?.interacted ?? false);
      const required = interacted
        ? source.active
        : Math.max(source.active, source.defaultTabStop);
      return {
        interacted,
        limit: Math.max(
          kept?.limit ?? DROPDOWN_WINDOW_PAGE,
          windowLimitFor(required),
        ),
      };
    },
  });

  /**
   * @private Whether the scroll-owner lookup ran and found none —
   * `scrollMode="parent"` outside any `mlv-scrollbar` viewport.
   */
  private readonly _noScrollOwner = computed(
    () => this._scrollOwnerResolved() && this._scrollContainer() === null,
  );

  /**
   * @private Number of option rows actually rendered: the window, or every
   * option once the lookup found no scroll owner. Nothing can grow the window
   * by scrolling there, so the panel renders as it did before windowing rather
   * than leaving the rest of the list reachable by keyboard only.
   */
  private readonly _renderCount = computed(() => {
    const total = this.options().length;
    return this._noScrollOwner()
      ? total
      : Math.min(total, this._window().limit);
  });

  /**
   * @protected Whether options exist past the rendered window. Only then do
   * rows carry `aria-setsize` / `aria-posinset`, does the paging sentinel grow
   * the window instead of emitting {@link loadMore}, and are committed values
   * split by {@link _committedSplit}; a list that fits one window renders
   * exactly as it did before windowing.
   */
  protected readonly _windowTruncated = computed(
    () => this._renderCount() < this.options().length,
  );

  /**
   * @protected Whether the paging sentinel is live: the source has more pages,
   * or the window has more rows to render.
   */
  protected readonly _sentinelArmed = computed(
    () => this.hasMore() || this._windowTruncated(),
  );

  /**
   * @protected The options the template renders: a prefix of {@link options},
   * so every rendered row keeps its flat index and DOM order still equals
   * `options()` order — what aria's registration-order navigation relies on.
   * The same array when nothing is withheld.
   */
  protected readonly _windowOptions = computed<readonly MlvSelectOption<T>[]>(
    () => {
      const options = this.options();
      const count = this._renderCount();
      return count < options.length ? options.slice(0, count) : options;
    },
  );

  /**
   * @protected Set positions for every option while the window is truncated —
   * aria's listbox keeps none, and a browser computes them from the rows in
   * the DOM, so without them a 5,000-option list would be read as "1 of 100".
   * `null` once every row is rendered, when the browser's own numbers are the
   * right ones and the rows carry no attributes.
   */
  protected readonly _setPositions =
    computed<DropdownOptionSetPositions | null>(() =>
      this._windowTruncated()
        ? optionSetPositions(this.options(), this._isGrouped())
        : null,
    );

  /**
   * @protected The rendered options clustered into consecutive same-group runs
   * for rendering under sticky headers. Consecutive-run grouping (no
   * reordering) keeps DOM order identical to the flat `options()` order, so
   * option indices, `optionId`, `activeIndex`, and aria's DOM-order navigation
   * all stay aligned. Each entry retains its flat index into `options()`. A run
   * of options without a group (empty/undefined) becomes a headerless cluster
   * (`label: null`). Built from {@link _windowOptions}, a prefix, so a group
   * keeps its header id as the window grows.
   */
  protected readonly _groups = computed<DropdownOptionGroup<T>[]>(() => {
    const listboxId = this._resolvedListboxId();
    const groups: DropdownOptionGroup<T>[] = [];
    this._windowOptions().forEach((option, index) => {
      const label = option.group ? option.group : null;
      const current = groups[groups.length - 1];
      if (current && current.label === label) {
        current.entries.push({ option, index });
      } else {
        groups.push({
          label,
          headerId: label ? `${listboxId}-group-${groups.length}` : null,
          entries: [{ option, index }],
        });
      }
    });
    return groups;
  });

  /**
   * @protected Effective max panel height in px — the `maxHeight` input when
   * set, else the viewport-derived default.
   *
   * `null` while neither is resolved, so the host emits no `max-height` at all
   * rather than a `0px` that would collapse the panel. That is the state a
   * server render is always in: the viewport height is a browser measurement,
   * and the real value lands on the first browser render.
   */
  protected readonly _calculatedMaxHeight = computed<number | null>(() => {
    const inputMaxHeight = this.maxHeight();
    if (inputMaxHeight > 0) return inputMaxHeight;
    const viewportMaxHeight = this._defaultMaxHeight();
    return viewportMaxHeight > 0 ? viewportMaxHeight : null;
  });

  /** Emits the aria listbox's selected-values array whenever the selection changes. */
  readonly valueChange = output<readonly T[]>();

  /** @private Selection service coordinating focus-first requests from a parent select/combobox. */
  private readonly _selectionService = inject(MlvSelectionService);

  /**
   * @private The comparator actually in force — the {@link compareWith} input
   * when set, else the owning control's, read off {@link MlvSelectionService}.
   * A signal read, so a comparator swapped at runtime re-checks every row.
   */
  private readonly _compareWith = computed<(a: T, b: T) => boolean>(
    () => this.compareWith() ?? this._selectionService.compareWith(),
  );

  /**
   * @private The committed selection, indexed for the per-row membership test
   * the template runs (`isValueSelected`, once per rendered option).
   *
   * **The haystack is the selection, not the options**, because argument order
   * is observable and a consumer's `compareWith` is under no obligation to be
   * symmetric: `valueIndex` applies `compare(indexedValue, queriedValue)`, so
   * indexing the selection and querying with an option value reproduces
   * `MlvSelectionService.isSelected`'s `compare(selected, value)` exactly.
   *
   * This replaced a `new Set(selectedValues())`, which answered under
   * SameValueZero regardless of the comparator (#132): it ticked a `NaN` row
   * that `===` reports unselected, and missed the row a custom comparator
   * matches to a freshly deserialised value. `valueIndex` keeps the keyed O(1)
   * lookup for the shared `defaultCompareWith` and degrades to the pairwise
   * scan only where SameValueZero would give a different answer.
   */
  private readonly _selectedValueIndex = computed(() =>
    valueIndex(this.selectedValues(), this._compareWith()),
  );

  /**
   * @private The rendered options, indexed by their `value` for the
   * committed-value resolution {@link _ariaValues} runs. Note the argument
   * order is the *transpose* of {@link _selectedValueIndex}'s and deliberately
   * so: `valueIndex` applies `compare(indexedValue, queriedValue)`, and this
   * one is queried with a committed value, giving
   * `compare(option.value, committedValue)` — the order every other
   * value-vs-options check in the stack uses, `mlv-select`'s
   * `_applyPendingValues` included. The two indexes are also keyed on
   * different signals and invalidate independently.
   */
  private readonly _optionValueIndex = computed(() =>
    valueIndex(this.options(), this._compareWith(), (option) => option.value),
  );

  /**
   * @protected The committed selection with every value that matches a
   * rendered option replaced by that option's own value instance — what the
   * inner aria listbox's `value` is bound to, in place of the raw
   * {@link selectedValues}.
   *
   * **`@angular/aria` takes no comparator.** `ngListbox` runs an
   * `afterRenderEffect` that filters its `value` model down to the values
   * `items.some((i) => i.value() === v)` accepts and writes the result back,
   * and its option computes `aria-selected` as
   * `listbox.value().includes(this.value())`. Both are SameValueZero. So a
   * value matched to a row by {@link compareWith} alone — a deserialised form
   * value, the case that comparator exists for — used to be invisible to
   * aria: the row check-marked but reported `aria-selected="false"`, and the
   * panel emitted a `valueChange` dropping it on first render, with no user
   * interaction. A consumer wiring `valueChange` straight back into
   * `selectedValues` (what the docs example shows) had its selection silently
   * cleared one frame after it appeared.
   *
   * Resolving first makes the array aria receives `===`-comparable to the
   * options it holds, which settles the reconciliation emit and
   * `aria-selected` together. `mlv-select` and `mlv-combobox` already
   * normalise upstream, in `_applyPendingValues`, which is why they never
   * showed either symptom; this is the same move, made where a standalone
   * panel can benefit from it.
   *
   * A value matching no option is passed through unchanged, so aria still
   * filters it and still re-emits — unchanged behaviour, and the case
   * `isReconciliationEmit` / `filteredOutCommitted` exist to absorb in an
   * owning control. A value whose option exists but lies past the rendered
   * window is **withheld** instead; see {@link _committedSplit}.
   */
  protected readonly _ariaValues = computed<T[]>(
    () => this._committedSplit().aria,
  );

  /**
   * @private The rendered options indexed like {@link _optionValueIndex}, for
   * telling a committed value whose row is rendered from one whose row is
   * not. Read only while the window is truncated.
   */
  private readonly _renderedValueIndex = computed(() =>
    valueIndex(
      this._windowOptions(),
      this._compareWith(),
      (option) => option.value,
    ),
  );

  /**
   * @private The committed selection, resolved (see {@link _ariaValues}) and
   * split by whether aria may be shown each value.
   *
   * aria's reconciliation effect drops every value in its `value` model that
   * no registered option holds, and writes the result back as a
   * `valueChange`. With every option rendered that only ever dropped values
   * matching **no** option, which is the documented reconciliation emit. With
   * a window it would also drop a value whose row simply has not been scrolled
   * to yet — a selection lost to rendering, with no user action. So while the
   * window is truncated such a value is withheld from aria and put back by
   * {@link onValueChange}; values whose row is rendered, and values matching
   * no option at all, still reach aria exactly as before.
   *
   * With every row rendered nothing is withheld and `aria` is the resolved
   * selection, as it always was.
   */
  private readonly _committedSplit = computed<DropdownCommittedSplit<T>>(() => {
    const selected = this.selectedValues();
    const all = this._optionValueIndex();
    if (!this._windowTruncated()) {
      const resolved = selected.map((value) => all.resolve(value));
      return { committed: resolved, aria: resolved, withheld: new Set<T>() };
    }
    const rendered = this._renderedValueIndex();
    const committed: T[] = [];
    const aria: T[] = [];
    const withheld = new Set<T>();
    for (const value of selected) {
      // A rendered match comes first in `options()` too — the window is a
      // prefix — so resolving against it gives the instance `all` would.
      if (rendered.has(value)) {
        const resolved = rendered.resolve(value);
        committed.push(resolved);
        aria.push(resolved);
      } else if (all.has(value)) {
        const resolved = all.resolve(value);
        committed.push(resolved);
        withheld.add(resolved);
      } else {
        committed.push(value);
        aria.push(value);
      }
    }
    return { committed, aria, withheld };
  });

  /**
   * @protected Which rows render a check-mark, aligned index-for-index with
   * {@link options}. Read by the template as `_checkedRows()[index]`, where
   * `index` is the flat option index both the grouped and the ungrouped
   * branch already carry.
   *
   * Materialised rather than tested per row, because the template is executed
   * far more often than the selection changes — every `activeIndex` move, so
   * every arrow key. With a custom `compareWith` the per-row test is a scan of
   * the whole selection (`valueIndex` can key nothing it does not recognise),
   * which made the grid an options × selection scan **per render**. As a
   * `computed` it is one such scan per change of options, selection or
   * comparator.
   *
   * Stored as booleans keyed by position, not as a `Set` of the matched option
   * values: `Set` membership is SameValueZero, so under an `Object.is`
   * comparator a `-0` row would match a `+0` entry and tick a row the
   * comparator calls unselected — reintroducing, one level up, exactly the
   * defect this fix removes.
   */
  protected readonly _checkedRows = computed<readonly boolean[]>(() => {
    const selected = this._selectedValueIndex();
    return this.options().map((option) => selected.has(option.value));
  });
  /** @private Default max panel height (px) derived from the viewport height. */
  private readonly _defaultMaxHeight = signal(0);
  /** @private The inner selectable list directive, used to move focus to the first option. */
  private readonly _listSelectable = viewChild(MlvListSelectable);

  /** @private The panel's own scrollbar (`scrollMode="self"` only). */
  private readonly _scrollbar = viewChild(MlvScrollbar);

  /** @private The sentinel-hosted infinite-scroll directive, re-checked after each option append. */
  private readonly _infiniteScroll = viewChild(MlvInfiniteScroll);

  /**
   * @protected The element that actually scrolls: the panel's own scrollbar
   * viewport (`scrollMode="self"`) or the nearest ancestor `mlv-scrollbar`
   * viewport — the owning `mlv-popup`'s — in parent mode. Resolved after the
   * first render; the sentinel directive stays disabled until then.
   */
  protected readonly _scrollContainer = signal<HTMLElement | null>(null);

  /**
   * @private Whether the scroll-owner lookup has already run. It needs the first
   * render, so a `null` {@link _scrollContainer} before that means "not resolved
   * yet", not "no owner" — the dev warning must not fire on it.
   */
  private readonly _scrollOwnerResolved = signal(false);

  /** @private Latches the dev-mode "no scroll owner" warning to once per panel. */
  private _warnedNoScrollOwner = false;

  /** @private Host element, used to scroll the active option into view (activedescendant model). */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** @private Angular-provided document used to access the browser viewport safely. */
  private readonly _document = inject(DOCUMENT);
  /** @private Whether this panel is running in a browser — the viewport height only exists there. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * @private Renders a grown window synchronously from inside a keydown, so the
   * new rows are registered with aria before its own keydown handler runs.
   */
  private readonly _changeDetector = inject(ChangeDetectorRef);

  /** @private Clears the typeahead mirror's timer on destroy. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private Mirror of aria's listbox typeahead state — the accumulated query
   * and the active index the burst started from — kept so the panel can find
   * a match past the rendered window before aria searches the rows it has.
   * Updated on every typeahead key, window or not, so it never falls out of
   * step with aria's own.
   */
  private _typeahead: { query: string; start: number | undefined } = {
    query: '',
    start: undefined,
  };

  /** @private Resets {@link _typeahead} after aria's delay, as aria resets its own. */
  private _typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Deliberately platform-gated rather than merely `defaultView`-gated: a
    // server document *has* a `defaultView`, but no `innerHeight`, so the
    // subscription used to publish `NaN` into `[style.max-height.px]` on every
    // server render.
    const viewport = this._isBrowser ? this._document.defaultView : null;
    if (viewport) {
      fromEvent(viewport, 'resize')
        .pipe(startWith(null), takeUntilDestroyed())
        .subscribe(() => {
          this._defaultMaxHeight.set(viewport.innerHeight * 0.4);
        });
    }

    this._selectionService.focusFirst$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this._listSelectable()?.focusFirst();
      });

    // Keep the activedescendant-active option scrolled into view. DOM focus
    // never lands on the option in this mode (it stays on the owning combobox
    // input), so the native scroll-on-focus does not apply. An after-render
    // effect, not a plain one: an active index past the rendered window grows
    // it (`_window`), and the row only exists once that render is done.
    afterRenderEffect(() => {
      const index = this.activeIndex();
      if (this.focusMode() !== 'activedescendant' || index < 0) return;
      const el = this._host.nativeElement.querySelector<HTMLElement>(
        `[id="${this.optionId(index)}"]`,
      );
      // Optional call: `scrollIntoView` is absent in some environments (jsdom).
      el?.scrollIntoView?.({ block: 'nearest' });
    });

    // aria's keyboard model only sees registered rows, so a key whose target
    // lies past the window has to render it first. Capture phase on the host:
    // it runs before the listbox's own keydown listener on a descendant.
    // A click or focus inside the listbox ends aria's default-state phase just
    // as a key does (`ListboxPattern.onClick` / `onFocusIn`), so the window
    // stops pinning the default tab stop on the same events.
    if (this._isBrowser) {
      const host = this._host.nativeElement;
      fromEvent<KeyboardEvent>(host, 'keydown', { capture: true })
        .pipe(takeUntilDestroyed())
        .subscribe((event) => this._onKeydownCapture(event));
      fromEvent(host, 'click', { capture: true })
        .pipe(takeUntilDestroyed())
        .subscribe((event) => this._markInteracted(event));
      fromEvent(host, 'focusin', { capture: true })
        .pipe(takeUntilDestroyed())
        .subscribe((event) => this._markInteracted(event));
      this._destroyRef.onDestroy(() => clearTimeout(this._typeaheadTimer));
    }

    // Resolve the paging sentinel's scroll owner once the view exists: the
    // panel's own scrollbar viewport, or the ancestor popup viewport it
    // delegates scrolling to.
    afterNextRender(() => {
      const own = this._scrollbar()?.viewportElement ?? null;
      const parent = this._host.nativeElement.closest<HTMLElement>(
        '.mlv-scrollbar__viewport',
      );
      this._scrollContainer.set(this.scrollMode() === 'self' ? own : parent);
      this._scrollOwnerResolved.set(true);
    });

    // Dev-mode diagnostic: `hasMore` with no scroll owner is silent —
    // `scrollMode="parent"` finds nothing unless the panel renders inside an
    // `mlv-scrollbar` viewport. Re-checked reactively so a `hasMore` that flips
    // true later is caught too; warned at most once per panel instance. A long
    // list needs no warning there: with no owner every option is rendered
    // (`_renderCount`), as before windowing.
    if (isDevMode()) {
      effect(() => {
        const missing = this.hasMore() && this._noScrollOwner();
        if (!missing) return;
        untracked(() => {
          if (this._warnedNoScrollOwner) return;
          this._warnedNoScrollOwner = true;
          console.warn(
            '[mlv-dropdown-panel] hasMore is set but no scroll owner was found — in scrollMode="parent" the panel must render inside an mlv-scrollbar viewport (e.g. mlv-popup); lazy paging will not fire on scroll.',
          );
        });
      });
    }

    // Auto-fill: after any render where the option set or the window changed,
    // re-measure so a short page immediately requests the next one — and a
    // window that still does not fill the scroll owner grows again.
    afterRenderEffect(() => {
      this.options();
      this._renderCount();
      this._infiniteScroll()?.check();
    });
  }

  /**
   * @protected The paging sentinel came within {@link infiniteScrollThreshold}
   * of the end. Rows still withheld by the window come first — a page more of
   * them — and {@link loadMore} is emitted only once every bound option is
   * rendered, so a source is paged at the same point it always was.
   *
   * The window grows only while the scroll owner has layout. Everywhere the
   * owner is not laid out — a hidden panel, a server render, jsdom — every
   * metric reads `0`, which the sentinel takes for "at the end", and each grown
   * page would re-arm it until the whole list was rendered.
   */
  protected _onSentinel(): void {
    if (!this._windowTruncated()) {
      this.loadMore.emit();
      return;
    }
    const owner = this._scrollContainer();
    if (!owner || owner.clientHeight === 0) return;
    this._window.update((state) => ({
      ...state,
      limit: state.limit + DROPDOWN_WINDOW_PAGE,
    }));
  }

  /**
   * @private Latches {@link DropdownWindowState.interacted} for a click or
   * focus that reached this panel's listbox — the events aria's
   * `ListboxPattern` sets `hasBeenInteracted` on — so the window stops pinning
   * {@link _defaultTabStop}. aria counts a key or click only while the listbox
   * is not disabled, but a focus always, and focus precedes any real key or
   * pointer activation, so the unconditional latch changes nothing observable.
   */
  private _markInteracted(event: Event): void {
    const target = event.target as Element | null;
    if (!target?.closest) return;
    if (target.closest('[role="listbox"]')?.id !== this._resolvedListboxId())
      return;
    if (this._window().interacted) return;
    this._window.update((state) => ({ ...state, interacted: true }));
  }

  /**
   * @private Renders, before aria handles a key, the row that key moves to
   * when it lies past the window: End, Home, ArrowDown off the last rendered
   * row, ArrowUp wrapping from the first, a typeahead match, and Ctrl/Cmd+A in
   * a multi-select (which selects every option). Then aria runs its own
   * unchanged semantics over rows that now include the target.
   *
   * The key table mirrors `ListboxPattern.keydown` for the panel's
   * configuration ({@link MIRRORED_LISTBOX_CONFIG}: vertical, wrapping,
   * `selectionMode="explicit"`, `softDisabled` off so a disabled option is
   * skipped) modifier for modifier, so the panel never renders for a key aria
   * then ignores. Any key reaching the listbox also ends aria's default-state
   * phase, so it latches {@link DropdownWindowState.interacted} first.
   */
  private _onKeydownCapture(event: KeyboardEvent): void {
    const target = event.target as Element | null;
    const listboxId = this._resolvedListboxId();
    if (target?.closest('[role="listbox"]')?.id !== listboxId) return;
    this._markInteracted(event);

    const modifiers =
      (event.ctrlKey ? 1 : 0) |
      (event.shiftKey ? 2 : 0) |
      (event.altKey ? 4 : 0) |
      (event.metaKey ? 8 : 0);
    const none = modifiers === 0;
    const multiple = this.multiple();
    // Ctrl+Shift / Cmd+Shift: the multi-select range extension to either end.
    const rangeToEnd = multiple && (modifiers === 3 || modifiers === 10);
    // Shift: the multi-select range extension by one row.
    const rangeByOne = multiple && modifiers === 2;

    let index = -1;
    if (event.key === 'End' && (none || rangeToEnd)) {
      index = this._lastFocusable();
    } else if (event.key === 'Home' && (none || rangeToEnd)) {
      index = this._firstFocusable();
    } else if (event.key === 'ArrowDown' && (none || rangeByOne)) {
      // Raw `event.key`, no `normalizeArrowKey`: the listbox is vertical-only,
      // so no horizontal pair is bound and RTL mirroring would be a no-op.
      index = this._nextFocusable(this._activeOptionIndex(target));
    } else if (event.key === 'ArrowUp' && (none || rangeByOne)) {
      index = this._previousFocusable(this._activeOptionIndex(target));
    } else if (
      multiple &&
      (modifiers === 1 || modifiers === 8) &&
      event.key.toLowerCase() === 'a'
    ) {
      index = this.options().length - 1;
    } else if (none && !event.repeat && TYPEAHEAD_KEY.test(event.key)) {
      index = this._typeaheadMatch(event.key, target);
    }

    if (index >= this._renderCount()) {
      this._window.update((state) => ({
        ...state,
        limit: Math.max(state.limit, windowLimitFor(index)),
      }));
      this._changeDetector.detectChanges();
    }
  }

  /**
   * @private The flat index of the option aria treats as active: the focused
   * row in roving mode (aria moves focus synchronously), else the row aria
   * marks `data-active`. `-1` when there is none.
   */
  private _activeOptionIndex(target: Element | null): number {
    const row =
      target?.closest('[role="option"]') ??
      this._host.nativeElement.querySelector(
        '[role="option"][data-active="true"]',
      );
    const prefix = `${this._resolvedListboxId()}-option-`;
    if (!row?.id.startsWith(prefix)) return -1;
    const index = Number(row.id.slice(prefix.length));
    return Number.isInteger(index) ? index : -1;
  }

  /** @private Whether aria's keyboard can land on the option at `index`. */
  private _isFocusable(index: number): boolean {
    return !this.options()[index].disabled;
  }

  /** @private First option aria can focus, or `-1`. */
  private _firstFocusable(): number {
    const count = this.options().length;
    for (let i = 0; i < count; i++) if (this._isFocusable(i)) return i;
    return -1;
  }

  /** @private Last option aria can focus, or `-1`. */
  private _lastFocusable(): number {
    for (let i = this.options().length - 1; i >= 0; i--) {
      if (this._isFocusable(i)) return i;
    }
    return -1;
  }

  /** @private Where ArrowDown lands from `active`: the next focusable option, wrapping. */
  private _nextFocusable(active: number): number {
    const count = this.options().length;
    for (let i = active + 1; i < count; i++) if (this._isFocusable(i)) return i;
    return this._firstFocusable();
  }

  /** @private Where ArrowUp lands from `active`: the previous focusable option, wrapping. */
  private _previousFocusable(active: number): number {
    for (let i = active - 1; i >= 0; i--) if (this._isFocusable(i)) return i;
    return this._lastFocusable();
  }

  /**
   * @private Advances the {@link _typeahead} mirror by `key` exactly as aria's
   * `ListTypeahead.search` advances its own, and returns the option aria's
   * search would land on over the **whole** list — the first focusable option
   * after the burst's start whose label starts with the query, wrapping — or
   * `-1`. aria scans its registered rows in the same order, so once the window
   * reaches that option aria finds the same one.
   */
  private _typeaheadMatch(key: string, target: Element | null): number {
    const state = this._typeahead;
    if (!state.query && key === ' ') return -1;
    if (state.start === undefined)
      state.start = this._activeOptionIndex(target);
    state.query += key.toLowerCase();
    clearTimeout(this._typeaheadTimer);
    this._typeaheadTimer = setTimeout(() => {
      this._typeahead = { query: '', start: undefined };
    }, MIRRORED_LISTBOX_CONFIG.typeaheadDelay);

    const options = this.options();
    const count = options.length;
    for (let i = 0; i < count; i++) {
      const index = (state.start + 1 + i) % count;
      if (
        this._isFocusable(index) &&
        options[index].label.toLowerCase().startsWith(state.query)
      ) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Whether `value` is in the committed {@link selectedValues} under the
   * comparator in force ({@link compareWith}) — the predicate behind each
   * row's check-mark.
   *
   * The template does **not** call this per row; it reads the materialised
   * {@link _checkedRows} instead, which is this same predicate applied once
   * per option per selection change rather than once per option per render.
   * The two share {@link _selectedValueIndex}, so they cannot answer
   * differently.
   */
  isValueSelected(value: T): boolean {
    return this._selectedValueIndex().has(value);
  }

  /**
   * Deterministic DOM `id` for the option at `index`, forwarded to aria's
   * `ngOption` id. An owning combobox computes the same id (via the shared
   * {@link optionId} helper) to wire its input's `aria-activedescendant`.
   */
  optionId(index: number): string {
    return optionId(this._resolvedListboxId(), index);
  }

  /**
   * Re-emits the aria listbox selection. `@angular/aria`'s `ngListbox` emits the
   * selected values array directly (unlike CdkListbox's `ListboxValueChangeEvent`).
   *
   * In a multi-select whose window withholds committed values from aria (see
   * `_committedSplit`), aria's array lacks them, so they are put back where
   * they were: every committed value aria still holds or never saw, in the
   * committed order, then whatever aria added, in aria's order — exactly the
   * array aria would have emitted with every row rendered. Membership is
   * SameValueZero, aria's own `includes`. A single-select passes through: aria
   * replaces its value there, so a withheld value is superseded, not lost.
   */
  onValueChange(values: readonly T[]): void {
    const { committed, withheld } = this._committedSplit();
    if (!this.multiple() || withheld.size === 0) {
      this.valueChange.emit(values);
      return;
    }
    const kept = new Set(values);
    const merged = committed.filter(
      (value) => withheld.has(value) || kept.has(value),
    );
    const known = new Set(committed);
    for (const value of values) if (!known.has(value)) merged.push(value);
    this.valueChange.emit(merged);
  }
}
