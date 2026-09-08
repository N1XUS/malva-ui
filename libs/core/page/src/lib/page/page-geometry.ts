import {
  DestroyRef,
  ElementRef,
  Injectable,
  afterRenderEffect,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';

/**
 * Edge of the page scrollport a registered region occupies. Only the block
 * axis is modelled: the inline axis is handled by `--mlv-page-inset-inline`
 * and needs no measurement.
 */
export type MlvPageStickyEdge = 'block-start' | 'block-end';

/**
 * A page region whose measured block size participates in the page geometry
 * contract. Regions register themselves; the coordinator never queries the
 * DOM for them, so a region rendered later by an `@if`, or wrapped in a
 * `<form>`/`<section>`, is registered exactly like a direct child.
 */
export interface MlvPageRegion {
  /** The region's host element, whose border-box block size is measured. */
  readonly element: HTMLElement;
  /** Which edge of the scrollport the region occupies. */
  readonly edge: MlvPageStickyEdge;
  /** Whether the region is currently pinned to that edge. */
  readonly sticky: Signal<boolean>;
  /**
   * When true, `main[mlvPage][stickyHeader]` also makes this region sticky.
   * Only the header follows the page-level default; the summary strip is in
   * normal flow and the dock owns its own `sticky` input.
   */
  readonly followsChromeDefault?: boolean;
}

/** @internal One registered region plus its live measurement. */
interface RegionEntry extends MlvPageRegion {
  /** Measured border-box block size in pixels; 0 until first measured. */
  readonly blockSize: Signal<number>;
}

/**
 * Custom property carrying the clearance that viewport-anchored content owes
 * the bottom edge of the screen. Published on the document element, because
 * the CDK overlay container is a body child and inherits from nothing else.
 */
const VIEWPORT_INSET_BLOCK_END = '--mlv-viewport-inset-block-end';

/**
 * Compatibility bridge for {@link VIEWPORT_INSET_BLOCK_END}. `mlv-toast` reads
 * this name today; it is published with the identical value and retired one
 * minor after the geometry contract ships.
 */
const LEGACY_DOCK_HEIGHT = '--mlv-page-dock-height';

/**
 * @internal Viewport-obstructing block-end contributions, keyed by the owning
 * component. Two pages can be mounted at once (a route transition, a page
 * inside a dialog), so the published value is the tallest contribution rather
 * than whichever region rendered last.
 */
const viewportBlockEndContributions = new Map<object, number>();

/** Rounds a measured pixel length to two decimals for publication. */
function roundPx(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Republishes the viewport block-end inset after a contribution changed.
 * Passing `null` withdraws the owner's contribution; both properties are
 * removed once the last contributor is gone, so a page without a dock never
 * leaves a stale offset behind.
 *
 * @param owner Identity of the contributing component instance.
 * @param blockSize Obstructing size in pixels, or `null` to withdraw.
 * @param document The owning document, or `null` during server rendering.
 */
export function publishViewportInsetBlockEnd(
  owner: object,
  blockSize: number | null,
  document: Document | null,
): void {
  if (blockSize === null) {
    viewportBlockEndContributions.delete(owner);
  } else {
    viewportBlockEndContributions.set(owner, blockSize);
  }

  // The teardown path also runs during server rendering, where there is no
  // document to publish to.
  if (!document) {
    return;
  }

  const root = document.documentElement;
  if (viewportBlockEndContributions.size === 0) {
    root.style.removeProperty(VIEWPORT_INSET_BLOCK_END);
    root.style.removeProperty(LEGACY_DOCK_HEIGHT);
    return;
  }

  const tallest = `${roundPx(Math.max(...viewportBlockEndContributions.values()))}px`;
  root.style.setProperty(VIEWPORT_INSET_BLOCK_END, tallest);
  root.style.setProperty(LEGACY_DOCK_HEIGHT, tallest);
}

/**
 * Decides whether a region actually obstructs the bottom edge of the viewport.
 *
 * A `position: sticky` declaration is not evidence of obstruction: a dock
 * halfway down a document-scrolled page is pinned to its own scrollport and
 * covers nothing a portalled overlay would use. The test is geometric — the
 * region's bottom edge has to reach the viewport's.
 *
 * When the element has no layout at all (server rendering, a detached tree,
 * jsdom) the geometry cannot answer, so the region's own `sticky` state is
 * trusted rather than silently withdrawing a real reservation.
 *
 * @param element The region host element.
 * @param sticky Whether the region declares itself sticky.
 * @returns True when the region should reserve viewport clearance.
 */
export function obstructsViewportBlockEnd(
  element: HTMLElement,
  sticky: boolean,
): boolean {
  if (!sticky) {
    return false;
  }

  const view = element.ownerDocument.defaultView;
  const rect = element.getBoundingClientRect();
  if (!view || (rect.width === 0 && rect.height === 0)) {
    return true;
  }

  // One pixel of slack absorbs sub-pixel layout and zoom rounding.
  return rect.bottom >= view.innerHeight - 1;
}

/**
 * Page-scoped geometry coordinator. Regions register with it, it measures
 * them, and it publishes the results as custom properties on the page host so
 * that no consumer ever hand-measures a sticky offset again.
 *
 * Published on `main[mlvPage]`, all as pixel lengths:
 *
 * | Property | Answers |
 * |---|---|
 * | `--mlv-page-scrollport-block-size` | the page's actual usable scrollport |
 * | `--mlv-page-chrome-block-size` | how tall the top chrome currently is |
 * | `--mlv-page-sticky-inset-block-start` | clearance owed at the top edge |
 * | `--mlv-page-sticky-inset-block-end` | clearance owed at the bottom edge |
 * | `--mlv-page-dock-block-size` | the dock's in-page reservation |
 *
 * `--mlv-page-available-block-size` is derived from three of these in CSS, so
 * it stays live without a fourth write.
 *
 * Size and clearance are deliberately separate questions. A header that is not
 * sticky still has a chrome block size and owes no clearance; that split is
 * what lets `stickyHeader="false"` and a collapsing header share one contract.
 */
@Injectable()
export class MlvPageGeometry {
  /**
   * Whether the page makes its projected header sticky. `MlvPage` keeps this
   * in sync with its own `stickyHeader` input; regions that opt in through
   * {@link MlvPageRegion.followsChromeDefault} inherit it.
   */
  readonly chromeSticky = signal(false);

  /** Measured block size of the page's own scroll viewport, in pixels. */
  readonly scrollportBlockSize = computed(() => this._scrollportBlockSize());

  /**
   * Current vertical scroll offset of the page's scroll owner, in pixels.
   *
   * Lives here rather than behind its own injection token because its one
   * consumer — the dock re-testing whether it still obstructs the viewport —
   * is already asking this service a geometry question. Whether the chrome is
   * *over content* is a different question, answered by the snap controller's
   * `overlapped`, because chrome that never collapses still needs it.
   */
  readonly scrollTop = computed(() => this._scrollTop());

  /**
   * Combined block size of the top chrome, whether or not it is sticky. This
   * is the "how tall is it" question, not the "how much must I clear" one.
   */
  readonly chromeBlockSize = computed(() =>
    this._sum('block-start', /* stickyOnly */ false),
  );

  /** Clearance owed at the top edge of the scrollport, in pixels. */
  readonly stickyInsetBlockStart = computed(() =>
    this._sum('block-start', /* stickyOnly */ true),
  );

  /** Clearance owed at the bottom edge of the scrollport, in pixels. */
  readonly stickyInsetBlockEnd = computed(() =>
    this._sum('block-end', /* stickyOnly */ true),
  );

  /** Combined block size of the block-end chrome, sticky or not, in pixels. */
  readonly dockBlockSize = computed(() =>
    this._sum('block-end', /* stickyOnly */ false),
  );

  /** @private Page host element carrying every published property. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Shared resize observation backing every region measurement. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Releases region subscriptions when the page is destroyed. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Registered regions; identity-keyed so teardown is exact. */
  private readonly _regions = signal<readonly RegionEntry[]>([]);

  /** @private Writable source behind {@link scrollportBlockSize}. */
  private readonly _scrollportBlockSize = signal(0);

  /** @private Writable source behind {@link scrollTop}. */
  private readonly _scrollTop = signal(0);

  constructor() {
    afterRenderEffect(() => {
      this._publish(
        '--mlv-page-scrollport-block-size',
        this.scrollportBlockSize(),
      );
      this._publish('--mlv-page-chrome-block-size', this.chromeBlockSize());
      this._publish(
        '--mlv-page-sticky-inset-block-start',
        this.stickyInsetBlockStart(),
      );
      this._publish(
        '--mlv-page-sticky-inset-block-end',
        this.stickyInsetBlockEnd(),
      );
      this._publish('--mlv-page-dock-block-size', this.dockBlockSize());
    });
  }

  /**
   * Registers a region whose measured block size participates in the contract.
   *
   * @param region The region description; its element is observed for resizes.
   * @returns A teardown that withdraws the region and stops observing it.
   */
  registerRegion(region: MlvPageRegion): () => void {
    const blockSize = signal(region.element.offsetHeight);
    const entry: RegionEntry = { ...region, blockSize };

    const subscription = this._resizeObserver
      .observe(region.element)
      .subscribe(() => blockSize.set(region.element.offsetHeight));

    this._regions.update((regions) => [...regions, entry]);

    const release = (): void => {
      subscription.unsubscribe();
      this._regions.update((regions) => regions.filter((r) => r !== entry));
    };
    this._destroyRef.onDestroy(release);
    return release;
  }

  /**
   * Registers the element that actually scrolls the page, so the scrollport
   * size the contract publishes is the measured one rather than a viewport
   * unit that ignores every ancestor's chrome.
   *
   * @param element The scroll viewport element.
   * @returns A teardown that stops observing the viewport.
   */
  registerScrollport(element: HTMLElement): () => void {
    this._scrollportBlockSize.set(element.clientHeight);
    const subscription = this._resizeObserver
      .observe(element)
      .subscribe(() => this._scrollportBlockSize.set(element.clientHeight));

    const release = (): void => subscription.unsubscribe();
    this._destroyRef.onDestroy(release);
    return release;
  }

  /**
   * @internal Records the page viewport's scroll offset. Called by `MlvPage`
   * from its own passive scroll listener; a signal write of an unchanged value
   * notifies nothing, so a scroll that moves neither consumer costs nothing.
   *
   * @param scrollTop The viewport's current scroll offset, in pixels.
   */
  updateScroll(scrollTop: number): void {
    this._scrollTop.set(scrollTop);
  }

  /**
   * @private Sums one edge's registered regions.
   *
   * A region contained by another registered region on the same edge is not
   * added: a summary strip projected inside the header is already inside the
   * header's own measured box, and a blind sum would reserve it twice.
   *
   * @param edge Which edge to sum.
   * @param stickyOnly True to count only regions actually pinned to the edge.
   */
  private _sum(edge: MlvPageStickyEdge, stickyOnly: boolean): number {
    const candidates = this._regions().filter((region) => {
      if (region.edge !== edge) {
        return false;
      }
      if (!stickyOnly) {
        return true;
      }
      return (
        region.sticky() ||
        (region.followsChromeDefault === true && this.chromeSticky())
      );
    });

    return candidates.reduce((total, region) => {
      const nested = candidates.some(
        (other) => other !== region && other.element.contains(region.element),
      );
      return nested ? total : total + region.blockSize();
    }, 0);
  }

  /**
   * @private Writes one pixel length onto the page host, or removes it when
   * the value is zero so a consumer's own declaration is not shadowed by a
   * meaningless `0px`.
   */
  private _publish(property: string, value: number): void {
    const style = this._host.nativeElement.style;
    if (value <= 0) {
      style.removeProperty(property);
      return;
    }
    style.setProperty(property, `${roundPx(value)}px`);
  }
}

/**
 * Convenience wrapper that registers a region for the lifetime of the calling
 * component and publishes its viewport obstruction where the region asks for
 * it. Returns nothing: teardown is bound to the caller's `DestroyRef`.
 *
 * Intended to be called from an injection context.
 *
 * @param region The region to register with the enclosing page, if any.
 */
export function registerPageRegion(region: MlvPageRegion): void {
  const geometry = inject(MlvPageGeometry, { optional: true });
  const destroyRef = inject(DestroyRef);
  if (!geometry) {
    return;
  }
  const release = geometry.registerRegion(region);
  destroyRef.onDestroy(release);
}
