import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  PLATFORM_ID,
  signal,
  ViewEncapsulation,
  type Signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  type BooleanInput,
  coerceBooleanProperty,
} from '@angular/cdk/coercion';
import { Clipboard } from '@angular/cdk/clipboard';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideCheck, LucideCopy } from '@lucide/angular';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import { MLV_COPY_TO_CLIPBOARD_I18N } from '@malva-ui/i18n';

/**
 * Inline copy-to-clipboard component.
 *
 * The component wraps arbitrary projected content (typically a short inline
 * string). It reads as regular prose until the user hovers, at which point a
 * subtle background tint appears and a small copy icon fades in at the trailing
 * edge. Activating the element — click, Enter, or Space — writes the value to
 * the clipboard, morphs the icon from Copy to Check via a soft blur crossfade,
 * and emits the `copied` output.
 *
 * The copied text is derived from:
 * 1. An explicit `value` input if provided, otherwise
 * 2. The projected content's `textContent`.
 *
 * @example Basic inline usage
 * ```html
 * <p>
 *   Your API key is <mlv-copy-to-clipboard>sk_live_abc123xyz</mlv-copy-to-clipboard>.
 * </p>
 * ```
 *
 * @example Override with [value]
 * ```html
 * Order #<mlv-copy-to-clipboard [value]="'ORDER-0042-7F9X2'">0042</mlv-copy-to-clipboard>
 * ```
 *
 * @example Custom copied duration
 * ```html
 * <mlv-copy-to-clipboard [copiedDuration]="4000">token-value</mlv-copy-to-clipboard>
 * ```
 *
 * @example Toast integration
 * ```html
 * <mlv-copy-to-clipboard (copied)="onCopied($event)">value</mlv-copy-to-clipboard>
 * ```
 */
@Component({
  selector: 'mlv-copy-to-clipboard',
  templateUrl: './copy-to-clipboard.html',
  styleUrl: './copy-to-clipboard.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-copy-to-clipboard',
    '[class.mlv-copy-to-clipboard--copied]': 'isCopied()',
    '[class.mlv-copy-to-clipboard--disabled]': 'disabled()',
    role: 'button',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[attr.aria-label]': '_computedAriaLabel()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[style.--mlv-copy-to-clipboard-mask-leading-width]': '_maskLeadingWidth()',
    '[style.--mlv-copy-to-clipboard-mask-trailing-width]':
      '_maskTrailingWidth()',
    '(click)': 'copy()',
    '(keydown.enter)': 'copy(); $event.preventDefault()',
    '(keydown.space)': 'copy(); $event.preventDefault()',
  },
  imports: [LucideCopy, LucideCheck, MlvTooltip],
})
export class MlvCopyToClipboard {
  /**
   * Optional explicit value that will be written to the clipboard when the
   * component is activated. When omitted, the component uses the `textContent`
   * of the projected default slot content.
   */
  readonly value = input<string | undefined>(undefined);

  /**
   * Duration in milliseconds for which the "copied" success state remains
   * active after a successful clipboard write. After this window elapses, the
   * component reverts to its idle state.
   *
   * @default 2000
   */
  readonly copiedDuration = input<number>(2000);

  /**
   * Custom aria-label override. Falls back to the i18n-provided label.
   * When a resolved value is available (either `value()` or projected text
   * content), it is appended to this base for richer screen-reader context.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Text announced via the visually-hidden `aria-live="polite"` region
   * immediately after a successful clipboard write.
   *
   * @default 'Copied to clipboard'
   */
  readonly copiedAriaLabel = input<string>('Copied to clipboard');

  /**
   * When true, disables the copy action, removes the host from the tab order,
   * and reflects `aria-disabled="true"`. Accepts attribute-style usage:
   * `<mlv-copy-to-clipboard disabled>`.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Emits the exact string that was successfully written to the clipboard.
   * Fires after the `navigator.clipboard.writeText` promise resolves.
   */
  readonly copied = output<string>();

