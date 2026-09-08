import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { registerPageRegion } from '../page/page-geometry';
import { MlvPageSnapRegionBase } from '../page/page-snap-region-base';

/**
 * Key-facts strip rendered under a page header. Projects
 * `mlv-page-summary-item` children in a wrapping row.
 *
 * Inside `main[mlvPage]` the strip participates in the scroll-scrubbed snap
 * timeline: its height follows the page-level `--mlv-page-snap` progress
 * directly, while its opacity follows its own `snapFrom`..`snapTo` window, so
 * the values fade before the strip squashes them without the page losing the
 * exact height compensation. Expanding is driven by the header's chevron
 * (`mlv-page-header[snapControls]`) through `MlvPageSnapController` — the
 * strip itself is purely presentational.
 *
 * A fully collapsed strip is `visibility: hidden` and therefore leaves the
 * accessibility tree and the tab order — except while it holds focus, when it
 * reveals itself instead (`mlv-page-summary--revealed`) so that scrolling can
 * never blur a focused control into `<body>`. See {@link MlvPageSnapRegionBase}.
 */
@Component({
  selector: 'mlv-page-summary',
  template: `<div
    #items
    class="mlv-page-summary__items"
    role="group"
    [attr.aria-label]="summaryLabel()"
  >
    <ng-content />
  </div>`,
  styleUrl: './page-summary.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-page-summary',
    'data-slot': 'page-summary',
    '[class.mlv-page-summary--snapped]': '_elapsed()',
    '[class.mlv-page-summary--revealed]': '_revealed()',
    '[style.--mlv-snap-from]': 'snapFrom()',
    '[style.--mlv-snap-scale]': '_scale()',
    '[style.--mlv-page-summary-size]': '_measuredSize()',
    '[style.visibility]': '_hidden() ? "hidden" : null',
    '(focusin)': '_onRegionFocusIn()',
    '(focusout)': '_onRegionFocusOut($event)',
  },
})
export class MlvPageSummary extends MlvPageSnapRegionBase {
  /** Accessible name for the facts region. */
  readonly summaryLabel = input('Page summary');

  /** Progress at which the strip starts collapsing (0..1). */
  readonly snapFrom = input(0.1);

  /** Progress at which the strip is fully collapsed (0..1). */
  readonly snapTo = input(0.95);

  /** @protected Multiplier remapping page progress into the stagger window. */
  protected readonly _scale = computed(
    () => 1 / Math.max(this.snapTo() - this.snapFrom(), 0.001),
  );

  /**
   * @protected True once the strip has fully collapsed; unless it holds
   * focus, that also removes it from the accessibility tree and tab order.
   */
  protected readonly _elapsed = computed(
    () => (this._snapController?.progress() ?? 0) >= Math.min(this.snapTo(), 1),
  );

  /** @protected Natural height of the items row, driving the height scrub. */
  protected readonly _measuredHeight = signal<number | null>(null);

  /**
   * @protected What the strip gives up on the timeline: its whole measured
   * height. The controller sums it into the page's collapse distance, so the
   * timeline is exactly as long as the chrome it removes.
   */
  protected readonly _collapsibleBlockSize = computed(
    () => this._measuredHeight() ?? 0,
  );

  /**
   * @protected The same measurement as a CSS length. Every geometry property
   * this package publishes is a pixel string: a bare number is not a length,
   * so a consumer could not override it with one.
   */
  protected readonly _measuredSize = computed(() => {
    const height = this._measuredHeight();
    return height === null ? null : `${height}px`;
  });

  /** @private The measured items row. */
  private readonly _items =
    viewChild.required<ElementRef<HTMLElement>>('items');

  constructor() {
    super();
    // The strip is block-start chrome but is never `position: sticky` itself,
    // so it adds to the chrome block size and reserves no clearance. When it
    // is projected *inside* the header the coordinator drops it from the sum:
    // the header's own box already contains it.
    registerPageRegion({
      element: inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
      edge: 'block-start',
      sticky: signal(false),
    });

    const resizeObserver = inject(MlvResizeObserverService);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const itemsEl = this._items().nativeElement;
      // offsetHeight includes the row's own padding, matching the host
      // max-height the scrub interpolates against.
      this._measuredHeight.set(itemsEl.offsetHeight);
      const subscription = resizeObserver.observe(itemsEl).subscribe(() => {
        if (itemsEl.offsetHeight > 0) {
          this._measuredHeight.set(itemsEl.offsetHeight);
        }
      });
      destroyRef.onDestroy(() => subscription.unsubscribe());
    });
  }
}
