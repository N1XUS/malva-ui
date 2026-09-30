import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  isDevMode,
  linkedSignal,
  output,
  signal,
  untracked,
  ViewEncapsulation,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { fromEvent, merge, type Observable } from 'rxjs';
import {
  mlvEditorFocusContent,
  type MlvEditorToolbarContext,
} from '../editor-toolbar-context';
import { MLV_EDITOR_HEADING_LINKS } from '../editor/editor-heading-links';
import type { MlvEditorHeadingAnchorOptions } from '../extensions/heading-anchors/editor-heading-anchors';
import type { MlvEditorHeadingLevel } from '../toolbar/editor-heading';
import {
  mlvEditorTocHeadingMargin,
  mlvEditorTocLastIndexAbove,
  mlvEditorTocPlacedTop,
  mlvEditorTocProseMirrorMargin,
  mlvEditorTocRootScroller,
  mlvEditorTocScroller,
  mlvEditorTocScrollerFrame,
} from './editor-toc-geometry';
import {
  collectMlvEditorTocHeadings,
  mlvEditorTocHeadingPos,
  mlvEditorTocHeadingsEqual,
  nestMlvEditorTocItems,
  type MlvEditorTocHeading,
  type MlvEditorTocItem,
  type MlvEditorTocMemo,
} from './editor-toc-headings';
import { MLV_EDITOR_CLEAN_MODE_FALLBACKS } from '../editor-clean-mode-fallbacks';

export type { MlvEditorTocItem } from './editor-toc-headings';

/** @internal Levels listed by default. */
const DEFAULT_LEVELS: readonly MlvEditorHeadingLevel[] = [1, 2, 3];

/** @internal No items, shared so an empty document keeps one reference. */
const NO_HEADINGS: readonly MlvEditorTocHeading[] = [];

/** @internal What the items are built from. */
interface MlvEditorTocItemsSource {
  readonly headings: readonly MlvEditorTocHeading[];
  readonly idPrefix: string | null;
  readonly hrefReady: boolean;
}

/**
 * A table of contents for an `mlv-editor`: a `nav` landmark listing the
 * document's headings as links, marking the one at the reading position with
 * `aria-current="location"`, and scrolling to a heading — then moving the
 * caret into it — when a link is activated.
 *
 * Requires the editor's `headingAnchors`: the ids and links come from
 * `MlvEditorHeadingAnchors`, and without it the TOC lists nothing and warns
 * once in dev mode. Place it anywhere and pass the editor as `context`:
 *
 * ```html
 * <mlv-editor #doc headingAnchors … />
 * <nav mlvEditorToc [context]="doc"></nav>
 * ```
 *
 * Each item's `href` is resolved once, against the location when the item
 * is built, and kept while its heading is unchanged: in-app navigation that
 * leaves the editor mounted does not rebuild it.
 */
@Component({
  selector: 'nav[mlvEditorToc]',
  exportAs: 'mlvEditorToc',
  imports: [NgTemplateOutlet],
  templateUrl: './editor-toc.html',
  styleUrl: './editor-toc.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'editor-toc' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: {
    class: 'mlv-editor-toc',
    '[attr.aria-label]': 'ariaLabel() || _copy().tableOfContents',
  },
})
export class MlvEditorToc {
  /** The editor the TOC lists: an `mlv-editor` (it implements the context). */
  readonly context = input.required<MlvEditorToolbarContext>();

  /** Heading levels listed, in any order. Default `[1, 2, 3]`. */
  readonly levels = input<readonly MlvEditorHeadingLevel[]>(DEFAULT_LEVELS);

  /**
   * Accessible name of the landmark. Default: the localized "Table of
   * contents". Two TOCs on one page need distinct names.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Emits the activated item once its scroll has started — e.g. to close a
   * drawer holding the TOC. Not emitted for a modified click, which the
   * browser handles natively.
   */
  readonly itemClick = output<MlvEditorTocItem>();

  /**
   * @private The items. The previous value is the memo: an entry whose id,
   * level and text are unchanged keeps its item object, and so its `href`.
   */
  private readonly _items = linkedSignal<
    MlvEditorTocItemsSource,
    readonly MlvEditorTocItem[]
  >({
    source: () => ({
      headings: this._headings(),
      idPrefix: this._idPrefix(),
      hrefReady: this._hrefReady(),
    }),
    computation: (source, previous) =>
      this._buildItems(source, previous?.value ?? []),
  });

