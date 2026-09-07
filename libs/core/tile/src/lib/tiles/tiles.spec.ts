import { fileURLToPath } from 'node:url';
import { By } from '@angular/platform-browser';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { parse } from 'postcss';
import { compile } from 'sass';
import Sortable from 'sortablejs';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import {
  MLV_TILE_ITEM_CONTEXT,
  type MlvTileItemContext,
} from '../tile-item-context';
import type {
  MlvTileNodeWithChildren,
  MlvTileTreeNode,
  MlvTilesAccepts,
  MlvTilesLayout,
} from '../tile-tree.types';
import { MlvTile } from '../tile/tile';
import { MlvTilesEmpty } from '../tiles-empty';
import { MlvTiles } from './tiles';

interface TestProps {
  readonly title: string;
  readonly type: 'page' | 'row' | 'block';
}

const root: MlvTileNodeWithChildren<TestProps> = {
  id: 'page',
  acceptsChildren: true,
  props: { title: 'Page', type: 'page' },
  children: [
    {
      id: 'row-a',
      acceptsChildren: true,
      props: { title: 'Row A', type: 'row' },
      children: [],
    },
  ],
};

const compoundRoot: MlvTileNodeWithChildren<TestProps> = {
  id: 'page',
  acceptsChildren: true,
  props: { title: 'Page', type: 'page' },
  children: [
    {
      id: 'alpha',
      acceptsChildren: false,
      props: { title: 'Alpha', type: 'block' },
    },
    {
      id: 'row-a',
      acceptsChildren: true,
      props: { title: 'Row A', type: 'row' },
      children: [
        {
          id: 'nested',
          acceptsChildren: false,
          props: { title: 'Nested', type: 'block' },
        },
      ],
    },
    {
      id: 'omega',
      acceptsChildren: false,
      props: { title: 'Omega', type: 'block' },
    },
  ],
};

const nestedRoot: MlvTileNodeWithChildren<TestProps> = {
  id: 'pointer-page',
  acceptsChildren: true,
  props: { title: 'Pointer page', type: 'page' },
  children: [
    {
      id: 'header-row',
      acceptsChildren: true,
      props: { title: 'Header row', type: 'row' },
      children: [
        {
          id: 'launch',
          acceptsChildren: false,
          props: { title: 'Launch', type: 'block' },
        },
        {
          id: 'introduction',
          acceptsChildren: false,
          props: { title: 'Introduction', type: 'block' },
        },
      ],
    },
    {
      id: 'content-stack',
      acceptsChildren: true,
      props: { title: 'Content stack', type: 'row' },
      children: [
        {
          id: 'media-row',
          acceptsChildren: true,
          props: { title: 'Media row', type: 'row' },
          children: [
            {
              id: 'product-image',
              acceptsChildren: false,
              props: { title: 'Product image', type: 'block' },
            },
            {
              id: 'shop-release',
              acceptsChildren: false,
              props: { title: 'Shop the release', type: 'block' },
            },
          ],
        },
      ],
    },
    {
      id: 'empty-row',
      acceptsChildren: true,
      props: { title: 'Empty row', type: 'row' },
      children: [],
    },
  ],
};

