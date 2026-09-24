import type { Injector, TemplateRef, Type } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvTone } from '@malva-ui/cdk/utils';
import type { Observable } from 'rxjs';
import type { MlvToastRef } from './toast-ref';

export type MlvToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type MlvToastTone = MlvTone | 'default';

/**
 * Outer shape of a toast item.
 *
 * - `'default'` — rectangle with the standard large corner radius.
 * - `'pill'` — fully rounded, content-hugging compact bar.
 */
export type MlvToastShape = 'default' | 'pill';

export const MLV_TOAST_CLOSE = new InjectionToken<(id: string) => void>(
  'MLV_TOAST_CLOSE',
);

/** Politeness used when announcing a toast/notification through `LiveAnnouncer`. */
export type MlvToastPoliteness = 'polite' | 'assertive';

/**
 * Maps a toast/notification tone to its default announcement politeness.
 *
 * High-urgency tones (`danger`, `warning`) announce assertively so assistive
 * technology interrupts the user. Informational tones (`success`, `info`,
 * `default`) announce politely, without interrupting the current context.
 *
 * Callers can override the result per item with `MlvBaseToastConfig.politeness`.
 *
 * @param tone - The resolved toast/notification tone.
 * @returns `'assertive'` for danger/warning, otherwise `'polite'`.
 */
export function resolveToastPoliteness(tone: string): MlvToastPoliteness {
  return tone === 'danger' || tone === 'warning' ? 'assertive' : 'polite';
}

/**
 * Joins the text fragments of a toast/notification into one announcement string.
 *
 * Blank and absent fragments are dropped rather than interpolated — otherwise an
 * omitted description announces a stray separator, or the literal text
 * "undefined". Trailing sentence punctuation is normalised so a description that
 * already ends in a full stop does not produce a doubled one.
 *
 * @param parts - Fragments in reading order (title, description, action labels…).
 * @returns The joined announcement, or `''` when nothing is announceable.
 */
export function joinAnnouncementParts(
  parts: readonly (string | undefined | null)[],
): string {
  return parts
    .map((part) => part?.trim().replace(/[.!?]+$/, '') ?? '')
    .filter((part) => part.length > 0)
    .join('. ');
}

export interface MlvBaseToastConfig<D = unknown> {
  position?: MlvToastPosition;
  /** Arbitrary data available to dynamic content through the ref, token, and template context. */
  data?: D;
  /** Parent injector used for dynamically rendered template or component content. */
  injector?: Injector;
  /** Duration in ms before auto-close. 0 = never auto-close. Default: 4000 */
  displayTime?: number;
  /** Pause the timer when cursor is over the item, restart on leave. Default: true */
  pauseOnHover?: boolean;
  /** Show the X close button. When false, only displayTime can close it. Default: true */
  closable?: boolean;
  /**
   * Politeness used when announcing this item through the CDK `LiveAnnouncer`.
   * Defaults to `resolveToastPoliteness(tone)` — assertive for danger/warning,
   * polite otherwise.
   *
   * The announcement is made from a single persistent live region owned by
   * `LiveAnnouncer`, not from the rendered item. The item itself carries no
   * `role`/`aria-live`, so nothing is announced twice and a stack of items does
   * not create a stack of live regions.
   *
   * Items shown before `LiveAnnouncer` writes (it waits 100 ms) — a toast and a
   * notification included — are read as one announcement, assertive items
   * first, so none replaces another. That announcement is assertive when any
   * item in it is: a polite item shown beside an assertive one is read inside
   * the assertive announcement.
   */
  politeness?: MlvToastPoliteness;
}

export interface MlvInternalBaseToast {
  id: string;
  position: MlvToastPosition;
  displayTime: number;
  pauseOnHover: boolean;
  closable: boolean;
}

export interface MlvBaseToastRef {
  readonly id: string;
  close(): void;
  afterClosed(): Observable<void>;
}

export interface MlvToastConfig<D = unknown> extends MlvBaseToastConfig<D> {
  title: string;
  description?: string;
  tone?: MlvToastTone;
  /**
   * Shows the tone-derived Lucide icon. Only the four semantic tones have one —
   * with `tone: 'default'` this renders nothing. Default: false.
   */
  icon?: boolean;
  /** Outer shape. Default: `'default'`. */
  shape?: MlvToastShape;
}

/** Options for `MlvToastService.open()` where content is supplied separately. */
export interface MlvToastOpenConfig<D = unknown> extends MlvBaseToastConfig<D> {
  description?: string;
  tone?: MlvToastTone;
  /**
   * Shows the tone-derived Lucide icon. Applies only when `open()` receives
   * string or `{ title, description }` content — template and component content
   * own their own leading icon through `[mlvToastIcon]`, so the built-in icon is
   * always suppressed for those branches. Default: false.
   */
  icon?: boolean;
  /** Outer shape. Default: `'default'`. */
  shape?: MlvToastShape;
}

/** Context exposed when `MlvToastService.open()` receives a `TemplateRef`. */
export interface MlvToastTemplateContext<D = unknown> {
  $implicit: MlvToastRef<D>;
  ref: MlvToastRef<D>;
  data: D;
  config: Readonly<MlvToastOpenConfig<D>>;
}

/** Content accepted by `MlvToastService.open()`. Strings are rendered as escaped text. */
export type MlvToastContent<D = unknown> =
  | string
  | { title?: string; description?: string }
  | TemplateRef<MlvToastTemplateContext<D>>
  | Type<unknown>;

/** Data available to component content opened through `MlvToastService.open()`. */
export const TOAST_DATA = new InjectionToken<unknown>('TOAST_DATA');

/** Configuration available to component content opened through `MlvToastService.open()`. */
export const TOAST_CONFIG = new InjectionToken<Readonly<MlvToastOpenConfig>>(
  'TOAST_CONFIG',
);

export interface MlvInternalToast extends MlvInternalBaseToast {
  title: string;
  description: string;
  tone: MlvToastTone;
  /**
   * Resolved by `MlvToastService`, but kept optional like `icon` so that
   * `MlvInternalNotification` — which reuses `MlvToastContainer`, whose generic is
   * constrained to this interface — stays structurally compatible. Absent is
   * treated as `'default'`.
   */
  shape?: MlvToastShape;
  /** Dynamic template/component content; strings use the existing title rendering path. */
  content?: Exclude<MlvToastContent, string>;
  /** Context supplied to dynamic template content. */
  contentContext?: MlvToastTemplateContext;
  /** Per-item injector supplied to dynamic template/component content. */
  contentInjector?: Injector;
  icon?: boolean;
}
