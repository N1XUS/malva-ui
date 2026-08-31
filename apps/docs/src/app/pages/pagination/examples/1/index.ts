import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvPagination } from '@malva-ui/core/pagination';

@Component({
  selector: 'docs-pagination-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPagination],
  templateUrl: './index.html',
})
export default class PaginationBasicExampleComponent {
  readonly currentPage = signal(1);
  readonly totalItems = 120;
}
