import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvInput } from '@malva-ui/core/input';
import {
  MlvFormControlAppend,
  MlvFormControlPrepend,
} from '@malva-ui/core/form-utils';

@Component({
  selector: 'docs-input-basic-example',
  imports: [MlvInput, MlvFormControlPrepend, MlvFormControlAppend],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class InputBasicExampleComponent {}
