import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { MlvButton } from '@malva-ui/core/button';
import { LucideFolder } from '@lucide/angular';

@Component({
  selector: 'docs-empty-state-with-action-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvEmptyState, MlvButton, LucideFolder],
  template: `
    <mlv-empty-state>
      <ng-container mlvEmptyStateIcon>
        <svg lucideFolder [size]="48" />
      </ng-container>
      <span mlvEmptyStateTitle>No projects yet</span>
      <span mlvEmptyStateDescription
        >Create your first project to get started.</span
      >
      <ng-container mlvEmptyStateActions>
        <button mlvButton>Create project</button>
      </ng-container>
    </mlv-empty-state>
  `,
})
export default class EmptyStateWithActionExampleComponent {}
