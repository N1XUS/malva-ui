import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCircleStop,
  LucideX,
} from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_EDITOR_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import {
  MLV_EDITOR_OVERLAY_REGISTRY,
  MLV_EDITOR_TOOLBAR_CONTEXT,
} from '../editor-toolbar-context';
import type { MlvEditorOverlayRegistry } from '../editor-toolbar-context';
import { MLV_EDITOR_AI_CONTEXT } from './editor-ai-context';

/** @internal Source of unique description-element ids across bar instances. */
let reviewBarDescriptionIdSequence = 0;

/**
 * Review surface for pending AI suggestions.
 *
 * Rendered inside the editor composite — hosts project it into the status
 * region (`<mlv-editor-ai-review-bar mlvEditorStatus />`), following the
 * `MlvEditorStatus` placement. Hidden while the nearest
 * {@link MLV_EDITOR_AI_CONTEXT} is `'idle'` (or absent); while `'running'` it
 * shows a stop affordance that cancels the in-flight request, and while
 * `'reviewing'` it shows the pending-suggestion count, previous/next
 * navigation, accept/reject for the current suggestion, and accept-all/
 * reject-all.
 *
 * Navigation keeps an internal cursor over the context's suggestion list;
 * moving it outlines the current suggestion in the document
 * (`MLV_EDITOR_AI_SUGGESTION_CURRENT_CLASS` decoration) and scrolls its range
 * into view through {@link MlvEditorAiContext.revealSuggestion}. Accepting or
 * rejecting the current suggestion advances to the next remaining one (the
 * list shrinks under a clamped cursor); when the set empties the context
 * returns to `'idle'` and the bar disappears.
 *
 * Announcement choice: the count region is deliberately **not** an
 * `aria-live` region. The AI context already announces the review lifecycle —
 * `aiReviewStarted` with the count, and every accept/reject outcome — through
 * the CDK `LiveAnnouncer`; a live count would double-announce each change.
 *
 * The host element registers with the editor's composite-overlay registry, so
 * interacting with the bar never emits a false editor blur wherever a host
 * renders it. All controls are plain tab stops inside the composite. Accept,
 * reject, and navigation disable while the editor is readonly or disabled
 * (mutations are refused by the context anyway; the disabled state makes the
 * refusal visible), and the whole bar disables with the editor.
 */
@Component({
  selector: 'mlv-editor-ai-review-bar',
  imports: [
    LucideCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCircleStop,
    LucideX,
    MlvButton,
    MlvButtonIcon,
    MlvTooltip,
  ],
  templateUrl: './editor-ai-review-bar.html',
  styleUrl: './editor-ai-review-bar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-editor-ai-review-bar',
    role: 'group',
    '[attr.aria-label]': '_copy().aiReviewBar',
    '[hidden]': '!_visible()',
  },
})
export class MlvEditorAiReviewBar {
  /** @protected AI command state of the nearest editor, if provided. */
  protected readonly _ai = inject(MLV_EDITOR_AI_CONTEXT, { optional: true });

  /** @protected Editor-scoped form state gating executability. */
  protected readonly _context = inject(MLV_EDITOR_TOOLBAR_CONTEXT);

  /** @private Composite focus ownership for the bar's host element. */
  private readonly _overlays = inject<MlvEditorOverlayRegistry>(
    MLV_EDITOR_OVERLAY_REGISTRY,
  );

  /** @private Host element registered with the composite-overlay registry. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Clears the current-suggestion outline on teardown. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Optional localized editor copy. */
  private readonly _i18n = inject(MLV_EDITOR_I18N, { optional: true });

  /** @private Resolves the ICU pending-count template. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /**
   * @private Navigation cursor over the suggestion list. Reset for every new
   * review; reads clamp through {@link _index}, so a cursor left beyond the
   * end after the list shrinks points at the last remaining suggestion.
   */
  private readonly _cursor = signal(0);

  /** @protected Reactive localized copy for every control and the count. */
  protected readonly _copy = computed(() => {
    const copy = this._i18n?.();
    return {
      aiReviewBar: copy?.aiReviewBar ?? 'AI suggestion review',
      aiReviewCount:
        copy?.aiReviewCount ??
        '{count, plural, one {# suggestion} other {# suggestions}}',
      aiPreviousSuggestion: copy?.aiPreviousSuggestion ?? 'Previous suggestion',
      aiNextSuggestion: copy?.aiNextSuggestion ?? 'Next suggestion',
      aiAcceptSuggestion: copy?.aiAcceptSuggestion ?? 'Accept suggestion',
      aiRejectSuggestion: copy?.aiRejectSuggestion ?? 'Reject suggestion',
      aiAcceptAll: copy?.aiAcceptAll ?? 'Accept all',
      aiRejectAll: copy?.aiRejectAll ?? 'Reject all',
      aiStopGeneration: copy?.aiStopGeneration ?? 'Stop generating',
    };
  });

