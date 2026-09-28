import { Directive, input } from '@angular/core';

/** Which side of the browse button a `[mlvFileUploadAction]` control renders on. */
export type MlvFileUploadActionPosition = 'start' | 'end';

/**
 * Marks a projected control as an extra action in the drop zone's action row,
 * next to the built-in browse button. Typical use is an icon-only button that
 * offers an alternative to picking a file — "generate with AI", "pick from
 * library", "use camera".
 *
 * `position` is matched by the component's `<ng-content>` selectors, so it must
 * be written as a **static attribute** (`position="end"`), exactly like the
 * other Malva UI slot markers. A binding (`[position]="…"`) changes the
 * directive's signal but cannot move the node between projection slots.
 * DOM order equals visual order — nothing is reordered with CSS `order` — so
 * the tab sequence always matches what the user sees.
 *
 * Clicks (including Enter/Space activation of a projected `<button>`) stop at
 * the slot, so an extra action never also triggers the surrounding zone and
 * opens the native file picker.
 *
 * Disabling a projected control is the consumer's job: while the upload is
 * disabled, `mlv-file-upload` dims the zone and the projected actions and
 * blocks pointer events, but it does not write `disabled` onto projected
 * content, so the keyboard still reaches it until the consumer binds
 * `[disabled]`.
 *
 * @example
 * ```html
 * <mlv-file-upload title="Image" actionLabel="Choose image">
 *   <button mlvButton mlvFileUploadAction type="button" shape="square"
 *           aria-label="Generate image with AI">
 *     <svg lucideSparkles [size]="16" />
 *   </button>
 * </mlv-file-upload>
 *
 * <mlv-file-upload actionLabel="Choose image">
 *   <button mlvButton mlvFileUploadAction position="end" type="button"
 *           variant="transparent">
 *     Import from URL
 *   </button>
 * </mlv-file-upload>
 * ```
 */
@Directive({
  selector: '[mlvFileUploadAction]',
  host: {
    class: 'mlv-file-upload__action',
    '[class.mlv-file-upload__action--end]': "position() === 'end'",
    '(click)': '$event.stopPropagation()',
  },
})
export class MlvFileUploadAction {
  /**
   * Where the action sits relative to the browse button. `'start'` (the
   * default) renders it before the button, `'end'` after it.
   *
   * Set it as a static attribute — `position="end"` — because the value is
   * read by the host component's content-projection selector, not at runtime.
   */
  readonly position = input<MlvFileUploadActionPosition>('start');
}
