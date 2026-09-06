import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import type { MlvSchedulerDropListKind } from './scheduler-drag.service';
import { MlvSchedulerDragService } from './scheduler-drag.service';

/**
 * Marks an element as a drop list of the scheduler's drag engine. Every chip inside it becomes draggable
 * (SortableJS), and chips from any other list of the same `dragGroup` may be dropped onto it.
 */
@Directive({
  selector: '[mlvSchedulerDropList]',
})
export class MlvSchedulerDropList {
  /** What a drop on this list means: a month cell, an all-day cell or a time column. */
  readonly mlvSchedulerDropList = input.required<MlvSchedulerDropListKind>();

  /** Index of the day this list represents within the visible range. */
  readonly dayIndex = input.required<number>();

  /**
   * Direct parent of the chips, when that is not the host itself. SortableJS starts a drag only from a
   * direct child of its container but hit-tests hovers by walking UP from `elementFromPoint`, so the two
   * roles need two elements: the host stays the hit area (the whole cell / column) and this box, a
   * descendant of it, is where the chips actually live. Read once, at registration.
   */
  readonly items = input<HTMLElement | undefined>(undefined);

  /** @private The drag engine shared by the owning scheduler. */
  private readonly _drag = inject(MlvSchedulerDragService);

  /** @private Host element registered as a list. */
  private readonly _element = inject(ElementRef<HTMLElement>).nativeElement;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this._drag.register(this._element, {
        kind: this.mlvSchedulerDropList(),
        dayIndex: this.dayIndex,
        items: this.items(),
      });
    });
    destroyRef.onDestroy(() => this._drag.unregister(this._element));
  }
}
