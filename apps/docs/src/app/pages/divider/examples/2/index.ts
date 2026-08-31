import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvDivider } from '@malva-ui/core/divider';

@Component({
  selector: 'docs-divider-vertical-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDivider],
  template: `
    <div
      style="display: flex; align-items: center; height: 2rem; gap: 0.75rem;"
    >
      <span style="color: var(--mlv-text-primary);">File</span>
      <mlv-divider orientation="vertical" />
      <span style="color: var(--mlv-text-primary);">Edit</span>
      <mlv-divider orientation="vertical" />
      <span style="color: var(--mlv-text-primary);">View</span>
      <mlv-divider orientation="vertical" />
      <span style="color: var(--mlv-text-primary);">Help</span>
    </div>
  `,
})
export default class DividerVerticalExampleComponent {}
