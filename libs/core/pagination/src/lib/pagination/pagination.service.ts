import { range } from '@malva-ui/cdk/utils';
import { computed, Injectable, isDevMode, signal } from '@angular/core';
import type { MlvPaginationObject } from './pagination.model';

/** Constant representing the number of pages which appear before and after current page. */
const CORNER_DISPLAY_PAGES = 1;
const SIDE_CURRENT_DISPLAY_PAGES = 2;

/**
 * Helper class that is used to retrieve all the pages, the number of pages, and to validate the pagination object.
 */
@Injectable()
export class MlvPaginationService {
  /** @hidden */
  readonly moreElementValue = -1;

  readonly pagination = signal<MlvPaginationObject>({
    currentPage: 1,
    totalItems: 0,
    itemsPerPage: 0,
    itemsPerPageOptions: [],
  });

  /**
   * A number array representing the pages of the pagination object.
   * Array length always the same and configured by CORNER_DISPLAY_PAGES & SIDE_CURRENT_DISPLAY_PAGES.
   */
  readonly pages = computed(() => {
    const pagination = this.pagination();

    if (!pagination.currentPage) {
      pagination.currentPage = 1;
    }

    this.validate();

    const totalPages = this.totalPages();
    const pages = range(totalPages, (i) => i + 1);

    // +1 for current page, +2 for "more" elements - after start & before end pages
    const pagesToDisplay =
      CORNER_DISPLAY_PAGES * 2 + SIDE_CURRENT_DISPLAY_PAGES * 2 + 1 + 2;

    if (pages.length <= pagesToDisplay) {
      return pages;
    }

    const pagesBefore = pagination.currentPage - 1;
    const pagesAfter = totalPages - pagination.currentPage;
    const minimalPagesGap = Math.round(pagesToDisplay / 2);

    if (pagesBefore < minimalPagesGap) {
      return [
        ...pages.slice(0, pagesToDisplay - 2),
        this.moreElementValue,
        ...pages.slice(totalPages - CORNER_DISPLAY_PAGES),
      ];
    }

    if (pagesAfter < minimalPagesGap) {
      return [
        ...pages.slice(0, CORNER_DISPLAY_PAGES),
        this.moreElementValue,
        ...pages.slice(totalPages - pagesToDisplay + 2),
      ];
    }

    return [
      ...pages.slice(0, CORNER_DISPLAY_PAGES),
      this.moreElementValue,
      ...pages.slice(
        pagination.currentPage - SIDE_CURRENT_DISPLAY_PAGES - 1,
        pagination.currentPage + SIDE_CURRENT_DISPLAY_PAGES,
      ),
      this.moreElementValue,
      ...pages.slice(totalPages - CORNER_DISPLAY_PAGES),
    ];
  });

  /**
   * Total number of pages.
   */
  totalPages = computed(() => {
    const pagination = this.pagination();

    if (!pagination.itemsPerPage) {
      return 0;
    }

    return Math.ceil(pagination.totalItems / pagination.itemsPerPage);
  });

  normalizedItemsPerPageOptions = computed(() => {
    const pagination = this.pagination();

    if (pagination.totalItems <= pagination.itemsPerPageOptions[0]) {
      return [];
    }

    if (
      pagination.totalItems >=
      pagination.itemsPerPageOptions[pagination.itemsPerPageOptions.length - 1]
    ) {
      return pagination.itemsPerPageOptions;
    }

    const index = pagination.itemsPerPageOptions.findIndex(
      (option) => option >= pagination.totalItems,
    );

    return pagination.itemsPerPageOptions.slice(0, index + 1);
  });

  /**
   * Provides validation for the pagination object.
   */
  validate(): void {
    if (isDevMode()) {
      const pagination = this.pagination();

      if (isNaN(pagination.totalItems) || pagination.totalItems <= 0) {
        console.warn(
          `"totalItems" must be a number greater than zero but got "${pagination.totalItems}". This warning only appears in development mode.`,
        );
      }

      const itemsPerPage = pagination.itemsPerPage ?? NaN;
      if (isNaN(itemsPerPage) || itemsPerPage <= 0) {
        console.warn(
          `"itemsPerPage" must be a number greater than zero but got "${pagination.itemsPerPage}". This warning only appears in development mode.`,
        );
      }
    }
  }
}
