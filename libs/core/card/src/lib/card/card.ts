import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  contentChild,
  input,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { NgTemplateOutlet } from '@angular/common';
import { MlvCardHeaderDef } from '../card-header-def';
import { MlvCardSubheaderDef } from '../card-subheader-def';
import { MlvCardActionsDef } from '../card-actions-def';
import { MlvCardFooterDef } from '../card-footer-def';

export type MlvCardSize = 's' | 'm' | 'l';

/**
 * Layout applied to the card's projected body.
 *
 * - `'none'` — the body is a plain block; children lay themselves out.
 * - `'stack'` — the body becomes a vertical flex stack separated by
 *   `--mlv-card-body-gap`.
 */
export type MlvCardBodyLayout = 'none' | 'stack';

@Component({
  selector: 'mlv-card',
  imports: [NgTemplateOutlet],
  templateUrl: './card.html',
  styleUrl: './card.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-card',
    '[class]': '"mlv-card--size-" + size()',
    '[class.mlv-card--elevated]': 'elevated()',
    '[class.mlv-card--has-bg-image]': '!!backgroundImage()',
    '[style.--mlv-card-bg-image]':
      'backgroundImage() ? "url(" + backgroundImage() + ")" : null',
  },
})
export class MlvCard {
  /** Size preset controlling the card spacing, radius, and typography. */
  readonly size = input<MlvCardSize>('m');

  /** Whether the card uses the elevated visual treatment. */
  readonly elevated = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Optional background image URL rendered behind the card content. */
  readonly backgroundImage = input<string | null>(null);

  /**
   * Layout of the projected body. Defaults to `'none'`, which leaves the body
   * a plain block exactly as before.
   *
   * `'stack'` turns the body into a vertical stack separated by
   * `--mlv-card-body-gap` — a size-aware default that a consumer can override
   * per card. It replaces the wrapper `<div>` with its own `gap` that every
   * multi-child card used to hand-roll.
   */
  readonly bodyLayout = input<MlvCardBodyLayout>('none');

  /** @protected Header slot template projected via `[mlvCardHeader]`. */
  protected readonly headerRef = contentChild(MlvCardHeaderDef);
  /** @protected Subheader slot template projected via `[mlvCardSubheader]`. */
  protected readonly subheaderRef = contentChild(MlvCardSubheaderDef);
  /** @protected Actions slot template projected via `[mlvCardActions]`. */
  protected readonly actionsRef = contentChild(MlvCardActionsDef);
  /** @protected Footer slot template projected via `[mlvCardFooter]`. */
  protected readonly footerRef = contentChild(MlvCardFooterDef);
}
