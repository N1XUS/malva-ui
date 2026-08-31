import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvEditor } from '@malva-ui/editor';

@Component({
  selector: 'docs-editor-state-events-example',
  imports: [MlvButton, MlvEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class EditorStateEventsExample {
  readonly value = signal<string | null>(
    '<p>Focus, select, or edit to produce events.</p>',
  );
  readonly readonly = signal(false);
  readonly disabled = signal(false);
  readonly events = signal<readonly string[]>([]);

  protected log(message: string): void {
    this.events.update((events) => [message, ...events].slice(0, 8));
  }
}
