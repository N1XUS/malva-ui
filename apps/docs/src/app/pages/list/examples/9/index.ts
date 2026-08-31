import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvList,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItem,
  MlvListItemMedia,
  MlvListItemTitle,
} from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import {
  LucideCalendarDays,
  LucideCreditCard,
  LucideDatabase,
  LucideEllipsis,
  LucideGitBranch,
  LucideHardDrive,
} from '@lucide/angular';

type IntegrationIcon = 'git' | 'calendar' | 'backup' | 'billing' | 'warehouse';

interface IntegrationRow {
  id: string;
  title: string;
  byline: string;
  icon: IntegrationIcon;
  /** Rows past the first three collapse their single action into an overflow menu. */
  overflow: boolean;
}

@Component({
  selector: 'docs-list-integrations-example',
  imports: [
    MlvButton,
    MlvList,
    MlvListItemActions,
    MlvListItemByline,
    MlvListItem,
    MlvListItemMedia,
    MlvListItemTitle,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    LucideCalendarDays,
    LucideCreditCard,
    LucideDatabase,
    LucideEllipsis,
    LucideGitBranch,
    LucideHardDrive,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ListIntegrationsExampleComponent {
  protected readonly integrations: IntegrationRow[] = [
    {
      id: 'source-control',
      title: 'Source control',
      byline: 'Syncs pull requests and deploy status into your team channel.',
      icon: 'git',
      overflow: false,
    },
    {
      id: 'calendar',
      title: 'Calendar',
      byline: 'Two-way sync with your primary calendar for meeting context.',
      icon: 'calendar',
      overflow: false,
    },
    {
      id: 'cloud-backup',
      title: 'Cloud backup',
      byline: 'Nightly export of workspace data to encrypted storage.',
      icon: 'backup',
      overflow: false,
    },
    {
      id: 'billing',
      title: 'Billing',
      byline:
        'Keeps invoices and payment status current from your accounting tool.',
      icon: 'billing',
      overflow: true,
    },
    {
      id: 'data-warehouse',
      title: 'Data warehouse',
      byline: 'Streams product analytics events to your warehouse hourly.',
      icon: 'warehouse',
      overflow: true,
    },
  ];

  protected readonly lastAction = signal('');

  protected disconnect(row: IntegrationRow): void {
    this.lastAction.set(`Disconnected ${row.title}`);
  }

  protected reconfigure(row: IntegrationRow): void {
    this.lastAction.set(`Reconfiguring ${row.title}`);
  }

  protected viewLogs(row: IntegrationRow): void {
    this.lastAction.set(`Viewing sync logs for ${row.title}`);
  }
}
