import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import type { MlvToastPosition } from '@malva-ui/core/toast';
import { MlvToastService } from '@malva-ui/core/toast';
import { MlvClick } from '@malva-ui/cdk/accessibility';

@Component({
  selector: 'docs-toast-positioning-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvClick],
  templateUrl: './index.html',
})
export default class ToastPositioningExampleComponent {
  private readonly toastService = inject(MlvToastService);

  protected readonly positions: MlvToastPosition[] = [
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];

  show(position: MlvToastPosition): void {
    this.toastService.show({
      title: position,
      description: 'Toast positioned at ' + position,
      position,
      displayTime: 3000,
    });
  }
}
