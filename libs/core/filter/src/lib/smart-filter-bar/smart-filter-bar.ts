import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  LucideChevronDown,
  LucideChevronUp,
  LucidePlus,
  LucideRefreshCw,
  LucideSettings2,
} from '@lucide/angular';
import { mlvNextId } from '@malva-ui/cdk/utils';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { normalizeForMatch } from '@malva-ui/core/dropdown';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import type { MlvSearchFieldTrigger } from '@malva-ui/core/search-field';
import { MlvSearchField } from '@malva-ui/core/search-field';
import { MLV_FILTER_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import type {
  MlvFilterApplyMode,
  MlvFilterCondition,
  MlvFilterConditionStrategy,
  MlvFilterDefinition,
  MlvFilterExecutionPayload,
  MlvFilterFieldState,
  MlvFilterOperator,
  MlvSmartFilterBarAppearance,
} from '../filter.types';
import { mlvFilterFieldsToExpression } from '../filter-expression';
import { MlvFilter } from '../filter/filter';
import type { MlvFilterValueEditorContext } from '../filter/filter-value-editor';
import { MlvFilterValueEditorDef } from '../filter/filter-value-editor';
import { MlvExpand } from '@malva-ui/core/expand';

/** Returns whether an operator-complete condition represents an applied value. */
function isConditionMeaningful(condition: MlvFilterCondition): boolean {
  if (condition.operator === 'empty' || condition.operator === 'not-empty') {
    return true;
  }
  if (condition.operator === 'between' && Array.isArray(condition.value)) {
    return (
      condition.value.length === 2 &&
      condition.value.every(
        (value) => value !== null && value !== undefined && value !== '',
      )
    );
  }
  if (Array.isArray(condition.value)) return condition.value.length > 0;
  return (
    condition.value !== null &&
    condition.value !== undefined &&
    condition.value !== ''
  );
}

/** Deeply copies a supported structured filter value. */
function cloneFilterValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through for values outside the structured-clone algorithm.
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneFilterValue(item)) as T;
  }
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value instanceof Map) {
    return new Map(
      [...value].map(([key, item]) => [
        cloneFilterValue(key),
        cloneFilterValue(item),
      ]),
    ) as T;
  }
  if (value instanceof Set) {
    return new Set([...value].map((item) => cloneFilterValue(item))) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneFilterValue(item)]),
    ) as T;
  }
  return value;
}

/** Copies field states and nested operands for immutable public snapshots. */
function cloneFieldStates(
  states: readonly MlvFilterFieldState[],
): MlvFilterFieldState[] {
  return states.map((state) => ({
    key: state.key,
    strategy: state.strategy,
    conditions: state.conditions.map((condition) => ({
      ...condition,
      value: cloneFilterValue(condition.value),
    })),
  }));
}

/** Whether two ordered string collections contain the same values. */
function stringArraysEqual(
  first: readonly string[],
  second: readonly string[],
): boolean {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}

/** Metadata-driven query header for search, field filters, and execution. */
@Component({
  selector: 'mlv-smart-filter-bar',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvCheckbox,
    MlvFilter,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvSearchField,
    LucideChevronDown,
    LucideChevronUp,
    LucidePlus,
    LucideRefreshCw,
    LucideSettings2,
    MlvExpand,
  ],
  templateUrl: './smart-filter-bar.html',
  styleUrl: './smart-filter-bar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-smart-filter-bar',
    '[class.mlv-smart-filter-bar--collapsed]': '!filtersVisible()',
    '[class.mlv-smart-filter-bar--loading]': 'loading()',
    '[class.mlv-smart-filter-bar--disabled]': 'disabled()',
    '[class.mlv-smart-filter-bar--query]': "appearance() === 'query'",
    '[attr.aria-busy]': 'loading() || null',
  },
})
export class MlvSmartFilterBar {
  /** @protected Reactive translated strings for filters. */
  protected readonly _i18n = inject(MLV_FILTER_I18N);

