import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import { mlvNextId } from '@malva-ui/cdk/utils';
import type { MlvFieldsetColumns, MlvFormGap } from '../form.types';
import { mlvFormGapValue } from '../form-gap';

/**
 * @internal Accepts `'auto'`, a positive integer, or a numeric string
 * (`columns="2"`); anything else falls back to `'auto'`.
 */
function coerceColumns(value: MlvFieldsetColumns | string): MlvFieldsetColumns {
  if (value === 'auto' || value === '') return 'auto';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 'auto';
}

/**
 * Group of related controls on a native `<fieldset>`: styled legend, optional
 * description (wired to `aria-describedby`), and a responsive grid body.
 *
 * - `columns='auto'` (default): auto-fit columns of at least `minColumnWidth`.
 * - `columns=n`: **at most** `n` columns; still collapses when the container is
 *   narrower than `n × minColumnWidth`.
 * - Gap inherits the surrounding `form[mlvForm]` rhythm (`--mlv-form-gap`);
 *   `gap` overrides it for this fieldset and nested ones.
 * - Rich headings: project a native `<legend>` instead of the `legend` input
 *   (the input wins when both are present).
 *
 * @example
 * ```html
 * <fieldset mlvFieldset legend="Address" description="Where we ship." [columns]="2">
 *   <mlv-input label="Street" mlvFieldsetSpan="full" />
 *   <mlv-input label="City" />
 *   <mlv-input label="Postal code" />
 * </fieldset>
 * ```
 */
@Component({
  // Attribute-selector component on the native element it enhances.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'fieldset[mlvFieldset]',
  templateUrl: './fieldset.html',
  styleUrl: './fieldset.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-fieldset',
    '[attr.id]': 'id()',
    '[class.mlv-fieldset--capped]': '_capped()',
    '[style.--mlv-fieldset-columns]': '_capped() ? columns() : null',
    '[style.--mlv-fieldset-min-column-width]': 'minColumnWidth()',
    '[style.--mlv-form-gap]': '_gapValue()',
    '[attr.aria-describedby]': '_describedBy()',
  },
})
export class MlvFieldset {
  /** Element id; auto-generated (`mlv-fieldset-<n>`) unless bound. Seeds the description id. */
  readonly id = input<string>(mlvNextId('mlv-fieldset'));

  /** Group heading rendered as `<legend class="mlv-fieldset__legend">`. Omit and project a native `<legend>` for rich content. */
  readonly legend = input<string | undefined>(undefined);

  /** Help text rendered under the legend and announced via `aria-describedby`. */
  readonly description = input<string | undefined>(undefined);

  /** `'auto'` (responsive auto-fit) or a maximum column count. Numeric strings are accepted. */
  readonly columns = input<MlvFieldsetColumns, MlvFieldsetColumns | string>(
    'auto',
    { transform: coerceColumns },
  );

  /** Smallest inline size a column may shrink to before the grid drops a column. */
  readonly minColumnWidth = input<string>('10rem');

  /** Explicit gap for this fieldset (and nested ones); unset = inherited form rhythm / density default. */
  readonly gap = input<MlvFormGap | undefined>(undefined);

  /** @internal Whether `columns` is a number (capped grid). */
  protected readonly _capped = computed(
    () => typeof this.columns() === 'number',
  );

  /** @internal Id of the description paragraph, `<id>-description`. */
  protected readonly _descriptionId = computed(
    () => `${this.id()}-description`,
  );

  /**
   * @private A static `aria-describedby` authored by the consumer, read once at
   * construction (before the host binding takes the attribute over). `null` when
   * absent or blank. A *bound* `[attr.aria-describedby]` is not supported — the
   * host binding owns the attribute from the first change detection run.
   */
  private readonly _authoredDescribedBy =
    (
      inject(ElementRef<HTMLElement>).nativeElement.getAttribute(
        'aria-describedby',
      ) ?? ''
    ).trim() || null;

  /**
   * @internal Host `aria-describedby`: the rendered description id (when
   * `description` is set) merged with any consumer-authored value, `null` when
   * neither is present.
   */
  protected readonly _describedBy = computed(() => {
    const parts = [
      this.description() ? this._descriptionId() : null,
      this._authoredDescribedBy,
    ].filter((part): part is string => !!part);
    return parts.length ? parts.join(' ') : null;
  });

  /** @internal Inline `--mlv-form-gap` value, `null` when unset. */
  protected readonly _gapValue = computed(() => {
    const gap = this.gap();
    return gap ? mlvFormGapValue(gap) : null;
  });
}
