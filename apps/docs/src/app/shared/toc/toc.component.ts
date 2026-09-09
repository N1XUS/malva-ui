import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { Subscription } from 'rxjs';
import { fromEvent, merge } from 'rxjs';
import type { TocEntry } from './toc.types';

/**
 * Sticky "On this page" sidebar. Renders the active doc panel's headings (fed via
 * the `entries` input from `DocsTocService`) and highlights the one currently
 * under the viewport top edge.
 *
 * ### Scrollspy
 *
 * The previous implementation compared `el.offsetTop` (offset-parent-relative)
 * against `window.scrollY` (document-absolute) — mismatched coordinate spaces, so
 * the wrong heading highlighted — and relied on a page-global scroll scan that
 * cannot work now that only the **active** tab panel is mounted.
 *
 * It is replaced by an `IntersectionObserver` over the heading elements resolved
 * by id from the mounted panel. The observer's `rootMargin` shifts the viewport's
 * top edge down by the 70px fixed action bar and collapses the bottom so only a
 * thin band near the top is "active"; the topmost heading in that band (first in
 * document order) becomes active. No manual scroll math, and it tracks whichever
 * panel is currently mounted because the elements are re-resolved whenever
 * `entries` changes.
 *
 * ### Why the column is never collapsed
 *
 * The host used to carry `docs-toc--hidden` (`display: none`) whenever
 * `entries` was empty. `.docs-shell__main-area` is a flex row, so that took the
 * 14rem column *and* the row's 1.5rem gap out of the flow — and the entry list
 * is empty for the whole window between a navigation landing and the new
 * panel's heading scan settling. The reading column therefore widened by 248px
 * and snapped back on every navigation to an uncached route (measured: 932px →
 * 1180px → 932px). The box is now unconditional above the 1200px tier and the
 * `@if` inside the template is what empties it, so the gutter is shell
 * geometry rather than page content. Below 1200px the media query still
 * removes it outright, which is a static tier and never a transition.
 *
 * ### Heading anchors
 *
 * A heading is addressable. Clicking an entry publishes `#<slug>` onto the URL
 * so the reader can copy or reload it, and a URL that already carries a
 * fragment scrolls to that heading as soon as the mounted panel publishes its
 * headings — which is the earliest moment the element exists, since the panel's
 * scan is debounced behind MDX resolving. Both go through this component
 * because it is the one place that knows a slug names a real heading; the fixed
 * action bar is cleared by `scroll-padding-top` on the scrollport, so neither
 * path does offset arithmetic.
 *
 * The fragment is written with `history.replaceState`, not a router
 * navigation: a navigation emits `NavigationEnd`, and the shell's own
 * post-navigation handler resets scroll to the top, so routing to the heading
 * would scroll away from it. Replacing rather than pushing keeps a long page's
 * worth of heading clicks out of the back stack.
 *
 * A load-time scroll is followed by a short re-alignment window, because the
 * page is still growing underneath it. The examples below the target mount
 * over the next few frames, and Chromium's scroll anchoring holds whichever
 * node it picked rather than the one that was asked for — measured on
 * `/button#example-4`: the scroll landed the wrapper at the correct 88px, then
 * anchoring settled on a descendant and left the wrapper's top at 11px, back
 * under the action bar. The window re-asserts the target while its document
 * offset is still moving, and yields the moment the reader touches the page.
 */
@Component({
  selector: 'docs-toc',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toc.component.html',
  styleUrl: './toc.component.scss',
  host: {
    class: 'docs-toc',
  },
})
export class DocsTableOfContentsComponent {
  /** The active panel's ToC entries (published to `DocsTocService`). */
  readonly entries = input<TocEntry[]>([]);

  /** The slug of the currently active heading (scroll-spy). */
  readonly activeSlug = signal<string>('');

  /** Derived: whether this component has any content to show. */
  readonly hasEntries = computed(() => this.entries().length > 0);

  /**
   * @private Top offset (px) of the fixed action bar; the scrollspy band starts
   * below it so a heading is "active" only once it clears the bar.
   */
  private static readonly _ACTION_BAR_OFFSET = 70;

