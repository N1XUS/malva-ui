import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvSearchField } from '@malva-ui/core/search-field';

@Component({
  selector: 'docs-search-field-live-example',
  imports: [MlvSearchField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SearchFieldLiveExampleComponent {
  readonly query = signal('');
}
