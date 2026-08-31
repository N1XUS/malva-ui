import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { LucideInbox } from '@lucide/angular';

@Component({
  selector: 'docs-empty-state-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvEmptyState, LucideInbox],
  template: `
    <mlv-empty-state>
      <ng-container mlvEmptyStateIcon>
        <svg lucideInbox [size]="48" />
      </ng-container>
      <span mlvEmptyStateTitle>No messages yet</span>
      <span mlvEmptyStateDescription
        >When you receive messages, they will appear here.</span
      >
    </mlv-empty-state>
  `,
})
export default class EmptyStateBasicExampleComponent {}
