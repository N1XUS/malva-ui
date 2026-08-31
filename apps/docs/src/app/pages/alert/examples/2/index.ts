import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvAlert } from '@malva-ui/core/alert';

@Component({
  selector: 'docs-alert-dismissible-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAlert],
  template: `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <mlv-alert
        tone="success"
        dismissible
        (dismissed)="onDismissed('success')"
      >
        File uploaded successfully. Click the X to dismiss.
      </mlv-alert>
      <mlv-alert
        tone="warning"
        dismissible
        (dismissed)="onDismissed('warning')"
      >
        Your storage is almost full. Please free up some space.
      </mlv-alert>
      @if (lastDismissed()) {
        <p
          style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
        >
          Last dismissed: {{ lastDismissed() }}
        </p>
      }
    </div>
  `,
})
export default class AlertDismissibleExampleComponent {
  readonly lastDismissed = signal<string | null>(null);

  onDismissed(tone: string): void {
    this.lastDismissed.set(tone);
  }
}
