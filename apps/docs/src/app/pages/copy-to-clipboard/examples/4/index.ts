import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';

@Component({
  selector: 'docs-copy-to-clipboard-duration-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  templateUrl: './index.html',
})
export default class CopyToClipboardDurationExampleComponent {
  readonly installCommand =
    'pnpm add @malva-ui/core @malva-ui/cdk @malva-ui/styles';
}
