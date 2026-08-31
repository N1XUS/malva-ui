import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { ElementRef } from '@angular/core';
import {
  afterEveryRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { mlvNextId } from '@malva-ui/cdk/utils';
import { MlvButtonClose } from '@malva-ui/core/button';
import { MLV_DIALOG_I18N } from '@malva-ui/i18n';

import { DIALOG_CONFIG } from './dialog-config';
import { injectDialogRef } from './inject-dialog-ref';

/**
 * Header row of a dialog: the title and the close button.
 *
 * Use it as an element (`<mlv-dialog-header title="…" />`) or as an attribute
 * on a container (`<div mlvDialogHeader>`). Never put it on a heading — project
 * the heading instead: `<mlv-dialog-header><h3>Edit user</h3></mlv-dialog-header>`.
 *
 * Title precedence: `title` input → projected content → `MlvDialogConfig.title`.
 * Close button: `closable` input → `MlvDialogConfig.closable` → `true`, and
 * always off when `MlvDialogConfig.appearance` is `'confirm'`.
 *
 * The title element carries `id="<dialogId>-title-<n>"` — unique per header, so
 * two headers in one dialog never collide — and is registered as the
 * dialog's label, so the visible title is the accessible name unless the
 * config sets `ariaLabelledBy` / `ariaLabel`. The label follows the rendered
 * title: the id is registered as soon as the title element gains text — an
 * asynchronous title (`[title]="user()?.name"`, a projected heading fed by a
 * resolver) is picked up — and removed again when it loses it. A header that
 * renders no title at all (used only to host the close button) registers
 * nothing — labelling the dialog with an empty element would leave it without
 * an accessible name.
 */
@Component({
  // Attribute form intentionally enhances the consumer's own header container.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'mlv-dialog-header, [mlvDialogHeader]',
  imports: [MlvButtonClose],
  template: `
    @if (title(); as text) {
      <h2 #titleEl class="mlv-dialog__title" [id]="_titleId">{{ text }}</h2>
    } @else {
      <div #titleEl class="mlv-dialog__title" [id]="_titleId">
        <ng-content>
          @if (_configTitle; as text) {
            <h2>{{ text }}</h2>
          }
        </ng-content>
      </div>
    }
    @if (_closable()) {
      <!-- The wrapper hosts a real <button>, so the bubbled native click already
           covers pointer, Enter and Space. -->
      <mlv-button-close
        class="mlv-dialog__close"
        mlvDensity="compact"
        shape="circle"
        variant="secondary"
        [ariaLabel]="_i18n().closeDialog"
        (click)="_close()"
      />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-dialog__header',
    // `<mlv-dialog-header title="…">` feeds the input but also leaves a native
    // `title` attribute behind; bindings apply after static attributes, so this
    // strips it and the header row gets no browser tooltip.
    '[attr.title]': 'null',
  },
})
export class MlvDialogHeader {
  /** Plain-text title rendered as `<h2>`. Wins over projected content and the config title. */
  readonly title = input<string>();

  /**
   * Whether the close button is rendered. Unset → `MlvDialogConfig.closable`
   * → `true`. Ignored (always hidden) when the dialog `appearance` is `'confirm'`.
   */
  readonly closable = input<boolean | undefined, BooleanInput>(undefined, {
    transform: (value) =>
      value == null ? undefined : coerceBooleanProperty(value),
  });

  /** @protected The dialog this header labels and closes. */
  protected readonly _ref = injectDialogRef('mlv-dialog-header');
  /** @protected Per-open configuration (title / closable / appearance fallbacks). */
  protected readonly _config = inject(DIALOG_CONFIG);
  /** @protected i18n strings — `closeDialog` labels the X. */
  protected readonly _i18n = inject(MLV_DIALOG_I18N);
  /**
   * @protected Id of the title element; the ref registers it as the dialog
   * label. Per instance, not per dialog — two headers in the same dialog (a
   * sticky bar plus a scrolled-away one, say) must not collide on one id.
   */
  protected readonly _titleId = mlvNextId(`${this._ref.id}-title`);
  /** @protected Config title used as the `<ng-content>` fallback. */
  protected readonly _configTitle = this._config.title;
  /** @protected Resolved close-button visibility (see class docs for precedence). */
  protected readonly _closable = computed(() =>
    this._config.appearance === 'confirm'
      ? false
      : (this.closable() ?? this._config.closable ?? true),
  );

  /**
   * @protected The rendered title element, in either branch. Its text decides
   * whether the dialog is labelled by this header.
   */
  protected readonly _titleEl = viewChild<ElementRef<HTMLElement>>('titleEl');

  /** @private Whether {@link _titleId} is currently registered as the dialog's label. */
  private _labelled = false;
  /** @private Set on destroy so a queued render callback never runs on a torn-down view. */
  private _destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._destroyed = true;
      if (this._labelled) {
        this._labelled = false;
        this._ref._unlabelBy(this._titleId);
      }
    });
    // The title is only observable from the DOM (input, projected content or
    // the config fallback), and it can change at any time, so the decision is
    // re-taken after every render rather than latched on the first one.
    afterEveryRender(() => this._syncLabel());
  }

  /**
   * @private Keeps the dialog's label in sync with the rendered title: the id
   * is registered as soon as the title element has text and removed again when
   * it loses it, so a title that only arrives asynchronously still names the
   * dialog. An empty title element would still win the CDK's `aria-labelledby`
   * queue and leave the dialog with an empty accessible name (an axe
   * `aria-dialog-name` violation), so a header without any title — no `title`
   * input, no projected content, no `config.title` — registers nothing.
   */
  private _syncLabel(): void {
    if (this._destroyed) {
      return;
    }
    const hasText = !!this._titleEl()?.nativeElement.textContent?.trim();
    if (hasText === this._labelled) {
      return;
    }
    this._labelled = hasText;
    if (hasText) {
      this._ref._labelBy(this._titleId);
    } else {
      this._ref._unlabelBy(this._titleId);
    }
  }

  /** @protected Closes the dialog with no result, as the X always does. */
  protected _close(): void {
    this._ref.close();
  }
}
