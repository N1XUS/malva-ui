import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';
import { MlvToastService } from '@malva-ui/core/toast';

@Component({
  selector: 'docs-copy-to-clipboard-toast-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  templateUrl: './index.html',
})
export default class CopyToClipboardToastExampleComponent {
  private readonly _toast = inject(MlvToastService);

  readonly webhookUrl = 'https://hooks.malva-ui.example.com/v1/ab12cd34';

  onCopied(value: string): void {
    this._toast.success('Webhook URL copied', {
      description: value.length > 36 ? `${value.slice(0, 36)}\u2026` : value,
      displayTime: 3000,
    });
  }
}
