import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvDivider } from '@malva-ui/core/divider';

@Component({
  selector: 'docs-divider-horizontal-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDivider],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <p style="color: var(--mlv-text-primary);">Content above the divider.</p>
      <mlv-divider />
      <p style="color: var(--mlv-text-primary);">Content below the divider.</p>
      <mlv-divider />
      <p style="color: var(--mlv-text-secondary);">
        Another section of content.
      </p>
    </div>
  `,
})
export default class DividerHorizontalExampleComponent {}