  /** @private ICU resolver for parameterized translated strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @private Injector required by post-overlay render focus restoration. */
  private readonly _injector = inject(Injector);

  /** Metadata for every available filter field. */
  readonly definitions = input.required<readonly MlvFilterDefinition[]>();

  /** Structured filter state. */
  readonly filters = model<readonly MlvFilterFieldState[]>([]);

  /** Whether the bar renders its established toolbar or natural-language query row. */
  readonly appearance = input<MlvSmartFilterBarAppearance>('classic');

  /** Keys currently shown in the filter row. */
  readonly visibleKeys = model<readonly string[]>([]);

  /** Global search query submitted with structured filters. */
  readonly searchValue = model<string>('');

  /** Commit behavior for the global search field. */
  readonly searchTrigger = input<MlvSearchFieldTrigger>('live');

  /** Debounce passed to the global live-search field. */
  readonly searchDebounce = input<number, number | string>(200, {
    transform: (value) => Math.max(0, numberAttribute(value, 200)),
  });

  /** Apply behavior used by each field filter editor. */
  readonly filterApplyMode = input<MlvFilterApplyMode>('live');

  /** Whether live search/filter commits should execute immediately. */
  readonly autoExecute = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether structured fields are expanded beneath the query actions. */
  readonly filtersVisible = model(true);

  /** Whether the global search field is rendered. */
  readonly showSearch = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Whether query execution is in progress. */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether every control in the bar is unavailable. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emitted with an immutable snapshot when the query executes. */
  readonly execute = output<MlvFilterExecutionPayload>();

  /** Emitted when consumers should refresh using the current query snapshot. */
  readonly refresh = output<MlvFilterExecutionPayload>();

  /** Emitted after search, filter values, and visibility return to defaults. */
  readonly resetCompleted = output<void>();

  /** @protected Search term used only inside the available-filters manager. */
  protected readonly _availableSearch = signal('');

  /** @private Optional blank fields deliberately selected through query Add filter. */
  private readonly _queryAddedKeys = signal<readonly string[]>([]);

  /** @private Added key awaiting focus after its popup has detached. */
  private readonly _pendingAddedKey = signal<string | undefined>(undefined);

  /** @private Staged field visibility while the manager dialog is open. */
  private readonly _draftVisibleKeys = signal<readonly string[]>([]);

  /** @protected Id linking the filter visibility trigger to its region. */
  protected readonly _filtersId = mlvNextId('mlv-smart-filter-bar-filters');

  /** @protected Id linking the manager trigger to its dialog content. */
  protected readonly _managerId = mlvNextId('mlv-smart-filter-bar-manager');

  /** @protected Id for the validation summary announced after a blocked query. */
  protected readonly _validationSummaryId = mlvNextId(
    'mlv-smart-filter-bar-validation',
  );

  /** @private Whether metadata defaults have been applied to a usable definition set. */
  private _definitionsInitialized = false;

  /** @private Previous metadata keys used to distinguish new defaults from hidden fields. */
  private _knownDefinitionKeys = new Set<string>();

  /** @private Whether a query attempt should expose required-field errors. */
  private readonly _validationAttempted = signal(false);

  /** @private Coalesces paired condition/strategy model changes into one execution. */
  private _autoExecuteQueued = false;

  /** @private Manager panel used to focus its search field after opening. */
  private readonly _managerPanel =
    viewChild<ElementRef<HTMLElement>>('managerPanel');

  /** @private Manager trigger restored after keyboard and action closes. */
  private readonly _managerButton = viewChild('managerButton', {
    read: ElementRef<HTMLButtonElement>,
  });

  /** @private Query Add filter popup panel focused after it opens. */
  private readonly _addPanel = viewChild<ElementRef<HTMLElement>>('addPanel');

  /** @private Query Add filter trigger used when the pending field disappears. */
  private readonly _addButton = viewChild('addButton', {
    read: ElementRef<HTMLButtonElement>,
  });

