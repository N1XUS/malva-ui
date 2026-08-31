import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvToastService } from '@malva-ui/core/toast';

@Component({
  selector: 'docs-toast-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class ToastBasicExampleComponent {
  private readonly toastService = inject(MlvToastService);

  showToast(): void {
    this.toastService.open('File saved successfully', {
      displayTime: 100000000000,
    });
  }
}
