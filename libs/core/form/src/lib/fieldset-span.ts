import { computed, Directive, input } from '@angular/core';

/** Column span of a fieldset grid child: a column count or the whole row. */
export type MlvFieldsetSpanValue = number | 'full';

/**
 * @internal `'full'` stays; positive numbers / numeric strings become the
 * count; anything else falls back to `'full'` (never overflows the grid).
 */
function coerceSpan(
  value: MlvFieldsetSpanValue | string,
): MlvFieldsetSpanValue {
  if (value === 'full') return 'full';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 'full';
}

/**
 * Makes a direct child of a `fieldset[mlvFieldset]` grid span several columns.
 *
 * `'full'` (`grid-column: 1 / -1`) is safe in every grid. A numeric span is
 * `grid-column: span n` — in an auto-fit grid that collapsed to fewer than `n`
 * columns it creates implicit columns and overflows, so prefer `'full'` there
 * and reserve numbers for `[columns]="n"` grids wide enough to hold them.
 *
 * @example
 * ```html
 * <fieldset mlvFieldset [columns]="2">
 *   <mlv-input label="Street" mlvFieldsetSpan="full" />
 *   <mlv-input label="City" />
 *   <mlv-input label="Postal code" />
 * </fieldset>
 * ```
 */
@Directive({
  selector: '[mlvFieldsetSpan]',
  host: { '[style.grid-column]': '_gridColumn()' },
})
export class MlvFieldsetSpan {
  /** Column span: a positive integer (also as a string) or `'full'` for the whole row. */
  readonly mlvFieldsetSpan = input.required<
    MlvFieldsetSpanValue,
    MlvFieldsetSpanValue | string
  >({ transform: coerceSpan });

  /** @internal Resolved `grid-column` value. */
  protected readonly _gridColumn = computed(() => {
    const span = this.mlvFieldsetSpan();
    return span === 'full' ? '1 / -1' : `span ${span}`;
  });
}