  /** @private Rendered filter hosts used to focus the first invalid field. */
  private readonly _filterHosts = viewChildren(MlvFilter, {
    read: ElementRef,
  });

  /** @private Projected custom value-editor templates, matched to definitions by key. */
  private readonly _valueEditors = contentChildren(MlvFilterValueEditorDef, {
    descendants: true,
  });

  /** Visible definitions in stable metadata order. */
  readonly visibleDefinitions = computed(() => {
    const visible = new Set(this.visibleKeys());
    return this.definitions().filter((definition) =>
      visible.has(definition.key),
    );
  });

  /** @protected Query chips represent required, meaningful, or deliberately added blank fields. */
  protected readonly _queryDefinitions = computed(() => {
    const active = new Set(
      this.filters()
        .filter((state) => state.conditions.some(isConditionMeaningful))
        .map((state) => state.key),
    );
    const added = new Set(this._queryAddedKeys());
    return this.visibleDefinitions().filter(
      (definition) =>
        definition.required ||
        active.has(definition.key) ||
        added.has(definition.key),
    );
  });

  /** @protected Definitions that may be added without creating duplicate or disabled fields. */
  protected readonly _addableDefinitions = computed(() => {
    const visible = new Set(
      this._queryDefinitions().map((definition) => definition.key),
    );
    const query = normalizeForMatch(this._availableSearch().trim());
    return this.definitions().filter(
      (definition) =>
        !definition.disabled &&
        !visible.has(definition.key) &&
        (!query || normalizeForMatch(definition.label).includes(query)),
    );
  });

  /** Number of filter fields currently visible. */
  readonly visibleFilterCount = computed(
    () => this.visibleDefinitions().length,
  );

  /** Number of fields with at least one applied condition. */
  readonly appliedFilterCount = computed(
    () =>
      this.filters().filter((state) =>
        state.conditions.some(isConditionMeaningful),
      ).length,
  );

  /** @protected Required definitions without an applied, meaningful condition. */
  protected readonly _missingRequiredDefinitions = computed(() => {
    const states = new Map(this.filters().map((state) => [state.key, state]));
    return this.definitions().filter((definition) => {
      if (!definition.required) return false;
      return !states
        .get(definition.key)
        ?.conditions.some(isConditionMeaningful);
    });
  });

  /** @protected Whether required-field errors should currently be rendered. */
  protected readonly _showRequiredErrors = computed(
    () =>
      this._validationAttempted() &&
      this._missingRequiredDefinitions().length > 0,
  );

  /** @protected Whether search or any structured condition is active. */
  protected readonly _hasState = computed(
    () => this.searchValue().length > 0 || this.appliedFilterCount() > 0,
  );

  /** @protected Definitions matching the available-filter search. */
  protected readonly _filteredDefinitions = computed(() => {
    const query = normalizeForMatch(this._availableSearch().trim());
    if (!query) return this.definitions();
    return this.definitions().filter((definition) =>
      normalizeForMatch(definition.label).includes(query),
    );
  });

  /** @protected Parameterized label for the filter-management action. */
  protected readonly _filtersLabel = computed(() =>
    this._resolveMessage('filters', { count: this.visibleFilterCount() }),
  );

  /** @protected Parameterized status for fields with applied values. */
  protected readonly _appliedFiltersLabel = computed(() =>
    this._resolveMessage('filters', { count: this.appliedFilterCount() }),
  );

  /** @protected Parameterized heading for the available-filter list. */
  protected readonly _availableFiltersLabel = computed(() =>
    this._resolveMessage('availableFilters', {
      count: this.definitions().length,
    }),
  );

  /** @protected Localized validation summary for all missing required fields. */
  protected readonly _requiredFiltersMessage = computed(() =>
    this._resolveMessage('requiredFilters', {
      count: this._missingRequiredDefinitions().length,
    }),
  );

