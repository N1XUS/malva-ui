import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvTree, type MlvTreeNode } from '@malva-ui/core/tree';

interface Category {
  code: string;
}

const CATEGORIES: MlvTreeNode<Category>[] = [
  {
    id: 'electronics',
    label: 'Electronics',
    data: { code: 'ELEC' },
    children: [
      {
        id: 'phones',
        label: 'Phones',
        data: { code: 'PHN' },
        children: [
          { id: 'smartphones', label: 'Smartphones', data: { code: 'SPH' } },
          {
            id: 'feature-phones',
            label: 'Feature Phones',
            data: { code: 'FPH' },
          },
        ],
      },
      {
        id: 'computers',
        label: 'Computers',
        data: { code: 'COMP' },
        children: [
          { id: 'laptops', label: 'Laptops', data: { code: 'LAP' } },
          { id: 'desktops', label: 'Desktops', data: { code: 'DSK' } },
          { id: 'tablets', label: 'Tablets', data: { code: 'TAB' } },
        ],
      },
      { id: 'audio', label: 'Audio', data: { code: 'AUD' } },
    ],
  },
  {
    id: 'clothing',
    label: 'Clothing',
    data: { code: 'CLO' },
    children: [
      { id: 'men', label: "Men's", data: { code: 'MEN' } },
      { id: 'women', label: "Women's", data: { code: 'WOM' } },
      { id: 'kids', label: "Kids'", data: { code: 'KID' } },
    ],
  },
  {
    id: 'sports',
    label: 'Sports & Outdoors',
    data: { code: 'SPT' },
    children: [
      { id: 'gym', label: 'Gym & Fitness', data: { code: 'GYM' } },
      { id: 'outdoor', label: 'Outdoor Recreation', data: { code: 'OUT' } },
    ],
  },
];

@Component({
  selector: 'docs-tree-single-select-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTree],
  template: `
    <div style="display: flex; gap: 2rem; align-items: flex-start;">
      <mlv-tree
        [nodes]="nodes"
        selectMode="single"
        (selectionChange)="onSelectionChange()"
        (nodeActivate)="onActivate($event)"
        style="min-width: 14rem;"
      />
      <div
        style="font-size: 0.875rem; color: var(--mlv-text-secondary); padding-top: 0.5rem;"
      >
        @if (selectedLabel()) {
          <strong>Selected:</strong> {{ selectedLabel() }}
        } @else {
          <em>Click a node to select it</em>
        }
      </div>
    </div>
  `,
})
export default class TreeSingleSelectExampleComponent {
  readonly nodes = CATEGORIES;
  readonly selectedLabel = signal<string>('');

  onSelectionChange(): void {
    // selection is tracked via nodeActivate for single mode
  }

  onActivate(node: MlvTreeNode<Category>): void {
    this.selectedLabel.set(`${node.label} (${node.data.code})`);
  }
}
