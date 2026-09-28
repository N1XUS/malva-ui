import type {
  MlvFilterExpression,
  MlvFilterFieldState,
  MlvFilterOperator,
} from './filter.types';
import {
  mlvFilterExpressionToFields,
  mlvFilterFieldsToExpression,
  mlvMatchesFilterExpression,
} from './filter-expression';

interface FilterRow {
  readonly health?: string | null;
  readonly region?: string | null;
  readonly name?: string | null;
  readonly score?: number | string | null;
  readonly tags?: readonly string[] | null;
}

const readValue = (row: FilterRow, key: string): unknown =>
  row[key as keyof FilterRow];

const condition = (
  key: string,
  operator: MlvFilterOperator,
  value: unknown,
): MlvFilterExpression => ({
  kind: 'condition',
  key,
  condition: { operator, value },
});

describe('MlvFilterExpression adapters', () => {
  it('maps flat fields to an AND expression while preserving field and condition order', () => {
    const fields: readonly MlvFilterFieldState[] = [
      {
        key: 'health',
        strategy: 'and',
        conditions: [
          { operator: 'not-empty', value: null },
          { operator: 'not-equals', value: 'healthy' },
        ],
      },
      {
        key: 'region',
        strategy: 'or',
        conditions: [
          { operator: 'equals', value: 'EU' },
          { operator: 'equals', value: 'UK' },
        ],
      },
    ];

    expect(mlvFilterFieldsToExpression(fields)).toEqual({
      kind: 'group',
      combinator: 'and',
      children: [
        {
          kind: 'group',
          combinator: 'and',
          children: [
            condition('health', 'not-empty', null),
            condition('health', 'not-equals', 'healthy'),
          ],
        },
        {
          kind: 'group',
          combinator: 'or',
          children: [
            condition('region', 'equals', 'EU'),
            condition('region', 'equals', 'UK'),
          ],
        },
      ],
    });
  });

  it('keeps a single field condition as a leaf while making an empty filter set a true AND group', () => {
    expect(
      mlvFilterFieldsToExpression([
        {
          key: 'health',
          strategy: 'or',
          conditions: [{ operator: 'equals', value: 'risk' }],
        },
      ]),
    ).toEqual({
      kind: 'group',
      combinator: 'and',
      children: [condition('health', 'equals', 'risk')],
    });
    expect(mlvFilterFieldsToExpression([])).toEqual({
      kind: 'group',
      combinator: 'and',
      children: [],
    });
  });

  it('maps normalized AND expressions back to flat field state', () => {
    const expression: MlvFilterExpression = {
      kind: 'group',
      combinator: 'and',
      children: [
        condition('health', 'equals', 'risk'),
        {
          kind: 'group',
          combinator: 'or',
          children: [
            condition('region', 'equals', 'EU'),
            condition('region', 'equals', 'UK'),
          ],
        },
      ],
    };

    expect(mlvFilterExpressionToFields(expression)).toEqual([
      {
        key: 'health',
        strategy: 'and',
        conditions: [{ operator: 'equals', value: 'risk' }],
      },
      {
        key: 'region',
        strategy: 'or',
        conditions: [
          { operator: 'equals', value: 'EU' },
          { operator: 'equals', value: 'UK' },
        ],
      },
    ]);
  });

  it('normalizes nested AND groups and repeated same-field leaves without changing their meaning', () => {
    const expression: MlvFilterExpression = {
      kind: 'group',
      combinator: 'and',
      children: [
        condition('score', 'greater-than', 10),
        {
          kind: 'group',
          combinator: 'and',
          children: [
            condition('health', 'equals', 'risk'),
            condition('score', 'less-than', 20),
          ],
        },
      ],
    };

    expect(mlvFilterExpressionToFields(expression)).toEqual([
      {
        key: 'score',
        strategy: 'and',
        conditions: [
          { operator: 'greater-than', value: 10 },
          { operator: 'less-than', value: 20 },
        ],
      },
      {
        key: 'health',
        strategy: 'and',
        conditions: [{ operator: 'equals', value: 'risk' }],
      },
    ]);
  });

  it('normalizes singleton groups to a direct AND leaf and accepts an empty AND group as no fields', () => {
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'and',
        children: [
          {
            kind: 'group',
            combinator: 'or',
            children: [condition('region', 'equals', 'EU')],
          },
        ],
      }),
    ).toEqual([
      {
        key: 'region',
        strategy: 'and',
        conditions: [{ operator: 'equals', value: 'EU' }],
      },
    ]);
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'and',
        children: [],
      }),
    ).toEqual([]);
  });

  it('flattens nested same-field OR groups without changing their condition order', () => {
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'and',
        children: [
          {
            kind: 'group',
            combinator: 'or',
            children: [
              condition('region', 'equals', 'EU'),
              {
                kind: 'group',
                combinator: 'or',
                children: [
                  condition('region', 'equals', 'UK'),
                  condition('region', 'equals', 'US'),
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        key: 'region',
        strategy: 'or',
        conditions: [
          { operator: 'equals', value: 'EU' },
          { operator: 'equals', value: 'UK' },
          { operator: 'equals', value: 'US' },
        ],
      },
    ]);
  });

  it('normalizes singleton wrappers and boolean identities before reverse conversion', () => {
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'or',
        children: [
          condition('region', 'equals', 'EU'),
          {
            kind: 'group',
            combinator: 'and',
            children: [condition('region', 'equals', 'UK')],
          },
        ],
      }),
    ).toEqual([
      {
        key: 'region',
        strategy: 'or',
        conditions: [
          { operator: 'equals', value: 'EU' },
          { operator: 'equals', value: 'UK' },
        ],
      },
    ]);
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'or',
        children: [
          { kind: 'group', combinator: 'and', children: [] },
          condition('region', 'equals', 'EU'),
        ],
      }),
    ).toEqual([]);
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'or',
        children: [
          { kind: 'group', combinator: 'or', children: [] },
          condition('region', 'equals', 'EU'),
        ],
      }),
    ).toEqual([
      {
        key: 'region',
        strategy: 'and',
        conditions: [{ operator: 'equals', value: 'EU' }],
      },
    ]);
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'and',
        children: [
          { kind: 'group', combinator: 'and', children: [] },
          condition('region', 'equals', 'EU'),
        ],
      }),
    ).toEqual([
      {
        key: 'region',
        strategy: 'and',
        conditions: [{ operator: 'equals', value: 'EU' }],
      },
    ]);
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'and',
        children: [
          { kind: 'group', combinator: 'or', children: [] },
          condition('region', 'equals', 'EU'),
        ],
      }),
    ).toBeNull();
  });

  it('applies dominating boolean identities independently of child order', () => {
    const crossFieldOr: MlvFilterExpression = {
      kind: 'group',
      combinator: 'or',
      children: [
        condition('health', 'equals', 'risk'),
        condition('region', 'equals', 'EU'),
      ],
    };
    const falseOr: MlvFilterExpression = {
      kind: 'group',
      combinator: 'or',
      children: [],
    };
    const trueAnd: MlvFilterExpression = {
      kind: 'group',
      combinator: 'and',
      children: [],
    };
    const uk = condition('region', 'equals', 'UK');
    const expectedUk = [
      {
        key: 'region',
        strategy: 'and' as const,
        conditions: [{ operator: 'equals' as const, value: 'UK' }],
      },
    ];

    for (const children of [
      [crossFieldOr, falseOr],
      [falseOr, crossFieldOr],
    ] as const) {
      expect(
        mlvFilterExpressionToFields({
          kind: 'group',
          combinator: 'or',
          children: [{ kind: 'group', combinator: 'and', children }, uk],
        }),
      ).toEqual(expectedUk);
      expect(
        mlvFilterExpressionToFields({
          kind: 'group',
          combinator: 'and',
          children,
        }),
      ).toBeNull();
    }

    for (const children of [
      [crossFieldOr, trueAnd],
      [trueAnd, crossFieldOr],
    ] as const) {
      expect(
        mlvFilterExpressionToFields({
          kind: 'group',
          combinator: 'or',
          children,
        }),
      ).toEqual([]);
      expect(
        mlvFilterExpressionToFields({
          kind: 'group',
          combinator: 'and',
          children: [{ kind: 'group', combinator: 'or', children }, uk],
        }),
      ).toEqual(expectedUk);
    }

    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'or',
        children: [crossFieldOr, uk],
      }),
    ).toBeNull();
  });

  it('rejects lossy cross-field OR, mixed same-field composition, and false empty OR groups', () => {
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'or',
        children: [
          condition('health', 'equals', 'risk'),
          condition('region', 'equals', 'EU'),
        ],
      }),
    ).toBeNull();
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'and',
        children: [
          condition('region', 'equals', 'EU'),
          {
            kind: 'group',
            combinator: 'or',
            children: [
              condition('region', 'equals', 'UK'),
              condition('region', 'equals', 'US'),
            ],
          },
        ],
      }),
    ).toBeNull();
    expect(
      mlvFilterExpressionToFields({
        kind: 'group',
        combinator: 'or',
        children: [],
      }),
    ).toBeNull();
  });
});

