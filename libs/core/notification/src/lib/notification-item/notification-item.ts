import type { OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  TemplateRef,
} from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  LucideDynamicIcon,
  LucideInfo,
  LucideCircleCheck,
  LucideCircleAlert,
  LucideTriangleAlert,
} from '@lucide/angular';
import { MlvAbstractToastItem } from '@malva-ui/core/toast';
import type {
  MlvInternalNotification,
  MlvNotificationAction,
} from '../notification.types';
import { MlvButton, MlvButtonClose } from '@malva-ui/core/button';
import { MlvChip } from '@malva-ui/core/chip';
import { MLV_NOTIFICATION_I18N } from '@malva-ui/i18n';

@Component({
  selector: 'mlv-notification-item',
  imports: [
    LucideDynamicIcon,
    MlvButton,
    MlvChip,
    NgComponentOutlet,
    NgTemplateOutlet,
    MlvButtonClose,
  ],
  templateUrl: './notification-item.html',
  styleUrl: './notification-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"mlv-notification-item mlv-notification-item--" + toast().tone',
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class MlvNotificationItem
  extends MlvAbstractToastItem<MlvInternalNotification>
  implements OnInit, OnDestroy
{
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_NOTIFICATION_I18N);

  /** @protected Lucide icon class selected from the notification tone. */
  protected readonly toneIcon = computed(() => {
    switch (this.toast().tone) {
      case 'success':
        return LucideCircleCheck;
      case 'danger':
        return LucideCircleAlert;
      case 'warning':
        return LucideTriangleAlert;
      default:
        return LucideInfo;
    }
  });

  /** @protected Template branch of dynamic content, when supplied. */
  protected readonly _templateContent = computed(() => {
    const content = this.toast().content;
    return content instanceof TemplateRef ? content : null;
  });

  /** @protected Component branch of dynamic content, when supplied. */
  protected readonly _componentContent = computed(() => {
    const content = this.toast().content;
    return typeof content === 'function' ? content : null;
  });

  /** @protected Invokes an action's callback and then dismisses the notification. */
  protected onActionClick(action: MlvNotificationAction): void {
    action.action();
    this.onClose();
  }
}
