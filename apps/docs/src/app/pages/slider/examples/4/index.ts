import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvSlider } from '@malva-ui/core/slider';
import { MlvClick } from '@malva-ui/cdk';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-slider-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSlider, ReactiveFormsModule, MlvClick, MlvButton],
  templateUrl: './index.html',
})
export default class SliderFormsExampleComponent {
  readonly volumeControl = new FormControl<number>(65);
  readonly balanceControl = new FormControl<number>(50);
  readonly isDisabled = signal(false);

  toggleDisabled(): void {
    if (this.isDisabled()) {
      this.volumeControl.enable();
      this.balanceControl.enable();
    } else {
      this.volumeControl.disable();
      this.balanceControl.disable();
    }
    this.isDisabled.set(!this.isDisabled());
  }
}
