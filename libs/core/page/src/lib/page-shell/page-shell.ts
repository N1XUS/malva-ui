import {
  afterNextRender,
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
import { MlvChromeColor } from '@malva-ui/cdk/utils';

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
 * The shell owns exactly two things, and deliberately not a third:
 *
 * 1. **A definite block size**, which is what everything sticky inside it
 *    resolves against — the page's own scrollport, the sidebar rails, the
 *    header, the dock, a sticky aside. Without one they all silently do
 *    nothing, so the mode is an input rather than something each consumer
 *    re-derives with a viewport unit and a hand-measured subtraction.
 * 2. **The chrome token remap** in its stylesheet, keyed on the classes the
 *    slot directives apply.
 *
 * The colour work is *not* the shell's. `color` and `foreground` are
 * {@link MlvChromeColor}'s inputs, exposed here under the names they always
 * had: contrast-derived chrome is useful on any dark surface — a standalone
 * action bar, a sidebar in a bespoke layout, a marketing header — and welding
 * it into this component made it reachable only by adopting the whole shell.
 */
@Component({
  selector: 'mlv-page-shell',
  templateUrl: './page-shell.html',
  styleUrl: './page-shell.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: MlvChromeColor,
      inputs: ['mlvChromeColor: color', 'chromeForeground: foreground'],
    },
  ],
  host: {
    class: 'mlv-page-shell',
    'data-slot': 'page-shell',
    '[class.mlv-page-shell--sizing-parent]': 'sizing() === "parent"',
    '[class.mlv-page-shell--sizing-viewport]': 'sizing() === "viewport"',
    '[class.mlv-page-shell--sizing-content]': 'sizing() === "content"',
    '[style.--mlv-page-shell-viewport-inset-block-start]': '_viewportInset()',
  },
})
export class MlvPageShell {
  /**
   * How the shell resolves its own block size. See {@link MlvPageShellSizing}.
   */
  readonly sizing = input<MlvPageShellSizing>('parent');

  /**
   * The resolved chrome colours, for a consumer that wants to paint a matching
   * surface outside the shell. Both signals are `null` while no `color` is set.
   */
  readonly chrome = inject(MlvChromeColor);

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

  /** @private Native shell host, measured for the viewport inset. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Angular destruction hook for the resize subscription. */
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
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
}
