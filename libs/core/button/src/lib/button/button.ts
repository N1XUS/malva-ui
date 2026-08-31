import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MlvButtonAfter,
  MlvButtonBefore,
  MlvButtonIcon,
} from '../button.directives';
import { NgTemplateOutlet } from '@angular/common';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { MlvLoader } from '@malva-ui/core/loader';
import type { MlvButtonShape, MlvButtonVariant } from '../button.types';
import { MLV_BUTTON_VARIANT } from '../button-variant.token';

export type { MlvButtonShape, MlvButtonVariant } from '../button.types';

/**
 * Shapes whose width equals their height. They exist to hold a single icon, so
 * they drive both the icon-only sizing and the neutral default variant.
 */
const ICON_ONLY_SHAPES: readonly MlvButtonShape[] = ['circle', 'square'];

@Component({
  // Attribute-selector component — camelCase [mlvX] is the documented pattern
  // (see .claude/rules/angular-component.md); the rule only models kebab-case.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[mlvButton], a[mlvButton]',
  templateUrl: './button.html',
  styleUrl: './button.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, MlvLoader],
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity: mlvDensity'],
    },
  ],
  providers: [
    {
      provide: MLV_DENSITY_ELEMENT,
      useValue: 'button',
    },
  ],
  host: {
    class: 'mlv-button',
    '[class]':
      '"mlv-button--variant-" + effectiveVariant() + " mlv-button--shape-" + shape()',
    '[class.mlv-button--disabled]': 'disabled()',
    '[class.mlv-button--loading]': 'loading()',
    '[class.mlv-button--selected]': 'selected()',
    '[class.mlv-button--icon-only]': '_iconOnly()',
    '[attr.disabled]': '(disabled() || loading()) || null',
    '[attr.aria-disabled]': '(disabled() || loading()) || null',
    '[attr.aria-busy]': 'loading() || null',
    '(click)': '_handleClick($event)',
  },
})
export class MlvButton {
  /**
   * Visual treatment for this button. When omitted, the closest button group,
   * split button, or toggle supplies it; otherwise the fallback depends on the
   * shape — `secondary` for the icon-only `square`/`circle` shapes and
   * `primary` for every other shape.
   */
  readonly variant = input<MlvButtonVariant | undefined>(undefined);

  /** Shape of the button. Circle and square are intended for icon-only actions. */
  readonly shape = input<MlvButtonShape>('default');

  /** Whether the native button is disabled. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Whether the button is waiting for an asynchronous action to complete. */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether the button reflects a persistent selected state — an active
   * formatting menu trigger, a chosen view. Paints the same surface as a
   * pressed toggle while adding no ARIA of its own, so a menu button keeps
   * `aria-haspopup`/`aria-expanded` as its only state semantics. A real toggle
   * sets `aria-pressed` instead, which paints identically.
   */
  readonly selected = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** @private Optional ancestor-provided default visual treatment. */
  private readonly _variantAccessor = inject(MLV_BUTTON_VARIANT, {
    optional: true,
  });

  /**
   * The visual treatment after resolving local, inherited, and default values.
   *
   * The final fallback is shape-aware: a bare `square`/`circle` button is an
   * icon action, and rendering a row of them as saturated `primary` CTAs was
   * never the intent, so they fall back to the neutral `secondary` treatment.
   * An explicit `variant` and an ancestor `MLV_BUTTON_VARIANT` both still win.
   */
  readonly effectiveVariant = computed<MlvButtonVariant>(
    () =>
      this.variant() ??
      this._variantAccessor?.effectiveVariant() ??
      (this._iconShape() ? 'secondary' : 'primary'),
  );

  /** @protected Whether `shape` is one of the square/circle icon-only shapes. */
  protected readonly _iconShape = computed(() =>
    ICON_ONLY_SHAPES.includes(this.shape()),
  );

  /**
   * @protected True for a circle/square button whose content is only an icon —
   * either marked with `mlvButtonIcon` or inferred from an empty label slot.
   * Drives the icon-only modifier.
   */
  protected readonly _iconOnly = computed(
    () =>
      this._iconShape() &&
      (!!this._iconDirective() || !this._hasProjectedText()),
  );

  /** @protected Template slot rendered before the button text. */
  protected readonly beforeRef = contentChild(MlvButtonBefore);

  /** @protected Template slot rendered after the button text. */
  protected readonly afterRef = contentChild(MlvButtonAfter);

  /** @private Projected icon directive, used to detect icon-only buttons. */
  private readonly _iconDirective = contentChild(MlvButtonIcon);

  /** @private The label slot, read back after render to detect icon-only content. */
  private readonly _textRef =
    viewChild.required<ElementRef<HTMLElement>>('textRef');

  /**
   * @private Whether the default content slot rendered any non-whitespace text.
   *
   * Starts `true` so a button that never reaches a browser render — server-side
   * rendering, where `afterRenderEffect` does not run — keeps the pre-inference
   * behaviour instead of guessing icon-only.
   */
  private readonly _hasProjectedText = signal(true);

  constructor() {
    // `mlvButtonIcon` is optional in practice: icon buttons are overwhelmingly
    // written as `<button mlvButton shape="circle"><svg lucideX /></button>`,
    // and without the directive nothing marked them icon-only, so the icon kept
    // its intrinsic size inside the label slot. The slot holds projected
    // content, so the only way to know whether it carries real text is to read
    // it back once the DOM is written. The effect re-runs when the signals read
    // below change rather than on every render pass, which keeps this to one
    // `textContent` read per button per relevant change. Text that appears or
    // disappears inside an already-rendered icon-only button is not observed —
    // annotate the icon with `mlvButtonIcon` for that case.
    afterRenderEffect(() => {
      this.shape();
      this.loading();
      this._iconDirective();
      const text = this._textRef().nativeElement.textContent ?? '';
      this._hasProjectedText.set(text.trim().length > 0);
    });
  }

  /** @protected Prevents activation while the button is disabled or loading. */
  protected _handleClick(event: Event): void {
    if (this.disabled() || this.loading()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
