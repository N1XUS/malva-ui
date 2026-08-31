import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { LucideCircleQuestionMark } from '@lucide/angular';
import { MlvTooltip } from '@malva-ui/core/tooltip';

/**
 * Secondary hint for the control named by the enclosing `mlv-label`.
 *
 * The hint is authored as projected content — `<mlv-hint>Sent to your phone</mlv-hint>` —
 * but it renders as a small `circle-question-mark` icon button that reveals the
 * text in an `mlvTooltip` on hover and on keyboard focus. Rendering an icon
 * rather than inline text keeps the label row on one line no matter how long
 * the hint is, which inline text could not do inside the label's flex row.
 *
 * The projected content itself stays in the DOM (hidden) purely as the source
 * the tooltip string is read from; it is `aria-hidden` so the hint no longer
 * leaks into the accessible name of the labelled control. The same string is
 * put on the trigger's `aria-label`, so assistive tech still reaches it.
 *
 * Use `mlv-description` instead for sentence-length help text that should stay
 * permanently visible below the control.
 *
 * @example Inside a label
 * ```html
 * <mlv-label for="email">
 *   Email
 *   <mlv-hint>We only use this for receipts</mlv-hint>
 * </mlv-label>
 * ```
 *
 * @example Interpolated, as every `hint`-input control renders it
 * ```html
 * <mlv-hint>{{ hint() }}</mlv-hint>
 * ```
 */
@Component({
  selector: 'mlv-hint',
  template: `
    @if (_text(); as text) {
      <button
        type="button"
        class="mlv-hint__trigger"
        [attr.aria-label]="text"
        [mlvTooltip]="text"
        (click)="_onClick($event)"
      >
        <svg lucideCircleQuestionMark aria-hidden="true" [size]="14"></svg>
      </button>
    }
    <span #source class="mlv-hint__source" aria-hidden="true"
      ><ng-content
    /></span>
  `,
  styleUrl: './hint.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-hint',
  },
  imports: [LucideCircleQuestionMark, MlvTooltip],
})
export class MlvHint {
  /**
   * @protected Wrapper around the projected content. Kept in the DOM (only
   * `display: none`, never `@if`-ed away) because it is the sole source the
   * hint string can be read from, and `textContent` still resolves on a
   * non-displayed element.
   */
  protected readonly _source =
    viewChild.required<ElementRef<HTMLElement>>('source');

  /**
   * @protected Trimmed text of the projected content — used both as the tooltip
   * body and as the trigger's accessible name. Empty until the first render has
   * produced the projected DOM, and kept in sync afterwards by `_observer`.
   * While it is empty no trigger is rendered at all, so an empty `mlv-hint`
   * never leaves a nameless icon button behind.
   */
  protected readonly _text = signal('');

  /**
   * @private Watches the projected content for changes. Interpolated hints
   * (`<mlv-hint>{{ hint() }}</mlv-hint>`) mutate a text node owned by the
   * *parent* view, which no signal in this component can depend on — and
   * `textContent` is not a reactive read, so an effect would evaluate once and
   * never re-run. A MutationObserver is the only thing that sees the change.
   */
  private _observer: MutationObserver | null = null;

  /** @private Disconnects `_observer` when the component is destroyed. */
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    // Deferred to `afterNextRender` so it never runs on the server, where there
    // is no DOM to read and no MutationObserver to construct.
    afterNextRender(() => {
      const sourceEl = this._source().nativeElement;
      this._readText(sourceEl);

      if (typeof MutationObserver === 'undefined') {
        return;
      }

      this._observer = new MutationObserver(() => this._readText(sourceEl));
      this._observer.observe(sourceEl, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });

    this._destroyRef.onDestroy(() => this._observer?.disconnect());
  }

  /**
   * @protected Swallows the trigger's click so it does not read as an
   * activation of the enclosing `<label>`. `preventDefault()` stops the label's
   * native "focus the labelled control" behaviour, and `stopPropagation()`
   * stops click handlers bound on `mlv-label` itself — `mlv-select` binds one
   * there to open its dropdown — from firing when the user only wanted the
   * hint. Both are required; neither alone covers the other case.
   */
  protected _onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * @private Reads the trimmed projected text into `_text`. Setting a signal to
   * an identical string is a no-op, so re-reads triggered by unrelated DOM
   * mutations cannot loop.
   */
  private _readText(sourceEl: HTMLElement): void {
    this._text.set(sourceEl.textContent?.trim() ?? '');
  }
}
