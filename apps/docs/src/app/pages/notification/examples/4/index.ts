import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvNotificationService } from '@malva-ui/core/notification';
import type { MlvToastPosition } from '@malva-ui/core/toast';

@Component({
  selector: 'docs-notification-positioning-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class NotificationPositioningExampleComponent {
  private readonly notificationService = inject(MlvNotificationService);

  protected readonly positions: MlvToastPosition[] = [
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];

  show(position: MlvToastPosition): void {
    this.notificationService.success('Notification at ' + position, {
      description:
        'This notification is anchored to the ' + position + ' corner.',
      position,
      displayTime: 4000,
    });
  }
}
