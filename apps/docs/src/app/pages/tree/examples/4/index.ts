import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  MlvTree,
  type MlvTreeLoadError,
  type MlvTreeNode,
} from '@malva-ui/core/tree';

function toNodes(items: string[]): MlvTreeNode<unknown>[] {
  return items.map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    label: name,
    data: {},
  }));
}

function simulateAsyncLoad(
  items: string[],
): () => Promise<MlvTreeNode<unknown>[]> {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => resolve(toNodes(items)), 1200);
    });
}

/**
 * Fails the first load, as a dropped connection would, and succeeds on the
 * next one. The tree collapses the node on the failure, so expanding it
 * again is the retry. The attempt count lives in the closure, so each tree
 * built by `buildLazyTree()` fails once.
 */
function simulateFlakyLoad(
  items: string[],
): () => Promise<MlvTreeNode<unknown>[]> {
  let attempts = 0;
  return () =>
    new Promise((resolve, reject) => {
      attempts += 1;
      const fail = attempts === 1;
      setTimeout(() => {
        if (fail) {
          reject(new Error('The research stations did not respond.'));
        } else {
          resolve(toNodes(items));
        }
      }, 1200);
    });
}

/** Builds a fresh tree, so every example instance starts with no attempts. */
function buildLazyTree(): MlvTreeNode<unknown>[] {
  return [
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
    {
      id: 'continent-antarctica',
      label: 'Antarctica',
      data: {},
      loadChildren: simulateFlakyLoad([
        'McMurdo Station',
        'Amundsen-Scott Station',
        'Concordia Station',
      ]),
    },
  ];
}

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
        cached after the first load. Antarctica's first load fails.
      </p>
      <mlv-tree
        [nodes]="nodes"
        style="max-width: 18rem;"
        (loadError)="onLoadError($event)"
        (nodeToggle)="onNodeToggle($event.expanded)"
      />
      <p
        role="status"
        style="font-size: 0.875rem; color: var(--mlv-text-negative); margin-top: 1rem; min-height: 1.25rem;"
      >
        {{ message() }}
      </p>
    </div>
  `,
})
export default class TreeLazyLoadingExampleComponent {
  readonly nodes = buildLazyTree();

  /** The failure the status line reports; cleared when a node is expanded. */
  readonly message = signal('');

  onLoadError({ node }: MlvTreeLoadError<unknown>): void {
    this.message.set(`Could not load ${node.label}. Expand it to try again.`);
  }

  onNodeToggle(expanded: boolean): void {
    if (expanded) this.message.set('');
  }
}
