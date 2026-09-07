import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  inject,
} from '@angular/core';
import { MLV_TASKBOARD_COLUMNS_REGISTRY } from './taskboard-column-sortable';

/**
 * Package-private header-row registration for pointer column reordering.
 *
 * The board template applies it to the single `.mlv-taskboard__column-row`, so
 * the SortableJS instance is created and destroyed through Angular's own
 * lifecycle. It is deliberately absent from `src/index.ts`: only
 * `MlvTaskboard`'s template may declare it.
 */
@Directive({ selector: '[mlvTaskboardColumnsHost]' })
export class MlvTaskboardColumnsHost {
  /** @private The header row registered as the column drag container. */
  private readonly _element = inject(ElementRef<HTMLElement>).nativeElement;
  /** @private The owning board's adapter, provided through a private token. */
  private readonly _registry = inject(MLV_TASKBOARD_COLUMNS_REGISTRY);
  /** @private Unregisters the row when the board leaves the DOM. */
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    // SortableJS needs a real document; a server render registers nothing.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    afterNextRender(() => this._registry.registerColumnRow(this._element));
    this._destroyRef.onDestroy(() =>
      this._registry.unregisterColumnRow(this._element),
    );
  }
}
