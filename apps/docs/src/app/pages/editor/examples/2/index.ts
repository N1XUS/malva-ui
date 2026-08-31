import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor } from '@malva-ui/editor';

@Component({
  selector: 'docs-editor-markdown-example',
  imports: [MlvButton, MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorMarkdownExample {
  readonly value = signal<string | null>(
    '## Markdown draft\n\nEdit **bold**, _italic_, lists, and links.',
  );
}
