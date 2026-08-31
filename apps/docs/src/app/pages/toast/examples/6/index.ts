import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvToastService } from '@malva-ui/core/toast';
import type { MlvToastTone } from '@malva-ui/core/toast';

@Component({
  selector: 'docs-toast-pill-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class ToastPillExampleComponent {
  private readonly toastService = inject(MlvToastService);

  /** Compact pill with the tone-derived icon. */
  showPill(tone: MlvToastTone): void {
    this.toastService.show({
      title: this.labels[tone],
      tone,
      shape: 'pill',
      icon: true,
    });
  }

  /** Pill without an icon — `tone: 'default'` has no glyph to derive. */
  showPlainPill(): void {
    this.toastService.show({
      title: 'Sending to printer',
      shape: 'pill',
    });
  }

  /** Rectangular shape for comparison. */
  showRectangle(): void {
    this.toastService.show({
      title: 'Changes saved',
      description: 'Your profile is up to date.',
      tone: 'success',
      icon: true,
    });
  }

  private readonly labels: Record<MlvToastTone, string> = {
    success: 'Changes saved',
    warning: 'Connection is unstable',
    danger: 'Upload failed',
    info: 'A new version is available',
    default: 'Sending to printer',
  };
}
