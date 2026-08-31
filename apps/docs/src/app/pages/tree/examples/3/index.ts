import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import { MlvTree, type MlvTreeNode } from '@malva-ui/core/tree';

interface Permission {
  scope: string;
}

const PERMISSIONS: MlvTreeNode<Permission>[] = [
  {
    id: 'users',
    label: 'Users',
    data: { scope: 'users' },
    children: [
      { id: 'users:read', label: 'Read users', data: { scope: 'users:read' } },
      {
        id: 'users:write',
        label: 'Write users',
        data: { scope: 'users:write' },
      },
      {
        id: 'users:delete',
        label: 'Delete users',
        data: { scope: 'users:delete' },
      },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    data: { scope: 'products' },
    children: [
      {
        id: 'products:read',
        label: 'Read products',
        data: { scope: 'products:read' },
      },
      {
        id: 'products:write',
        label: 'Write products',
        data: { scope: 'products:write' },
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    data: { scope: 'reports' },
    children: [
      {
        id: 'reports:view',
        label: 'View reports',
        data: { scope: 'reports:view' },
      },
      {
        id: 'reports:export',
        label: 'Export reports',
        data: { scope: 'reports:export' },
      },
    ],
  },
  { id: 'admin', label: 'Admin panel', data: { scope: 'admin' } },
];

@Component({
  selector: 'docs-tree-multi-select-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTree],
  template: `
    <div
      style="display: flex; gap: 2rem; align-items: flex-start; flex-wrap: wrap;"
    >
      <mlv-tree
        [nodes]="nodes"
        selectMode="multi"
        (selectionChange)="onSelectionChange($event)"
        style="min-width: 14rem;"
      />
      <div style="font-size: 0.875rem;">
        <div
          style="font-weight: 600; margin-bottom: 0.5rem; color: var(--mlv-text-primary);"
        >
          Selected ({{ selectedIds().size }})
        </div>
        @if (selectedIds().size === 0) {
          <em style="color: var(--mlv-text-secondary);"
            >None selected — use Space or click checkboxes</em
          >
        }
        @for (id of selectedList(); track id) {
          <div style="color: var(--mlv-text-secondary); line-height: 1.75;">
            {{ id }}
          </div>
        }
      </div>
    </div>
  `,
})
export default class TreeMultiSelectExampleComponent {
  readonly nodes = PERMISSIONS;
  readonly selectedIds = signal<Set<string | number>>(new Set());
  readonly selectedList = computed(() => [...this.selectedIds()]);

  onSelectionChange(ids: Set<string | number>): void {
    this.selectedIds.set(new Set(ids));
  }
}
