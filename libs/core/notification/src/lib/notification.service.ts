import type { TemplateRef, Type } from '@angular/core';
import { Injectable, Injector } from '@angular/core';
import type {
  MlvIAbstractToastComponent,
  MlvToastPoliteness,
  MlvToastPosition,
} from '@malva-ui/core/toast';
import {
  MLV_TOAST_DEFAULT_POSITION,
  MlvAbstractToastService,
  MlvToastContainer,
  MlvToastRef,
  joinAnnouncementParts,
  resolveToastPoliteness,
} from '@malva-ui/core/toast';
import type {
  MlvInternalNotification,
  MlvNotificationContent,
  MlvNotificationConfig,
  MlvNotificationOpenConfig,
  MlvNotificationTemplateContext,
  MlvNotificationTone,
} from './notification.types';
import { NOTIFICATION_CONFIG, NOTIFICATION_DATA } from './notification.types';
import { MlvNotificationItem } from './notification-item/notification-item';
import { MlvNotificationRef } from './notification-ref';

type NotificationConfigWithoutTitleAndTone = Omit<
  MlvNotificationConfig,
  'title' | 'tone'
>;

/** @internal Normalized config passed through the existing `show()` pipeline. */
interface InternalNotificationConfig extends MlvNotificationConfig {
  dynamicContent?: Exclude<MlvNotificationContent, string>;
  openConfig?: MlvNotificationOpenConfig;
}

@Injectable({ providedIn: 'root' })
export class MlvNotificationService extends MlvAbstractToastService<
  MlvNotificationConfig,
  MlvInternalNotification,
  MlvIAbstractToastComponent<MlvInternalNotification>,
  MlvNotificationRef
> {
  /** @protected Overlay container component reused from `@malva-ui/core/toast`. */
  protected override readonly containerType = MlvToastContainer;

  /** @protected Concrete item component the container renders for each notification. */
  protected override readonly toastItemType = MlvNotificationItem;

  /**
   * @protected Announces the title, description, and the labels of any action
   * buttons — a keyboard or screen-reader user needs to know an action exists,
   * since notifications never steal focus. Returns `null` for template and
   * component content, whose rendered text the service cannot read.
   */
  protected override resolveAnnouncement(
    config: MlvNotificationConfig,
  ): { message: string; politeness: MlvToastPoliteness } | null {
    if ((config as InternalNotificationConfig).dynamicContent) {
      return null;
    }
    const message = joinAnnouncementParts([
      config.title,
      config.description,
      ...(config.actions ?? []).map((action) => action.label),
    ]);

    return message
      ? {
          message,
          politeness: resolveToastPoliteness(config.tone ?? 'default'),
        }
      : null;
  }

  /** @protected Builds a fully-resolved internal notification from user config, applying defaults. */
  protected override buildItem(
    id: string,
    config: MlvNotificationConfig,
    ref: MlvNotificationRef,
  ): MlvInternalNotification {
    const internalConfig = config as InternalNotificationConfig;
    const openConfig = internalConfig.openConfig;
    const contentContext: MlvNotificationTemplateContext | undefined =
      openConfig
        ? {
            $implicit: ref,
            ref,
            data: openConfig.data,
            config: openConfig,
          }
        : undefined;
    const contentInjector = openConfig
      ? Injector.create({
          parent: openConfig.injector ?? this._environmentInjector,
          providers: [
            { provide: MlvNotificationRef, useValue: ref },
            { provide: MlvToastRef, useValue: ref },
            { provide: NOTIFICATION_DATA, useValue: openConfig.data },
            { provide: NOTIFICATION_CONFIG, useValue: openConfig },
          ],
        })
      : undefined;

    return {
      id,
      title: config.title,
      description: config.description ?? '',
      position: config.position ?? MLV_TOAST_DEFAULT_POSITION,
      tone: config.tone ?? 'default',
      displayTime: config.displayTime ?? 6000,
      pauseOnHover: config.pauseOnHover ?? true,
      closable: config.closable ?? true,
      actions: config.actions ?? [],
      showIcon: config.showIcon ?? true,
      content: internalConfig.dynamicContent,
      contentContext,
      contentInjector,
    };
  }

  /**
   * Opens escaped string, template, or component content as a notification.
   *
   * Template content receives `MlvNotificationTemplateContext`; component content
   * can inject `MlvNotificationRef`, `NOTIFICATION_DATA`, and
   * `NOTIFICATION_CONFIG`.
   */
  open<D = unknown>(
    content: MlvNotificationContent<D>,
    config: MlvNotificationOpenConfig<D> = {},
  ): MlvNotificationRef<D> {
    if (typeof content === 'string') {
      return super.show({ ...config, title: content }) as MlvNotificationRef<D>;
    }

    const internalConfig: InternalNotificationConfig = {
      ...config,
      title: '',
      dynamicContent: content as
        | TemplateRef<MlvNotificationTemplateContext>
        | Type<unknown>,
      openConfig: config,
    };
    return super.show(internalConfig) as MlvNotificationRef<D>;
  }

  /** @protected Creates a data-aware reference for each notification. */
  protected override _createRef(
    id: string,
    position: MlvToastPosition,
    config: MlvNotificationConfig,
  ): MlvNotificationRef {
    return new MlvNotificationRef(id, config.data, () =>
      this.close(id, position),
    );
  }

  success(
    title: string,
    config?: NotificationConfigWithoutTitleAndTone,
  ): MlvNotificationRef {
    return this.show({ ...config, title, tone: 'success' });
  }

  error(
    title: string,
    config?: NotificationConfigWithoutTitleAndTone,
  ): MlvNotificationRef {
    return this.show({ ...config, title, tone: 'danger' });
  }

  warning(
    title: string,
    config?: NotificationConfigWithoutTitleAndTone,
  ): MlvNotificationRef {
    return this.show({ ...config, title, tone: 'warning' });
  }

  info(
    title: string,
    config?: NotificationConfigWithoutTitleAndTone,
  ): MlvNotificationRef {
    return this.show({ ...config, title, tone: 'info' });
  }

  tone(
    v: MlvNotificationTone,
    title: string,
    config?: NotificationConfigWithoutTitleAndTone,
  ): MlvNotificationRef {
    return this.show({ ...config, title, tone: v });
  }
}
