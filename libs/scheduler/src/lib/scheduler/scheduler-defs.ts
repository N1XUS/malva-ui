import { Directive, inject, TemplateRef } from '@angular/core';
import type {
  MlvSchedulerEventContext,
  MlvSchedulerHeaderContext,
} from './scheduler.types';

/**
 * Replaces the **content** of every event chip. The chip host keeps its
 * drag / resize / focus / ARIA behaviour.
 *
 * ```html
 * <ng-template mlvSchedulerEventDef let-event let-allDay="allDay">…</ng-template>
 * ```
 */
@Directive({ selector: '[mlvSchedulerEventDef]' })
export class MlvSchedulerEventDef<D = Date, TData = unknown> {
  /** The projected chip content template. */
  readonly templateRef = inject(
    TemplateRef<MlvSchedulerEventContext<D, TData>>,
  );

  /** Type guard for template variable inference. */
  static ngTemplateContextGuard<D, TData>(
    _dir: MlvSchedulerEventDef<D, TData>,
    _ctx: unknown,
  ): _ctx is MlvSchedulerEventContext<D, TData> {
    return true;
  }
}

/**
 * Replaces the built-in toolbar. The template receives a
 * `MlvSchedulerHeaderApi` as `$implicit`.
 */
@Directive({ selector: '[mlvSchedulerHeaderDef]' })
export class MlvSchedulerHeaderDef<D = Date> {
  /** The projected toolbar template. */
  readonly templateRef = inject(TemplateRef<MlvSchedulerHeaderContext<D>>);

  /** Type guard for template variable inference. */
  static ngTemplateContextGuard<D>(
    _dir: MlvSchedulerHeaderDef<D>,
    _ctx: unknown,
  ): _ctx is MlvSchedulerHeaderContext<D> {
    return true;
  }
}
