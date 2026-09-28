import { Directive, input } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

/**
 * Structural directive responsible for rendering the card footer template
 * below the body. Pair it with `MlvCardFooter` on the same element:
 * `<div *mlvCardFooterDef mlvCardFooter>…</div>`.
 */
@Directive({
  selector: '[mlvCardFooterDef]',
})
export class MlvCardFooterDef extends MlvStructural {}

/**
 * Footer directive. Applies `mlv-card__footer` — a flex row pushed to the
 * bottom of the card — plus the modifiers below.
 */
@Directive({
  selector: '[mlvCardFooter]',
  host: {
    class: 'mlv-card__footer',
    '[class.mlv-card__footer--full-width]': 'fullWidth()',
    '[class.mlv-card__footer--border]': 'withBorder()',
  },
})
export class MlvCardFooter {
  /**
   * Draws a hairline divider along the footer's block-start edge
   * (`mlv-card__footer--border`: `--mlv-stroke-width`, `--mlv-border-normal` —
   * the in-surface divider token, one step stronger than the card's own
   * `--mlv-border-subtle` outline, which matches the card fill in dark).
   * Off by default — a footer has no divider unless this is set.
   */
  readonly withBorder = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Shares the footer's width equally between its direct children
   * (`mlv-card__footer--full-width`: `flex: 1` on each) — e.g. a single
   * full-width action, or a button pair of equal widths.
   */
  readonly fullWidth = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}
