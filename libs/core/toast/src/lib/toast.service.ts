import type { TemplateRef, Type } from '@angular/core';
import { Injectable, Injector } from '@angular/core';
import {
  MLV_TOAST_DEFAULT_POSITION,
  MlvAbstractToastService,
} from './abstract-toast.service';
import { MlvToastContainer } from './toast-container/toast-container';
import type {
  MlvInternalToast,
  MlvToastContent,
  MlvToastConfig,
  MlvToastOpenConfig,
  MlvToastPoliteness,
  MlvToastPosition,
  MlvToastTemplateContext,
  MlvToastTone,
} from './toast.types';
import {
  joinAnnouncementParts,
  resolveToastPoliteness,
  TOAST_CONFIG,
  TOAST_DATA,
} from './toast.types';
import { MlvToastItem } from './toast-item/toast-item';
import type { MlvIAbstractToastComponent } from './abstract-toast-container';
import { MlvToastRef } from './toast-ref';

/** @internal Normalized config passed through the existing `show()` pipeline. */
interface InternalToastConfig extends MlvToastConfig {
  dynamicContent?: Exclude<MlvToastContent, string>;
  openConfig?: MlvToastOpenConfig;
}

@Injectable({ providedIn: 'root' })
export class MlvToastService extends MlvAbstractToastService<
  MlvToastConfig,
  MlvInternalToast,
  MlvIAbstractToastComponent<MlvInternalToast>,
  MlvToastRef
> {
  /** @protected Per-position CDK overlay container component. */
  protected override readonly containerType = MlvToastContainer;

  protected override readonly toastItemType = MlvToastItem;

  /**
   * @protected Announces the title and description. Returns `null` for template
   * and component content, whose rendered text the service cannot read — that
   * content is responsible for announcing anything it needs to.
   */
  protected override resolveAnnouncement(
    config: MlvToastConfig,
  ): { message: string; politeness: MlvToastPoliteness } | null {
    if ((config as InternalToastConfig).dynamicContent) {
      return null;
    }
    const message = joinAnnouncementParts([config.title, config.description]);

    return message
      ? {
          message,
          politeness: resolveToastPoliteness(config.tone ?? 'default'),
        }
      : null;
  }

  /** @protected Builds a fully-resolved internal toast from user config, applying defaults. */
  protected override buildItem(
    id: string,
    config: MlvToastConfig,
    ref: MlvToastRef,
  ): MlvInternalToast {
    const internalConfig = config as InternalToastConfig;
    const openConfig = internalConfig.openConfig;
    const contentContext: MlvToastTemplateContext | undefined = openConfig
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
            { provide: MlvToastRef, useValue: ref },
            { provide: TOAST_DATA, useValue: openConfig.data },
            { provide: TOAST_CONFIG, useValue: openConfig },
          ],
        })
      : undefined;

    return {
      id,
      title: config.title,
      description: config.description ?? '',
      position: config.position ?? MLV_TOAST_DEFAULT_POSITION,
      tone: config.tone ?? 'default',
      shape: config.shape ?? 'default',
      icon: config.icon ?? false,
      displayTime: config.displayTime ?? 4000,
      pauseOnHover: config.pauseOnHover ?? true,
      closable: config.closable ?? true,
      content: internalConfig.dynamicContent,
      contentContext,
      contentInjector,
    };
  }

  /**
   * Opens escaped string, template, or component content as a toast.
   *
   * Template content receives `MlvToastTemplateContext`; component content can
   * inject `MlvToastRef`, `TOAST_DATA`, and `TOAST_CONFIG`.
   */
  open<D = unknown>(
    content: MlvToastContent<D>,
    config: MlvToastOpenConfig<D> = {},
  ): MlvToastRef<D> {
    if (typeof content === 'string') {
      return super.show({ ...config, title: content }) as MlvToastRef<D>;
    }

    if (this._isContentObject(content)) {
      return super.show({
        ...config,
        title: content.title ?? '',
        description: content.description ?? '',
      }) as MlvToastRef<D>;
    }

    const internalConfig: InternalToastConfig = {
      ...config,
      title: '',
      dynamicContent: content as
        | TemplateRef<MlvToastTemplateContext>
        | Type<unknown>,
      openConfig: config,
      // Template and component content supply their own leading icon through
      // `[mlvToastIcon]`; a built-in one would compete with it.
      icon: false,
    };
    return super.show(internalConfig) as MlvToastRef<D>;
  }

  private _isContentObject<D>(
    content: MlvToastContent<D>,
  ): content is { title?: string; description?: string } {
    return (
      typeof content === 'object' &&
      (Object.prototype.hasOwnProperty.call(content, 'title') ||
        Object.prototype.hasOwnProperty.call(content, 'description'))
    );
  }

  /** @protected Creates a data-aware reference for each toast. */
  protected override _createRef(
    id: string,
    position: MlvToastPosition,
    config: MlvToastConfig,
  ): MlvToastRef {
    return new MlvToastRef(id, config.data, () => this.close(id, position));
  }

  success(
    title: string,
    config?: Omit<MlvToastConfig, 'title' | 'tone'>,
  ): MlvToastRef {
    return this.show({ ...config, title, tone: 'success' });
  }

  error(
    title: string,
    config?: Omit<MlvToastConfig, 'title' | 'tone'>,
  ): MlvToastRef {
    return this.show({ ...config, title, tone: 'danger' });
  }

  warning(
    title: string,
    config?: Omit<MlvToastConfig, 'title' | 'tone'>,
  ): MlvToastRef {
    return this.show({ ...config, title, tone: 'warning' });
  }

  info(
    title: string,
    config?: Omit<MlvToastConfig, 'title' | 'tone'>,
  ): MlvToastRef {
    return this.show({ ...config, title, tone: 'info' });
  }

  /** Show a toast with the given tone (shorthand). */
  tone(
    v: MlvToastTone,
    title: string,
    config?: Omit<MlvToastConfig, 'title' | 'tone'>,
  ): MlvToastRef {
    return this.show({ ...config, title, tone: v });
  }
}
