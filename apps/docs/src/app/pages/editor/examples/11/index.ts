import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor, type MlvEditorContentWidth } from '@malva-ui/editor';

@Component({
  selector: 'docs-editor-content-surface-example',
  imports: [MlvButton, MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorContentSurfaceExample {
  readonly widths: readonly MlvEditorContentWidth[] = [
    'default',
    'wide',
    'full',
  ];
  readonly contentWidth = signal<MlvEditorContentWidth>('default');
  readonly value = signal<string | null>(
    '<h2>Reorder me</h2><p>Hover the left gutter for the drag handle.</p><p>Or press Alt+Shift+ArrowUp and ArrowDown.</p>',
  );
}
