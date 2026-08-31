import type { MlvDataTableColumn } from '../types';

/** Internal row shape used while flattening tree data. */
export type MlvDataRow = object & {
  _mlvChildren?: MlvDataRow[];
  _mlvDepth?: number;
  _mlvRef?: MlvDataRow;
};

/** Internal column state enriched with measured layout information. */
export interface MlvColumnState extends MlvDataTableColumn {
  _currentWidth?: number;
  _left?: number;
  _right?: number;
  _visible?: boolean;
}

/** Returns the original row reference used for expansion identity. */
export function originalRow(row: MlvDataRow): MlvDataRow {
  return row['_mlvRef'] ?? row;
}

/** Recursively flattens expanded tree rows into render order. */
export function flattenRows(
  rows: MlvDataRow[],
  expanded: Set<MlvDataRow>,
  depth = 0,
): MlvDataRow[] {
  const result: MlvDataRow[] = [];
  for (const row of rows) {
    const original = originalRow(row);
    result.push({ ...row, _mlvDepth: depth, _mlvRef: original });
    const children = original['_mlvChildren'];
    if (expanded.has(original) && children?.length) {
      result.push(...flattenRows(children, expanded, depth + 1));
    }
  }
  return result;
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
