// libs/core/table/e2e/table.spec.ts
import { defineComponentSpec, expect, test } from '@malva-ui/cdk/testing-e2e';
import type { Locator, Page } from '@playwright/test';
import { tableManifest } from './table.manifest';

/** One cell, in logical inline coordinates from the table's inline-start edge. */
interface MeasuredCell {
  readonly start: number;
  readonly end: number;
  readonly colSpan: number;
  readonly lines: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
}

interface MeasuredTable {
  readonly direction: string;
  readonly clientWidth: number;
  readonly scrollWidth: number;
  /** Lines the caption's text broke over; `0` without a caption. */
  readonly captionLines: number;
  /** `thead` rows first, then `tbody`, then `tfoot` — `HTMLTableElement.rows` order. */
  readonly rows: readonly (readonly MeasuredCell[])[];
}

/** Largest disagreement, in CSS px, still read as "the same edge". */
const TOLERANCE = 1;

/**
 * Measures every cell of `table` in logical inline coordinates, so one set of
 * assertions holds in both directions. The table is scrolled back to its
 * inline start first; every offset is relative to its padding box, in the
 * table's own CSS px — rects are divided by the ancestors' CSS `zoom`, which
 * `getBoundingClientRect()` includes and `clientWidth` does not.
 */
async function measure(table: Locator): Promise<MeasuredTable> {
  await table.page().evaluate(() => document.fonts.ready);
  return table.evaluate((element: HTMLTableElement) => {
    element.scrollLeft = 0;
    const rtl = getComputedStyle(element).direction === 'rtl';
    const box = element.getBoundingClientRect();
    const zoom = box.width / element.offsetWidth;
    const paddingStart = box.left + element.clientLeft * zoom;
    const paddingEnd = paddingStart + element.clientWidth * zoom;
    const lines = (cell: Element): number => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const tops = new Set(
        [...range.getClientRects()]
          .filter((rect) => rect.width > 0)
          .map((rect) => Math.round(rect.top)),
      );
      return tops.size;
    };
    return {
      direction: rtl ? 'rtl' : 'ltr',
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      captionLines: element.caption ? lines(element.caption) : 0,
      rows: [...element.rows].map((row) =>
        [...row.cells].map((cell) => {
          const rect = cell.getBoundingClientRect();
          return {
            start:
              (rtl ? paddingEnd - rect.right : rect.left - paddingStart) / zoom,
            end:
              (rtl ? paddingEnd - rect.left : rect.right - paddingStart) / zoom,
            colSpan: cell.colSpan,
            lines: lines(cell),
            scrollWidth: cell.scrollWidth,
            clientWidth: cell.clientWidth,
          };
        }),
      ),
    };
  });
}

/**
 * Every cell whose edges do not sit on the header column(s) it occupies, as a
 * readable string. An empty list means header and data share one grid.
 */
function misalignedCells(table: MeasuredTable): string[] {
  const [header, ...body] = table.rows;
  const off = (a: number, b: number) => Math.abs(a - b) > TOLERANCE;
  const out: string[] = [];
  body.forEach((row, r) => {
    let column = 0;
    row.forEach((cell, c) => {
      const first = header[column];
      const last = header[column + cell.colSpan - 1];
      if (!first || !last) {
        out.push(`row ${r + 1} cell ${c + 1}: no header column ${column + 1}`);
      } else if (off(cell.start, first.start) || off(cell.end, last.end)) {
        out.push(
          `row ${r + 1} cell ${c + 1}: ${cell.start.toFixed(1)}–${cell.end.toFixed(1)}` +
            ` vs header ${first.start.toFixed(1)}–${last.end.toFixed(1)}`,
        );
      }
      column += cell.colSpan;
    });
  });
  return out;
}

/** Cells whose text broke over more than one line. */
function wrappedCells(table: MeasuredTable): string[] {
  return table.rows.flatMap((row, r) =>
    row
      .map((cell, c) => (cell.lines > 1 ? `row ${r} cell ${c + 1}` : null))
      .filter((cell): cell is string => cell !== null),
  );
}

/** The inline-end edge of the furthest cell — where the shared grid stops. */
function gridEnd(table: MeasuredTable): number {
  return Math.max(...table.rows.flat().map((cell) => cell.end));
}

async function responsiveTable(page: Page, example: number): Promise<Locator> {
  const table = page
    .locator('docs-example-container')
    .nth(example - 1)
    .locator('table.mlv-table--responsive');
  await expect(table).toBeVisible();
  return table;
}