  constructor() {
    effect(() => {
      const definitions = this.definitions();
      if (definitions.length === 0 && !this._definitionsInitialized) return;

      const definitionKeys = definitions.map((definition) => definition.key);
      const allowedKeys = new Set(definitionKeys);
      const currentFilters = this.filters();
      const queryAddedKeys = this._queryAddedKeys();
      const stateByKey = new Map(
        currentFilters
          .filter((state) => allowedKeys.has(state.key))
          .map((state) => [state.key, state]),
      );
      const normalizedFilters = definitions.flatMap((definition) => {
        const state = stateByKey.get(definition.key);
        return state ? [state] : [];
      });

      if (
        normalizedFilters.length !== currentFilters.length ||
        normalizedFilters.some(
          (state, index) => state !== currentFilters[index],
        )
      ) {
        this.filters.set(cloneFieldStates(normalizedFilters));
      }

      const activeKeys = new Set(
        normalizedFilters
          .filter((state) => state.conditions.some(isConditionMeaningful))
          .map((state) => state.key),
      );
      const currentVisible = this.visibleKeys();
      const requestedVisible = new Set(
        currentVisible.filter((key) => allowedKeys.has(key)),
      );
      const initializeDefaults =
        !this._definitionsInitialized && currentVisible.length === 0;

      for (const definition of definitions) {
        const newlyAdded = !this._knownDefinitionKeys.has(definition.key);
        if (
          definition.required ||
          activeKeys.has(definition.key) ||
          (definition.defaultVisible &&
            (initializeDefaults ||
              (this._definitionsInitialized && newlyAdded)))
        ) {
          requestedVisible.add(definition.key);
        }
      }

      const normalizedVisible = definitionKeys.filter((key) =>
        requestedVisible.has(key),
      );
      if (!stringArraysEqual(normalizedVisible, currentVisible)) {
        this.visibleKeys.set(normalizedVisible);
      }

      const normalizedQueryAddedKeys = queryAddedKeys.filter(
        (key) => allowedKeys.has(key) && requestedVisible.has(key),
      );
      if (!stringArraysEqual(normalizedQueryAddedKeys, queryAddedKeys)) {
        this._queryAddedKeys.set(normalizedQueryAddedKeys);
      }

      if (definitions.length > 0) this._definitionsInitialized = true;
      this._knownDefinitionKeys = allowedKeys;
    });
  }

  /** Executes the current search and structured-filter snapshot. */
  executeQuery(): void {
    if (this.disabled() || this.loading()) return;
    if (!this._validateRequiredFilters()) return;
    this.execute.emit(this._payload());
  }

  /** Requests fresh results using the current query snapshot. */
  refreshQuery(): void {
    if (this.disabled() || this.loading()) return;
    if (!this._validateRequiredFilters()) return;
    this.refresh.emit(this._payload());
  }

  /** Clears search and conditions while retaining the user's visible fields. */
  clear(): void {
    if (this.disabled() || this.loading()) return;
    this._validationAttempted.set(false);
    this.searchValue.set('');
    this.filters.set([]);
    if (this.autoExecute()) this.executeQuery();
  }

  /** Restores search, conditions, and visible fields to metadata defaults. */
  resetToDefaults(): void {
    if (this.disabled() || this.loading()) return;
    this._validationAttempted.set(false);
    this.searchValue.set('');
    this.filters.set([]);
    this.visibleKeys.set(this._defaultVisibleKeys());
    this._availableSearch.set('');
    this.resetCompleted.emit();
    if (this.autoExecute()) this.executeQuery();
  }

  /** @protected Updates search state and executes for submit or auto mode. */
  protected _onSearch(query: string): void {
    this.searchValue.set(query);
    if (this.searchTrigger() === 'submit' || this.autoExecute()) {
      this.executeQuery();
    }
  }

  /** @protected Executes a staged live-search value immediately from Enter. */
  protected _onSearchEnter(event: Event): void {
    if (
      !(event instanceof KeyboardEvent) ||
      event.isComposing ||
      this.searchTrigger() !== 'live' ||
      this.autoExecute()
    ) {
      return;
    }
    event.preventDefault();
    this.executeQuery();
  }

