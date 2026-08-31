import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupContainer,
  MlvPopupPinnedContent,
} from '@malva-ui/core/popup';
import type { MlvPopupMobileMode } from '@malva-ui/core/popup';
import type { MlvFormState, MlvFormControl } from '@malva-ui/core/form-utils';
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
import {
  MlvSelectItemTemplate,
  MlvSelectSelectedTemplate,
} from '../select-template.directives';
import { LucideChevronDown, LucideSearch } from '@lucide/angular';
import { MlvClick } from '@malva-ui/cdk/accessibility';
import {
  MlvBreakpointService,
  MlvResizeObserver,
} from '@malva-ui/cdk/utils';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  filteredOutCommitted,
  filterOptions,
  isReconciliationEmit,
  MlvActiveDescendant,
  MlvDropdownPanel,
  MlvOptionsAdapter,
  optionId,
} from '@malva-ui/core/dropdown';
import type {
  MlvOptionMatcher,
  MlvOptionsInput,
  MlvOptionsSearchFn,
} from '@malva-ui/core/dropdown';
import type {
  MlvSelectOption,
  MlvSelectOptionTransform,
} from '../select-option';
import { defaultOptionTransform } from '../select-option';
import { MlvButtonClose } from '@malva-ui/core/button';
import { MlvInput } from '@malva-ui/core/input';
import { MlvLoader } from '@malva-ui/core/loader';
import {
  MLV_FORM_UTILS_I18N,
  MLV_SELECT_I18N,
  MlvI18nResolverService,
} from '@malva-ui/i18n';

/**
 * Visual/validation state of the select. Mirrors {@link MlvFormState}.
 */
export type MlvSelectState = MlvFormState;

/** Native rendering mode for the select control. */
export type MlvSelectNativeMode = boolean | 'auto';

type MlvSelectNativeInput = MlvSelectNativeMode | '' | 'true' | 'false';

function coerceNativeMode(value: MlvSelectNativeInput): MlvSelectNativeMode {
  if (value === '' || value === true || value === 'true') return true;
  if (value === 'auto') return 'auto';
  return false;
}

interface NativeOption<T> {
  readonly key: string;
  readonly label: string;
  readonly value: T;
  readonly group?: string;
  readonly disabled?: boolean;
}

interface NativeOptionGroup<T> {
  readonly label: string | null;
  readonly options: readonly NativeOption<T>[];
}

