import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideX } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvInput } from '@malva-ui/core/input';
import type { MlvSelectOptionTransform } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';
import {
  MLV_DATA_TABLE_I18N,
  MLV_FILTER_I18N,
  MlvI18nResolverService,
} from '@malva-ui/i18n';
import type {
  MlvDataSourceFilterOperator,
  MlvFilterState,
} from '@malva-ui/cdk/data-source';
import type { MlvDataTableFilterOption, MlvDataTableColumn } from '../types';

const DEFAULT_TEXT_OPERATORS: readonly MlvDataSourceFilterOperator[] = [
  'contains',
  'not-contains',
  'equals',
  'not-equals',
];

/** Operators whose operand is the checkbox editor's selected-value array. */
const DEFAULT_OPTION_OPERATORS: readonly MlvDataSourceFilterOperator[] = [
  'in',
  'not-in',
];

/** Returns whether an operator consumes an array of option values. */
function isOptionOperator(
  operator: MlvDataSourceFilterOperator,
): operator is 'in' | 'not-in' {
  return operator === 'in' || operator === 'not-in';
}

/** Copies a filter deeply enough that draft arrays never alias committed state. */
function cloneFilter(filter: MlvFilterState): MlvFilterState {
  return {
    ...filter,
    value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
  };
}

@Component({
  selector: 'mlv-dt-filter-dropdown',
  templateUrl: './filter-dropdown.html',
  styleUrl: './filter-dropdown.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MlvButton,
    MlvButtonIcon,
    MlvCheckbox,
    MlvInput,
    MlvSelect,
    LucideX,
  ],
  host: { class: 'mlv-dt-filter-dropdown' },
})
export class MlvFilterDropdown {
  readonly columns = input.required<readonly MlvDataTableColumn[]>();
  readonly activeFilters = model<MlvFilterState[]>([]);
  readonly closed = output<void>();

  /** @protected Injected i18n translations for the data table. */
  protected readonly _i18n = inject(MLV_DATA_TABLE_I18N);

  /** @protected Shared operator and filter-action translations. */
  protected readonly _filterI18n = inject(MLV_FILTER_I18N);

  /** @private Resolver for ICU parameterized i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @private Host used to place focus in the first editor after overlay creation. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @protected Transform mapping a `MlvDataSourceFilterOperator` to a `MlvSelectOption` for the operator dropdown. */
  protected readonly operatorTransform: MlvSelectOptionTransform<MlvDataSourceFilterOperator> =
    (op: MlvDataSourceFilterOperator) => ({
      label: this._operatorLabel(op),
      value: op,
    });

  /** @protected The subset of columns that are marked filterable. */
  protected readonly filterableColumns = computed(() =>
    this.columns().filter((c) => c.filterable),
  );

  /** @private Working copy of in-progress filter edits, keyed by column key. */
  private readonly _localFilters = signal<Map<string, MlvFilterState>>(
    new Map(),
  );

  constructor() {
    effect(() => {
      const allowedKeys = new Set(
        this.filterableColumns().map((column) => column.key),
      );
      const committed = this.activeFilters();
      const next = new Map<string, MlvFilterState>();

      for (const filter of committed) {
        if (allowedKeys.has(filter.key)) {
          next.set(filter.key, cloneFilter(filter));
        }
      }

      untracked(() => this._localFilters.set(next));
    });

    // The popup service stamps this component into a detached overlay portal.
    // Move focus directly into its first field so keyboard users do not have to
    // tab through the underlying page to reach the non-modal dialog.
    afterNextRender(() => {
      const editor = this._host.nativeElement.querySelector<HTMLElement>(
        '.mlv-dt-filter-dropdown__body [role="combobox"], .mlv-dt-filter-dropdown__body input:not([disabled])',
      );
      editor?.focus();
    });
  }

  /** @protected Returns the allowed operators for a column, falling back to the defaults. */
  protected operators(
    col: MlvDataTableColumn,
  ): readonly MlvDataSourceFilterOperator[] {
    const configured = col.filterConfig?.operators;
    if (this.options(col).length > 0) {
      const compatible = configured?.filter(isOptionOperator) ?? [];
      return compatible.length > 0 ? compatible : DEFAULT_OPTION_OPERATORS;
    }
    return configured?.length ? configured : DEFAULT_TEXT_OPERATORS;
  }

  /** @protected Returns the configured filter options for a column, or an empty list. */
  protected options(
    col: MlvDataTableColumn,
  ): readonly MlvDataTableFilterOption[] {
    return col.filterConfig?.options ?? [];
  }

