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
        '--mlv-dt-pinned-inset':
          'calc(12px + var(--mlv-dt-pinned-end-correction, 0px))',
      },
    );
  });

  // The offset is a running sum of logical widths from the pinned edge, so it
  // must not be written to a physical inset: `left: X` on a start-pinned cell
  // is the scroll-end side of an RTL scroller and the cell scrolls away (#341).
  // The stylesheet puts the custom property on the physical side the cell's
  // own `:dir()` resolves to (see `data-table-pinned-rtl.spec.ts`).
  it.each([
    ['left', 'name_left', 'start'],
    ['right', 'name_right', 'end'],
    [undefined, 'name_left', 'start'],
  ] as const)(
    'emits a direction-free sticky offset for pinSide %s',
    (pinSide, offsetKey, edge) => {
      const column: MlvColumnState = {
        key: 'name',
        label: 'Name',
        pinned: true,
        pinSide,
      };

      const styles = columnCellStyles(column, new Map([[offsetKey, '40px']]));

      expect(styles['--mlv-dt-pinned-inset']).toBe(
        `calc(40px + var(--mlv-dt-pinned-${edge}-correction, 0px))`,
      );
      for (const inset of [
        'left',
        'right',
        'inset-inline-start',
        'inset-inline-end',
      ]) {
        expect(Object.keys(styles)).not.toContain(inset);
      }
    },
  );

  it('writes no sticky offset for an unpinned column', () => {
    const column: MlvColumnState = { key: 'name', label: 'Name' };

    expect(
      Object.keys(columnCellStyles(column, new Map([['name_left', '40px']]))),
    ).not.toContain('--mlv-dt-pinned-inset');
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
