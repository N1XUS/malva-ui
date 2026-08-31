import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  ViewEncapsulation,
} from '@angular/core';
import { MlvTimelineItem } from './timeline-item';

/**
 * Container component for a vertical timeline of events.
 *
 * Renders an ordered list (`<ol>`) that manages the vertical connector line
 * between `mlv-timeline-item` children via CSS. Each child handles its own
 * connector segment; the last child hides its connector automatically.
 *
 * ## Single-sided collapse
 *
 * A timeline item is a three-column grid — `[content-left] [spine]
 * [content-right]` — so that items can alternate sides. When every projected
 * item shares the same `direction`, the opposite column carries nothing, and
 * the timeline collapses its items to a two-column grid instead of reserving
 * (and gapping) half the available width for an empty track. This is driven by
 * the `mlv-timeline--single-left` / `mlv-timeline--single-right` host classes
 * and requires no consumer opt-in. A timeline that mixes both directions keeps
 * the full three-column layout.
 *
 * @example
 * ```html
 * <mlv-timeline>
 *   <mlv-timeline-item title="Submitted" timestamp="Mar 24, 2025" tone="info">
 *     Form submitted by user.
 *   </mlv-timeline-item>
 *   <mlv-timeline-item title="Approved" timestamp="Mar 25, 2025" tone="success">
 *     Approved by manager.
 *   </mlv-timeline-item>
 *   <mlv-timeline-item title="Completed" timestamp="Mar 26, 2025" tone="success">
 *     Process completed.
 *   </mlv-timeline-item>
 * </mlv-timeline>
 * ```
 */
@Component({
  selector: 'mlv-timeline',
  template: `<ng-content />`,
  styleUrl: './timeline.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-timeline',
    role: 'list',
    '[class.mlv-timeline--single-left]': '_isSingleLeft()',
    '[class.mlv-timeline--single-right]': '_isSingleRight()',
  },
})
export class MlvTimeline {
  /**
   * @protected The projected timeline items.
   *
   * Queried with `descendants: true` so items wrapped in `@for`/`@if` blocks or
   * re-projected through an intermediate component are still seen. The query is
   * a signal, so the collapse modifiers below re-evaluate when items are added
   * or removed.
   */
  protected readonly _items = contentChildren(MlvTimelineItem, {
    descendants: true,
  });

  /**
   * @protected Whether at least one projected item renders its content on the
   * left of the spine. `direction` is a signal input, so this stays correct when
   * a consumer flips an item's direction at runtime.
   */
  protected readonly _hasLeft = computed(() =>
    this._items().some((item) => item.direction() === 'left'),
  );

  /**
   * @protected Whether at least one projected item renders its content on the
   * right of the spine.
   */
  protected readonly _hasRight = computed(() =>
    this._items().some((item) => item.direction() === 'right'),
  );

  /**
   * @protected True when the timeline has items and every one of them sits on
   * the left, so the right column can be dropped. False for an empty timeline
   * and for a timeline that mixes directions.
   */
  protected readonly _isSingleLeft = computed(
    () => this._hasLeft() && !this._hasRight(),
  );

  /**
   * @protected True when the timeline has items and every one of them sits on
   * the right (the default), so the left column can be dropped.
   */
  protected readonly _isSingleRight = computed(
    () => this._hasRight() && !this._hasLeft(),
  );
}
