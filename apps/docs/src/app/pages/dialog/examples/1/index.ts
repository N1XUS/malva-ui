import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogTemplate,
} from '@malva-ui/core/dialog';

@Component({
  selector: 'docs-dialog-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvDialogTemplate,
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogClose,
  ],
  templateUrl: './index.html',
})
export default class DialogBasicExampleComponent {
  readonly open = signal(false);
  readonly lastResult = signal<string>('—');

  /**
   * `mlvDialogClosed` emits whatever `[mlvDialogClose]` passed, or `undefined`
   * when the dialog was dismissed (Escape, backdrop click, or the X).
   */
  onClosed(result: unknown): void {
    this.lastResult.set(typeof result === 'string' ? result : 'dismissed');
  }
}