@Component({
  selector: 'mlv-select',
  imports: [
    NgTemplateOutlet,
    MlvPopup,
    MlvPopupContent,
    MlvPopupContainer,
    MlvPopupPinnedContent,
    MlvDescription,
    MlvFormControlWrapper,
    MlvHint,
    MlvLabel,
    MlvFormControlWrapperControl,
    MlvMessage,
    MlvClick,
    LucideChevronDown,
    MlvResizeObserver,
    MlvDropdownPanel,
    MlvButtonClose,
    MlvInput,
    MlvLoader,
    LucideSearch,
  ],
  templateUrl: './select.html',
  styleUrl: './select.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    MlvSelectionService,
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvSelect),
    },
  ],
  host: {
    class: 'mlv-select',
    '[class]': '"mlv-select--" + resolvedState()',
    '[class.mlv-select--disabled]': 'computedDisabled()',
    '[class.mlv-select--open]': 'isOpen()',
    '[class.mlv-select--native]': '_nativeActive()',
    '[class.mlv-select--loading]': '_awaitingValueLabel()',
  },
})
export class MlvSelect<T>
  extends MlvSignalFormControlBase<T | T[] | null>
  implements MlvFormControl
{
  /** The scalar, array, or null selection used by all Angular forms APIs. */
  readonly value = model<T | T[] | null>(null);
  /**
   * Selectable options: a plain array, an observable of arrays, or an
   * `MlvDataSource` (source-side search + lazy paging). Readonly arrays are
   * accepted because options are never mutated.
   */
  readonly options = input<MlvOptionsInput<T>>([]);
  /**
   * Remote search used by the searchable dropdown:
   * `(query) => T[] | Promise<T[]> | Observable<T[]>`. When set it supersedes
   * {@link options} as the item source; the list is not filtered locally. Bind
   * `[loading]` yourself for any spinner beyond the source-owned one.
   */
  readonly searchFn = input<MlvOptionsSearchFn<T> | null>(null);
  /** Debounce (ms) for remote searches (`MlvDataSource` / {@link searchFn}). Local filtering stays instant. */
  readonly searchDebounce = input<number>(200);
  /** Enables multi-selection mode. */
  readonly multiple = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /**
   * Renders a transparent native `<select>` over the visual trigger. The
   * native control is populated from `[options]`; custom item and selected
   * templates are ignored. `true` always uses the native control, `false`
   * keeps the custom dropdown, and `'auto'` uses the native control below the
   * `md` breakpoint. A bare `native` attribute is equivalent to
   * `native="true"`.
   */
  readonly native = input<MlvSelectNativeMode, MlvSelectNativeInput>(false, {
    transform: coerceNativeMode,
  });
  /** Custom placeholder override. Falls back to the i18n-provided placeholder. */
  readonly placeholder = input<string | undefined>(undefined);
  readonly toOption = input<MlvSelectOptionTransform<T>>(
    defaultOptionTransform as MlvSelectOptionTransform<T>,
  );

  /**
   * Equality predicate used to match option values against the current
   * selection and against values written through any forms binding. Defaults
   * to reference equality. Provide e.g. `(a, b) => a.id === b.id` so a
   * deserialised object value collapses onto its option instance (label and
   * check-mark agree, and a value that arrives before its options resolves once
   * they load).
   */
  readonly compareWith = input<(a: T, b: T) => boolean>((a, b) => a === b);

  /**
   * Renders a search field as the first row of the open dropdown. Local sources
   * (array / observable) are filtered by label; remote sources (`MlvDataSource`
   * / {@link searchFn}) search server-side through the shared adapter.
   *
   * While the searchable dropdown is open the combobox semantics move from the
   * trigger onto the search input and navigation switches to the WAI-ARIA
   * activedescendant model (DOM focus stays in the search field). A
   * non-searchable select is untouched.
   */
  readonly searchable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Placeholder of the in-dropdown search field. Falls back to the i18n default. */
  readonly searchPlaceholder = input<string | undefined>(undefined);

  /**
   * Custom local-filter predicate (fuzzy / secondary-field matching). Threaded
   * into the shared `filterOptions`, whose results are always ranked
   * prefix-matches-first. Ignored for remote sources, which own their filtering.
   */
  readonly matcher = input<MlvOptionMatcher<T> | undefined>(undefined);

  /**
   * Controls whether the dropdown renders as a full-screen mobile sheet.
   *
   * Passed straight through to the underlying `mlv-popup`. Defaults to
   * `'auto'` — the dropdown is full-screen below the `md` breakpoint
   * (viewport < 768px) and trigger-anchored above it, matching the date/time
   * pickers. Set to `'off'` to always anchor to the trigger, or `'fullscreen'`
   * to always render the sheet (e.g. demos). Unlike `mlv-combobox` (whose
   * search input lives outside the overlay panel), the select trigger is a plain
   * button and its dropdown is the entire interaction surface, so full-screen
   * mode composes cleanly.
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
   * @protected Resolved full-screen sheet title: explicit `mobileTitle` input
   * takes precedence over the field's label, then the resolved placeholder.
   */
  protected readonly _resolvedMobileTitle = computed(
    () => this.mobileTitle() ?? (this.label() || this._resolvedPlaceholder()),
  );

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_SELECT_I18N);

  /** @private Shared responsive breakpoint state used by native `'auto'` mode. */
  private readonly _breakpoint = inject(MlvBreakpointService);

  protected readonly _formI18n = inject(MLV_FORM_UTILS_I18N);

  /** @protected Resolved placeholder: explicit input takes precedence over i18n default. */
  protected readonly _resolvedPlaceholder = computed(
    () => this.placeholder() ?? this._i18n().placeholder,
  );

  /**
   * @protected Accessible name forwarded to the dropdown panel's inner
   * `role="listbox"` (`mlv-dropdown-panel`'s `ariaLabel`). Mirrors the
   * trigger's own resolution — the visible {@link label} when set (linked
   * there via `aria-labelledby`), else the explicit {@link ariaLabel} input
   * (rendered as the trigger's own `aria-label`) — so the listbox shares the
   * same accessible name as the field it belongs to. `null` when neither is
   * set, same as an unlabelled trigger.
   */
  protected readonly _panelAriaLabel = computed(
    () => this.label() || this.ariaLabel(),
  );

  // Override focused to also be true when the popup is open
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
   * @protected Shared source adapter — arrays / observables are local, a data
   * source or a `searchFn` is remote (the source filters and the items render
   * as-is). Template-facing: the paging bindings (`hasMore` / `loadingMore` /
   * `loadMore`) read straight off it.
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

  readonly resolvedOptions = computed(() =>
    this._adapter.items().map((item) => this.toOption()(item)),
  );

  /**
   * @protected Whether the native select is the active interaction surface.
   * `'auto'` follows the shared `md` breakpoint and updates when the viewport
   * changes.
   */
  protected readonly _nativeActive = computed(() => {
    const mode = this.native();
    return mode === true || (mode === 'auto' && this._breakpoint.isDown('md')());
  });

  /**
   * @protected Normalized native option groups. Each option receives an
   * internal index key so arbitrary `T` values can travel through the native
   * select without stringifying the public form value.
   */
  protected readonly _nativeOptionGroups = computed<
    readonly NativeOptionGroup<T>[]
  >(() => {
    const groups: NativeOptionGroup<T>[] = [];
    this.resolvedOptions().forEach((option, index) => {
      const nativeOption: NativeOption<T> = {
        key: String(index),
        label: option.label,
        value: option.value,
        group: option.group,
        disabled: option.disabled,
      };
      const label = option.group || null;
      const previous = groups[groups.length - 1];
      if (previous?.label === label) {
        groups[groups.length - 1] = {
          label,
          options: [...previous.options, nativeOption],
        };
      } else {
        groups.push({ label, options: [nativeOption] });
      }
    });
    return groups;
  });

  /** @protected Whether every committed value has a matching option (by `compareWith`). */
  protected readonly _allValuesMatched = computed(() => {
    const compare = this.compareWith();
    const opts = this.resolvedOptions();
    return this.selectionService
      .selectedValues()
      .every((v) => opts.some((o) => compare(o.value, v)));
  });

  /** @protected First payload arrived and the consumer is not reporting `loading`. */
  protected readonly _ready = computed(
    () => this._adapter.ready() && !this.loading(),
  );

  /**
   * @protected Loading variant: a value is committed but no option resolves its
   * label yet. The trigger is inert (no open) but stays tabbable, shows a
   * spinner instead of the chevron and the i18n loading text instead of a raw
   * value.
   */
  protected readonly _awaitingValueLabel = computed(
    () => this.hasValue() && !this._ready() && !this._allValuesMatched(),
  );

  /** @protected Panel spinner row: source-owned loading OR the consumer's `[loading]`. */
  protected readonly _panelLoading = computed(
    () => this._adapter.loading() || this.loading(),
  );

  readonly isOpen = signal(false);
  readonly triggerWidth = signal(0);

  /**
   * Current text of the in-dropdown search field. Always `''` while the
   * dropdown is closed — closing resets it (see `_onPopupClosed`).
   */
  readonly searchQuery = signal('');

  /**
   * The options actually rendered in the panel: locally filtered by
   * {@link searchQuery} while searchable over a local source, the source's
   * items as-is otherwise (a remote source filters server-side, and a
   * non-searchable select never filters).
   */
  readonly filteredOptions = computed(() => {
    const resolved = this.resolvedOptions();
    if (!this.searchable() || this._adapter.mode() === 'remote')
      return resolved;
    return filterOptions(resolved, this.searchQuery(), this.matcher());
  });

  /**
   * @private Shared activedescendant bookkeeping over {@link filteredOptions}
   * (searchable mode only) — the same engine behind `mlv-combobox` and
   * `[mlvAutocomplete]`. The count is read lazily, so it always reflects the
   * live filtered list.
   */
  private readonly _activeDescendant = new MlvActiveDescendant(
    () => this.filteredOptions().length,
  );

  /**
   * @protected Active option index handed to the panel. Pinned to `-1` while
   * not searchable so the roving-focus panel never renders an active row.
   */
  protected readonly _activeIndex = computed(() =>
    this.searchable() ? this._activeDescendant.index() : -1,
  );

  /** @protected `aria-activedescendant` target of the search input, or `null`. */
  protected readonly _activeOptionId = computed(() => {
    const index = this._activeDescendant.index();
    if (index < 0 || index >= this.filteredOptions().length) return null;
    return optionId(this.listboxId(), index);
  });

  /**
   * @protected DOM `id` of the in-dropdown search input. Distinct from the
   * trigger's `id()` so both can coexist, and deterministic so the field can be
   * focus-targeted by id once the popup has opened.
   */
  protected readonly _searchInputId = computed(() => `${this.id()}-search`);

  /**
   * @protected Whether the trigger owns the combobox semantics. `false` only
   * while the searchable dropdown is open — the search input is the live
   * combobox then, so exactly one `role="combobox"` is ever exposed. The
   * trigger becomes a plain `role="button"` there rather than losing its role:
   * a role-less `<div>` may carry no ARIA state at all, whereas a button that
   * opened a popup legitimately keeps `aria-expanded` / `aria-haspopup` /
   * `aria-controls`. Only `aria-required` (invalid on `button`) is dropped.
   */
  protected readonly _outerIsCombobox = computed(
    () => !(this.searchable() && this.isOpen()),
  );

  /**
   * @protected Matched-substring emphasis for the option rows. Only while
   * searching a **local** source — a remote source's results need not contain
   * the query at all.
   */
  protected readonly _highlightQuery = computed(() =>
    this.searchable() && this._adapter.mode() === 'local'
      ? this.searchQuery().trim()
      : '',
  );

  /** @protected Resolved search placeholder: explicit input takes precedence over i18n default. */
  protected readonly _resolvedSearchPlaceholder = computed(
    () => this.searchPlaceholder() ?? this._i18n().searchPlaceholder,
  );

  /** @private ICU resolver for parameterised i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /**
   * @protected Polite screen-reader announcement of the current result count.
   * Empty unless the searchable dropdown is open, so no stale count is read out.
   * Mirrors the visible empty-state copy rendered inside the panel.
   */
  protected readonly _resultsAnnouncement = computed(() => {
    if (!this.isOpen() || !this.searchable()) return '';
    const count = this.filteredOptions().length;
    if (count === 0) return this._i18n().noResults;
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'resultsAvailable',
      { count },
    );
  });

  /** The HTML `id` assigned to the inner listbox element for `aria-controls` linking. */
  readonly listboxId = computed(() => `${this.id()}-listbox`);

  /**
   * The HTML `id` assigned to the visible `<mlv-label>` element. The trigger
   * references it via `aria-labelledby` (a `<label for>` cannot name a `<div>`).
   */
  readonly labelId = computed(() => `${this.id()}-label`);

  readonly dropdownPositions: ConnectedPosition[] = [
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 8,
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'bottom',
      offsetY: -8,
    },
  ];

  readonly selectionService = inject(MlvSelectionService);

  itemTemplate = contentChild(MlvSelectItemTemplate);
  selectedTemplate = contentChild(MlvSelectSelectedTemplate);

  /** @private Reference to the trigger element, used to restore focus after selection. */
  private readonly _triggerElement = viewChild('trigger', { read: ElementRef });
  /** @private Reference to the transparent native select when native mode is active. */
  private readonly _nativeSelect = viewChild<ElementRef<HTMLSelectElement>>(
    'nativeSelect',
  );
  /** @private Reference to the rendered dropdown panel component. */
  private readonly _dropdownPanel = viewChild(MlvDropdownPanel);

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
    effect(() => {
      if (this._nativeActive()) {
        untracked(() => {
          this.isOpen.set(false);
          this._adapter.ensureLoaded();
        });
      }
    });
    effect(() => {
      this._pendingValues = toAriaValues(this.value());
      // Reads resolvedOptions()/compareWith() → re-runs when options arrive later.
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
    // A remote response (or a narrowing local filter) can shrink the list out
    // from under a stale active index. Drop it rather than leave
    // `aria-activedescendant` pointing at a row that no longer exists — and so
    // the next arrow press restarts from the top of the new list.
    effect(() => {
      const count = this.filteredOptions().length;
      untracked(() => {
        if (this._activeDescendant.index() >= count) {
          this._activeDescendant.reset();
        }
      });
    });
  }

  get displayValue(): string {
    const values = this.selectionService.selectedValues();
    if (values.length === 0) return '';
    const transform = this.toOption();
    if (values.length === 1) return transform(values[0]).label;
    return `${values.length} items selected`;
  }

  /**
   * Toggles the dropdown. Closing is always allowed — a panel opened before the
   * control turned inert (a late `[loading]`, a value written under an open
   * list) must stay dismissable from its own trigger; only opening is gated.
   */
  toggleDropdown(): void {
    if (this._nativeActive()) {
      this._nativeSelect()?.nativeElement.focus();
      return;
    }
    if (this.isOpen()) {
      this.isOpen.set(false);
      return;
    }
    if (this._isInert()) return;
    this.isOpen.set(true);
  }

  setInitialFocus(): void {
    this._triggerElement()?.nativeElement.focus();
  }

  /**
   * Focuses the trigger and opens the dropdown. Focus moves even while merely
   * awaiting a value's label — this is the label's click target, and a click on
   * a field's label must always land the caret on that field; only the open is
   * suppressed. A **disabled** field is the exception: it takes neither the
   * caret nor the open (the trigger's `tabindex="-1"` would still accept
   * programmatic focus).
   */
  openDropdown(): void {
    if (this.computedDisabled()) return;
    if (this._nativeActive()) {
      this._nativeSelect()?.nativeElement.focus();
      return;
    }
    this.setInitialFocus();
    if (this._isInert()) return;
    this.isOpen.set(true);
  }

  /**
   * @protected Trigger keyboard open. ArrowUp / ArrowDown open the dropdown and
   * move focus onto the first option (`focusFirst`); Home / End only open it,
   * leaving the roving focus where the panel puts it. No-op while inert, but the
   * default is always prevented so a still-resolving trigger never scrolls the
   * page instead.
   *
   * The focus request is roving-mode only: a searchable dropdown hands focus to
   * its search input instead (`_onPopupOpened`), and pulling it onto an option
   * would break the activedescendant model.
   */
  protected _openFromKey(event: Event, focusFirst: boolean): void {
    event.preventDefault();
    if (this._nativeActive()) {
      this._nativeSelect()?.nativeElement.focus();
      return;
    }
    if (this._isInert()) return;
    this.isOpen.set(true);
    if (focusFirst && !this.searchable()) {
      this.selectionService.requestFocusFirst();
    }
  }

  /**
   * @protected Whether every open / interaction path is suppressed: the control
   * is disabled, or a committed value's label is still resolving (the trigger
   * stays tabbable and readable, but must not open a list that cannot yet show
   * the current selection).
   */
  protected _isInert(): boolean {
    return this.computedDisabled() || this._awaitingValueLabel();
  }

  /**
   * Handles a selection change emitted by the aria listbox panel. The panel
   * always emits the flat `V[]` array that `@angular/aria`'s `ngListbox`
   * models; {@link fromAriaValues} collapses it back to the public forms value
   * shape (`T` for single-select, `T[]` for multi-select, `null` when cleared).
   *
   * aria re-emits its value whenever the *rendered* option set changes (an
   * async load landing while the panel is open, later search filtering) — those
   * reconciliation emits are ignored via the shared guard, so they can never
   * wipe the committed value. A genuine multi-select pick re-adds the committed
   * values aria dropped only because their option is not rendered.
   */
  selectOption(values: readonly T[]): void {
    const committed = this.selectionService.selectedValues();
    const visible = this._visibleValues();
    const compare = this.compareWith();
    if (isReconciliationEmit(values, committed, visible, compare)) return;
    const next = this.multiple()
      ? [
          ...values,
          ...filteredOutCommitted(values, committed, visible, compare),
        ]
      : [...values];
    this._commitSelection(next);
  }

  /**
   * @private Writes a genuine selection — the single commit path shared by the
   * panel's `valueChange` and the search field's Enter. Single-select closes the
   * dropdown and returns focus to the trigger; multi-select stays open so the
   * next option can be picked.
   */
  private _commitSelection(next: T[], restoreFocus = true): void {
    if (!this.multiple() && restoreFocus) {
      this.isOpen.set(false);
      this.setInitialFocus();
    }
    this.value.set(fromAriaValues(next, this.multiple()));
    this.selectionService.setValues(next);
    this._markTouched();
  }

  /**
   * @protected Values of the options currently rendered in the panel (the
   * reconciliation guard's "visible" set) — the filtered set while searching.
   */
  protected _visibleValues(): T[] {
    return this.filteredOptions().map((o) => o.value);
  }

  // ─── In-dropdown search field ────────────────────────────────────────────

  /**
   * @protected Search-field input. Local sources narrow {@link filteredOptions}
   * instantly; remote ones are asked (debounced) instead, because filtering
   * locally as well would hide server results and empty the list while a newer
   * query is still in flight.
   */
  protected _onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this._activeDescendant.reset();
    if (this._adapter.mode() === 'remote') this._adapter.search(value);
  }

  /** @protected ArrowDown — activate the next option (wrap-around). */
  protected _onSearchArrowDown(event: Event): void {
    event.preventDefault();
    this._activeDescendant.move(1);
  }

  /** @protected ArrowUp — activate the previous option (wrap-around). */
  protected _onSearchArrowUp(event: Event): void {
    event.preventDefault();
    this._activeDescendant.move(-1);
  }

  /** @protected Home — activate the first option. */
  protected _onSearchHome(event: Event): void {
    event.preventDefault();
    this._activeDescendant.first();
  }

  /** @protected End — activate the last option. */
  protected _onSearchEnd(event: Event): void {
    event.preventDefault();
    this._activeDescendant.last();
  }

  /**
   * @protected Enter — commit the active option (APG "Enter selects active").
   * No-op when nothing is active. Multi-select toggles the option and resets the
   * active index so the narrowed list is navigated from the top again.
   */
  protected _onSearchEnter(event: Event): void {
    event.preventDefault();
    const index = this._activeDescendant.index();
    const opts = this.filteredOptions();
    if (index < 0 || index >= opts.length) return;
    const picked = opts[index].value;
    const compare = this.compareWith();
    const committed = this.selectionService.selectedValues();
    const next = this.multiple()
      ? committed.some((v) => compare(v, picked))
        ? committed.filter((v) => !compare(v, picked))
        : [...committed, picked]
      : [picked];
    this._commitSelection(next);
    if (this.multiple()) this._activeDescendant.reset();
  }

  /** @protected Escape — closes the dropdown (the close resets the query). */
  protected _onSearchEscape(event: Event): void {
    event.preventDefault();
    this.isOpen.set(false);
  }

  /**
   * @protected Tab / Shift+Tab — closes the dropdown. The default is prevented
   * because the search field lives in a detached overlay: letting Tab run would
   * move focus to whatever follows the overlay in the DOM rather than to the
   * field after the select. `_onPopupClosed` puts focus back on the trigger.
   */
  protected _onSearchTab(event: Event): void {
    event.preventDefault();
    this.isOpen.set(false);
  }

  /**
   * @protected Panel `mousedown`. In searchable mode the default is prevented
   * so pointing at an option (or the scrollbar) cannot blur the search input —
   * the activedescendant model and the open state both depend on focus staying
   * there. It must stay a **method**: an inline `searchable() && preventDefault()`
   * expression evaluates to `false` on the non-searchable path, and Angular
   * treats a `false` listener return as `preventDefault()`, which would swallow
   * the default for every select dropdown (breaking roving focus transfer to a
   * clicked option and text selection).
   */
  protected _onPanelMousedown(event: MouseEvent): void {
    if (this.searchable()) event.preventDefault();
  }

  /** @protected Handles a value change from the native select. */
  protected _onNativeChange(event: Event): void {
    const nativeSelect = event.target as HTMLSelectElement;
    const next = Array.from(nativeSelect.selectedOptions)
      .map((option) => this._nativeOptionFromKey(option.value))
      .filter((option): option is MlvSelectOption<T> => option !== null)
      .map((option) => option.value);
    this._commitSelection(next, false);
  }

  /** @protected Focuses the active interaction surface when the label is clicked. */
  protected _onLabelClick(): void {
    if (this._nativeActive()) {
      this._nativeSelect()?.nativeElement.focus();
      return;
    }
    this.openDropdown();
  }

  /** @protected Marks the native select as focused for the form wrapper. */
  protected _onNativeFocus(): void {
    this.setFocused(true);
  }

  /** @protected Marks the native select blur as the end of field interaction. */
  protected _onNativeBlur(): void {
    this.setFocused(false);
    this._markTouched();
  }

  /** @protected Whether a normalized option matches one of the committed values. */
  protected _isNativeOptionSelected(value: T): boolean {
    const compare = this.compareWith();
    return this.selectionService
      .selectedValues()
      .some((selected) => compare(selected, value));
  }

  /** @private Resolves an internal native option key back to its public option. */
  private _nativeOptionFromKey(key: string): MlvSelectOption<T> | null {
    const index = Number(key);
    if (!Number.isInteger(index)) return null;
    return this.resolvedOptions()[index] ?? null;
  }

  /**
   * @protected After the popup opens: hand focus to the search field. The input
   * is stamped inside the overlay (a detached embedded view), so it is not
   * reachable through this component's view queries — locate it by its
   * deterministic id, the same pattern `mlv-combobox` / `mlv-day-picker` use.
   * The lazy first load is triggered by the `isOpen` effect, not here.
   */
  protected _onPopupOpened(): void {
    if (!this.searchable()) return;
    document.getElementById(this._searchInputId())?.focus();
  }

  /**
   * @protected After the popup closes: restore focus to the trigger and (when
   * searchable) drop the query, so the next open starts from the full list. A
   * remote source is re-asked for `''` once, otherwise a blank search field
   * would sit above a list still filtered by the previous query.
   */
  protected _onPopupClosed(): void {
    this.setInitialFocus();
    if (!this.searchable()) return;
    this._activeDescendant.reset();
    if (this.searchQuery() !== '') {
      this.searchQuery.set('');
      if (this._adapter.mode() === 'remote') this._adapter.search('');
    }
  }

  override setFocused(isFocused = true): void {
    this._focused.set(isFocused);
  }

  /** @protected Marks the select touched when its trigger loses focus. */
  protected _onTriggerBlur(): void {
    this.setFocused(false);
    this._markTouched();
  }

  updateTriggerWidth(evt: ResizeObserverEntry[]): void {
    this.triggerWidth.set(evt[0].target.getBoundingClientRect().width);
  }

  /** Whether the control holds a clearable value — At least one option selected. */
  readonly hasValue = computed(
    () => this.selectionService.selectedValues().length > 0,
  );

  /**
   * The select renders its own clear button overlaid in the trigger row,
   * before the chevron — the wrapper must not render its trailing copy.
   */
  readonly ownsClearButton = computed(() => true);

  /**
   * @protected Whether the inline clear affordance is visible: clearable, a
   * value present, and the control interactive. Shared by the template's @if
   * and the trigger's padding-reserve class.
   *
   * Deliberately **not** gated on {@link _awaitingValueLabel}: the loading
   * variant makes every open path inert, so the clear button is the only
   * escape hatch left when a source never answers. `onClear()` works there —
   * dropping the value clears `hasValue()`, which ends the variant.
   */
  protected readonly _showClear = computed(
    () =>
      this.clearable() &&
      this.hasValue() &&
      !this.computedDisabled() &&
      !this.readonly(),
  );

  /** Clears the selection, writes the cleared forms value, and marks touched. */
  onClear(): void {
    this.selectionService.clear();
    this.value.set(fromAriaValues([], this.multiple()));
    this._markTouched();
  }

  /**
   * @private Syncs the selection service (the aria listbox panel's `value`
   * source) from the values last written through a forms binding. Each pending
   * value is matched against the current options via {@link compareWith} and
   * replaced by the option's own instance, so the check-marks and the displayed
   * label agree — and a value written before its options exist resolves as soon
   * as they arrive (the caller effect tracks `resolvedOptions()`).
   */
  private _applyPendingValues(): void {
    const compare = this.compareWith();
    const opts = this.resolvedOptions();
    const normalized = this._pendingValues.map(
      (v) => opts.find((o) => compare(o.value, v))?.value ?? v,
    );
    this.selectionService.setValues(normalized);
  }
}
