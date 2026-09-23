import {
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  Renderer2,
  signal,
  untracked,
  ViewContainerRef,
} from '@angular/core';
import type { ComponentRef } from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { Overlay } from '@angular/cdk/overlay';
import { DOWN_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import type { OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, timer } from 'rxjs';
import { debounce } from 'rxjs/operators';
import {
  DROPDOWN_POSITIONS,
  MlvActiveDescendant,
  MlvDropdownPanel,
  MlvOptionsAdapter,
  defaultOptionMatcher,
  defaultOptionTransform,
  filterOptions,
  optionId,
  resolveOptions,
} from '@malva-ui/core/dropdown';
import type {
  MlvOptionMatcher,
  MlvOptionsInput,
  MlvOptionsSearchFn,
  MlvSelectOption,
  MlvSelectOptionTransform,
} from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvRtlService, mlvNextId } from '@malva-ui/cdk/utils';
import { MLV_DENSITY_CONTEXT, MlvDensityService } from '@malva-ui/cdk/density';
import type { MlvDensity } from '@malva-ui/cdk/density';

/** Alias of {@link MlvOptionsSearchFn} — kept for backwards compatibility. */
export type MlvAutocompleteSearchFn<T> = MlvOptionsSearchFn<T>;

/**
 * `[mlvAutocomplete]` — a reusable autocomplete/typeahead behaviour applicable
 * to **any** text input: a native `<input>` or a `<mlv-input>`. It reuses the
 * same building blocks as `mlv-combobox` — the shared
 * {@link filterOptions matching utility} and the `mlv-dropdown-panel` list — to
 * render a suggestion popup, without forcing the field into a full form
 * control.
 *
 * Suggestions come from the {@link options} source — an array or
 * `Observable<T[]>` (filtered locally with {@link matcher}), or a
 * `MlvDataSource<T>` (which filters and pages itself) — or from an async
 * {@link search} function. Every shape is normalised by the shared
 * `MlvOptionsAdapter`. The directive owns
 * the popup (a CDK overlay hosting `mlv-dropdown-panel`, the same primitive
 * `mlv-popup` wraps — a headless attribute directive cannot host `mlv-popup`'s
 * declarative content template), the WAI-ARIA combobox wiring on the input
 * (`role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`,
 * `aria-controls`, `aria-activedescendant`), and the activedescendant keyboard
 * model (DOM focus stays in the input; Arrow/Home/End move the highlighted
 * option, Enter selects it, Escape closes then clears).
 *
 * @example
 * ```html
 * <!-- Static options on a plain mlv-input -->
 * <mlv-input [mlvAutocomplete]="fruits" (optionSelected)="pick($event)" />
 *
 * <!-- Async search with loading + highlighting -->
 * <mlv-input [mlvAutocompleteSearch]="searchUsers" [mlvAutocompleteMinLength]="2" />
 *
 * <!-- Data source: it filters (setSearch) and pages itself -->
 * <mlv-input [mlvAutocomplete]="usersDataSource" [mlvAutocompleteMinLength]="2" />
 *
 * <!-- Custom matcher -->
 * <mlv-input [mlvAutocomplete]="cities" [mlvAutocompleteMatcher]="startsWith" />
 * ```
 */
@Directive({
  selector: '[mlvAutocomplete],[mlvAutocompleteSearch]',
  exportAs: 'mlvAutocomplete',
  // Provided per-directive so the `mlv-dropdown-panel` component portal (created
  // with this directive's element injector) can resolve the MlvSelectionService it
  // injects — matching how `mlv-combobox` / `mlv-select` scope it.
  providers: [MlvSelectionService],
})
export class MlvAutocomplete<T = unknown> {
  /**
   * Suggestion source: a static array or `Observable<T[]>` (filtered locally
   * against the query with {@link matcher}), or a `MlvDataSource<T>` (which owns
   * its own filtering — the directive forwards the query as
   * `setSearch({ query, keys: [] })` and pages lazily). Ignored when a
   * {@link search} function is provided. Bound through the directive's own
   * selector: `[mlvAutocomplete]="options"`.
   */
  readonly options = input<MlvOptionsInput<T>>([], {
    alias: 'mlvAutocomplete',
  });

  /**
   * Async suggestion source: `(query) => T[] | Promise<T[]> | Observable<T[]>`.
   * When set, it supersedes {@link options}; results feed the panel and drive
   * the loading affordance. A newer query supersedes an in-flight one (its
   * result is discarded), while the previous results stay visible until the new
   * ones land.
   */
  readonly search = input<MlvAutocompleteSearchFn<T> | null>(null, {
    alias: 'mlvAutocompleteSearch',
  });

  /**
   * Maps a raw item to a `MlvSelectOption` (`{ label, value, group? }`). Same
   * convention as `mlv-select` / `mlv-combobox`; defaults to
   * {@link defaultOptionTransform} (uses `String(item)` as the label).
   */
  readonly toOption = input<MlvSelectOptionTransform<T>>(
    defaultOptionTransform as MlvSelectOptionTransform<T>,
    { alias: 'mlvAutocompleteToOption' },
  );