  /** @protected Updates the available-filter manager search. */
  protected _onAvailableSearch(query: string): void {
    this._availableSearch.set(query);
  }

  /** @protected Focuses the searchable Add filter menu after its popup attaches. */
  protected _onAddOpened(): void {
    this._availableSearch.set('');
    queueMicrotask(() => {
      this._addPanel()
        ?.nativeElement.querySelector<HTMLInputElement>('input')
        ?.focus();
    });
  }

  /** @protected Clears transient Add filter search after its popup closes. */
  protected _onAddClosed(): void {
    this._availableSearch.set('');
    if (!this._pendingAddedKey()) return;
    afterNextRender(
      () => {
        const pendingKey = this._pendingAddedKey();
        this._pendingAddedKey.set(undefined);
        const index = this._queryDefinitions().findIndex(
          (definition) => definition.key === pendingKey,
        );
        const host = this._filterHosts()[index]?.nativeElement as
          | HTMLElement
          | undefined;
        const trigger = host?.querySelector<HTMLButtonElement>(
          '.mlv-filter__trigger',
        );
        const focusTarget = trigger ?? this._addButton()?.nativeElement;
        focusTarget?.focus();
      },
      { injector: this._injector },
    );
  }

  /** @protected Adds visibility only, then sends focus to the newly rendered field trigger. */
  protected _addQueryFilter(
    definition: MlvFilterDefinition,
    trigger: MlvPopupTrigger,
  ): void {
    if (this.disabled() || this.loading() || definition.disabled) return;
    const requested = new Set(this.visibleKeys());
    requested.add(definition.key);
    this.visibleKeys.set(
      this.definitions()
        .map((candidate) => candidate.key)
        .filter((key) => requested.has(key)),
    );
    this._queryAddedKeys.update((keys) =>
      keys.includes(definition.key) ? keys : [...keys, definition.key],
    );
    this._pendingAddedKey.set(definition.key);
    trigger.close();
  }

  /** @protected Removes an optional query field's state and visibility. */
  protected _removeQueryFilter(definition: MlvFilterDefinition): void {
    if (this.disabled() || this.loading()) return;
    this._replaceFieldState({
      key: definition.key,
      conditions: [],
      strategy: this._strategyFor(definition.key),
    });
    this._queryAddedKeys.update((keys) =>
      keys.filter((key) => key !== definition.key),
    );
    if (!definition.required) {
      this.visibleKeys.set(
        this.visibleKeys().filter((key) => key !== definition.key),
      );
    }
  }

  /** @protected Clears search and all optional query fields while retaining required visibility. */
  protected _clearQuery(): void {
    if (this.disabled() || this.loading()) return;
    this._validationAttempted.set(false);
    this.searchValue.set('');
    this.filters.set([]);
    this._queryAddedKeys.set([]);
    this.visibleKeys.set(
      this.definitions()
        .filter((definition) => definition.required)
        .map((definition) => definition.key),
    );
    this._queueAutoExecute();
  }

  /** @protected Returns applied conditions for a definition key. */
  protected _conditionsFor(key: string): readonly MlvFilterCondition[] {
    return this.filters().find((state) => state.key === key)?.conditions ?? [];
  }

  /** @protected Resolves the value-editor template for one definition (exact key > key-less fallback > null). */
  protected _valueEditorFor(
    definition: MlvFilterDefinition,
  ): TemplateRef<MlvFilterValueEditorContext> | null {
    const editors = this._valueEditors();
    const exact = editors.find(
      (editor) => editor.mlvFilterValueEditor() === definition.key,
    );
    if (exact) return exact.templateRef;
    const fallback = editors.find(
      (editor) => editor.mlvFilterValueEditor() === '',
    );
    return fallback?.templateRef ?? null;
  }

  /** @protected Returns the applied strategy for a definition key. */
  protected _strategyFor(key: string): MlvFilterConditionStrategy {
    return (
      this.filters().find((state) => state.key === key)?.strategy ??
      this.definitions().find((definition) => definition.key === key)
        ?.conditionStrategy ??
      'or'
    );
  }