  /**
   * The listed headings, in document order. The reference is kept while
   * typing leaves every anchor, level and text unchanged.
   */
  readonly items: Signal<readonly MlvEditorTocItem[]> =
    this._items.asReadonly();

  /** Anchor of the heading at the reading position, or `null` above the first. */
  readonly activeAnchor = computed(() => this._activeAnchor());

  /** Whether an editor with the `headingAnchors` extension is connected. */
  readonly ready = computed(() => this._idPrefix() !== null);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private Builds each item's `href` (browser only, see `_hrefReady`). */
  private readonly _links = inject(MLV_EDITOR_HEADING_LINKS);

  /** @private The injected document every listener and lookup is bound to. */
  private readonly _document = inject(DOCUMENT);

  /** @private Releases the listeners and the pending frame. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @protected Localized copy with the optional keys' English fallbacks. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      tableOfContents:
        copy?.tableOfContents ??
        MLV_EDITOR_CLEAN_MODE_FALLBACKS.tableOfContents,
      tableOfContentsEmpty:
        copy?.tableOfContentsEmpty ??
        MLV_EDITOR_CLEAN_MODE_FALLBACKS.tableOfContentsEmpty,
    };
  });

  /** @protected The items nested by level, for the recursive template. */
  protected readonly _tree = computed(() =>
    nestMlvEditorTocItems(this.items()),
  );

  /**
   * @private The extension's `idPrefix` while an editor with
   * `headingAnchors` is connected, else `null`.
   */
  private readonly _idPrefix = signal<string | null>(null);

  /**
   * @private Every anchored heading, any level. Entry-wise equality keeps
   * ordinary typing from notifying.
   */
  private readonly _allHeadings = signal<readonly MlvEditorTocHeading[]>(
    NO_HEADINGS,
    { equal: mlvEditorTocHeadingsEqual },
  );

  /** @private The headings in `levels`, the same reference while unchanged. */
  private readonly _headings = computed(
    () => {
      const levels = this.levels();
      return this._allHeadings().filter((heading) =>
        levels.includes(heading.level),
      );
    },
    { equal: mlvEditorTocHeadingsEqual },
  );

  /**
   * @private Set by the first browser render: links are built only from
   * then on, so the builder never runs on the server (D-B10).
   */
  private readonly _hrefReady = signal(false);

  /** @private Backing state of `activeAnchor`. */
  private readonly _activeAnchor = signal<string | null>(null);

  /** @private Headings per top-level block node (see `MlvEditorTocMemo`). */
  private readonly _memo: MlvEditorTocMemo = new WeakMap();

  /**
   * @private Heading elements for `_elementsFor`, dropped on every document
   * change (ProseMirror may re-render a heading without changing its item).
   */
  private _elements: readonly (HTMLElement | null)[] | null = null;

  /** @private The items `_elements` was looked up for. */
  private _elementsFor: readonly MlvEditorTocItem[] | null = null;

  /** @private The pending active-tracking frame, at most one. */
  private _frame: number | null = null;

  /** @private Whether the first browser render has run. */
  private _rendered = false;

  /** @private Whether the missing-extension warning was logged. */
  private _warned = false;