  /**
   * Predicate used to filter {@link options} against the query. Defaults to a
   * case- and diacritic-insensitive substring match on the label. Ignored when
   * {@link search} is provided (the async source owns its own matching).
   */
  readonly matcher = input<MlvOptionMatcher<T>>(defaultOptionMatcher, {
    alias: 'mlvAutocompleteMatcher',
  });

  /**
   * Debounce (ms) applied to keystrokes before filtering / searching — avoids
   * redundant work and API calls during rapid typing.
   * @default 200
   */
  readonly debounce = input<number>(200, {
    alias: 'mlvAutocompleteDebounce',
  });

  /**
   * Minimum query length before suggestions open. `0` (default) opens on focus
   * showing the full list — appropriate for cheap local filtering. Raise it
   * (2+ recommended) for async sources so a network call is not made on every
   * keystroke.
   * @default 0
   */
  readonly minLength = input<number>(0, {
    alias: 'mlvAutocompleteMinLength',
  });

  /**
   * When `true`, the matched substring of the query is emphasised inside each
   * suggestion label.
   * @default true
   */
  readonly highlight = input<boolean, BooleanInput>(true, {
    alias: 'mlvAutocompleteHighlight',
    transform: coerceBooleanProperty,
  });

  /**
   * When `true` (default), an **inline completion** is offered as the user types:
   * if the top visible suggestion's label starts with the typed text (a genuine
   * prefix, case-insensitively) and the caret is at the end of the field, the
   * remainder of that suggestion is inserted after the caret and left **selected**
   * — so continuing to type replaces it, `Enter`/click commits the full value, and
   * `Escape` reverts to just the typed text. The user's typed prefix keeps their
   * casing; only the appended remainder uses the suggestion's casing. Non-prefix
   * (fuzzy / substring-only) top matches are skipped silently (list-only). While
   * enabled the input advertises `aria-autocomplete="both"`; set `false` for
   * list-only behaviour (`aria-autocomplete="list"`).
   * @default true
   */
  readonly inline = input<boolean, BooleanInput>(true, {
    alias: 'mlvAutocompleteInline',
    transform: coerceBooleanProperty,
  });

  /**
   * When `true` (default), focusing the input opens the suggestion list
   * (subject to {@link minLength}). Set `false` to only open on typing / arrow.
   * @default true
   */
  readonly openOnFocus = input<boolean, BooleanInput>(true, {
    alias: 'mlvAutocompleteOpenOnFocus',
    transform: coerceBooleanProperty,
  });

  /** Disables the behaviour entirely (no popup, no aria wiring changes). */
  readonly disabled = input<boolean, BooleanInput>(false, {
    alias: 'mlvAutocompleteDisabled',
    transform: coerceBooleanProperty,
  });

  /**
   * Text shown / announced inside the panel's loading affordances — the top row
   * while a remote source (an async {@link search} or a `MlvDataSource`)
   * resolves, and the bottom row while a further page loads. Localise by binding
   * a translated string.
   * @default 'Loading…'
   */
  readonly loadingText = input<string>('Loading…', {
    alias: 'mlvAutocompleteLoadingText',
  });

  /**
   * Distance (px) from the end of the suggestion list at which the next
   * data-source page is requested. Only meaningful for a `MlvDataSource`
   * {@link options} source, which is the only shape that pages.
   * @default 150
   */
  readonly infiniteScrollThreshold = input<number>(150, {
    alias: 'mlvAutocompleteInfiniteScrollThreshold',
  });

  /**
   * Density applied to the suggestion panel's option rows.
   *
   * The panel is hosted in a bare CDK overlay portaled to the overlay container,
   * outside the input's DOM tree, so ancestor density classes cannot cascade
   * into it. The resolved density is stamped as a `mlv--{density}` class on the
   * panel host (the same mechanism `mlv-popup` uses for its detached panel).
   * When omitted, the nearest ancestor `MLV_DENSITY_CONTEXT` (e.g. a
   * `form[mlvForm]`) applies, then the global `MlvDensityService` density.
   */
  readonly density = input<MlvDensity | undefined>(undefined, {
    alias: 'mlvAutocompleteDensity',
  });

  /**
   * Raises the suggestion panel's minimum width above the input field.
   *
   * The panel is floored at the field's measured width by default. This input
   * can only **raise** that floor — a value narrower than the field does not
   * shrink the panel, because the measured width stays in the resolved
   * `max()`.
   *
   * Accepts a number of pixels or a CSS length string; the units resolve in
   * the browser, not here. Absolute and font-relative lengths (`px`, `rem`,
   * `em`, `ch`) and viewport units (`vw`) behave as written. **Percentages do
   * not** — under flexible dimensions CDK lays the pane out as a `static` flex
   * item of its bounding box, which it sizes to the space between the field's
   * anchored edge and the viewport edge, so `'50%'` means half of *that*, and
   * the same markup resolves differently depending on where the field sits on
   * the page. `ch`, likewise, resolves against the pane's own font, not the
   * suggestion rows'.
   *
   * Two ceilings it deliberately outranks, per CSS's
   * `max(min-width, min(max-width, width))`:
   * - {@link maxWidth} — a ceiling below the effective floor is ignored, and
   *   the panel renders past its bounding box (nothing clips it).
   * - the viewport. A floor wider than the space to the viewport edge pushes
   *   the panel off-screen; the `.cdk-overlay-pane { max-width: 100% }` clamp
   *   governs *content*-driven growth only.
   */
  readonly minWidth = input<number | string | undefined>(undefined, {
    alias: 'mlvAutocompleteMinWidth',
  });