  /** @protected Whether a definition permits more than one free-form condition. */
  protected _allowsMultipleConditions(
    definition: MlvFilterDefinition,
  ): boolean {
    if (definition.allowMultipleConditions !== undefined) {
      return definition.allowMultipleConditions;
    }
    return !(
      definition.editor === 'options' ||
      (definition.editor === undefined && (definition.options?.length ?? 0) > 0)
    );
  }

  /** @protected Operators for a definition with the neutral default fallback. */
  protected _operatorsFor(
    definition: MlvFilterDefinition,
  ): readonly MlvFilterOperator[] {
    return (
      definition.operators ?? [
        'contains',
        'not-contains',
        'equals',
        'not-equals',
      ]
    );
  }

  /** @protected Updates one field's conditions without disturbing other fields. */
  protected _setConditions(
    definition: MlvFilterDefinition,
    conditions: readonly MlvFilterCondition[],
  ): void {
    const state = this.filters().find(
      (candidate) => candidate.key === definition.key,
    );
    this._replaceFieldState({
      key: definition.key,
      conditions,
      strategy: state?.strategy ?? definition.conditionStrategy ?? 'or',
    });
  }

  /** @protected Updates one field's condition-combination strategy. */
  protected _setStrategy(
    definition: MlvFilterDefinition,
    strategy: MlvFilterConditionStrategy,
  ): void {
    this._replaceFieldState({
      key: definition.key,
      conditions: this._conditionsFor(definition.key),
      strategy,
    });
  }

  /** @protected Whether a field key is currently visible. */
  protected _isVisible(key: string): boolean {
    return this._draftVisibleKeys().includes(key);
  }

  /** @protected Whether a field currently has an applied, meaningful condition. */
  protected _isActive(key: string): boolean {
    return (
      this.filters()
        .find((state) => state.key === key)
        ?.conditions.some(isConditionMeaningful) ?? false
    );
  }

  /** @protected Stages a field for addition or removal from the filter row. */
  protected _setVisible(
    definition: MlvFilterDefinition,
    visible: boolean,
  ): void {
    if (this.disabled() || this.loading()) return;
    if ((definition.required || this._isActive(definition.key)) && !visible) {
      return;
    }
    const keys = new Set(this._draftVisibleKeys());
    if (visible) keys.add(definition.key);
    else keys.delete(definition.key);
    const definitionOrder = this.definitions().map(
      (candidate) => candidate.key,
    );
    this._draftVisibleKeys.set(definitionOrder.filter((key) => keys.has(key)));
  }

  /** @protected Toggles the structured filter row. */
  protected _toggleFilters(): void {
    this.filtersVisible.update((visible) => !visible);
  }

  /** @protected Focuses the manager's search input after the popup attaches. */
  protected _onManagerOpened(): void {
    this._draftVisibleKeys.set([...this.visibleKeys()]);
    this._availableSearch.set('');
    queueMicrotask(() => {
      this._managerPanel()
        ?.nativeElement.querySelector<HTMLInputElement>('input')
        ?.focus();
    });
  }

  /** @protected Restores manager-trigger focus after an overlay action closes. */
  protected _onManagerClosed(): void {
    this._draftVisibleKeys.set([...this.visibleKeys()]);
    this._availableSearch.set('');
    queueMicrotask(() => this._managerButton()?.nativeElement.focus());
  }

  /** @protected Stages the metadata default field selection in the manager. */
  protected _resetManagerSelection(): void {
    if (this.disabled() || this.loading()) return;
    this._draftVisibleKeys.set(this._defaultVisibleKeys());
  }

  /** @protected Discards manager edits and closes its popup. */
  protected _cancelManager(trigger: MlvPopupTrigger): void {
    this._draftVisibleKeys.set([...this.visibleKeys()]);
    trigger.close();
  }

