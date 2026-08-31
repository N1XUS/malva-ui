import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvDataTableError } from '../data-table-error';
import { MlvDataTableNoData } from '../data-table-no-data';
import type { MlvDataTableColumn } from '../types';
import { MlvDataTable } from './data-table';

interface Row {
  id: number;
  name: string;
}

const COLUMNS: MlvDataTableColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: 'Name' },
];

@Component({
  imports: [MlvDataTable, MlvDataTableNoData],
  template: `<mlv-data-table
    [data]="data()"
    [columns]="columns"
    [error]="error()"
    [loading]="loading()"
    [virtualScroll]="virtualScroll()"
    [cellNavigation]="cellNavigation()"
    (retry)="retryCount = retryCount + 1"
  >
    <ng-template mlvDataTableNoData>
      <p class="custom-no-data">Nothing here</p>
    </ng-template>
  </mlv-data-table>`,
})
class DefaultErrorHostComponent {
  readonly columns = COLUMNS;
  readonly data = signal<Row[]>([]);
  readonly error = signal<boolean | string>(false);
  readonly loading = signal(false);
  readonly virtualScroll = signal(false);
  readonly cellNavigation = signal(false);
  retryCount = 0;
}

@Component({
  imports: [MlvDataTable, MlvDataTableError],
  template: `<mlv-data-table
    [data]="data"
    [columns]="columns"
    [error]="error()"
    (retry)="retryCount = retryCount + 1"
  >
    <ng-template mlvDataTableError let-message let-retry="retry">
      <p class="custom-error">{{ message }}</p>
      <button type="button" class="custom-retry" (click)="retry()">
        Again
      </button>
    </ng-template>
  </mlv-data-table>`,
})
class CustomErrorHostComponent {
  readonly columns = COLUMNS;
  readonly data: Row[] = [{ id: 1, name: 'Alice' }];
  readonly error = signal<boolean | string>('Request failed');
  retryCount = 0;
}

describe('MlvDataTable — error state', () => {
  let fixture: ComponentFixture<DefaultErrorHostComponent>;
  let host: HTMLElement;

  function table(): MlvDataTable {
    return fixture.debugElement.query(By.directive(MlvDataTable))
      .componentInstance as MlvDataTable;
  }

  function errorRegion(): HTMLElement | null {
    return host.querySelector<HTMLElement>('.mlv-data-table__error');
  }

  function retryButton(): HTMLButtonElement {
    return host.querySelector<HTMLButtonElement>(
      '.mlv-data-table__error-retry',
    ) as HTMLButtonElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultErrorHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DefaultErrorHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('should render the no-data template while no error is set', () => {
    expect(table().showError()).toBe(false);
    expect(errorRegion()).toBeNull();
    expect(host.querySelector('.custom-no-data')).toBeTruthy();
  });

  it('should render the default error block with a danger icon when error is true', () => {
    fixture.componentInstance.error.set(true);
    fixture.detectChanges();

    const region = errorRegion();
    expect(region).toBeTruthy();
    expect(region?.getAttribute('role')).toBe('alert');
    expect(region?.getAttribute('aria-live')).toBe('assertive');
    expect(region?.querySelector('mlv-empty-state')).toBeTruthy();
    expect(region?.querySelector('.mlv-data-table__error-icon')).toBeTruthy();
    expect(region?.textContent).toContain('Something went wrong');
    expect(region?.textContent).toContain(
      'The table data could not be loaded.',
    );
  });

  it('should take precedence over the no-data template', () => {
    fixture.componentInstance.error.set(true);
    fixture.detectChanges();

    expect(host.querySelector('.custom-no-data')).toBeNull();
  });

  it('should replace the rendered rows when data is present', () => {
    fixture.componentInstance.data.set([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    fixture.detectChanges();
    expect(host.querySelectorAll('.mlv-data-table__row--data').length).toBe(2);

    fixture.componentInstance.error.set(true);
    fixture.detectChanges();

    expect(host.querySelectorAll('.mlv-data-table__row--data').length).toBe(0);
    expect(errorRegion()).toBeTruthy();
  });

  it('should render a custom string message instead of the default', () => {
    fixture.componentInstance.error.set('The server is unavailable.');
    fixture.detectChanges();

    expect(table().errorMessage()).toBe('The server is unavailable.');
    expect(errorRegion()?.textContent).toContain('The server is unavailable.');
    expect(errorRegion()?.textContent).not.toContain(
      'The table data could not be loaded.',
    );
  });

  it('should treat a whitespace-only string as no error', () => {
    fixture.componentInstance.error.set('   ');
    fixture.detectChanges();

    expect(table().showError()).toBe(false);
    expect(errorRegion()).toBeNull();
  });

  it('should stay hidden while loading', () => {
    fixture.componentInstance.error.set('Boom');
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();

    expect(table().showError()).toBe(false);
    expect(errorRegion()).toBeNull();

    fixture.componentInstance.loading.set(false);
    fixture.detectChanges();
    expect(table().showError()).toBe(true);
    expect(errorRegion()).toBeTruthy();
  });

  it('should emit retry when the default Retry button is clicked', () => {
    fixture.componentInstance.error.set(true);
    fixture.detectChanges();

    const button = retryButton();
    expect(button.textContent?.trim()).toBe('Retry');

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.retryCount).toBe(1);
  });

  it('should render the error block in virtual-scroll mode', async () => {
    fixture.componentInstance.virtualScroll.set(true);
    fixture.componentInstance.error.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(errorRegion()).toBeTruthy();
  });

  it('should render the error block in cell-navigation mode', () => {
    fixture.componentInstance.cellNavigation.set(true);
    fixture.componentInstance.error.set(true);
    fixture.detectChanges();

    expect(errorRegion()).toBeTruthy();
  });
});

describe('MlvDataTable — custom error template', () => {
  let fixture: ComponentFixture<CustomErrorHostComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomErrorHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomErrorHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('should render the projected template with the resolved message', () => {
    expect(host.querySelector('mlv-empty-state')).toBeNull();
    expect(host.querySelector('.custom-error')?.textContent).toBe(
      'Request failed',
    );
  });

  it('should keep the alert region around the projected template', () => {
    const region = host.querySelector('.mlv-data-table__error');
    expect(region?.getAttribute('role')).toBe('alert');
    expect(region?.querySelector('.custom-error')).toBeTruthy();
  });

  it('should emit retry from the context callback', () => {
    const button = host.querySelector<HTMLButtonElement>(
      '.custom-retry',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.retryCount).toBe(1);
  });
});
