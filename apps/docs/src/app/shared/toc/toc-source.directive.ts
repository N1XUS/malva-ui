import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
} from '@angular/core';
import { DocsTocService } from './toc.service';
import type { TocEntry } from './toc.types';

/**
 * The class a heading must carry to be page structure. Only these are collected
 * into the ToC, given an id and given a working permalink; anything else on the
 * page is content that happens to be a heading.
 */
export const DOCS_HEADING_CLASS = 'docs-heading';

/** The permalink rendered inside a {@link DOCS_HEADING_CLASS} heading. */
export const DOCS_HEADING_ANCHOR_CLASS = 'docs-heading__anchor';

/**
 * Converts heading text into a URL-safe slug, matching the build-time MDX
 * plugin's `slugify` so an already-id'd MDX heading keeps its anchor. Exported
 * so a heading authored in a template can emit the same slug the scan will
 * later confirm.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Collects the `.docs-heading` elements under `host`, assigns each a **unique**
 * id (preferring an existing id, suffixing `-2`, `-3`, … on collision) and
 * returns the matching ToC entries in document order. Mutates the heading
 * elements’ `id`s in place so `getElementById`, ToC anchors, and
 * `@for track slug` all agree even when two headings share a title. Headings
 * with no text are skipped.
 *
 * **Opt-in by class, not by tag.** A docs page is full of `h2`–`h4` elements
 * that are not page structure: the Tiptap document inside an `mlv-editor`
 * preview on `/editor`, and `mlv-scheduler`’s range title, which would have
 * published "31 Aug – 6 Sept 2026" once per example on `/scheduler`. Selecting
 * by tag meant enumerating those exclusions and adding one for every future
 * component that renders a heading of its own; selecting by class means a
 * heading is listed because its author said it is a section, which no library
 * component can accidentally satisfy. It also keeps the id write out of DOM
 * ProseMirror owns, which it reverts on its next flush.
 *
 * The permalink inside a heading is finished here too — see
 * {@link syncHeadingAnchor}.
 *
 * Exported for unit testing; used by {@link DocsTocSourceDirective}.
 */
export function collectTocEntries(host: HTMLElement): TocEntry[] {
  const headings = Array.from(
    host.querySelectorAll<HTMLElement>(`.${DOCS_HEADING_CLASS}`),
  );
  const used = new Set<string>();
  const entries: TocEntry[] = [];

  for (const el of headings) {
    const text = headingText(el);
    if (!text) continue;

    const base = el.id || slugify(text);
    if (!base) continue;

    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    el.id = slug;
    syncHeadingAnchor(el, slug, text);

    entries.push({ level: Number(el.tagName[1]) || 2, text, slug });
  }

  return entries;
}

/**
 * @private The heading’s own text, with the permalink’s contribution removed —
 * the anchor is a child of the heading, so `textContent` would otherwise fold
 * its accessible label into both the ToC entry and the slug.
 */
function headingText(el: HTMLElement): string {
  const anchor = el.querySelector<HTMLElement>(`.${DOCS_HEADING_ANCHOR_CLASS}`);
  const raw = el.textContent ?? '';
  const label = anchor?.textContent ?? '';
  return (label ? raw.replace(label, '') : raw).trim();
}

/**
 * @private Points a heading’s permalink at the id that heading actually ended
 * up with, and names it after the heading.
 *
 * Both halves belong here rather than where the markup is authored. The
 * **href** has to be path-absolute: `apps/docs` serves a `<base href="/">`, and
 * a bare `#slug` resolves against the base URL rather than the current one, so
 * the link a reader copies off `/button` reads `/#variants` and lands on the
 * home page. And a slug is only final after the collision pass above — the
 * author of the markup cannot know theirs is the second "Basic usage" on the
 * page. The **`aria-label`** is set from the resolved heading text, so the
 * permalinks on a page are told apart by name instead of sharing one.
 */
function syncHeadingAnchor(el: HTMLElement, slug: string, text: string): void {
  const anchor = el.querySelector<HTMLAnchorElement>(
    `.${DOCS_HEADING_ANCHOR_CLASS}`,
  );
  if (!anchor) return;

  const location = el.ownerDocument.defaultView?.location;
  const base = location ? `${location.pathname}${location.search}` : '';
  anchor.setAttribute('href', `${base}#${encodeURIComponent(slug)}`);
  anchor.setAttribute('aria-label', `Link to ${text}`);
}

/**
 * Publishes the headings of the doc panel it is applied to (the **Examples**
 * panel) to {@link DocsTocService}, so the shell's "On this page" sidebar tracks
 * whichever tab is mounted.
 *
 * The examples content is `[innerHTML]`-rendered MDX that resolves asynchronously,
 * so a one-shot scan is not enough: the directive scans on first render and then
 * re-scans on any DOM mutation (debounced to an animation frame) until the
 * content settles. It scans `h2`–`h4`, assigns each a **unique** id (preferring
 * the MDX-provided id, suffixing on collision) so `getElementById`, the ToC
 * anchors, and `@for track slug` are unambiguous even when two examples share a
 * heading, then publishes the resulting entries.
 *
 * On teardown it clears the ToC, but only if it is still the current publisher —
 * a later panel that already republished is left untouched (tab-switch race).
 *
 * The **API** panel does not use this directive: `docs-api-viewer` publishes its
 * headings directly from the extracted data.
 */
@Directive({
  selector: '[docsTocSource]',
})
export class DocsTocSourceDirective {
  /** @private The panel element whose headings feed the ToC. */
  private readonly _host = inject(ElementRef<HTMLElement>).nativeElement;

  /** @private The shared ToC service the headings are published to. */
  private readonly _tocService = inject(DocsTocService);

  /** @private Observes async MDX insertion so late headings still publish. */
  private _mutationObserver: MutationObserver | null = null;

  /** @private Pending debounced-scan animation-frame handle. */
  private _scanFrame: number | null = null;

  /** @private Serialized last-published entries, to skip redundant publishes. */
  private _lastPublished = '';

  constructor() {
    afterNextRender(() => {
      this._scan();
      this._mutationObserver = new MutationObserver(() => this._scheduleScan());
      this._mutationObserver.observe(this._host, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this._mutationObserver?.disconnect();
      if (this._scanFrame !== null) cancelAnimationFrame(this._scanFrame);
      this._tocService.clear(this);
    });
  }

  /** @private Coalesces a burst of mutations into a single scan next frame. */
  private _scheduleScan(): void {
    if (this._scanFrame !== null) return;
    this._scanFrame = requestAnimationFrame(() => {
      this._scanFrame = null;
      this._scan();
    });
  }

  /**
   * @private Collects the host's headings (assigning unique ids) and publishes
   * the resulting ToC entries, skipping an unchanged republish so a burst of
   * MDX-insertion mutations does not churn the sidebar.
   */
  private _scan(): void {
    const entries = collectTocEntries(this._host);
    const serialized = JSON.stringify(entries);
    if (serialized === this._lastPublished) return;
    this._lastPublished = serialized;
    this._tocService.publish(this, entries);
  }
}
