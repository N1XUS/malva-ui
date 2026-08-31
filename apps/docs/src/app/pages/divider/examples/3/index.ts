import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvDivider } from '@malva-ui/core/divider';

@Component({
  selector: 'docs-divider-with-label-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDivider],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <p style="color: var(--mlv-text-secondary);">Sign in with email</p>
      <mlv-divider>OR</mlv-divider>
      <p style="color: var(--mlv-text-secondary);">Sign in with a provider</p>
      <mlv-divider>Continue below</mlv-divider>
      <p style="color: var(--mlv-text-secondary);">Additional options</p>
    </div>
  `,
})
export default class DividerWithLabelExampleComponent {}
