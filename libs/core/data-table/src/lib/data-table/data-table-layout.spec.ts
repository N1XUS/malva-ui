import { describe, expect, it } from 'vitest';
import type { MlvDataTableColumn } from '../types';
import {
  columnCellStyles,
  columnWidthStyles,
  flattenRows,
  isColumnVisible,
  parsePixelWidth,
  type MlvColumnState,
  type MlvDataRow,
} from './data-table-layout';

describe('data-table layout helpers', () => {
  it('flattens only expanded descendants, in order, as the source objects themselves', () => {
    const grandchild: MlvDataRow = { id: 'grandchild' };
    const child: MlvDataRow = { id: 'child', _mlvChildren: [grandchild] };
    const collapsedChild: MlvDataRow = { id: 'hidden' };
    const parent: MlvDataRow = { id: 'parent', _mlvChildren: [child] };
    const sibling: MlvDataRow = {
      id: 'sibling',
      _mlvChildren: [collapsedChild],
    };
    const source = [parent, sibling];

    const { rows, depths } = flattenRows(source, new Set([parent, child]));

    expect(rows).toEqual([parent, child, grandchild, sibling]);
    rows.forEach((row, index) =>
      expect(row).toBe([parent, child, grandchild, sibling][index]),
    );
    expect(depths).toEqual([0, 1, 2, 0]);
    // No key is stamped onto a row: the source objects are untouched.
    expect(Object.keys(child)).toEqual(['id', '_mlvChildren']);
    expect(source).toEqual([parent, sibling]);
  });

  it('hands back the input array itself when nothing is expanded (#297)', () => {
    const source: MlvDataRow[] = [
      { id: 'a', _mlvChildren: [{ id: 'a1' }] },
      { id: 'b' },
    ];

    const { rows, depths } = flattenRows(source, new Set());

    expect(rows).toBe(source);
    expect(depths).toBeNull();
  });

  it('expands a node with more children than an argument list can spread', () => {
    // Spreading a child array into `push(...)` passes every child as an
    // argument, so it throws RangeError past the engine's argument limit.
    // That limit is stack-dependent: ~120k in plain node, but a vitest worker
    // has a larger stack and still accepts 200k. One million children throws
    // in both — proven by restoring the spread (#297 round 2).
    const count = 1_000_000;
    const children: MlvDataRow[] = Array.from({ length: count }, (_, id) => ({
      id,
    }));
    const parent: MlvDataRow = { id: 'parent', _mlvChildren: children };

    const { rows, depths } = flattenRows([parent], new Set([parent]));

    expect(rows.length).toBe(count + 1);
    expect(rows[count]).toBe(children[count - 1]);
    expect(depths?.[0]).toBe(0);
    expect(depths?.[count]).toBe(1);
  });

  it('reports depth per position for a row object listed twice', () => {
    const shared: MlvDataRow = { id: 'shared' };
    const parent: MlvDataRow = { id: 'parent', _mlvChildren: [shared] };

    const { rows, depths } = flattenRows([shared, parent], new Set([parent]));

    expect(rows).toEqual([shared, parent, shared]);
    expect(depths).toEqual([0, 0, 1]);
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
