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
import type { MlvDialogSizeConfig } from '@malva-ui/core/dialog';

@Component({
  selector: 'docs-dialog-custom-size-example',
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
export default class DialogCustomSizeExampleComponent {
  readonly showCustom = signal(false);
  readonly customSize: MlvDialogSizeConfig = { width: 700, height: 400 };
}
