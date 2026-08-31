import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvNotificationService } from '@malva-ui/core/notification';

@Component({
  selector: 'docs-notification-actions-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class NotificationActionsExampleComponent {
  private readonly notificationService = inject(MlvNotificationService);
  protected lastAction = signal('');

  showUpdateAvailable(): void {
    this.notificationService.info('Update available — v3.0.0', {
      description:
        'This update includes performance improvements and security patches.',
      displayTime: 0,
      actions: [
        {
          label: 'Update now',
          variant: 'primary',
          action: () => this.lastAction.set('Updating…'),
        },
        {
          label: 'Later',
          action: () => this.lastAction.set('Dismissed update'),
        },
      ],
    });
  }

  showDeleteConfirm(): void {
    this.notificationService.error('Delete project?', {
      description:
        'This action is irreversible. All data will be permanently removed.',
      displayTime: 0,
      actions: [
        {
          label: 'Delete',
          variant: 'primary',
          action: () => this.lastAction.set('Project deleted'),
        },
        {
          label: 'Cancel',
          action: () => this.lastAction.set('Cancelled'),
        },
      ],
    });
  }
}
