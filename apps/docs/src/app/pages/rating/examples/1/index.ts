import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvRating } from '@malva-ui/core/rating';

@Component({
  selector: 'docs-rating-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvRating, FormsModule],
  templateUrl: './index.html',
})
export default class RatingBasicExampleComponent {
  readonly rating = signal(3);
}
