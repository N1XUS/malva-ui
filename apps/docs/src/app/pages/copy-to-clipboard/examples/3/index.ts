import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';

@Component({
  selector: 'docs-copy-to-clipboard-code-snippet-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvCopyToClipboard],
  templateUrl: './index.html',
})
export default class CopyToClipboardCodeSnippetExampleComponent {
  readonly commitSha = 'a1b2c3d4e5f6g7h8i9j0';
}
