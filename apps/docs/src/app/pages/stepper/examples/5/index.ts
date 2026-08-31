import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvStepper, MlvStep } from '@malva-ui/core/stepper';

@Component({
  selector: 'docs-stepper-semantic-states-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvStepper, MlvStep],
  template: `
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <p
        style="color: var(--mlv-text-secondary); font-size: var(--mlv-typography-body-s-size);"
      >
        Semantic states — completed (green), error (red), active (blue),
        pending:
      </p>
      <mlv-stepper ariaLabel="Order status" [initialIndex]="2">
        <mlv-step
          label="Order placed"
          state="completed"
          description="Confirmed"
        >
          <div style="padding: 1rem 0;">
            <p style="color: var(--mlv-text-positive);">
              Your order has been placed successfully.
            </p>
          </div>
        </mlv-step>
        <mlv-step label="Payment" state="error" description="Action required">
          <div style="padding: 1rem 0;">
            <p style="color: var(--mlv-text-negative);">
              Payment failed. Please update your payment method.
            </p>
          </div>
        </mlv-step>
        <mlv-step label="Processing" description="In progress">
          <div style="padding: 1rem 0;">
            <p>Your order is currently being processed.</p>
          </div>
        </mlv-step>
        <mlv-step label="Delivery" description="Estimated 3–5 days">
          <div style="padding: 1rem 0;">
            <p>Awaiting dispatch to delivery partner.</p>
          </div>
        </mlv-step>
      </mlv-stepper>
    </div>
  `,
})
export default class StepperSemanticStatesExampleComponent {}
