import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAlert } from '@malva-ui/core/alert';

@Component({
  selector: 'docs-alert-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvAlert],
  template: `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <mlv-alert tone="info">This is an informational message.</mlv-alert>
        <mlv-alert tone="success"
          >Your changes have been saved successfully.</mlv-alert
        >
        <mlv-alert tone="warning"
          >Your session will expire in 5 minutes.</mlv-alert
        >
        <mlv-alert tone="danger"
          >An error occurred. Please try again.</mlv-alert
        >
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <mlv-alert tone="info" outlined
          >Outlined informational message.</mlv-alert
        >
        <mlv-alert tone="success" outlined>Outlined success message.</mlv-alert>
        <mlv-alert tone="warning" outlined>Outlined warning message.</mlv-alert>
        <mlv-alert tone="danger" outlined>Outlined danger message.</mlv-alert>
      </div>
    </div>
  `,
})
export default class AlertBasicExampleComponent {}
