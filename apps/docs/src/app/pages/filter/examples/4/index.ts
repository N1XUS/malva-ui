import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  MlvSmartFilterBar,
  MlvFilterValueEditorDef,
  type MlvFilterApplyMode,
  type MlvFilterDefinition,
  type MlvFilterExecutionPayload,
  type MlvFilterFieldState,
} from '@malva-ui/core/filter';
import { MlvButton } from '@malva-ui/core/button';
import { MlvDayPicker } from '@malva-ui/core/day-picker';

@Component({
  selector: 'docs-query-filter-example',
  imports: [
    MlvButton,
    MlvSmartFilterBar,
    MlvFilterValueEditorDef,
    MlvDayPicker,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class QueryFilterExampleComponent {
  readonly definitions: readonly MlvFilterDefinition[] = [
    {
      key: 'renewalDate',
      label: 'Renewal date',
      editor: 'text',
      operators: ['less-than', 'between'],
      defaultVisible: true,
    },
    {
      key: 'renewalRisk',
      label: 'Renewal risk',
      options: ['At risk', 'Watch', 'On track'].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: 'owner',
      label: 'Account owner',
      options: ['Alina Pop', 'Mihai Ionescu', 'Sofia Marin'].map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: 'arr',
      label: 'Annual recurring revenue',
      editor: 'number',
      operators: ['greater-than-or-equal', 'between'],
    },
  ];

  readonly filters = signal<readonly MlvFilterFieldState[]>([
    {
      key: 'renewalDate',
      strategy: 'and',
      conditions: [{ operator: 'less-than', value: '2026-10-01' }],
    },
  ]);
  readonly visibleKeys = signal<readonly string[]>(['renewalDate']);
  readonly filterApplyMode = signal<MlvFilterApplyMode>('explicit');
  readonly lastPayload = signal<MlvFilterExecutionPayload | null>(null);

  readonly payloadPreview = computed(() => {
    const payload = this.lastPayload();
    return payload ? JSON.stringify(payload.expression, null, 2) : '—';
  });

  readonly executionStatus = computed(() => {
    const payload = this.lastPayload();
    if (!payload) {
      return 'Choose Add filter to extend the renewal query.';
    }
    const conditionCount =
      payload.expression.kind === 'group'
        ? payload.expression.children.length
        : 1;
    return `Applied ${conditionCount} grouped condition${conditionCount === 1 ? '' : 's'} in ${this.filterApplyMode()} mode.`;
  });

  setApplyMode(mode: MlvFilterApplyMode): void {
    this.filterApplyMode.set(mode);
  }

  recordExecution(payload: MlvFilterExecutionPayload): void {
    this.lastPayload.set(payload);
  }

  /** Parses an ISO yyyy-MM-dd condition value into a Date for the picker. */
  protected toDate(value: unknown): Date | null {
    return typeof value === 'string' && value
      ? new Date(`${value}T00:00:00`)
      : null;
  }

  /** Serializes a picked Date back into the ISO string the condition stores. */
  protected toIso(date: Date | null): string {
    if (!date) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  /** Reads one side of a between range value. */
  protected rangeAt(value: unknown, index: number): unknown {
    return Array.isArray(value) ? (value[index] ?? '') : '';
  }

  /** Writes one side of a between range value. */
  protected setRangeAt(
    value: unknown,
    index: number,
    next: string,
    set: (value: unknown) => void,
  ): void {
    const range = Array.isArray(value) ? [...value] : ['', ''];
    range[index] = next;
    set(range);
  }
}
