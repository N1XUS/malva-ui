import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvSearchField } from '@malva-ui/core/search-field';

@Component({
  selector: 'docs-search-field-overlay-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSearchField],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class SearchFieldOverlayExampleComponent {
  /** Query bound to the icon-triggered overlay. */
  readonly iconQuery = signal('');

  /** Query bound to the inline-trigger overlay. */
  readonly fieldQuery = signal('');

  /** Last committed query, from whichever trigger submitted it. */
  readonly lastCommitted = signal('');

  /** Records a committed query so the example shows the search actually fired. */
  onSearch(query: string): void {
    this.lastCommitted.set(query);
  }
}
