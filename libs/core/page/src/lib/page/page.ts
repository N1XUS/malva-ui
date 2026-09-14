import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { mlvNextId } from '@malva-ui/cdk/utils';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvPageSnapController } from './page-snap-controller';
import type { MlvPageSnapBehavior, MlvPageSnapState } from './page-snap-state';
import { MlvPageGeometry } from './page-geometry';
import { MlvPageRegistry } from './page-registry';
import { connectPageScrollport } from './page-scrollport';

/**
 * Whether the engine can scrub a custom property from a scroll timeline.
 * Firefox has not shipped scroll-driven animations at all and Safari only did
 * in 26, so this is a real branch rather than a formality.
 */
function supportsScrollTimeline(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('animation-timeline', 'scroll()')
  );
}

/**
 * Which element scrolls a page — and therefore which one the geometry contract
 * measures, the collapse timeline is scrubbed by, and `expand()` returns to.
 *
 * - `'page'` (default) gives the page its own bounded scrollport, rendered as
 *   an `mlv-scrollbar`. The page is as tall as the box it is in and its content
 *   scrolls inside it, under sticky chrome.
 * - `'content'` gives the page the same bounded box and **no scrollport at
 *   all**: chrome sits in auto tracks and everything else shares one
 *   `minmax(0, 1fr)` body track, for a page whose body is a fixed-height table,
 *   a split pane or a canvas that scrolls itself. Nothing is inferred — a pane
 *   that wants to drive the collapse timeline says so with `[mlvPageScroller]`.
 * - `'document'` leaves the page in natural document flow, as tall as its
 *   content, and points the whole contract at the document scrollport: sticky
 *   chrome sticks to the viewport, and the collapse timeline is scrubbed by
 *   document scrolling.
 */
export type MlvPageScroll = 'page' | 'content' | 'document';

/** Controls the inset around projected page content. */
export type MlvPagePadding = 'none' | 's' | 'm' | 'l';

/** Controls whether the page uses the anchored application-canvas treatment. */
export type MlvPageSurface = 'anchored' | 'flat';

/**
 * Main page surface and scroll owner. Apply it to the page's native `<main>`
 * landmark and compose headers, content grids, and feature components inside.
 *
 * Provides `MlvPageGeometry`, which publishes the measured chrome geometry as
 * custom properties on this host, and `MlvPageSnapController`, whose
 * scroll-scrubbed progress reaches descendants as the `--mlv-page-snap` custom
 * property (0 expanded .. 1 snapped) for them to interpolate their snap state
 * from.
 */
@Component({
  // Attribute-selector component intentionally enhances the native main landmark.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'main[mlvPage]',
  // One `<ng-content>`, reached through a template both branches instantiate:
  // a second `<ng-content>` in the other branch would receive nothing, because
  // projected nodes go to the first matching slot and only that one.
  template: `
    <ng-template #canvas>
      <div class="mlv-page__inner"><ng-content /></div>
    </ng-template>

    @if (scroll() === 'page') {
      <mlv-scrollbar class="mlv-page__scrollbar">
        <ng-container [ngTemplateOutlet]="canvas" />
      </mlv-scrollbar>
    } @else {
      <ng-container [ngTemplateOutlet]="canvas" />
    }
  `,
  imports: [MlvScrollbar, NgTemplateOutlet],
  styleUrl: './page.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MlvPageSnapController, MlvPageGeometry],
  host: {
    class: 'mlv-page',
    'data-slot': 'page',
    '[id]': 'id()',
    tabindex: '-1',
    '[class.mlv-page--scroll-page]': 'scroll() === "page"',
    '[class.mlv-page--scroll-content]': 'scroll() === "content"',
    '[class.mlv-page--scroll-document]': 'scroll() === "document"',
    '[class.mlv-page--snapping]': '_snapping()',
    '[class.mlv-page--overlapped]': '_overlapped()',
    '[class.mlv-page--padding-none]': 'padding() === "none"',
    '[class.mlv-page--padding-s]': 'padding() === "s"',
    '[class.mlv-page--padding-m]': 'padding() === "m"',
    '[class.mlv-page--padding-l]': 'padding() === "l"',
    '[class.mlv-page--surface-anchored]': 'surface() === "anchored"',
    '[class.mlv-page--surface-flat]': 'surface() === "flat"',
    '[class.mlv-page--sticky-header]': 'stickyHeader()',
    '[style.--mlv-page-max-width]': 'maxWidth()',
  },
})
export class MlvPage {
  /** Unique landmark id; set explicitly when targeting the page from a skip link. */
  readonly id = input(mlvNextId('mlv-page'));

