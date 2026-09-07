import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  LucideInfo,
  LucideCheckCircle,
  LucideTriangleAlert,
  LucideCircleX,
} from '@lucide/angular';
import { MlvAlertIcon, MlvAlertTitle } from './alert.directives';
import type { MlvTone } from '@malva-ui/cdk/utils';
import { MLV_ALERT_I18N } from '@malva-ui/i18n';
import { MlvButtonClose } from '@malva-ui/core/button';

/**
 * Inline feedback banner component for displaying contextual messages.
 *
 * Supports four semantic tones (`info`, `success`, `warning`, `danger`),
 * optional dismiss button, custom icon slot, and separate title/description
 * content projection slots.
 *
 * @example Basic
 * ```html
 * <mlv-alert tone="info">Your profile has been updated.</mlv-alert>
 * ```
 *
 * @example With title
 * ```html
 * <mlv-alert tone="warning">
 *   <ng-template mlvAlertTitle>Storage nearly full</ng-template>
 *   You have used 90% of your storage quota.
 * </mlv-alert>
 * ```
 *
 * @example Dismissible
 * ```html
 * <mlv-alert tone="success" dismissible (dismissed)="onDismissed()">
 *   File uploaded successfully.
 * </mlv-alert>
 * ```
 *
 * @example Custom icon
 * ```html
 * <mlv-alert tone="info">
 *   <ng-template mlvAlertIcon><svg lucideRocket [size]="16" /></ng-template>
 *   New version available.
 * </mlv-alert>
 * ```
 */
@Component({
  selector: 'mlv-alert',
  templateUrl: './alert.html',
  styleUrl: './alert.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    LucideInfo,
    LucideCheckCircle,
    LucideTriangleAlert,
    LucideCircleX,
    MlvButtonClose,
  ],
  host: {
    class: 'mlv-alert',
    '[class]': '"mlv-alert--tone-" + tone()',
    '[class.mlv-alert--dismissed]': '_dismissed()',
    '[class.mlv-alert--outlined]': 'outlined()',
    role: 'alert',
    '[attr.aria-live]': '"polite"',
    '[attr.hidden]': '_dismissed() || null',
  },
})
export class MlvAlert {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_ALERT_I18N);

  /**
   * The semantic tone of the alert.
   * Controls the color scheme and default icon.
   * Defaults to `'info'`.
   */
  readonly tone = input<MlvTone>('info');

  /**
   * When `true`, renders a dismiss (close) button in the alert.
   * Clicking it emits `dismissed` and hides the alert.
   * Supports attribute syntax: `<mlv-alert dismissible>`.
   */
  readonly dismissible = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, renders the alert with a transparent background and a colored border.
   * The text and border color remain the tone foreground color.
   * Supports attribute syntax: `<mlv-alert outlined>`.
   */
  readonly outlined = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Emits when the user clicks the dismiss button.
   * The alert is hidden automatically after emission.
   */
  readonly dismissed = output<void>();

  /**
   * @protected Tracks whether the alert has been dismissed by the user.
   */
  protected readonly _dismissed = signal(false);

  /**
   * @protected Query for the optional custom icon slot directive.
   */
  protected readonly _iconSlot = contentChild(MlvAlertIcon);

  /**
   * @protected Query for the optional title slot directive.
   */
  protected readonly _titleSlot = contentChild(MlvAlertTitle);

  /**
   * @protected Handles dismiss button click: marks as dismissed and emits output.
   */
  protected _onDismiss(): void {
    this._dismissed.set(true);
    this.dismissed.emit();
  }
}
