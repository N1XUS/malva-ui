import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor } from '@malva-ui/editor';

@Component({
  selector: 'docs-editor-table-zoom-example',
  imports: [MlvButton, MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorTableZoomExample {
  readonly value = signal<string | null>(
    '<p>Insert a table, select a cell, then reopen Table for contextual controls.</p>',
  );
  readonly editor = viewChild<MlvEditor>('editor');
  readonly zoom = computed(() => this.editor()?.zoom() ?? 100);
  readonly zoomPreservedValue = signal(true);

  protected insertTable(): void {
    this.editor()
      ?.editor()
      ?.chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }

  protected setZoom(level: number): void {
    const serializedBefore = this.value();
    this.editor()?.zoom.set(level);
    this.zoomPreservedValue.set(this.value() === serializedBefore);
  }
}
