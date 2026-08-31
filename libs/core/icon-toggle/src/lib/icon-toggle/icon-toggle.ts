import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { MlvTone } from '@malva-ui/cdk/utils';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';

/**
 * Chromeless, glyph-only WAI-ARIA toggle button (visual-language spec AB-R7).
 *
 * Wraps exactly one projected Lucide `<svg>` and expresses `pressed` purely
 * through the glyph itself — an outlined icon at rest, a "tiny fill" on
 * hover, and a full `fill: currentColor` when pressed. There is **no
 * background in any state**; a design that needs a filled/tinted toggle
 * affordance should reach for `mlv-button-toggle` instead. Because the fill
 * mechanism relies on the glyph having an enclosed shape, it only reads
 * correctly for icons like a star, heart, bookmark, or pin — not for
 * open-stroke glyphs.
 *
 * Enhances a native `<button>` (`.claude/rules/angular-component.md` §
 * Selectors — the attribute-selector-on-native-element pattern), so native
 * `disabled`, `type`, and click/keyboard activation semantics all work
 * unmodified. The pointer target is held at a minimum of `1.5rem` (24px —
 * WCAG 2.2 SC 2.5.8) via density-aware padding, never by inflating the
 * glyph.
 *
 * @example
 * ```html
 * <!-- Neutral toggle, no tone -->
 * <button mlvIconToggle type="button" [(pressed)]="bookmarked" aria-label="Bookmark">
 *   <svg lucideBookmark [size]="16" aria-hidden="true" />
 * </button>
 *
 * <!-- `tone` recolours only the pressed glyph -->
 * <button
 *   mlvIconToggle
 *   type="button"
 *   tone="warning"
 *   [pressed]="ticket.starred"
 *   aria-label="Star conversation"
 *   (pressedChange)="toggleStar()"
 * >
 *   <svg lucideStar [size]="16" aria-hidden="true" />
 * </button>
 * ```
 */
@Component({
  // Attribute-selector component enhancing a native <button> — the
  // documented button[mlvButton] pattern (see .claude/rules/angular-component.md).
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[mlvIconToggle]',
  template: '<ng-content />',
  styleUrl: './icon-toggle.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity: mlvDensity'],
    },
  ],
  providers: [
    {
      provide: MLV_DENSITY_ELEMENT,
      useValue: 'icon-toggle',
    },
  ],
  host: {
    class: 'mlv-icon-toggle',
    '[class.mlv-icon-toggle--pressed]': 'pressed()',
    '[class]': '_toneClass()',
    '[attr.aria-pressed]': 'pressed()',
    '[attr.disabled]': 'disabled() || null',
    '[attr.aria-disabled]': 'disabled() || null',
    '(click)': '_handleClick()',
  },
})
export class MlvIconToggle {
  /**
   * Two-way bindable pressed state, reflected as `aria-pressed` on the
   * native button. Bind one-way (`[pressed]` + `(pressedChange)`) when the
   * caller owns the source of truth and the toggle must never write its own
   * model behind that owner's back — see `mlv-button-toggle` for the same
   * convention.
   */
  readonly pressed = model(false);

  /**
   * Optional semantic tone. Recolours only the **pressed** glyph to the
   * matching semantic text token (e.g. `tone="warning"` → `--mlv-text-warning`
   * for a favourite star). Rest and hover stay neutral regardless of tone —
   * a tone marks state, it never paints a surface. Defaults to `undefined`,
   * which keeps the pressed glyph in `currentColor`.
   */
  readonly tone = input<MlvTone | undefined>(undefined);

  /** Whether the native button is disabled. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * @protected The `--tone-*` BEM modifier class for the current `tone`, or
   * an empty string when no tone is set.
   */
  protected readonly _toneClass = computed(() =>
    this.tone() ? `mlv-icon-toggle--tone-${this.tone()}` : '',
  );

  /**
   * @protected Flips `pressed` on click unless the control is disabled.
   * Keyboard activation (Enter/Space) reaches this the same way — the host
   * is a real `<button>`, so the browser translates both keys into a native
   * `click` event with no extra keydown handling required.
   */
  protected _handleClick(): void {
    if (this.disabled()) return;
    this.pressed.update((pressed) => !pressed);
  }
}
