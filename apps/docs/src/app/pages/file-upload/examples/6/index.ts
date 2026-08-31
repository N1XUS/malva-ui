import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LucideImagePlus, LucideSparkles } from '@lucide/angular';
import { MlvButton, MlvButtonBefore } from '@malva-ui/core/button';
import { MlvFileUpload, MlvFileUploadAction } from '@malva-ui/core/file-upload';

@Component({
  selector: 'docs-file-upload-extra-actions-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvFileUpload,
    MlvFileUploadAction,
    MlvButton,
    MlvButtonBefore,
    LucideSparkles,
    LucideImagePlus,
  ],
  templateUrl: './index.html',
})
export default class DocsFileUploadExtraActionsExampleComponent {
  /** Last extra action the user triggered — proves the click never reached the zone. */
  readonly lastAction = signal('none yet');

  /** Records an extra action instead of opening the native file picker. */
  onExtraAction(label: string): void {
    this.lastAction.set(label);
  }
}
