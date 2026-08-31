import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  MlvFilter,
  type MlvFilterCondition,
  type MlvFilterConditionStrategy,
  type MlvFilterOperator,
} from '@malva-ui/core/filter';

@Component({
  selector: 'docs-filter-conditions-example',
  imports: [MlvFilter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class FilterConditionsExampleComponent {
  readonly operators: readonly MlvFilterOperator[] = [
    'contains',
    'starts-with',
    'equals',
    'not-equals',
    'empty',
  ];

  readonly conditions = signal<readonly MlvFilterCondition[]>([
    { id: 'title-1', operator: 'contains', value: 'design' },
  ]);
  readonly strategy = signal<MlvFilterConditionStrategy>('and');

  readonly appliedSummary = computed(() => {
    const conditions = this.conditions();
    if (conditions.length === 0) return 'No conditions applied';
    return conditions
      .map((condition) =>
        condition.value === null || condition.value === ''
          ? condition.operator
          : `${condition.operator} “${String(condition.value)}”`,
      )
      .join(` ${this.strategy().toUpperCase()} `);
  });
}