  /** @protected Whether a transform is streaming, showing the stop affordance. */
  protected readonly _running = computed(
    () => this._ai?.status() === 'running',
  );

  /** @protected Whether a review with pending suggestions is active. */
  protected readonly _reviewing = computed(
    () => this._ai?.status() === 'reviewing',
  );

  /** @protected The bar renders only while AI work is running or under review. */
  protected readonly _visible = computed(
    () => this._running() || this._reviewing(),
  );

  /** @protected Whether readonly/disabled state blocks every AI action. */
  protected readonly _disabled = computed(
    () => this._context.disabled() || this._context.readonly(),
  );

  /** @protected Pending suggestions mirrored from the AI context. */
  protected readonly _suggestions = computed(
    () => this._ai?.suggestions() ?? [],
  );

  /** @protected Pending-suggestion count shown in the bar. */
  protected readonly _count = computed(() => this._suggestions().length);

  /** @protected Clamped cursor index of the current suggestion. */
  protected readonly _index = computed(() =>
    Math.max(0, Math.min(this._cursor(), this._count() - 1)),
  );

  /** @private Identifier of the current suggestion, if any is pending. */
  private readonly _currentId = computed(
    () => this._suggestions()[this._index()]?.id ?? null,
  );

  /**
   * @protected Id of the visually hidden current-suggestion description
   * element the accept/reject buttons reference through `aria-describedby`.
   * Unique per bar instance so multiple editors on one page cannot collide.
   */
  protected readonly _descriptionId = `mlv-editor-ai-review-bar-description-${++reviewBarDescriptionIdSequence}`;

  /**
   * @protected Non-visual description of the current suggestion — index,
   * count, and the removed/added text — from
   * {@link MlvEditorAiContext.describeSuggestion}. The removed text otherwise
   * exists only inside the `aria-hidden` strikethrough widget, so this is
   * what makes the accept/reject decision inspectable without sight.
   */
  protected readonly _currentDescription = computed(() => {
    const id = this._currentId();
    return id === null ? '' : (this._ai?.describeSuggestion(id) ?? '');
  });

  /** @protected Localized pending count resolved through the ICU template. */
  protected readonly _countText = computed(() =>
    this._resolver.resolve(
      { aiReviewCount: this._copy().aiReviewCount },
      'aiReviewCount',
      { count: this._count() },
    ),
  );

  constructor() {
    // The bar joins the editor composite wherever a host renders it: the
    // registry adds its focus handlers to this element, so focus moving into
    // the bar never emits a false editor blur. Registered per enabled state
    // because disabling the editor force-clears the registry (`closeAll`),
    // which would silently drop a one-time registration.
    effect((onCleanup) => {
      if (this._context.disabled()) return;
      const unregister = this._overlays.register(
        this._host.nativeElement,
        // Nothing to close: the bar is inline, its visibility follows the AI
        // context status.
        () => undefined,
      );
      onCleanup(unregister);
    });

    // The navigation cursor resets whenever no review is active, so the next
    // review starts at its first suggestion.
    effect(() => {
      if (!this._reviewing()) this._cursor.set(0);
    });

    // Outline follows the current suggestion: on review start, navigation,
    // and the auto-advance after accept/reject the context outlines the
    // suggestion and scrolls it into view. Ids are compared by value, so the
    // signal graph settles without re-firing on the mirror update the reveal
    // transaction itself causes.
    effect(() => {
      const id = this._currentId();
      if (id !== null) this._ai?.revealSuggestion(id);
    });

    this._destroyRef.onDestroy(() => this._ai?.revealSuggestion(null));
  }

  /** @protected Cancels the in-flight AI request from the stop affordance. */
  protected _stop(): void {
    this._ai?.cancel();
  }

  /** @protected Moves the cursor to the previous suggestion, wrapping at the start. */
  protected _previous(): void {
    const count = this._count();
    if (count === 0) return;
    this._cursor.set((this._index() - 1 + count) % count);
  }

  /** @protected Moves the cursor to the next suggestion, wrapping at the end. */
  protected _next(): void {
    const count = this._count();
    if (count === 0) return;
    this._cursor.set((this._index() + 1) % count);
  }

  /** @protected Accepts the current suggestion; the clamped cursor advances. */
  protected _acceptCurrent(): void {
    const id = this._currentId();
    if (id === null) return;
    this._cursor.set(this._index());
    this._ai?.acceptSuggestion(id);
  }

  /** @protected Rejects the current suggestion; the clamped cursor advances. */
  protected _rejectCurrent(): void {
    const id = this._currentId();
    if (id === null) return;
    this._cursor.set(this._index());
    this._ai?.rejectSuggestion(id);
  }

  /** @protected Accepts every pending suggestion. */
  protected _acceptAll(): void {
    this._ai?.acceptAll();
  }

  /** @protected Rejects every pending suggestion. */
  protected _rejectAll(): void {
    this._ai?.rejectAll();
  }
}
