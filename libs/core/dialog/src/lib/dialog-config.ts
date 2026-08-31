import { DIALOG_DATA as CDK_DIALOG_DATA } from '@angular/cdk/dialog';
import type { MlvDirection } from '@malva-ui/cdk/utils';
import type { Injector, TemplateRef, Type } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvOverlayInitialFocus } from '@malva-ui/cdk/overlay';

import type { MlvDialogRef } from './dialog-ref';

/** Built-in size preset names. Any other string resolves through `DIALOG_SIZE_PRESETS`. */
export type MlvDialogSizePreset = 's' | 'm' | 'l' | 'fullscreen';

/** Explicit dialog dimensions. Numbers are pixels; strings are any CSS length. */
export interface MlvDialogSizeConfig {
  /** Width of the overlay pane. */
  width?: string | number;
  /** Height of the overlay pane. Unset lets the content decide. */
  height?: string | number;
  /** Smallest width the pane may shrink to. */
  minWidth?: string | number;
  /** Smallest height the pane may shrink to. */
  minHeight?: string | number;
  /** Largest width the pane may grow to — keep it viewport-relative for small screens. */
  maxWidth?: string | number;
  /** Largest height the pane may grow to; the body scrolls once the content exceeds it. */
  maxHeight?: string | number;
}

/** Map of preset name → dimensions, provided through `DIALOG_SIZE_PRESETS`. */
export type MlvDialogSizePresets = Record<string, MlvDialogSizeConfig>;

/**
 * A preset name or explicit dimensions.
 *
 * The built-in preset names get editor completion; any other registered preset
 * name still works — `(string & {})` keeps the union open without collapsing it
 * to bare `string`.
 */
export type MlvDialogSize =
  | MlvDialogSizePreset
  | (string & {})
  | MlvDialogSizeConfig;

/** `'confirm'` drops the header/footer borders and hides the close button. */
export type MlvDialogAppearance = 'default' | 'confirm';

/** ARIA role of the dialog container. */
export type MlvDialogRole = 'dialog' | 'alertdialog';

/** Static focus restoration target understood by the Angular CDK dialog. */
export type MlvDialogRestoreFocusTarget = boolean | string | HTMLElement;

/**
 * Resolves a focus restoration target immediately before dialog disposal.
 *
 * Use this when the correct target depends on responsive or other UI state
 * that may change while the dialog is open. Returning `true` restores the
 * captured opener only when it is still connected; returning a disconnected
 * element disables restoration for that close.
 */
export type MlvDialogRestoreFocusResolver = () => MlvDialogRestoreFocusTarget;

/**
 * Focus restoration policy applied when a dialog closes.
 *
 * Static boolean, selector, and element values retain the Angular CDK's
 * behavior. A resolver is evaluated at actual disposal so a composed overlay
 * can choose from current UI state rather than freezing its target at open.
 */
export type MlvDialogRestoreFocus =
  | MlvDialogRestoreFocusTarget
  | MlvDialogRestoreFocusResolver;

const DEFAULT_SIZE_PRESETS: MlvDialogSizePresets = {
  s: { width: '400px', maxHeight: '90vh', maxWidth: '90vw' },
  m: { width: '560px', maxHeight: '90vh', maxWidth: '90vw' },
  l: { width: '800px', maxHeight: '90vh', maxWidth: '90vw' },
  fullscreen: {
    width: '100vw',
    height: '100vh',
    maxWidth: '100vw',
    maxHeight: '100vh',
  },
};

/** Registered dialog size presets. Override to add or change presets app-wide. */
export const DIALOG_SIZE_PRESETS = new InjectionToken<MlvDialogSizePresets>(
  'DIALOG_SIZE_PRESETS',
  { providedIn: 'root', factory: () => DEFAULT_SIZE_PRESETS },
);

/**
 * Per-open configuration for `MlvDialogService.open()` and
 * `ng-template[mlvDialog]`'s `mlvDialogOptions`.
 *
 * Everything CDK-related is mapped by the service; `title`, `closable` and
 * `appearance` are Malva-only and are read by `mlv-dialog` /
 * `mlv-dialog-header` through `DIALOG_CONFIG`.
 */
