import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';

@Component({
  selector: 'docs-copy-to-clipboard-value-override-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  templateUrl: './index.html',
})
export default class CopyToClipboardValueOverrideExampleComponent {
  readonly orderId = 'ORDER-0042-7F9X2';
}
