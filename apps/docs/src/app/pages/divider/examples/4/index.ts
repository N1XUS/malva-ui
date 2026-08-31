import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvDivider } from '@malva-ui/core/divider';

@Component({
  selector: 'docs-divider-variants-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDivider],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <p
        style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
      >
        Default:
      </p>
      <mlv-divider />
      <p
        style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
      >
        Dashed:
      </p>
      <mlv-divider dashed />
      <p
        style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
      >
        Muted:
      </p>
      <mlv-divider muted />
      <p
        style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
      >
        Dashed + Muted:
      </p>
      <mlv-divider dashed muted />
    </div>
  `,
})
export default class DividerVariantsExampleComponent {}
