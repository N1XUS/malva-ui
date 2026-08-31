import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvToastService } from '@malva-ui/core/toast';

@Component({
  selector: 'docs-toast-tones-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class ToastTonesExampleComponent {
  private readonly toastService = inject(MlvToastService);

  showSuccess(): void {
    this.toastService.success('Upload complete', {
      description: '3 files have been uploaded.',
      icon: true,
    });
  }

  showError(): void {
    this.toastService.error('Upload failed', {
      description: 'Could not connect to the server.',
      icon: true,
    });
  }

  showWarning(): void {
    this.toastService.warning('Storage almost full', {
      description: 'You have used 90% of your quota.',
      icon: true,
    });
  }

  showInfo(): void {
    this.toastService.info('New version available', {
      description: 'Refresh to update to v2.4.0.',
      icon: true,
    });
  }
}