  /**
   * Caps the suggestion panel's width.
   *
   * With no value the viewport is the only ceiling — the flexible connected
   * strategy sizes its bounding box to the space up to the viewport edge and
   * `.cdk-overlay-pane { max-width: 100% }` caps the pane there. This input can
   * only **tighten** that: a value wider than the viewport is still clamped by
   * it. Accepts a CSS length string or a number of pixels.
   *
   * It cannot pull the panel below its floor. CSS resolves the used width as
   * `max(min-width, min(max-width, width))`, so a ceiling under the effective
   * floor — the field width, or {@link minWidth} when that is higher — is
   * **silently ignored** and the panel overflows its bounding box, which has
   * no `overflow: hidden`. Set the floor down as well if you need the panel
   * narrower than its field.
   */
  readonly maxWidth = input<number | string | undefined>(undefined, {
    alias: 'mlvAutocompleteMaxWidth',
  });

  /**
   * The raw value of the last selected suggestion, or `null`. Two-way bindable
   * (`[(mlvAutocompleteValue)]`) so a parent can observe the committed pick.
   */
  readonly selectedValue = model<T | null>(null, {
    alias: 'mlvAutocompleteValue',
  });

  /** Emits the full `MlvSelectOption` each time the user selects a suggestion. */
  readonly optionSelected = output<MlvSelectOption<T>>();

  /** Emits `true` when the suggestion list opens and `false` when it closes. */
  readonly openedChange = output<boolean>();

  // ─── DI ────────────────────────────────────────────────────────────────────

  /** @private Host element the directive is applied to (native input or mlv-input). */
  private readonly _hostEl =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** @private Renderer for DOM attribute/listener wiring on the resolved input. */
  private readonly _renderer = inject(Renderer2);
  /** @private CDK overlay factory used to host the suggestion panel. */
  private readonly _overlay = inject(Overlay);
  /** @private View container + injector for the `mlv-dropdown-panel` component portal. */
  private readonly _vcr = inject(ViewContainerRef);
  private readonly _injector = inject(Injector);
  /** @private Directive lifetime, for imperative listener / subscription cleanup. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Global density service — fallback when no explicit {@link density} is supplied. */
  private readonly _densityService = inject(MlvDensityService);
  private readonly _rtlService = inject(MlvRtlService);

  /** @private Ancestor-projected density (`MLV_DENSITY_CONTEXT`); consulted before the service. */
  private readonly _densityContext = inject(MLV_DENSITY_CONTEXT, {
    optional: true,
  });

  // ─── State ───────────────────────────────────────────────────────────────

  /** @private The resolved focusable `<input>` (host itself, or the inner input of a `mlv-input`). */
  private readonly _inputEl = signal<HTMLInputElement | null>(null);
  /** @private Current (post-input) query text. */
  private readonly _query = signal('');
  /** @private The current suggestion options rendered in the panel. */
  private readonly _results = signal<MlvSelectOption<T>[]>([]);
  /**
   * @private Shared source adapter: arrays / observables filter locally, a
   * `MlvDataSource` or `search` fn run remotely. Debounce is 0 here because the
   * directive already debounces keystrokes before `_runQuery`.
   */
  private readonly _adapter = new MlvOptionsAdapter<T>({
    source: this.options,
    searchFn: this.search,
    debounce: signal(0),
    eager: signal(false),
  });
  /** @private Panel loading flag — only remote sources report loading. */
  private readonly _panelLoading = computed(
    () => this._adapter.mode() === 'remote' && this._adapter.loading(),
  );
  /**
   * @private Shared activedescendant bookkeeping: tracks the highlighted option
   * index over the current results with wrap-around navigation. The same engine
   * backs `mlv-combobox`.
   */
  private readonly _activeDescendant = new MlvActiveDescendant(
    () => this._results().length,
  );
  /** @private Whether the suggestion popup is open. */
  private readonly _open = signal(false);
  /** @private The attached panel component ref (a signal so the sync effect re-runs on attach). */
  private readonly _panelRef = signal<ComponentRef<MlvDropdownPanel<T>> | null>(
    null,
  );
  /**
   * @private Accessible name handed to the panel's inner `role="listbox"`,
   * re-read from the host input on **every** query while the popup is open —
   * not once per overlay. See {@link _resolveHostAccessibleName} and the
   * `.set()` call in {@link _openPopup}.
   */
  private readonly _panelAriaLabel = signal<string | null>(null);

  /** Whether the suggestion popup is currently open (read-only view of internal state). */
  readonly isOpen = this._open.asReadonly();

  /** @private Stable listbox id shared between the input's `aria-controls` and the panel's option ids. */
  private readonly _listboxId = mlvNextId('mlv-autocomplete-listbox');

