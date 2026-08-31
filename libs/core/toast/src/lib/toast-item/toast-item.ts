import type { OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  TemplateRef,
  ViewEncapsulation,
} from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  LucideCheckCircle,
  LucideCircleX,
  LucideInfo,
  LucideTriangleAlert,
} from '@lucide/angular';
import type { MlvInternalToast } from '../toast.types';
import { MlvAbstractToastItem } from '../abstract-toast-item';
import { MlvButtonClose } from '@malva-ui/core/button';
import { MLV_TOAST_I18N } from '@malva-ui/i18n';
import { MlvToastDescription, MlvToastTitle } from '../toast.directives';

@Component({
  selector: 'mlv-toast-item',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    MlvButtonClose,
    MlvToastTitle,
    MlvToastDescription,
    LucideCheckCircle,
    LucideCircleX,
    LucideInfo,
    LucideTriangleAlert,
  ],
  templateUrl: './toast-item.html',
  styleUrl: './toast-item.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"mlv-toast-item mlv-toast-item--" + toast().tone',
    '[class.mlv-toast-item--pill]': 'toast().shape === "pill"',
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class MlvToastItem
  extends MlvAbstractToastItem<MlvInternalToast>
  implements OnInit, OnDestroy
{
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_TOAST_I18N);

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

  /**
   * @protected Whether to render the built-in, tone-derived Lucide icon.
   *
   * Only the four semantic tones map to an icon — `'default'` has none, so
   * `icon: true` with that tone renders nothing. Dynamic content is excluded
   * because template/component content owns its own leading icon through
   * `[mlvToastIcon]`; the service already suppresses the flag for those
   * branches, and this guard also covers direct use of `<mlv-toast-item>`.
   */
  protected readonly _showIcon = computed(() => {
    const toast = this.toast();
    return (
      toast.icon === true && toast.tone !== 'default' && toast.content == null
    );
  });
}
