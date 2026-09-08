import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { LucideCheck, LucideCopy } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';

/**
 * The copy affordance pinned to the corner of one source panel in
 * `docs-example-container`.
 *
 * **Why not `mlv-copy-to-clipboard`.** That component is an *inline* surface:
 * it makes the projected text itself the control (`role="button"` on the host,
 * a hover tint across the run of text, and two mask widths measured from the
 * content). Wrapping a whole highlighted `<pre>` in it would turn the code
 * block into one giant button and put a tint behind every line. What the
 * source panel needs is the opposite shape — a small button beside the content
 * that copies text it does not contain.
 *
 * The button is revealed on hover of its source panel (see the container's
 * styles), which is a *pointer* affordance only: it is a real `<button>` in
 * the tab order at all times, and `:focus-within` on the panel brings it into
 * view for keyboard users.
 */
@Component({
  selector: 'docs-copy-source',
  imports: [MlvButton, LucideCopy, LucideCheck],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="copy-source__button"
      mlvButton
      variant="transparent"
      shape="square"
      size="s"
      [attr.aria-label]="label()"
      (click)="copy()"
    >
      @if (copied()) {
        <svg
          lucideCheck
          [size]="14"
          data-copy-state="copied"
          aria-hidden="true"
        ></svg>
      } @else {
        <svg
          lucideCopy
          [size]="14"
          data-copy-state="idle"
          aria-hidden="true"
        ></svg>
      }
    </button>
    <span class="cdk-visually-hidden" aria-live="polite">{{
      announcement()
    }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }
  `,
})
export class CopySourceComponent {
  /** The exact text written to the clipboard when the button is activated. */
  readonly value = input.required<string>();

  /** Accessible name of the button — it carries no visible text. */
  readonly label = input.required<string>();

  /** How long the confirmation icon and announcement stay up, in milliseconds. */
  readonly copiedDuration = input(2000);

  /** Whether the button is currently showing the post-copy confirmation. */
  readonly copied = signal(false);

  /** Text pushed into the polite live region after a successful write. */
  readonly announcement = signal('');

  /** @private CDK clipboard writer — falls back to `execCommand` where needed. */
  private readonly _clipboard = inject(Clipboard);

  /** @private Clears the pending revert when the panel is torn down. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Handle of the pending revert, so repeated clicks do not stack. */
  private _revertTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this._destroyRef.onDestroy(() => this._clearTimer());
  }

  /**
   * Writes `value()` to the clipboard and, only on success, raises the
   * confirmation. A refused write leaves the button idle rather than claiming
   * a copy that never happened.
   */
  copy(): void {
    if (!this._clipboard.copy(this.value())) return;

    this._clearTimer();
    this.copied.set(true);
    this.announcement.set(`${this.label()} — copied`);
    this._revertTimer = setTimeout(() => {
      this.copied.set(false);
      this.announcement.set('');
      this._revertTimer = null;
    }, this.copiedDuration());
  }

  /** @private Cancels a pending revert. */
  private _clearTimer(): void {
    if (this._revertTimer !== null) {
      clearTimeout(this._revertTimer);
      this._revertTimer = null;
    }
  }
}
