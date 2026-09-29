import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { LucideFile, LucideFolder, provideLucideIcons } from '@lucide/angular';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTree } from './tree';
import type { MlvTreeNode } from './tree-node';

/**
 * A lazy node whose `loadChildren()` fails must not strand the tree (#353).
 *
 * Before the fix `_loadLazy` chained `.then()` with no rejection path: the id
 * stayed in the loading set for the page's life, so the spinner never went
 * away, the group never rendered, the retry guard refused every later expand,
 * and the rejection surfaced as an unhandled promise rejection.
 */

/** A promise the test settles by hand. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Waits one macrotask, past Node's unhandled-rejection checkpoint. */
const nextTask = () => new Promise<void>((r) => setTimeout(r, 0));

const CHILDREN: MlvTreeNode<unknown>[] = [
  { id: 'lazy-1', label: 'Lazy Child 1', data: {} },
  { id: 'lazy-2', label: 'Lazy Child 2', data: {} },
];

/** A class-model node whose loader reads its own fields through `this`. */
class FolderNode implements MlvTreeNode<unknown> {
  readonly data = {};
  /** How many times `loadChildren()` ran. */
  calls = 0;

  constructor(
    readonly id: string,
    readonly label: string,
    private readonly _kids: MlvTreeNode<unknown>[],
  ) {}

  loadChildren(): Promise<MlvTreeNode<unknown>[]> {
    this.calls += 1;
    return Promise.resolve(this._kids);
  }
}

@Component({
  imports: [MlvTree],
  template: `
    @if (shown()) {
      <mlv-tree
        [nodes]="nodes()"
        (loadError)="errors.push($event); events.push('error')"
        (nodeToggle)="
          toggles.push($event.expanded);
          events.push('toggle:' + $event.expanded)
        "
      />
    }
  `,
})
class LazyErrorHost {
  /** One settle-by-hand promise per `loadChildren()` call, in call order. */
  readonly attempts: Deferred<MlvTreeNode<unknown>[]>[] = [];
  /** When set, the next `loadChildren()` call throws synchronously. */
  throwNext: unknown = undefined;
  readonly shown = signal(true);
  readonly errors: { node: MlvTreeNode<unknown>; error: unknown }[] = [];
  readonly toggles: boolean[] = [];
  /** Both outputs, in emission order: `'toggle:<expanded>'` or `'error'`. */
  readonly events: string[] = [];
  readonly lazyNode: MlvTreeNode<unknown> = {
    id: 'lazy',
    label: 'Lazy Node',
    data: {},
    loadChildren: () => {
      if (this.throwNext !== undefined) {
        const error = this.throwNext;
        this.throwNext = undefined;
        throw error;
      }
      const attempt = deferred<MlvTreeNode<unknown>[]>();
      this.attempts.push(attempt);
      return attempt.promise;
    },
  };
  readonly nodes = signal<MlvTreeNode<unknown>[]>([this.lazyNode]);
}

