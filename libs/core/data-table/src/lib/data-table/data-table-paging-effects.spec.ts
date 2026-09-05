import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvArrayDataSource } from '@malva-ui/cdk/data-source';
import { MlvDataTable } from './data-table';
import type { MlvDataTableColumn } from '../types';

interface Row {
  id: number;
  name: string;
}

const ROWS: Row[] = Array.from({ length: 60 }, (_, index) => ({
  id: index + 1,
  name: `Row ${index + 1}`,
}));

/**
 * The shape every server-backed `MlvDataSource` subclass ends up with: setter
 * overrides that compare the incoming value against the state the source is
 * already holding, so a call that changes nothing does not cost a round trip.
 *
 * Those comparisons read `page()` and `perPage()`. `MlvDataTable` drives both
 * setters from `effect()`s, so unless the table isolates the calls those reads
 * join the effects' dependency sets — and the base `setPerPage` resets the page
 * to 1, which is a write to one of them. In a browser the two effects then
 * retrigger each other synchronously inside a single change-detection pass,
 * which never yields and freezes the tab; the counters below turn that into a
 * fast, deterministic failure instead of a hung worker.
 */
class GuardedSource extends MlvArrayDataSource<Row> {
  setPageCalls = 0;
  setPerPageCalls = 0;

  override setPage(page: number): void {
    if (++this.setPageCalls > 50) {
      throw new Error(
        'paging effect cycle: setPage ran 50+ times in one change detection pass',
      );
    }
    // The guard read that makes the cycle possible.
    if (page === this.page()) return;
    super.setPage(page);
  }

  override setPerPage(perPage: number): void {
    if (++this.setPerPageCalls > 50) {
      throw new Error(
        'paging effect cycle: setPerPage ran 50+ times in one change detection pass',
      );
    }
    // The guard read that makes the cycle possible. `super.setPerPage` resets
    // the page to 1, so tracking `page()` here closes the loop.
    if (perPage === this.perPage() && this.page() === 1) return;
    super.setPerPage(perPage);
  }
}

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table [data]="source" [columns]="columns" />`,
})
class PagingHostComponent {
  readonly source = new GuardedSource(ROWS);
  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Name' },
  ];
}

describe('MlvDataTable — paging effects and data-source setters', () => {
  let fixture: ComponentFixture<PagingHostComponent>;

  function table(): MlvDataTable {
    return fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagingHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PagingHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('drives the source to the page it was asked for, once', async () => {
    const source = fixture.componentInstance.source;
    const callsBefore = source.setPageCalls + source.setPerPageCalls;

    table().currentPage.set(2);
    fixture.detectChanges();
    await fixture.whenStable();

    // The page the table asked for is the page the source is holding — a
    // `setPerPage` retriggered by this write would have reset it to 1.
    expect(source.page()).toBe(2);
    expect(
      source.setPageCalls + source.setPerPageCalls - callsBefore,
    ).toBeLessThan(10);
  });

  it('keeps the visitor on their page when only the page size effect re-runs', async () => {
    const source = fixture.componentInstance.source;

    table().currentPage.set(3);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(source.page()).toBe(3);

    table().currentPerPage.set(25);
    fixture.detectChanges();
    await fixture.whenStable();

    // A genuine page-size change does reset to page 1 — that is the base
    // class's documented contract. What must not happen is the source ending
    // up on a page nobody asked for, or the two effects trading writes.
    expect(source.perPage()).toBe(25);
    expect(source.page()).toBe(1);
    expect(source.setPageCalls).toBeLessThan(20);
    expect(source.setPerPageCalls).toBeLessThan(20);
  });
});
