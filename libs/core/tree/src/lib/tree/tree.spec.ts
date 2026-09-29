import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { LucideFile, LucideFolder, provideLucideIcons } from '@lucide/angular';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTree } from './tree';
import type { MlvTreeNode } from './tree-node';
import { MlvTreeNodeDef } from './tree-node-def';

const SIMPLE_NODES: MlvTreeNode<unknown>[] = [
  {
    id: 'a',
    label: 'Node A',
    data: {},
    children: [
      { id: 'a1', label: 'Node A1', data: {} },
      { id: 'a2', label: 'Node A2', data: {} },
    ],
  },
  {
    id: 'b',
    label: 'Node B',
    data: {},
  },
  {
    id: 'c',
    label: 'Node C',
    data: {},
    disabled: true,
    children: [{ id: 'c1', label: 'Node C1', data: {} }],
  },
];

const LAZY_NODES: MlvTreeNode<unknown>[] = [
  {
    id: 'lazy',
    label: 'Lazy Node',
    data: {},
    loadChildren: () =>
      Promise.resolve([
        { id: 'lazy-1', label: 'Lazy Child 1', data: {} },
        { id: 'lazy-2', label: 'Lazy Child 2', data: {} },
      ]),
  },
];

describe('MlvTree', () => {
  let fixture: ComponentFixture<MlvTree>;
  let component: MlvTree;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTree],
      providers: [
        provideMlvI18nTesting(),
        provideLucideIcons(LucideFolder, LucideFile),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvTree);
    component = fixture.componentInstance;
  });

  describe('Rendering', () => {
    it('renders root nodes', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      // only root nodes visible initially (a and b and c — 3 roots)
      expect(items.length).toBe(3);
    });

    it('renders role=tree on the aria tree container', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      // aria's `[ngTree]` is applied to the inner `.mlv-tree__root` element
      // (it owns role="tree", the roving tabindex and keyboard handling); the
      // `<mlv-tree>` host is a plain wrapper.
      const root = fixture.nativeElement.querySelector('.mlv-tree__root');
      expect(root?.getAttribute('role')).toBe('tree');
    });

    it('shows expand toggle for nodes with children', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const toggles = fixture.nativeElement.querySelectorAll(
        '.mlv-tree__toggle:not(.mlv-tree__toggle--invisible)',
      );
      // Nodes a and c have children
      expect(toggles.length).toBeGreaterThanOrEqual(2);
    });

    it('marks disabled nodes with disabled class', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const disabled = fixture.nativeElement.querySelectorAll(
        '.mlv-tree__item--disabled',
      );
      expect(disabled.length).toBe(1);
    });

    it('applies aria-disabled to disabled nodes', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const disabledItem = fixture.nativeElement.querySelector(
        '.mlv-tree__item--disabled',
      );
      expect(disabledItem.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('Expansion', () => {
    it('starts collapsed by default', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBe(3); // only roots
    });

    it('expands nodes with `expanded: true` initially', () => {
      const nodesWithExpanded: MlvTreeNode<unknown>[] = [
        {
          id: 'x',
          label: 'X',
          data: {},
          expanded: true,
          children: [{ id: 'x1', label: 'X1', data: {} }],
        },
      ];
      fixture.componentRef.setInput('nodes', nodesWithExpanded);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBe(2); // parent + child
    });

    it('toggles expansion on toggle button click', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const toggle = fixture.nativeElement.querySelector(
        '.mlv-tree__toggle:not(.mlv-tree__toggle--invisible)',
      );
      toggle.click();
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBeGreaterThan(3); // root + children of a
    });

    it('emits nodeToggle when expanding', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const emitted: Array<{ node: MlvTreeNode<unknown>; expanded: boolean }> =
        [];
      component.nodeToggle.subscribe((v) => emitted.push(v));

      const toggle = fixture.nativeElement.querySelector(
        '.mlv-tree__toggle:not(.mlv-tree__toggle--invisible)',
      );
      toggle.click();
      fixture.detectChanges();

      expect(emitted.length).toBe(1);
      expect(emitted[0].expanded).toBe(true);
    });

    it('collapses an expanded node on second click', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const toggle = fixture.nativeElement.querySelector(
        '.mlv-tree__toggle:not(.mlv-tree__toggle--invisible)',
      );
      toggle.click();
      fixture.detectChanges();
      toggle.click();
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBe(3);
    });
  });

  describe('Programmatic API', () => {
    it('expandAll expands all nodes', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      component.expandAll();
      fixture.detectChanges();

      // a + a1 + a2 + b + c + c1 = 6 items
      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBe(6);
    });

    it('collapseAll collapses all nodes', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      component.expandAll();
      fixture.detectChanges();
      component.collapseAll();
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBe(3);
    });

    it('expandNode expands a specific node', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      component.expandNode('a');
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBe(5); // a + a1 + a2 + b + c
    });
  });

  describe('Selection — single mode', () => {
    it('does not render checkboxes in single mode', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'single');
      fixture.detectChanges();

      const checkboxes = fixture.nativeElement.querySelectorAll(
        'input[type="checkbox"]',
      );
      expect(checkboxes.length).toBe(0);
    });

    it('emits selectionChange on node click in single mode', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'single');
      fixture.detectChanges();

      const emitted: Array<Set<string | number>> = [];
      component.selectionChange.subscribe((s) => emitted.push(s));

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      items[1].click(); // Click node B
      fixture.detectChanges();

      expect(emitted.length).toBe(1);
      expect(emitted[0].has('b')).toBe(true);
    });

    it('deselects on second click of the same node', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'single');
      fixture.detectChanges();

      const emitted: Array<Set<string | number>> = [];
      component.selectionChange.subscribe((s) => emitted.push(s));

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      items[1].click();
      fixture.detectChanges();
      items[1].click();
      fixture.detectChanges();

      expect(emitted[emitted.length - 1].size).toBe(0);
    });

    it('adds selected class to selected node', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'single');
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      items[1].click();
      fixture.detectChanges();

      expect(items[1].classList.contains('mlv-tree__item--selected')).toBe(
        true,
      );
    });
  });

  describe('Selection — multi mode', () => {
    it('renders mlv-checkbox for each node in multi mode', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'multi');
      fixture.detectChanges();

      const checkboxes = fixture.nativeElement.querySelectorAll('mlv-checkbox');
      expect(checkboxes.length).toBe(3);
      // direct native checkboxes on .mlv-tree__item should be gone (replaced by mlv-checkbox)
      const directNativeCheckboxes = fixture.nativeElement.querySelectorAll(
        '.mlv-tree__item > input[type="checkbox"]',
      );
      expect(directNativeCheckboxes.length).toBe(0);
    });

    it('mlv-checkbox checked state reflects selection', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'multi');
      fixture.detectChanges();

      component.setSelection(new Set(['a']));
      fixture.detectChanges();

      const checkboxes = fixture.nativeElement.querySelectorAll('mlv-checkbox');
      // Node A should be checked
      expect(checkboxes[0].classList.contains('mlv-checkbox--checked')).toBe(
        true,
      );
      // Node B should not be checked
      expect(checkboxes[1].classList.contains('mlv-checkbox--checked')).toBe(
        false,
      );
    });

    it('sets aria-multiselectable=true in multi mode', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'multi');
      fixture.detectChanges();

      // aria owns aria-multiselectable on the `.mlv-tree__root` ngTree element.
      const root = fixture.nativeElement.querySelector('.mlv-tree__root');
      expect(root?.getAttribute('aria-multiselectable')).toBe('true');
    });

    it('setSelection updates selected IDs', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'multi');
      fixture.detectChanges();

      component.setSelection(new Set(['a', 'b']));
      fixture.detectChanges();

      expect(component.selectedIds.has('a')).toBe(true);
      expect(component.selectedIds.has('b')).toBe(true);
      expect(component.selectedIds.has('c')).toBe(false);
    });
  });

  describe('Lazy loading', () => {
    it('shows loading state on first expand of lazy node', async () => {
      fixture.componentRef.setInput('nodes', LAZY_NODES);
      fixture.detectChanges();

      const toggle = fixture.nativeElement.querySelector(
        '.mlv-tree__toggle:not(.mlv-tree__toggle--invisible)',
      );
      toggle.click();
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('.mlv-tree__spinner');
      expect(spinner).toBeTruthy();
    });

    it('renders children after lazy load resolves', async () => {
      fixture.componentRef.setInput('nodes', LAZY_NODES);
      fixture.detectChanges();

      const toggle = fixture.nativeElement.querySelector(
        '.mlv-tree__toggle:not(.mlv-tree__toggle--invisible)',
      );
      toggle.click();
      fixture.detectChanges();

      // Wait for promise to resolve
      await new Promise((r) => setTimeout(r, 50));
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBe(3); // lazy parent + 2 children
    });
  });

  describe('Keyboard navigation', () => {
    it('moves focus down with ArrowDown', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const tree = fixture.nativeElement.querySelector('.mlv-tree__root');
      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      // Focus should have moved to index 1
      const rows = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(rows[1].getAttribute('tabindex')).toBe('0');
    });

    it('expands with ArrowRight', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const tree = fixture.nativeElement.querySelector('.mlv-tree__root');
      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(items.length).toBeGreaterThan(3);
    });

    it('moves to end with End key', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const tree = fixture.nativeElement.querySelector('.mlv-tree__root');
      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
      );
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      const lastRow = rows[rows.length - 1];
      expect(lastRow.getAttribute('tabindex')).toBe('0');
    });

    it('moves to start with Home key', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      // Move to end first
      const tree = fixture.nativeElement.querySelector('.mlv-tree__root');
      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
      );
      fixture.detectChanges();

      // Then Home
      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      );
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('.mlv-tree__item');
      expect(rows[0].getAttribute('tabindex')).toBe('0');
    });

    it('selects with Space in single mode', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'single');
      fixture.detectChanges();

      // Move to second node
      const tree = fixture.nativeElement.querySelector('.mlv-tree__root');
      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      const emitted: Array<Set<string | number>> = [];
      component.selectionChange.subscribe((s) => emitted.push(s));

      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      );
      fixture.detectChanges();

      expect(emitted.length).toBe(1);
      expect(emitted[0].has('b')).toBe(true);
    });

    it('selects with Enter in single mode (handled once, net selection)', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'single');
      fixture.detectChanges();

      const tree = fixture.nativeElement.querySelector('.mlv-tree__root');
      // Move focus to node B (a leaf) so Enter selects rather than expands.
      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      tree.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fixture.detectChanges();

      // A single, non-cancelling selection: node B ends up selected.
      expect(component.selectedIds.has('b')).toBe(true);
      expect(component.selectedIds.size).toBe(1);
    });
  });

  // Behaviour gained from @angular/aria that the hand-rolled tree did not have.
  describe('Keyboard typeahead (aria-added)', () => {
    const FRUIT_NODES: MlvTreeNode<unknown>[] = [
      { id: 'a', label: 'Apple', data: {} },
      { id: 'b', label: 'Banana', data: {} },
      { id: 'c', label: 'Cherry', data: {} },
    ];

    it('moves the active row to the first item matching the typed character', () => {
      fixture.componentRef.setInput('nodes', FRUIT_NODES);
      fixture.detectChanges();

      const root = fixture.nativeElement.querySelector('.mlv-tree__root');
      // Type "c" — typeahead reads each item's `label` and jumps to "Cherry".
      root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'c', bubbles: true }),
      );
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('[role="treeitem"]');
      // Roving tabindex: only the matched row (Cherry) is tabbable.
      expect(rows[2].getAttribute('tabindex')).toBe('0');
      expect(rows[0].getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('Accessibility', () => {
    it('sets role=treeitem on each item', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('[role="treeitem"]');
      expect(items.length).toBe(3);
    });

    it('sets aria-expanded=false on collapsed branch nodes', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('[role="treeitem"]');
      // Node A has children and is collapsed
      expect(items[0].getAttribute('aria-expanded')).toBe('false');
    });

    it('sets aria-expanded=null on leaf nodes', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('[role="treeitem"]');
      // Node B is a leaf
      expect(items[1].getAttribute('aria-expanded')).toBeNull();
    });

    it('marks the tree not multiselectable in single mode', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'single');
      fixture.detectChanges();

      // aria always emits aria-multiselectable on the tree container; in single
      // mode it is "false" (previously the hand-rolled host omitted the attr —
      // both convey "not multiselectable"). The `<mlv-tree>` host never carries it.
      const root = fixture.nativeElement.querySelector('.mlv-tree__root');
      expect(root?.getAttribute('aria-multiselectable')).toBe('false');
      expect(
        fixture.nativeElement.getAttribute('aria-multiselectable'),
      ).toBeNull();
    });

    it('sets aria-level, aria-setsize, and aria-posinset on treeitems', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('[role="treeitem"]');
      // Three roots at level 1.
      expect(items[0].getAttribute('aria-level')).toBe('1');
      expect(items[0].getAttribute('aria-setsize')).toBe('3');
      expect(items[0].getAttribute('aria-posinset')).toBe('1');
      expect(items[2].getAttribute('aria-posinset')).toBe('3');
    });

    it('sets aria-level=2 and correct set metadata on child nodes', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();
      component.expandNode('a');
      fixture.detectChanges();

      // Node A has two children (a1, a2) which sit at level 2.
      const items = fixture.nativeElement.querySelectorAll('[role="treeitem"]');
      const child = items[1];
      expect(child.getAttribute('aria-level')).toBe('2');
      expect(child.getAttribute('aria-setsize')).toBe('2');
      expect(child.getAttribute('aria-posinset')).toBe('1');
    });

    it('keeps the multi-select checkbox out of the tab order (single tab stop per row)', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('selectMode', 'multi');
      fixture.detectChanges();

      const checkboxInputs = fixture.nativeElement.querySelectorAll(
        'mlv-checkbox input[type="checkbox"]',
      );
      expect(checkboxInputs.length).toBe(3);
      checkboxInputs.forEach((input: HTMLInputElement) => {
        expect(input.getAttribute('tabindex')).toBe('-1');
      });
    });
  });

  describe('Connector lines', () => {
    it('applies connector CSS class to host when showConnectors is true', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.componentRef.setInput('showConnectors', true);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.classList.contains('mlv-tree--connectors'),
      ).toBe(true);
    });

    it('does not apply connector CSS class when showConnectors is false', () => {
      fixture.componentRef.setInput('nodes', SIMPLE_NODES);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.classList.contains('mlv-tree--connectors'),
      ).toBe(false);
    });
  });

  describe('Icon field', () => {
    it('renders icon from MlvTreeNode.icon field', () => {
      const nodesWithIcon: MlvTreeNode<unknown>[] = [
        { id: 'f1', label: 'Documents', data: {}, icon: 'folder' },
        { id: 'f2', label: 'README.md', data: {}, icon: 'file' },
      ];
      fixture.componentRef.setInput('nodes', nodesWithIcon);
      fixture.detectChanges();

      const icons = fixture.nativeElement.querySelectorAll('.mlv-tree__icon');
      expect(icons.length).toBe(2);
    });
  });
});

describe('MlvTreeNodeDef', () => {
  @Component({
    template: `
      <mlv-tree [nodes]="nodes">
        <ng-template mlvTreeNodeDef let-flatNode>
          <span class="custom-label">{{ flatNode.node.label }}</span>
        </ng-template>
      </mlv-tree>
    `,
    imports: [MlvTree, MlvTreeNodeDef],
  })
  class HostComponent {
    nodes: MlvTreeNode<unknown>[] = [
      { id: 'x', label: 'Custom Node', data: {} },
    ];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  it('uses custom template when provided', async () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();

    const custom = f.nativeElement.querySelectorAll('.custom-label');
    expect(custom.length).toBe(1);
    expect(custom[0].textContent.trim()).toBe('Custom Node');
  });
});
