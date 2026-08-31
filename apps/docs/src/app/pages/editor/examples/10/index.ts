import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor, type MlvEditorFormat } from '@malva-ui/editor';

@Component({
  selector: 'docs-editor-format-switch-example',
  imports: [MlvButton, MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorFormatSwitchExample {
  readonly formats: readonly MlvEditorFormat[] = ['html', 'markdown', 'json'];
  readonly format = signal<MlvEditorFormat>('html');
  readonly value = signal<string | null>(
    '<h2>One document</h2><p>Switch the stored syntax without losing it.</p>',
  );

  /** Counts editor constructions to show that switching never creates a second one. */
  readonly editorsCreated = signal(0);

  protected countEditor(): void {
    this.editorsCreated.update((count) => count + 1);
  }
}
