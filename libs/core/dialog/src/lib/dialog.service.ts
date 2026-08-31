import { coerceArray, coerceCssPixelValue } from '@angular/cdk/coercion';
import type { DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { Dialog } from '@angular/cdk/dialog';
import { hasModifierKey } from '@angular/cdk/keycodes';
import type { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject, TemplateRef } from '@angular/core';
import type { Type } from '@angular/core';
import { MlvRtlService, mlvNextId } from '@malva-ui/cdk/utils';
import type { Observable } from 'rxjs';
import { filter, map, shareReplay } from 'rxjs';

import type { MlvConfirmDialogOptions } from './confirm-dialog-options';
import {
  MLV_CONFIRM_DIALOG_CANCEL_CLASS,
  MLV_CONFIRM_DIALOG_CONFIRM_CLASS,
  MlvConfirmDialog,
  mlvIsDestructiveConfirm,
} from './confirm-dialog';
import type {
  MlvDialogConfig,
  MlvDialogContent,
  MlvDialogSize,
  MlvDialogSizeConfig,
  MlvDialogTemplateContext,
} from './dialog-config';
import { DIALOG_CONFIG, DIALOG_SIZE_PRESETS } from './dialog-config';
import { MlvDialogContainer } from './dialog-container';
import { MlvDialogRef } from './dialog-ref';
import { MLV_DIALOG_TEXT, MlvDialogTextContent } from './dialog-text-content';

/** @internal Size fields of the CDK config, resolved from a preset or explicit size. */
type CdkSize = Pick<
  DialogConfig,
  'width' | 'height' | 'minWidth' | 'minHeight' | 'maxWidth' | 'maxHeight'
>;

/**
 * Opens modal dialogs. Thin orchestration over Angular CDK `Dialog`: the CDK
 * owns overlay, container, focus trap/restore, ARIA and history handling;
 * this service maps `MlvDialogConfig`, constructs the `MlvDialogRef`, plays
 * the leave animation, and applies the granular Escape/backdrop opt-outs.
 *
 * It never renders chrome. Template and component content must have a
 * `<mlv-dialog>` root; string content is wrapped by an internal renderer that
 * composes the same parts.
 */
@Injectable({ providedIn: 'root' })
export class MlvDialogService {
  /** @private The CDK engine. */
  private readonly _cdk = inject(Dialog);

  /**
   * @private Resolves the direction for the portaled dialog pane, which never
   * inherits a `[dir]` scope from the element that opened it.
   */
  private readonly _rtl = inject(MlvRtlService);
  /** @private Registered size presets. */
  private readonly _presets = inject(DIALOG_SIZE_PRESETS);
  /** @private Open Malva refs in open order, so `closeAll()` can animate each. */
  private readonly _open: MlvDialogRef[] = [];

  /** Snapshot of the currently open dialogs, oldest first. */
  get openDialogs(): readonly MlvDialogRef[] {
    return [...this._open];
  }

  /**
   * Opens `content` in a modal dialog.
   *
   * - `TemplateRef` receives `MlvDialogTemplateContext` (`let-dialog`,
   *   `let-data="data"`, `let-config="config"`).
   * - A component can inject `MlvDialogRef`, `DIALOG_CONFIG`, `DIALOG_DATA`
   *   (and the CDK `DialogRef`).
   * - A string is rendered as escaped text under `config.title`.
   *
   * @param content - Template, component type, or plain text.
   * @param config - Size, chrome defaults, closing behaviour, focus, ARIA, data, injector.
   * @returns A typed reference that controls the dialog and emits its result.
   */
  open<R = unknown, D = unknown>(
    content: MlvDialogContent<R, D>,
    config: MlvDialogConfig<D> = {},
  ): MlvDialogRef<R, D> {
    const frozen: Readonly<MlvDialogConfig<D>> = { ...config };
    const isText = typeof content === 'string';
    const size = frozen.size ?? 'm';
    const restoreFocus = frozen.restoreFocus ?? true;
    let ref!: MlvDialogRef<R, D>;

    // Third generic (container) deliberately left at its default: narrowing it
    // to MlvDialogContainer makes the `container.providers` callback type
    // incompatible with Dialog.open()'s parameter.
    const cdkConfig: DialogConfig<D, DialogRef<R>> = {
      ...this._resolveSize(size),
      panelClass: [
        'mlv-dialog-pane',
        // The `fullscreen` preset only sizes the pane; the modifier is what
        // drops the surface's desktop radius/border and its viewport cap.
        ...(size === 'fullscreen' ? ['mlv-dialog-pane--fullscreen'] : []),
        ...coerceArray(frozen.panelClass ?? []),
      ],
      backdropClass: [
        'mlv-dialog-backdrop',
        ...coerceArray(frozen.backdropClass ?? []),
      ],
      hasBackdrop: frozen.hasBackdrop ?? true,
      // Escape/backdrop are handled below so each is independently optional
      // and the leave animation always plays.
      disableClose: true,
      // The CDK focuses the container; MlvDialogContainer then applies `initialFocus`.
      autoFocus: 'dialog',
      // A dynamic policy is resolved by MlvDialogContainer immediately before
      // its inherited CDK destroy hook performs focus restoration.
      restoreFocus: typeof restoreFocus === 'function' ? false : restoreFocus,
      role: frozen.role ?? 'dialog',
      ariaLabel:
        frozen.ariaLabel ??
        (isText && !frozen.title ? (content as string) : null),
      ariaLabelledBy: frozen.ariaLabelledBy ?? null,
      ariaDescribedBy: frozen.ariaDescribedBy ?? null,
      closeOnNavigation: frozen.closeOnNavigation ?? true,
      // The pane is portaled to <body>, outside any `[dir]` scope the opener
      // sits in, so the direction has to be passed explicitly. The focused
      // element at open time is the opener in practice; the global direction
      // is the fallback.
      direction:
        frozen.direction ??
        this._rtl.resolveDirection(
          typeof document === 'undefined'
            ? null
            : (document.activeElement as HTMLElement | null),
        ),
      data: frozen.data,
      injector: frozen.injector,
      id: frozen.id,
      container: {
        type: MlvDialogContainer,
        providers: () => [{ provide: DIALOG_CONFIG, useValue: frozen }],
      },
      templateContext: (): MlvDialogTemplateContext<R, D> => ({
        $implicit: ref,
        ref,
        data: frozen.data as D,
        config: frozen,
      }),
      providers: (cdkRef) => {
        ref = new MlvDialogRef<R, D>(cdkRef, frozen);
        return [
          { provide: MlvDialogRef, useValue: ref },
          { provide: DIALOG_CONFIG, useValue: frozen },
          ...(isText ? [{ provide: MLV_DIALOG_TEXT, useValue: content }] : []),
        ];
      },
    };

    const target: ComponentType<unknown> | TemplateRef<unknown> = isText
      ? MlvDialogTextContent
      : content instanceof TemplateRef
        ? content
        : (content as Type<unknown>);
    const cdkRef = this._cdk.open<R, D, unknown>(target, cdkConfig);

    // Both refs are invariant in `R` (it surfaces in the contravariant
    // `DialogConfig.providers` callback), so neither typed ref is assignable to
    // its erased form. Erasing here is safe: `_track` only closes and
    // de-registers, and never reads the result type.
    this._track(ref as MlvDialogRef, cdkRef as DialogRef, frozen);
    return ref;
  }

  /**
   * Opens a two-action confirmation dialog and reports the user's answer.
   *
   * Emits exactly once and completes, so it composes with a `CanDeactivateFn`
   * or any other guard. The answer is replayed, so late subscribers still
   * receive it — subscribing after the dialog has already closed is fine.
   * Every dismissal that is not the confirm button — Escape, the backdrop,
   * `ref.close()` — resolves as `false`. When the action is `destructive` (or
   * has the `'danger'` tone) the dialog opens as an `alertdialog`, the confirm
   * button turns danger-coloured and initial focus goes to **Cancel**. The
   * message paragraph always describes the dialog (`aria-describedby`).
   *
   * @param options - Title, message, and optional labels/tone/size.
   * @returns `true` only if confirmed.
   */
  confirm(options: MlvConfirmDialogOptions): Observable<boolean> {
    const destructive = mlvIsDestructiveConfirm(options);
    const ref = this.open<boolean, MlvConfirmDialogOptions>(MlvConfirmDialog, {
      size: options.size ?? 's',
      // The two actions are the whole point; the surface drops the chrome
      // borders and the header hides its close button.
      appearance: 'confirm',
      data: options,
      // An irreversible action is an interruption that needs an answer now.
      role: destructive ? 'alertdialog' : 'dialog',
      // The component binds this id on its message paragraph, so the container
      // is described by the very text the user has to act on.
      ariaDescribedBy: mlvNextId('mlv-confirm-message'),
      closeOnBackdrop: options.closeOnBackdrop,
      closeOnEscape: options.closeOnEscape,
      injector: options.injector,
      initialFocus: destructive
        ? `.${MLV_CONFIRM_DIALOG_CANCEL_CLASS}`
        : `.${MLV_CONFIRM_DIALOG_CONFIRM_CLASS}`,
    });
    const answer$ = ref.afterClosed().pipe(
      map((result) => result === true),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    // `afterClosed()` is the CDK's hot `closed` subject: it emits once and
    // completes, so a subscriber that only arrives after the dialog closed
    // would get nothing. `shareReplay` alone does not fix that — it is lazy —
    // so the buffer is connected here, while the dialog is still open.
    answer$.subscribe();
    return answer$;
  }

  /** Closes every open dialog, newest first, playing each leave animation. */
  closeAll(): void {
    [...this._open].reverse().forEach((ref) => ref.close());
  }

  /** @private Registers the ref and wires the Escape/backdrop close behaviours. */
  private _track(
    ref: MlvDialogRef,
    cdkRef: DialogRef,
    config: Readonly<MlvDialogConfig>,
  ): void {
    this._open.push(ref);
    cdkRef.closed.subscribe(() => {
      const index = this._open.indexOf(ref);
      if (index > -1) {
        this._open.splice(index, 1);
      }
    });

    if (config.closeOnBackdrop !== false) {
      cdkRef.backdropClick.subscribe(() => ref.close());
    }
    if (config.closeOnEscape !== false) {
      cdkRef.keydownEvents
        .pipe(
          filter((event) => event.key === 'Escape' && !hasModifierKey(event)),
        )
        .subscribe((event) => {
          event.preventDefault();
          ref.close();
        });
    }
  }

  /** @private Resolves a preset name (unknown → `'m'`) or explicit size to CDK size fields. */
  private _resolveSize(size: MlvDialogSize): CdkSize {
    const resolved: MlvDialogSizeConfig =
      typeof size === 'string'
        ? (this._presets[size] ?? this._presets['m'] ?? {})
        : size;
    return {
      width: coerceCssPixelValue(resolved.width),
      height: coerceCssPixelValue(resolved.height),
      minWidth: coerceCssPixelValue(resolved.minWidth),
      minHeight: coerceCssPixelValue(resolved.minHeight),
      maxWidth: coerceCssPixelValue(resolved.maxWidth),
      maxHeight: coerceCssPixelValue(resolved.maxHeight),
    };
  }
}
