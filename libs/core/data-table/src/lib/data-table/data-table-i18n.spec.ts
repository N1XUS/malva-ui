import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { Component, signal } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { MlvLanguage } from '@malva-ui/i18n';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { ukLanguage } from '@malva-ui/i18n/uk';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvDataTableColumn, MlvPaginationMode } from '../types';
import { MlvDataTable } from './data-table';

/**
 * #371: `mlv-data-table` rendered seven English literals in every locale — the
 * row checkboxes' "Select row N", the two loaders, the empty state, the two
 * pin-side menu items and the actions column header. They now resolve from the
 * optional `dataTable` keys, English fallback per key, and an explicit
 * `actionsHeaderLabel` still wins.
 */
@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    [data]="data()"
    [columns]="columns"
    selectable="multi"
    editable
    [showSearch]="false"
    [loading]="loading()"
    [paginationMode]="mode()"
  />`,
})
class TableHost {
  readonly data = signal<Record<string, unknown>[]>([
    { id: 'atlas', name: 'Atlas' },
    { id: 'borealis', name: 'Borealis' },
  ]);
  readonly loading = signal(false);
  readonly mode = signal<MlvPaginationMode>('paged');
  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Name', pinnable: true },
  ];
}

@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    [data]="data"
    [columns]="columns"
    editable
    [showSearch]="false"
    actionsHeaderLabel="Row tools"
  />`,
})
class OverrideHost {
  readonly data = [{ id: 'atlas' }];
  readonly columns: MlvDataTableColumn[] = [{ key: 'id', title: 'ID' }];
}

/** The English pack with every #371 `dataTable` key replaced by a marker. */
const markerPack = {
  ...enLanguage,
  dataTable: {
    ...enLanguage.dataTable,
    selectRow: 'ROW {index}!',
    loadingMore: 'MORE-ROWS',
    loadingData: 'TABLE-DATA',
    noData: 'NOTHING',
    pinStart: 'PIN-START',
    pinEnd: 'PIN-END',
    actionsHeader: 'TOOLS',
  },
} as MlvLanguage;

/** An older, hand-written pack that predates the #371 keys. */
const legacyPack = (() => {
  const dataTable: Record<string, unknown> = { ...enLanguage.dataTable };
  for (const key of [
    'selectRow',
    'loadingMore',
    'loadingData',
    'noData',
    'pinStart',
    'pinEnd',
    'actionsHeader',
  ]) {
    delete dataTable[key];
  }
  return { ...enLanguage, dataTable } as unknown as MlvLanguage;
})();

