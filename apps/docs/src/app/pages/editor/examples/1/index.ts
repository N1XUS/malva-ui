import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor } from '@malva-ui/editor';

@Component({
  selector: 'docs-editor-direct-value-example',
  imports: [MlvButton, MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorDirectValueExample {
  readonly value = signal<string | null>(
    '<h2>Release notes</h2><p>Edit this HTML-backed document.</p>',
  );

  protected restore(): void {
    this.value.set(
      '<h2>Release notes</h2><p>Edit this HTML-backed document.</p>',
    );
  }
}
