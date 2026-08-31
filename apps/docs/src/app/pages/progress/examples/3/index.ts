import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvProgress } from '@malva-ui/core/progress';
import type { MlvProgressTone } from '@malva-ui/core/progress';

interface StateEntry {
  tone: MlvProgressTone;
  value: number;
  label: string;
}

@Component({
  selector: 'docs-progress-bar-states-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvProgress],
  templateUrl: './index.html',
})
export default class ProgressBarStatesExampleComponent {
  readonly entries: StateEntry[] = [
    { tone: 'default', value: 60, label: 'Syncing data' },
    { tone: 'success', value: 100, label: 'Upload complete' },
    { tone: 'warning', value: 45, label: 'Low disk space' },
    { tone: 'danger', value: 15, label: 'Connection lost' },
    { tone: 'info', value: 72, label: 'Indexing files' },
  ];
}