  /**
   * @private Debounced keystroke stream. Carries the query text plus whether the
   * triggering edit was an insertion (text grew) so the debounced `_runQuery`
   * knows whether an inline completion may be offered — only genuine insertions
   * complete, never deletions (Backspace/Delete/cut), focus, or arrow-open.
   */
  private readonly _input$ = new Subject<{
    query: string;
    insertion: boolean;
  }>();
  /** @private Skips the synthetic `input` event dispatched while committing / completing a value. */
  private _suppressNextInput = false;
  /** @private Live overlay reference while the panel is open. */
  private _overlayRef: OverlayRef | null = null;
  /**
   * @private `inputType` of the pending native edit, captured on `beforeinput`
   * and consumed on `input`. Non-null in real browsers (drives precise
   * insert-vs-delete detection); `null` in environments that don't fire
   * `beforeinput` (jsdom / programmatic edits), where a length comparison is the
   * fallback.
   */
  private _pendingInputType: string | null = null;
  /** @private Length of the input value at the previous `input` event — the length-comparison fallback for insertion detection. */
  private _previousValueLength = 0;
  /** @private Whether the current query is allowed to offer an inline completion (set per `_runQuery`; only true for inline-enabled insertions). */
  private _completionArmed = false;
  /** @private Whether an inline completion (typed prefix + selected remainder) is currently present in the input. */
  private _completionActive = false;
  /** @private The `mlv--{density}` class currently applied to the panel host, for removal on change. */
  private _appliedDensityClass: string | null = null;

  constructor() {
    // Keep the detached panel host stamped with the resolved density cascade
    // class. The overlay (and panel element) is recreated on every open, so the
    // applied-class memo resets when the ref clears; while open, the effect also
    // reacts to live density changes.
    effect(() => {
      const ref = this._panelRef();
      if (!ref) {
        this._appliedDensityClass = null;
        return;
      }
      const el = ref.location.nativeElement as HTMLElement;
      const next = `mlv--${this.density() ?? this._densityContext?.() ?? this._densityService.density()}`;
      if (this._appliedDensityClass === next) return;
      if (this._appliedDensityClass) {
        this._renderer.removeClass(el, this._appliedDensityClass);
      }
      this._renderer.addClass(el, next);
      this._appliedDensityClass = next;
    });
    // Debounce keystrokes before filtering / searching. The last event in the
    // window wins (rxjs `debounce`), so its `insertion` flag is what gates the
    // inline completion for the resolved query.
    this._input$
      .pipe(
        debounce(() => timer(Math.max(0, this.debounce()))),
        takeUntilDestroyed(),
      )
      .subscribe(({ query, insertion }) => this._runQuery(query, insertion));

    // Resolve the real <input> and wire native listeners. When the host itself
    // is an <input> it is available immediately; when the host is a `mlv-input`
    // (or any wrapper) the inner <input> only exists after the first render.
    if (this._hostEl.tagName === 'INPUT') {
      this._bindTo(this._hostEl as HTMLInputElement);
    } else {
      afterNextRender(() => {
        const el = this._hostEl.querySelector('input');
        if (el) this._bindTo(el);
      });
    }

    // Keep the input's WAI-ARIA combobox attributes in sync with popup state.
    effect(() => {
      const el = this._inputEl();
      if (!el) return;
      const open = this._open();
      this._renderer.setAttribute(el, 'role', 'combobox');
      // "both": inline text completion + a list of suggestions (WAI-ARIA
      // list-with-inline-autocomplete). "list": suggestions only, no inline
      // completion. Tracks the `inline` opt-out.
      this._renderer.setAttribute(
        el,
        'aria-autocomplete',
        this.inline() ? 'both' : 'list',
      );
      this._renderer.setAttribute(el, 'aria-expanded', String(open));
      if (open) {
        this._renderer.setAttribute(el, 'aria-controls', this._listboxId);
        const activeId = this._activeOptionId();
        if (activeId) {
          this._renderer.setAttribute(el, 'aria-activedescendant', activeId);
        } else {
          this._renderer.removeAttribute(el, 'aria-activedescendant');
        }
      } else {
        this._renderer.removeAttribute(el, 'aria-controls');
        this._renderer.removeAttribute(el, 'aria-activedescendant');
      }
    });

    // Push current state into the attached panel component.
    effect(() => {
      const ref = this._panelRef();
      if (!ref) return;
      ref.setInput('options', this._results());
      ref.setInput('multiple', false);
      ref.setInput('selectedValues', []);
      ref.setInput('focusMode', 'activedescendant');
      ref.setInput('activeIndex', this._activeDescendant.index());
      ref.setInput('listboxId', this._listboxId);
      // Name the listbox after the field it belongs to — the same contract
      // `mlv-select` / `mlv-combobox` express with `label() || ariaLabel()`,
      // resolved from the DOM here because the field is the consumer's.
      // `null` emits no attribute (#222).
      ref.setInput('ariaLabel', this._panelAriaLabel());
      ref.setInput('loading', this._panelLoading());
      ref.setInput('loadingText', this.loadingText());
      ref.setInput('hasMore', this._adapter.hasMore());
      ref.setInput('loadingMore', this._adapter.loadingMore());
      ref.setInput('infiniteScrollThreshold', this.infiniteScrollThreshold());
      ref.setInput(
        'highlightQuery',
        this.highlight() ? this._query().trim() : '',
      );
    });

    // Mirror the adapter's items into the rendered results whenever the source
    // produces a new set: a remote result landing, or a local observable
    // emitting after the panel is already open (nothing else would repaint it
    // until the next keystroke). Remote items render as-is — the source owns
    // filtering — while local ones are re-filtered against the current query.
    // Running only on an item-set change is what keeps stale remote results
    // visible while a newer query is in flight; the inline completion is offered
    // once per armed query.
    effect(() => {
      const mode = this._adapter.mode();
      const items = this._adapter.items();
      untracked(() => {
        if (mode === 'remote') {
          this._results.set(items.map((item) => this.toOption()(item)));
          if (this._completionArmed && !this._adapter.loading()) {
            this._applyCompletion();
            this._completionArmed = false;
          }
          return;
        }
        // Local: only an open panel needs repainting — a closed one is filled by
        // `_runQuery` when it opens.
        if (!this._open()) return;
        this._results.set(
          filterOptions(
            resolveOptions([...items], this.toOption()),
            this._query(),
            this.matcher(),
          ),
        );
        // The highlighted row may not exist in the new list.
        if (this._activeDescendant.index() >= this._results().length) {
          this._activeDescendant.reset();
        }
      });
    });

    this._destroyRef.onDestroy(() => this._disposeOverlay());
  }

