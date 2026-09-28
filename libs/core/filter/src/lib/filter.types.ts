/** Operators supported by Malva's neutral filter condition model. */
export type MlvFilterOperator =
  | 'contains'
  | 'not-contains'
  | 'starts-with'
  | 'ends-with'
  | 'equals'
  | 'not-equals'
  | 'greater-than'
  | 'greater-than-or-equal'
  | 'less-than'
  | 'less-than-or-equal'
  | 'between'
  | 'in'
  | 'not-in'
  | 'empty'
  | 'not-empty';

/** Determines how two or more conditions for the same field are combined. */
export type MlvFilterConditionStrategy = 'and' | 'or';

/** Controls when edits made inside a filter popover become public state. */
export type MlvFilterApplyMode = 'live' | 'explicit';

/** Visual presentation used by the smart filter bar. */
export type MlvSmartFilterBarAppearance = 'classic' | 'query';

/** Selectable value presented by a bounded filter. */
export interface MlvFilterOption<T = unknown> {
  /** Visible option label. */
  readonly label: string;
  /** Domain value represented by the option. */
  readonly value: T;
  /** Whether the option is unavailable for selection. */
  readonly disabled?: boolean;
}

/** One comparison applied to a field. */
export interface MlvFilterCondition<T = unknown> {
  /** Optional stable identifier used when editing multiple conditions. */
  readonly id?: string;
  /** Comparison performed by this condition. */
  readonly operator: MlvFilterOperator;
  /** Scalar, range, or multi-value operand. */
  readonly value: T | readonly T[] | null;
}

/**
 * A recursive, backend-neutral filter tree. Groups use the same conjunction
 * vocabulary as multi-condition field state; conditions remain keyed so a
 * consumer can read values from any domain model.
 */
export type MlvFilterExpression =
  | {
      /** Leaf comparison applied to one field. */
      readonly kind: 'condition';
      /** Domain key supplied to an expression value reader. */
      readonly key: string;
      /** Comparison performed against the value read for {@link key}. */
      readonly condition: MlvFilterCondition;
    }
  | {
      /** Recursive boolean group. */
      readonly kind: 'group';
      /** Combination rule applied to this group's children. */
      readonly combinator: MlvFilterConditionStrategy;
      /** Ordered expression children. Empty AND is true; empty OR is false. */
      readonly children: readonly MlvFilterExpression[];
    };

/** Editor rendered for a filter definition. */
export type MlvFilterEditor = 'options' | 'text' | 'number';

/** Metadata describing one field in a smart filter bar. */
export interface MlvFilterDefinition<T = unknown> {
  /** Stable field key included in execution payloads. */
  readonly key: string;
  /** Human-readable field label. */
  readonly label: string;
  /** Editor type. Defaults to `options` when options exist, otherwise `text`. */
  readonly editor?: MlvFilterEditor;
  /** Bounded choices for an options editor. */
  readonly options?: readonly MlvFilterOption<T>[];
  /** Operators available to free-text and number conditions. */
  readonly operators?: readonly MlvFilterOperator[];
  /** Optional user-facing labels for domain-specific operators. */
  readonly operatorLabels?: Readonly<
    Partial<Record<MlvFilterOperator, string>>
  >;
  /** Initial operator for a new condition. */
  readonly defaultOperator?: MlvFilterOperator;
  /** Whether an options editor accepts more than one value. */
  readonly multiple?: boolean;
  /** Whether a free-form editor can add multiple conditions. */
  readonly allowMultipleConditions?: boolean;
  /** Initial condition-combination strategy. Defaults to `or`. */
  readonly conditionStrategy?: MlvFilterConditionStrategy;
  /** Whether the field appears before users adapt the filter set. */
  readonly defaultVisible?: boolean;
  /** Required fields stay visible and block query execution while empty. */
  readonly required?: boolean;
  /** Prevents users from editing this field. */
  readonly disabled?: boolean;
  /** Optional editor placeholder. */
  readonly placeholder?: string;
}

/** Applied conditions for one field in a smart filter bar. */
export interface MlvFilterFieldState {
  /** Filter definition key. */
  readonly key: string;
  /** Conditions applied to the field. */
  readonly conditions: readonly MlvFilterCondition[];
  /** How multiple conditions are combined. */
  readonly strategy: MlvFilterConditionStrategy;
}

/**
 * Snapshot emitted when a smart filter bar executes or refreshes. Its field
 * states and the plain-data part of every operand are deep copies — arrays,
 * objects whose prototype is `Object.prototype` or `null`, and exact `Date` /
 * `Map` / `Set` instances — so editing the bar afterwards never reaches it.
 * Any other operand object is shared **by reference** with the bar's state and
 * with later payloads: a class instance (Dayjs, Luxon, a domain type), a
 * built-in subclass, `RegExp`, `URL`, typed arrays, `Blob` / `File`, and plain
 * data from another realm. Treat shared values as immutable — mutating one in
 * place (a Moment is mutable) changes the bar's state and every later payload.
 */
export interface MlvFilterExecutionPayload {
  /** Search term submitted alongside structured filters. */
  readonly search: string;
  /** Applied structured filters. */
  readonly filters: readonly MlvFilterFieldState[];
  /** Definition keys currently exposed in the bar. */
  readonly visibleKeys: readonly string[];
  /** Grouped expression equivalent to the flat structured filter snapshot. */
  readonly expression: MlvFilterExpression;
}
