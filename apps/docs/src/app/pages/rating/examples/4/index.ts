import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MlvRating } from '@malva-ui/core/rating';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-rating-reactive-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvRating, ReactiveFormsModule, MlvButton],
  templateUrl: './index.html',
})
export default class RatingReactiveFormsExampleComponent {
  readonly ratingCtrl = new FormControl<number>(0, {
    validators: [Validators.min(1)],
  });

  readonly isDisabled = signal(false);

  toggleDisabled(): void {
    if (this.isDisabled()) {
      this.ratingCtrl.enable();
    } else {
      this.ratingCtrl.disable();
    }
    this.isDisabled.update((v) => !v);
  }
}
