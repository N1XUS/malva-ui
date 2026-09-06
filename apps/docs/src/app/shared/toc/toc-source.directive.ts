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
 * @private Converts heading text into a URL-safe slug, matching the build-time
 * MDX plugin's `slugify` so an already-id'd MDX heading keeps its anchor.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Collects the `h2`–`h4` headings under `host`, assigns each a **unique** id
 * (preferring an existing id, suffixing `-2`, `-3`, … on collision) and returns
 * the matching ToC entries in document order. Mutates the heading elements'
 * `id`s in place so `getElementById`, ToC anchors, and `@for track slug` all
 * agree even when two headings share a title. Headings with no text are skipped.
 *
 * Headings inside an **editable region** (`[contenteditable]`, e.g. the Tiptap
 * document of an `mlv-editor` preview on the `/editor` page) are skipped
 * entirely: they are user document content rather than page structure, and the
 * id write would land in DOM the editor owns — ProseMirror reverts foreign
 * attribute mutations on its next flush, leaving a dead ToC anchor behind.
 * The attribute-presence selector also covers readonly editors, which render
 * `contenteditable="false"` but still manage their own DOM.
 *
 * Headings a **live preview renders itself** (`.example-container__preview`) are
 * skipped for the same reason: they belong to the demonstrated component, not to
 * the page. `mlv-scheduler` renders its range title as an `<h2>`, so without this
 * every example on `/scheduler` would publish "31 Aug – 6 Sept 2026" into "On
 * this page". MDX prose headings live outside the preview box and are kept.
 *
 * Exported for unit testing; used by {@link DocsTocSourceDirective}.
 */
export function collectTocEntries(host: HTMLElement): TocEntry[] {
  const headings = Array.from(host.querySelectorAll<HTMLElement>('h2, h3, h4'));
  const used = new Set<string>();
  const entries: TocEntry[] = [];

  for (const el of headings) {
    if (el.closest('[contenteditable], .example-container__preview')) continue;

    const text = (el.textContent ?? '').trim();
    if (!text) continue;

    const base = el.id || slugify(text);
    if (!base) continue;

    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    el.id = slug;

    entries.push({ level: Number(el.tagName[1]) || 2, text, slug });
  }

  return entries;
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
