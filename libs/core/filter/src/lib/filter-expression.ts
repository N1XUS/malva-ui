import { normalizeForMatch } from '@malva-ui/cdk/utils';
import type {
  MlvFilterCondition,
  MlvFilterConditionStrategy,
  MlvFilterExpression,
  MlvFilterFieldState,
} from './filter.types';

interface MlvFieldTerms {
  readonly key: string;
  readonly strategy: MlvFilterConditionStrategy;
  readonly conditions: readonly MlvFilterCondition[];
}

/** @private Result of normalizing an expression for lossless flat conversion. */
type MlvFlatCollection =
  | { readonly kind: 'true' }
  | { readonly kind: 'false' }
  | { readonly kind: 'unrepresentable' }
  | { readonly kind: 'terms'; readonly terms: readonly MlvFieldTerms[] };

/**
 * Converts the flat Smart Filter Bar model to its equivalent expression tree.
 * Empty field states are omitted because they do not constrain a flat query.
 */
export function mlvFilterFieldsToExpression(
  fields: readonly MlvFilterFieldState[],
): MlvFilterExpression {
  return {
    kind: 'group',
    combinator: 'and',
    children: fields.flatMap<MlvFilterExpression>((field) => {
      const children = field.conditions.map((condition) => ({
        kind: 'condition' as const,
        key: field.key,
        condition,
      }));
      if (children.length === 0) return [];
      if (children.length === 1) return children;
      return [
        {
          kind: 'group' as const,
          combinator: field.strategy,
          children,
        },
      ];
    }),
  };
}

/**
 * Converts an expression to flat field state only when no grouping information
 * would be lost. Direct leaves and singleton groups are canonicalized to the
 * semantically-neutral `and` strategy. Returns `null` for cross-field ORs,
 * contradictory field compositions, and false (empty OR) groups.
 */
export function mlvFilterExpressionToFields(
  expression: MlvFilterExpression,
): MlvFilterFieldState[] | null {
  const collection = _collectFlatExpression(expression);
  if (collection.kind === 'true') return [];
  if (collection.kind !== 'terms') return null;

  const fields: MlvFilterFieldState[] = [];
  const fieldIndexes = new Map<string, number>();
  for (const term of collection.terms) {
    const index = fieldIndexes.get(term.key);
    if (index === undefined) {
      fieldIndexes.set(term.key, fields.length);
      fields.push({
        key: term.key,
        strategy: term.strategy,
        conditions: [...term.conditions],
      });
      continue;
    }

    const existing = fields[index];
    if (
      existing === undefined ||
      existing.strategy !== 'and' ||
      term.strategy !== 'and'
    ) {
      return null;
    }
    fields[index] = {
      ...existing,
      conditions: [...existing.conditions, ...term.conditions],
    };
  }
  return fields;
}

/**
 * Evaluates an expression using a domain-owned value reader. String predicates
 * are case- and diacritic-insensitive; equality and membership remain strict.
 */
export function mlvMatchesFilterExpression<T>(
  value: T,
  expression: MlvFilterExpression,
  readValue: (value: T, key: string) => unknown,
): boolean {
  if (expression.kind === 'condition') {
    return _matchesCondition(
      readValue(value, expression.key),
      expression.condition,
    );
  }
  return expression.combinator === 'and'
    ? expression.children.every((child) =>
        mlvMatchesFilterExpression(value, child, readValue),
      )
    : expression.children.some((child) =>
        mlvMatchesFilterExpression(value, child, readValue),
      );
}

/**
 * @private Normalizes an expression into a boolean identity or flat terms.
 * A distinct unrepresentable state prevents false identities from being
 * confused with shapes that would lose grouping semantics when flattened.
 */
function _collectFlatExpression(
  expression: MlvFilterExpression,
): MlvFlatCollection {
  if (expression.kind === 'condition') {
    return {
      kind: 'terms',
      terms: [
        {
          key: expression.key,
          strategy: 'and',
          conditions: [expression.condition],
        },
      ],
    };
  }
  return expression.combinator === 'and'
    ? _collectAndGroup(expression.children)
    : _collectOrGroup(expression.children);
}

/** @private Combines child collections using AND's true/false identities. */
function _collectAndGroup(
  children: readonly MlvFilterExpression[],
): MlvFlatCollection {
  const terms: MlvFieldTerms[] = [];
  let hasFalseChild = false;
  let hasUnrepresentableChild = false;
  for (const child of children) {
    const collection = _collectFlatExpression(child);
    if (collection.kind === 'false') {
      hasFalseChild = true;
      continue;
    }
    if (collection.kind === 'unrepresentable') {
      hasUnrepresentableChild = true;
      continue;
    }
    if (collection.kind === 'terms') terms.push(...collection.terms);
  }
  if (hasFalseChild) return { kind: 'false' };
  if (hasUnrepresentableChild) return { kind: 'unrepresentable' };
  return terms.length === 0 ? { kind: 'true' } : { kind: 'terms', terms };
}

