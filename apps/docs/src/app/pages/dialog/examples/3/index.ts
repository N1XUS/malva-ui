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
import { MlvFormField } from '@malva-ui/core/form-utils';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-dialog-size-presets-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvButton,
    MlvDialogTemplate,
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogClose,
    MlvFormField,
    MlvSelect,
  ],
  templateUrl: './index.html',
})
export default class DialogSizePresetsExampleComponent {
  readonly showSmall = signal(false);
  readonly showLarge = signal(false);
  readonly showFullscreen = signal(false);
}