  /**
   * @private Resolves the focusable `<input>` and attaches the native listeners
   * (input / focus / blur / keydown) that drive the behaviour. Cleaned up on
   * directive destroy.
   */
  private _bindTo(el: HTMLInputElement): void {
    this._inputEl.set(el);
    this._previousValueLength = el.value.length;
    // Capture the edit intent (insert vs delete) before the value changes, so
    // `_onInput` can gate the inline completion precisely in real browsers. Not
    // fired for programmatic value changes (jsdom / our own dispatches), where
    // `_onInput` falls back to a length comparison.
    this._destroyRef.onDestroy(
      this._renderer.listen(el, 'beforeinput', (event: Event) => {
        this._pendingInputType =
          'inputType' in event ? (event as InputEvent).inputType : null;
      }),
    );
    this._destroyRef.onDestroy(
      this._renderer.listen(el, 'input', () => this._onInput()),
    );
    this._destroyRef.onDestroy(
      this._renderer.listen(el, 'focus', () => this._onFocus()),
    );
    this._destroyRef.onDestroy(
      this._renderer.listen(el, 'blur', () => this._onBlur()),
    );
    this._destroyRef.onDestroy(
      this._renderer.listen(el, 'keydown', (event: KeyboardEvent) =>
        this._onKeydown(event),
      ),
    );
  }

  /**
   * @private `aria-activedescendant` target: the DOM id of the highlighted
   * option row, or `null` when nothing is active. Matches the id the panel
   * renders (`<listboxId>-option-<index>`).
   */
  private readonly _activeOptionId = () => {
    const index = this._activeDescendant.index();
    if (index < 0 || index >= this._results().length) return null;
    return optionId(this._listboxId, index);
  };

  // ─── Input / focus events ──────────────────────────────────────────────────

  /** @private Handles a native `input` event: pushes the value (with insertion flag) into the debounced stream. */
  private _onInput(): void {
    if (this._suppressNextInput) {
      this._suppressNextInput = false;
      // Discard any beforeinput type that paired with our own synthetic dispatch.
      this._pendingInputType = null;
      return;
    }
    // A genuine user edit invalidates any inline completion currently in the
    // field (the edit has replaced or removed the selected remainder).
    this._completionActive = false;
    if (this._isInert()) return;
    const query = this._inputEl()?.value ?? '';
    this._input$.next({ query, insertion: this._consumeInsertion(query) });
  }

  /**
   * @private Whether the just-observed `input` event grew the field's text (a
   * genuine insertion) rather than deleting from it. Prefers the `beforeinput`
   * `inputType` when available (real browsers), else compares the value length
   * against the previous `input` event. Consumes the pending type and records
   * the new length either way.
   */
  private _consumeInsertion(value: string): boolean {
    const inputType = this._pendingInputType;
    this._pendingInputType = null;
    const insertion =
      inputType !== null
        ? inputType.startsWith('insert')
        : value.length > this._previousValueLength;
    this._previousValueLength = value.length;
    return insertion;
  }

  /** @private Opens suggestions on focus (immediate, bypassing debounce) when enabled. */
  private _onFocus(): void {
    if (this._isInert() || !this.openOnFocus()) return;
    this._runQuery(this._inputEl()?.value ?? '');
  }