  constructor() {
    // One transaction subscription per editor, released when it changes.
    effect((onCleanup) => {
      const editor = this.context().editor();
      untracked(() => this._connect(editor, onCleanup));
    });
    // A heading added or removed shifts the ones below it.
    effect(() => {
      this.items();
      untracked(() => this._scheduleMeasure());
    });
    afterNextRender(() => {
      this._rendered = true;
      this._hrefReady.set(true);
      const view = this._document.defaultView;
      const events: Observable<Event>[] = [
        fromEvent(this._document, 'scroll', { capture: true, passive: true }),
      ];
      if (view) events.push(fromEvent(view, 'resize', { passive: true }));
      merge(...events)
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => this._scheduleMeasure());
      this._scheduleMeasure();
    });
    this._destroyRef.onDestroy(() => {
      if (this._frame !== null) {
        this._document.defaultView?.cancelAnimationFrame(this._frame);
        this._frame = null;
      }
    });
  }

  /** @protected Whether `item` is the heading at the reading position. */
  protected _isActive(item: MlvEditorTocItem): boolean {
    return item.anchor === this._activeAnchor();
  }

  /**
   * @protected Scrolls the heading to the reading line and moves the caret
   * into it. A modified click, a non-primary button, or a heading that is
   * not rendered is left to the browser.
   */
  protected _onClick(event: MouseEvent, item: MlvEditorTocItem): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const editor = this.context().editor();
    const content = editor ? mlvEditorTocContent(editor) : null;
    const heading = content ? this._headingElement(content, item.id) : null;
    if (!editor || !content || !heading) return;
    event.preventDefault();
    const scroller = mlvEditorTocScroller(content, this._document);
    if (scroller.classList.contains('mlv-editor__viewport')) {
      scroller.scrollIntoView({ block: 'nearest' });
    }
    const frame = mlvEditorTocScrollerFrame(scroller, this._document);
    const line =
      frame.top +
      mlvEditorTocProseMirrorMargin(editor.view) +
      mlvEditorTocHeadingMargin(heading);
    const delta = heading.getBoundingClientRect().top - line;
    const view = this._document.defaultView;
    const behavior: ScrollBehavior = view?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
      ? 'auto'
      : 'smooth';
    if (scroller === mlvEditorTocRootScroller(this._document)) {
      view?.scrollBy({ top: delta, behavior });
    } else {
      scroller.scrollBy({ top: delta, behavior });
    }
    if (!this.context().disabled()) this._placeCaret(editor, item.anchor);
    this.itemClick.emit(item);
  }

  /**
   * @private Connects `editor`: reads its `idPrefix` and headings, and
   * re-reads the headings on every document change, local or remote.
   */
  private _connect(
    editor: Editor | null,
    onCleanup: (fn: () => void) => void,
  ): void {
    this._elements = null;
    const anchors = editor?.extensionManager.extensions.find(
      (extension) => extension.name === 'headingAnchors',
    );
    if (!editor || !anchors) {
      this._idPrefix.set(null);
      this._allHeadings.set(NO_HEADINGS);
      if (editor) this._warnMissingAnchors();
      return;
    }
    const options = anchors.options as Partial<MlvEditorHeadingAnchorOptions>;
    this._idPrefix.set(
      typeof options.idPrefix === 'string' ? options.idPrefix : '',
    );
    this._read(editor);
    const onTransaction = ({
      transaction,
    }: {
      transaction: { docChanged: boolean };
    }) => {
      if (transaction.docChanged) this._read(editor);
    };
    editor.on('transaction', onTransaction);
    onCleanup(() => editor.off('transaction', onTransaction));
  }

  /** @private Re-reads the headings of `editor`'s document. */
  private _read(editor: Editor): void {
    this._elements = null;
    this._allHeadings.set(
      collectMlvEditorTocHeadings(editor.state.doc, this._memo),
    );
  }

  /**
   * @private The items for `source.headings`, reusing the item object from
   * `previousItems` — and so its `href` — for every entry whose id, level and
   * text are unchanged. Pure: the caller keeps the previous items. An `href`
   * is therefore resolved once per heading, against the location at build
   * time; in-app navigation does not rebuild it.
   */
  private _buildItems(
    { headings, idPrefix, hrefReady }: MlvEditorTocItemsSource,
    previousItems: readonly MlvEditorTocItem[],
  ): readonly MlvEditorTocItem[] {
    if (idPrefix === null) return [];
    const previous = new Map(previousItems.map((item) => [item.id, item]));
    const items = headings.map((heading): MlvEditorTocItem => {
      const id = `${idPrefix}${heading.anchor}`;
      const old = previous.get(id);
      if (
        old &&
        old.level === heading.level &&
        old.text === heading.text &&
        (old.href !== null) === hrefReady
      ) {
        return old;
      }
      return {
        anchor: heading.anchor,
        id,
        level: heading.level,
        text: heading.text,
        href: hrefReady
          ? this._links.href({ anchor: heading.anchor, id })
          : null,
      };
    });
    return items;
  }

  /** @private Queues one active-tracking frame, if none is pending. */
  private _scheduleMeasure(): void {
    const view = this._document.defaultView;
    if (!this._rendered || this._frame !== null || !view) return;
    this._frame = view.requestAnimationFrame(() => {
      this._frame = null;
      this._measure();
    });
  }

  /**
   * @private Marks the last heading at or above the reading line — or, with
   * the scroller at its end, the last heading above its bottom edge, so a
   * short final section still activates. A binary search over the heading
   * tops: ⌈log₂(n + 1)⌉ rect reads, plus one for a nested scroller.
   */
  private _measure(): void {
    const items = this.items();
    const editor = this.context().editor();
    const content = editor ? mlvEditorTocContent(editor) : null;
    if (!editor || !content || !items.length) {
      this._activeAnchor.set(null);
      return;
    }
    const elements = this._headingElements(content, items);
    const scroller = mlvEditorTocScroller(content, this._document);
    const frame = mlvEditorTocScrollerFrame(scroller, this._document);
    const first = elements.find((element) => element !== null);
    const line =
      frame.top +
      mlvEditorTocProseMirrorMargin(editor.view) +
      (first ? mlvEditorTocHeadingMargin(first) : 0);
    const tops = new Map<number, number>();
    // An unplaced heading (missing, or `display: none`) takes the next placed
    // heading's top, `Infinity` past the last: the tops stay non-decreasing
    // for the search, and an unplaced heading is never the active one.
    const top = (index: number): number => {
      const cached = tops.get(index);
      if (cached !== undefined) return cached;
      const unplaced: number[] = [];
      let value = Infinity;
      for (let at = index; at < elements.length; at++) {
        const known = tops.get(at);
        if (known !== undefined) {
          value = known;
          break;
        }
        const placed = mlvEditorTocPlacedTop(elements[at]);
        if (placed !== null) {
          tops.set(at, placed);
          value = placed;
          break;
        }
        unplaced.push(at);
      }
      unplaced.forEach((at) => tops.set(at, value));
      return value;
    };
    const index = frame.atEnd
      ? mlvEditorTocLastIndexAbove(items.length, top, frame.bottom, true)
      : mlvEditorTocLastIndexAbove(items.length, top, line + 1, false);
    this._activeAnchor.set(index < 0 ? null : items[index].anchor);
  }

  /** @private The heading elements of `items`, looked up once per generation. */
  private _headingElements(
    content: HTMLElement,
    items: readonly MlvEditorTocItem[],
  ): readonly (HTMLElement | null)[] {
    if (!this._elements || this._elementsFor !== items) {
      this._elements = items.map((item) =>
        this._headingElement(content, item.id),
      );
      this._elementsFor = items;
    }
    return this._elements;
  }

  /**
   * @private The heading with `id` inside this editor's content — not the
   * page: two editors without an `idPrefix` can render the same id.
   */
  private _headingElement(
    content: HTMLElement,
    id: string,
  ): HTMLElement | null {
    const view = this._document.defaultView;
    const selector = `#${view?.CSS?.escape ? view.CSS.escape(id) : id}`;
    return content.querySelector<HTMLElement>(selector);
  }

  /**
   * @private Puts the caret at the start of the heading with `anchor`, found
   * now (no position is stored), without scrolling or a history entry, and
   * focuses the content with `preventScroll` (a readonly view included).
   */
  private _placeCaret(editor: Editor, anchor: string): void {
    const { state } = editor;
    const pos = mlvEditorTocHeadingPos(state.doc, anchor);
    if (pos === null) return;
    editor.view.dispatch(
      state.tr
        .setSelection(TextSelection.create(state.doc, pos + 1))
        .setMeta('addToHistory', false),
    );
    mlvEditorFocusContent(editor);
  }

  /** @private Warns once, in dev mode, that the editor has no anchors. */
  private _warnMissingAnchors(): void {
    if (this._warned || !isDevMode()) return;
    this._warned = true;
    console.warn(
      'mlv-editor-toc: the editor has no headingAnchors extension, so the ' +
        'table of contents lists nothing. Set [headingAnchors] on mlv-editor ' +
        '(or add MlvEditorHeadingAnchors to a custom extension array).',
    );
  }
}

/** @internal The editor's content element, or `null` before it is mounted. */
function mlvEditorTocContent(editor: Editor): HTMLElement | null {
  if (editor.isDestroyed) return null;
  try {
    return editor.view.dom as HTMLElement;
  } catch {
    return null;
  }
}
