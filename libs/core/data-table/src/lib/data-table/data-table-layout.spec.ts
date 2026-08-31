import { describe, expect, it } from 'vitest';
import type { MlvDataTableColumn } from '../types';
import {
  columnCellStyles,
  columnWidthStyles,
  flattenRows,
  isColumnVisible,
  originalRow,
  parsePixelWidth,
  type MlvColumnState,
  type MlvDataRow,
} from './data-table-layout';

describe('data-table layout helpers', () => {
  it('flattens only expanded descendants and preserves source identity', () => {
    const child: MlvDataRow = { id: 'child' };
    const parent: MlvDataRow = { id: 'parent', _mlvChildren: [child] };
    const flattened = flattenRows([parent], new Set([parent]));

    expect(flattened.map((row) => row['_mlvDepth'])).toEqual([0, 1]);
    expect(originalRow(flattened[0])).toBe(parent);
    expect(originalRow(flattened[1])).toBe(child);
  });

  it('resolves responsive visibility in ascending breakpoint order', () => {
    const column = {
      key: 'name',
      label: 'Name',
      responsive: { default: 'hidden', 640: 'visible', 900: 'hidden' },
    } as MlvDataTableColumn;

    expect(isColumnVisible(column, 320)).toBe(false);
    expect(isColumnVisible(column, 700)).toBe(true);
    expect(isColumnVisible(column, 1000)).toBe(false);
  });

  it('builds measured width and sticky offset styles', () => {
    const column: MlvColumnState = {
      key: 'name',
      label: 'Name',
      pinned: true,
      pinSide: 'right',
      _currentWidth: 180,
    };

    expect(columnWidthStyles(column)).toEqual({
      width: '180px',
      'min-width': '180px',
      'max-width': '180px',
    });
    expect(columnCellStyles(column, new Map([['name_right', '12px']]))).toEqual(
      {
        width: '180px',
        'min-width': '180px',
        'max-width': '180px',
        position: 'sticky',
        'z-index': '2',
        right: 'calc(12px + var(--mlv-dt-pinned-right-correction, 0px))',
      },
    );
  });

  it('parses only complete CSS pixel widths', () => {
    expect(parsePixelWidth('160px')).toBe(160);
    expect(parsePixelWidth(' 160.5PX ')).toBe(160.5);
    expect(parsePixelWidth('10rem')).toBeUndefined();
    expect(parsePixelWidth('50%')).toBeUndefined();
    expect(parsePixelWidth('160')).toBeUndefined();
    expect(parsePixelWidth('160px trailing')).toBeUndefined();
    expect(parsePixelWidth('-10px')).toBeUndefined();
    expect(parsePixelWidth('auto')).toBeUndefined();
    expect(parsePixelWidth(undefined)).toBeUndefined();
  });

  it('includes a declared maximum in column width styles', () => {
    expect(
      columnWidthStyles({
        key: 'name',
        width: '12rem',
        minWidth: '6rem',
        maxWidth: '20rem',
      }),
    ).toEqual({
      width: '12rem',
      'min-width': '6rem',
      'max-width': '20rem',
    });
  });
});
