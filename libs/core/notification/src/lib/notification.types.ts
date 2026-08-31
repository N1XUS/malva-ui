import type {
  MlvBaseToastConfig,
  MlvInternalBaseToast,
} from '@malva-ui/core/toast';
import type { Injector, TemplateRef, Type } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvTone } from '@malva-ui/cdk/utils';
import type { MlvNotificationRef } from './notification-ref';

export type MlvNotificationTone = MlvTone | 'default';

export interface MlvNotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}

export interface MlvNotificationConfig<D = unknown>
  extends MlvBaseToastConfig<D> {
  title: string;
  description?: string;
  tone?: MlvNotificationTone;
  actions?: MlvNotificationAction[];
  /** Override the auto-selected icon. Pass null to hide the icon. */
  showIcon?: boolean;
}

/** Options for `MlvNotificationService.open()` where content is supplied separately. */
export interface MlvNotificationOpenConfig<D = unknown>
  extends MlvBaseToastConfig<D> {
  description?: string;
  tone?: MlvNotificationTone;
  actions?: MlvNotificationAction[];
  showIcon?: boolean;
}

/** Context exposed when `MlvNotificationService.open()` receives a `TemplateRef`. */
export interface MlvNotificationTemplateContext<D = unknown> {
  $implicit: MlvNotificationRef<D>;
  ref: MlvNotificationRef<D>;
  data: D;
  config: Readonly<MlvNotificationOpenConfig<D>>;
}

/** Content accepted by `MlvNotificationService.open()`. Strings are rendered as escaped text. */
export type MlvNotificationContent<D = unknown> =
  | string
  | TemplateRef<MlvNotificationTemplateContext<D>>
  | Type<unknown>;

/** Data available to component content opened through `MlvNotificationService.open()`. */
export const NOTIFICATION_DATA = new InjectionToken<unknown>(
  'NOTIFICATION_DATA',
);

/** Configuration available to component content opened through `MlvNotificationService.open()`. */
export const NOTIFICATION_CONFIG = new InjectionToken<
  Readonly<MlvNotificationOpenConfig>
>('NOTIFICATION_CONFIG');

export interface MlvInternalNotification extends MlvInternalBaseToast {
  title: string;
  description: string;
  tone: MlvNotificationTone;
  actions: MlvNotificationAction[];
  showIcon: boolean;
  /** Dynamic template/component content; strings use the existing title rendering path. */
  content?: Exclude<MlvNotificationContent, string>;
  /** Context supplied to dynamic template content. */
  contentContext?: MlvNotificationTemplateContext;
  /** Per-item injector supplied to dynamic template/component content. */
  contentInjector?: Injector;
}
