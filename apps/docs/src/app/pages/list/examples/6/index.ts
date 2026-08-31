import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  MlvList,
  MlvListItemByline,
  MlvListItem,
  MlvListItemMeta,
  MlvListItemTitle,
  type MlvListItemAccent,
} from '@malva-ui/core/list';
import {
  MlvStatusIndicator,
  type MlvStatusIndicatorTone,
} from '@malva-ui/core/status-indicator';

interface ActivityEntry {
  id: number;
  title: string;
  byline: string;
  time: string;
  /**
   * AB-R1/AB-R5: at most one accent-carrying mark per repeated unit. Only the
   * genuinely urgent row spends it; every other row's meaning is carried by
   * `statusTone` on a neutral `mlv-status-indicator` dot instead.
   */
  accent: MlvListItemAccent;
  statusTone: MlvStatusIndicatorTone;
}

@Component({
  selector: 'docs-list-activity-example',
  imports: [
    MlvList,
    MlvListItemByline,
    MlvListItem,
    MlvListItemMeta,
    MlvListItemTitle,
    MlvStatusIndicator,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ListActivityExampleComponent {
  protected readonly entries: ActivityEntry[] = [
    {
      id: 1,
      title: 'Payment gateway restored',
      byline: 'All regions processing transactions normally.',
      time: '2m ago',
      accent: 'neutral',
      statusTone: 'success',
    },
    {
      id: 2,
      title: 'Elevated error rate on /checkout',
      byline: 'p95 latency crossed 1.2s — investigating the cache tier.',
      time: '9m ago',
      accent: 'negative',
      statusTone: 'danger',
    },
    {
      id: 3,
      title: 'Scheduled maintenance tonight',
      byline: 'Analytics pipeline will pause from 23:00 to 00:30 UTC.',
      time: '1h ago',
      accent: 'neutral',
      statusTone: 'warning',
    },
    {
      id: 4,
      title: 'New region available: eu-central-2',
      byline: 'Enable it from the Infrastructure settings.',
      time: '3h ago',
      accent: 'neutral',
      statusTone: 'info',
    },
    {
      id: 5,
      title: 'Weekly digest published',
      byline: '28 experiments shipped, 12 rolled back.',
      time: 'Yesterday',
      accent: 'neutral',
      statusTone: 'primary',
    },
    {
      id: 6,
      title: 'Archived: legacy audit-log exporter',
      byline: 'Deprecated service removed from the catalog.',
      time: '3 days ago',
      accent: 'neutral',
      statusTone: 'default',
    },
  ];
}
