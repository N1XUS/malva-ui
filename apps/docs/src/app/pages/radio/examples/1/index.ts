import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';

@Component({
  selector: 'docs-radio-basic-group-example',
  imports: [MlvRadio, MlvRadioGroup, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class RadioBasicGroupExampleComponent {
  color = 'red';
}
