import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  input,
  model,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvExpandContent } from './expand-content';

/**
 * Expandable panel component with smooth `grid-template-rows` animation.
 *
 * The component renders no header or trigger of its own — it is the animated
 * panel only. Drive it from your own control through `[(opened)]` or a template
 * reference and `toggle()`.
 *
 * Supports two content modes:
 * - **Eager** (default): place content directly inside `<mlv-expand>`.
 * - **Lazy**: wrap content in `<ng-template mlvExpandContent>`.
 *
 * In both modes the body element only exists while `opened()` is `true`, so
 * projected content is created on open and destroyed on close. The difference
 * is *when the content is first constructed*: eager `<ng-content>` is created
 * with the host component, the lazy template only on first open — which is what
 * keeps a heavy child from being initialized in a panel the user never expands.
 *
 * @example Eager (ng-content)
 * ```html
 * <button type="button" (click)="panel.toggle()">Details</button>
 * <mlv-expand #panel>
 *   <p>Created with the host; in the DOM only while the panel is open.</p>
 * </mlv-expand>
 * ```
 *
 * @example Lazy (structural directive)
 * ```html
 * <button type="button" (click)="isOpen.set(!isOpen())">Load on demand</button>
 * <mlv-expand [(opened)]="isOpen">
 *   <ng-template mlvExpandContent>
 *     <heavy-chart-component />
 *   </ng-template>
 * </mlv-expand>
 * ```
 */
@Component({
  selector: 'mlv-expand',
  templateUrl: './expand.html',
  styleUrl: './expand.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    class: 'mlv-expand',
    '[class.mlv-expand--open]': 'opened()',
    '[class.mlv-expand--disabled]': 'disabled()',
  },
})
export class MlvExpand {
  /**
   * Two-way bindable open/closed state.
   * Bind with `[(opened)]="isOpen"` or read with `(openedChange)="onToggle($event)"`.
   *
   * @remarks Renamed from `open` to `opened` for consistency with the other
   * open/close surfaces (`mlv-dialog`, `mlv-drawer`, `mlv-popup`). Breaking
   * change — see the expand migration note.
   */
  readonly opened = model<boolean>(false);

  /**
   * When `true`, prevents toggling and visually dims the component.
   * Supports attribute syntax: `<mlv-expand disabled>`.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Optional accessible label for the expand body region.
   * When set, applies `role="region"` with `aria-label` on the body element.
   * Prefer `ariaLabelledBy` when a visible label element exists.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * ID of an element that labels this expand region.
   * When set, applies `role="region"` with `aria-labelledby` on the body element.
   */
  readonly ariaLabelledBy = input<string | undefined>(undefined);

  /** @internal Detects whether a lazy content directive is projected. */
  protected readonly _lazyContent = contentChild(MlvExpandContent);
  /**
   * Toggles the open/closed state.
   * No-op when the component is disabled.
   */
  toggle(): void {
    if (this.disabled()) return;
    this.opened.update((v) => !v);
  }
}