export interface MlvDialogConfig<D = unknown> {
  /** Preset name or explicit dimensions. Defaults to `'m'`. */
  size?: MlvDialogSize;
  /**
   * Text direction applied to the dialog pane.
   *
   * The pane is portaled to `<body>`, so it never inherits a `[dir]` scope the
   * opener sits in. Defaults to the direction resolved from the focused
   * element at open time, then the global direction.
   */
  direction?: MlvDirection;
  /** Surface appearance. Defaults to `'default'`. */
  appearance?: MlvDialogAppearance;
  /**
   * Plain-text title. Used by string content, as the `mlv-dialog-header`
   * fallback when it has neither a `title` input nor projected content, and
   * for the accessible name.
   */
  title?: string;
  /** Default for `mlv-dialog-header`'s close button. Defaults to `true`. */
  closable?: boolean;
  /** Extra class(es) on the overlay pane (`.mlv-dialog-pane`). */
  panelClass?: string | string[];
  /** Extra class(es) on the backdrop (`.mlv-dialog-backdrop`). */
  backdropClass?: string | string[];
  /** Whether a backdrop is rendered. Defaults to `true`. */
  hasBackdrop?: boolean;
  /** Whether a backdrop click closes the dialog. Defaults to `true`. */
  closeOnBackdrop?: boolean;
  /** Whether Escape closes the dialog. Defaults to `true`. */
  closeOnEscape?: boolean;
  /** Whether browser history navigation closes the dialog. Defaults to `true`. */
  closeOnNavigation?: boolean;
  /** Where focus lands once the dialog is open. Defaults to `'auto'`. */
  initialFocus?: MlvOverlayInitialFocus;
  /** Static target or disposal-time resolver. Defaults to `true` (the captured opener). */
  restoreFocus?: MlvDialogRestoreFocus;
  /** ARIA role. Defaults to `'dialog'`. */
  role?: MlvDialogRole;
  /** Accessible name when no visible title labels the dialog. */
  ariaLabel?: string;
  /** Id of an element that labels the dialog. Wins over `ariaLabel` and the header title. */
  ariaLabelledBy?: string;
  /** Id of an element that describes the dialog. */
  ariaDescribedBy?: string;
  /** Payload exposed as `MlvDialogRef.data`, `DIALOG_DATA` and the template context's `data`. */
  data?: D;
  /** Parent injector for the content. Defaults to the root injector. */
  injector?: Injector;
  /** Id of the dialog container. Generated when omitted. */
  id?: string;
}

/**
 * Data passed through `MlvDialogConfig.data`, injectable by component content.
 * This is Angular CDK's `DIALOG_DATA` token re-exported under the same name.
 */
export const DIALOG_DATA: InjectionToken<unknown> = CDK_DIALOG_DATA;

/** The consumer's `MlvDialogConfig` for the current dialog, injectable by content and parts. */
export const DIALOG_CONFIG = new InjectionToken<Readonly<MlvDialogConfig>>(
  'DIALOG_CONFIG',
);

/**
 * Template context for `TemplateRef` content (`let-dialog`, `let-data="data"`).
 * The ref is both the implicit value and the named `ref`.
 */
export interface MlvDialogTemplateContext<R = unknown, D = unknown> {
  /** The dialog's ref, as the implicit value (`let-dialog`). */
  $implicit: MlvDialogRef<R, D>;
  /** The same ref under a name (`let-dialog="ref"`). */
  ref: MlvDialogRef<R, D>;
  /** Payload from `MlvDialogConfig.data` (`let-data="data"`). */
  data: D;
  /** The configuration this dialog was opened with (`let-config="config"`). */
  config: Readonly<MlvDialogConfig<D>>;
}

/** Content accepted by `MlvDialogService.open()`. Strings render as escaped text. */
export type MlvDialogContent<R = unknown, D = unknown> =
  | string
  | TemplateRef<MlvDialogTemplateContext<R, D>>
  | Type<unknown>;
