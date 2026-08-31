import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTextarea } from '@malva-ui/core/textarea';

@Component({
  selector: 'docs-textarea-field-surface-example',
  imports: [MlvTextarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TextareaFieldSurfaceExampleComponent {}
