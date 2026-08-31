import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvStepper, MlvStep } from '@malva-ui/core/stepper';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-stepper-horizontal-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvStepper, MlvStep, MlvButton],
  template: `
    <mlv-stepper #stepper ariaLabel="Account setup">
      <mlv-step label="Account">
        <div style="padding: 1rem 0;">
          <p>Fill in your account details.</p>
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
            <button mlvButton variant="primary" (click)="stepper.next()">
              Next
            </button>
          </div>
        </div>
      </mlv-step>
      <mlv-step label="Profile" description="Personal info">
        <div style="padding: 1rem 0;">
          <p>Set up your profile information.</p>
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
            <button mlvButton variant="secondary" (click)="stepper.previous()">
              Back
            </button>
            <button mlvButton variant="primary" (click)="stepper.next()">
              Next
            </button>
          </div>
        </div>
      </mlv-step>
      <mlv-step label="Review">
        <div style="padding: 1rem 0;">
          <p>Review and confirm your details.</p>
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
            <button mlvButton variant="secondary" (click)="stepper.previous()">
              Back
            </button>
            <button mlvButton variant="primary">Submit</button>
          </div>
        </div>
      </mlv-step>
    </mlv-stepper>
  `,
})
export default class StepperHorizontalExampleComponent {}
