/** A box in the zoom layer's own unscaled coordinate space. */
export interface MlvEditorTableBox {
  /** Distance from the layer's top edge, in unscaled pixels. */
  readonly top: number;

  /** Distance from the layer's start edge, in unscaled pixels. */
  readonly left: number;

  /** Unscaled width. */
  readonly width: number;

  /** Unscaled height. */
  readonly height: number;
}

/** Placement of the three grips that address one hovered table cell. */
export interface MlvEditorTableGeometry {
  /** Grip spanning the hovered row, sitting just outside the table's start edge. */
  readonly row: MlvEditorTableBox;

  /** Grip spanning the hovered column, sitting just above the table. */
  readonly column: MlvEditorTableBox;

  /** Square grip in the table's start-top corner, addressing the whole table. */
  readonly corner: MlvEditorTableBox;
}

/** Measurements `mlvEditorTableGeometry` derives the grip boxes from. */
export interface MlvEditorTableGeometryInput {
  /** Viewport rect of the hovered `td`/`th`. */
  readonly cell: MlvEditorTableBox;

  /** Viewport rect of the `table` the cell belongs to. */
  readonly table: MlvEditorTableBox;

  /** Viewport rect of the positioned zoom layer the grips are appended to. */
  readonly layer: MlvEditorTableBox;

  /**
   * Live scale of that layer. Viewport rects are scaled; the grips are laid out
   * inside the layer and scale with it, so every measurement is divided back
   * out exactly once here rather than at each use site.
   */
  readonly scale: number;

  /** Thickness of a grip, already in the layer's unscaled space. */
  readonly gripSize: number;
}

/**
 * Converts one viewport length into the layer's unscaled space.
 *
 * @param value Viewport-space offset from the layer's own edge.
 * @param scale Live layer scale; a zero or negative scale is treated as 1 so a
 * collapsed or not-yet-laid-out layer yields finite boxes instead of `Infinity`.
 */
function unscale(value: number, scale: number): number {
  return scale > 0 ? value / scale : value;
}

/**
 * Places the row, column and corner grips for one hovered cell.
 *
 * The grips live inside the zoom layer, so they inherit its scale: everything
 * below is expressed in the layer's unscaled coordinates, and `gripSize` is
 * subtracted **after** the conversion so a grip keeps the same rendered
 * thickness at every zoom level.
 *
 * @param input Viewport rects for the cell, its table and the layer, plus the
 * layer scale and the unscaled grip thickness.
 * @returns Boxes ready to write onto `top` / `left` / `width` / `height`.
 */
export function mlvEditorTableGeometry(
  input: MlvEditorTableGeometryInput,
): MlvEditorTableGeometry {
  const { cell, table, layer, scale, gripSize } = input;

  const cellTop = unscale(cell.top - layer.top, scale);
  const cellLeft = unscale(cell.left - layer.left, scale);
  const cellWidth = unscale(cell.width, scale);
  const cellHeight = unscale(cell.height, scale);

  const tableTop = unscale(table.top - layer.top, scale);
  const tableLeft = unscale(table.left - layer.left, scale);

  return {
    row: {
      top: cellTop,
      left: tableLeft - gripSize,
      width: gripSize,
      height: cellHeight,
    },
    column: {
      top: tableTop - gripSize,
      left: cellLeft,
      width: cellWidth,
      height: gripSize,
    },
    corner: {
      top: tableTop - gripSize,
      left: tableLeft - gripSize,
      width: gripSize,
      height: gripSize,
    },
  };
}
