import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { disabled, form, FormField } from '@angular/forms/signals';
import { MlvButton } from '@malva-ui/core/button';
import { MlvRating } from '@malva-ui/core/rating';

@Component({
  selector: 'docs-rating-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvRating, MlvButton, FormField],
  templateUrl: './index.html',
})
export default class RatingSignalFormsExampleComponent {
  readonly isDisabled = signal(false);
  readonly model = signal({ score: 3 });
  readonly ratingForm = form(this.model, (path) => {
    disabled(path.score, () => this.isDisabled());
  });

  toggleDisabled(): void {
    this.isDisabled.update((value) => !value);
  }
}
