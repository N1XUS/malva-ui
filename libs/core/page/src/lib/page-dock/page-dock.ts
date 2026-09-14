import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  afterRenderEffect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import {
  MlvPageGeometry,
  obstructsViewportBlockEnd,
  publishViewportInsetBlockEnd,
  registerPageRegion,
} from '../page/page-geometry';

/** Visual treatment of the dock surface. */
export type MlvPageDockAppearance = 'bar' | 'floating';

/**
 * Bottom action bar for workflow pages. Projects content marked with
 * `[mlvPageDockStart]`, `[mlvPageDockCenter]`, and `[mlvPageDockEnd]` into a
 * three-region row and, by default, sticks to the bottom edge of the owning
 * page's scroll area. Typical composition: pending-change status at the
 * start, a floating tool cluster in the center, and discard/schedule/save/
 * publish actions at the end.
 *
 * `appearance="floating"` drops the dock's own glass surface — whatever floats
 * inside it, e.g. a pill action bar, brings its own — and replaces it with the
 * `mlvFloatingContainer` recipe from `@malva-ui/cdk/floating-container`: a
 * gradient-masked backdrop plus safe-area block-end padding, so content fades
 * out beneath the actions instead of scrolling straight into them. Override
 * the backdrop fill with `--mlv-page-dock-backdrop` (defaults to
 * `--mlv-background-base`).
 *
 * The dock derives its full-bleed margins from the inherited
 * `--mlv-page-inset-inline` / `--mlv-page-inset-block` pair, so the geometry
 * survives a wrapper element (a `<form>`,
 * a `<section>`) between the page canvas and the dock, and collapses to zero
 * outside a page.
 *
 * The dock answers two different geometry questions, and they are published
 * separately:
 *
 * - **In-page reservation.** It registers as the page's block-end region, so
 *   `main[mlvPage]` publishes `--mlv-page-dock-block-size` and — while sticky —
 *   folds it into `--mlv-page-sticky-inset-block-end` and the derived
 *   `--mlv-page-available-block-size`.
 * - **Viewport clearance.** While it actually reaches the bottom edge of the
 *   screen it publishes `--mlv-viewport-inset-block-end` (and, as a
 *   compatibility bridge, the older `--mlv-page-dock-height`) on the document
 *   element, so portalled overlays — bottom toasts above all — never render
 *   underneath it. A dock pinned halfway down a document-scrolled page covers
 *   nothing and publishes nothing.
 */
@Component({
  selector: 'mlv-page-dock',
  template: `
    <ng-content select="[mlvPageDockStart]" />
    <ng-content select="[mlvPageDockCenter]" />
    <ng-content select="[mlvPageDockEnd]" />
  `,
  styleUrl: './page-dock.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-dock',
    'data-slot': 'page-dock',
    '[class.mlv-page-dock--sticky]': 'sticky()',
    '[class.mlv-page-dock--floating]': 'appearance() === "floating"',
  },
})
export class MlvPageDock {
  /** Keeps the dock attached to the bottom edge of the page scroll area. */
  readonly sticky = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /** Solid bar with a top border, or a floating gradient-masked backdrop. */
  readonly appearance = input<MlvPageDockAppearance>('bar');

  /** @private Host element whose border-box height is published. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Shared resize observation used to track the dock's height. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Withdraws this dock's height contribution on teardown. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Document the viewport inset is published on. */
  private readonly _document = inject(DOCUMENT);

  /**
   * @private Geometry of the owning page, when there is one. Its scroll offset
   * is read only so the viewport-obstruction test re-runs as the dock moves
   * under the fold.
   */
  private readonly _pageGeometry = inject(MlvPageGeometry, { optional: true });

  /**
   * @private Last value handed to the shared registry, so a scroll that does
   * not move the dock relative to the viewport writes no style at all.
   */
  private _publishedBlockSize: number | null = null;

  /**
   * @private Latest measured border-box height of the dock, in pixels. Only
   * written in a browser — during server rendering it stays at 0 and nothing
   * is published.
   */
  private readonly _measuredHeight = signal(0);

  constructor() {
    // The dock is the page's block-end chrome. Registering publishes the
    // in-page reservation (`--mlv-page-dock-block-size`) and, when sticky, the
    // page's own `--mlv-page-sticky-inset-block-end`. That is a different
    // question from the viewport clearance published below, and the two answers
    // differ for a dock that is pinned inside a page the viewport can scroll
    // past.
    registerPageRegion({
      element: this._host.nativeElement,
      edge: 'block-end',
      sticky: this.sticky,
    });

    // `afterNextRender` / `afterRenderEffect` never run on the server, so the
    // document is only touched in a browser.
    afterNextRender(() => {
      this._measuredHeight.set(this._host.nativeElement.offsetHeight);
      this._resizeObserver
        .observe(this._host)
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => {
          this._measuredHeight.set(this._host.nativeElement.offsetHeight);
        });
    });

    afterRenderEffect(() => {
      const height = this._measuredHeight();
      const sticky = this.sticky();
      // Re-run the geometric test as the page scrolls: a dock pinned to a
      // scrollport the document can scroll past only reaches the bottom of the
      // viewport some of the time.
      this._pageGeometry?.scrollTop();

      // A `position: sticky` declaration is not evidence that the dock covers
      // the bottom of the screen; only its own rect is.
      const obstructs =
        sticky && obstructsViewportBlockEnd(this._host.nativeElement, sticky);
      const published = obstructs ? height : null;
      if (published === this._publishedBlockSize) {
        return;
      }
      this._publishedBlockSize = published;
      publishViewportInsetBlockEnd(this, published, this._document);
    });

    this._destroyRef.onDestroy(() =>
      publishViewportInsetBlockEnd(this, null, this._document),
    );
  }
}
