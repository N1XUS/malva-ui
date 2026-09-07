import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { ElementRef, Signal } from '@angular/core';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { NgTemplateOutlet } from '@angular/common';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupContainer,
  MlvPopupHeaderContent,
} from '@malva-ui/core/popup';
import type { MlvPopupMobileMode } from '@malva-ui/core/popup';
import type {
  MlvFormControl,
  MlvFormControlLabelStrategy,
} from '@malva-ui/core/form-utils';
import {
  MlvDescription,
  MlvFormControlWrapper,
  MlvFormControlWrapperControl,
  fromAriaValues,
  MlvHint,
  MlvLabel,
  MLV_FORM_CONTROL,
  MlvMessage,
  MlvSelectionService,
  toAriaValues,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import type {
  MlvOptionMatcher,
  MlvOptionsInput,
  MlvOptionsSearchFn,
  MlvSelectOption,
  MlvSelectOptionTransform,
  MlvValueIndex,
} from '@malva-ui/core/dropdown';
import {
  MlvActiveDescendant,
  defaultCompareWith,
  defaultOptionTransform,
  DROPDOWN_POSITIONS,
  filteredOutCommitted,
  isReconciliationEmit,
  MlvDropdownPanel,
  MlvOptionsAdapter,
  filterOptions,
  optionId,
  valueIndex,
} from '@malva-ui/core/dropdown';
import { MlvChip } from '@malva-ui/core/chip';
import {
  MlvComboboxItemDef,
  MlvComboboxSelectedItemDef,
} from '../combobox-template.directives';
import { LucideChevronDown } from '@lucide/angular';
import { MlvResizeObserver } from '@malva-ui/cdk/utils';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvInput } from '@malva-ui/core/input';
import {
  MLV_COMBOBOX_I18N,
  MLV_FORM_UTILS_I18N,
  MlvI18nResolverService,
} from '@malva-ui/i18n';
import { MlvLoader } from '@malva-ui/core/loader';
import { MlvButtonClose } from '@malva-ui/core/button';

