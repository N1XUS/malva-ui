import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { CdkFixedSizeVirtualScroll } from '@angular/cdk/scrolling';
import { beforeEach, describe, expect, it } from 'vitest';
import type * as Sass from 'sass';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvResizeObserverFactory } from '@malva-ui/cdk/utils';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvDataTable } from './data-table';
import type { MlvDataTableColumn } from '../types';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

// The `@nx/vitest:test` executor runs with cwd = workspace root, so the paths
// are resolved from this file rather than from `process.cwd()`.
const HERE = dirname(fileURLToPath(import.meta.url));
const TABLE_SCSS = resolve(HERE, './data-table.scss');
const THEME_SCSS = resolve(HERE, '../../../../../styles/src/lib/theme.scss');

const DENSITIES: readonly MlvDensity[] = [
  'tight',
  'compact',
  'comfortable',
  'spacious',
  'airy',
];

/**
 * `--mlv-dt-row-height` per density, in rem, as the table's own stylesheet
 * resolves it against the theme tokens. Pinned against the compiled CSS in the
 * first `describe`, so a token or stylesheet change turns this suite red
 * rather than leaving the numbers below describing a table nobody renders.
 */
const ROW_HEIGHT_REM: Record<MlvDensity, number> = {
  tight: 2.75,
  compact: 3.25,
  comfortable: 3.75,
  spacious: 4.25,
  airy: 4.75,
};

/** What `1rem` is when nothing has been laid out: the CSS initial 16px. */
const INITIAL_ROOT_PX = 16;

const ROW_COUNT = 12;

interface Row {
  id: number;
  name: string;
}

const ROWS: Row[] = Array.from({ length: ROW_COUNT }, (_, index) => ({
  id: index + 1,
  name: `Row ${index + 1}`,
}));

const COLUMNS: MlvDataTableColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: 'Name' },
];

