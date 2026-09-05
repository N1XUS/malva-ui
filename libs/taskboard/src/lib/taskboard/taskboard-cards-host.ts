import { isPlatformBrowser } from '@angular/common';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
  DestroyRef,
  Directive,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  inject,
} from '@angular/core';
import { MLV_TASKBOARD_CARDS_REGISTRY } from './taskboard-sortable';

/** @private Class CDK gives the element that actually holds the rendered cards. */
const CONTENT_WRAPPER_CLASS = 'cdk-virtual-scroll-content-wrapper';

/**
 * Package-private card-container registration for pointer sorting.
 *
 * The board template applies it to every rendered `.mlv-taskboard__cards`
 * element, so adding, removing, or collapsing a column or swimlane creates and
 * destroys its SortableJS instance through Angular's own lifecycle instead of a
 * one-shot DOM scan. It is deliberately absent from `src/index.ts`: only
 * `MlvTaskboard`'s template may declare it.
 *
 * On a virtualized cell the directive sits on the `cdk-virtual-scroll-viewport`
 * host, which is the scroller and holds no cards itself. It then registers the
 * viewport's content wrapper instead, and hands the adapter the rendered window
 * so a slot read back from that wrapper is offset into the whole bucket.
 */
@Directive({ selector: '[mlvTaskboardCardsHost]' })
export class MlvTaskboardCardsHost {
  /** @private The element the directive is applied to. */
  private readonly _element =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** @private The owning board's adapter, provided through a private token. */
  private readonly _registry = inject(MLV_TASKBOARD_CARDS_REGISTRY);
  /** @private Unregisters the container when this cell leaves the DOM. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private The viewport this cell scrolls with, on a virtualized board. */
  private readonly _viewport = inject(CdkVirtualScrollViewport, {
    optional: true,
    self: true,
  });
  /** @private The element actually registered, resolved after the first render. */
  private _registered: HTMLElement | null = null;

  constructor() {
    // SortableJS needs a real document; a server render registers nothing.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const viewport = this._viewport;
    afterNextRender(() => {
      // The content wrapper exists only once the viewport has rendered, so the
      // instance is created here rather than in the constructor.
      const element =
        viewport === null
          ? this._element
          : this._element.querySelector<HTMLElement>(
              `.${CONTENT_WRAPPER_CLASS}`,
            );
      if (element === null) return;
      if (viewport !== null) {
        // The wrapper is CDK's own layout box. Without a presentational role it
        // would sit between the cell's `listbox` and its `option`s and break the
        // ownership the pattern requires.
        element.setAttribute('role', 'presentation');
      }
      this._registered = element;
      this._registry.registerBucket(
        element,
        viewport === null
          ? undefined
          : () => {
              const range = viewport.getRenderedRange();
              return {
                start: range.start,
                rendered: range.end - range.start,
                total: viewport.getDataLength(),
              };
            },
      );
    });
    this._destroyRef.onDestroy(() => {
      if (this._registered === null) return;
      this._registry.unregisterBucket(this._registered);
    });
  }
}