@Component({
  selector: 'mlv-combobox',
  imports: [
    NgTemplateOutlet,
    MlvPopup,
    MlvPopupContent,
    MlvPopupContainer,
    MlvPopupHeaderContent,
    MlvDescription,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvHint,
    MlvLabel,
    MlvMessage,
    LucideChevronDown,
    MlvResizeObserver,
    MlvDropdownPanel,
    MlvInput,
    MlvChip,
    MlvButtonClose,
    MlvLoader,
  ],
  templateUrl: './combobox.html',
  styleUrl: './combobox.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    MlvSelectionService,
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvCombobox),
    },
  ],
  host: {
    class: 'mlv-combobox',
    '[class]': '"mlv-combobox--" + resolvedState()',
    '[class.mlv-combobox--disabled]': 'computedDisabled()',
    '[class.mlv-combobox--open]': 'isOpen()',
    '[class.mlv-combobox--multiple]': 'multiple()',
    '[class.mlv-combobox--loading]': '_awaitingValueLabel()',
  },
})
export class MlvCombobox<T>
  extends MlvSignalFormControlBase<T | T[] | null>
  implements MlvFormControl
{
  /**
   * @protected {@link id} is forwarded to the inner `mlv-input`, which puts it
   * on a native `<input>` — labelable, so a projected `<mlv-label>` names it
   * with a plain `for` even though the input also carries `role="combobox"`.
   */
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'native';
  }

  /** The scalar, array, or null selection used by all Angular forms APIs. */
  readonly value = model<T | T[] | null>(null);
  /**
   * Selectable options: a plain array, an observable of arrays, or an
   * `MlvDataSource` (source-side search + lazy paging). Arrays and observables
   * are filtered locally by the typed query; a data source owns its filtering
   * and receives the query through `setSearch`.
   */
  readonly options = input<MlvOptionsInput<T>>([]);
  /**
   * Remote search: `(query) => T[] | Promise<T[]> | Observable<T[]>`. When set it
   * supersedes {@link options} as the item source; the list is not filtered
   * locally. Bind `[loading]` yourself if you want a spinner beyond the
   * source-owned one.
   */
  readonly searchFn = input<MlvOptionsSearchFn<T> | null>(null);
  /** Debounce (ms) for remote searches (`MlvDataSource` / {@link searchFn}). Local filtering stays instant. */
  readonly searchDebounce = input<number>(200);
  /** Whether multiple options can be selected at once. */
  readonly multiple = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** Custom placeholder override. Falls back to the i18n-provided placeholder. */
  readonly placeholder = input<string | undefined>(undefined);
  /** Whether the user can create a new value via Enter when no option matches. */
  readonly allowCreate = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  readonly toOption = input<MlvSelectOptionTransform<T>>(
    defaultOptionTransform as MlvSelectOptionTransform<T>,
  );

  /**
   * Equality predicate used to match option values against the current
   * selection (and against values written through any forms binding).
   * Defaults to reference equality. Provide a custom comparator — e.g.
   * `(a, b) => a.id === b.id` — so object values survive a serialize /
   * deserialize round-trip and still match their option instances (check-marks
   * and the displayed label stay in agreement).
   */
  readonly compareWith = input<(a: T, b: T) => boolean>(defaultCompareWith);

  /**
   * Custom predicate deciding whether an option satisfies the current query
   * (e.g. fuzzy or secondary-field matching). Defaults to the shared case- and
   * diacritic-insensitive substring match. Filtered results are always ranked
   * prefix-matches-first by the shared `filterOptions`, regardless of matcher.
   * Mirrors `[mlvAutocomplete]`'s `mlvAutocompleteMatcher`.
   */
  readonly matcher = input<MlvOptionMatcher<T> | undefined>(undefined);

  /** Emitted only when the user actually creates a brand-new value via Enter. */
  readonly valueCreated = output<T>();

  /**
   * Controls whether the dropdown renders as a full-screen mobile sheet.
   *
   * Passed straight through to the underlying `mlv-popup`. Defaults to
   * `'auto'` — full-screen below the `md` breakpoint (viewport < 768px),
   * trigger-anchored above it — matching `mlv-select` and the date/time
   * pickers. Set to `'off'` to always anchor, or `'fullscreen'` to always
   * render the sheet (e.g. demos).
   *
   * In full-screen mode the search field would normally be occluded by the
   * solid backdrop and blocked by the sheet's focus trap (it lives in the
   * trigger row, outside the overlay panel). The combobox therefore projects an
   * **in-sheet search input** into the popup's `[mlvPopupHeaderContent]` slot,
   * wired to the same `searchQuery` and keyboard handlers, so type-to-filter
   * keeps working.
   */
  readonly mobileMode = input<MlvPopupMobileMode>('auto');

  /**
   * Density applied to the dropdown's option list.
   *
   * The dropdown panel is portaled to the CDK overlay container, outside the
   * component's DOM tree, so ancestor density classes cannot cascade into it.
   * This input is forwarded to the underlying `mlv-popup`, which stamps the
   * resolved `mlv--{density}` class on the detached panel. When omitted, the
   * nearest ancestor `MLV_DENSITY_CONTEXT` (e.g. a `form[mlvForm]`) applies,
   * then the global `MlvDensityService`.
   */
  readonly mlvDensity = input<MlvDensity | undefined>(undefined);

  /**
   * Optional visible heading rendered in the full-screen sheet's header bar.
   * When omitted, falls back to the field's `label` (or, when unset, the
   * resolved placeholder). Only shown while the dropdown is full-screen.
   */
  readonly mobileTitle = input<string | undefined>(undefined);

  /**
   * Raises the dropdown panel's minimum width above its trigger.
   *
   * The panel is floored at the trigger's measured width by default. This
   * input can only **raise** that floor — a value narrower than the trigger
   * does not shrink the panel, because the trigger width stays in the
   * resolved `max()`.
   *
   * Accepts a number of pixels or a CSS length string; the units resolve in
   * the browser, not here. Absolute and font-relative lengths (`px`, `rem`,
   * `em`, `ch`) and viewport units (`vw`) behave as written. **Percentages do
   * not** — under flexible dimensions CDK lays the pane out as a `static` flex
   * item of its bounding box, which it sizes to the space between the
   * trigger's anchored edge and the viewport edge, so `'50%'` means half of
   * *that*, and the same markup resolves differently depending on where the
   * trigger sits on the page. `ch`, likewise, resolves against the pane's own
   * font, not the option rows'.
   *
   * Two ceilings it deliberately outranks, per CSS's
   * `max(min-width, min(max-width, width))`:
   * - {@link dropdownMaxWidth} — a ceiling below the effective floor is
   *   ignored, and the panel renders past its bounding box (nothing clips it).
   * - the viewport. A floor wider than the space to the viewport edge pushes
   *   the panel off-screen; the `.cdk-overlay-pane { max-width: 100% }` clamp
   *   governs *content*-driven growth only.
   */
  readonly dropdownMinWidth = input<number | string | undefined>(undefined);

  /**
   * Caps the dropdown panel's width.
   *
   * With no value the viewport is the only ceiling — the flexible connected
   * strategy sizes its bounding box to the space up to the viewport edge and
   * `.cdk-overlay-pane { max-width: 100% }` caps the pane there. This input can
   * only **tighten** that: a value wider than the viewport is still clamped by
   * it. Accepts a CSS length string or a number of pixels.
   *
   * It cannot pull the panel below its floor. CSS resolves the used width as
   * `max(min-width, min(max-width, width))`, so a ceiling under the effective
   * floor — the trigger width, or {@link dropdownMinWidth} when that is higher
   * — is **silently ignored** and the panel overflows its bounding box, which
   * has no `overflow: hidden`. Set the floor down as well if you need the
   * panel narrower than its trigger.
   */
  readonly dropdownMaxWidth = input<number | string | undefined>(undefined);

  /**
   * @protected Resolved full-screen sheet title: explicit `mobileTitle` input
   * takes precedence over the field's label, then the resolved placeholder.
   */
  protected readonly _resolvedMobileTitle = computed(
    () => this.mobileTitle() ?? (this.label() || this._resolvedPlaceholder()),
  );

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_COMBOBOX_I18N);

  protected readonly _formI18n = inject(MLV_FORM_UTILS_I18N);

  /** @protected Resolved placeholder: explicit input takes precedence over i18n default. */
  protected readonly _resolvedPlaceholder = computed(
    () => this.placeholder() ?? this._i18n().searchPlaceholder,
  );

  /**
   * @protected Accessible name forwarded to the dropdown panel's inner
   * `role="listbox"` (`mlv-dropdown-panel`'s `ariaLabel`). Mirrors the outer
   * trigger input's own resolution — the visible {@link label} when set
   * (linked there via the wrapper's `<mlv-label for>`), else the explicit
   * {@link ariaLabel} input (rendered as the trigger's own `aria-label`) — so
   * the listbox shares the same accessible name as the field it belongs to.
   * `null` when neither is set, same as an unlabelled trigger.
   */
  protected readonly _panelAriaLabel = computed(
    () => this.label() || this.ariaLabel(),
  );

  // Override focused to also be true when the popup is open so the field keeps
  // its focus ring while the dropdown is showing.
  override readonly focused = computed(() => this._focused() || this.isOpen());

  /**
   * @private Latches `true` the first time a **remote** source reports
   * `ready()`, and never flips back. It gates {@link _adapter}'s `eager` flag
   * off for good.
   *
   * Without the latch, a `searchFn` bound to an inline arrow — a fresh
   * reference on every change detection run — re-arms the adapter's lazy gate
   * on every pass; while `eager` is still `true` (a committed value the first
   * response did not contain) each pass would fire another request, whose
   * result triggers the next pass. The latch bounds that to exactly one eager
   * load per mount.
   */
  private readonly _eagerDone = signal(false);

  /**
   * @protected Shared source adapter — arrays / observables are local (this
   * component filters), a data source or a `searchFn` is remote (the source
   * filters and the items render as-is). Template-facing: the paging bindings
   * (`hasMore` / `loadingMore` / `loadMore`) read straight off it.
   *
   * The `eager` closure reads {@link hasValue} / {@link _allValuesMatched}
   * lazily, so declaring those below is fine — the adapter's effects run after
   * construction. A committed value with no resolvable label is what makes a
   * `searchFn` load without waiting for the first open. The explicit type
   * annotation breaks the inference cycle that closure creates
   * (`_adapter` → `eager` → `_allValuesMatched` → `resolvedOptions` → `_adapter`).
   */
  protected readonly _adapter: MlvOptionsAdapter<T> = new MlvOptionsAdapter<T>({
    source: this.options,
    searchFn: this.searchFn,
    debounce: this.searchDebounce,
    eager: computed(
      () => this.hasValue() && !this._allValuesMatched() && !this._eagerDone(),
    ),
  });

  /** @private ICU resolver for parameterised i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @private Last query sent to a remote source (so a close can reset it once). */
  private _remoteQuery = '';

  readonly resolvedOptions = computed(() =>
    this._adapter.items().map((item) => this.toOption()(item)),
  );

  /**
   * @private The resolved option **values**, indexed for repeated membership /
   * resolution queries under {@link compareWith}. Rebuilt only when the option
   * list or the comparator changes, and shared by every value-vs-options check
   * in this control ({@link _allValuesMatched}, {@link _chipOptions},
   * `_applyPendingValues`) — each of those used to run its own nested
   * `selected × options` scan, so with a lazily paged source the total cost of
   * a scroll session grew quadratically as pages accumulated.
   *
   * Carries an explicit type annotation for the same reason {@link _adapter}
   * does: it is a new node on that documented inference cycle
   * (`_adapter` → `eager` → `_allValuesMatched` → `_optionValueIndex` →
   * `resolvedOptions` → `_adapter`), and pinning the type there keeps the
   * cycle broken at two points rather than one. It is a `computed`, so nothing
   * evaluates it during field initialisation — the adapter reads `eager` only
   * from its effects, which run after construction.
   */
  private readonly _optionValueIndex: Signal<MlvValueIndex<T>> = computed(() =>
    valueIndex(
      this.resolvedOptions(),
      this.compareWith(),
      (option) => option.value,
    ),
  );

  readonly isOpen = signal(false);
  /** Current text in the input. For single-select this doubles as the committed label when not actively searching. */
  readonly searchQuery = signal('');
  /**
   * Measured pixel width of the trigger, fed to the dropdown as its **minimum**
   * width. The panel is never narrower than the trigger and grows past it to
   * fit a longer option rather than clipping it (#150).
   */
  readonly triggerWidth = signal(0);

  /**
   * @protected The floor handed to the popup: the measured trigger width, or a
   * CSS `max()` of it and {@link dropdownMinWidth} when that is set.
   *
   * Expressed as `max()` rather than resolved in TypeScript so the author's
   * units (`rem`, `ch`, `%`, `vw`) keep their meaning — px is the only unit
   * `triggerWidth` can be measured in, and converting the other side to it
   * would freeze it against the root font size at open time.
   */
  protected readonly _resolvedDropdownMinWidth = computed<number | string>(
    () => {
      const trigger = this.triggerWidth();
      const floor = this.dropdownMinWidth();
      if (floor === undefined) return trigger;
      const authored = typeof floor === 'number' ? `${floor}px` : floor;
      return `max(${trigger}px, ${authored})`;
    },
  );

  /** @private Whether `searchQuery` represents live user search text (vs. a displayed committed label). */
  private readonly _searching = signal(false);
  /**
   * @private Shared activedescendant bookkeeping: tracks the active (highlighted)
   * option index over the filtered options with wrap-around navigation. The same
   * engine backs `[mlvAutocomplete]`.
   */
  private readonly _activeDescendant = new MlvActiveDescendant(
    () => this.filteredOptions().length,
  );

  /** @protected Exposed to the template for the panel's `[activeIndex]`. */
  protected readonly activeIndex = this._activeDescendant.index;

  /** The HTML `id` assigned to the inner listbox element for `aria-controls` linking. */
  readonly listboxId = computed(() => `${this.id()}-listbox`);

  /**
   * Ordered CDK positions handed to the dropdown's overlay: below the trigger
   * first, flipping above it, then anchoring the panel's inline-end edge to the
   * trigger when there is not enough room after it. See
   * {@link DROPDOWN_POSITIONS}, shared with `mlv-select` and
   * `[mlvAutocomplete]`.
   */
  readonly dropdownPositions: ConnectedPosition[] = DROPDOWN_POSITIONS;

  readonly filteredOptions = computed(() => {
    const resolved = this.resolvedOptions();
    // Remote sources (data source / `searchFn`) own their filtering — filtering
    // again here would hide server results that do not match the local matcher,
    // and would empty the list while a newer query is still in flight.
    if (this._adapter.mode() === 'remote') return resolved;
    const query = this._searching() ? this.searchQuery() : '';
    // Shared substring filter (case- and diacritic-insensitive; blank query
    // returns every option; prefix matches ranked first) — extracted to
    // `@malva-ui/core/dropdown` so the same matching powers `[mlvAutocomplete]`.
    return filterOptions(resolved, query, this.matcher());
  });

  /**
   * @protected The live query to highlight inside each suggestion (matched
   * substring emphasis). Empty unless the user is actively searching, so a
   * committed single-select label is never highlighted.
   */
  protected readonly _highlightQuery = computed(() =>
    this._searching() ? this.searchQuery().trim() : '',
  );

  /** @protected The options currently selected, resolved to `MlvSelectOption` for chip / template rendering. */
  protected readonly selectedOptions = computed<MlvSelectOption<T>[]>(() => {
    const transform = this.toOption();
    return this.selectionService
      .selectedValues()
      .map((value) => transform(value));
  });

  /** @protected The single-select committed label, or `''` when nothing is selected. */
  protected readonly _committedLabel = computed(() => {
    const opts = this.selectedOptions();
    return opts.length ? opts[0].label : '';
  });

  /** @protected Whether every committed value has a matching option (by `compareWith`). */
  protected readonly _allValuesMatched = computed(() => {
    const options = this._optionValueIndex();
    return this.selectionService.selectedValues().every((v) => options.has(v));
  });

  /** @protected First payload arrived and no consumer-driven `loading`. */
  protected readonly _ready = computed(
    () => this._adapter.ready() && !this.loading(),
  );

  /**
   * @protected Loading variant: a value is committed but no option resolves its
   * label yet. The field is inert (readonly, no open) and shows a spinner in
   * place of the chevron until the first load resolves.
   */
  protected readonly _awaitingValueLabel = computed(
    () => this.hasValue() && !this._ready() && !this._allValuesMatched(),
  );

  /** @protected Panel spinner row: source-owned loading OR the consumer's `[loading]`. */
  protected readonly _panelLoading = computed(
    () => this._adapter.loading() || this.loading(),
  );

  /** @protected Chips to render: while awaiting, only options that resolved. */
  protected readonly _chipOptions = computed(() => {
    const selected = this.selectedOptions();
    if (!this._awaitingValueLabel()) return selected;
    const options = this._optionValueIndex();
    return selected.filter((s) => options.has(s.value));
  });

  /** @protected `Press Enter to add "{query}"` resolved through i18n. */
  protected readonly _pressEnterToAdd = computed(() =>
    this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'pressEnterToAdd',
      { query: this.searchQuery().trim() },
    ),
  );

  /**
   * @protected Whether the custom single-select display template should render
   * over the input: single-select, a `selectedTemplate` is provided, a value is
   * committed, and the field is not currently focused/searching (so the raw
   * input text is shown for editing while focused).
   */
  protected readonly _showSingleTemplate = computed(
    () =>
      !this.multiple() &&
      !!this.selectedTemplate()?.templateRef &&
      !!this._committedLabel() &&
      !this.focused(),
  );

  /** @protected `aria-activedescendant` target: the DOM id of the active option row, or `null`. */
  protected readonly _activeOptionId = computed(() => {
    const index = this._activeDescendant.index();
    if (index < 0 || index >= this.filteredOptions().length) return null;
    return optionId(this.listboxId(), index);
  });

  /**
   * @protected Polite screen-reader announcement of the current result count.
   * Empty while the popup is closed so no stale count is read out. Mirrors the
   * visible empty-state copy rendered inside the dropdown panel.
   */
  protected readonly _resultsAnnouncement = computed(() => {
    if (!this.isOpen()) return '';
    const count = this.filteredOptions().length;
    if (count === 0) {
      return this.allowCreate() && this.searchQuery().trim()
        ? this._pressEnterToAdd()
        : this._i18n().noResults;
    }
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'resultsAvailable',
      { count },
    );
  });

  readonly selectionService =
    inject<MlvSelectionService<T>>(MlvSelectionService);

  itemTemplate = contentChild(MlvComboboxItemDef);
  selectedTemplate = contentChild(MlvComboboxSelectedItemDef);

  /** @private The inner `mlv-input` — the tab stop and focus target for the whole control. */
  private readonly _input = viewChild(MlvInput);

  /** @private The trigger row element (chips + input + chevron), used as the popup's click-outside exclusion. */
  private readonly _triggerRef = viewChild<ElementRef<HTMLElement>>('trigger');

  /** @private The dropdown popup — read to know whether it is rendering as a full-screen sheet. */
  private readonly _popupRef = viewChild(MlvPopup);

  /**
   * @protected Whether the dropdown is currently a full-screen mobile sheet
   * (mirrors `mlv-popup`'s own `isFullscreen()`). Drives the in-sheet search
   * input's ARIA/focus handoff and suppresses the outer trigger input's
   * combobox semantics so exactly one `role="combobox"` is exposed at a time.
   */
  protected readonly _isFullscreen = computed<boolean>(
    () => this._popupRef()?.isFullscreen() ?? false,
  );

  /**
   * @protected Whether the outer trigger input owns the combobox semantics.
   * `false` only while the full-screen sheet is actually open — then the
   * in-sheet input is the live combobox and the outer input relinquishes the
   * role/ARIA so exactly one `role="combobox"` is exposed. While anchored (or
   * full-screen but closed, when the outer input is the visible trigger) the
   * outer input keeps the combobox semantics.
   */
  protected readonly _outerIsCombobox = computed(
    () => !(this._isFullscreen() && this.isOpen()),
  );

  /**
   * @protected DOM `id` of the in-sheet search input. Distinct from the outer
   * input's `id()` so both can coexist while full-screen and the in-sheet field
   * can be focus-targeted by id after the sheet opens.
   */
  protected readonly _sheetInputId = computed(() => `${this.id()}-sheet-input`);

  /**
   * @protected Elements the backdrop-less dropdown popup treats as "inside" for
   * click-outside dismissal. The trigger row lives outside the floating panel,
   * so without this a click on the input (e.g. to reposition the caret) would
   * dismiss the open list. Passed to `mlv-popup`'s `dismissExcludeElements`.
   */
  protected readonly _popupExcludeElements = computed<HTMLElement[]>(() => {
    const el = this._triggerRef()?.nativeElement;
    return el ? [el] : [];
  });

  /** @private Raw values last written through a forms binding, pre-normalisation. */
  private _pendingValues: T[] = [];

  constructor() {
    super();
    effect(() => {
      this.selectionService.multiple.set(this.multiple());
    });
    effect(() => {
      this.selectionService.compareWith.set(this.compareWith());
    });
    // External value path. `toAriaValues` normalises scalar / array / `null`
    // forms shapes into the flat `T[]` the aria listbox panel expects; each
    // value is then matched against the current options via `compareWith` so
    // deserialized object values collapse onto their option instances (aria
    // listbox, check-marks and displayed label all agree). The **selection** is
    // normalised immediately, but the visible search text is left alone while a
    // live search is in flight — every exit from a search (commit / close /
    // clear) re-syncs it. See `_applyPendingValues`.
    effect(() => {
      this._pendingValues = toAriaValues(this.value());
      this._applyPendingValues();
    });
    // A `searchFn` is lazy: the first open is what triggers its initial load.
    effect(() => {
      if (this.isOpen()) untracked(() => this._adapter.ensureLoaded());
    });
    // Latch the eager gate off once a *remote* source has answered — see
    // `_eagerDone`. The mode check matters: an array source is `ready()` from
    // the first tick, so latching on readiness alone would disarm the gate
    // before a `searchFn` bound through a signal/late input ever became the
    // active branch.
    effect(() => {
      if (this._adapter.mode() === 'remote' && this._adapter.ready()) {
        untracked(() => this._eagerDone.set(true));
      }
    });
  }

  // ─── Input / focus events ────────────────────────────────────────────────

  /**
   * @protected Whether the last selected chip is "armed" — a visual-only
   * selection driven by Backspace in the empty search input while DOM focus
   * stays in the input (ported from mlv-tokenizer). The first Backspace arms;
   * the next Backspace (or Delete) removes the armed chip and arms the new
   * last one. Multi-select only.
   */
  protected readonly _armed = signal(false);

  /** @protected Polite screen-reader announcement for the armed chip. */
  protected readonly _armedMessage = signal('');

  /**
   * @protected Whether the given selected option is the currently armed chip.
   * Armed always targets the LAST selected chip.
   */
  protected _isChipArmed(option: MlvSelectOption<T>): boolean {
    const selected = this.selectedOptions();
    return this._armed() && option === selected[selected.length - 1];
  }

  /**
   * Handles Backspace in the search input (outer or in-sheet). When the input
   * holds text this is a native edit and is left alone. With an empty input in
   * multi-select: the first press arms the last chip (no deletion); each
   * subsequent press removes the armed chip and arms the new last one.
   */
  onInputBackspace(event: Event): void {
    if (!this.multiple() || this._isInert()) return;
    const el = event.target as HTMLInputElement | null;
    if ((el?.value ?? '') !== '') return; // caret editing text
    const selected = this.selectedOptions();
    if (selected.length === 0) return;

    event.preventDefault();
    if (!this._armed()) {
      this._armed.set(true);
      this._armedMessage.set(selected[selected.length - 1]?.label ?? '');
      return;
    }
    this._deleteArmedAndRearm();
  }

  /**
   * Handles Delete in the search input — parity with the second Backspace:
   * removes the armed chip and arms the new last one; no-op when nothing is
   * armed.
   */
  onInputDelete(event: Event): void {
    if (!this._armed()) return;
    event.preventDefault();
    this._deleteArmedAndRearm();
  }

  /**
   * @private Removes the armed (last) chip through the regular deselection
   * path and re-arms the new last chip, or disarms when none remain.
   */
  private _deleteArmedAndRearm(): void {
    const selected = this.selectedOptions();
    const last = selected[selected.length - 1];
    if (!last) {
      this._disarmChips();
      return;
    }
    this._internalChipRemoval = true;
    try {
      this.removeSelected(last.value);
    } finally {
      this._internalChipRemoval = false;
    }
    const remaining = this.selectedOptions();
    if (remaining.length === 0) {
      this._disarmChips();
    } else {
      this._armed.set(true);
      this._armedMessage.set(remaining[remaining.length - 1]?.label ?? '');
    }
  }

  /**
   * @private Marks a removeSelected call as originating from the arm-driven
   * deletion flow, so it preserves (re-arms) instead of disarming.
   */
  private _internalChipRemoval = false;

  /** @private Clears the armed chip selection and its live announcement. */
  private _disarmChips(): void {
    if (this._armed()) this._armed.set(false);
    if (this._armedMessage()) this._armedMessage.set('');
  }

  onSearchInput(event: Event): void {
    if (this._isInert()) return;
    // Typing is a caret edit — disarm any chip selection.
    this._disarmChips();
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this._searching.set(true);
    this._activeDescendant.reset();
    if (!this.isOpen()) this.isOpen.set(true);
    // Remote sources filter server-side — forward the query (debounced) instead
    // of narrowing the rendered list locally.
    if (this._adapter.mode() === 'remote') {
      this._remoteQuery = value;
      this._adapter.search(value);
    }
  }

  /**
   * Opens the dropdown when the input gains focus (unless disabled/readonly).
   * Full-screen sheet mode is the exception: focus alone must NOT open — Tab
   * focus would trap the user straight into the sheet, and the programmatic
   * focus-restore in `_onPopupClosed` would instantly reopen it in a loop.
   * There the sheet opens via pointer ({@link onTriggerClick}), the chevron,
   * or explicit keyboard navigation (ArrowUp/Down).
   */
  onInputFocus(): void {
    this.setFocused(true);
    if (this._isInert() || this._isFullscreen()) return;
    this.isOpen.set(true);
    // Single-select: select the committed label so the next keystroke replaces it.
    if (!this.multiple() && this._committedLabel()) {
      this._input()?.select();
    }
  }

  /**
   * Opens the dropdown on a pointer click on the trigger input. This is the
   * open gesture for the full-screen sheet (where focus alone never opens it);
   * while anchored it is a no-op in practice because the preceding focus event
   * already opened the panel.
   */
  onTriggerClick(): void {
    if (this._isInert()) return;
    this._disarmChips();
    this.isOpen.set(true);
  }

  /** Closes the dropdown, reverts stale text, and marks touched when focus genuinely leaves the field. */
  onInputBlur(): void {
    // Focus leaving the field disarms the chip selection (tokenizer parity).
    this._disarmChips();
    this.setFocused(false);
    this._markTouched();
    // Full-screen sheet: the outer trigger input blurs the moment focus is
    // handed to the in-sheet input on open, and the sheet's focus trap keeps
    // focus moving between the in-sheet input, chips, and options. Blur must
    // NOT close/revert here — the sheet is dismissed only via the X button,
    // Escape, or a committed selection (all routed through `_onPopupClosed`).
    if (this._isFullscreen()) return;
    this._revertAndClose();
  }

  /**
   * @protected Called after the dropdown popup finishes opening. In full-screen
   * mode, hands focus to the in-sheet search input (the outer trigger input is
   * occluded by the backdrop and outside the sheet's focus trap). No-op while
   * trigger-anchored, so the desktop path is unchanged.
   */
  protected _onPopupOpened(): void {
    if (!this._isFullscreen()) return;
    // The in-sheet input is stamped inside the overlay (a detached embedded
    // view), so it is not reachable via this component's view queries — locate
    // it by its deterministic id, mirroring the day-picker's focus-into-panel.
    document.getElementById(this._sheetInputId())?.focus();
  }

  /**
   * @protected Called after the dropdown popup finishes closing. In full-screen
   * mode, reverts any stale search text to the committed selection and restores
   * focus to the outer trigger input (matching the desktop close behaviour that
   * `onInputBlur`/`onEscape` provide when anchored). No-op while anchored.
   */
  protected _onPopupClosed(): void {
    if (!this._isFullscreen()) return;
    this._activeDescendant.reset();
    this._syncDisplayText();
    this.setInitialFocus();
  }

  override setFocused(isFocused = true): void {
    this._focused.set(isFocused);
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────

  onArrowDown(event: Event): void {
    event.preventDefault();
    if (this._isInert()) return;
    this._openForNavigation();
    this._activeDescendant.move(1);
  }

  onArrowUp(event: Event): void {
    event.preventDefault();
    if (this._isInert()) return;
    this._openForNavigation();
    this._activeDescendant.move(-1);
  }

  onHome(event: Event): void {
    if (!this.isOpen() || this._isInert()) return;
    event.preventDefault();
    this._activeDescendant.first();
  }

  onEnd(event: Event): void {
    if (!this.isOpen() || this._isInert()) return;
    event.preventDefault();
    this._activeDescendant.last();
  }

  onEnterKey(event?: Event): void {
    event?.preventDefault();
    if (this._isInert()) return;

    const filtered = this.filteredOptions();
    const active = this._activeDescendant.index();

    // 1. A navigated (highlighted) option wins — APG "Enter selects active".
    if (active >= 0 && active < filtered.length) {
      this._commitValue(filtered[active].value);
      return;
    }

    const query = this.searchQuery().trim();
    if (!query) return;

    // 2. Exact text match selects (never deselects).
    const exactMatch = filtered.find(
      (o) => o.label.toLowerCase() === query.toLowerCase(),
    );
    if (exactMatch) {
      this._commitValue(exactMatch.value);
      return;
    }

    // 3. allowCreate: ADD a brand-new value (never toggle-off, never duplicate).
    if (this.allowCreate()) {
      const value = query as unknown as T;
      if (!this.selectionService.isSelected(value)) {
        this._addOrReplace(value);
        this.valueCreated.emit(value);
        this._emitValue();
      }
      this._afterCommit();
    }
  }

  /** First press (open) closes + reverts; second press (already closed) clears. */
  onEscape(event: Event): void {
    event.preventDefault();
    if (this.isOpen()) {
      this._revertAndClose();
    } else {
      this.onClear();
    }
  }

  /** Chevron toggle. Uses `mousedown` + `preventDefault` so the input keeps focus. */
  onChevronMousedown(event: MouseEvent): void {
    event.preventDefault();
    if (this._isInert()) return;
    if (this.isOpen()) {
      this.isOpen.set(false);
    } else {
      this._input()?.focus();
      this.isOpen.set(true);
    }
  }

  // ─── Selection ───────────────────────────────────────────────────────────

  /**
   * Panel (pointer) selection path: aria emits the full selected-values array.
   *
   * The aria `ngListbox` re-emits its `value` model whenever the *rendered*
   * option set changes — not only on user interaction. Typing filters the
   * selected option out of view, so aria reconciles `value` down to the
   * currently-rendered options and re-emits (see the `afterRenderEffect` in
   * `@angular/aria`'s `Listbox`). That reconciliation is NOT a user action and
   * must never mutate the committed selection or run commit side-effects
   * (close / emit) — otherwise a single-select loses its value on any
   * re-search and multi/allowCreate drop previously-picked items while typing
   * to add another. We detect and ignore those emissions here.
   */
  selectValues(values: readonly T[]): void {
    const incoming = [...values];
    const committed = this.selectionService.selectedValues();

    // Reconciliation noise: the emit adds nothing to the committed selection
    // and only drops values whose option is currently filtered out of view. A
    // genuine pointer selection either ADDS a value or REMOVES a still-visible
    // one — so this is safe to ignore entirely (no mutation, no side-effects).
    const visible = this._visibleValues();

    if (this._isReconciliationEmit(incoming, committed, visible)) return;

    // Genuine pointer selection. In multi-select, aria has already reconciled
    // any filtered-out committed value out of its model, so re-add those
    // (otherwise "type to add another" silently drops earlier picks). Single-
    // select replaces, so no preservation is needed.
    const next = this.multiple()
      ? [
          ...incoming,
          ...this._filteredOutCommitted(incoming, committed, visible),
        ]
      : incoming;

    this.selectionService.setValues(next);
    this._emitValue();
    this._afterCommit();
  }

  /**
   * @private Whether an incoming panel `valueChange` is pure aria reconciliation
   * noise rather than a user selection. True when the emit (a) adds no value not
   * already committed and (b) only removes values whose option is currently
   * filtered out of the rendered list. An emit that adds a value, removes a
   * still-visible value (a genuine deselection), or exactly re-states the
   * committed selection (nets to no change) is handled accordingly — the last
   * case is treated as reconciliation so a spurious re-emit never re-runs the
   * commit side-effects (e.g. closing a single-select popup mid-search).
   */
  private _isReconciliationEmit(
    incoming: readonly T[],
    committed: readonly T[],
    visible: readonly T[],
  ): boolean {
    return isReconciliationEmit(
      incoming,
      committed,
      visible,
      this.compareWith(),
    );
  }

  /**
   * @private Committed values that aria dropped from its model only because
   * their option is filtered out of the rendered list (and are not in the
   * incoming array). Re-added to a genuine multi-select selection so earlier
   * picks survive typing to add another value.
   */
  private _filteredOutCommitted(
    incoming: readonly T[],
    committed: readonly T[],
    visible: readonly T[],
  ): T[] {
    return filteredOutCommitted(
      incoming,
      committed,
      visible,
      this.compareWith(),
    );
  }

  /**
   * @private The values of the currently rendered (filtered) options — the
   * reconciliation guard's "visible" set. Derived once per emit and passed to
   * both guards, rather than re-mapping `filteredOptions()` in each.
   */
  private _visibleValues(): T[] {
    return this.filteredOptions().map((o) => o.value);
  }

  /** Removes a single selected value (multi-select chip close / keyboard remove). */
  removeSelected(value: T): void {
    // A click-removal (or any external deselection) disarms; the arm-driven
    // deletion flow re-arms itself afterwards.
    if (!this._internalChipRemoval) this._disarmChips();
    this.selectionService.deselect(value);
    this._emitValue();
    this._focusActiveInput();
  }

  /**
   * @private Focuses whichever search input is currently interactive: the
   * in-sheet input while full-screen, otherwise the outer trigger input.
   */
  private _focusActiveInput(): void {
    if (this._isFullscreen()) {
      document.getElementById(this._sheetInputId())?.focus();
      return;
    }
    this._input()?.focus();
  }

  /** Clears the whole selection and search text, emits, and refocuses the input. */
  onClear(): void {
    this.selectionService.clear();
    this.searchQuery.set('');
    this._searching.set(false);
    this._activeDescendant.reset();
    this._resetRemoteSearch();
    this._emitValue();
    this._input()?.focus();
  }

  /** Moves focus back to the input (e.g. after single-select commit / close). */
  setInitialFocus(): void {
    this._input()?.focus();
  }

  /**
   * Re-measures the trigger from an `mlvResizeObserver` entry and republishes
   * {@link triggerWidth} — the dropdown's minimum width.
   */
  updateTriggerWidth(evt: ResizeObserverEntry[]): void {
    this.triggerWidth.set(evt[0].target.getBoundingClientRect().width);
  }

  // ─── Forms value ─────────────────────────────────────────────────────────

  /**
   * The combobox renders its own clear button inline in the trigger row,
   * before the chevron — the wrapper must not render its trailing copy.
   */
  readonly ownsClearButton = computed(() => true);

  /** Whether the control holds a clearable value — At least one committed option selected (search text alone is not a value). */
  readonly hasValue = computed(
    () => this.selectionService.selectedValues().length > 0,
  );

  /** @private Normalises the pending form values against the current options and syncs display text. */
  private _applyPendingValues(): void {
    const options = this._optionValueIndex();
    const normalized = this._pendingValues.map((v) => options.resolve(v));
    this.selectionService.setValues(normalized);
    // This effect re-runs on every `resolvedOptions()` change — which now
    // includes every remote response and every observable emission. Resyncing
    // the display text there would wipe the query the user is still typing, so
    // it is skipped while a live search is in flight; every exit from a search
    // (commit / revert / clear) calls `_syncDisplayText()` itself. Read
    // untracked so the effect's dependency set stays value + options.
    if (!untracked(() => this._searching())) this._syncDisplayText();
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  /** @private Whether all open / interaction paths must be suppressed. */
  private _isInert(): boolean {
    return (
      this.computedDisabled() || this.readonly() || this._awaitingValueLabel()
    );
  }

  /** @private Opens the popup for keyboard navigation, resetting the active index on first open. */
  private _openForNavigation(): void {
    if (!this.isOpen()) {
      this.isOpen.set(true);
      this._activeDescendant.reset();
    }
  }

  /** @private ADD-only selection: single-select replaces, multi-select appends without duplicating. */
  private _addOrReplace(value: T): void {
    if (this.multiple()) {
      if (!this.selectionService.isSelected(value)) {
        this.selectionService.setValues([
          ...this.selectionService.selectedValues(),
          value,
        ]);
      }
    } else {
      this.selectionService.setValues([value]);
    }
  }

  /** @private Commits an option value (Enter / active / exact-match path) and settles the UI. */
  private _commitValue(value: T): void {
    this._addOrReplace(value);
    this._emitValue();
    this._afterCommit();
  }

  /** @private Settles UI after a committed selection: single closes + refocuses, multi stays open for more. */
  private _afterCommit(): void {
    this._activeDescendant.reset();
    if (this.multiple()) {
      this.searchQuery.set('');
      this._searching.set(false);
      this._resetRemoteSearch();
      this._input()?.focus();
    } else {
      this._syncDisplayText();
      this._resetRemoteSearch();
      // Refocus first (the focus handler re-opens), then force the popup shut so
      // the field ends up focused-but-closed after a single-select commit.
      this.setInitialFocus();
      this.isOpen.set(false);
    }
  }

  /** @private Reverts stale search text to the committed state and closes the popup. */
  private _revertAndClose(): void {
    this.isOpen.set(false);
    this._activeDescendant.reset();
    this._syncDisplayText();
    this._resetRemoteSearch();
  }

  /**
   * @private Re-searches `''` once whenever the visible query is dropped
   * (close / revert, a commit in either selection mode, or a clear), so a blank
   * input never sits above a list still filtered by the previous query. No-op
   * in local mode and when the last remote query was already blank.
   */
  private _resetRemoteSearch(): void {
    if (this._adapter.mode() === 'remote' && this._remoteQuery !== '') {
      this._remoteQuery = '';
      this._adapter.search('');
    }
  }

  /** @private Sets the input text to reflect the committed selection (single) or clears it (multi). */
  private _syncDisplayText(): void {
    this._searching.set(false);
    this.searchQuery.set(this.multiple() ? '' : this._committedLabel());
  }

  /**
   * @private Commits the current selection to the forms model. {@link fromAriaValues}
   * collapses the aria-side selection array back to the public value shape: `T[]`
   * for multi-select, or the first value / `null` when empty for single-select.
   */
  private _emitValue(): void {
    this.value.set(
      fromAriaValues(this.selectionService.selectedValues(), this.multiple()),
    );
    this._markTouched();
  }
}
