import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButtonToggle } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-toggle-basic-example',
  imports: [MlvButtonToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonToggleBasicExampleComponent {
  readonly bold = signal(false);
}
