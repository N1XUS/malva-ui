import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTree, type MlvTreeNode } from '@malva-ui/core/tree';

function simulateAsyncLoad(
  items: string[],
): () => Promise<MlvTreeNode<unknown>[]> {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          items.map((name) => ({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            label: name,
            data: {},
          })),
        );
      }, 1200);
    });
}

const LAZY_TREE: MlvTreeNode<unknown>[] = [
  {
    id: 'continent-europe',
    label: 'Europe',
    data: {},
    loadChildren: simulateAsyncLoad([
      'Germany',
      'France',
      'Italy',
      'Spain',
      'Netherlands',
    ]),
  },
  {
    id: 'continent-asia',
    label: 'Asia',
    data: {},
    loadChildren: simulateAsyncLoad([
      'Japan',
      'South Korea',
      'China',
      'India',
      'Singapore',
    ]),
  },
  {
    id: 'continent-americas',
    label: 'Americas',
    data: {},
    loadChildren: simulateAsyncLoad([
      'United States',
      'Canada',
      'Brazil',
      'Mexico',
      'Argentina',
    ]),
  },
];

@Component({
  selector: 'docs-tree-lazy-loading-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTree],
  template: `
    <div>
      <p
        style="font-size: 0.875rem; color: var(--mlv-text-secondary); margin-bottom: 1rem;"
      >
        Expand a continent to trigger a 1.2s simulated async load. Children are
        cached after the first load.
      </p>
      <mlv-tree [nodes]="nodes" style="max-width: 18rem;" />
    </div>
  `,
})
export default class TreeLazyLoadingExampleComponent {
  readonly nodes = LAZY_TREE;
}
