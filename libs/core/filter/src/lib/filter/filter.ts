import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  contentChild,
  effect,
  inject,
  input,
  model,
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
  LucidePlus,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { deepEqual } from 'fast-equals';
import {
  MlvClick,
  MlvTabbableElementService,
} from '@malva-ui/cdk/accessibility';
import { mlvNextId, MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import {
  MlvDropdownPanel,
  filteredOutCommitted,
  isReconciliationEmit,
} from '@malva-ui/core/dropdown';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import type { MlvSelectOptionTransform } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';
import type { MlvFilterI18n } from '@malva-ui/i18n';
import { MLV_FILTER_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import type {
  MlvFilterApplyMode,
  MlvFilterCondition,
  MlvFilterConditionStrategy,
  MlvFilterEditor,
  MlvFilterOperator,
  MlvFilterOption,
} from '../filter.types';
import type { MlvFilterValueEditorContext } from './filter-value-editor';
import { MlvFilterValueEditorDef } from './filter-value-editor';
import { MlvToolbar } from '@malva-ui/core/toolbar';
import { MlvLink } from '@malva-ui/core/link';

/** Visual presentation of one field filter. */
type MlvFilterAppearance = 'field' | 'query';

/** Default operators for free-form filters. */
const DEFAULT_OPERATORS: readonly MlvFilterOperator[] = [
  'contains',
  'not-contains',
  'equals',
  'not-equals',
];

/**
 * Controls a custom value editor may expose as its first focus target. Used
 * only when the CDK interactivity checker finds nothing, which happens in
 * environments without layout geometry.
 */
const FOCUSABLE_EDITOR_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/**
 * Height budget (px) for the bounded options panel — the 20rem slab the
 * hand-rolled listbox used, kept instead of the dropdown panel's taller
 * viewport-derived default. `MlvDropdownPanel.maxHeight` is px-only.
 */
const OPTIONS_MAX_HEIGHT = 320;

/** `MlvFilterI18n` keys a hand-written or older language pack may omit. */
type MlvFilterOptionalMessageKey = {
  [K in keyof MlvFilterI18n]-?: undefined extends MlvFilterI18n[K] ? K : never;
}[keyof MlvFilterI18n];

/**
 * English fallbacks for the optional condition-control names, used when the
 * active pack omits a key. Keyed by every optional key of the interface, so a
 * new optional key does not compile without one. The strings are the English
 * pack's: the "hand-written pack" spec asserts the same names the English-pack
 * spec does, so the two cannot drift apart unnoticed.
 */
const OPTIONAL_MESSAGE_FALLBACKS: Readonly<
  Record<MlvFilterOptionalMessageKey, string>
> = {
  conditionStrategy: '{label}, combine conditions',
  conditionOperator: '{label}, condition {index} operator',
  conditionValue: '{label}, condition {index} value',
  rangeFrom: '{label}, condition {index} from',
  rangeTo: '{label}, condition {index} to',
};

/** Parameterized `MlvFilterI18n` keys resolved through `_resolveMessage`. */
type MlvFilterMessageKey =
  | 'clearFilter'
  | 'moreValues'
  | 'openFilter'
  | 'removeCondition'
  | 'removeFilter'
  | MlvFilterOptionalMessageKey;

/** Localized accessible names of the controls of one draft condition. */
interface MlvFilterConditionNames {
  /** Operator select. */
  readonly operator: string;
  /** Single value input, or a custom value editor. */
  readonly value: string;
  /** Lower-bound input of a `between` range. */
  readonly rangeFrom: string;
  /** Upper-bound input of a `between` range. */
  readonly rangeTo: string;
  /** Remove-condition button. */
  readonly remove: string;
}

/** Returns whether an operator requires no operand. */
function isValuelessOperator(operator: MlvFilterOperator): boolean {
  return operator === 'empty' || operator === 'not-empty';
}

/**
 * Whether two selections hold the same values, compared as **multisets**:
 * order-insensitive, because aria emits in option-registration order while a
 * draft carries pick order, but duplicate-sensitive, so `['a', 'a']` and
 * `['a', 'b']` are correctly different (a plain "same length + every value is a
 * member" test reads those two as equal). Elements compare with `fast-equals`'
 * `deepEqual`, so structured option values match by shape.
 */
function isSameSelection(
  values: readonly unknown[],
  other: readonly unknown[],
): boolean {
  if (values.length !== other.length) return false;
  const unmatched = [...other];
  return values.every((value) => {
    const index = unmatched.findIndex((candidate) =>
      deepEqual(candidate, value),
    );
    if (index < 0) return false;
    unmatched.splice(index, 1);
    return true;
  });
}

/** Returns a defensive shallow copy of filter conditions and array operands. */
function cloneConditions(
  conditions: readonly MlvFilterCondition[],
): MlvFilterCondition[] {
  return conditions.map((condition) => ({
    ...condition,
    value: Array.isArray(condition.value)
      ? [...condition.value]
      : condition.value,
  }));
}

/** Compact filter trigger and in-place condition editor. */
@Component({
  selector: 'mlv-filter',
  imports: [
    NgTemplateOutlet,
    MlvButton,
    MlvButtonIcon,
    MlvDropdownPanel,
    MlvInput,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvSelect,
    LucideChevronDown,
    LucidePlus,
    LucideTrash2,
    LucideX,
    MlvToolbar,
    MlvSpacer,
    MlvLink,
    MlvClick,
  ],
  // `mlv-dropdown-panel` injects `MlvSelectionService` non-optionally and expects
  // its owner to provide it, the same way `mlv-select` and `mlv-pagination` do.
  // The panel only uses it as a focus-first channel; the draft conditions stay
  // the single source of truth for what is selected.
  providers: [MlvSelectionService],
  templateUrl: './filter.html',
  styleUrl: './filter.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-filter',
    '[class.mlv-filter--applied]': 'hasValue()',
    '[class.mlv-filter--invalid]': 'invalid()',
    '[class.mlv-filter--open]': 'opened()',
    '[class.mlv-filter--disabled]': 'disabled()',
    '[class.mlv-filter--loading]': 'loading()',
    '[class.mlv-filter--query]': "appearance() === 'query'",
    '[attr.aria-busy]': 'loading() || null',
  },
})
export class MlvFilter {
  /** @private Document used for conservative focus restoration. */
  private readonly _document = inject(DOCUMENT);

  /** @protected Reactive translated strings for filters. */
  protected readonly _i18n = inject(MLV_FILTER_I18N);

  /** @private ICU resolver for parameterized translated strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /** @private Tabbable-element lookup for focusing custom editors. */
  private readonly _tabbable = inject(MlvTabbableElementService);

  /** Visible filter name. */
  readonly label = input.required<string>();

  /** Optional domain key for consumers coordinating multiple filter instances. */
  readonly key = input<string>('');

  /** Whether this field renders as a classic control or a natural-language chip. */
  readonly appearance = input<MlvFilterAppearance>('field');

  /** Whether an empty query field exposes removal instead of becoming sticky. */
  readonly queryRemovable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Bounded values shown as a listbox. */
  readonly options = input<readonly MlvFilterOption[]>([]);

  /** Explicit editor override. Options are inferred when choices are provided. */
  readonly editor = input<MlvFilterEditor | undefined>(undefined);

  /** Whether a bounded editor accepts multiple values. */
  readonly multiple = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether a free-form editor may add multiple conditions. */
  readonly allowMultipleConditions = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Operators available to a free-form editor. */
  readonly operators = input<readonly MlvFilterOperator[]>(DEFAULT_OPERATORS);

  /** Optional user-facing labels for domain-specific operator vocabulary. */
  readonly operatorLabels = input<
    Readonly<Partial<Record<MlvFilterOperator, string>>>
  >({});

  /** Operator assigned to a newly-created free-form condition. */
  readonly defaultOperator = input<MlvFilterOperator>('contains');

  /** Optional placeholder for free-form values. */
  readonly placeholder = input<string | undefined>(undefined);

  /** Whether edits publish immediately or wait for the Apply action. */
  readonly applyMode = input<MlvFilterApplyMode>('live');

  /** Prevents opening and editing the filter. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Shows progress and prevents editing while filter metadata is loading. */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether the filter trigger represents an invalid field value. */
  readonly invalid = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Id reference describing the filter trigger's validation state. */
  readonly ariaDescribedBy = input<string | undefined>(undefined);

  /**
   * Custom value-editor template forwarded by a smart filter bar. Wins over a
   * projected `[mlvFilterValueEditor]` content child.
   */
  readonly valueEditor = input<TemplateRef<MlvFilterValueEditorContext> | null>(
    null,
  );

  /** Applied conditions. */
  readonly conditions = model<readonly MlvFilterCondition[]>([]);

  /** Combination rule used when more than one condition is present. */
  readonly conditionStrategy = model<MlvFilterConditionStrategy>('or');

  /** Whether the condition editor is open. */
  readonly opened = model(false);

  /** Emitted whenever live editing or Apply commits conditions. */
  readonly applied = output<readonly MlvFilterCondition[]>();

  /** Emitted when the clear action removes every condition. */
  readonly cleared = output<void>();

  /** @protected Unique id linking the trigger to its popup content. */
  protected readonly _panelId = mlvNextId('mlv-filter-panel');

  /** @protected Height budget handed to the bounded options panel. */
  protected readonly _optionsMaxHeight = OPTIONS_MAX_HEIGHT;

  /** @private Working conditions kept separate for explicit-apply mode. */
  private readonly _draftConditions = signal<MlvFilterCondition[]>([]);

  /** @private Working condition strategy kept separate until Apply. */
  private readonly _draftStrategy = signal<MlvFilterConditionStrategy>('or');

  /** @private Trigger element used for focus restoration. */
  private readonly _trigger = viewChild('trigger', {
    read: ElementRef<HTMLButtonElement>,
  });

  /** @private Rendered value fields used to focus the free-form editor. */
  private readonly _conditionInputs = viewChildren(MlvInput);

  /** @private Rendered value cells used to focus custom editors. */
  private readonly _valueCells = viewChildren('valueCell', {
    read: ElementRef<HTMLElement>,
  });

  /** @private Projected value-editor template for standalone usage. */
  private readonly _contentValueEditor = contentChild(MlvFilterValueEditorDef);

  /**
   * @protected Resolved custom value-editor template; `null` renders the
   * built-in input.
   */
  protected readonly _valueEditorTemplate = computed(
    () => this.valueEditor() ?? this._contentValueEditor()?.templateRef ?? null,
  );

  /** @protected Resolved editor based on the explicit input and available options. */
  protected readonly _resolvedEditor = computed<MlvFilterEditor>(
    () => this.editor() ?? (this.options().length > 0 ? 'options' : 'text'),
  );

  /** @protected Whether the current editor is a bounded options list. */
  protected readonly _usesOptions = computed(
    () => this._resolvedEditor() === 'options',
  );

  /** @protected Whether an open editor must reject every state-changing action. */
  protected readonly _editorDisabled = computed(
    () => this.disabled() || this.loading(),
  );

  /**
   * @protected Bounded options mapped to the dropdown panel's option shape. A
   * locked editor (disabled or loading) marks every row disabled, so a panel
   * that is already open when loading starts stops offering picks it would
   * silently reject.
   */
  protected readonly _panelOptions = computed<MlvSelectOption<unknown>[]>(
    () => {
      const locked = this._editorDisabled();
      return this.options().map((option) => ({
        label: option.label,
        value: option.value,
        disabled: locked || (option.disabled ?? false),
      }));
    },
  );

  /** @protected Values currently selected in the draft, for the dropdown panel. */
  protected readonly _selectedValues = computed<unknown[]>(() =>
    this._draftConditions().flatMap((condition) =>
      Array.isArray(condition.value) ? condition.value : [condition.value],
    ),
  );

  /** @protected Valid new-condition operator, constrained to the allowed list. */
  protected readonly _resolvedDefaultOperator = computed(() => {
    const operators = this.operators();
    const requested = this.defaultOperator();
    return operators.includes(requested)
      ? requested
      : (operators[0] ?? 'contains');
  });

  /** @protected Snapshot used by the editor template. */
  protected readonly _draft = this._draftConditions.asReadonly();

  /** @protected Draft strategy used by the editor template. */
  protected readonly _strategy = this._draftStrategy.asReadonly();

  /** @protected Resolved value placeholder with an i18n fallback. */
  protected readonly _resolvedPlaceholder = computed(
    () => this.placeholder() ?? this._i18n().valuePlaceholder,
  );

  /**
   * @private Number of draft conditions. The per-row names depend on the count
   * alone, so they are not rebuilt on every keystroke into a value.
   */
  private readonly _draftCount = computed(() => this._draftConditions().length);

  /**
   * @protected Localized accessible names of each draft condition's controls,
   * indexed like the draft. Every name carries the filter label, the 1-based
   * condition number and the control's role, so the operator, value, range
   * bounds and remove button of one condition are told apart, and from those
   * of another condition.
   */
  protected readonly _conditionNames = computed<MlvFilterConditionNames[]>(
    () => {
      const label = this.label();
      return Array.from({ length: this._draftCount() }, (_, index) => {
        const params = { label, index: index + 1 };
        return {
          operator: this._resolveMessage('conditionOperator', params),
          value: this._resolveMessage('conditionValue', params),
          rangeFrom: this._resolveMessage('rangeFrom', params),
          rangeTo: this._resolveMessage('rangeTo', params),
          remove: this._resolveMessage('removeCondition', params),
        };
      });
    },
  );

  /** @protected Localized accessible name of the AND / OR strategy select. */
  protected readonly _strategyName = computed(() =>
    this._resolveMessage('conditionStrategy', { label: this.label() }),
  );

  /** @protected Operator-to-select-option adapter. */
  protected readonly _operatorTransform: MlvSelectOptionTransform<MlvFilterOperator> =
    (operator) => ({ value: operator, label: this._operatorLabel(operator) });

  /** @protected Strategy-to-select-option adapter. */
  protected readonly _strategyTransform: MlvSelectOptionTransform<MlvFilterConditionStrategy> =
    (strategy) => ({ value: strategy, label: this._i18n()[strategy] });

  /** @protected Strategies available when multiple conditions exist. */
  protected readonly _strategies: readonly MlvFilterConditionStrategy[] = [
    'and',
    'or',
  ];

  /** @protected Number of selected scalar values represented by the conditions. */
  protected readonly valueCount = computed(
    () => this._displayValues(this.conditions()).length,
  );

  /** @protected Whether at least one meaningful condition is applied. */
  protected readonly hasValue = computed(() =>
    this.conditions().some((condition) =>
      this._isConditionMeaningful(condition),
    ),
  );

  /** @protected First applied value rendered in the compact trigger. */
  protected readonly primaryValue = computed(
    () => this._displayValues(this.conditions())[0] ?? '',
  );

  /** @protected Number of values hidden behind the `+ n more` summary. */
  protected readonly additionalValueCount = computed(() =>
    Math.max(0, this.valueCount() - 1),
  );

  /** @protected Accessible description of the current applied state. */
  protected readonly _triggerAriaLabel = computed(() => {
    if (this.appearance() === 'query' && this.hasValue()) {
      return this._querySentence();
    }
    if (!this.hasValue()) {
      return this._resolveMessage('openFilter', { label: this.label() });
    }
    return `${this.label()}: ${this.primaryValue()}${
      this.additionalValueCount() > 0 ? ` ${this._moreValuesLabel()}` : ''
    }`;
  });

  /** @protected Translated accessible label for the clear action. */
  protected readonly _clearAriaLabel = computed(() =>
    this.appearance() === 'query' && this.queryRemovable()
      ? this._resolveMessage('removeFilter', { label: this.label() })
      : this._resolveMessage('clearFilter', { label: this.label() }),
  );

  /** @protected Whether the compact clear/remove action should be shown. */
  protected readonly _showsClearAction = computed(
    () =>
      this.hasValue() ||
      (this.appearance() === 'query' && this.queryRemovable()),
  );

  /** @protected Full natural-language summary used by a query chip. */
  protected readonly _querySentence = computed(() => {
    const conditions = this.conditions().filter((condition) =>
      this._isConditionMeaningful(condition),
    );
    if (conditions.length === 0) return this.label();
    return conditions
      .map((condition) => {
        const operator = this._operatorLabel(condition.operator);
        if (isValuelessOperator(condition.operator)) {
          return `${this.label()} ${operator}`;
        }
        const operand = this._displayValues([condition]).join(', ');
        return `${this.label()} ${operator}${operand ? ` ${operand}` : ''}`;
      })
      .join(` ${this._i18n()[this.conditionStrategy()]} `);
  });

  /** @protected Translated compact summary for values beyond the first. */
  protected readonly _moreValuesLabel = computed(() =>
    this._resolveMessage('moreValues', {
      count: this.additionalValueCount(),
    }),
  );

  constructor() {
    effect(() => {
      const conditions = this.conditions();
      const strategy = this.conditionStrategy();
      if (!this.opened()) {
        this._draftConditions.set(cloneConditions(conditions));
        this._draftStrategy.set(strategy);
      }
    });
  }

  /** @protected Prepares and focuses the editor after the overlay attaches. */
  protected _onOpened(): void {
    if (!this._usesOptions() && this._draftConditions().length === 0) {
      this._draftConditions.set([this._newCondition()]);
    }
    queueMicrotask(() => {
      if (this._usesOptions()) {
        // The panel's aria listbox already parks its roving tab stop on the
        // selected option (falling back to the first focusable one), so the
        // `tabindex="0"` row is the correct entry point.
        const panel = this._document.getElementById(this._panelId);
        const target =
          panel?.querySelector<HTMLElement>('[role="option"][tabindex="0"]') ??
          panel?.querySelector<HTMLElement>('[role="option"]');
        target?.focus();
      } else {
        // A custom editor owns its own controls, so the first focusable element
        // inside the value cell is the only reliable entry point.
        const cell = this._valueCells()[0]?.nativeElement;
        const target = cell ? this._firstFocusableIn(cell) : null;
        if (target) target.focus();
        else this._conditionInputs()[0]?.focus();
      }
    });
  }

  /** @protected Resynchronises drafts and restores focus after a keyboard/action close. */
  protected _onClosed(): void {
    this._draftConditions.set(cloneConditions(this.conditions()));
    this._draftStrategy.set(this.conditionStrategy());
    if (this._document.activeElement === this._document.body) {
      this._trigger()?.nativeElement.focus();
    }
  }

  /** @protected Removes all applied and in-progress values. */
  protected _clear(event?: Event): void {
    event?.stopPropagation();
    if (this._editorDisabled()) return;
    this._draftConditions.set([]);
    this.conditions.set([]);
    this.applied.emit([]);
    this.cleared.emit();
    this.opened.set(false);
    if (event) {
      queueMicrotask(() => this._trigger()?.nativeElement.focus());
    }
  }

  /** @protected Clears the editor draft while preserving explicit-mode rollback. */
  protected _clearDraft(): void {
    if (this._editorDisabled()) return;
    this._draftConditions.set(
      this._usesOptions() ? [] : [this._newCondition()],
    );
    if (this.applyMode() === 'explicit') return;

    this.conditions.set([]);
    this.applied.emit([]);
    this.cleared.emit();
    this.opened.set(false);
  }

  /** @protected Discards uncommitted edits and closes the editor. */
  protected _cancel(): void {
    this._draftConditions.set(cloneConditions(this.conditions()));
    this._draftStrategy.set(this.conditionStrategy());
    this.opened.set(false);
  }

  /** @protected Commits meaningful draft conditions and closes the editor. */
  protected _apply(): void {
    if (this._editorDisabled()) return;
    const hadAppliedConditions = this.conditions().some((condition) =>
      this._isConditionMeaningful(condition),
    );
    const conditions = this._draftConditions().filter((condition) =>
      this._isConditionMeaningful(condition),
    );
    this.conditions.set(cloneConditions(conditions));
    this.conditionStrategy.set(this._draftStrategy());
    this.applied.emit(cloneConditions(conditions));
    if (hadAppliedConditions && conditions.length === 0) this.cleared.emit();
    this.opened.set(false);
  }

  /**
   * @protected Applies a dropdown-panel selection to the draft.
   *
   * `@angular/aria`'s listbox owns a `value` model that it reconciles against
   * the options actually *registered* in the DOM, and it re-emits `valueChange`
   * from that reconciliation — not only when a user picks. Two kinds of noise
   * therefore have to be filtered out before anything may rewrite the draft:
   *
   * 1. An emit that restates the selection unchanged.
   * 2. An emit that drops committed values whose option is not rendered — async
   *    options that have not arrived, a saved view restored ahead of its
   *    choices, a value whose option was removed. Left unguarded this silently
   *    wipes committed conditions the moment the popover opens.
   */
  protected _onOptionValuesChange(values: readonly unknown[]): void {
    if (this._editorDisabled()) return;
    const current = this._selectedValues();

    if (isSameSelection(values, current)) {
      // Defensive, not a real DOM gesture path: in explicit aria mode a
      // single-select re-click toggles to *deselect* (an empty emit), so no
      // interaction actually restates the committed selection unchanged.
      // This guards against a hypothetical aria restate emit after an option
      // re-registers (e.g. options reloading/reordering while a value stays
      // selected) — closing stays `_commitLive`'s privilege, so an
      // explicit-mode draft is resolved by Apply/Cancel alone.
      if (
        values.length > 0 &&
        !this.multiple() &&
        this.applyMode() === 'live'
      ) {
        this.opened.set(false);
      }
      return;
    }

    // `Object.is` (not deep equality) is deliberate here: this predicate has to
    // mirror aria's own `===` matching of a value against its rendered option,
    // otherwise a structurally-equal-but-distinct value would read as "still
    // rendered" and the drop would be treated as a real deselection.
    const visible = this._panelOptions().map((option) => option.value);
    if (isReconciliationEmit(values, current, visible, Object.is)) return;

    if (this.multiple()) {
      // aria has already dropped every committed value with no rendered option,
      // so a genuine pick arrives without them. Re-add them, or picking one
      // more value would quietly discard the rest of the selection.
      const next = [
        ...values,
        ...filteredOutCommitted(values, current, visible, Object.is),
      ];
      this._draftConditions.set(
        next.length > 0 ? [{ operator: 'in', value: next }] : [],
      );
      this._commitLive(false);
      return;
    }
    const value = values[0];
    this._draftConditions.set(
      value === undefined ? [] : [{ operator: 'equals', value }],
    );
    this._commitLive(true);
  }

  /** @protected Updates one condition's operator. */
  protected _setOperator(index: number, operator: MlvFilterOperator): void {
    if (this._editorDisabled()) return;
    const next = cloneConditions(this._draftConditions());
    const current = next[index] ?? this._newCondition();
    let value = current.value;
    if (isValuelessOperator(operator)) value = null;
    else if (operator === 'between' && current.operator !== 'between') {
      value = ['', ''];
    } else if (
      current.operator === 'between' ||
      isValuelessOperator(current.operator)
    ) {
      value = '';
    }
    next[index] = {
      ...current,
      operator,
      value,
    };
    this._draftConditions.set(next);
    this._commitLive(false);
  }

  /** @protected Updates one condition's operand. */
  protected _setConditionValue(index: number, value: unknown): void {
    if (this._editorDisabled()) return;
    const next = cloneConditions(this._draftConditions());
    const current = next[index] ?? this._newCondition();
    next[index] = { ...current, value: this._normalizeValue(value) };
    this._draftConditions.set(next);
    this._commitLive(false);
  }

  /** @protected Builds the template context for one condition's custom editor. */
  protected _valueEditorContext(
    condition: MlvFilterCondition,
    index: number,
  ): MlvFilterValueEditorContext {
    const names = this._conditionNames()[index];
    return {
      $implicit: condition.value,
      condition,
      index,
      operator: condition.operator,
      disabled: this._editorDisabled(),
      placeholder: this._resolvedPlaceholder(),
      ariaLabel: names.value,
      rangeAriaLabels: [names.rangeFrom, names.rangeTo],
      setValue: (value) => this._setConditionValue(index, value),
      commit: () => {
        if (this.applyMode() === 'explicit') this._apply();
      },
    };
  }

  /** @protected Returns one side of a between-condition range. */
  protected _conditionRangeValue(
    condition: MlvFilterCondition,
    rangeIndex: number,
  ): unknown {
    return Array.isArray(condition.value)
      ? (condition.value[rangeIndex] ?? '')
      : '';
  }

  /** @protected Updates one side of a between-condition range. */
  protected _setConditionRangeValue(
    conditionIndex: number,
    rangeIndex: number,
    value: unknown,
  ): void {
    if (this._editorDisabled()) return;
    const next = cloneConditions(this._draftConditions());
    const current = next[conditionIndex] ?? this._newCondition();
    const range = Array.isArray(current.value) ? [...current.value] : ['', ''];
    range[rangeIndex] = this._normalizeValue(value);
    next[conditionIndex] = { ...current, value: range };
    this._draftConditions.set(next);
    this._commitLive(false);
  }

  /** @protected Updates the combination rule for working conditions. */
  protected _setStrategy(strategy: MlvFilterConditionStrategy): void {
    if (this._editorDisabled()) return;
    this._draftStrategy.set(strategy);
    if (this.applyMode() === 'live') {
      this.conditionStrategy.set(strategy);
    }
  }

  /** @protected Adds another free-form condition and focuses it. */
  protected _addCondition(): void {
    if (this._editorDisabled()) return;
    // A custom editor renders no `mlv-input`, so the new row is located by its
    // value cell first and only then by the built-in input list.
    const previousCellCount = this._valueCells().length;
    const previousInputCount = this._conditionInputs().length;
    this._draftConditions.update((conditions) => [
      ...conditions,
      this._newCondition(),
    ]);
    queueMicrotask(() => {
      const cell = this._valueCells()[previousCellCount]?.nativeElement;
      const target = cell ? this._firstFocusableIn(cell) : null;
      if (target) target.focus();
      else this._conditionInputs()[previousInputCount]?.focus();
    });
  }

  /** @protected Removes one working condition. */
  protected _removeCondition(index: number): void {
    if (this._editorDisabled()) return;
    this._draftConditions.update((conditions) =>
      conditions.filter((_, conditionIndex) => conditionIndex !== index),
    );
    if (this._draftConditions().length === 0) {
      this._draftConditions.set([this._newCondition()]);
    }
    this._commitLive(false);
  }

  /**
   * @private First focusable control rendered inside a value cell. The CDK
   * interactivity checker requires layout geometry, so a plain selector query
   * takes over whenever it reports nothing focusable.
   */
  private _firstFocusableIn(cell: HTMLElement): HTMLElement | null {
    return (
      this._tabbable.getTabbableElement(cell, false, true) ??
      cell.querySelector<HTMLElement>(FOCUSABLE_EDITOR_SELECTOR)
    );
  }

  /** @private Creates an empty free-form condition. */
  private _newCondition(): MlvFilterCondition {
    const operator = this._resolvedDefaultOperator();
    return {
      id: mlvNextId('mlv-filter-condition'),
      operator,
      value: isValuelessOperator(operator)
        ? null
        : operator === 'between'
          ? ['', '']
          : '',
    };
  }

  /** @private Publishes draft state immediately when live mode is active. */
  private _commitLive(close: boolean): void {
    if (this.applyMode() !== 'live' || this._editorDisabled()) return;
    const meaningful = this._draftConditions().filter((condition) =>
      this._isConditionMeaningful(condition),
    );
    this.conditions.set(cloneConditions(meaningful));
    this.applied.emit(cloneConditions(meaningful));
    if (close) this.opened.set(false);
  }

  /** @private Normalizes number-editor input while preserving empty/invalid drafts. */
  private _normalizeValue(value: unknown): unknown {
    const parsedNumber = typeof value === 'string' ? Number(value) : NaN;
    return this._resolvedEditor() === 'number' &&
      typeof value === 'string' &&
      value !== '' &&
      Number.isFinite(parsedNumber)
      ? parsedNumber
      : value;
  }

  /** @private Converts applied operands into compact, human-readable labels. */
  private _displayValues(conditions: readonly MlvFilterCondition[]): string[] {
    return conditions.flatMap((condition) => {
      if (isValuelessOperator(condition.operator)) {
        return [this._operatorLabel(condition.operator)];
      }
      if (
        condition.operator === 'between' &&
        Array.isArray(condition.value) &&
        condition.value.length === 2
      ) {
        return [
          `${String(condition.value[0])} – ${String(condition.value[1])}`,
        ];
      }
      const values = Array.isArray(condition.value)
        ? condition.value
        : [condition.value];
      return values
        .filter(
          (value) => value !== null && value !== undefined && value !== '',
        )
        .map((value) => {
          const option = this.options().find((candidate) =>
            Object.is(candidate.value, value),
          );
          return option?.label ?? String(value);
        });
    });
  }

  /** @private Whether a condition has an operator-complete operand. */
  private _isConditionMeaningful(condition: MlvFilterCondition): boolean {
    if (isValuelessOperator(condition.operator)) return true;
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

  /** @private Resolves translated labels for built-in operators. */
  private _operatorLabel(operator: MlvFilterOperator): string {
    const override = this.operatorLabels()[operator];
    if (override) return override;
    const i18n = this._i18n();
    switch (operator) {
      case 'contains':
        return i18n.contains;
      case 'not-contains':
        return i18n.notContains;
      case 'starts-with':
        return i18n.startsWith;
      case 'ends-with':
        return i18n.endsWith;
      case 'equals':
        return i18n.equals;
      case 'not-equals':
        return i18n.notEquals;
      case 'greater-than':
        return i18n.greaterThan;
      case 'greater-than-or-equal':
        return i18n.greaterThanOrEqual;
      case 'less-than':
        return i18n.lessThan;
      case 'less-than-or-equal':
        return i18n.lessThanOrEqual;
      case 'between':
        return i18n.between;
      case 'in':
        return i18n.in;
      case 'not-in':
        return i18n.notIn;
      case 'empty':
        return i18n.empty;
      case 'not-empty':
        return i18n.notEmpty;
    }
  }

  /**
   * @private Resolves one ICU message from the filter translation slice. An
   * optional key the active pack omits resolves its English fallback instead.
   */
  private _resolveMessage(
    key: MlvFilterMessageKey,
    params: Record<string, string | number>,
  ): string {
    const template =
      this._i18n()[key] ??
      OPTIONAL_MESSAGE_FALLBACKS[key as MlvFilterOptionalMessageKey];
    return this._resolver.resolve({ [key]: template }, key, params);
  }
}
