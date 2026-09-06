import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { Subscription } from 'rxjs';
import { FocusKeyManager } from '@angular/cdk/a11y';
import type { FocusableOption } from '@angular/cdk/a11y';
import type { MlvFormControl } from '@malva-ui/core/form-utils';
import {
  MlvDescription,
  MlvFormControlWrapper,
  MlvFormControlWrapperControl,
  MlvHint,
  MlvLabel,
  MLV_FORM_CONTROL,
  MlvMessage,
  MlvSignalFormControlBase,
} from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvToken } from '../token/token';
import { MlvTokenTemplate } from '../token-template';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MLV_TOKENIZER_I18N } from '@malva-ui/i18n';

const defaultCreateToken = (value: string): MlvSelectOption<string> => ({
  label: value,
  value,
});

@Component({
  selector: 'mlv-tokenizer',
  imports: [
    MlvToken,
    NgTemplateOutlet,
    MlvDescription,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvLabel,
    MlvHint,
    MlvMessage,
    MlvInput,
  ],
  templateUrl: './tokenizer.html',
  styleUrl: './tokenizer.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => MlvTokenizer),
    },
  ],
  host: {
    class: 'mlv-tokenizer',
    '[class.mlv-tokenizer--disabled]': 'computedDisabled()',
    '[class.mlv-tokenizer--focused]': 'focused()',
  },
})
export class MlvTokenizer<T = string>
  extends MlvSignalFormControlBase<MlvSelectOption<T>[]>
  implements MlvFormControl
{
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_TOKENIZER_I18N);

  /** The token collection used by all Angular forms APIs. */
  readonly value = model<MlvSelectOption<T>[]>([]);

  /** Backwards-compatible two-way token binding kept in sync with `value`. */
  readonly tokens = model<MlvSelectOption<T>[]>([]);
  readonly placeholder = input('');
  readonly showOverflow = input(true);
  readonly maxVisible = input<number | null>(null);
  readonly allowDuplicates = input(false);

  /** Transforms a raw string from the input field into a MlvSelectOption. */
  readonly createToken = input<(value: string) => MlvSelectOption<T>>(
    defaultCreateToken as unknown as (value: string) => MlvSelectOption<T>,
  );

  /**
   * Optional function to split user input into multiple values.
   * e.g. `(v) => v.split(',')` to support comma-separated entry.
   */
  readonly splitFn = input<((value: string) => string[]) | null>(null);

  /** @protected Custom token template projected via `[mlvTokenTemplate]`. */
  protected readonly tokenTemplate = contentChild(MlvTokenTemplate);

  /** @private The rendered token components, driven by `FocusKeyManager`. */
  private readonly _tokens = viewChildren(MlvToken);

  /** @private Reference to the inner mlv-input used for token entry. */
  private readonly _inputEl = viewChild<MlvInput>('inputEl');

  /** @private Accessor for the underlying native input element via mlv-input bare mode. */
  private get _nativeInput(): HTMLInputElement | null {
    return this._inputEl()?.nativeElement ?? null;
  }

  /** @private FocusKeyManager driving roving-tabindex navigation across tokens. */
  private _keyManager?: FocusKeyManager<MlvToken<T>>;

  /** @private Supplies the current inline direction to the horizontal key manager. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Direction applying to this tokenizer, following any `[dir]` scope
   * above it rather than the document. `FocusKeyManager` reads raw key codes,
   * so it is handed this direction and rebuilt whenever it flips — reading the
   * global `direction()` would leave the tokens laid out right-to-left inside a
   * scoped `[dir="rtl"]` while ArrowRight still stepped left-to-right.
   */
  private readonly _direction = this._rtlService.elementDirection(
    inject(ElementRef<HTMLElement>),
  );

  /** @private Subscription to the key manager's active-item changes. */
  private _changeSub?: Subscription;

  /**
   * @protected Whether the last token is "armed" — a visual-only selection
   * (chip `primary` tone) driven by Backspace in the empty text input while DOM
   * focus stays in the input. The first Backspace arms; the next Backspace (or
   * Delete) removes the armed token and arms the new last one.
   */
  protected readonly _armed = signal(false);

  /**
   * @protected Polite screen-reader announcement for the armed token. Rendered
   * into a visually-hidden `aria-live="polite"` region so assistive tech learns
   * which token is selected even though DOM focus never leaves the input.
   */
  protected readonly _srMessage = signal('');

  /**
   * @private The last committed tokens reference produced by an internal
   * arm-driven deletion. Lets the external-change effect distinguish our own
   * mutations (which must preserve/re-arm) from external ones (which disarm).
   */
  private _internalTokensRef: MlvSelectOption<T>[] | null = null;

  /**
   * @private The collection reference last propagated across `value` / `tokens`.
   * `undefined` until the first sync, which is how the very first flush tells a
   * seeded binding apart from an unbound alias sitting on its `[]` default.
   */
  private _syncedRef: MlvSelectOption<T>[] | undefined;

  /** @protected The last token in the collection, or `null` when empty. */
  protected readonly _lastToken = computed(() => {
    const all = this.tokens();
    return all.length > 0 ? all[all.length - 1] : null;
  });

  constructor() {
    super();

    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this._changeSub?.unsubscribe();
      this._keyManager?.destroy();
    });

    // `value` and `tokens` are two views of one collection, so a single effect
    // owns the sync in both directions. Only the side that actually changed may
    // propagate — otherwise an unbound alias still holding its `[]` default would
    // write itself back over the seeded side on the first flush.
    //
    // Any resulting token-set change that did not originate from the
    // arming/deletion flow (external forms write, `[(tokens)]`, click-removal,
    // Enter add) disarms the visual selection. `untracked` keeps the sync and
    // disarm writes from becoming dependencies of this effect.
    effect(() => {
      const value = this.value() ?? [];
      const tokens = this.tokens() ?? [];
      untracked(() => this._syncModels(value, tokens));
    });

    // Wire a FocusKeyManager over the rendered tokens so Arrow keys navigate
    // between them and only the active token carries a tabindex of 0 (roving
    // tabindex). Rebuilt whenever the token set changes.
    effect(() => {
      const tokens = [...this._tokens()];
      const direction = this._direction();
      this._changeSub?.unsubscribe();
      this._keyManager?.destroy();

      if (tokens.length === 0) {
        this._keyManager = undefined;
        return;
      }

      this._keyManager = new FocusKeyManager<MlvToken<T>>(
        tokens as (MlvToken<T> & FocusableOption)[],
      )
        .withHorizontalOrientation(direction)
        .withWrap()
        .skipPredicate((token) => token.disabled());

      this._changeSub = this._keyManager.change.subscribe((index) =>
        this._syncTokenTabIndices(index),
      );
      this._syncTokenTabIndices(0);
    });
  }

  /**
   * @private Reconciles the `value` / `tokens` model pair from one effect run.
   *
   * Whichever surface no longer matches `_syncedRef` is the one that changed and
   * therefore wins; the other is brought to it. On the first run nothing has been
   * propagated yet, so a surface still holding the empty default counts as
   * unchanged and cannot clobber a seeded sibling. `value` is canonical when both
   * sides changed in the same flush.
   */
  private _syncModels(
    value: MlvSelectOption<T>[],
    tokens: MlvSelectOption<T>[],
  ): void {
    const synced = this._syncedRef;
    let resolved: MlvSelectOption<T>[];

    if (value === tokens) {
      resolved = value;
    } else {
      const valueChanged =
        synced === undefined ? value.length > 0 : value !== synced;
      const tokensChanged =
        synced === undefined ? tokens.length > 0 : tokens !== synced;

      resolved = tokensChanged && !valueChanged ? tokens : value;
      if (this.value() !== resolved) this.value.set(resolved);
      if (this.tokens() !== resolved) this.tokens.set(resolved);
    }

    const changed = synced === undefined || resolved !== synced;
    this._syncedRef = resolved;

    if (changed && resolved !== this._internalTokensRef) this._disarm();
  }

  /** @private Sets tabindex 0 on the active token and -1 on the rest. */
  private _syncTokenTabIndices(activeIndex: number): void {
    this._tokens().forEach((token, i) => {
      token.tabIndex.set(i === activeIndex ? 0 : -1);
    });
  }

  readonly visibleTokens = computed(() => {
    const max = this.maxVisible();
    const all = this.tokens();
    return max !== null ? all.slice(0, max) : all;
  });

  readonly overflowCount = computed(() => {
    const max = this.maxVisible();
    if (max === null) return 0;
    return Math.max(0, this.tokens().length - max);
  });

  focusInput(): void {
    // Pointer interaction with the field is a caret move — disarm any selection.
    this._disarm();
    if (!this.computedDisabled()) {
      this._nativeInput?.focus();
    }
  }

  /**
   * @protected Whether the given token is the currently armed one. Armed always
   * targets the last token, matching the from-the-end deletion order.
   */
  protected _isTokenArmed(token: MlvSelectOption<T>): boolean {
    return this._armed() && token === this._lastToken();
  }

  onInputEnter(event: Event): void {
    event.preventDefault();
    // Enter commits typed text (or is a no-op) — never a chip selection.
    this._disarm();
    const raw = this._nativeInput?.value.trim() ?? '';
    if (!raw) return;

    const split = this.splitFn();
    const values = split
      ? split(raw)
          .map((s) => s.trim())
          .filter(Boolean)
      : [raw];
    const create = this.createToken();
    const current = this.tokens();
    const newTokens: MlvSelectOption<T>[] = [];

    for (const val of values) {
      const token = create(val);
      const isDuplicate =
        current.some((t) => t.value === token.value) ||
        newTokens.some((t) => t.value === token.value);
      if (this.allowDuplicates() || !isDuplicate) {
        newTokens.push(token);
      }
    }

    if (newTokens.length > 0) {
      const updated = [...current, ...newTokens];
      this._setTokens(updated);
    }

    this._inputEl()?.clearValue();
    if (this._nativeInput) {
      this._nativeInput.value = '';
    }
  }

  /**
   * Handles Backspace in the text input. When the caret is inside typed text
   * this is a native edit and is left alone. When the input is empty:
   *  - the first press *arms* the last token (visual `primary` selection, no
   *    deletion);
   *  - each subsequent press removes the armed (last) token and arms the new
   *    last one, walking deletion from the end one token per press.
   * Removing the final token leaves the input focused and disarmed.
   */
  onInputBackspace(event: Event): void {
    const val = this._nativeInput?.value ?? '';
    if (val.length !== 0) return; // caret editing text — native backspace
    const current = this.tokens();
    if (current.length === 0) return; // nothing to arm or delete

    event.preventDefault();
    if (!this._armed()) {
      this._armed.set(true); // arm last token; do NOT delete
      this._announceArmed();
      return;
    }
    this._deleteArmedAndRearm(); // already armed → delete + re-arm new last
  }

  /**
   * Handles Delete in the text input. Delete only acts on an already-armed
   * token (parity with the second Backspace): it removes the armed token and
   * arms the new last one. With nothing armed it is a no-op.
   */
  onInputDelete(event: Event): void {
    if (!this._armed()) return;
    event.preventDefault();
    this._deleteArmedAndRearm();
  }

  onInputFocus(): void {
    this.setFocused(true);
  }

  onInputBlur(): void {
    // Focus leaving the field disarms the selection (Gmail-style token UX).
    this._disarm();
    this.setFocused(false);
    this._markTouched();
  }

  /**
   * @protected Clears the armed selection and its live-region announcement.
   * Invoked on typing, caret movement, blur, pointer interaction, Enter, and
   * external token changes.
   */
  protected _disarm(): void {
    if (this._armed()) this._armed.set(false);
    if (this._srMessage()) this._srMessage.set('');
  }

  /**
   * @private Removes the armed (last) token and re-arms the new last token,
   * or disarms when the collection becomes empty. Records the resulting array
   * reference so the external-change effect treats this as an internal mutation.
   */
  private _deleteArmedAndRearm(): void {
    const current = this.tokens();
    if (current.length === 0) {
      this._disarm();
      return;
    }
    const updated = current.slice(0, -1);
    this._internalTokensRef = updated;
    this._setTokens(updated);

    if (updated.length === 0) {
      this._disarm(); // last token removed — input stays focused, disarmed
    } else {
      this._armed.set(true); // arm the new last token
      this._announceArmed();
    }
  }

  /** @private Announces the armed token's label into the polite live region. */
  private _announceArmed(): void {
    this._srMessage.set(this._lastToken()?.label ?? '');
  }

  removeToken(token: MlvSelectOption<T>): void {
    const updated = this.tokens().filter((t) => t !== token);
    this._setTokens(updated);
  }

  onTokenKeydown(event: KeyboardEvent): void {
    this._keyManager?.onKeydown(event);
  }

  /** Whether the control holds a clearable value — At least one token present. */
  readonly hasValue = computed(() => this.tokens().length > 0);

  /** @private Commits one token collection to both public model surfaces. */
  private _setTokens(value: MlvSelectOption<T>[]): void {
    this.tokens.set(value);
    this.value.set(value);
  }
}
