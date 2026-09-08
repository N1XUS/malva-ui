import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
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
 * How the shell resolves its own block size.
 *
 * - `'parent'` (default) fills a parent that has a definite block size, and
 *   degrades to content sizing against an indefinite one — exactly what the
 *   shell did before this input existed.
 * - `'viewport'` fills the screen minus whatever sits above the shell, which
 *   the shell measures for itself. Use it when the shell *is* the application.
 * - `'content'` opts out entirely: the shell is as tall as its content and
 *   nothing inside it can be sticky.
 */
export type MlvPageShellSizing = 'parent' | 'viewport' | 'content';

/**
 * Application-page shell that joins global top navigation, one or two sidebars,
 * and the Page canvas without taking ownership of their component behaviour.
 *
 * The shell owns the definite block size that everything sticky inside it
 * resolves against — the page's own scrollport, the sidebar rails, the header,
 * the dock, a sticky aside. Without one they all silently do nothing, so the
 * mode is an input rather than something each consumer re-derives with a
 * viewport unit and a hand-measured subtraction.
 */
@Component({
  selector: 'mlv-page-shell',
  templateUrl: './page-shell.html',
  styleUrl: './page-shell.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-shell',
    '[class.mlv-page-shell--sizing-parent]': 'sizing() === "parent"',
    '[class.mlv-page-shell--sizing-viewport]': 'sizing() === "viewport"',
    '[class.mlv-page-shell--sizing-content]': 'sizing() === "content"',
    '[style.--mlv-page-shell-viewport-inset-block-start]': '_viewportInset()',
    '[style.--mlv-page-shell-resolved-background]': '_resolvedBackground()',
    '[style.--mlv-page-shell-resolved-foreground]': '_resolvedForeground()',
    '[style.background]': '_resolvedBackground()',
    '[style.color]': '_resolvedForeground()',
  },
})
export class MlvPageShell {
  /**
   * How the shell resolves its own block size. See {@link MlvPageShellSizing}.
   */
  readonly sizing = input<MlvPageShellSizing>('parent');
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

  /**
   * @protected Distance in pixels from the top of the viewport to the shell's
   * own top edge, published as a length so `sizing="viewport"` can subtract it
   * — a fixed application bar above the shell, or the padding reserved for
   * one, is otherwise counted twice. `null` in every other sizing mode, so no
   * property is written at all.
   */
  protected readonly _viewportInset = computed(() => {
    if (this.sizing() !== 'viewport') {
      return null;
    }
    return `${this._measuredViewportInset()}px`;
  });

  /** @private Writable source behind {@link _viewportInset}. */
  private readonly _measuredViewportInset = signal(0);

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

    afterNextRender(() => {
      this._measureViewportInset();
      const view = this._host.nativeElement.ownerDocument.defaultView;
      if (!view) {
        return;
      }
      // Only a viewport resize can move the shell's own top edge without
      // changing anything the shell renders; a scroll cannot, because the
      // measurement below is deliberately scroll-invariant.
      fromEvent(view, 'resize')
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => this._measureViewportInset());
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
   * @private Measures how far the shell's top edge sits below the top of the
   * initial containing block.
   *
   * `rect.top` alone is a scroll position; adding the document scroll offset
   * makes it the shell's own place in the layout, which does not move when the
   * user scrolls and — crucially — does not depend on the shell's own block
   * size. That is what keeps `block-size: calc(100dvh - inset)` from feeding
   * back into its own measurement.
   *
   * The measurement assumes the document is the shell's scrolling ancestor. A
   * shell nested inside another scroller wants `sizing="parent"` anyway: there
   * the parent already has the definite size, and no measurement is needed.
   */
  private _measureViewportInset(): void {
    const host = this._host.nativeElement;
    const view = host.ownerDocument.defaultView;
    if (!view) {
      return;
    }
    const top = host.getBoundingClientRect().top + view.scrollY;
    this._measuredViewportInset.set(Math.max(0, Math.round(top * 100) / 100));
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
