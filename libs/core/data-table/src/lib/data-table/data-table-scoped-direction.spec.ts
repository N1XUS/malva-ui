import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvDataTable } from './data-table';
import type { MlvDataTableColumn } from '../types';

/**
 * With `cellNavigation`, `@angular/aria`'s `Grid` (and each `GridCell`) injects
 * the CDK `Directionality` to decide which horizontal arrow key moves to the
 * _next_ column. The root-provided one reports only the **document**
 * direction, so without the table's scoped provider a `[dir="rtl"]` wrapper
 * mirrors the columns but not the keys.
 *
 * No global-flip case: `MlvRtlService.setDirection()` also writes the root CDK
 * `Directionality`, so it passes with the provider removed
 * (`.claude/rules/rtl.md`).
 */
@Component({
  imports: [MlvDataTable],
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-data-table [data]="data" [columns]="columns" cellNavigation />
    </div>
  `,
})
class ScopedDirectionHost {
  readonly data = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Name' },
  ];
  readonly scopeDir = signal<'ltr' | 'rtl' | null>(null);
}

describe('MlvDataTable — scoped [dir] cell navigation', () => {
  let fixture: ComponentFixture<ScopedDirectionHost>;
  let host: ScopedDirectionHost;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScopedDirectionHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ScopedDirectionHost);
    host = fixture.componentInstance;
    rtl = TestBed.inject(MlvRtlService);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    rtl.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  function dataCells(): HTMLTableCellElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll(
        '.mlv-data-table__row--data td[role="gridcell"]',
      ),
    );
  }

  /** Index of the grid cell holding the roving tab stop. */
  function rovingIndex(): number {
    return dataCells().findIndex((c) => c.getAttribute('tabindex') === '0');
  }

  async function press(key: string): Promise<void> {
    dataCells()[0].dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('moves to the next column on ArrowLeft under a scoped [dir="rtl"] ancestor', async () => {
    host.scopeDir.set('rtl');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtl.direction()).toBe('ltr');
    expect(rovingIndex()).toBe(0);

    await press('ArrowLeft');

    expect(rovingIndex()).toBe(1);
  });

  it('keeps LTR keys inside a [dir="ltr"] island of an RTL document', async () => {
    rtl.setDirection('rtl');
    host.scopeDir.set('ltr');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rtl.direction()).toBe('rtl');

    await press('ArrowRight');

    expect(rovingIndex()).toBe(1);
  });
});
