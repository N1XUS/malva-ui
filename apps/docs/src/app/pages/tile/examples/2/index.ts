import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvTileTone } from '@malva-ui/core/tile';
import { MlvTile, MlvTileHeader } from '@malva-ui/core/tile';

@Component({
  selector: 'docs-tile-tones-example',
  imports: [MlvTile, MlvTileHeader],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class TileTonesExampleComponent {
  readonly states: {
    value: MlvTileTone;
    label: string;
    description: string;
  }[] = [
    {
      value: 'default',
      label: 'Unassigned',
      description: 'No owner assigned.',
    },
    {
      value: 'info',
      label: 'Scheduled',
      description: 'Maintenance starts at 02:00 UTC.',
    },
    {
      value: 'success',
      label: 'Healthy',
      description: 'All checks passed.',
    },
    {
      value: 'warning',
      label: 'Needs attention',
      description: 'Memory usage is above 80%.',
    },
    {
      value: 'danger',
      label: 'Action required',
      description: 'Deployment rollback failed.',
    },
  ];
}