/** A virtual table that leaves `rowHeight` unset — the default under test. */
@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    [data]="data"
    [columns]="columns"
    [virtualScroll]="virtual()"
    [mlvDensity]="density()"
  />`,
})
class DefaultRowHeightHost {
  readonly data = ROWS;
  readonly columns = COLUMNS;
  readonly virtual = signal(true);
  readonly density = signal<MlvDensity | undefined>(undefined);
}

/** A virtual table with an explicit `rowHeight`, which a test may unbind. */
@Component({
  imports: [MlvDataTable],
  template: `<mlv-data-table
    virtualScroll
    [data]="data"
    [columns]="columns"
    [rowHeight]="rowHeight()"
  />`,
})
class ExplicitRowHeightHost {
  readonly data = ROWS;
  readonly columns = COLUMNS;
  readonly rowHeight = signal<number | undefined>(72);
}

/**
 * Stands in for the browser's `ResizeObserver`, which jsdom does not have:
 * `MlvResizeObserverService` creates one observer per element through this
 * factory, so the test can deliver the size a real layout would report for
 * any element the table observes.
 */
class FakeResizeObservers {
  private readonly _callbacks = new Map<Element, ResizeObserverCallback>();

  create(callback: ResizeObserverCallback): ResizeObserver {
    const observed = new Set<Element>();
    const observer = {
      observe: (element: Element) => {
        observed.add(element);
        this._callbacks.set(element, callback);
      },
      unobserve: (element: Element) => {
        observed.delete(element);
        this._callbacks.delete(element);
      },
      disconnect: () => {
        observed.forEach((element) => this._callbacks.delete(element));
        observed.clear();
      },
    };
    return observer as ResizeObserver;
  }

  /** Whether some observer is currently watching `element`. */
  isObserved(element: Element): boolean {
    return this._callbacks.has(element);
  }

  /** Delivers a content-box height for `element`, as a layout pass would. */
  report(element: Element, height: number): void {
    const callback = this._callbacks.get(element);
    if (!callback) throw new Error('element is not observed');
    const entry = {
      target: element,
      contentRect: { width: 0, height } as DOMRectReadOnly,
    } as ResizeObserverEntry;
    callback([entry], {} as ResizeObserver);
  }
}

/**
 * The viewport measures itself and attaches its scroll strategy one microtask
 * after it initialises, so one `detectChanges`/`whenStable` pair is not enough
 * to observe what it computed.
 */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
  await fixture.whenStable();
}

/** The `itemSize` the CDK viewport currently strides by. */
function itemSize(fixture: ComponentFixture<unknown>): number | undefined {
  return fixture.debugElement
    .query(By.directive(CdkFixedSizeVirtualScroll))
    ?.injector.get(CdkFixedSizeVirtualScroll).itemSize;
}

/** The viewport's spacer height — `itemSize × rowCount`, the scroll range. */
function spacerHeight(fixture: ComponentFixture<unknown>): string {
  const spacer = (
    fixture.nativeElement as HTMLElement
  ).querySelector<HTMLElement>('.cdk-virtual-scroll-spacer');
  return spacer?.style.height ?? '';
}

function probe(fixture: ComponentFixture<unknown>): HTMLElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
    '.mlv-data-table__row-probe',
  );
}

function tableHost(fixture: ComponentFixture<unknown>): HTMLElement {
  return (fixture.nativeElement as HTMLElement).querySelector(
    'mlv-data-table',
  ) as HTMLElement;
}

describe('MlvDataTable — the row height virtual scroll strides by (#363)', () => {
  const tableCss = stripCssLayersFromText(sass.compile(TABLE_SCSS).css);
  const themeCss = sass.compile(THEME_SCSS).css;

  /** Resolves `calc(var(--a) + var(--b))` against the theme to a rem total. */
  function resolveRem(value: string): number {
    const substituted = value.replace(/var\((--[\w-]+)\)/g, (_, token) => {
      const declared = themeCss.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1];
      if (!declared) throw new Error(`${token} is not a theme token`);
      return declared.trim();
    });
    const terms = substituted.match(/^calc\(([\d.]+)rem \+ ([\d.]+)rem\)$/);
    if (!terms) throw new Error(`unexpected row height "${substituted}"`);
    return Number(terms[1]) + Number(terms[2]);
  }

  /** `--mlv-dt-row-height` declared for one density step. */
  function declaredRowHeight(density: MlvDensity): string {
    // Comfortable is the block's own default; every other step is the
    // `.mlv-data-table[class*="--x"]` arm of its density mixin — the arm the
    // table's own density modifier matches.
    const selector =
      density === 'comfortable'
        ? String.raw`\n\.mlv-data-table \{`
        : String.raw`\.mlv-data-table\[class\*="--${density}"\] \{`;
    const value = tableCss.match(
      new RegExp(`${selector}[^}]*?--mlv-dt-row-height:\\s*([^;]+);`),
    )?.[1];
    if (!value) throw new Error(`no --mlv-dt-row-height for ${density}`);
    return value.trim();
  }

  it.each(DENSITIES)(
    '%s: --mlv-dt-row-height resolves to the rem the docs and this suite use',
    (density) => {
      expect(resolveRem(declaredRowHeight(density))).toBe(
        ROW_HEIGHT_REM[density],
      );
    },
  );

  it('sizes the probe from the same custom property that sizes every data cell', () => {
    const cell = tableCss.match(
      /\.mlv-data-table__cell--data \{([^}]*)\}/,
    )?.[1];
    const probeRule = tableCss.match(
      /\.mlv-data-table__row-probe \{([^}]*)\}/,
    )?.[1];

    expect(cell).toContain('height: var(--mlv-dt-row-height);');
    // The probe measures exactly what a data row renders at: same property,
    // same physical axis. It takes no space and no pointer, and paints nothing.
    expect(probeRule).toContain('height: var(--mlv-dt-row-height);');
    expect(probeRule).toContain('position: absolute;');
    expect(probeRule).toContain('width: 0;');
    expect(probeRule).toContain('visibility: hidden;');
    expect(probeRule).toContain('pointer-events: none;');
  });

  describe('behaviour', () => {
    let observers: FakeResizeObservers;

    beforeEach(async () => {
      observers = new FakeResizeObservers();
      await TestBed.configureTestingModule({
        imports: [DefaultRowHeightHost, ExplicitRowHeightHost],
        providers: [
          provideMlvI18nTesting(),
          { provide: MlvResizeObserverFactory, useValue: observers },
        ],
      }).compileComponents();
    });

    async function mountDefault(): Promise<
      ComponentFixture<DefaultRowHeightHost>
    > {
      const fixture = TestBed.createComponent(DefaultRowHeightHost);
      await settle(fixture);
      return fixture;
    }

    it('leaves rowHeight unset by default', async () => {
      const fixture = await mountDefault();
      const table = fixture.debugElement
        .query(By.directive(MlvDataTable))
        .injector.get(MlvDataTable);

      expect(table.rowHeight()).toBeUndefined();
    });

    it('strides by the comfortable row height before anything has been measured', async () => {
      // No layout has run yet (a server render, a test environment, the
      // frame before the first ResizeObserver delivery): the stand-in is the
      // comfortable row at the CSS initial 16px root — 60px, not the old 40.
      const fixture = await mountDefault();
      const expected = ROW_HEIGHT_REM.comfortable * INITIAL_ROOT_PX;

      expect(itemSize(fixture)).toBe(expected);
      expect(spacerHeight(fixture)).toBe(`${ROW_COUNT * expected}px`);
    });

    it('renders a hidden probe directly under the host and observes it', async () => {
      const fixture = await mountDefault();
      const element = probe(fixture);

      expect(element).not.toBeNull();
      // Directly under the host, so an override of `--mlv-dt-row-height` or
      // `--mlv-height-*` on the table element or any ancestor reaches it.
      expect(element?.parentElement).toBe(tableHost(fixture));
      expect(element?.getAttribute('aria-hidden')).toBe('true');
      expect(element?.childNodes.length).toBe(0);
      expect(observers.isObserved(element as HTMLElement)).toBe(true);
    });

    it.each(DENSITIES)(
      'strides by the row height the probe measures at %s',
      async (density) => {
        const fixture = await mountDefault();
        fixture.componentInstance.density.set(density);
        await settle(fixture);
        const measured = ROW_HEIGHT_REM[density] * INITIAL_ROOT_PX;

        observers.report(probe(fixture) as HTMLElement, measured);
        await settle(fixture);

        expect(tableHost(fixture).classList).toContain(
          `mlv-data-table--${density}`,
        );
        expect(itemSize(fixture)).toBe(measured);
        expect(spacerHeight(fixture)).toBe(`${ROW_COUNT * measured}px`);
      },
    );

    it('re-strides on a runtime density flip without re-creating the probe', async () => {
      const fixture = await mountDefault();
      const element = probe(fixture) as HTMLElement;
      observers.report(element, ROW_HEIGHT_REM.comfortable * INITIAL_ROOT_PX);
      await settle(fixture);

      // A density flip re-resolves `--mlv-dt-row-height` on the host, which
      // resizes the probe, which the observer reports — no remount, and no
      // code path of its own for density.
      fixture.componentInstance.density.set('compact');
      await settle(fixture);
      expect(probe(fixture)).toBe(element);
      expect(observers.isObserved(element)).toBe(true);

      observers.report(element, ROW_HEIGHT_REM.compact * INITIAL_ROOT_PX);
      await settle(fixture);

      expect(itemSize(fixture)).toBe(52);
    });

    it('follows the root font size, which rem row heights scale with', async () => {
      // At a 20px root (a browser "large" font setting) a comfortable row is
      // 3.75rem = 75px. Any px constant — the old 40, or a hand-set 60 —
      // strides short of it.
      const fixture = await mountDefault();

      observers.report(
        probe(fixture) as HTMLElement,
        ROW_HEIGHT_REM.comfortable * 20,
      );
      await settle(fixture);

      expect(itemSize(fixture)).toBe(75);
    });

    it('keeps the last measurement when the probe reports no height', async () => {
      // A `display: none` ancestor collapses the probe to 0×0; the rows are
      // not rendered then either, so the last real height stays in force.
      const fixture = await mountDefault();
      const element = probe(fixture) as HTMLElement;
      observers.report(element, 52);
      await settle(fixture);

      observers.report(element, 0);
      await settle(fixture);

      expect(itemSize(fixture)).toBe(52);
    });

    it('leaves the row height to the cells when rowHeight is unset', async () => {
      const fixture = await mountDefault();
      const rows = (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLElement>('.mlv-data-table__row--data');

      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row.style.height).toBe(''));
    });

    it('prefers an explicit rowHeight, pins the rows to it, and renders no probe', async () => {
      const fixture = TestBed.createComponent(ExplicitRowHeightHost);
      await settle(fixture);

      expect(itemSize(fixture)).toBe(72);
      expect(spacerHeight(fixture)).toBe(`${ROW_COUNT * 72}px`);
      const row = (
        fixture.nativeElement as HTMLElement
      ).querySelector<HTMLElement>('.mlv-data-table__row--data');
      expect(row?.style.height).toBe('72px');
      // The bound value wins, so nothing is measured: the explicit path has
      // the host children it had before #363, and no observer.
      expect(probe(fixture)).toBeNull();
    });

    it('renders and observes the probe only while rowHeight is unbound', async () => {
      const fixture = TestBed.createComponent(ExplicitRowHeightHost);
      await settle(fixture);
      expect(probe(fixture)).toBeNull();

      // Unbound: the probe appears, is observed, and its report is the stride.
      fixture.componentInstance.rowHeight.set(undefined);
      await settle(fixture);
      const first = probe(fixture) as HTMLElement;
      expect(first).not.toBeNull();
      expect(observers.isObserved(first)).toBe(true);
      observers.report(first, 52);
      await settle(fixture);
      expect(itemSize(fixture)).toBe(52);

      // Bound again: the value wins, and the probe goes with its observer.
      fixture.componentInstance.rowHeight.set(72);
      await settle(fixture);
      expect(probe(fixture)).toBeNull();
      expect(observers.isObserved(first)).toBe(false);
      expect(itemSize(fixture)).toBe(72);

      // Unbound once more: a fresh probe is observed and re-measured.
      fixture.componentInstance.rowHeight.set(undefined);
      await settle(fixture);
      const second = probe(fixture) as HTMLElement;
      expect(second).not.toBeNull();
      expect(second === first).toBe(false);
      expect(observers.isObserved(second)).toBe(true);
      observers.report(second, 68);
      await settle(fixture);
      expect(itemSize(fixture)).toBe(68);
    });

    it('renders and observes no probe outside virtual mode, and releases it when virtual mode ends', async () => {
      const fixture = await mountDefault();
      const element = probe(fixture) as HTMLElement;
      expect(observers.isObserved(element)).toBe(true);

      fixture.componentInstance.virtual.set(false);
      await settle(fixture);

      expect(probe(fixture)).toBeNull();
      expect(observers.isObserved(element)).toBe(false);
    });

    it('has no axe violations in virtual mode, probe included', async () => {
      const fixture = await mountDefault();
      observers.report(probe(fixture) as HTMLElement, 60);
      await settle(fixture);

      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    });
  });
});
