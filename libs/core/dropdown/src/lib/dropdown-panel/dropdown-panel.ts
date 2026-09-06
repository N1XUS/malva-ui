import type { TemplateRef } from '@angular/core';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
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
import { fromEvent, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
   * {@link loading} is `true`. Localise by binding a translated string.
   * @default 'Loading…'
   */
  readonly loadingText = input<string>('Loading…');

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
   * @protected The options clustered into consecutive same-group runs for
   * rendering under sticky headers. Consecutive-run grouping (no reordering)
   * keeps DOM order identical to the flat `options()` order, so option indices,
   * `optionId`, `activeIndex`, and aria's DOM-order navigation all stay aligned.
   * Each entry retains its flat index into `options()`. A run of options without
   * a group (empty/undefined) becomes a headerless cluster (`label: null`).
   */
  protected readonly _groups = computed<DropdownOptionGroup<T>[]>(() => {
    const listboxId = this._resolvedListboxId();
    const groups: DropdownOptionGroup<T>[] = [];
    this.options().forEach((option, index) => {
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
   * A value matching no rendered option is passed through unchanged, so aria
   * still filters it and still re-emits — unchanged behaviour, and the case
   * `isReconciliationEmit` / `filteredOutCommitted` exist to absorb in an
   * owning control.
   */
  protected readonly _ariaValues = computed<T[]>(() => {
    const options = this._optionValueIndex();
    return this.selectedValues().map((value) => options.resolve(value));
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
    // input), so the native scroll-on-focus does not apply.
    effect(() => {
      const index = this.activeIndex();
      if (this.focusMode() !== 'activedescendant' || index < 0) return;
      const el = this._host.nativeElement.querySelector<HTMLElement>(
        `[id="${this.optionId(index)}"]`,
      );
      // Optional call: `scrollIntoView` is absent in some environments (jsdom).
      el?.scrollIntoView?.({ block: 'nearest' });
    });

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

    // Dev-mode diagnostic: an armed sentinel with no scroll owner is silent —
    // `scrollMode="parent"` finds nothing unless the panel renders inside an
    // `mlv-scrollbar` viewport. Re-checked reactively so a `hasMore` that flips
    // true later is caught too; warned at most once per panel instance.
    if (isDevMode()) {
      effect(() => {
        const missing =
          this.hasMore() &&
          this._scrollOwnerResolved() &&
          this._scrollContainer() === null;
        if (!missing) return;
        untracked(() => {
          if (this._warnedNoScrollOwner) return;
          this._warnedNoScrollOwner = true;
          console.warn(
            '[mlv-dropdown-panel] hasMore is set but no scroll owner was found — in scrollMode="parent" the panel must render inside an mlv-scrollbar viewport (e.g. mlv-popup); lazy paging will not fire.',
          );
        });
      });
    }

    // Auto-fill: after any render where the option set changed, re-measure so a
    // short page immediately requests the next one.
    afterRenderEffect(() => {
      this.options();
      this._infiniteScroll()?.check();
    });
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
   */
  onValueChange(values: readonly T[]): void {
    this.valueChange.emit(values);
  }
}
