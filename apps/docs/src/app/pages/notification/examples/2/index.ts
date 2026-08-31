import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvNotificationService } from '@malva-ui/core/notification';

@Component({
  selector: 'docs-notification-tones-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class NotificationTonesExampleComponent {
  private readonly notificationService = inject(MlvNotificationService);

  showSuccess(): void {
    this.notificationService.success('Deployment successful', {
      description: 'Version 2.4.0 is now live in production.',
    });
  }

  showError(): void {
    this.notificationService.error('Payment declined', {
      description:
        'Your card ending in 4242 was declined. Please update your billing info.',
    });
  }

  showWarning(): void {
    this.notificationService.warning('API rate limit approaching', {
      description: 'You have used 85% of your monthly API quota.',
    });
  }

  showInfo(): void {
    this.notificationService.info('Scheduled downtime', {
      description: 'Maintenance window is set for Sunday 02:00–04:00 UTC.',
    });
  }

  showNoIcon(): void {
    this.notificationService.show({
      title: 'Notification without icon',
      description: 'Use showIcon: false for a compact, text-only card.',
      showIcon: false,
      tone: 'default',
    });
  }
}
