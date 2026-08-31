import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  chooseContrastForeground,
  compositeColors,
  toCssColor,
} from './page-shell-color';
import {
  resolveBackdropBackground,
  resolveCssColor,
} from './page-shell-css-color';

/**
 * Application-page shell that joins global top navigation, one or two sidebars,
 * and the Page canvas without taking ownership of their component behaviour.
 */
@Component({
  selector: 'mlv-page-shell',
  templateUrl: './page-shell.html',
  styleUrl: './page-shell.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-shell',
    '[style.--mlv-page-shell-resolved-background]': '_resolvedBackground()',
    '[style.--mlv-page-shell-resolved-foreground]': '_resolvedForeground()',
    '[style.background]': '_resolvedBackground()',
    '[style.color]': '_resolvedForeground()',
  },
})
export class MlvPageShell {
  /**
   * Optional CSS color for the shell chrome background.
   * Browser-resolved values such as `var(--brand-color)` are supported.
   */
  readonly color = input<string | null>(null);

  /**
   * Optional CSS color overriding the automatically selected chrome foreground.
   */
  readonly foreground = input<string | null>(null);

  /** @protected Browser-resolved background applied through the host style. */
  protected readonly _resolvedBackground = signal<string | null>(null);

  /** @protected Browser-resolved foreground applied through the host style. */
  protected readonly _resolvedForeground = signal<string | null>(null);

  /** @private Native shell host used as the CSS inheritance context. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Angular destruction hook for frame and observer cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Identifier of the pending color-resolution animation frame. */
  private _resolutionFrameId: number | null = null;

  /** @private Watches theme and custom-property changes in the shell cascade. */
  private _mutationObserver: MutationObserver | null = null;

  constructor() {
    afterRenderEffect(() => {
      this.color();
      this.foreground();
      this._startColorObservation();
      this._scheduleColorResolution();
    });

    this._destroyRef.onDestroy(() => {
      this._mutationObserver?.disconnect();
      const view = this._host.nativeElement.ownerDocument.defaultView;
      if (this._resolutionFrameId !== null && view) {
        view.cancelAnimationFrame(this._resolutionFrameId);
      }
    });
  }

  /**
   * @private Observes the shell and its ancestors for cascade-affecting
   * attribute changes. One observer can watch every node in the chain.
   */
  private _startColorObservation(): void {
    if (this._mutationObserver) {
      return;
    }

    const host = this._host.nativeElement;
    const view = host.ownerDocument.defaultView;
    if (!view || typeof view.MutationObserver === 'undefined') {
      return;
    }

    this._mutationObserver = new view.MutationObserver(() => {
      this._scheduleColorResolution();
    });

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

  /**
   * @private Coalesces CSS reads and signal writes into the next render frame.
   */
  private _scheduleColorResolution(): void {
    if (this._resolutionFrameId !== null) {
      return;
    }

    const view = this._host.nativeElement.ownerDocument.defaultView;
    if (!view) {
      return;
    }

    this._resolutionFrameId = view.requestAnimationFrame(() => {
      this._resolutionFrameId = null;
      this._resolveColors();
    });
  }

  /**
   * @private Resolves the input colors and updates the internal host variables.
   */
  private _resolveColors(): void {
    const host = this._host.nativeElement;
    const background = resolveCssColor(host, this.color());
    const explicitForeground = resolveCssColor(host, this.foreground());

    this._resolvedBackground.set(background ? toCssColor(background) : null);

    if (explicitForeground) {
      this._resolvedForeground.set(toCssColor(explicitForeground));
      return;
    }

    if (!background) {
      this._resolvedForeground.set(null);
      return;
    }

    const effectiveBackground =
      background.alpha < 1
        ? compositeColors(background, resolveBackdropBackground(host))
        : background;
    this._resolvedForeground.set(chooseContrastForeground(effectiveBackground));
  }
}
