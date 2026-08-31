import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvSearchField } from '@malva-ui/core/search-field';
import { MlvSwitch } from '@malva-ui/core/switch';

@Component({
  selector: 'docs-search-field-loading-example',
  imports: [MlvSearchField, MlvSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
  host: { class: 'docs-search-field-loading-example' },
})
export default class SearchFieldLoadingExampleComponent {
  /** Controls the loading presentation of both search modes. */
  readonly loading = signal(false);

  /** Last query committed by the live search field. */
  readonly liveQuery = signal('');

  /** Last query committed by the submit search field. */
  readonly submittedQuery = signal('');
}