describe('mlvMatchesFilterExpression', () => {
  it('evaluates recursive AND and OR expressions through the supplied value reader', () => {
    const expression: MlvFilterExpression = {
      kind: 'group',
      combinator: 'and',
      children: [
        condition('health', 'equals', 'risk'),
        {
          kind: 'group',
          combinator: 'or',
          children: [
            condition('region', 'equals', 'EU'),
            condition('region', 'equals', 'UK'),
          ],
        },
      ],
    };

    expect(
      mlvMatchesFilterExpression(
        { health: 'risk', region: 'UK' },
        expression,
        readValue,
      ),
    ).toBe(true);
    expect(
      mlvMatchesFilterExpression(
        { health: 'healthy', region: 'UK' },
        expression,
        readValue,
      ),
    ).toBe(false);
  });

  it('uses AND=true and OR=false identities for empty groups', () => {
    expect(
      mlvMatchesFilterExpression(
        {},
        { kind: 'group', combinator: 'and', children: [] },
        readValue,
      ),
    ).toBe(true);
    expect(
      mlvMatchesFilterExpression(
        {},
        { kind: 'group', combinator: 'or', children: [] },
        readValue,
      ),
    ).toBe(false);
  });

  it.each([
    ['contains', { name: 'Café' }, 'CAFE', true],
    ['not-contains', { name: 'Café' }, 'tea', true],
    ['starts-with', { name: 'Café' }, 'ca', true],
    ['ends-with', { name: 'Café' }, 'FÉ', true],
    ['equals', { health: 'risk' }, 'risk', true],
    ['not-equals', { health: 'risk' }, 'healthy', true],
    ['greater-than', { score: '11' }, 10, true],
    ['greater-than-or-equal', { score: 10 }, 10, true],
    ['less-than', { score: '9' }, 10, true],
    ['less-than-or-equal', { score: 10 }, 10, true],
    ['between', { score: 15 }, [10, 20], true],
    ['in', { region: 'EU' }, ['EU', 'UK'], true],
    ['not-in', { region: 'EU' }, ['UK'], true],
    ['empty', { name: '' }, null, true],
    ['not-empty', { name: 'Café' }, null, true],
  ] as const)(
    'matches %s using its documented comparison behavior',
    (operator, row, value, expected) => {
      expect(
        mlvMatchesFilterExpression(
          row,
          condition(
            operator === 'in' || operator === 'not-in'
              ? 'region'
              : operator === 'empty' ||
                  operator === 'not-empty' ||
                  operator === 'contains' ||
                  operator === 'not-contains' ||
                  operator === 'starts-with' ||
                  operator === 'ends-with'
                ? 'name'
                : operator === 'equals' || operator === 'not-equals'
                  ? 'health'
                  : 'score',
            operator,
            value,
          ),
          readValue,
        ),
      ).toBe(expected);
    },
  );

  it('keeps source-compatible null, range, and membership failure behavior', () => {
    expect(
      mlvMatchesFilterExpression(
        { name: null },
        condition('name', 'contains', null),
        readValue,
      ),
    ).toBe(true);
    expect(
      mlvMatchesFilterExpression(
        { score: 10 },
        condition('score', 'greater-than', 'not-a-number'),
        readValue,
      ),
    ).toBe(false);
    expect(
      mlvMatchesFilterExpression(
        { score: 15 },
        condition('score', 'between', [10]),
        readValue,
      ),
    ).toBe(false);
    expect(
      mlvMatchesFilterExpression(
        { score: 15 },
        condition('score', 'between', [20, 10]),
        readValue,
      ),
    ).toBe(false);
    expect(
      mlvMatchesFilterExpression(
        { region: 'EU' },
        condition('region', 'in', 'EU'),
        readValue,
      ),
    ).toBe(false);
    expect(
      mlvMatchesFilterExpression(
        { region: 'EU' },
        condition('region', 'not-in', 'EU'),
        readValue,
      ),
    ).toBe(false);
    expect(
      mlvMatchesFilterExpression(
        { tags: ['EU', 'UK'] },
        condition('tags', 'in', ['UK']),
        readValue,
      ),
    ).toBe(false);
  });

  it('matches text against a null-prototype operand or value without throwing', () => {
    // The smart filter bar keeps a null-prototype operand as it is (#351), so
    // a payload can carry one; `String()` throws on it.
    const dictionary = Object.assign(Object.create(null) as object, { k: 1 });

    expect(
      mlvMatchesFilterExpression(
        { name: 'Acme' },
        condition('name', 'contains', dictionary),
        readValue,
      ),
    ).toBe(false);
    expect(
      mlvMatchesFilterExpression(
        { name: dictionary as unknown as string },
        condition('name', 'contains', 'object'),
        readValue,
      ),
    ).toBe(true);
  });
});
