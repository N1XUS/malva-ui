import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvNotificationService } from '@malva-ui/core/notification';

@Component({
  selector: 'docs-notification-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class NotificationBasicExampleComponent {
  private readonly notificationService = inject(MlvNotificationService);

  show(): void {
    this.notificationService.show({
      title: 'Team invitation sent',
      description:
        'Sarah Johnson will receive an email invitation to join your workspace.',
    });
  }
}
