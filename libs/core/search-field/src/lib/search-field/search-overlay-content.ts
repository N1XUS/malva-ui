import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Context handed to a `[mlvSearchOverlayContent]` template.
 *
 * The template replaces the overlay's default body entirely, so everything it
 * needs to drive the field is passed in rather than reached for: the current
 * query, the writers that keep the host's `value` model and live/submit
 * behaviour intact, and the close action.
 */
export interface MlvSearchOverlayContentContext {
  /** Current query. Available as the implicit template variable. */
  $implicit: string;
  /** Current query, for `let-query="query"`. */
  query: string;
  /** Whether a search is in flight, mirroring the host's `loading` input. */
  loading: boolean;
  /** Placeholder resolved from the host input or the active language pack. */
  placeholder: string;
  /** Accessible input label resolved the same way. */
  ariaLabel: string;
  /**
   * Writes the query. Routes through the host's normal input path, so live mode
   * still debounces and deduplicates and submit mode still waits for a commit.
   */
  setQuery: (value: string) => void;
  /** Commits the current query immediately, bypassing any pending debounce. */
  submit: () => void;
  /** Clears the query, honouring the host's `commitOnClear`. */
  clear: () => void;
  /** Closes the overlay and returns focus to whatever opened it. */
  close: () => void;
}

/**
 * Replaces the default body of `mlv-search-field`'s overlay.
 *
 * Without it the overlay renders the field's own input, restyled for the
 * overlay surface. With it the consumer owns the body completely — an
 * autocomplete input, recent searches, grouped results — while the host keeps
 * owning the overlay lifecycle, focus restore, and the `value`/`search` contract.
 *
 * @example
 * ```html
 * <mlv-search-field overlay>
 *   <ng-template mlvSearchOverlayContent let-query let-setQuery="setQuery" let-close="close">
 *     <mlv-input [value]="query" (valueChange)="setQuery($event)" [mlvAutocomplete]="options" />
 *     <button mlvButton (click)="close()">Cancel</button>
 *   </ng-template>
 * </mlv-search-field>
 * ```
 */
@Directive({ selector: '[mlvSearchOverlayContent]' })
export class MlvSearchOverlayContentDef {
  /** The template reference for the overlay body. */
  readonly templateRef = inject(TemplateRef<MlvSearchOverlayContentContext>);

  /** Type guard so `let-` variables infer from {@link MlvSearchOverlayContentContext}. */
  static ngTemplateContextGuard(
    _directive: MlvSearchOverlayContentDef,
    _context: unknown,
  ): _context is MlvSearchOverlayContentContext {
    return true;
  }
}
