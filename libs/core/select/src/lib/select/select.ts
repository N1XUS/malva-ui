import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  model,
  PLATFORM_ID,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { Signal } from '@angular/core';
import { isPlatformServer, NgTemplateOutlet } from '@angular/common';
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
import type {
  MlvFormState,
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
import {
  MlvSelectItemTemplate,
  MlvSelectSelectedTemplate,
} from '../select-template.directives';
import { LucideChevronDown, LucideSearch } from '@lucide/angular';
import { MlvClick } from '@malva-ui/cdk/accessibility';
import { MlvBreakpointService, MlvResizeObserver } from '@malva-ui/cdk/utils';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  defaultCompareWith,
  DROPDOWN_POSITIONS,
  filteredOutCommitted,
  filterOptions,
  isReconciliationEmit,
  MlvActiveDescendant,
  MlvDropdownPanel,
  MlvOptionsAdapter,
  optionId,
  valueIndex,
} from '@malva-ui/core/dropdown';
import type {
  MlvOptionMatcher,
  MlvOptionsInput,
  MlvOptionsSearchFn,
  MlvValueIndex,
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
  /**
   * @protected The select has two interaction surfaces and they take a name
   * differently. While the native `<select>` is live it carries {@link id} and
   * is labelable, so a plain `for` works. Behind the custom trigger the id sits
   * on a `div[role="combobox"]`, which `<label for>` cannot name at all — the
   * `aria-input-field-name` violation this defect produced (#197) — so the
   * trigger references the label through `aria-labelledby` instead.
   */
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return this._nativeActive() ? 'native' : 'aria';
  }

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
   *
   * Under server rendering `'auto'` cannot know the viewport, so the server
   * renders the native control, and a client **hydrating** that markup renders
   * it too for its first render, claiming the server's `<select>`; an
   * at-or-above-`md` client then switches to the custom trigger inside the same
   * application tick (#218). A select that is not being hydrated — a client-only
   * app, a dialog, an `@if` that turns on later — follows the viewport from its
   * first render.
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
  readonly compareWith = input<(a: T, b: T) => boolean>(defaultCompareWith);

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
  protected readonly _i18n = inject(MLV_SELECT_I18N);

  /** @private Shared responsive breakpoint state used by native `'auto'` mode. */
  private readonly _breakpoint = inject(MlvBreakpointService);

  /** @private Injector for the after-render focus hand-off in {@link _endHydratingRender}. */
  private readonly _injector = inject(Injector);

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
   * @private The resolved option **values**, indexed for repeated membership /
   * resolution queries under {@link compareWith}. Rebuilt only when the option
   * list or the comparator changes, and shared by every value-vs-options check
   * in this control ({@link _allValuesMatched} and `_applyPendingValues`) —
   * each of those used to run its own nested `selected × options` scan, so with
   * a lazily paged source the total cost of a scroll session grew
   * quadratically as pages accumulated.
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

  /**
   * @private The **committed selection**, indexed for the per-option membership
   * test the native `<select>` runs (`_isNativeOptionSelected`). A separate
   * index from {@link _optionValueIndex}, and deliberately so — the two are
   * keyed on different signals and invalidate independently: this one rebuilds
   * when the selection or the comparator changes, that one when the option list
   * or the comparator changes.
   *
   * **The haystack is the selection, not the options, because argument order is
   * observable.** `_isNativeOptionSelected` calls `compare(selected, value)` —
   * reversed relative to the other five value-vs-options checks in this file,
   * which call `compare(option.value, committedValue)`. `valueIndex` applies
   * `compare(indexedValue, queriedValue)`, so indexing the selection and
   * querying with an option value reproduces the original order exactly.
   * Indexing the options instead would silently transpose the arguments, and a
   * consumer's `compareWith` is under no obligation to be symmetric.
   *
   * Holding `selectedValues()` by reference inside the index is safe *as this
   * library drives it*: every write from `MlvSelect`, `MlvCombobox` and
   * `MlvSelectionService`'s own mutators (`select` / `deselect` / `clear`)
   * `set`s a freshly built array rather than mutating in place, so a stale
   * index is always discarded by the signal, never silently re-read. Note this
   * is a property of the call sites, not an invariant the service enforces —
   * `setValues(values)` stores the caller's array as-is, and the service is
   * publicly reachable, so an external caller that mutated an array it had
   * already handed over would defeat both this index and the signal itself.
   *
   * The `compareWith()` read is tracked but, today, redundant: a comparator
   * change invalidates {@link _optionValueIndex}, which re-runs the
   * pending-values effect, which calls `setValues` with a fresh `map()` result
   * — so the selection identity always changes alongside the comparator. It
   * stays tracked because that coupling is incidental, not guaranteed.
   */
  private readonly _selectedValueIndex: Signal<MlvValueIndex<T>> = computed(
    () =>
      valueIndex(this.selectionService.selectedValues(), this.compareWith()),
  );

  /**
   * @private Whether this select renders on the server, where `native="auto"`
   * is always the native `<select>` (#218). A server has no viewport: CDK's
   * `MediaMatcher` falls back to a `matchMedia` stub, so `MlvBreakpointService`
   * reports `'sm'` anyway — this makes the answer independent of that, so a
   * server given a viewport hint still renders what a hydrating client's first
   * render renders.
   */
  private readonly _isServer = isPlatformServer(inject(PLATFORM_ID));

  /** @private The `<mlv-select>` host element. */
  private readonly _host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /**
   * @private `true` while this select is **being hydrated**, until its first
   * browser render has claimed the server's nodes (cleared by
   * {@link _endHydratingRender}). For that render `native="auto"` renders the
   * native `<select>` the server rendered, whatever the viewport (#218). A
   * hydrating desktop client used to resolve the trigger on its first render
   * instead, and hydration does not report that as NG0500: it silently
   * discarded the server's `<select>` at application stability, with a dead
   * `<select>` and the live trigger carrying the same id until then.
   *
   * `false` from the start on the server and on every browser render that is
   * not hydration — a client-only app, a dialog, an `@if` that turns on after
   * hydration, a subtree under `ngSkipHydration`, a bootstrap without
   * `provideClientHydration()` — so `'auto'` follows the viewport from its
   * first render there, as it always did.
   *
   * **Relies on Angular internals** (verified against Angular 22.1.7). Angular
   * exposes no public "this component is being hydrated" signal. The server
   * stamps an `ngh` attribute on every component host it serialises for
   * hydration; the client reads and removes it in `renderComponent` →
   * `retrieveHydrationInfo`, which runs **after** the host's directives — this
   * component included — are constructed. So the attribute is on the host in
   * this field initializer exactly when the host node came from the server and
   * is being claimed, and it is already gone by the first after-render hook: it
   * must be read here, not later. The
   * "tripwire" spec in `select-ssr.spec.ts` fails if Angular stops stamping it
   * or starts stripping it before construction.
   */
  private readonly _hydrating = signal(
    !this._isServer && this._host.hasAttribute('ngh'),
  );

  /**
   * @private Set from the end of a hydrating render that switches to the
   * trigger — or, when `native` turns `false` during that render, from just
   * before the render that removes the `<select>` — until the removal has run,
   * so the `blur` Chromium fires on that removal is not taken for the user
   * leaving the field — see {@link _endHydratingRender}. The window lies inside
   * one synchronous application tick, so no user event can land in it.
   */
  private _handingOffFocus = false;

  /**
   * @private Whether the `<select>` held focus at any point of the
   * {@link _handingOffFocus} window — already at its start, or focused by an
   * after-render hook that ran after this select's own. Read and cleared by the
   * hand-off.
   */
  private _focusedDuringHandOff = false;

  /**
   * @private An open requested through `openDropdown()` / `toggleDropdown()`
   * while a hydrating render that will switch to the trigger still renders the
   * `<select>` — e.g. from a parent's `ngAfterViewInit`. Applied once the switch
   * has run, so those calls keep their documented outcome (#218). Until then a
   * `toggleDropdown()` treats it as an open dropdown.
   */
  private _openAfterHydratingRender = false;

  /**
   * @protected Whether the native select is the active interaction surface.
   * `'auto'` follows the shared `md` breakpoint and updates when the viewport
   * changes — except on the server and while {@link _hydrating}, when it is
   * the native select (#218).
   */
  protected readonly _nativeActive = computed(() => {
    const mode = this.native();
    return (
      mode === true ||
      (mode === 'auto' &&
        (this._isServer ||
          this._hydrating() ||
          this._breakpoint.isDown('md')()))
    );
  });

  /**
   * @private Whether this select is in a hydrating render that renders the
   * native `<select>` only because it is hydrating: `native="auto"` at or above
   * `md`, which the end of that render switches to the trigger (#218). An
   * explicit `native="true"` and a phone render the same branch hydrating or
   * not, so they are never deferred.
   */
  private _switchesAfterHydratingRender(): boolean {
    return (
      this._hydrating() &&
      this.native() === 'auto' &&
      !this._breakpoint.isDown('md')()
    );
  }

  /**
   * @protected Normalized native option groups. Each option receives an
   * internal index key so arbitrary `T` values can travel through the native
   * select without stringifying the public form value.
   *
   * One group per run of consecutive options sharing a label (`''` and
   * `undefined` both unlabelled), so a label that recurs after another starts
   * a new group. Built in one pass: each run's `options` array is created
   * here, per computation, and appended to in place (the `mlv-dropdown-panel`
   * `_groups` shape). Copying the run for every option instead made an
   * ungrouped list — one run — cost n²/2 element copies (#373).
   */
  protected readonly _nativeOptionGroups = computed<
    readonly NativeOptionGroup<T>[]
  >(() => {
    const groups: NativeOptionGroup<T>[] = [];
    let run: NativeOption<T>[] = [];
    this.resolvedOptions().forEach((option, index) => {
      const nativeOption: NativeOption<T> = {
        key: String(index),
        label: option.label,
        value: option.value,
        group: option.group,
        disabled: option.disabled,
      };
      const label = option.group || null;
      if (groups[groups.length - 1]?.label === label) {
        run.push(nativeOption);
      } else {
        run = [nativeOption];
        groups.push({ label, options: run });
      }
    });
    return groups;
  });

  /**
   * @private The `value` of every native `<option>` that should be selected,
   * keyed exactly as the template stamps them — the placeholder's empty string
   * included. Derived from the same signals the `[attr.selected]` bindings
   * read, so the effect that writes the DOM property and the attributes in the
   * markup can never disagree.
   *
   * A value with no matching option contributes no key, which leaves a
   * single-select with nothing selected and lets the browser's own "ask for a
   * reset" fall back to the first enabled option — the behaviour the previous
   * per-option property binding already had.
   */
  private readonly _nativeSelectedKeys = computed<ReadonlySet<string>>(() => {
    const keys = new Set<string>();
    // Mirrors the template: the placeholder exists only in single mode.
    if (!this.multiple() && !this.hasValue()) keys.add('');
    const selected = this._selectedValueIndex();
    for (const group of this._nativeOptionGroups()) {
      for (const option of group.options) {
        if (selected.has(option.value)) keys.add(option.key);
      }
    }
    return keys;
  });

  /** @protected Whether every committed value has a matching option (by `compareWith`). */
  protected readonly _allValuesMatched = computed(() => {
    const options = this._optionValueIndex();
    return this.selectionService.selectedValues().every((v) => options.has(v));
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

  /**
   * Ordered CDK positions handed to the dropdown's overlay: below the trigger
   * first, flipping above it, then anchoring the panel's inline-end edge to the
   * trigger when there is not enough room after it. See
   * {@link DROPDOWN_POSITIONS}, shared with `mlv-combobox` and
   * `[mlvAutocomplete]`.
   */
  readonly dropdownPositions: ConnectedPosition[] = DROPDOWN_POSITIONS;

  readonly selectionService = inject(MlvSelectionService);

  itemTemplate = contentChild(MlvSelectItemTemplate);
  selectedTemplate = contentChild(MlvSelectSelectedTemplate);

  /** @private Reference to the trigger element, used to restore focus after selection. */
  private readonly _triggerElement = viewChild('trigger', { read: ElementRef });
  /** @private Reference to the transparent native select when native mode is active. */
  private readonly _nativeSelect =
    viewChild<ElementRef<HTMLSelectElement>>('nativeSelect');
  /** @private Reference to the rendered dropdown panel component. */
  private readonly _dropdownPanel = viewChild(MlvDropdownPanel);
  /**
   * @private The dropdown popup — read by `_onPopupOpened` to know whether the
   * open panel is a full-screen sheet, which has to take focus in.
   */
  private readonly _popupRef = viewChild(MlvPopup);

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
        untracked(() => this.isOpen.set(false));
      } else if (untracked(this._hydrating) && untracked(this._nativeSelect)) {
        // `native` turned `false` during a hydrating render (#218) — any
        // hydrating select, `native="true"` and phones included — so this
        // render removes the claimed `<select>`, and the focus hand-off window
        // opens here. `refreshView` runs a view's template update *before* its
        // effects, so this only runs ahead of the removal because the
        // `<select>`'s `@if` lives in the `mlvFormControlWrapperControl`
        // template `mlv-form-control-wrapper` stamps through
        // `ngTemplateOutlet`, a view refreshed after this component's
        // effects. Moving that `@if` into this component's own template
        // would open the window after the removal (reasoned, not measured):
        // the `openDropdown()` + `native` false specs would go red.
        untracked(() => this._openHandOffWindow());
      }
    });
    effect(() => {
      // A hydrating desktop renders the native branch for its first render
      // only (#218) and leaves it in the same tick, so its lazy `searchFn`
      // first runs on the first open, as on a client-rendered desktop. The
      // condition is read tracked: `native` turning `true`, or the viewport
      // answer dropping below `md`, during that render keeps the `<select>`
      // without changing `_nativeActive()`, and the load must still run.
      if (this._nativeActive() && !this._switchesAfterHydratingRender()) {
        untracked(() => this._adapter.ensureLoaded());
      }
    });
    effect(() => {
      this._pendingValues = toAriaValues(this.value());
      // Reads `_optionValueIndex()` (resolvedOptions() + compareWith()) → the
      // effect still re-runs when options arrive later.
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
    this._syncNativeSelection();
    if (this._hydrating()) this._endHydratingRender();
  }

  /**
   * @private Ends the first render of a hydrating select (#218): after it,
   * `native="auto"` follows the viewport, so an at-or-above-`md` client
   * re-renders the trigger in the same application tick.
   *
   * **Focus.** The `<select>` can hold focus when the switch removes it: the
   * user focused the server-rendered control before any JavaScript ran (no
   * `focus` listener saw it), or an after-render hook registered after this
   * select's own focused it in this same pass — a `cdkTrapFocusAutoCapture`
   * region, a sibling directive. What an engine does on that removal differs:
   * Chromium fires `blur` synchronously, with `activeElement` already `<body>`
   * (measured: Chrome 152); jsdom follows the HTML focus-fixup rule and fires
   * nothing. So this does not wait for a `blur`. Whenever the switch will
   * remove the `<select>` it opens the {@link _handingOffFocus} window, noting
   * whether the `<select>` holds focus now and — through
   * {@link _onNativeFocus} — whether anything focuses it later in the window;
   * a `native` turning `false` during the hydrating render — on any hydrating
   * select, `native="true"` and phones included — removes the `<select>`
   * before any after-render hook runs, so the effect
   * watching `_nativeActive()` opens the window instead, while the `<select>`
   * is still connected (see the comment there for why the effect runs first).
   * A `blur` inside the window that names
   * another element withdraws the claim ({@link _onNativeBlur}), so of two
   * hydrating selects the one focused last keeps focus. Once the re-render has
   * run, a `<select>` that held focus hands it to the trigger if focus fell to
   * `<body>`; if something else took focus, only the field's focused state is
   * cleared (jsdom never blurred it). The field is not marked touched — the
   * user did not leave it — which is also why {@link _onNativeBlur} ignores the
   * Chromium `blur` in the window.
   *
   * The hand-off waits for the re-render because the trigger is still
   * `aria-hidden` and out of the tab order in this pass, and moving focus
   * while the `<select>` is still in the DOM fires a real `blur` on it.
   *
   * **Opening.** An `openDropdown()` / `toggleDropdown()` made during the
   * hydrating render ({@link _openAfterHydratingRender}) opens the dropdown in
   * the nested hook, after the switch — unless the field is inert by then, or
   * the `<select>` stayed. The request stays pending until that hook reads it,
   * so a `toggleDropdown()` in between — from an after-render hook that runs
   * after this select's first one — cancels it, as it would an open dropdown. An
   * `isOpen.set(false)` written after such a call is not seen: the request
   * still opens.
   */
  private _endHydratingRender(): void {
    afterNextRender(() => {
      this._hydrating.set(false);
      if (
        this._nativeActive() ||
        (!this._nativeSelect() && !this._handingOffFocus)
      ) {
        // Nothing leaves: the `<select>` stays (a phone, `native` turned
        // `true`), or there never was one (`native="false"`).
        this._openAfterHydratingRender = false;
        this._handingOffFocus = false;
        this._focusedDuringHandOff = false;
        return;
      }
      this._openHandOffWindow();
      afterNextRender(
        () => {
          this._handingOffFocus = false;
          const focused = this._focusedDuringHandOff;
          this._focusedDuringHandOff = false;
          if (focused) {
            const doc = this._host.ownerDocument;
            const active = doc.activeElement;
            if (!active || active === doc.body) {
              this.setInitialFocus();
            } else if (!this._host.contains(active)) {
              this.setFocused(false);
            }
          }
          const openRequested = this._openAfterHydratingRender;
          this._openAfterHydratingRender = false;
          if (openRequested && !this._isInert()) this.isOpen.set(true);
        },
        { injector: this._injector },
      );
    });
  }

  /**
   * @private Opens the {@link _handingOffFocus} window, noting whether the
   * claimed `<select>` holds focus as it opens. With the `<select>` already
   * gone — removed by the render the effect opened the window for — what the
   * window recorded so far stands.
   */
  private _openHandOffWindow(): void {
    const nativeSelect = this._nativeSelect()?.nativeElement;
    if (nativeSelect) {
      this._focusedDuringHandOff =
        nativeSelect.ownerDocument.activeElement === nativeSelect;
    }
    this._handingOffFocus = true;
  }

  /**
   * @private Writes the committed selection onto the native `<option>`
   * elements as the `selected` **DOM property**, once per render pass in which
   * the selection or the option list changed.
   *
   * **Why not a template binding.** `selected` is one of the properties
   * domino's `HTMLOptionElement` does not implement, and Angular's
   * unknown-property check is `'selected' in element` — so `[selected]` logged
   * an NG0303 on every server render, once per option plus once for the
   * placeholder (issue #135). The template now binds `[attr.selected]`, which
   * the check does not gate and which, unlike the property, actually
   * serialises into the server payload.
   *
   * **Why the attribute alone is not enough.** The content attribute sets an
   * option's *default* selectedness. The HTML spec gives every option a
   * "dirtiness" flag, raised as soon as the user picks in the select, and once
   * it is raised the attribute stops changing selectedness altogether. Bind
   * only the attribute and the first programmatic write after any user
   * interaction — a `formControl.setValue`, a `[(value)]` write, the clear
   * button — would update the markup while the rendered control kept showing
   * the option the user had picked. The IDL property has no such rule, so this
   * is what keeps the two in step; the attribute stays for the server payload,
   * the pre-hydration paint, and a native form reset.
   *
   * **Why `afterRenderEffect`, and why only one.** It never runs on the server,
   * so the error class is gone by construction rather than suppressed, and it
   * re-runs when its inputs change, which a one-shot `afterNextRender` would
   * not. It is registered **once per select**, not once per option: every
   * after-render sequence joins an app-wide set that `AfterRenderImpl.execute()`
   * walks on every `ApplicationRef.tick()` whether or not it is dirty, so a
   * sequence per `<option>` would put a real cost on a long list where the
   * template binding it replaced had none. One walk of `select.options` (which
   * flattens `<optgroup>`s) covers every option, single and multiple alike.
   *
   * The sequence is registered for every select, including the default
   * `native = false`, where the effect reads `_nativeSelect()`, finds nothing
   * and returns. That is not free — a page of 50 ordinary selects carries 50
   * permanently-clean sequences where the old template binding carried none —
   * but a clean sequence costs a `hooks[phase]` miss on three of the four
   * phases and one dirty-flag read on the fourth, with no allocation and no
   * DOM access.
   *
   * Order within the walk does not matter: assigning `true` in a single-select
   * clears the others, and the `false` writes that follow only re-assert what
   * is already the case. That holds because Chrome and jsdom both deselect
   * siblings on the setter; a literal reading of the spec's selectedness
   * algorithm ("keep the last selected option") does not guarantee it, so do
   * not lean on the ordering anywhere else.
   */
  private _syncNativeSelection(): void {
    afterRenderEffect(() => {
      const nativeSelect = this._nativeSelect()?.nativeElement;
      if (!nativeSelect) return;
      const selectedKeys = this._nativeSelectedKeys();
      for (const option of Array.from(nativeSelect.options)) {
        option.selected = selectedKeys.has(option.value);
      }
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
   *
   * Called during the first render of a hydrating at-or-above-`md`
   * `native="auto"` select — a parent's `ngAfterViewInit`, say — the toggle
   * applies once that render has switched to the trigger, later in the same
   * application tick (#218).
   */
  toggleDropdown(): void {
    if (this._switchesAfterHydratingRender()) {
      // Toggled while a hydrating render still shows the `<select>` it is
      // about to replace (#218): an open lands after the switch. A dropdown
      // already open through `isOpen` closes now.
      if (this.isOpen()) {
        this.isOpen.set(false);
        this._openAfterHydratingRender = false;
      } else {
        this._openAfterHydratingRender = !this._openAfterHydratingRender;
      }
      return;
    }
    if (this._nativeActive()) {
      this._nativeSelect()?.nativeElement.focus();
      return;
    }
    // An open still pending from a hydrating render (#218) counts as open: that
    // render's `native` has since turned `false`, or the render has ended and
    // the hook that applies the open has not run yet.
    if (this.isOpen() || this._openAfterHydratingRender) {
      this.isOpen.set(false);
      this._openAfterHydratingRender = false;
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
   *
   * Called during the first render of a hydrating at-or-above-`md`
   * `native="auto"` select, it focuses the server-rendered `<select>` still on
   * screen, and focus and the open land on the trigger once that render has
   * switched to it, later in the same application tick (#218).
   */
  openDropdown(): void {
    if (this.computedDisabled()) return;
    if (this._switchesAfterHydratingRender()) {
      // Called while a hydrating render still shows the `<select>` it is about
      // to replace (#218): focus goes to that `<select>` — the hand-off carries
      // it to the trigger — and the open lands after the switch.
      this._openAfterHydratingRender = true;
      this._nativeSelect()?.nativeElement.focus();
      return;
    }
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
   *
   * Known gap: opening from closed, the request is a plain `Subject` emission
   * sent before the dropdown panel exists to subscribe, so it is lost and the
   * anchored dropdown leaves focus on the trigger. A full-screen sheet does not
   * depend on it — `_onPopupOpened` moves focus in (#322).
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

  /**
   * @protected Marks the native select as focused for the form wrapper — and,
   * inside the {@link _handingOffFocus} window, records the focus so the
   * hand-off carries it to the trigger once the switch removes the `<select>`.
   */
  protected _onNativeFocus(): void {
    this.setFocused(true);
    if (this._handingOffFocus) this._focusedDuringHandOff = true;
  }

  /**
   * @protected Marks the native select blur as the end of field interaction —
   * except during a hydrating render that removes the `<select>` (#218, see
   * {@link _endHydratingRender}), where no user can have left the field: the
   * `blur` Chromium fires on that removal, or a hook moving focus elsewhere
   * inside that one tick. There a blur that names where focus went
   * (`relatedTarget`) also withdraws the `<select>`'s claim to the hand-off, so
   * a focus that moved on to another field stays there; the removal `blur`
   * names nothing (measured: Chrome 152). A removal after that render — a
   * viewport crossing `md`, `native` turning `false` — still marks the field
   * touched.
   */
  protected _onNativeBlur(event: FocusEvent): void {
    this.setFocused(false);
    if (this._handingOffFocus || this._switchesAfterHydratingRender()) {
      if (event.relatedTarget !== null) this._focusedDuringHandOff = false;
      return;
    }
    this._markTouched();
  }

  /**
   * @protected Whether a normalized option matches one of the committed values.
   *
   * Feeds the `[attr.selected]` binding on each native `<option>`, so it is
   * called once per rendered option — and, being a template method rather than
   * a computed, on *every* change-detection pass of the native branch, not
   * only when a signal changes. (The live selection is written separately, as
   * the `selected` DOM property; see {@link _syncNativeSelection}.)
   *
   * It was the last nested
   * `selected × options` scan in this control; it now resolves through the
   * memoised {@link _selectedValueIndex}, whose `has()` preserves the original
   * `compare(selected, value)` argument order.
   */
  protected _isNativeOptionSelected(value: T): boolean {
    return this._selectedValueIndex().has(value);
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
   *
   * A non-searchable dropdown leaves focus where it is while anchored (the
   * trigger keeps it; unchanged), but a full-screen sheet is a modal dialog
   * behind a solid scrim (#322), so focus has to move into it — see
   * {@link _focusSheetTabStop}.
   */
  protected _onPopupOpened(): void {
    if (this.searchable()) {
      document.getElementById(this._searchInputId())?.focus();
      return;
    }
    if (this._popupRef()?.isFullscreen()) this._focusSheetTabStop();
  }

  /**
   * @private Moves focus onto the listbox's tab stop inside an open
   * full-screen sheet: the first selected option it can focus, else the first
   * option it can focus — `@angular/aria`'s default tab stop, which the panel
   * already pins.
   *
   * Deferred one render: `afterOpened` fires once the panel and its rows
   * exist, but aria writes its default `tabindex="0"` from an
   * `afterRenderEffect`, so at that point every row still reads `-1`. The
   * selected-then-first fallbacks cover a render where aria has not written it
   * yet. Nothing happens if the sheet closed or stopped being full-screen in
   * between.
   *
   * `_openFromKey`'s `requestFocusFirst()` cannot do this: it is a plain
   * `Subject` emission sent before the panel exists to subscribe, so it is
   * lost, and it would pick the first option over the selected one.
   */
  private _focusSheetTabStop(): void {
    afterNextRender(
      () => {
        if (!this.isOpen() || !this._popupRef()?.isFullscreen()) return;
        const listbox = this._host.ownerDocument.getElementById(
          this.listboxId(),
        );
        if (!listbox) return;
        const target =
          listbox.querySelector<HTMLElement>('[role="option"][tabindex="0"]') ??
          listbox.querySelector<HTMLElement>(
            '[role="option"][aria-selected="true"]:not([aria-disabled="true"])',
          ) ??
          listbox.querySelector<HTMLElement>(
            '[role="option"]:not([aria-disabled="true"])',
          ) ??
          listbox;
        target.focus();
      },
      { injector: this._injector },
    );
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

  /**
   * @protected Marks the select touched when focus leaves it from the trigger.
   *
   * A blur whose `relatedTarget` sits inside this select's own open dropdown
   * panel is focus moving between the control's own parts, not leaving it
   * (owner ruling D22, #347): a full-screen sheet taking focus on open (#322),
   * or the search field taking it on a searchable open. That blur neither
   * marks the field touched nor clears the focused state; focus comes back to
   * the trigger when the panel closes (`_onPopupClosed`), and the trigger's
   * next blur is the one that counts.
   */
  protected _onTriggerBlur(event?: FocusEvent): void {
    if (this._isInOwnPanel(event?.relatedTarget ?? null)) return;
    this.setFocused(false);
    this._markTouched();
  }

  /**
   * @private Whether `target` lies inside this select's own dropdown panel —
   * the `.mlv-popup` surface holding its listbox, which also holds the search
   * field and a full-screen sheet's close button. Resolved through the
   * listbox's deterministic id, since the panel is portaled into the overlay
   * container outside this component's view. `false` while the panel is not
   * rendered.
   *
   * Not the base `_focusLeavesControl` (#347): it always counts the host as
   * inside, so trigger → clear button would stop touching (follow-up #554).
   */
  private _isInOwnPanel(target: EventTarget | null): boolean {
    if (!target || !('nodeType' in target)) return false;
    const panel = this._host.ownerDocument
      .getElementById(this.listboxId())
      ?.closest('.mlv-popup');
    return !!panel && panel.contains(target as Node);
  }

  /**
   * Re-measures the trigger from an `mlvResizeObserver` entry and republishes
   * {@link triggerWidth} — the dropdown's minimum width.
   */
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
   * as they arrive (the caller effect reads `_optionValueIndex()`, which
   * tracks `resolvedOptions()`).
   */
  private _applyPendingValues(): void {
    const options = this._optionValueIndex();
    const normalized = this._pendingValues.map((v) => options.resolve(v));
    this.selectionService.setValues(normalized);
  }
}
