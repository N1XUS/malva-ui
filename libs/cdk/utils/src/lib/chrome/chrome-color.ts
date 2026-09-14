import {
  Directive,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  chooseContrastForeground,
  compositeColors,
  toCssColor,
} from './chrome-color.util';
import {
  resolveBackdropBackground,
  resolveCssColor,
} from './chrome-css-color.util';

/**
 * Paints an element as application chrome in an arbitrary colour and picks a
 * foreground that stays readable on it.
 *
 * A brand-coloured surface is the case every design system gets wrong twice:
 * once by asking the author to name the text colour as well, and once by
 * deriving it from a token map that cannot see a `var()` the consumer wrote.
 * This directive resolves the colour **in the host's own cascade** — so
 * `var(--brand-500)`, a `color-mix()`, a `light-dark()` or a bare keyword all
 * work — composites it over what is actually behind it when it is
 * translucent, and chooses the foreground by contrast ratio.
 *
 * It publishes both as custom properties so a stylesheet can build a whole
 * chrome ramp from them without re-deriving anything:
 *
 * | Property                  | Value                                        |
 * | ------------------------- | -------------------------------------------- |
 * | `--mlv-chrome-background` | The resolved background, as an opaque colour |
 * | `--mlv-chrome-foreground` | The foreground chosen for it                 |
 *
 * Both are absent — not empty — while no colour is set, so a stylesheet's
 * `var(…, fallback)` is what applies and the element keeps whatever it had.
 *
 * ```html
 * <nav mlvActionBar [mlvChromeColor]="brand()">…</nav>
 * <mlv-page-shell color="var(--brand-700)">…</mlv-page-shell>
 * ```
 *
 * The resolution re-runs when the colour inputs change and whenever anything
 * in the host's ancestor chain changes `class`, `style`, `data-theme` or
 * `mlvTheme` — a theme flip changes what a `var()` resolves to without
 * changing a single binding, which no signal can see.
 */
@Directive({
  selector: '[mlvChromeColor]',
  exportAs: 'mlvChromeColor',
  host: {
    '[style.--mlv-chrome-background]': 'background()',
    '[style.--mlv-chrome-foreground]': 'foreground()',
    '[style.background]': 'background()',
    '[style.color]': 'foreground()',
  },
})
export class MlvChromeColor {
  /**
   * The chrome background. Any CSS colour the host's own cascade can resolve,
   * including custom properties and `color-mix()`. `null` paints nothing.
   */
  readonly mlvChromeColor = input<string | null>(null);

  /**
   * Overrides the automatically chosen foreground. Set it only when the
   * contrast pick is wrong for a specific brand colour — the point of the
   * directive is that it is usually right.
   */
  readonly chromeForeground = input<string | null>(null);

  /**
   * The resolved background, as an opaque CSS colour, or `null` while no
   * colour is set. Read it to paint a matching surface elsewhere.
   */
  readonly background = signal<string | null>(null);

  /** The foreground chosen for {@link background}, or `null` with no colour. */
  readonly foreground = signal<string | null>(null);

  /** @private Host element; both the paint target and the cascade context. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Frame and observer cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Pending colour-resolution animation frame, if any. */
  private _frameId: number | null = null;

  /** @private Watches the ancestor chain for cascade-affecting changes. */
  private _mutationObserver: MutationObserver | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.mlvChromeColor();
      this.chromeForeground();
      this._startObserving();
      this._schedule();
    });

    this._destroyRef.onDestroy(() => {
      this._mutationObserver?.disconnect();
      const view = this._host.nativeElement.ownerDocument.defaultView;
      if (this._frameId !== null && view) {
        view.cancelAnimationFrame(this._frameId);
      }
    });
  }

  /**
   * @private Observes the host and every ancestor for attribute changes that
   * can change what a `var()` resolves to. One observer watches the whole
   * chain, so a theme flip anywhere above the host is seen exactly once.
   */
  private _startObserving(): void {
    if (this._mutationObserver) {
      return;
    }

    const host = this._host.nativeElement;
    const view = host.ownerDocument.defaultView;
    if (!view || typeof view.MutationObserver === 'undefined') {
      return;
    }

    this._mutationObserver = new view.MutationObserver(() => this._schedule());

    let current: HTMLElement | null = host;
    while (current) {
      this._mutationObserver.observe(current, {
        attributes: true,
        attributeFilter: [
          'class',
          'style',
          'mlvtheme',
          'mlvTheme',
          'data-theme',
        ],
      });
      current = current.parentElement;
    }
  }

  /** @private Coalesces the CSS reads and signal writes into one frame. */
  private _schedule(): void {
    if (this._frameId !== null) {
      return;
    }

    const view = this._host.nativeElement.ownerDocument.defaultView;
    if (!view) {
      return;
    }

    this._frameId = view.requestAnimationFrame(() => {
      this._frameId = null;
      this._resolve();
    });
  }

  /** @private Resolves both colours against the host's live cascade. */
  private _resolve(): void {
    const host = this._host.nativeElement;
    const background = resolveCssColor(host, this.mlvChromeColor());
    const explicitForeground = resolveCssColor(host, this.chromeForeground());

    this.background.set(background ? toCssColor(background) : null);

    if (explicitForeground) {
      this.foreground.set(toCssColor(explicitForeground));
      return;
    }

    if (!background) {
      this.foreground.set(null);
      return;
    }

    // A translucent chrome colour is readable against what is *behind* it, not
    // against itself: compositing first is what keeps the contrast pick honest
    // on a scrim, a glass bar or a tinted overlay.
    const effective =
      background.alpha < 1
        ? compositeColors(background, resolveBackdropBackground(host))
        : background;
    this.foreground.set(chooseContrastForeground(effective));
  }
}
