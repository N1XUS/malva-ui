import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvTextarea } from '@malva-ui/core/textarea';

/** A three-line sample, long enough to cross the `minRows` floor when loaded. */
const SAMPLE = [
  'Malva UI ships a textarea that grows with its content.',
  'Set autoResize, then clamp the range with minRows and maxRows.',
  'The buttons above write this value straight into the model.',
].join('\n');

@Component({
  selector: 'docs-textarea-auto-resize-example',
  imports: [MlvButton, MlvTextarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TextareaAutoResizeExampleComponent {
  /**
   * The bound value. The buttons set it directly rather than typing into the
   * field, which is the path issue #78 was about: the height must follow a
   * write that never touches the `<textarea>` element.
   */
  readonly value = signal('');

  /** Loads the sample paragraph, growing the field to fit it. */
  loadSample(): void {
    this.value.set(SAMPLE);
  }

  /** Empties the field, shrinking it back to `minRows`. */
  clear(): void {
    this.value.set('');
  }
}