  /** @protected Commits staged manager edits and closes its popup. */
  protected _applyManager(trigger: MlvPopupTrigger): void {
    if (this.disabled() || this.loading()) return;
    const staged = new Set(this._draftVisibleKeys());
    this.definitions()
      .filter(
        (definition) => definition.required || this._isActive(definition.key),
      )
      .forEach((definition) => staged.add(definition.key));
    this.visibleKeys.set(
      this.definitions()
        .map((definition) => definition.key)
        .filter((key) => staged.has(key)),
    );
    trigger.close();
  }

  /** @private Replaces or removes one field state and optionally auto-executes. */
  private _replaceFieldState(state: MlvFilterFieldState): void {
    const remaining = this.filters().filter(
      (candidate) => candidate.key !== state.key,
    );
    const next =
      state.conditions.length > 0 ? [...remaining, state] : remaining;
    const order = this.definitions().map((definition) => definition.key);
    next.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    this.filters.set(cloneFieldStates(next));
    this._queueAutoExecute();
  }

  /** @private Schedules one auto execution for the current microtask. */
  private _queueAutoExecute(): void {
    if (
      this.appearance() === 'query' &&
      this.filterApplyMode() === 'explicit'
    ) {
      return;
    }
    if (!this.autoExecute() || this._autoExecuteQueued) return;
    this._autoExecuteQueued = true;
    queueMicrotask(() => {
      this._autoExecuteQueued = false;
      this.executeQuery();
    });
  }

  /** @private Default-visible keys, always including required definitions. */
  private _defaultVisibleKeys(): string[] {
    return this.definitions()
      .filter(
        (definition) =>
          definition.required ||
          definition.defaultVisible ||
          this._isActive(definition.key),
      )
      .map((definition) => definition.key);
  }

  /** @protected Whether a required field should currently expose an error. */
  protected _isRequiredMissing(definition: MlvFilterDefinition): boolean {
    return (
      this._showRequiredErrors() &&
      this._missingRequiredDefinitions().some(
        (candidate) => candidate.key === definition.key,
      )
    );
  }

  /** @protected Stable id for one field-level validation message. */
  protected _requiredErrorId(definition: MlvFilterDefinition): string {
    const index = this.definitions().findIndex(
      (candidate) => candidate.key === definition.key,
    );
    return `${this._validationSummaryId}-field-${Math.max(0, index)}`;
  }

  /** @protected Localized field-level validation message. */
  protected _requiredFilterMessage(definition: MlvFilterDefinition): string {
    return this._resolveMessage('requiredFilter', { label: definition.label });
  }

  /** @private Blocks execution and focuses the first incomplete required field. */
  private _validateRequiredFilters(): boolean {
    const missing = this._missingRequiredDefinitions();
    if (missing.length === 0) {
      this._validationAttempted.set(false);
      return true;
    }

    this._validationAttempted.set(true);
    this.filtersVisible.set(true);
    queueMicrotask(() => {
      const firstMissingKey = this._missingRequiredDefinitions()[0]?.key;
      const index = this.visibleDefinitions().findIndex(
        (definition) => definition.key === firstMissingKey,
      );
      const host = this._filterHosts()[index]?.nativeElement as
        | HTMLElement
        | undefined;
      host?.querySelector<HTMLButtonElement>('.mlv-filter__trigger')?.focus();
    });
    return false;
  }

  /** @private Builds a defensive execution snapshot. */
  private _payload(): MlvFilterExecutionPayload {
    return {
      search: this.searchValue(),
      filters: cloneFieldStates(this.filters()),
      visibleKeys: [...this.visibleKeys()],
      expression: mlvFilterFieldsToExpression(cloneFieldStates(this.filters())),
    };
  }

  /** @private Resolves one ICU message from the filter translation slice. */
  private _resolveMessage(
    key: 'availableFilters' | 'filters' | 'requiredFilter' | 'requiredFilters',
    params: Record<string, string | number>,
  ): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      key,
      params,
    );
  }
}
