import {
  mlvEditorTableGeometry,
  type MlvEditorTableBox,
} from './editor-table-geometry';

/** A 2 x 2 table at (100, 200) whose cells are 80 x 30, inside a layer at (50, 60). */
const LAYER: MlvEditorTableBox = { top: 60, left: 50, width: 800, height: 600 };
const TABLE: MlvEditorTableBox = { top: 200, left: 100, width: 160, height: 60 };
const SECOND_CELL: MlvEditorTableBox = {
  top: 230,
  left: 180,
  width: 80,
  height: 30,
};

describe('mlvEditorTableGeometry', () => {
  it('places the grips outside the table edges in layer coordinates', () => {
    const geometry = mlvEditorTableGeometry({
      cell: SECOND_CELL,
      table: TABLE,
      layer: LAYER,
      scale: 1,
      gripSize: 12,
    });

    // The row grip hugs the table's start edge and spans only the hovered row.
    expect(geometry.row).toEqual({
      top: 170,
      left: 38,
      width: 12,
      height: 30,
    });
    // The column grip sits above the table and spans only the hovered column.
    expect(geometry.column).toEqual({
      top: 128,
      left: 130,
      width: 80,
      height: 12,
    });
    expect(geometry.corner).toEqual({
      top: 128,
      left: 38,
      width: 12,
      height: 12,
    });
  });

  it('divides the layer scale out once and keeps the grip thickness fixed', () => {
    const geometry = mlvEditorTableGeometry({
      cell: SECOND_CELL,
      table: TABLE,
      layer: LAYER,
      scale: 2,
      gripSize: 12,
    });

    // Every measured length halves...
    expect(geometry.row.height).toBe(15);
    expect(geometry.column.width).toBe(40);
    expect(geometry.row.top).toBe(85);
    // ...while the grip keeps its authored thickness, so it renders the same
    // size on screen at every zoom level.
    expect(geometry.row.width).toBe(12);
    expect(geometry.column.height).toBe(12);
    // (100 - 50) / 2 = 25, the table's start edge in layer space, minus the
    // grip's own unscaled thickness.
    expect(geometry.row.left).toBe(13);
  });

  it('treats a collapsed layer scale as 1 rather than dividing by zero', () => {
    const geometry = mlvEditorTableGeometry({
      cell: SECOND_CELL,
      table: TABLE,
      layer: LAYER,
      scale: 0,
      gripSize: 12,
    });

    expect(Number.isFinite(geometry.row.top)).toBe(true);
    expect(geometry.row.height).toBe(30);
  });
});
