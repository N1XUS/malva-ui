import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTextarea } from '@malva-ui/core/textarea';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

@Component({
  selector: 'docs-textarea-char-count-example',
  imports: [MlvTextarea, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TextareaCharCountExampleComponent {
  readonly bioControl = new FormControl('');
}
