import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvStepper, MlvStep } from '@malva-ui/core/stepper';

@Component({
  selector: 'docs-stepper-non-linear-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvStepper, MlvStep],
  template: `
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <p
        style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
      >
        Non-linear — click any step to navigate directly:
      </p>
      <mlv-stepper ariaLabel="Non-linear stepper">
        <mlv-step label="Step 1">
          <div style="padding: 1rem 0;">Content for step 1.</div>
        </mlv-step>
        <mlv-step label="Step 2" [optional]="true" description="Optional">
          <div style="padding: 1rem 0;">
            Step 2 is optional and can be skipped.
          </div>
        </mlv-step>
        <mlv-step label="Step 3">
          <div style="padding: 1rem 0;">Content for step 3.</div>
        </mlv-step>
        <mlv-step label="Step 4">
          <div style="padding: 1rem 0;">Final step content.</div>
        </mlv-step>
      </mlv-stepper>
    </div>
  `,
})
export default class StepperNonLinearExampleComponent {}
