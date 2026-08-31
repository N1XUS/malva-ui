import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvProgress } from '@malva-ui/core/progress';
import type { MlvProgressTone } from '@malva-ui/core/progress';

interface StateEntry {
  tone: MlvProgressTone;
  value: number;
  label: string;
}

@Component({
  selector: 'docs-progress-circle-states-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvProgress],
  templateUrl: './index.html',
})
export default class ProgressCircleStatesExampleComponent {
  readonly entries: StateEntry[] = [
    { tone: 'default', value: 60, label: 'Default' },
    { tone: 'success', value: 100, label: 'Success' },
    { tone: 'warning', value: 45, label: 'Warning' },
    { tone: 'danger', value: 20, label: 'Danger' },
    { tone: 'info', value: 75, label: 'Info' },
  ];
}