  /**
   * @private How long a load-time landing keeps re-asserting itself while the
   * page grows under it. Long enough to cover the examples mounting (measured
   * at ~150ms on `/button`), short enough that it can never be mistaken for the
   * page moving on its own.
   */
  private static readonly _SETTLE_MS = 1000;

  /**
   * @private Frames the target's offset must hold still for before the
   * re-alignment window closes early.
   */
  private static readonly _SETTLE_STABLE_FRAMES = 3;

  /** @private Per-slug intersection state, updated from observer callbacks. */
  private readonly _visible = new Map<string, boolean>();

  /** @private The live IntersectionObserver, torn down and rebuilt on `entries` change. */
  private _observer: IntersectionObserver | null = null;

  /**
   * @private The document this component renders into. Injected rather than
   * reached through the ambient global so the headings resolved here belong to
   * the same document the component lives in.
   */
  private readonly _document = inject(DOCUMENT);

  /**
   * @private The fragment already honoured. `entries` republishes on every tab
   * switch, and without this the reader would be yanked back to the deep-linked
   * heading each time they moved between Examples and API.
   */
  private _consumedFragment: string | null = null;

  /** @private Pending re-alignment frame, cancelled on destroy or on a scroll. */
  private _settleFrame: number | null = null;

  /**
   * @private The reader-input listeners that end the re-alignment window. Its
   * lifetime is one landing, not the component's, so it is released here rather
   * than through `takeUntilDestroyed` — which would leak every earlier landing.
   */
  private _settleStop: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._disconnect();
      this._cancelSettle();
    });

    // Rebuild the observer whenever the mounted panel republishes its headings.
    effect(() => {
      const entries = this.entries();
      this._rebuildObserver(entries);
      // The panel has just published, so its headings are in the DOM — the
      // earliest point a deep link can be honoured.
      this._scrollToFragment();
    });
  }

  /**
   * Smooth-scrolls the heading with the given slug into view and marks it active
   * immediately (so the click feels responsive before the observer catches up).
   */
  scrollTo(slug: string, event: Event): void {
    event.preventDefault();
    const el = this._document.getElementById(slug);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeSlug.set(slug);
    this._publishFragment(slug);
  }

  /**
   * The URL a heading's slug is addressable at. Path-absolute on purpose:
   * `apps/docs` serves a `<base href="/">`, and a relative `#slug` is resolved
   * against the **base** URL rather than the current one — so a bare fragment
   * reads `/#variants` in the address bar and on a copied link, and lands the
   * reader on the home page.
   */
  fragmentHref(slug: string): string {
    const location = this._document.defaultView?.location;
    const base = location ? `${location.pathname}${location.search}` : '';
    return `${base}#${encodeURIComponent(slug)}`;
  }

  /**
   * @private Puts the heading's URL on the address bar without navigating, so
   * it is copyable and survives a reload. See the class doc for why this is
   * `replaceState` and not the router.
   */
  private _publishFragment(slug: string): void {
    this._consumedFragment = slug;
    const view = this._document.defaultView;
    view?.history.replaceState(view.history.state, '', this.fragmentHref(slug));
  }

  /**
   * @private Honours a fragment the URL arrived with, once the element it names
   * actually exists. Scrolls instantly rather than smoothly: this is a page
   * load landing where it was asked to, not a movement the reader should have
   * to watch.
   *
   * The target is resolved by id rather than against the entry list, so a
   * heading's own permalink — which addresses the example wrapper (`#example-2`)
   * and never appears in `entries` — deep-links as well as a ToC slug does. A
   * fragment naming nothing stays unconsumed, so a later publish that does mount
   * the element still honours it.
   */
  private _scrollToFragment(): void {
    const hash = this._document.defaultView?.location.hash ?? '';
    if (!hash.startsWith('#')) return;

    const slug = decodeURIComponent(hash.slice(1));
    if (!slug || slug === this._consumedFragment) return;

    const el = this._document.getElementById(slug);
    if (!el) return;

    this._consumedFragment = slug;
    this.activeSlug.set(slug);
    this._alignTo(el);
  }

  /**
   * @private Scrolls `el` to the top of the scrollport, then holds it there
   * while the rest of the page mounts. See the class doc for the anchoring
   * behaviour this exists for. The window closes on whichever comes first: the
   * target's document offset holding still for a few frames, the deadline, or
   * the reader scrolling — their scroll always wins over ours.
   */
  private _alignTo(el: HTMLElement): void {
    el.scrollIntoView({ block: 'start' });

    const view = this._document.defaultView;
    // No frame clock (a server render, or a jsdom without a visual loop) means
    // nothing is going to move under us either.
    if (!view?.requestAnimationFrame) return;

    const offset = (): number =>
      Math.round(el.getBoundingClientRect().top + view.scrollY);

    let last = offset();
    let stable = 0;
    const deadline =
      view.performance.now() + DocsTableOfContentsComponent._SETTLE_MS;

    const stop = merge(
      fromEvent(view, 'wheel', { passive: true }),
      fromEvent(view, 'touchstart', { passive: true }),
      fromEvent(view, 'keydown'),
    ).subscribe(() => this._cancelSettle());

    const step = (): void => {
      const now = offset();
      if (now === last) {
        stable++;
      } else {
        stable = 0;
        last = now;
        el.scrollIntoView({ block: 'start' });
      }

      if (
        stable >= DocsTableOfContentsComponent._SETTLE_STABLE_FRAMES ||
        view.performance.now() >= deadline
      ) {
        this._cancelSettle();
        return;
      }
      this._settleFrame = view.requestAnimationFrame(step);
    };

    this._cancelSettle();
    this._settleStop = stop;
    this._settleFrame = view.requestAnimationFrame(step);
  }

  /** @private Ends the re-alignment window, whatever closed it. */
  private _cancelSettle(): void {
    if (this._settleFrame !== null) {
      this._document.defaultView?.cancelAnimationFrame(this._settleFrame);
      this._settleFrame = null;
    }
    this._settleStop?.unsubscribe();
    this._settleStop = null;
  }

  /**
   * @private Disconnects the previous observer, resets intersection state, and
   * observes the heading element of every current entry (resolved by id from the
   * mounted panel). Seeds the active slug to the first heading so something is
   * highlighted before any scrolling.
   */
  private _rebuildObserver(entries: TocEntry[]): void {
    this._disconnect();
    this._visible.clear();

    if (entries.length === 0) {
      this.activeSlug.set('');
      return;
    }

    // Keep the active slug if it still exists, otherwise fall back to the first.
    if (!entries.some((e) => e.slug === this.activeSlug())) {
      this.activeSlug.set(entries[0].slug);
    }

    if (typeof IntersectionObserver === 'undefined') return;

    this._observer = new IntersectionObserver(
      (records) => this._onIntersect(records),
      {
        // Shift the top edge below the action bar; collapse the bottom so only a
        // band near the top counts as "active".
        rootMargin: `-${DocsTableOfContentsComponent._ACTION_BAR_OFFSET}px 0px -70% 0px`,
        threshold: 0,
      },
    );

    for (const entry of entries) {
      const el = this._document.getElementById(entry.slug);
      if (el) this._observer.observe(el);
    }
  }

  /**
   * @private Handles observer callbacks: records each heading's intersection
   * state, then promotes the topmost intersecting heading to active.
   */
  private _onIntersect(records: IntersectionObserverEntry[]): void {
    for (const record of records) {
      const id = (record.target as HTMLElement).id;
      if (id) this._visible.set(id, record.isIntersecting);
    }
    this._recomputeActive();
  }

  /**
   * @private Sets the active slug to the first entry (document order) whose
   * heading is currently intersecting the active band. If none intersect (e.g.
   * scrolled between two far-apart headings) the current active slug is kept.
   */
  private _recomputeActive(): void {
    const first = this.entries().find((e) => this._visible.get(e.slug));
    if (first) this.activeSlug.set(first.slug);
  }

  /** @private Tears down the current observer. */
  private _disconnect(): void {
    this._observer?.disconnect();
    this._observer = null;
  }
}
