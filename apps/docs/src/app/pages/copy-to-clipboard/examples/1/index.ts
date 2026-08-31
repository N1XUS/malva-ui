import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';

@Component({
  selector: 'docs-copy-to-clipboard-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  templateUrl: './index.html',
})
export default class CopyToClipboardBasicExampleComponent {}