/**
 * @private Combines child collections using OR's true/false identities, then
 * flattens only multiple alternatives for one field.
 */
function _collectOrGroup(
  children: readonly MlvFilterExpression[],
): MlvFlatCollection {
  const alternatives: MlvFieldTerms[][] = [];
  let hasUnrepresentableChild = false;
  for (const child of children) {
    const collection = _collectFlatExpression(child);
    if (collection.kind === 'true') return collection;
    if (collection.kind === 'false') continue;
    if (collection.kind === 'unrepresentable') {
      hasUnrepresentableChild = true;
      continue;
    }
    alternatives.push([...collection.terms]);
  }

  if (hasUnrepresentableChild) return { kind: 'unrepresentable' };
  if (alternatives.length === 0) return { kind: 'false' };
  if (alternatives.length === 1) {
    const onlyAlternative = alternatives[0];
    return onlyAlternative === undefined
      ? { kind: 'false' }
      : { kind: 'terms', terms: onlyAlternative };
  }

  const terms = alternatives.flat();
  const first = terms[0];
  if (
    first === undefined ||
    terms.length !== alternatives.length ||
    terms.some((term) => term.key !== first.key)
  ) {
    return { kind: 'unrepresentable' };
  }

  return {
    kind: 'terms',
    terms: [
      {
        key: first.key,
        strategy: 'or',
        conditions: terms.flatMap((term) => term.conditions),
      },
    ],
  };
}

/** @private Evaluates one condition without coupling the filter package to a row shape. */
function _matchesCondition(
  value: unknown,
  condition: MlvFilterCondition,
): boolean {
  const operand = condition.value;
  switch (condition.operator) {
    case 'contains':
      return _normalizedText(value).includes(_normalizedText(operand));
    case 'not-contains':
      return !_normalizedText(value).includes(_normalizedText(operand));
    case 'starts-with':
      return _normalizedText(value).startsWith(_normalizedText(operand));
    case 'ends-with':
      return _normalizedText(value).endsWith(_normalizedText(operand));
    case 'equals':
      return value === operand;
    case 'not-equals':
      return value !== operand;
    case 'greater-than':
      return _compareNumbers(value, operand, (left, right) => left > right);
    case 'greater-than-or-equal':
      return _compareNumbers(value, operand, (left, right) => left >= right);
    case 'less-than':
      return _compareNumbers(value, operand, (left, right) => left < right);
    case 'less-than-or-equal':
      return _compareNumbers(value, operand, (left, right) => left <= right);
    case 'between':
      return _isBetween(value, operand);
    case 'in':
      return Array.isArray(operand) && operand.includes(value);
    case 'not-in':
      return Array.isArray(operand) && !operand.includes(value);
    case 'empty':
      return _isEmpty(value);
    case 'not-empty':
      return !_isEmpty(value);
  }
}

/** @private Normalizes text according to the existing data-source predicate contract. */
function _normalizedText(value: unknown): string {
  return normalizeForMatch(String(value ?? ''));
}

/** @private Converts number-editor compatible values to a finite number. */
function _toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** @private Applies one numeric relation only to two valid finite numeric values. */
function _compareNumbers(
  value: unknown,
  operand: unknown,
  compare: (value: number, operand: number) => boolean,
): boolean {
  const numericValue = _toFiniteNumber(value);
  const numericOperand = _toFiniteNumber(operand);
  return (
    numericValue !== null &&
    numericOperand !== null &&
    compare(numericValue, numericOperand)
  );
}

/** @private Applies an inclusive ordered numeric range with an exact two-value operand. */
function _isBetween(value: unknown, operand: unknown): boolean {
  if (!Array.isArray(operand) || operand.length !== 2) return false;
  const numericValue = _toFiniteNumber(value);
  const minimum = _toFiniteNumber(operand[0]);
  const maximum = _toFiniteNumber(operand[1]);
  return (
    numericValue !== null &&
    minimum !== null &&
    maximum !== null &&
    minimum <= maximum &&
    numericValue >= minimum &&
    numericValue <= maximum
  );
}

/** @private Treats nullish values, empty strings, and empty arrays as empty. */
function _isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}
