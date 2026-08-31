import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';

/**
 * Empty state component for displaying a placeholder when there is no content
 * to show. Provides content projection slots for an icon or illustration,
 * a title, a description, and one or more action buttons.
 *
 * All slots are optional — compose only the ones your use-case requires.
 *
 * @example Basic
 * ```html
 * <mlv-empty-state>
 *   <ng-container mlvEmptyStateIcon>
 *     <svg lucideInbox [size]="48" />
 *   </ng-container>
 *   <span mlvEmptyStateTitle>No items found</span>
 * </mlv-empty-state>
 * ```
 *
 * @example With action
 * ```html
 * <mlv-empty-state>
 *   <ng-container mlvEmptyStateIcon><svg lucideFolder [size]="48" /></ng-container>
 *   <span mlvEmptyStateTitle>No projects</span>
 *   <span mlvEmptyStateDescription>Create your first project to get started.</span>
 *   <ng-container mlvEmptyStateActions>
 *     <button mlvButton>Create project</button>
 *   </ng-container>
 * </mlv-empty-state>
 * ```
 */
@Component({
  selector: 'mlv-empty-state',
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: {
    class: 'mlv-empty-state',
    role: 'status',
  },
})
export class MlvEmptyState {}
