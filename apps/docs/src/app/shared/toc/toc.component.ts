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

  /** @private Per-slug intersection state, updated from observer callbacks. */
  private readonly _visible = new Map<string, boolean>();

  /** @private The live IntersectionObserver, torn down and rebuilt on `entries` change. */
  private _observer: IntersectionObserver | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this._disconnect());

    // Rebuild the observer whenever the mounted panel republishes its headings.
    effect(() => {
      const entries = this.entries();
      this._rebuildObserver(entries);
    });
  }

  /**
   * Smooth-scrolls the heading with the given slug into view and marks it active
   * immediately (so the click feels responsive before the observer catches up).
   */
  scrollTo(slug: string, event: Event): void {
    event.preventDefault();
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.activeSlug.set(slug);
    }
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
      const el = document.getElementById(entry.slug);
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
