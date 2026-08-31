import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import { MlvPagination } from '@malva-ui/core/pagination';

@Component({
  selector: 'docs-pagination-compact-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPagination],
  templateUrl: './index.html',
})
export default class PaginationCompactExampleComponent {
  /** 500 pages at the default page size, so both ellipsis slots appear. */
  readonly totalItems = 5000;
  readonly currentPage = signal(25);
  readonly activeItemsPerPage = signal(10);

  readonly totalPages = computed(() =>
    Math.ceil(this.totalItems / this.activeItemsPerPage()),
  );
}
