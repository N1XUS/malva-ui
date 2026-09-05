import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  inject,
} from '@angular/core';
import { MLV_TASKBOARD_CARDS_REGISTRY } from './taskboard-sortable';

/**
 * Package-private card-container registration for pointer sorting.
 *
 * The board template applies it to every rendered `.mlv-taskboard__cards`
 * element, so adding, removing, or collapsing a column or swimlane creates and
 * destroys its SortableJS instance through Angular's own lifecycle instead of a
 * one-shot DOM scan. It is deliberately absent from `src/index.ts`: only
 * `MlvTaskboard`'s template may declare it.
 */
@Directive({ selector: '[mlvTaskboardCardsHost]' })
export class MlvTaskboardCardsHost {
  /** @private The container element registered as one SortableJS bucket. */
  private readonly _element = inject(ElementRef<HTMLElement>).nativeElement;
  /** @private The owning board's adapter, provided through a private token. */
  private readonly _registry = inject(MLV_TASKBOARD_CARDS_REGISTRY);
  /** @private Unregisters the container when this cell leaves the DOM. */
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    // SortableJS needs a real document; a server render registers nothing.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    afterNextRender(() => this._registry.registerBucket(this._element));
    this._destroyRef.onDestroy(() =>
      this._registry.unregisterBucket(this._element),
    );
  }
}
