import type { MlvDataTableColumn } from '../types';

/**
 * Internal row shape. `_mlvChildren` is the consumer's tree-row marker; the
 * table itself never adds a key to a row.
 */
export type MlvDataRow = object & {
  _mlvChildren?: MlvDataRow[];
};

/**
 * Render order of the (possibly expanded) tree, plus the depth of every row
 * rendered below the root level.
 */
export interface MlvFlatRows {
  /** Rows in render order — the consumer's own objects, never copies. */
  readonly rows: MlvDataRow[];
  /**
   * Tree depth of the row at each position of `rows` (0 for a root row), or
   * `null` when nothing is expanded and every row is a root row.
   */
  readonly depths: readonly number[] | null;
}

/** Internal column state enriched with measured layout information. */
export interface MlvColumnState extends MlvDataTableColumn {
  _currentWidth?: number;
  _left?: number;
  _right?: number;
  _visible?: boolean;
}

/**
 * Flattens expanded tree rows into render order without copying a row.
 *
 * With nothing expanded only the root rows render, so `rows` is handed back as
 * the same array: a sort, filter, search keystroke or page change costs no
 * allocation here. Otherwise a new array of the same row references is built,
 * with depth in a parallel array instead of a key stamped onto a copy — the
 * previous `{ ...row, _mlvDepth, _mlvRef }` copied every row on every recompute
 * (#297) and leaked both keys into every row the table handed out.
 *
 * Depth is positional, not a `Map` keyed by row: measured on a fully expanded
 * 100k-row tree, the walk alone takes ~1.6 ms, a `Map` adds ~4–5 ms on top and
 * the parallel array ~0.5 ms. Positional depth also stays right for a row
 * object listed at two tree positions at once.
 */
export function flattenRows(
  rows: MlvDataRow[],
  expanded: ReadonlySet<MlvDataRow>,
): MlvFlatRows {
  if (expanded.size === 0) return { rows, depths: null };

  const flat: MlvDataRow[] = [];
  const depths: number[] = [];
  // Pushes one row at a time: `flat.push(...children)` spreads into an
  // argument list, which overflows the stack on a very large child array.
  const visit = (level: readonly MlvDataRow[], depth: number): void => {
    for (const row of level) {
      flat.push(row);
      depths.push(depth);
      const children = row._mlvChildren;
      if (children?.length && expanded.has(row)) visit(children, depth + 1);
    }
  };
  visit(rows, 0);
  return { rows: flat, depths };
}

/** Resolves responsive column visibility at the supplied container width. */
export function isColumnVisible(
  column: MlvDataTableColumn,
  containerWidth: number,
): boolean {
  if (!column.responsive || containerWidth === 0) return true;
  const breakpoints = Object.keys(column.responsive)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let visibility: 'hidden' | 'visible' | null = null;
  for (const breakpoint of breakpoints) {
    if (containerWidth >= breakpoint) {
      visibility = column.responsive[breakpoint];
    }
  }
  if (visibility === null) {
    const fallback = Object.keys(column.responsive).find(
      (key) => !Number.isFinite(Number(key)),
    );
    if (fallback) visibility = column.responsive[fallback];
  }
  return visibility !== 'hidden';
}

/**
 * Parses a complete, non-negative CSS pixel width.
 *
 * Other CSS units deliberately return `undefined`; treating `12rem` or `50%`
 * as `12px`/`50px` would corrupt resize bounds and pinned-column offsets.
 */
export function parsePixelWidth(width: string | undefined): number | undefined {
  if (!width) return undefined;
  const match = width.trim().match(/^(?:\d+(?:\.\d+)?|\.\d+)px$/i);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Builds stable width styles for a table column. */
export function columnWidthStyles(
  column: MlvColumnState,
): Record<string, string> {
  const styles: Record<string, string> = {};
  if (column._currentWidth !== undefined) {
    styles['width'] = `${column._currentWidth}px`;
    styles['min-width'] = `${column._currentWidth}px`;
    styles['max-width'] = `${column._currentWidth}px`;
    return styles;
  }

  if (column.width) styles['width'] = column.width;
  if (column.minWidth) styles['min-width'] = column.minWidth;
  if (column.maxWidth) styles['max-width'] = column.maxWidth;
  return styles;
}

/** Adds sticky pin offsets to the base column width styles. */
export function columnCellStyles(
  column: MlvColumnState,
  offsets: Map<string, string>,
): Record<string, string> {
  const styles = columnWidthStyles(column);
  if (!column.pinned) return styles;
  styles['position'] = 'sticky';
  styles['z-index'] = '2';
  const side = column.pinSide === 'right' ? 'right' : 'left';
  const offset = offsets.get(`${column.key}_${side}`) ?? '0px';
  styles[side] =
    `calc(${offset} + var(--mlv-dt-pinned-${side}-correction, 0px))`;
  return styles;
}
