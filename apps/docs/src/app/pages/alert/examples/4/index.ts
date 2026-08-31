import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvAlert, MlvAlertIcon, MlvAlertTitle } from '@malva-ui/core/alert';
import { LucideRocket, LucideShieldCheck, LucideWifi } from '@lucide/angular';

@Component({
  selector: 'docs-alert-custom-icon-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvAlert,
    MlvAlertIcon,
    MlvAlertTitle,
    LucideRocket,
    LucideShieldCheck,
    LucideWifi,
  ],
  template: `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <mlv-alert tone="info">
        <ng-template mlvAlertIcon><svg lucideRocket [size]="16" /></ng-template>
        <ng-template mlvAlertTitle>Deployment started</ng-template>
        Your application is being deployed to production.
      </mlv-alert>
      <mlv-alert tone="success">
        <ng-template mlvAlertIcon
          ><svg lucideShieldCheck [size]="16"
        /></ng-template>
        <ng-template mlvAlertTitle>Security scan complete</ng-template>
        No vulnerabilities were found in your project.
      </mlv-alert>
      <mlv-alert tone="warning">
        <ng-template mlvAlertIcon><svg lucideWifi [size]="16" /></ng-template>
        Connection unstable. Some features may be unavailable.
      </mlv-alert>
    </div>
  `,
})
export default class AlertCustomIconExampleComponent {}
