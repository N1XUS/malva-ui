import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvSearchField } from '@malva-ui/core/search-field';

@Component({
  selector: 'docs-search-field-submit-example',
  imports: [MlvSearchField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SearchFieldSubmitExampleComponent {
  readonly submittedQuery = signal('');
  readonly submitCount = signal(0);

  onSearch(query: string): void {
    this.submittedQuery.set(query);
    this.submitCount.update((count) => count + 1);
  }
}
