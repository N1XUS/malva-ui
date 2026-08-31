import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvPagination } from '@malva-ui/core/pagination';

@Component({
  selector: 'docs-pagination-ipp-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPagination],
  templateUrl: './index.html',
})
export default class PaginationIppExampleComponent {
  readonly currentPage = signal(1);
  readonly activeItemsPerPage = signal(25);
  readonly totalItems = 387;

  readonly pageSizes = [10, 25, 50, 100, Infinity];
}