  /** @protected Returns the working filter state for a column key, creating a default if absent. */
  protected getFilter(key: string): MlvFilterState {
    return (
      this._localFilters().get(key) ?? {
        key,
        operator: this._defaultOperator(key),
        value: '',
      }
    );
  }

  /** @protected Updates the operator of the working filter for a column key. */
  protected setOperator(
    key: string,
    operator: MlvDataSourceFilterOperator,
  ): void {
    const current = this.getFilter(key);
    let value = current.value;
    if (isOptionOperator(operator) && !Array.isArray(value)) {
      value =
        value === '' || value === null || value === undefined ? [] : [value];
    } else if (!isOptionOperator(operator) && Array.isArray(value)) {
      value = value[0] ?? '';
    }
    const updated = new Map(this._localFilters());
    updated.set(key, { ...current, operator, value });
    this._localFilters.set(updated);
  }

  /** @protected Updates the value of the working filter for a column key. */
  protected setValue(key: string, value: unknown): void {
    const current = this.getFilter(key);
    const updated = new Map(this._localFilters());
    updated.set(key, { ...current, value });
    this._localFilters.set(updated);
  }

  /** @protected Commits non-empty working filters to `activeFilters` and closes the dropdown. */
  protected apply(): void {
    const editedKeys = new Set(
      this.filterableColumns().map((column) => column.key),
    );
    const filters: MlvFilterState[] = this.activeFilters().filter(
      (filter) => !editedKeys.has(filter.key),
    );
    this._localFilters().forEach((f) => {
      if (
        f.value !== '' &&
        f.value !== null &&
        f.value !== undefined &&
        !(Array.isArray(f.value) && f.value.length === 0)
      ) {
        filters.push(cloneFilter(f));
      }
    });
    this.activeFilters.set(filters);
    this.closed.emit();
  }

  /** @protected Clears all working and active filters, then closes the dropdown. */
  protected clear(): void {
    this._localFilters.set(new Map());
    const editedKeys = new Set(
      this.filterableColumns().map((column) => column.key),
    );
    this.activeFilters.set(
      this.activeFilters().filter((filter) => !editedKeys.has(filter.key)),
    );
    this.closed.emit();
  }

  /** @protected Discards draft edits and asks the owning popup to close. */
  protected cancel(): void {
    const allowedKeys = new Set(
      this.filterableColumns().map((column) => column.key),
    );
    const restored = new Map<string, MlvFilterState>();
    for (const filter of this.activeFilters()) {
      if (allowedKeys.has(filter.key))
        restored.set(filter.key, cloneFilter(filter));
    }
    this._localFilters.set(restored);
    this.closed.emit();
  }

  /** @protected Toggles a value in a multi-select (array) filter for a column key. */
  protected toggleInArray(key: string, value: unknown): void {
    const current = this.getFilter(key);
    const arr = Array.isArray(current.value) ? [...current.value] : [];
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);
    const updated = new Map(this._localFilters());
    updated.set(key, {
      key,
      operator: isOptionOperator(current.operator)
        ? current.operator
        : this._defaultOperator(key),
      value: arr,
    });
    this._localFilters.set(updated);
  }

  /** @protected Returns whether a value is currently selected in a column's array filter. */
  protected isInArray(key: string, value: unknown): boolean {
    const current = this.getFilter(key);
    return Array.isArray(current.value) && current.value.includes(value);
  }

  /** @protected Resolves the filterByColumn ICU string for a given column name. */
  protected resolveFilterPlaceholder(columnName: string): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'filterByColumn',
      { column: columnName },
    );
  }

  /** @protected Localized accessible name for one column's operator selector. */
  protected resolveOperatorLabel(col: MlvDataTableColumn): string {
    return `${this._operatorLabel(this.getFilter(col.key).operator)}: ${
      col.title ?? col.key
    }`;
  }

  /** @private Operator used when a field has no committed or draft value. */
  private _defaultOperator(key: string): MlvDataSourceFilterOperator {
    const column = this.filterableColumns().find((item) => item.key === key);
    return column ? (this.operators(column)[0] ?? 'contains') : 'contains';
  }

  /** @private Resolves one operator key through the shared filter translations. */
  private _operatorLabel(operator: MlvDataSourceFilterOperator): string {
    const labels = this._filterI18n();
    switch (operator) {
      case 'contains':
        return labels.contains;
      case 'not-contains':
        return labels.notContains;
      case 'equals':
        return labels.equals;
      case 'not-equals':
        return labels.notEquals;
      case 'in':
        return labels.in;
      case 'not-in':
        return labels.notIn;
    }
  }
}
