import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvRating } from '@malva-ui/core/rating';

@Component({
  selector: 'docs-rating-readonly-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvRating, FormsModule],
  templateUrl: './index.html',
})
export default class RatingReadonlyExampleComponent {
  readonly wholeStarRating = 4;
  readonly halfStarRating = 4.5;
}
