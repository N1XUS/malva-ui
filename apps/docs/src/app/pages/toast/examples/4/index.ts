import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import type { MlvBaseToastRef } from '@malva-ui/core/toast';
import { MlvToastService } from '@malva-ui/core/toast';

@Component({
  selector: 'docs-toast-timer-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class ToastTimerExampleComponent {
  private readonly toastService = inject(MlvToastService);
  protected activeRef = signal<MlvBaseToastRef | null>(null);

  showLong(): void {
    this.toastService.info('Syncing data…', {
      description: 'Hover to pause the 8-second timer.',
      displayTime: 8000,
      pauseOnHover: true,
    });
  }

  showNonClosable(): void {
    this.toastService.warning('Scheduled maintenance', {
      description:
        'This toast closes automatically after 5 s and cannot be manually dismissed.',
      displayTime: 5000,
      closable: false,
    });
  }

  showProgrammatic(): void {
    const ref = this.toastService.show({
      title: 'Background task running',
      description: 'Click "Cancel task" to dismiss immediately.',
      displayTime: 0,
    });
    this.activeRef.set(ref);
  }

  cancelTask(): void {
    this.activeRef()?.close();
    this.activeRef.set(null);
  }
}
