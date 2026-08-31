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
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';

/** Visual treatment of the dock surface. */
export type MlvPageDockAppearance = 'bar' | 'floating';

/**
 * Custom property published on `document.documentElement` while at least one
 * sticky dock is on screen. Viewport-anchored overlays — most importantly the
 * bottom toast positions — read it so they never render underneath the dock.
 */
const DOCK_HEIGHT_PROPERTY = '--mlv-page-dock-height';

/**
 * @internal Heights contributed by the sticky docks currently alive, keyed by
 * the owning component. Two pages can be mounted at once (a route transition,
 * a page inside a dialog), so the published value is the tallest contribution
 * rather than whichever dock rendered last.
 */
const stickyDockHeights = new Map<object, number>();

/**
 * @internal Republishes {@link DOCK_HEIGHT_PROPERTY} after a contribution
 * changed. Passing `null` withdraws the owner's contribution; the property is
 * removed entirely once the last sticky dock is gone, so a page without a dock
 * never leaves a stale offset behind.
 */
function publishStickyDockHeight(owner: object, height: number | null): void {
  // The teardown path also runs during server rendering, where there is no
  // document to publish to.
  if (typeof document === 'undefined') {
    return;
  }

  if (height === null) {
    stickyDockHeights.delete(owner);
  } else {
    stickyDockHeights.set(owner, height);
  }

  const root = document.documentElement;
  if (stickyDockHeights.size === 0) {
    root.style.removeProperty(DOCK_HEIGHT_PROPERTY);
    return;
  }

  const tallest = Math.max(...stickyDockHeights.values());
  root.style.setProperty(
    DOCK_HEIGHT_PROPERTY,
    `${Math.round(tallest * 100) / 100}px`,
  );
}

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
 * `--mlv-page-inset`, so the geometry survives a wrapper element (a `<form>`,
 * a `<section>`) between the page canvas and the dock, and collapses to zero
 * outside a page.
 *
 * While `sticky`, the dock publishes its measured height as
 * `--mlv-page-dock-height` on `document.documentElement`; bottom-anchored
 * toasts offset themselves by it so they are never covered by the dock.
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

  /**
   * @private Latest measured border-box height of the dock, in pixels. Only
   * written in a browser — during server rendering it stays at 0 and nothing
   * is published.
   */
  private readonly _measuredHeight = signal(0);

  constructor() {
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
      // A non-sticky dock scrolls away with the content, so it never covers a
      // viewport-anchored overlay and must not reserve space for one.
      const height = this.sticky() ? this._measuredHeight() : null;
      publishStickyDockHeight(this, height);
    });

    this._destroyRef.onDestroy(() => publishStickyDockHeight(this, null));
  }
}