  /** Which element scrolls this page. See {@link MlvPageScroll}. */
  readonly scroll = input<MlvPageScroll>('page');

  /** Optional maximum width for the centred inner page canvas. */
  readonly maxWidth = input<string | null>(null);

  /** Selects the responsive inset applied around projected page content. */
  readonly padding = input<MlvPagePadding>('m');

  /** Selects the anchored rounded canvas or a completely flat surface. */
  readonly surface = input<MlvPageSurface>('anchored');

  /**
   * Makes a projected `mlv-page-header` sticky within this page's scroll
   * container. The page owns the flag because the page owns the scrollport the
   * header would stick to; a header has no way to know whether there is one.
   */
  readonly stickyHeader = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * How the collapsing top chrome answers scrolling — the platform triad.
   * `'exitUntilCollapsed'` (default) collapses on the way down and re-expands
   * as the reader returns to the top; `'enterAlways'` brings the chrome back on
   * any pull down; `'pinned'` never collapses at all and only changes its
   * separation from the content.
   *
   * There is no scroll-distance input: the timeline is exactly as long as the
   * chrome the page measured itself giving up.
   */
  readonly snapBehavior = input<MlvPageSnapBehavior>('exitUntilCollapsed');

  /**
   * Snap state of this page's collapsing top chrome. A component that *hosts*
   * the page reaches it through `viewChild(MlvPage).snap` — for instance to
   * `expand()` the chrome before moving focus into it, which reveals every
   * collapsed region synchronously and then scrolls the page back to the top.
   */
  get snap(): MlvPageSnapState {
    return this._snap;
  }

  /**
   * Geometry coordinator of this page. Chrome regions register themselves with
   * it and it publishes the measured sizes as custom properties on this host,
   * so a consumer sticks an aside at `--mlv-page-sticky-inset-block-start`
   * instead of hand-measuring the header. A component that only *hosts* the
   * page reaches it through `viewChild(MlvPage).geometry`.
   */
  get geometry(): MlvPageGeometry {
    return this._geometry;
  }

  /**
   * @protected Whether any chrome actually collapses on this page.
   *
   * Drives `mlv-page--snapping`, which is the only thing that turns scroll
   * anchoring off. Anchoring is a browser feature that keeps a reader's place
   * when content above them resizes, and suppressing it is compensation for the
   * snap timeline resizing the chrome — not a policy every page should get.
   */
  protected readonly _snapping = computed(
    () => this._snap.collapseDistance() > 0,
  );

  /**
   * @protected Whether the chrome is currently sitting over scrolled content.
   *
   * Drives `mlv-page--overlapped`, which is where the chrome bars' one
   * separation signal — a one-rung fill step — is declared, so the header, the
   * summary strip and the dock cannot answer it differently. Deliberately the
   * snap controller's `overlapped` and not its `progress`: chrome pinned at
   * full height collapses by nothing and still has to say it is over content.
   */
  protected readonly _overlapped = computed(() => this._snap.overlapped());

  /** @private The page-owned scrollbar, rendered only in `scroll="page"`. */
  private readonly _scrollbar = viewChild(MlvScrollbar);

  /** @private Zone reference; the scroll listener runs outside the zone. */
  private readonly _ngZone = inject(NgZone);

  /** @private Cleans up the native scroll listener. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Snap state provided to descendants and scrubbed from scroll. */
  private readonly _snap = inject(MlvPageSnapController);

  /** @private Geometry coordinator provided to descendant chrome regions. */
  private readonly _geometry = inject(MlvPageGeometry);

  /** @private CDK registry every overlay's scroll strategy listens to. */
  private readonly _scrollDispatcher = inject(ScrollDispatcher);

  /** @private Host element carrying the published snap geometry. */
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Owning document; the scrollport in `scroll="document"`. */
  private readonly _document = inject(DOCUMENT);

