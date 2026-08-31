import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  Renderer2,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

/**
 * Orientation of the scroll container that the directive watches.
 * `vertical` (default) observes `scrollTop`/`scrollHeight`/`clientHeight`.
 * `horizontal` observes `scrollLeft`/`scrollWidth`/`clientWidth`.
 */
export type MlvInfiniteScrollOrientation = 'vertical' | 'horizontal';

/**
 * Structural container for the `loadMore` event payload.
 * Exposed as the output value so consumers can inspect how close the user was
 * to the edge when the request was triggered.
 */
export interface MlvInfiniteScrollTrigger {
  /** Distance in pixels between the viewport edge and the content edge when the event fired. */
  readonly distance: number;
  /** Orientation that triggered the event. */
  readonly orientation: MlvInfiniteScrollOrientation;
}

/**
 * Attribute directive that emits `loadMore` when the user scrolls close to the
 * end of the host element.
 *
 * Apply to any scrollable container — a plain `<div>`, a CDK virtual scroll
 * viewport, or another component's scroll wrapper (via `hostDirectives`).
 *
 * ```html
 * <div class="feed"
 *      mlvInfiniteScroll
 *      [threshold]="200"
 *      [loading]="isLoading()"
 *      [hasMore]="hasMore()"
 *      (loadMore)="fetchNextPage()">
 *   ...
 * </div>
 * ```
 *
 * The directive runs the scroll listener outside the Angular zone for
 * performance and only re-enters the zone when it actually fires `loadMore`.
 */
@Directive({
  selector: '[mlvInfiniteScroll]',
  exportAs: 'mlvInfiniteScroll',
})
export class MlvInfiniteScroll {
  /**
   * Distance in pixels from the bottom (or right) of the scroll container at
   * which the `loadMore` event should be emitted. Defaults to `150`.
   */
  readonly threshold = input<number>(150);

  /**
   * When `true`, suppresses further `loadMore` events. Typically bound to the
   * consumer's in-flight request flag so that a single scroll gesture cannot
   * fire multiple fetches.
   */
  readonly loading = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `false`, the directive stops emitting — useful to signal that the
   * backing data source has been fully loaded.
   */
  readonly hasMore = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, the directive does not attach any listeners. Flip this while
   * the container is detached or during setup/teardown sequences.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Orientation of the scroll container. Defaults to `'vertical'`.
   */
  readonly orientation = input<MlvInfiniteScrollOrientation>('vertical');

  /**
   * External scroll container to observe. When omitted, the directive uses
   * the host element itself. Useful when the directive is applied to a marker
   * element that does not own the scrollbar (for example, a sentinel row at
   * the bottom of a virtual scroll viewport).
   */
  readonly scrollContainer = input<
    HTMLElement | ElementRef<HTMLElement> | null
  >(null);

  /**
   * Emits when the user has scrolled within `threshold` px of the far edge,
   * provided `loading` is `false`, `hasMore` is `true`, and `disabled` is `false`.
   */
  readonly loadMore = output<MlvInfiniteScrollTrigger>();

  /** @private Host element — fallback scroll container when none is injected. */
  private readonly _host = inject(ElementRef<HTMLElement>);
  /** @private Renderer for attaching/detaching the scroll listener. */
  private readonly _renderer = inject(Renderer2);
  /** @private Used to run the scroll listener outside the zone. */
  private readonly _zone = inject(NgZone);
  /** @private Clean up listeners and observers on directive destroy. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Cleanup function for the current scroll listener, if attached. */
  private _detachScroll: (() => void) | null = null;
  /** @private Element the current listener is bound to. */
  private _currentTarget: HTMLElement | null = null;
  /** @private Guard that prevents duplicate emissions during a single scroll crossing. */
  private _pendingFire = false;

  constructor() {
    // Rebind whenever relevant inputs change (target element, disabled, orientation).
    effect(() => {
      // Access the reactive inputs so the effect re-runs on change.
      this.scrollContainer();
      this.disabled();
      this.orientation();
      this._rebind();
    });

    // An initial measurement once the host has been rendered — handles the
    // edge case where the content already fits within the threshold at load
    // time (e.g. empty initial page) so the consumer should immediately fetch
    // the next page.
    afterNextRender(() => {
      this._maybeFire();
    });

    this._destroyRef.onDestroy(() => this._detach());
  }

  /**
   * Imperatively re-evaluates the scroll position and fires `loadMore` if the
   * user is currently within threshold of the far edge. Use this after
   * appending new rows when the content still does not fill the viewport.
   */
  check(): void {
    this._maybeFire();
  }

  /** @private Detach old listener and attach a fresh one to the current target. */
  private _rebind(): void {
    this._detach();

    if (this.disabled()) {
      return;
    }

    const target = this._resolveTarget();
    if (!target) {
      return;
    }

    this._currentTarget = target;

    this._zone.runOutsideAngular(() => {
      this._detachScroll = this._renderer.listen(target, 'scroll', () => {
        this._maybeFire();
      });
    });
  }

  /** @private Remove the current scroll listener if one is attached. */
  private _detach(): void {
    this._detachScroll?.();
    this._detachScroll = null;
    this._currentTarget = null;
  }

  /** @private Resolve the configured scrollContainer input to a DOM element. */
  private _resolveTarget(): HTMLElement | null {
    const configured = this.scrollContainer();
    if (configured) {
      return configured instanceof ElementRef
        ? configured.nativeElement
        : configured;
    }
    return this._host.nativeElement;
  }

  /**
   * @private Measures distance to the far edge. Emits `loadMore` if within
   * threshold and the directive is in a state where emitting is allowed.
   */
  private _maybeFire(): void {
    if (this.disabled() || this.loading() || !this.hasMore()) {
      return;
    }

    const target = this._currentTarget ?? this._resolveTarget();
    if (!target) return;

    const orientation = this.orientation();
    const distance =
      orientation === 'horizontal'
        ? target.scrollWidth - target.scrollLeft - target.clientWidth
        : target.scrollHeight - target.scrollTop - target.clientHeight;

    if (distance <= this.threshold()) {
      if (this._pendingFire) return;
      this._pendingFire = true;
      this._zone.run(() => {
        this.loadMore.emit({ distance, orientation });
        // Allow the next fire on the next microtask — consumers that flip
        // `loading` synchronously will suppress the immediate re-fire naturally
        // once the effect re-runs.
        queueMicrotask(() => {
          this._pendingFire = false;
        });
      });
    }
  }
}
