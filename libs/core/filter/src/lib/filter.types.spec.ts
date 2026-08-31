import type {
  MlvFilterDefinition,
  MlvFilterExecutionPayload,
  MlvFilterFieldState,
} from './filter.types';

describe('filter public types', () => {
  it('represent metadata, multiple conditions, and an execution snapshot', () => {
    const definition: MlvFilterDefinition<string> = {
      key: 'status',
      label: 'Status',
      editor: 'options',
      options: [{ label: 'Draft', value: 'draft' }],
      multiple: true,
      defaultVisible: true,
    };
    const state: MlvFilterFieldState = {
      key: definition.key,
      strategy: 'or',
      conditions: [
        { operator: 'equals', value: 'draft' },
        { operator: 'equals', value: 'requested' },
      ],
    };
    const payload: MlvFilterExecutionPayload = {
      search: 'urgent',
      filters: [state],
      visibleKeys: [definition.key],
      expression: {
        kind: 'group',
        combinator: 'and',
        children: [
          {
            kind: 'group',
            combinator: 'or',
            children: state.conditions.map((condition) => ({
              kind: 'condition' as const,
              key: definition.key,
              condition,
            })),
          },
        ],
      },
    };

    expect(payload.filters[0].strategy).toBe('or');
    expect(payload.filters[0].conditions).toHaveLength(2);
    expect(payload.expression.kind).toBe('group');
  });
});