  /**
   * @private Application-wide registry of live pages. Route focus, the skip
   * link and scroll restoration all run outside any page's injector, so the
   * page publishes itself rather than being searched for by selector.
   */
  private readonly _registry = inject(MlvPageRegistry);

  constructor() {
    this._destroyRef.onDestroy(
      this._registry.register({
        element: this._elementRef.nativeElement,
        geometry: this._geometry,
        snap: this._snap,
      }),
    );

    // The page-level sticky default is what makes a projected header sticky
    // without the header opting in, so the geometry contract has to see it.
    effect(() => this._geometry.chromeSticky.set(this.stickyHeader()));
    effect(() => this._snap.setBehavior(this.snapBehavior()));

    afterNextRender(() => {
      const deps = {
        geometry: this._geometry,
        snap: this._snap,
        scrollDispatcher: this._scrollDispatcher,
        ngZone: this._ngZone,
        destroyRef: this._destroyRef,
      };

      if (this.scroll() === 'page') {
        const viewport = this._scrollbar()?.viewportElement;
        if (viewport) {
          connectPageScrollport(
            {
              scroller: viewport,
              eventTarget: viewport,
              registerWithScrollDispatcher: true,
            },
            deps,
          );
        }
        return;
      }

      if (this.scroll() === 'document') {
        const root = this._document.documentElement;
        connectPageScrollport(
          {
            scroller: root,
            // The document element's `scroll` event is delivered on the
            // document, not on the element itself.
            eventTarget: this._document,
            // The CDK dispatcher already watches the window for exactly this
            // scroller; registering it again would make every overlay in the
            // document count one scroll twice.
            registerWithScrollDispatcher: false,
          },
          deps,
        );
      }

      // `scroll="content"` deliberately connects nothing. A page whose body
      // scrolls itself has no scrollport the page can name, and inferring one
      // from the first overflowing descendant is how a nested `mlv-chat` ends
      // up driving the header collapse. `[mlvPageScroller]` is the opt-in.
    });

    // Two lengths, both written from measurements rather than per scroll event:
    // how long the timeline is, and how much height the chrome has given up at
    // the current progress. Everything else is interpolated in CSS from them.
    afterRenderEffect(() => this._publishSnapGeometry());
  }

  /**
   * @private Publishes the snap timeline's own geometry.
   *
   * `--mlv-page-snap-range` is the scroll distance the timeline spans, which is
   * the block size the chrome measured itself giving up. It feeds the CSS
   * scroll timeline's `animation-range` and the compensation spacer, so both
   * follow a font load or a locale change with no baseline to go stale.
   *
   * `--mlv-page-snap-override` is the escape hatch the scroll timeline is built
   * around: the animated property loses to nothing except a value read *through*
   * it, because animations outrank normal author declarations and a paused
   * animation still applies its value. The page writes the override whenever it
   * — not the timeline — is the source of progress: no scroll-timeline support,
   * a behaviour the timeline cannot express (`pinned`, `enterAlways`), a
   * degenerate zero-length range, or a scroll mode with no CSS timeline to
   * express at all (`content`, where the scroller is a consumer's own pane).
   *
   * Both go on **this host**, above every element that reads them. The chain
   * `--mlv-page-snap: var(--mlv-page-snap-override, var(--mlv-page-scroll-snap))`
   * is declared lower down — on the scrollport, or on the canvas when there
   * isn't one — and resolves each `var()` there, inheriting the override from
   * here. Writing it on the host rather than at each of those places is what
   * keeps one write correct for all three scroll modes.
   */
  private _publishSnapGeometry(): void {
    const host = this._elementRef.nativeElement;
    const distance = this._snap.collapseDistance();
    host.style.setProperty(
      '--mlv-page-snap-range',
      `${Math.round(distance * 100) / 100}px`,
    );

    const progress = this._snap.progress();
    const timelineOwnsProgress =
      distance > 0 &&
      this.scroll() !== 'content' &&
      this.snapBehavior() === 'exitUntilCollapsed' &&
      supportsScrollTimeline();

    if (timelineOwnsProgress) {
      host.style.removeProperty('--mlv-page-snap-override');
    } else {
      host.style.setProperty(
        '--mlv-page-snap-override',
        String(Math.round(progress * 1000) / 1000),
      );
    }
  }
}
