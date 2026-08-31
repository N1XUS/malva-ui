import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvChip } from '@malva-ui/core/chip';
import { MLV_CHIP_I18N } from '@malva-ui/i18n';

/**
 * A single removable token rendered inside `mlv-tokenizer`. The token host is
 * the keyboard focus target (a roving-tabindex `role="listitem"`); the inner
 * `mlv-chip` provides the visual chrome and mouse close affordance but is kept
 * out of the tab order via `chipTabIndex="-1"`.
 */
@Component({
  selector: 'mlv-token',
  template: `
    <mlv-chip
      mlvDensity="compact"
      [chipTabIndex]="-1"
      [tone]="armed() ? 'primary' : 'default'"
      [closable]="removable() && !disabled()"
      [closeAriaLabel]="_closeAriaLabel()"
      [muted]="disabled()"
      (chipClose)="onRemove()"
    >
      <ng-content />
    </mlv-chip>
  `,
  styleUrl: './token.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-token',
    role: 'listitem',
    '[attr.aria-label]': '_ariaLabel()',
    '[class.mlv-token--disabled]': 'disabled()',
    '[class.mlv-token--armed]': 'armed()',
    '[attr.tabindex]': 'disabled() ? -1 : tabIndex()',
    '(keydown.backspace)': '_onKeyRemove($event)',
    '(keydown.delete)': '_onKeyRemove($event)',
  },
  imports: [MlvChip],
})
export class MlvToken<T = unknown> {
  /**
   * @private Host element reference — the token host is the keyboard focus
   * target that the parent tokenizer's `FocusKeyManager` drives.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** The option model this token represents. */
  readonly value = input<MlvSelectOption<T>>();

  /** Whether the token shows a remove (close) affordance. */
  readonly removable = input(true);

  /** Whether the token is disabled — not removable and out of the tab order. */
  readonly disabled = input(false);

  /**
   * Whether the token is "armed" — a purely visual selection driven by the
   * parent tokenizer's empty-input Backspace flow. An armed token renders with
   * the chip's `primary` tone while DOM focus stays in the text input. It does
   * not change the token's tabindex, role, or removal semantics.
   */
  readonly armed = input(false);

  /** Emits this token's option when the user removes it (click or Backspace/Delete). */
  readonly removed = output<MlvSelectOption<T>>();

  /**
   * Roving tabindex applied to the token host (the single focus target). `0`
   * for the active token, `-1` for the rest. Managed by `MlvTokenizer`.
   */
  readonly tabIndex = signal(0);

  /** @internal Accessible name for the token: its option label. */
  readonly _ariaLabel = computed(() => this.value()?.label ?? null);

  /**
   * @private The chip component's i18n strings, reused to localize the base
   * "Remove" verb of this token's close-button label.
   */
  private readonly _chipI18n = inject(MLV_CHIP_I18N);

  /**
   * @internal Descriptive accessible name for the inner chip's close button,
   * composed as `"<Remove>: <label>"` (e.g. `"Remove: Angular"`) so the label
   * names the specific token being removed rather than a generic "Remove".
   * Falls back to the bare "Remove" verb when the token has no label.
   */
  readonly _closeAriaLabel = computed(() => {
    const label = this.value()?.label;
    const remove = this._chipI18n().remove;
    return label ? `${remove}: ${label}` : remove;
  });

  /**
   * Moves focus to the token host. Adapts the token to CDK `FocusKeyManager`
   * so the tokenizer can navigate tokens with the Arrow keys.
   */
  focus(): void {
    this._elementRef.nativeElement.focus();
  }

  /** @internal Removes the token on Backspace/Delete when it is removable. */
  _onKeyRemove(event: Event): void {
    if (!this.removable() || this.disabled()) return;
    event.preventDefault();
    this.onRemove();
  }

  /** @internal Emits `removed` with this token's option. */
  onRemove(): void {
    const val = this.value();
    if (val) {
      this.removed.emit(val);
    }
  }
}