  /** @private Closes the popup when focus genuinely leaves the field. */
  private _onBlur(): void {
    this._closePopup();
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  /** @private Activedescendant keyboard model — DOM focus stays in the input. */
  private _onKeydown(event: KeyboardEvent): void {
    if (this._isInert()) return;
    switch (this._rtlService.normalizeArrowKey(event) ?? event.key) {
      case DOWN_ARROW:
        event.preventDefault();
        if (this._open()) this._activeDescendant.move(1);
        else this._runQuery(this._inputEl()?.value ?? '');
        break;
      case UP_ARROW:
        event.preventDefault();
        if (this._open()) this._activeDescendant.move(-1);
        else this._runQuery(this._inputEl()?.value ?? '');
        break;
      case 'Home':
        if (this._open() && this._results().length) {
          event.preventDefault();
          this._activeDescendant.first();
        }
        break;
      case 'End':
        if (this._open() && this._results().length) {
          event.preventDefault();
          this._activeDescendant.last();
        }
        break;
      case 'Enter': {
        const index = this._activeDescendant.index();
        const results = this._results();
        if (this._open() && index >= 0 && index < results.length) {
          event.preventDefault();
          this._commit(results[index]);
        }
        break;
      }
      case 'Escape': {
        // Revert any inline completion to just the typed text first, then apply
        // the existing close-then-clear semantics.
        const stripped = this._stripCompletion();
        if (this._open()) {
          event.preventDefault();
          this._closePopup();
        } else if (stripped) {
          // The strip already reverted the completed text on this keypress; do
          // not also clear the field.
          event.preventDefault();
        } else if (this._inputEl()?.value) {
          event.preventDefault();
          this._clearInput();
        }
        break;
      }
      default:
        break;
    }
  }

  // ─── Query resolution ───────────────────────────────────────────────────────

  /**
   * @private Resolves suggestions for `query` and opens / closes the popup.
   * Local sources (arrays / observables) filter synchronously; a remote source
   * (a `MlvDataSource` or an async {@link search}) shows the loading affordance
   * while keeping the previous results visible, and a newer query supersedes it.
   */
  private _runQuery(query: string, insertion = false): void {
    this._query.set(query);
    this._activeDescendant.reset();
    // Arm the inline completion only for inline-enabled insertions. Focus /
    // arrow-open (`insertion` false) and deletions never complete.
    this._completionArmed = insertion && this.inline();
    if (this._isInert()) return;

    if (query.length < this.minLength()) {
      this._results.set([]);
      this._closePopup();
      return;
    }

    if (this._adapter.mode() === 'local') {
      const options = resolveOptions(
        [...this._adapter.items()],
        this.toOption(),
      );
      this._results.set(filterOptions(options, query, this.matcher()));
      this._openPopup();
      if (this._completionArmed) {
        this._applyCompletion();
        this._completionArmed = false;
      }
      return;
    }

    // Remote: seed the panel from what the source already holds, open (the
    // spinner row sits over those stale results), then search. Seeding is what
    // makes a re-entry into an already-answered query repaint: the mirroring
    // effect only fires on an item-set *change*, so a `search` fn that memoises
    // and returns the identical array for a repeated query — or a data source
    // whose slice reference is unchanged — would otherwise leave the panel
    // empty after the min-length gate cleared `_results`. The adapter discards
    // superseded results; the effect renders new ones.
    this._results.set(
      this._adapter.items().map((item) => this.toOption()(item)),
    );
    this._openPopup();
    this._adapter.search(query);
  }

  // ─── Inline completion ─────────────────────────────────────────────────────

  /**
   * @private Offers an inline completion for the current results: if the top
   * suggestion's label is a genuine case-insensitive **prefix** of the typed
   * text and the caret sits at the end of the field, append the suggestion's
   * remainder (in its own casing) after the typed prefix (kept in the user's
   * casing) and leave that remainder **selected**. The completed value is pushed
   * through the same synthetic-`input` path a commit uses so `mlv-input` /
   * `ngModel` / a form control observe it, and the top item (index 0) becomes the
   * activedescendant-active row. No-op unless armed for an inline insertion with
   * an open panel; non-prefix (fuzzy) top matches are skipped silently.
   */
  private _applyCompletion(): void {
    if (!this.inline() || !this._open()) return;
    const el = this._inputEl();
    if (!el) return;
    const typed = el.value;
    const typedLength = typed.length;
    if (typedLength === 0) return;
    // Only complete when the caret is a plain cursor at the very end.
    if (el.selectionStart !== typedLength || el.selectionEnd !== typedLength) {
      return;
    }
    const top = this._results()[0];
    if (!top) return;
    const label = top.label;
    if (
      label.length <= typedLength ||
      !label.toLowerCase().startsWith(typed.toLowerCase())
    ) {
      return;
    }
    // Keep the user's typed casing; take the remainder from the suggestion.
    const completed = typed + label.slice(typedLength);
    el.value = completed;
    el.setSelectionRange(typedLength, completed.length);
    this._completionActive = true;
    // Highlight the completed top item so keyboard nav / Enter stay coherent.
    this._activeDescendant.first();
    // Propagate the completed value the same way a commit does (suppressing our
    // own re-filter of this synthetic event).
    this._suppressNextInput = true;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * @private Strips an active inline completion back to the typed prefix (the
   * text before the selected remainder), restoring the caret to the end and
   * notifying value listeners. Returns whether a completion was stripped.
   */
  private _stripCompletion(): boolean {
    if (!this._completionActive) return false;
    const el = this._inputEl();
    if (!el) return false;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    // The completion is the trailing selection [start, value.length].
    if (end !== el.value.length || start >= end) {
      this._completionActive = false;
      return false;
    }
    const typed = el.value.slice(0, start);
    el.value = typed;
    el.setSelectionRange(typed.length, typed.length);
    this._completionActive = false;
    this._query.set(typed);
    this._suppressNextInput = true;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ─── Selection ───────────────────────────────────────────────────────────────

  /**
   * Panel (pointer) selection handler — subscribed to the `mlv-dropdown-panel`
   * `valueChange`. The panel is never seeded with a committed selection
   * (`selectedValues` is always `[]`), so any non-empty emit is a genuine pick —
   * no aria reconciliation guard is needed. Public so the overlay subscription
   * (and unit tests) can invoke it.
   *
   * The picked value is always one of the rendered options' own values, so it
   * is looked up by identity with `Object.is`, not `===`: a `NaN`-valued option
   * is otherwise never found and its pick silently does nothing (#300), and a
   * `-0` option stays distinct from a `+0` one.
   */
  selectFromPanel(values: readonly T[]): void {
    if (!values.length) return;
    const picked = values[values.length - 1];
    const option = this._results().find((o) => Object.is(o.value, picked));
    if (option) this._commit(option);
  }

  /** @private Commits a suggestion: writes its full label into the input (caret to end), emits, and closes. */
  private _commit(option: MlvSelectOption<T>): void {
    this._completionActive = false;
    const el = this._inputEl();
    if (el) {
      el.value = option.label;
      // Full value, caret at the end (clears any completion selection).
      el.setSelectionRange(option.label.length, option.label.length);
      // Notify mlv-input / ngModel listeners without re-triggering our own filter.
      this._suppressNextInput = true;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    this._query.set(option.label);
    this.selectedValue.set(option.value);
    this.optionSelected.emit(option);
    this._closePopup();
  }

  /** @private Clears the input text (second Escape) and notifies listeners. */
  private _clearInput(): void {
    const el = this._inputEl();
    if (!el) return;
    el.value = '';
    this._query.set('');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ─── Overlay ─────────────────────────────────────────────────────────────────

  /**
   * @private Resolves the accessible name of the host `<input>`, so the
   * suggestion panel's inner `role="listbox"` can carry the same one.
   *
   * `mlv-select` and `mlv-combobox` name that listbox from their own `label` /
   * `ariaLabel` inputs, so it always shares the accessible name of the field it
   * belongs to. This directive owns no field — it attaches to an input the
   * consumer wrote — so it reads the name off that input rather than inventing
   * a generic one: there is no autocomplete i18n pack to translate a fallback
   * string from, and an untranslated English literal is not shippable in a
   * library.
   *
   * Follows the accessible-name computation's order for a labelable control:
   * `aria-labelledby` (step 2B), then `aria-label` (2C), then the associated
   * `<label>` elements (2D). `title` and `placeholder` are deliberately not
   * consulted — both rank below these as last-resort sources, and a
   * placeholder-derived name is a WCAG smell the library should not launder
   * into a plausible-looking one.
   *
   * Returns `null` when the input carries no name of its own, so the panel
   * emits **no** `aria-label` rather than an empty one: an unnamed
   * `role="combobox"` input is the consumer's own WCAG 4.1.2 defect, and giving
   * its popup a name would only make that harder to see.
   *
   * Note this is a consistency fix, not an axe fix. axe's
   * `aria-input-field-name` exempts a listbox that any `role="combobox"`
   * `aria-controls`/`aria-owns` points at (`isComboboxPopup` in
   * `no-naming-method-matches`), which is exactly how the panel is wired, so
   * the rule reports it `inapplicable` either way.
   */
  private _resolveHostAccessibleName(el: HTMLInputElement): string | null {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const referenced = labelledBy
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => el.ownerDocument.getElementById(id))
        .filter((node): node is HTMLElement => node !== null)
        .map((node) => this._accessibleText(node))
        .filter(Boolean)
        .join(' ');
      if (referenced) return referenced;
    }

    const ariaLabel = this._flatten(el.getAttribute('aria-label') ?? '');
    if (ariaLabel) return ariaLabel;

    const fromLabels = Array.from(el.labels ?? [])
      .map((label) => this._accessibleText(label))
      .filter(Boolean)
      .join(' ');
    return fromLabels || null;
  }

  /**
   * @private Text of `node` as the accessible-name computation would read it:
   * `aria-hidden` subtrees removed and whitespace collapsed.
   *
   * The `aria-hidden` filter is what keeps `mlv-hint`'s projected source text
   * out — it is hidden precisely so it stays out of the labelled control's own
   * name, and the panel has to match that name, not a longer one. `innerText`
   * would do this natively but needs layout, which jsdom has none of, so the
   * spec suite would silently read a different string from the browser.
   */
  private _accessibleText(node: HTMLElement): string {
    if (node.getAttribute('aria-hidden') === 'true') return '';
    const clone = node.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('[aria-hidden="true"]')
      .forEach((hidden) => hidden.remove());
    return this._flatten(clone.textContent ?? '');
  }

  /**
   * @private `text` as a *flat string*: every run of whitespace collapsed to a
   * single space, then trimmed.
   *
   * Applied to **every** naming source, `aria-label` included. The
   * accessible-name computation normalizes whitespace once, at the end, over
   * whichever source it took — so `aria-label="Fruit    basket"` computes to
   * `"Fruit basket"` on the input itself. Collapsing on the element-text branch
   * only would make the panel disagree with the field it is named after for
   * exactly the inputs where the raw attribute is not already flat.
   */
  private _flatten(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /** @private Creates (if needed) and shows the suggestion overlay. */
  private _openPopup(): void {
    if (this._isInert()) return;
    const el = this._inputEl();
    if (!el) return;

    // Re-resolve the field's accessible name for the panel on EVERY query, not
    // only on the open that creates the overlay — this `.set()` sits above the
    // `if (!this._overlayRef)` guard deliberately. `_openPopup()` is re-entered
    // from `_runQuery()` on each debounced keystroke, while the overlay (and
    // with it the panel component) is created on the first open of a session
    // and disposed on close. So moving this inside the guard would pin the name
    // for the whole session: a consumer label that changes while the popup is
    // up — a locale switch, an `@if`-swapped `<label>` — would keep the old name
    // until the popup closed. Per query bounds any staleness at the next
    // keystroke instead; pinned by "re-resolves the field's name on each query,
    // not once per overlay" in the spec. Closer than that would need a
    // `MutationObserver` over DOM this directive does not own — deliberately
    // not done.
    this._panelAriaLabel.set(this._resolveHostAccessibleName(el));

    if (!this._overlayRef) {
      const positionStrategy = this._overlay
        .position()
        .flexibleConnectedTo(el)
        .withFlexibleDimensions(true)
        .withPush(false)
        // Below the field first, flipping above it, then anchoring the panel's
        // inline-end edge to the field when there is not enough room after it
        // — shared with `mlv-select` / `mlv-combobox` (#154).
        .withPositions(DROPDOWN_POSITIONS);

      this._overlayRef = this._overlay.create({
        positionStrategy,
        direction: this._rtlService.resolveDirection(el),
        scrollStrategy: this._overlay.scrollStrategies.reposition(),
        // A floor, not a cap: a suggestion longer than the field grows the
        // panel instead of being clipped. The flexible connected strategy
        // sizes its bounding box to the space up to the viewport edge and
        // `.cdk-overlay-pane { max-width: 100% }` caps the pane there, so
        // content wider than the viewport still clamps (#150).
        minWidth: this._resolveMinWidth(el),
        ...(this.maxWidth() !== undefined ? { maxWidth: this.maxWidth() } : {}),
        hasBackdrop: false,
      });

      const ref = this._overlayRef.attach(
        new ComponentPortal(MlvDropdownPanel, this._vcr, this._injector),
      ) as ComponentRef<MlvDropdownPanel<T>>;

      // Paint a floating surface on the bare panel. `mlv-combobox` / `mlv-select`
      // nest the panel in a styled `mlv-popup`; the directive's overlay hosts it
      // directly, so it would otherwise be transparent over the page. Applied on
      // the panel's own host element (which already carries `mlv-dropdown-panel`)
      // as the BEM modifier — dropdown-panel.scss owns the `--surface` styles.
      this._renderer.addClass(
        ref.location.nativeElement,
        'mlv-dropdown-panel--surface',
      );

      // `valueChange` is an `output()` (OutputRef) — subscribe directly; the
      // subscription is torn down when the overlay (and panel) is disposed.
      ref.instance.valueChange.subscribe((values) =>
        this.selectFromPanel(values),
      );

      // Lazy paging: the panel's scroll sentinel asks for the next data-source
      // page. The adapter is a no-op unless another page exists and the previous
      // one has landed.
      ref.instance.loadMore.subscribe(() => this._adapter.loadMore());

      // Keep DOM focus in the input while pointing at options: a mousedown on the
      // panel must not blur the field (which would close before the click lands).
      this._renderer.listen(
        this._overlayRef.overlayElement,
        'mousedown',
        (event: MouseEvent) => event.preventDefault(),
      );

      // Backdrop-less dismissal: close on a genuine outside click (the input /
      // host is treated as "inside" so caret repositioning does not dismiss).
      this._overlayRef
        .outsidePointerEvents()
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe((event) => {
          if (!this._hostEl.contains(event.target as Node)) this._closePopup();
        });

      this._panelRef.set(ref);
    }

    if (!this._open()) {
      this._open.set(true);
      this.openedChange.emit(true);
    }
  }

  /** @private Hides and disposes the overlay, resetting popup state. */
  private _closePopup(): void {
    const wasOpen = this._open();
    this._activeDescendant.reset();
    this._disposeOverlay();
    this._open.set(false);
    if (wasOpen) this.openedChange.emit(false);
  }

  /** @private Tears down the overlay + panel ref. */
  private _disposeOverlay(): void {
    this._panelRef.set(null);
    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null;
    }
  }

  /**
   * @private The floor handed to the overlay: the field's measured width, or a
   * CSS `max()` of it and {@link minWidth} when that is set.
   *
   * Expressed as `max()` rather than resolved here so the author's units
   * (`rem`, `ch`, `%`, `vw`) keep their meaning — px is the only unit the
   * field can be measured in, and converting the other side to it would
   * freeze it against the root font size at open time.
   */
  private _resolveMinWidth(el: HTMLElement): number | string {
    const measured = el.getBoundingClientRect().width;
    const floor = this.minWidth();
    if (floor === undefined) return measured;
    const authored = typeof floor === 'number' ? `${floor}px` : floor;
    return `max(${measured}px, ${authored})`;
  }

  /** @private Whether all interaction paths are suppressed. */
  private _isInert(): boolean {
    return this.disabled();
  }
}
