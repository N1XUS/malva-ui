import { Directive, inject, TemplateRef } from '@angular/core';
import type {
  MlvSchedulerEventContext,
  MlvSchedulerEventMenuContext,
  MlvSchedulerHeaderContext,
  MlvSchedulerSlotMenuContext,
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

/**
 * Items of the context menu the scheduler opens on a right-click (or the
 * ContextMenu key / Shift+F10) over an **empty** month cell, all-day cell or
 * time slot. The template holds `mlv-list-item[mlvMenuItem]` rows (and
 * `mlv-menu-separator`s / `mlv-menu-group`s) exactly as the content of an
 * `mlv-menu` would; the scheduler owns the panel.
 *
 * `$implicit` is the range the menu is about: the cell's own day or the slot's
 * own duration, or — when the cell lies inside a pending keyboard selection
 * (`Shift+Arrow`) — that whole selection, with `selection` set to `true`.
 *
 * ```html
 * <ng-template mlvSchedulerSlotMenuDef let-range let-selection="selection">
 *   <mlv-list-item mlvMenuItem (itemClick)="create(range)">New event</mlv-list-item>
 * </ng-template>
 * ```
 */
@Directive({ selector: '[mlvSchedulerSlotMenuDef]' })
export class MlvSchedulerSlotMenuDef<D = Date> {
  /** The projected menu-items template. */
  readonly templateRef = inject(TemplateRef<MlvSchedulerSlotMenuContext<D>>);

  /** Type guard for template variable inference. */
  static ngTemplateContextGuard<D>(
    _dir: MlvSchedulerSlotMenuDef<D>,
    _ctx: unknown,
  ): _ctx is MlvSchedulerSlotMenuContext<D> {
    return true;
  }
}

/**
 * Items of the context menu the scheduler opens on a right-click (or the
 * ContextMenu key / Shift+F10) over an event chip. Same content rules as
 * `MlvSchedulerSlotMenuDef`; `$implicit` is the event.
 *
 * ```html
 * <ng-template mlvSchedulerEventMenuDef let-event>
 *   <mlv-list-item mlvMenuItem (itemClick)="edit(event)">Edit</mlv-list-item>
 *   <mlv-list-item mlvMenuItem (itemClick)="remove(event)">Delete</mlv-list-item>
 * </ng-template>
 * ```
 */
@Directive({ selector: '[mlvSchedulerEventMenuDef]' })
export class MlvSchedulerEventMenuDef<D = Date, TData = unknown> {
  /** The projected menu-items template. */
  readonly templateRef = inject(
    TemplateRef<MlvSchedulerEventMenuContext<D, TData>>,
  );

  /** Type guard for template variable inference. */
  static ngTemplateContextGuard<D, TData>(
    _dir: MlvSchedulerEventMenuDef<D, TData>,
    _ctx: unknown,
  ): _ctx is MlvSchedulerEventMenuContext<D, TData> {
    return true;
  }
}