describe('MlvDataTable — i18n of the built-in strings (#371)', () => {
  let fixture: ComponentFixture<TableHost>;

  const root = () => fixture.nativeElement as HTMLElement;

  async function render(
    providers: (Provider | EnvironmentProviders)[],
    pack?: MlvLanguage,
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TableHost, OverrideHost],
      providers,
    }).compileComponents();
    if (pack) TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture = TestBed.createComponent(TableHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function withPack(pack: MlvLanguage): Promise<void> {
    await render([provideMlvI18n(async () => ({ default: pack }))], pack);
  }

  async function switchTo(pack: MlvLanguage): Promise<void> {
    TestBed.inject(MlvI18nService).setLanguage(pack);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function set(apply: (host: TableHost) => void): Promise<void> {
    apply(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  function rowCheckboxLabels(): (string | null)[] {
    return Array.from(
      root().querySelectorAll<HTMLInputElement>(
        'tbody .mlv-data-table__cell--select input[type="checkbox"]',
      ),
    ).map((input) => input.getAttribute('aria-label'));
  }

  function actionsHeader(): string {
    return (
      root()
        .querySelector(
          '.mlv-data-table__cell--actions .mlv-data-table__visually-hidden',
        )
        ?.textContent?.trim() ?? ''
    );
  }

  function noData(): string | null {
    const el = root().querySelector('.mlv-data-table__no-data-default span');
    return el ? (el.textContent ?? '').trim() : null;
  }

  function loaderLabel(selector: string): string | null {
    return (
      root()
        .querySelector(`${selector} mlv-loader`)
        ?.getAttribute('aria-label') ?? null
    );
  }

  /** Opens the Name column's pin-side menu and returns its item texts. */
  async function pinItems(): Promise<string[]> {
    const trigger = root().querySelector<HTMLButtonElement>(
      '[data-mlv-column-key="name"] .mlv-data-table__pin-btn',
    );
    if (!trigger) throw new Error('Expected the Name pin button');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.mlv-data-table__pin-popup-item',
      ),
    ).map((item) => (item.textContent ?? '').trim());
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return items;
  }

  /** Every #371 string the table renders, gathered across its states. */
  async function strings(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {
      selectRow: rowCheckboxLabels(),
      actionsHeader: actionsHeader(),
      pin: await pinItems(),
    };
    await set((host) => host.loading.set(true));
    result['loadingData'] = loaderLabel('.mlv-data-table__loading-overlay');
    await set((host) => host.mode.set('infinite'));
    result['loadingMore'] = loaderLabel('.mlv-data-table__loading-bottom');
    await set((host) => {
      host.loading.set(false);
      host.mode.set('paged');
      host.data.set([]);
    });
    result['noData'] = noData();
    await set((host) =>
      host.data.set([
        { id: 'atlas', name: 'Atlas' },
        { id: 'borealis', name: 'Borealis' },
      ]),
    );
    return result;
  }

  const english = {
    selectRow: ['Select row 1', 'Select row 2'],
    actionsHeader: 'Actions',
    pin: ['Pin to start', 'Pin to end'],
    loadingData: 'Loading table data',
    loadingMore: 'Loading more rows',
    noData: 'No data available',
  };

  it('renders the English strings under the testing pack', async () => {
    await render([provideMlvI18nTesting()]);
    expect(await strings()).toEqual(english);
  });

  it('falls back to English for a pack that omits the keys', async () => {
    await withPack(legacyPack);
    expect(await strings()).toEqual(english);
  });

  it('reads every string from the active pack', async () => {
    await withPack(markerPack);
    expect(await strings()).toEqual({
      selectRow: ['ROW 1!', 'ROW 2!'],
      actionsHeader: 'TOOLS',
      pin: ['PIN-START', 'PIN-END'],
      loadingData: 'TABLE-DATA',
      loadingMore: 'MORE-ROWS',
      noData: 'NOTHING',
    });
  });

  it('renders the German pack and follows a live switch to Ukrainian', async () => {
    await withPack(deLanguage);
    expect(await strings()).toEqual({
      selectRow: ['Zeile 1 auswählen', 'Zeile 2 auswählen'],
      actionsHeader: 'Aktionen',
      pin: ['Am Anfang fixieren', 'Am Ende fixieren'],
      loadingData: 'Tabellendaten werden geladen',
      loadingMore: 'Weitere Zeilen werden geladen',
      noData: 'Keine Daten verfügbar',
    });

    await switchTo(ukLanguage);
    expect(await strings()).toEqual({
      selectRow: ['Вибрати рядок 1', 'Вибрати рядок 2'],
      actionsHeader: 'Дії',
      pin: ['Закріпити на початку', 'Закріпити в кінці'],
      loadingData: 'Завантаження даних таблиці',
      loadingMore: 'Завантаження наступних рядків',
      noData: 'Немає даних',
    });
  });

  it('keeps an explicit actionsHeaderLabel over the pack', async () => {
    await withPack(deLanguage);
    const override = TestBed.createComponent(OverrideHost);
    override.detectChanges();
    await override.whenStable();
    const header = (override.nativeElement as HTMLElement).querySelector(
      '.mlv-data-table__cell--actions .mlv-data-table__visually-hidden',
    );
    expect(header?.textContent?.trim()).toBe('Row tools');
  });

  it('has no axe violations with a localized pack', async () => {
    await withPack(deLanguage);
    await expectNoAxeViolations(root());
    await set((host) => host.data.set([]));
    await expectNoAxeViolations(root());
  });
});