  /**
   * Reactive signal exposing whether the component is currently in the copied
   * success state. Useful for template-driven UI that needs to react to the
   * transient state (e.g. conditional labels).
   */
  readonly isCopied: Signal<boolean>;

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_COPY_TO_CLIPBOARD_I18N);

  /**
   * @protected Computed accessible label. Combines the base `ariaLabel` (or
   * i18n fallback) with the current resolved value when one is available, so
   * screen readers get a descriptive name like `"Copy to clipboard: sk_live_abc123"`.
   */
  protected readonly _computedAriaLabel = computed<string>(() => {
    const base = this.ariaLabel() ?? this._i18n().copyToClipboard;
    const explicit = this.value();
    if (explicit && explicit.length > 0) {
      return `${base}: ${explicit}`;
    }
    return base;
  });

  /** @private Backing signal for `isCopied`. */
  private readonly _isCopied = signal(false);

  /** @private Leading mask layer width, synchronized with the copy container. */
  protected readonly _maskLeadingWidth = signal('51%');

  /** @private Trailing mask layer width, synchronized with the copy container. */
  protected readonly _maskTrailingWidth = signal('50%');

  /**
   * @private Host element reference, used to read `textContent` when no
   * explicit `value` input is provided.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Shared observer used to keep mask dimensions aligned to the host width. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Re-enters Angular only when an observed width changes. */
  private readonly _ngZone = inject(NgZone);

  /** @private Avoids browser-only width tracking during SSR. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** @private DestroyRef for cleaning up any pending auto-reset timers. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private CDK Clipboard service — SSR-safe, no insecure-context branch. */
  private readonly _clipboard = inject(Clipboard);

  /**
   * @private Handle for the auto-reset `setTimeout`. Stored so rapid repeated
   * copies can reset the timer cleanly.
   */
  private _revertTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.isCopied = this._isCopied.asReadonly();

    if (this._isBrowser) {
      afterNextRender(() => this._trackMaskWidth());
    }

    this._destroyRef.onDestroy(() => {
      if (this._revertTimer !== null) {
        clearTimeout(this._revertTimer);
        this._revertTimer = null;
      }
    });
  }

  /**
   * Writes the resolved text to the system clipboard. Triggered on click,
   * Enter, or Space via the host bindings. Activates the copied state and
   * schedules its reset. Rejects silently on clipboard write failure — the
   * `copied` output only fires on a successful write.
   */
  copy(): void {
    if (this.disabled()) {
      return;
    }

    const text = this._resolveValue();
    if (!text) {
      return;
    }

    if (this._clipboard.copy(text)) {
      this._activateCopiedState(text);
    }
    // Clipboard.copy() returns false on failure (e.g. SSR). Leave idle state
    // unchanged — the `copied` output only fires on a successful write.
  }

  /**
   * @private Resolves the text to copy. Prefers the explicit `value` input;
   * falls back to the trimmed `textContent` of the host element.
   */
  private _resolveValue(): string {
    const explicit = this.value();
    if (explicit !== undefined && explicit !== null) {
      return explicit;
    }
    const host = this._elementRef.nativeElement;
    return host.textContent?.trim() ?? '';
  }

  /**
   * @private Activates the copied state, emits the `copied` output, and
   * schedules the reset timer. Clears any pending reset before scheduling a
   * new one so rapid repeated copies restart the window cleanly.
   */
  private _activateCopiedState(text: string): void {
    if (this._revertTimer !== null) {
      clearTimeout(this._revertTimer);
    }

    this._isCopied.set(true);
    this.copied.emit(text);

    this._revertTimer = setTimeout(() => {
      this._isCopied.set(false);
      this._revertTimer = null;
    }, this.copiedDuration());
  }

  /** @private Observes the rendered host so CSS masks retain their exact width. */
  private _trackMaskWidth(): void {
    const host = this._elementRef.nativeElement;
    this._setMaskWidths(host.getBoundingClientRect().width);

    this._ngZone.runOutsideAngular(() => {
      this._resizeObserver
        .observe(host)
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe((entries) => {
          this._setMaskWidths(
            entries[0]?.contentRect.width ?? host.getBoundingClientRect().width,
          );
        });
    });
  }

  /** @private Updates the two horizontal mask sizes only when the width changed. */
  private _setMaskWidths(width: number): void {
    const normalizedWidth = Math.max(width, 0);
    const leading = `${normalizedWidth * 0.51}px`;
    const trailing = `${normalizedWidth * 0.5}px`;

    if (
      leading === this._maskLeadingWidth() &&
      trailing === this._maskTrailingWidth()
    ) {
      return;
    }

    this._ngZone.run(() => {
      this._maskLeadingWidth.set(leading);
      this._maskTrailingWidth.set(trailing);
    });
  }
}
