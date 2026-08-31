import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  MlvSmartFilterBar,
  type MlvFilterDefinition,
  type MlvFilterExecutionPayload,
  type MlvFilterFieldState,
} from '@malva-ui/core/filter';

@Component({
  selector: 'docs-smart-filter-bar-example',
  imports: [MlvSmartFilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SmartFilterBarExampleComponent {
  readonly definitions: readonly MlvFilterDefinition[] = [
    {
      key: 'status',
      label: 'Status',
      defaultVisible: true,
      required: true,
      multiple: true,
      options: ['Draft', 'Requested', 'Published'].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: 'owner',
      label: 'Owner',
      defaultVisible: true,
      options: ['Maya', 'Noah', 'Lina'].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: 'priority',
      label: 'Priority',
      defaultVisible: true,
      multiple: true,
      options: ['Low', 'Medium', 'High'].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: 'title',
      label: 'Title',
      editor: 'text',
      allowMultipleConditions: false,
    },
    {
      key: 'estimate',
      label: 'Estimate',
      editor: 'number',
      operators: ['equals', 'greater-than', 'less-than'],
    },
  ];

  readonly filters = signal<readonly MlvFilterFieldState[]>([]);
  readonly visibleKeys = signal<readonly string[]>([]);
  readonly searchValue = signal('');
  readonly lastPayload = signal<MlvFilterExecutionPayload | null>(null);
  readonly lastAction = signal('No query executed yet');

  readonly payloadPreview = computed(() => {
    const payload = this.lastPayload();
    return payload ? JSON.stringify(payload, null, 2) : '—';
  });

  execute(action: string, payload: MlvFilterExecutionPayload): void {
    this.lastAction.set(action);
    this.lastPayload.set(payload);
  }
}
