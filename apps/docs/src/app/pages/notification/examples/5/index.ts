import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import {
  NOTIFICATION_DATA,
  MlvNotificationRef,
  MlvNotificationService,
  type MlvNotificationTemplateContext,
} from '@malva-ui/core/notification';

interface ReleaseNotificationData {
  title: string;
  description: string;
}

@Component({
  selector: 'docs-release-notification-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  template: `
    <strong>{{ data.title }}</strong>
    <p>{{ data.description }}</p>
    <button mlvButton (click)="ref.close()">View release</button>
  `,
})
export class ReleaseNotificationContentComponent {
  readonly ref = inject(MlvNotificationRef);
  readonly data = inject(NOTIFICATION_DATA) as ReleaseNotificationData;
}

@Component({
  selector: 'docs-notification-programmatic-content-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class NotificationProgrammaticContentExampleComponent {
  private readonly _notificationService = inject(MlvNotificationService);
  private _activeRef: MlvNotificationRef | null = null;

  openString(): void {
    this._activeRef = this._notificationService.open(
      'Deployment completed successfully.',
      {
        displayTime: 0,
        tone: 'success',
      },
    );
  }

  openTemplate(
    template: TemplateRef<
      MlvNotificationTemplateContext<ReleaseNotificationData>
    >,
  ): void {
    this._activeRef = this._notificationService.open<ReleaseNotificationData>(
      template,
      {
        displayTime: 0,
        tone: 'info',
        data: {
          title: 'Release ready',
          description: 'Version 4.2.0 passed all quality checks.',
        },
      },
    );
  }

  openComponent(): void {
    this._activeRef = this._notificationService.open<ReleaseNotificationData>(
      ReleaseNotificationContentComponent,
      {
        displayTime: 0,
        tone: 'warning',
        data: {
          title: 'Approval required',
          description: 'The production release is waiting for your approval.',
        },
      },
    );
  }

  closeActive(): void {
    this._activeRef?.close();
    this._activeRef = null;
  }
}
