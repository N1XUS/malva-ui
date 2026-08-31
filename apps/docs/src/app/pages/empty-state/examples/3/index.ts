import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { MlvButton } from '@malva-ui/core/button';
import { LucideSearchX } from '@lucide/angular';

@Component({
  selector: 'docs-empty-state-search-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvEmptyState, MlvButton, LucideSearchX],
  template: `
    <mlv-empty-state>
      <ng-container mlvEmptyStateIcon>
        <svg lucideSearchX [size]="48" />
      </ng-container>
      <span mlvEmptyStateTitle>No results found</span>
      <span mlvEmptyStateDescription>
        No items match your search for "angular components". Try a different
        query or clear the filters.
      </span>
      <ng-container mlvEmptyStateActions>
        <button mlvButton variant="secondary">Clear filters</button>
        <button mlvButton>New search</button>
      </ng-container>
    </mlv-empty-state>
  `,
})
export default class EmptyStateSearchExampleComponent {}
