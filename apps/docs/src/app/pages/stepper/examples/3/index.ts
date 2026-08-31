import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvStepper, MlvStep } from '@malva-ui/core/stepper';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-stepper-deviative-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvStepper, MlvStep, MlvButton],
  template: `
    <mlv-stepper
      #stepper
      ariaLabel="Process with alternative path"
      [initialIndex]="1"
    >
      <mlv-step label="Started" state="completed">
        <div style="padding: 1rem 0;">Step completed normally.</div>
      </mlv-step>
      <mlv-step label="Detour taken" [deviative]="true">
        <div style="padding: 1rem 0;">
          <p>This step represents an alternative path that was taken.</p>
          <p
            style="color: var(--mlv-text-warning); font-size: var(--mlv-typography-body-s-size); margin-top: 0.5rem;"
          >
            The connector after this step is shown with a dashed warning color.
          </p>
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
          <p>Confirm your details.</p>
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
export default class StepperDeviativeExampleComponent {}