defineComponentSpec(tableManifest, () => {
  test.describe('responsive — one column grid for every row group (#355)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('example 3 — header and data cells share columns, and the grid spans the table', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(tableManifest.route);
      const table = await measure(await responsiveTable(page, 3));

      expect(misalignedCells(table)).toEqual([]);
      expect(gridEnd(table)).toBeGreaterThanOrEqual(
        table.clientWidth - TOLERANCE,
      );
      // The caption sits in the same anonymous table as the rows, so it is as
      // wide as the grid instead of squeezed to its longest word.
      expect(table.captionLines).toBe(1);
    });

    test('example 3 — a narrow table scrolls on one line and keeps its columns', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(tableManifest.route);
      const locator = await responsiveTable(page, 3);
      // Narrower than the six columns' content, so the table must overflow.
      await locator.evaluate((element: HTMLElement) => {
        element.style.maxWidth = '20rem';
      });
      const table = await measure(locator);

      expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);
      expect(wrappedCells(table)).toEqual([]);
      expect(misalignedCells(table)).toEqual([]);
    });

    test('example 4 — main and secondary rows share the header columns and fill the table', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(tableManifest.route);
      const table = await measure(await responsiveTable(page, 4));

      expect(misalignedCells(table)).toEqual([]);
      expect(Math.abs(gridEnd(table) - table.clientWidth)).toBeLessThanOrEqual(
        TOLERANCE,
      );
      expect(table.scrollWidth).toBeLessThanOrEqual(table.clientWidth);
      expect(table.captionLines).toBe(1);
    });

    for (const example of [3, 4]) {
      test(`example ${example} — columns stay shared under a scoped dir="rtl"`, async ({
        mlv,
        page,
      }) => {
        await mlv.goto(tableManifest.route);
        // The example stage writes its own `dir`, so the scope goes below it.
        await mlv
          .example(example)
          .locator('.example-container__preview')
          .evaluate((element) => {
            element.setAttribute('dir', 'rtl');
          });
        const table = await measure(await responsiveTable(page, example));

        expect(table.direction).toBe('rtl');
        // The first header cell starts at the inline-start (right) edge.
        expect(Math.abs(table.rows[0][0].start)).toBeLessThanOrEqual(TOLERANCE);
        expect(misalignedCells(table)).toEqual([]);
        expect(gridEnd(table)).toBeGreaterThanOrEqual(
          table.clientWidth - TOLERANCE,
        );
      });
    }

    // The fill cell's padding is scaled by the root font size and by zoom; below
    // one layout unit it rounds to 0 and the grid shrinks to its content.
    const scaled: readonly {
      readonly name: string;
      readonly scale: (page: Page) => Promise<void>;
    }[] = [
      {
        name: 'a 10px root font size',
        scale: async (page) => {
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '10px';
          });
        },
      },
      {
        name: '90% CSS zoom',
        scale: async (page) => {
          await page
            .locator('docs-example-container')
            .nth(3)
            .locator('.example-container__preview')
            .evaluate((element: HTMLElement) => {
              element.style.zoom = '0.9';
            });
        },
      },
    ];
    for (const { name, scale } of scaled) {
      test(`example 4 — the grid still fills the table at ${name}`, async ({
        mlv,
        page,
      }) => {
        await mlv.goto(tableManifest.route);
        await scale(page);
        const table = await measure(await responsiveTable(page, 4));

        expect(misalignedCells(table)).toEqual([]);
        expect(
          Math.abs(gridEnd(table) - table.clientWidth),
        ).toBeLessThanOrEqual(TOLERANCE);
        expect(table.scrollWidth).toBeLessThanOrEqual(table.clientWidth);
      });
    }

    test('example 3 — a cell keeps the line breaks of an inherited pre-line', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(tableManifest.route);
      await mlv
        .example(3)
        .locator('.example-container__preview')
        .evaluate((element: HTMLElement) => {
          element.style.whiteSpace = 'pre-line';
        });
      const locator = await responsiveTable(page, 3);
      await locator.evaluate((element: HTMLTableElement) => {
        element.tBodies[0].rows[0].cells[0].textContent =
          '12 Main Street\nSpringfield';
      });
      const table = await measure(locator);

      // The authored break survives; the cells still do not wrap on their own.
      expect(table.rows[1][0].lines).toBe(2);
      expect(wrappedCells(table)).toEqual(['row 1 cell 1']);
      expect(misalignedCells(table)).toEqual([]);
    });

    test('example 3 — a table nested in a cell gets no fill cell of its own', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(tableManifest.route);
      const locator = await responsiveTable(page, 3);
      const nestedRowAfter = await locator.evaluate(
        (element: HTMLTableElement) => {
          const cell = element.tBodies[0].rows[0].cells[0];
          cell.innerHTML =
            '<table><tbody><tr><td>Part</td><td>2</td></tr></tbody></table>';
          const row = cell.querySelector('tr');
          return row ? getComputedStyle(row, '::after').content : null;
        },
      );

      expect(nestedRowAfter).toBe('none');
      expect(misalignedCells(await measure(locator))).toEqual([]);
    });
  });

  test.describe('responsive Pop In — below the 48rem breakpoint', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('example 4 — cards wrap their text, drop the fill cell and never overflow', async ({
      mlv,
      page,
    }) => {
      await mlv.goto(tableManifest.route);
      const locator = await responsiveTable(page, 4);
      const table = await measure(locator);

      expect(table.scrollWidth).toBeLessThanOrEqual(
        table.clientWidth + TOLERANCE,
      );
      const secondary = table.rows.filter(
        (row) => row.length === 1 && row[0].colSpan === 3,
      );
      expect(secondary.length).toBe(3);
      for (const [cell] of secondary) {
        expect(cell.lines).toBeGreaterThan(1);
        expect(cell.scrollWidth).toBeLessThanOrEqual(
          cell.clientWidth + TOLERANCE,
        );
      }

      const rowAfter = await locator.evaluate((element: HTMLTableElement) =>
        [...element.tBodies[0].rows].map(
          (row) => getComputedStyle(row, '::after').content,
        ),
      );
      expect(new Set(rowAfter)).toEqual(new Set(['none']));
    });
  });
});
