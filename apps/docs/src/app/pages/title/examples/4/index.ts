import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvFormField, MlvHint, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-title-ng-model-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, FormsModule, MlvFormField, MlvHint, MlvLabel, MlvTitle],
  templateUrl: './index.html',
})
export default class TitleNgModelExampleComponent {
  title = 'Launch checklist';
}