describe('MlvTree — rejected lazy load (#353)', () => {
  let fixture: ComponentFixture<LazyErrorHost>;
  let host: LazyErrorHost;
  let unhandled: unknown[];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);

  const root = () => fixture.nativeElement as HTMLElement;
  const query = <E extends Element>(selector: string): E => {
    const el = root().querySelector<E>(selector);
    if (!el) throw new Error(`${selector} is not rendered`);
    return el;
  };
  const item = () => query<HTMLElement>('.mlv-tree__item');
  const toggle = () => query<HTMLButtonElement>('.mlv-tree__toggle');
  const spinner = () => root().querySelector('.mlv-tree__spinner');
  const labels = () =>
    Array.from(root().querySelectorAll('.mlv-tree__label')).map((el) =>
      el.textContent?.trim(),
    );
  const settle = async () => {
    await fixture.whenStable();
    await nextTask();
    await fixture.whenStable();
  };
  const parentOf = (el: Element): Element => {
    const parent = el.parentElement;
    if (!parent) throw new Error('the row has no parent');
    return parent;
  };
  /** The row whose own label reads `label`, skipping `except`. */
  const rowLabelled = (label: string, except?: Element): HTMLElement => {
    const row = Array.from(
      root().querySelectorAll<HTMLElement>('.mlv-tree__item'),
    ).find(
      (el) =>
        el !== except &&
        el.firstElementChild
          ?.querySelector('.mlv-tree__label')
          ?.textContent?.trim() === label,
    );
    if (!row) throw new Error(`no row labelled ${label}`);
    return row;
  };
  /** The chevron of `row` itself, not of a descendant row. */
  const toggleOf = (row: Element): HTMLButtonElement => {
    const button =
      row.firstElementChild?.querySelector<HTMLButtonElement>(
        '.mlv-tree__toggle',
      ) ?? null;
    if (!button) throw new Error('the row has no toggle');
    return button;
  };
  /** Warnings Angular logs for an emit on a destroyed `OutputRef`. */
  const destroyedEmits = (warn: { mock: { calls: unknown[][] } }) =>
    warn.mock.calls.filter((args) => String(args[0]).includes('NG0953')).length;

  beforeEach(async () => {
    unhandled = [];
    process.on('unhandledRejection', onUnhandled);
    await TestBed.configureTestingModule({
      imports: [LazyErrorHost],
      providers: [
        provideMlvI18nTesting(),
        provideLucideIcons(LucideFolder, LucideFile),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LazyErrorHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  it('clears the spinner, collapses the node and reports the error', async () => {
    toggle().click();
    await fixture.whenStable();
    expect(spinner()).not.toBeNull();
    expect(item().getAttribute('aria-expanded')).toBe('true');

    const failure = new Error('network down');
    host.attempts[0].reject(failure);
    await settle();

    expect(spinner()).toBeNull();
    expect(item().classList.contains('mlv-tree__item--loading')).toBe(false);
    expect(item().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Expand Lazy Node');
    // The chevron is back inside the toggle (it is hidden while loading).
    expect(toggle().querySelector('svg')).not.toBeNull();
    expect(host.errors.length).toBe(1);
    expect(host.errors[0].node.id).toBe('lazy');
    expect(host.errors[0].error).toBe(failure);
    // Opened by the user, closed by the failure: consumers mirroring the
    // expansion through `nodeToggle` stay in step — and the collapse lands
    // before `loadError`, so a handler reading that mirror sees it collapsed.
    expect(host.toggles).toEqual([true, false]);
    expect(host.events).toEqual(['toggle:true', 'toggle:false', 'error']);
    expect(unhandled).toEqual([]);
  });

  it('retries on the next expand and renders the children it loads', async () => {
    toggle().click();
    await fixture.whenStable();
    host.attempts[0].reject(new Error('network down'));
    await settle();

    toggle().click();
    await fixture.whenStable();

    expect(host.attempts.length).toBe(2);
    expect(spinner()).not.toBeNull();

    host.attempts[1].resolve(CHILDREN);
    await settle();

    expect(spinner()).toBeNull();
    expect(item().getAttribute('aria-expanded')).toBe('true');
    expect(labels()).toEqual(['Lazy Node', 'Lazy Child 1', 'Lazy Child 2']);
    expect(host.errors.length).toBe(1);
  });

  it('recovers the same way when loadChildren throws synchronously', async () => {
    const failure = new Error('bad request');
    host.throwNext = failure;

    toggle().click();
    await settle();

    expect(spinner()).toBeNull();
    expect(item().getAttribute('aria-expanded')).toBe('false');
    expect(host.errors.length).toBe(1);
    expect(host.errors[0].error).toBe(failure);
    expect(host.toggles).toEqual([true, false]);

    toggle().click();
    await fixture.whenStable();
    expect(host.attempts.length).toBe(1);
    expect(spinner()).not.toBeNull();
  });

  // `node.loadChildren()` ran the loader as a method of the node before
  // #353; the recovery path must not change that, or a loader reading `this`
  // fails on every expand and is reported as a load error.
  it('calls loadChildren as a method of a class-model node', async () => {
    const folder = new FolderNode('folder', 'Folder', CHILDREN);
    host.nodes.set([folder]);
    await fixture.whenStable();

    toggle().click();
    await settle();

    expect(host.errors.map(({ error }) => String(error))).toEqual([]);
    expect(folder.calls).toBe(1);
    expect(item().getAttribute('aria-expanded')).toBe('true');
    expect(labels()).toEqual(['Folder', 'Lazy Child 1', 'Lazy Child 2']);
  });

  it('calls loadChildren as a method of an object-literal node', async () => {
    const listed: (string | number)[] = [];
    const api = {
      list: (id: string | number) => {
        listed.push(id);
        return Promise.resolve(CHILDREN);
      },
    };
    const literal: MlvTreeNode<unknown> = {
      id: 'literal',
      label: 'Literal',
      data: {},
      loadChildren() {
        return api.list(this.id);
      },
    };
    host.nodes.set([literal]);
    await fixture.whenStable();

    toggle().click();
    await settle();

    expect(host.errors.map(({ error }) => String(error))).toEqual([]);
    expect(listed).toEqual(['literal']);
    expect(labels()).toEqual(['Literal', 'Lazy Child 1', 'Lazy Child 2']);
  });

  it('leaves a node collapsed during the load collapsed, with no extra nodeToggle', async () => {
    toggle().click();
    await fixture.whenStable();
    toggle().click();
    await fixture.whenStable();
    expect(item().getAttribute('aria-expanded')).toBe('false');
    expect(host.toggles).toEqual([true, false]);

    host.attempts[0].reject(new Error('network down'));
    await settle();

    expect(spinner()).toBeNull();
    expect(item().getAttribute('aria-expanded')).toBe('false');
    expect(host.toggles).toEqual([true, false]);
    expect(host.errors.length).toBe(1);

    toggle().click();
    await fixture.whenStable();
    expect(host.attempts.length).toBe(2);
  });

  it('drops the expansion of a node removed from the data during the load', async () => {
    const warn = vi.spyOn(console, 'warn');
    try {
      toggle().click();
      await fixture.whenStable();

      host.nodes.set([]);
      await fixture.whenStable();
      expect(root().querySelector('.mlv-tree__item')).toBeNull();

      host.attempts[0].reject(new Error('network down'));
      await settle();

      expect(host.errors.length).toBe(1);
      expect(host.toggles).toEqual([true, false]);
      expect(host.events).toEqual(['toggle:true', 'toggle:false', 'error']);
      // Nothing was written to the destroyed aria item's model.
      expect(destroyedEmits(warn)).toBe(0);

      // The node comes back collapsed, not open over an empty group.
      host.nodes.set([host.lazyNode]);
      await fixture.whenStable();
      expect(item().getAttribute('aria-expanded')).toBe('false');
      expect(spinner()).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  it('collapses a node re-added during the load without touching its destroyed row', async () => {
    const warn = vi.spyOn(console, 'warn');
    try {
      toggle().click();
      await fixture.whenStable();

      host.nodes.set([]);
      await fixture.whenStable();
      host.nodes.set([host.lazyNode]);
      await fixture.whenStable();
      // A new row: the expansion is keyed by id, so it opens straight away.
      expect(item().getAttribute('aria-expanded')).toBe('true');

      host.attempts[0].reject(new Error('network down'));
      await settle();

      // The node is back in the data, but the item that started the load is
      // the destroyed one, detached from the tree.
      expect(destroyedEmits(warn)).toBe(0);
      expect(host.events).toEqual(['toggle:true', 'toggle:false', 'error']);
      expect(item().getAttribute('aria-expanded')).toBe('false');
      expect(spinner()).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  // A leave animation — `(animate.leave)` in a consumer `mlvTreeNodeDef`
  // template — keeps a destroyed row's element in the DOM until it ends, so
  // "inside the tree's host" does not prove the row is alive. TestBed runs no
  // animations, so the removed row is put back by hand to stand in for one.
  it('drops the expansion of a removed node whose row is still attached, as during a leave animation', async () => {
    const warn = vi.spyOn(console, 'warn');
    try {
      toggle().click();
      await fixture.whenStable();
      const row = item();
      const subtree = parentOf(row);

      host.nodes.set([]);
      await fixture.whenStable();
      expect(root().querySelector('.mlv-tree__item')).toBeNull();
      subtree.appendChild(row);
      expect(root().contains(row)).toBe(true);

      host.attempts[0].reject(new Error('network down'));
      await settle();

      expect(destroyedEmits(warn)).toBe(0);
      expect(host.events).toEqual(['toggle:true', 'toggle:false', 'error']);

      row.remove();
      host.nodes.set([host.lazyNode]);
      await fixture.whenStable();
      expect(item().getAttribute('aria-expanded')).toBe('false');
      expect(spinner()).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  // A re-add in the same position does not reach this state: Angular drops
  // the leaving row at once. A move to another parent does — the old row
  // keeps animating out while the node renders again under its new parent.
  it('collapses a node moved to another parent during the load, while its old row is still attached', async () => {
    const sibling: MlvTreeNode<unknown> = { id: 'kid', label: 'Kid', data: {} };
    const box = (children: MlvTreeNode<unknown>[]): MlvTreeNode<unknown> => ({
      id: 'box',
      label: 'Box',
      data: {},
      children,
    });
    host.nodes.set([host.lazyNode, box([sibling])]);
    await fixture.whenStable();
    toggleOf(rowLabelled('Box')).click();
    await fixture.whenStable();

    const oldRow = rowLabelled('Lazy Node');
    toggleOf(oldRow).click();
    await fixture.whenStable();
    const rootSubtree = parentOf(oldRow);

    host.nodes.set([box([sibling, host.lazyNode])]);
    await fixture.whenStable();
    rootSubtree.appendChild(oldRow);
    const freshRow = () => rowLabelled('Lazy Node', oldRow);
    // The expansion is keyed by id, so the moved row opens straight away.
    expect(freshRow().getAttribute('aria-expanded')).toBe('true');

    host.attempts[0].reject(new Error('network down'));
    await settle();

    // The node is in the data and the old row is in the host, so the collapse
    // is written to the old, destroyed aria item and reaches no listener
    // (Angular warns NG0953 — the documented residual). The id is still
    // dropped, so the moved row closes and `nodeToggle` fires once.
    expect(host.events).toEqual([
      'toggle:true',
      'toggle:true',
      'toggle:false',
      'error',
    ]);
    expect(freshRow().getAttribute('aria-expanded')).toBe('false');
    // The destroyed old row keeps its last DOM, spinner included.
    expect(
      freshRow().firstElementChild?.querySelector('.mlv-tree__spinner'),
    ).toBeNull();

    oldRow.remove();
    toggleOf(freshRow()).click();
    await fixture.whenStable();
    expect(host.attempts.length).toBe(2);
  });

  it('emits nothing once the tree is destroyed before the load fails', async () => {
    const warn = vi.spyOn(console, 'warn');
    try {
      toggle().click();
      await fixture.whenStable();

      host.shown.set(false);
      await fixture.whenStable();
      expect(root().querySelector('mlv-tree')).toBeNull();

      host.attempts[0].reject(new Error('network down'));
      await settle();

      expect(host.errors.length).toBe(0);
      expect(host.toggles).toEqual([true]);
      expect(destroyedEmits(warn)).toBe(0);
      expect(unhandled).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});