@Component({
  selector: 'test-tile-item',
  imports: [MlvTiles],
  template: '<mlv-tiles [accepts]="accepts()" />',
  providers: [
    {
      provide: MLV_TILE_ITEM_CONTEXT,
      useExisting: forwardRef(() => TestTileItem),
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestTileItem implements MlvTileItemContext<TestProps> {
  readonly tile = input.required<MlvTileTreeNode<TestProps>>();
  readonly accepts = input<MlvTilesAccepts<TestProps> | undefined>();
}

@Component({
  imports: [MlvTiles, TestTileItem],
  template: `
    <mlv-tiles [(tree)]="tree" [accepts]="accepts">
      <test-tile-item [tile]="tree().children[0]" [accepts]="accepts" />
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileTreeTestHost {
  readonly tree = signal(root);
  readonly accepts: MlvTilesAccepts<TestProps> = (_dragged, target, children) =>
    target.children === children;
}

@Component({
  selector: 'test-bound-tile-item',
  imports: [MlvTiles],
  template: '<mlv-tiles [(tree)]="nestedTree" />',
  providers: [
    {
      provide: MLV_TILE_ITEM_CONTEXT,
      useExisting: forwardRef(() => TestBoundTileItem),
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestBoundTileItem implements MlvTileItemContext<TestProps> {
  readonly tile = input.required<MlvTileTreeNode<TestProps>>();
  readonly nestedTree = signal(
    root.children[0] as MlvTileNodeWithChildren<TestProps>,
  );
}

@Component({
  imports: [MlvTiles, TestBoundTileItem],
  template: `
    <mlv-tiles [(tree)]="tree">
      <test-bound-tile-item [tile]="tree().children[0]" />
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NestedTreeBindingTestHost {
  readonly tree = signal(root);
}

@Component({
  selector: 'test-compound-tile-item',
  imports: [MlvTile, MlvTiles, forwardRef(() => CompoundTileItem)],
  template: `
    @let current = tile();
    <mlv-tile [tile]="current">
      {{ current.props.title }}
      @if (current.acceptsChildren) {
        <mlv-tiles [layout]="layout()">
          @for (child of current.children; track child.id) {
            <test-compound-tile-item [tile]="child" [layout]="layout()" />
          }
        </mlv-tiles>
      }
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CompoundTileItem {
  readonly tile = input.required<MlvTileTreeNode<TestProps>>();
  readonly layout = input<MlvTilesLayout>('list');
}

@Component({
  imports: [MlvTiles, CompoundTileItem],
  template: `
    <mlv-tiles [(tree)]="tree" [accepts]="accepts" [layout]="layout()">
      @for (item of tree().children; track item.id) {
        <test-compound-tile-item [tile]="item" [layout]="layout()" />
      }
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CompoundTileTreeTestHost {
  readonly tree = signal(compoundRoot);
  readonly layout = signal<MlvTilesLayout>('list');
  readonly accepts: MlvTilesAccepts<TestProps> = (_dragged, target) =>
    target.id !== 'row-a';
}

@Component({
  imports: [MlvTiles, CompoundTileItem],
  template: `
    <mlv-tiles [(tree)]="tree" layout="grid" [accepts]="accepts">
      @for (item of tree().children; track item.id) {
        <test-compound-tile-item [tile]="item" layout="grid" />
      }
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NestedTreeTestHost {
  readonly tree = signal(nestedRoot);
  readonly rejectedTargetId = signal<string | undefined>(undefined);
  readonly accepts: MlvTilesAccepts<TestProps> = (_dragged, target) =>
    target.id !== this.rejectedTargetId();
}

const mixedRoot: MlvTileNodeWithChildren<TestProps> = {
  id: 'mixed-page',
  acceptsChildren: true,
  props: { title: 'Mixed page', type: 'page' },
  children: [
    {
      id: 'mixed-alpha',
      acceptsChildren: false,
      props: { title: 'Mixed alpha', type: 'block' },
    },
    {
      id: 'mixed-omega',
      acceptsChildren: false,
      props: { title: 'Mixed omega', type: 'block' },
    },
  ],
};

@Component({
  imports: [MlvTiles, MlvTile],
  template: `
    <mlv-tiles [(tree)]="tree">
      <mlv-tile>Unbound decoration</mlv-tile>
      @if (showAlpha()) {
        <mlv-tile [tile]="alphaBound() ? tree().children[0] : undefined">
          Alpha
        </mlv-tile>
      }
      <mlv-tile [tile]="tree().children[1]">Omega</mlv-tile>
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MixedTileListTestHost {
  readonly tree = signal(mixedRoot);
  readonly alphaBound = signal(true);
  readonly showAlpha = signal(true);
}

@Component({
  imports: [MlvTiles, MlvTile, MlvTilesEmpty],
  template: `
    <mlv-tiles [(tree)]="tree" [emptyLabel]="emptyLabel()" [locked]="locked()">
      @if (projectEmpty()) {
        <ng-template mlvTilesEmpty>
          <button class="test-add" type="button">Add block</button>
        </ng-template>
      }
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class EmptyTilesTestHost {
  readonly tree = signal<MlvTileNodeWithChildren<TestProps>>({
    id: 'page',
    acceptsChildren: true,
    props: { title: 'Page', type: 'page' },
    children: [],
  });
  readonly emptyLabel = signal<string | undefined>(undefined);
  readonly projectEmpty = signal(false);
  readonly locked = signal(false);
}

interface RenderedContainer {
  readonly component: MlvTiles<TestProps>;
  readonly element: HTMLElement;
  readonly sortable: Sortable;
}

interface DropRequest {
  readonly sourceId: string;
  readonly targetId: string;
  readonly tileId: string;
  readonly oldIndex: number;
  readonly newIndex: number;
}

function containers(fixture: ComponentFixture<unknown>): RenderedContainer[] {
  return fixture.debugElement.queryAll(By.directive(MlvTiles)).map((debug) => {
    const element = debug.nativeElement as HTMLElement;
    const sortable = Sortable.get(element);
    if (!sortable) throw new Error('Expected Sortable instance');
    return {
      component: debug.componentInstance as MlvTiles<TestProps>,
      element,
      sortable,
    };
  });
}

function container(
  fixture: ComponentFixture<unknown>,
  id: string,
): RenderedContainer {
  const match = containers(fixture).find(
    ({ component }) => component.targetId() === id,
  );
  if (!match) throw new Error(`Expected container ${id}`);
  return match;
}

function item(host: HTMLElement, id: string): HTMLElement {
  const match = Array.from(host.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.dataset['mlvTileId'] === id,
  );
  if (!match) throw new Error(`Expected item ${id}`);
  return match;
}

function event(
  dragged: HTMLElement,
  from: HTMLElement,
  to: HTMLElement,
  oldIndex: number,
  newIndex: number,
): Sortable.SortableEvent {
  return {
    item: dragged,
    items: [],
    clone: dragged.cloneNode(true) as HTMLElement,
    from,
    to,
    target: to,
    oldIndex,
    newIndex,
    oldDraggableIndex: oldIndex,
    newDraggableIndex: newIndex,
    oldIndicies: [],
    newIndicies: [],
    pullMode: true,
    swapItem: null,
    type: 'end',
  } as unknown as Sortable.SortableEvent;
}

function insertAt(
  target: HTMLElement,
  dragged: HTMLElement,
  index: number,
): void {
  const siblings = Array.from(target.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child !== dragged &&
      child.classList.contains('mlv-tiles__item-root'),
  );
  const reference =
    siblings[index] ??
    Array.from(target.children).find(
      (child) =>
        child !== dragged && !child.classList.contains('mlv-tiles__item-root'),
    ) ??
    null;
  target.insertBefore(dragged, reference);
}

function start(
  fixture: ComponentFixture<unknown>,
  request: DropRequest,
): {
  readonly source: RenderedContainer;
  readonly target: RenderedContainer;
  readonly dragged: HTMLElement;
  readonly endEvent: Sortable.SortableEvent;
} {
  const source = container(fixture, request.sourceId);
  const target = container(fixture, request.targetId);
  const dragged = item(source.element, request.tileId);
  const endEvent = event(
    dragged,
    source.element,
    target.element,
    request.oldIndex,
    request.newIndex,
  );
  source.sortable.options.onStart?.(endEvent);
  return { source, target, dragged, endEvent };
}

async function drop(
  fixture: ComponentFixture<unknown>,
  request: DropRequest,
): Promise<void> {
  const { source, target, dragged, endEvent } = start(fixture, request);
  insertAt(target.element, dragged, request.newIndex);
  source.sortable.options.onEnd?.(endEvent);
  fixture.detectChanges();
  await fixture.whenStable();
}

function findContainer(
  tree: MlvTileNodeWithChildren<TestProps>,
  id: string,
): MlvTileNodeWithChildren<TestProps> {
  const pending: MlvTileTreeNode<TestProps>[] = [tree];
  while (pending.length > 0) {
    const node = pending.shift();
    if (node?.id === id && node.acceptsChildren) return node;
    if (node?.acceptsChildren) pending.push(...node.children);
  }
  throw new Error(`Expected tree container ${id}`);
}

function allIds(tree: MlvTileNodeWithChildren<TestProps>): readonly string[] {
  const ids: string[] = [];
  const visit = (node: MlvTileTreeNode<TestProps>): void => {
    ids.push(node.id);
    if (node.acceptsChildren) node.children.forEach(visit);
  };
  visit(tree);
  return ids.sort();
}

function declarations(
  css: string,
  selector: string,
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  parse(css).walkRules(selector, (rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls((declaration) =>
      result.set(declaration.prop, declaration.value),
    );
  });
  return result;
}

function compiledCss(): string {
  return compile(
    fileURLToPath(new URL(['.', 'tiles.scss'].join('/'), import.meta.url)),
  ).css;
}

describe('MlvTiles', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it('shares one coordinator and derives root and nested target IDs', async () => {
    await TestBed.configureTestingModule({
      imports: [TileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(TileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const rendered = containers(fixture);
    expect(rendered.map(({ component }) => component.targetId())).toEqual([
      'page',
      'row-a',
    ]);
    expect(rendered[0].component.coordinator).toBe(
      rendered[1].component.coordinator,
    );
    expect(rendered[0].component.coordinator.targets()).toHaveLength(2);
  });

  it('reserves an idle restriction slot without exposing its feedback', async () => {
    await TestBed.configureTestingModule({
      imports: [TileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(TileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const row = container(fixture, 'row-a').element;
    const restriction = row.querySelector(
      '.mlv-tiles__restriction',
    ) as HTMLElement;
    expect(restriction.textContent).toBe('Restricted');
    expect(restriction.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.mlv-tiles__empty')?.textContent).toContain(
      'Drop tiles here',
    );
  });

  it('reports a development error for a nested tree binding', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeBindingTestHost],
    }).compileComponents();
    expect(() => {
      const fixture = TestBed.createComponent(NestedTreeBindingTestHost);
      fixture.detectChanges();
    }).toThrowError(/Nested mlv-tiles must inherit the root tree/);
  });

  it('internalizes typed Sortable items and containers for a public-only compound host', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const rendered = containers(fixture);
    expect(rendered.map(({ component }) => component.targetId())).toEqual([
      'page',
      'row-a',
    ]);
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll('[data-mlv-tile-id]'),
      ).map((element) => (element as HTMLElement).dataset['mlvTileId']),
    ).toEqual(['alpha', 'row-a', 'nested', 'omega']);
    expect(
      fixture.nativeElement.querySelectorAll('.mlv-tile__drag-handle'),
    ).toHaveLength(4);
    expect(
      rendered.every(({ sortable }) => sortable.options.forceFallback),
    ).toBe(true);
  });

  it('configures grid animation while caching nested target policy without reflow', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.componentInstance.layout.set('grid');
    fixture.detectChanges();
    await fixture.whenStable();
    const page = container(fixture, 'page');
    const row = container(fixture, 'row-a');
    const restingBounds = { width: 320, height: 224 };
    vi.spyOn(row.element, 'getBoundingClientRect').mockReturnValue({
      ...restingBounds,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 224,
      toJSON: () => ({}),
    } as DOMRect);
    const alpha = item(page.element, 'alpha');
    page.sortable.options.onStart?.(
      event(alpha, page.element, page.element, 0, 0),
    );
    fixture.detectChanges();
    expect(page.sortable.options.direction).toEqual(expect.any(Function));
    expect(page.sortable.options.animation).toBe(200);
    expect(page.sortable.options.easing).toBe('var(--mlv-ease-in-out-strong)');
    expect([page.component.dropState(), row.component.dropState()]).toEqual([
      'valid',
      'invalid',
    ]);
    expect(row.element.getBoundingClientRect()).toEqual(
      expect.objectContaining(restingBounds),
    );
    page.sortable.options.onEnd?.(
      event(alpha, page.element, page.element, 0, 0),
    );
  });

  it('uses Sortable indices for same-row forward and backward requests', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    await drop(fixture, {
      sourceId: 'page',
      targetId: 'page',
      tileId: 'alpha',
      oldIndex: 0,
      newIndex: 2,
    });
    expect(
      fixture.componentInstance.tree().children.map(({ id }) => id),
    ).toEqual(['row-a', 'omega', 'alpha']);
    await drop(fixture, {
      sourceId: 'page',
      targetId: 'page',
      tileId: 'alpha',
      oldIndex: 2,
      newIndex: 0,
    });
    expect(
      fixture.componentInstance.tree().children.map(({ id }) => id),
    ).toEqual(['alpha', 'row-a', 'omega']);
  });

  it('keeps a nested sibling reorder in its source before the overlapping ancestor without losing nodes', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    await drop(fixture, {
      sourceId: 'header-row',
      targetId: 'header-row',
      tileId: 'introduction',
      oldIndex: 1,
      newIndex: 0,
    });
    expect(
      findContainer(
        fixture.componentInstance.tree(),
        'header-row',
      ).children.map(({ id }) => id),
    ).toEqual(['introduction', 'launch']);
    expect(allIds(fixture.componentInstance.tree())).toEqual(
      allIds(nestedRoot),
    );
  });

  it('restores the real Angular wrapper before immutable repeater settlement', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const header = container(fixture, 'header-row');
    const launch = item(header.element, 'launch');
    const introduction = item(header.element, 'introduction');
    const pending = start(fixture, {
      sourceId: 'header-row',
      targetId: 'header-row',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 1,
    });
    insertAt(header.element, launch, 1);
    launch.classList.add('mlv-tiles__sortable-ghost');
    pending.source.sortable.options.onEnd?.(pending.endEvent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      Array.from(container(fixture, 'header-row').element.children).filter(
        (child) => child.classList.contains('mlv-tiles__item-root'),
      ),
    ).toEqual([introduction, launch]);
    expect(launch.isConnected).toBe(true);
    expect(launch.classList).not.toContain('mlv-tiles__sortable-ghost');
  });

  it('uses the cached source anchor without moving the wrapper into an ancestor', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const initial = fixture.componentInstance.tree();
    const header = container(fixture, 'header-row');
    const launch = item(header.element, 'launch');
    header.sortable.options.onStart?.(
      event(launch, header.element, header.element, 0, 0),
    );
    insertAt(container(fixture, 'pointer-page').element, launch, 0);
    header.sortable.options.onEnd?.(
      event(launch, header.element, header.element, 0, 0),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.tree()).toBe(initial);
    expect(launch.parentElement).toBe(header.element);
  });

  it('moves a nested leaf into the deepest accepted cross-level target without losing nodes', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    await drop(fixture, {
      sourceId: 'header-row',
      targetId: 'media-row',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 1,
    });
    expect(
      findContainer(
        fixture.componentInstance.tree(),
        'header-row',
      ).children.map(({ id }) => id),
    ).toEqual(['introduction']);
    expect(
      findContainer(fixture.componentInstance.tree(), 'media-row').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['product-image', 'launch', 'shop-release']);
    expect(allIds(fixture.componentInstance.tree())).toEqual(
      allIds(nestedRoot),
    );
  });

  it('inserts into an empty accepted target at Sortable index zero', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    await drop(fixture, {
      sourceId: 'header-row',
      targetId: 'empty-row',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 0,
    });
    expect(
      findContainer(fixture.componentInstance.tree(), 'empty-row').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['launch']);
    expect(allIds(fixture.componentInstance.tree())).toEqual(
      allIds(nestedRoot),
    );
  });

  it('resolves an away-and-back pointer to the source and preserves the original tree', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const initial = fixture.componentInstance.tree();
    const pending = start(fixture, {
      sourceId: 'header-row',
      targetId: 'header-row',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 0,
    });
    insertAt(container(fixture, 'header-row').element, pending.dragged, 1);
    insertAt(container(fixture, 'header-row').element, pending.dragged, 0);
    pending.source.sortable.options.onEnd?.(pending.endEvent);
    fixture.detectChanges();
    expect(fixture.componentInstance.tree()).toBe(initial);
  });

  it('blocks an invalid deepest target from falling through to its ancestor and restores on drag end', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedTreeTestHost);
    fixture.componentInstance.rejectedTargetId.set('media-row');
    fixture.detectChanges();
    await fixture.whenStable();
    const initial = fixture.componentInstance.tree();
    const pending = start(fixture, {
      sourceId: 'header-row',
      targetId: 'media-row',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 1,
    });
    const media = container(fixture, 'media-row');
    const content = container(fixture, 'content-stack');
    const moveEvent = {
      dragged: pending.dragged,
      draggedRect: pending.dragged.getBoundingClientRect(),
      from: pending.source.element,
      related: media.element,
      relatedRect: media.element.getBoundingClientRect(),
      to: content.element,
      type: 'move',
    } as Sortable.MoveEvent;
    const pointerEvent = {
      target: media.element,
      composedPath: () => [media.element, content.element, document.body],
    } as unknown as Event;
    expect(
      pending.source.sortable.options.onMove?.(moveEvent, pointerEvent),
    ).toBe(false);
    insertAt(media.element, pending.dragged, 1);
    pending.source.sortable.options.onEnd?.(pending.endEvent);
    fixture.detectChanges();
    expect(fixture.componentInstance.tree()).toBe(initial);
    expect(item(container(fixture, 'header-row').element, 'launch')).toBe(
      pending.dragged,
    );
  });

  it('keeps the stable root when a grid item returns to its original cell', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const initial = fixture.componentInstance.tree();
    await drop(fixture, {
      sourceId: 'page',
      targetId: 'page',
      tileId: 'alpha',
      oldIndex: 0,
      newIndex: 0,
    });
    expect(fixture.componentInstance.tree()).toBe(initial);
  });

  it('keeps the stable root when a grid pointer drops outside registered targets', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const initial = fixture.componentInstance.tree();
    const pending = start(fixture, {
      sourceId: 'page',
      targetId: 'page',
      tileId: 'alpha',
      oldIndex: 0,
      newIndex: 0,
    });
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.appendChild(pending.dragged);
    pending.source.sortable.options.onEnd?.(
      event(pending.dragged, pending.source.element, outside, 0, 0),
    );
    fixture.detectChanges();
    outside.remove();
    expect(fixture.componentInstance.tree()).toBe(initial);
    expect(item(container(fixture, 'page').element, 'alpha')).toBe(
      pending.dragged,
    );
  });

  it('clears an active Sortable session that ends without a model drop', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = container(fixture, 'page');
    const alpha = item(page.element, 'alpha');
    page.sortable.options.onStart?.(
      event(alpha, page.element, page.element, 0, 0),
    );
    expect(page.component.coordinator.activeSession()).not.toBeNull();
    fixture.destroy();
    expect(page.component.coordinator.activeSession()).toBeNull();
  });

  it('keeps the direct wrapper as the Sortable item while the clone owns feedback geometry', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = container(fixture, 'page');
    const wrapper = item(page.element, 'alpha');
    const tileHost = wrapper.querySelector(':scope > mlv-tile') as HTMLElement;
    const clone = wrapper.cloneNode(true) as HTMLElement;
    expect(wrapper.parentElement).toBe(page.element);
    expect(wrapper.classList).toContain('mlv-tiles__item-root');
    expect(tileHost.classList).toContain('mlv-tile');
    expect(clone.dataset['mlvTileId']).toBe('alpha');
    expect(page.sortable.options.fallbackOnBody).toBe(true);
    expect(page.sortable.options.fallbackClass).toBe(
      'mlv-tiles__sortable-fallback',
    );
  });

  it('registers only bound Sortable items across mixed-list binding transitions', async () => {
    await TestBed.configureTestingModule({
      imports: [MixedTileListTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(MixedTileListTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const ids = () =>
      Array.from(container(fixture, 'mixed-page').element.children).flatMap(
        (child) =>
          child instanceof HTMLElement && child.dataset['mlvTileId']
            ? [child.dataset['mlvTileId']]
            : [],
      );
    expect(ids()).toEqual(['mixed-alpha', 'mixed-omega']);
    fixture.componentInstance.alphaBound.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(ids()).toEqual(['mixed-omega']);
    fixture.componentInstance.alphaBound.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(ids()).toEqual(['mixed-alpha', 'mixed-omega']);
    fixture.componentInstance.showAlpha.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(ids()).toEqual(['mixed-omega']);
  });

  it('does not mutate for a structurally valid end without an active session', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const initial = fixture.componentInstance.tree();
    const page = container(fixture, 'page');
    const alpha = item(page.element, 'alpha');
    page.sortable.options.onEnd?.(
      event(alpha, page.element, page.element, 0, 2),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.tree()).toBe(initial);
  });

  it('does not mutate when the end item differs from the active session', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const initial = fixture.componentInstance.tree();
    const page = container(fixture, 'page');
    const omega = item(page.element, 'omega');
    const alpha = item(page.element, 'alpha');
    page.sortable.options.onStart?.(
      event(omega, page.element, page.element, 2, 2),
    );
    page.sortable.options.onEnd?.(
      event(alpha, page.element, page.element, 0, 2),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.tree()).toBe(initial);
    expect(page.component.coordinator.activeSession()).toBeNull();
  });

  it('rejects an end whose cached target policy is invalid', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const initial = fixture.componentInstance.tree();
    const pending = start(fixture, {
      sourceId: 'page',
      targetId: 'row-a',
      tileId: 'alpha',
      oldIndex: 0,
      newIndex: 1,
    });
    insertAt(pending.target.element, pending.dragged, 1);
    pending.source.sortable.options.onEnd?.(pending.endEvent);
    fixture.detectChanges();
    expect(fixture.componentInstance.tree()).toBe(initial);
    expect(item(container(fixture, 'page').element, 'alpha')).toBe(
      pending.dragged,
    );
  });

  it('routes item property replacement, property updates, and removal through the root', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const alpha = fixture.debugElement
      .queryAll(By.directive(MlvTile))
      .map((debug) => debug.componentInstance as MlvTile<TestProps>)
      .find((tile) => tile.tile()?.id === 'alpha');
    if (!alpha) throw new Error('Expected Alpha tile');
    alpha.setProps({ title: 'Beta', type: 'block' });
    expect(fixture.componentInstance.tree().children[0].props.title).toBe(
      'Beta',
    );
    alpha.updateProps((props) => ({ ...props, title: 'Gamma' }));
    expect(fixture.componentInstance.tree().children[0].props.title).toBe(
      'Gamma',
    );
    alpha.remove();
    expect(
      fixture.componentInstance.tree().children.map(({ id }) => id),
    ).toEqual(['row-a', 'omega']);
  });

  it('resolves the empty prompt through template, label, then translation', async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyTilesTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(EmptyTilesTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector(
      'mlv-tiles',
    ) as HTMLElement;

    expect(host.querySelector('.mlv-tiles__empty')?.textContent?.trim()).toBe(
      'Drop tiles here',
    );

    fixture.componentInstance.emptyLabel.set('No blocks yet');
    fixture.detectChanges();
    expect(host.querySelector('.mlv-tiles__empty')?.textContent?.trim()).toBe(
      'No blocks yet',
    );

    fixture.componentInstance.projectEmpty.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const projected = host.querySelector('.mlv-tiles__empty');
    expect(projected?.textContent?.trim()).toBe('Add block');
    expect(projected?.classList).toContain('mlv-tiles__empty--projected');
  });

  it('keeps a projected empty state inside the full-row empty wrapper', async () => {
    // The wrapper is the only element carrying `grid-column: 1 / -1`. Rendering
    // a projected slot outside it drops the content into a single grid track,
    // so a 12-column container squeezes its empty state into one twelfth of the
    // available width.
    await TestBed.configureTestingModule({
      imports: [EmptyTilesTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(EmptyTilesTestHost);
    fixture.componentInstance.projectEmpty.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector(
      'mlv-tiles',
    ) as HTMLElement;

    const wrapper = host.querySelector('.mlv-tiles__empty');
    const projectedControl = host.querySelector('.test-add');

    expect(wrapper).not.toBeNull();
    expect(projectedControl).not.toBeNull();
    expect(wrapper?.contains(projectedControl as Node)).toBe(true);
    expect(projectedControl?.parentElement?.closest('.mlv-tiles__empty')).toBe(
      wrapper,
    );
  });

  it('renders no empty prompt inside a locked container', async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyTilesTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(EmptyTilesTestHost);
    fixture.componentInstance.locked.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector(
      'mlv-tiles',
    ) as HTMLElement;

    expect(host.classList).toContain('mlv-tiles--locked');
    expect(host.querySelector('.mlv-tiles__empty')).toBeNull();

    fixture.componentInstance.projectEmpty.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.querySelector('.test-add')).toBeNull();
  });

  it('publishes the nesting depth as a host style variable', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      container(fixture, 'page').element.style.getPropertyValue(
        '--mlv-tiles-depth',
      ),
    ).toBe('0');
    expect(
      container(fixture, 'row-a').element.style.getPropertyValue(
        '--mlv-tiles-depth',
      ),
    ).toBe('1');
  });

  it('inserts and removes registered items from a container reference', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const row = container(fixture, 'row-a').component;

    expect(
      row.insert(
        {
          id: 'added',
          acceptsChildren: false,
          props: { title: 'Added', type: 'block' },
        },
        0,
      ),
    ).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      findContainer(fixture.componentInstance.tree(), 'row-a').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['added', 'nested']);

    // A reused ID and an out-of-range index are both rejected, not clamped.
    const unchanged = fixture.componentInstance.tree();
    expect(
      row.insert({
        id: 'nested',
        acceptsChildren: false,
        props: { title: 'Duplicate', type: 'block' },
      }),
    ).toBe(false);
    expect(
      row.insert(
        {
          id: 'late',
          acceptsChildren: false,
          props: { title: 'Late', type: 'block' },
        },
        9,
      ),
    ).toBe(false);
    expect(fixture.componentInstance.tree()).toBe(unchanged);

    expect(row.remove('added')).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      findContainer(fixture.componentInstance.tree(), 'row-a').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['nested']);
    expect(row.remove('missing')).toBe(false);
  });

  it('does not instantiate Sortable during server rendering', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector(
      'mlv-tiles',
    ) as HTMLElement;
    expect(Sortable.get(host)).toBeUndefined();
  });
});

describe('MlvTiles item-root and drag feedback styling', () => {
  it('owns full-size responsive grid tracks without stretching branches', () => {
    const css = compiledCss();
    expect(declarations(css, '.mlv-tiles').get('inline-size')).toBe('100%');
    expect(declarations(css, '.mlv-tiles').get('container-type')).toBe(
      'inline-size',
    );
    expect(
      declarations(css, '.mlv-tiles--grid').get('grid-template-columns'),
    ).toBe(
      'repeat(auto-fit, minmax(min(100%, var(--mlv-tiles-min-column, 20rem)), 1fr))',
    );
    expect(declarations(css, '.mlv-tiles--grid').get('align-items')).toBe(
      'start',
    );
    expect(
      declarations(css, '.mlv-tiles__item-root').get('min-inline-size'),
    ).toBe('0');
  });

  it('reserves a complete dashed outline and keeps drag feedback out of flow', () => {
    const css = compiledCss();
    const restriction = declarations(css, '.mlv-tiles__restriction');
    expect(declarations(css, '.mlv-tiles').get('border')).toBe(
      'var(--mlv-stroke-width) dashed transparent',
    );
    expect(restriction.get('position')).toBe('absolute');
    expect(restriction.get('inset-block-start')).toBe('0');
    expect(restriction.get('inset-inline-start')).toBe('0');
    expect(restriction.has('grid-column')).toBe(false);
    expect(restriction.get('visibility')).toBe('hidden');
    expect(restriction.get('pointer-events')).toBe('none');
    expect(
      declarations(css, '.mlv-tiles__restriction--visible').get('visibility'),
    ).toBe('visible');
    expect(declarations(css, '.mlv-tiles__empty').get('grid-column')).toBe(
      '1/-1',
    );
  });

  it('tapers the list gap and the empty-target footprint with nesting depth', () => {
    const css = compiledCss();
    expect(declarations(css, '.mlv-tiles--layout-list').get('gap')).toBe(
      'max(var(--mlv-spacing-1), var(--mlv-spacing-3) - var(--mlv-tiles-depth, 0) * var(--mlv-spacing-0-5))',
    );
    expect(declarations(css, '.mlv-tiles__empty').get('min-block-size')).toBe(
      'max(var(--mlv-height-l), var(--mlv-spacing-16) - var(--mlv-tiles-depth, 0) * var(--mlv-spacing-4))',
    );
  });

  it('drops the drag outline inside a locked container', () => {
    const lockedSelectors = new Set<string>();
    const borderColors: string[] = [];
    parse(compiledCss()).walkRules((rule) => {
      if (!rule.selector.includes('mlv-tiles--locked')) return;
      rule.selectors.forEach((selector) => lockedSelectors.add(selector));
      rule.walkDecls('border-color', (declaration) =>
        borderColors.push(declaration.value),
      );
    });

    expect(lockedSelectors).toEqual(
      new Set([
        '.mlv-tiles--locked.mlv-tiles--valid',
        '.mlv-tiles--locked.mlv-tiles--invalid',
      ]),
    );
    expect(borderColors).toEqual(['transparent']);
  });

  it('leaves wrapped sibling transforms to the Sortable animation engine', () => {
    const transition = declarations(
      compiledCss(),
      '.mlv-tiles--sorting > .mlv-tiles__item-root',
    );
    expect(transition.has('transition')).toBe(false);
    expect(transition.has('will-change')).toBe(false);
  });

  it('makes Sortable and wrapped-root transitions instant for reduced motion', async () => {
    const css = compiledCss();
    let instant = false;
    parse(css).walkAtRules('media', (rule) => {
      if (!rule.params.includes('prefers-reduced-motion: reduce')) return;
      rule.walkDecls('transition-duration', (declaration) => {
        if (declaration.value === 'var(--mlv-duration-instant)') instant = true;
      });
    });
    expect(instant).toBe(true);

    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      await TestBed.configureTestingModule({
        imports: [CompoundTileTreeTestHost],
        providers: [provideMlvI18nTesting()],
      }).compileComponents();
      const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(container(fixture, 'page').sortable.options.animation).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps an empty source footprint and one translucent moving tile', () => {
    const css = compiledCss();
    const ghost = declarations(css, '.mlv-tiles__sortable-ghost');
    const fallback = declarations(css, '.mlv-tiles__sortable-fallback');
    expect(ghost.get('opacity')).toBe('0.5');
    expect(ghost.get('transition')).toBe(
      'opacity var(--mlv-duration-fast) var(--mlv-ease-default)',
    );
    expect(fallback.get('pointer-events')).toBe('none');
    expect(fallback.get('opacity')).toBe('0.9');
    expect(fallback.get('box-shadow')).toBe('var(--mlv-shadow-overlay)');
    expect(fallback.get('transition')).toContain('box-shadow');
    expect(css).not.toContain('cdk-drop-list');
    expect(css).not.toContain('logical-ghost');
  });
});

/**
 * Accessibility sweep — compound tree.
 *
 * Registering a tile with `[tile]` is what turns its decorative grip into an
 * operable `<button>`, and that button's contract spans two components: its
 * `aria-describedby` points at a `cdk-visually-hidden` instructions span that
 * only the ROOT `mlv-tiles` renders, and its `aria-keyshortcuts` advertises the
 * keyboard move. A dangling `aria-describedby` is invisible in a per-component
 * sweep and is exactly what `aria-valid-attr-value` catches, so the sweep runs
 * over the whole tree rather than one tile. The empty-target render is swept
 * separately because its `mlv-tiles__empty` prompt (default and projected)
 * exists only while a container has no children.
 */
describe('MlvTiles accessibility', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it('has no axe violations for a nested compound tree', async () => {
    await TestBed.configureTestingModule({
      imports: [CompoundTileTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(CompoundTileTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: four registered tiles, so four operable handles, each named and
    // each pointing at the one instructions span the root actually rendered.
    const handles = [
      ...host.querySelectorAll('button.mlv-tile__drag-handle'),
    ] as HTMLButtonElement[];
    expect(handles).toHaveLength(4);
    const describedBy = handles[0].getAttribute('aria-describedby') as string;
    expect(handles[0].getAttribute('aria-label')).toBeTruthy();
    expect(host.querySelectorAll(`#${describedBy}`)).toHaveLength(1);
    expect(
      handles.every((h) => h.getAttribute('aria-describedby') === describedBy),
    ).toBe(true);
    // The polite status region the keyboard move announces through.
    expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations for a grid layout with an empty container', async () => {
    await TestBed.configureTestingModule({
      imports: [NestedTreeTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(NestedTreeTestHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: `empty-row` has no children, so the default drop prompt rendered
    // inside a grid-layout container.
    expect(
      host.querySelectorAll('.mlv-tiles__empty').length,
    ).toBeGreaterThanOrEqual(1);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations with a projected empty-target prompt', async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyTilesTestHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(EmptyTilesTestHost);
    fixture.componentInstance.projectEmpty.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: the consumer's own control is projected into the empty target, so
    // the prompt is interactive rather than a caption.
    expect(host.querySelector('button.test-add')).toBeTruthy();
    expect(host.querySelectorAll('.mlv-tiles__empty--projected')).toHaveLength(
      1,
    );

    await expectNoAxeViolations(host);
  });
});
