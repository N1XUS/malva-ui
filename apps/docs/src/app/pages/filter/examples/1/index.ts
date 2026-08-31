import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  MlvFilter,
  type MlvFilterCondition,
  type MlvFilterOption,
} from '@malva-ui/core/filter';

@Component({
  selector: 'docs-filter-options-example',
  imports: [MlvFilter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class FilterOptionsExampleComponent {
  readonly statusOptions: readonly MlvFilterOption<string>[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Requested', value: 'requested' },
    { label: 'Unpublished', value: 'unpublished' },
  ];

  readonly regionOptions: readonly MlvFilterOption<string>[] = [
    { label: 'Americas', value: 'americas' },
    { label: 'Asia Pacific', value: 'apac' },
    { label: 'Europe', value: 'europe' },
  ];

  readonly statusConditions = signal<readonly MlvFilterCondition[]>([]);
  readonly tagConditions = signal<readonly MlvFilterCondition[]>([
    { operator: 'in', value: ['requested', 'published', 'draft'] },
  ]);

  readonly statusSummary = computed(() =>
    this._summary(this.statusConditions()),
  );
  readonly tagSummary = computed(() => this._summary(this.tagConditions()));

  private _summary(conditions: readonly MlvFilterCondition[]): string {
    const values = conditions.flatMap((condition) =>
      Array.isArray(condition.value) ? condition.value : [condition.value],
    );
    return values.length > 0 ? values.join(', ') : 'No value applied';
  }
}
