import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  ElementRef,
  inject,
  input,
  output,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MlvDensityDirective,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';
import type { MlvTone } from '@malva-ui/cdk/utils';
import { LucideX } from '@lucide/angular';
import { MlvChipAppend, MlvChipPrepend } from './chip.directives';
import { MLV_CHIP_I18N } from '@malva-ui/i18n';
import { MlvButtonClose } from '@malva-ui/core/button';

/**
 * Available tone variants for the chip component.
 * Extends the shared {@link MlvTone} semantic vocabulary with neutral and
 * brand options, mapping to color tokens in the design system.
 */
export type MlvChipTone =
  | MlvTone
  | 'default'
  | 'primary'
  | 'secondary'
  | 'accent';

/**
 * Chip component for representing filterable tags, selected items, or categorized attributes.
 * Similar to badge but with richer interactivity: prepend/append slots, closable mode,
 * floating (elevated) variant, and full density system integration.
 *
 * When `animated` is `true`, enter and leave animations (opacity + scale + width) are enabled.
 * The leave animation completes before `chipClose` emits.
 *
 * @example
 * ```html
 * <mlv-chip tone="primary">Angular</mlv-chip>
 * <mlv-chip tone="success" muted closable animated (chipClose)="removeTag('done')">Done</mlv-chip>
 * <mlv-chip tone="accent" floating>
 *   <ng-template mlvChipPrepend><svg lucideStar [size]="12" /></ng-template>
 *   Featured
 * </mlv-chip>
 * ```
 */
@Component({
  selector: 'mlv-chip',
  templateUrl: './chip.html',
  styleUrl: './chip.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, LucideX, MlvButtonClose],
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'chip' }],
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity'],
    },
  ],
  host: {
    class: 'mlv-chip',
    '[class]': '"mlv-chip--tone-" + tone()',
    '[class.mlv-chip--muted]': 'muted()',
    '[class.mlv-chip--rounded]': 'rounded()',
    '[class.mlv-chip--floating]': 'floating()',
    '[class.mlv-chip--closable]': 'closable()',
    '[attr.tabindex]': 'closable() ? chipTabIndex() : null',
    '(keydown.backspace)': 'closable() && _handleKeyRemove($event)',
    '(keydown.delete)': 'closable() && _handleKeyRemove($event)',
  },
})
export class MlvChip {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_CHIP_I18N);

  /**
   * The semantic tone of the chip.
   * Determines the background and text colors.
   * Defaults to `'default'` (neutral).
   */
  readonly tone = input<MlvChipTone>('default');

  /**
   * When `true`, uses muted surface/text tokens instead of solid fill colors.
   * Muted chips are less visually prominent — suited for inline or secondary contexts.
   * Supports attribute usage: `<mlv-chip muted>`.
   */
  readonly muted = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, renders the chip with fully rounded (pill) corners.
   * Default shape uses `--mlv-radius-l` (slightly rounded).
   * Supports attribute usage: `<mlv-chip rounded>`.
   */
  readonly rounded = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, renders the chip with an elevated box-shadow, making it appear
   * to float above the page surface. Equivalent to the button's `elevated` variant.
   * Supports attribute usage: `<mlv-chip floating>`.
   */
  readonly floating = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, renders a close (×) button after all chip content.
   * Clicking it triggers the leave animation (if `animated`) before emitting `chipClose`.
   * Supports attribute usage: `<mlv-chip closable>`.
   */
  readonly closable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Configurable tabindex for the chip host. Defaults to `0` (focusable).
   * Set to `-1` when the parent (e.g., tokenizer) manages focus via FocusKeyManager.
   */
  readonly chipTabIndex = input<number>(0);

  /**
   * Optional override for the close button's `aria-label`. When `null` (default),
   * the generic i18n "Remove" label (`MLV_CHIP_I18N.remove`) is used. Set this to
   * a more descriptive value — e.g. `"Remove: Angular"` — so screen-reader users
   * know which item the close button removes when the same chip is one of many.
   */
  readonly closeAriaLabel = input<string | null>(null);

  /**
   * Emits after the leave animation completes when the user clicks the close button.
   * Only relevant when `closable` is `true`.
   */
  readonly chipClose = output<void>();

  /**
   * @protected Resolved accessible name for the close button. Prefers the
   * explicit {@link closeAriaLabel} override, falling back to the generic
   * i18n "Remove" string.
   */
  protected readonly _resolvedCloseAriaLabel = computed(
    () => this.closeAriaLabel() ?? this._i18n().remove,
  );

  /** @protected Template slot rendered before the chip label. */
  protected readonly _prependRef = contentChild(MlvChipPrepend);

  /** @protected Template slot rendered after the chip label (before the close button). */
  protected readonly _appendRef = contentChild(MlvChipAppend);

  /**
   * @protected Handles the close button click. When `animated` is true, sets `_leaving`
   * to trigger the CSS leave animation and defers `chipClose` until it completes.
   * When not animated, emits `chipClose` immediately.
   * Prevents event propagation so the chip's container doesn't receive the click.
   */
  protected _handleClose(event: Event): void {
    event.stopPropagation();
    this.chipClose.emit();
  }

  /**
   * @protected Handles Backspace/Delete key to remove a closable chip.
   * Emits `chipClose` and prevents default to avoid browser back navigation.
   */
  protected _handleKeyRemove(event: Event): void {
    event.preventDefault();
    this.chipClose.emit();
  }

  /** @private Host element reference, exposed publicly via the `element` getter. */
  private readonly _elementRef = inject(ElementRef);

  get element(): HTMLElement {
    return this._elementRef.nativeElement;
  }
}
