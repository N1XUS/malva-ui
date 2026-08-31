import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvStepper, MlvStep } from '@malva-ui/core/stepper';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-stepper-vertical-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvStepper, MlvStep, MlvButton],
  template: `
    <mlv-stepper #stepper orientation="vertical" ariaLabel="Order process">
      <mlv-step label="Order placed" description="Jan 15, 2025">
        <div style="padding: 0.5rem 0 1rem;">
          Your order #12345 has been received.
          <div style="margin-top: 0.75rem;">
            <button mlvButton variant="primary" (click)="stepper.next()">
              Next
            </button>
          </div>
        </div>
      </mlv-step>
      <mlv-step label="Processing" description="Jan 16, 2025">
        <div style="padding: 0.5rem 0 1rem;">
          Your order is being prepared for shipment.
          <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
            <button mlvButton variant="secondary" (click)="stepper.previous()">
              Back
            </button>
            <button mlvButton variant="primary" (click)="stepper.next()">
              Next
            </button>
          </div>
        </div>
      </mlv-step>
      <mlv-step label="Shipped" description="Jan 17, 2025">
        <div style="padding: 0.5rem 0 1rem;">
          Your package is on the way!
          <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
            <button mlvButton variant="secondary" (click)="stepper.previous()">
              Back
            </button>
            <button mlvButton variant="primary" (click)="stepper.next()">
              Next
            </button>
          </div>
        </div>
      </mlv-step>
      <mlv-step label="Delivered">
        <div style="padding: 0.5rem 0 1rem;">
          Package delivered successfully.
        </div>
      </mlv-step>
    </mlv-stepper>
  `,
})
export default class StepperVerticalExampleComponent {}
