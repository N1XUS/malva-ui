import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAlert, MlvAlertTitle } from '@malva-ui/core/alert';

@Component({
  selector: 'docs-alert-with-title-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAlert, MlvAlertTitle],
  template: `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <mlv-alert tone="info">
        <ng-template mlvAlertTitle>New update available</ng-template>
        Version 3.2.0 is ready. Refresh the page to apply it.
      </mlv-alert>
      <mlv-alert tone="warning" dismissible>
        <ng-template mlvAlertTitle>Storage nearly full</ng-template>
        You have used 90% of your storage quota. Consider deleting unused files.
      </mlv-alert>
      <mlv-alert tone="danger">
        <ng-template mlvAlertTitle>Authentication failed</ng-template>
        Your credentials could not be verified. Please log in again.
      </mlv-alert>
    </div>
  `,
})
export default class AlertWithTitleExampleComponent {}
