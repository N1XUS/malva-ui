import { By } from '@angular/platform-browser';
import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import Sortable from 'sortablejs';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import type {
  MlvTileMovedEvent,
  MlvTileNodeWithChildren,
  MlvTileTreeNode,
  MlvTilesAccepts,
} from '../tile-tree.types';
import { MlvTile } from '../tile/tile';
import { MlvTiles } from './tiles';

interface TestProps {
  readonly title: string;
  readonly type: 'page' | 'row' | 'block';
}

const testRoot: MlvTileNodeWithChildren<TestProps> = {
  id: 'page',
  acceptsChildren: true,
  props: { title: 'Page', type: 'page' },
  children: [
    {
      id: 'header',
      acceptsChildren: true,
      props: { title: 'Header', type: 'row' },
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
      id: 'content',
      acceptsChildren: true,
      props: { title: 'Content', type: 'row' },
      children: [
        {
          id: 'media',
          acceptsChildren: true,
          props: { title: 'Media', type: 'row' },
          children: [
            {
              id: 'image',
              acceptsChildren: false,
              props: { title: 'Image', type: 'block' },
            },
            {
              id: 'shop',
              acceptsChildren: false,
              props: { title: 'Shop', type: 'block' },
            },
          ],
        },
      ],
    },
    {
      id: 'empty',
      acceptsChildren: true,
      props: { title: 'Empty', type: 'row' },
      children: [],
    },
  ],
};

@Component({
  selector: 'test-sortable-tree-item',
  imports: [MlvTile, MlvTiles, forwardRef(() => SortableTreeItem)],
  template: `
    @let current = tile();
    <mlv-tile
      [tile]="current"
      [ariaLabel]="current.props.title"
      [dragDisabled]="disabledId() === current.id"
    >
      <strong>{{ current.props.title }}</strong>
      <button class="test-tile-action" type="button">Action</button>
      @if (current.acceptsChildren) {
        <mlv-tiles>
          @for (child of current.children; track child.id) {
            <test-sortable-tree-item
              [tile]="child"
              [disabledId]="disabledId()"
            />
          }
        </mlv-tiles>
      }
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SortableTreeItem {
  readonly tile = input.required<MlvTileTreeNode<TestProps>>();
  readonly disabledId = input<string | undefined>();
}

@Component({
  imports: [MlvTiles, SortableTreeItem],
  template: `
    <mlv-tiles [(tree)]="tree" layout="grid" [accepts]="accepts">
      @for (item of tree().children; track item.id) {
        <test-sortable-tree-item [tile]="item" [disabledId]="disabledId()" />
      }
    </mlv-tiles>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SortableTreeHost {
  readonly tree = signal(testRoot);
  readonly rejectedTargetId = signal<string | undefined>(undefined);
  readonly rejectedTargetIds = signal<readonly string[]>([]);
  readonly disabledId = signal<string | undefined>(undefined);
  readonly accepts: MlvTilesAccepts<TestProps> = (_dragged, target) =>
    target.id !== this.rejectedTargetId() &&
    !this.rejectedTargetIds().includes(target.id);
}

interface RenderedContainer {
  readonly component: MlvTiles<TestProps>;
  readonly element: HTMLElement;
  readonly sortable: Sortable;
}

interface DropOptions {
  readonly sourceId: string;
  readonly targetId: string;
  readonly tileId: string;
  readonly oldIndex: number;
  readonly newIndex: number;
}

function allIds(root: MlvTileNodeWithChildren<TestProps>): readonly string[] {
  const result: string[] = [];
  const visit = (node: MlvTileTreeNode<TestProps>): void => {
    result.push(node.id);
    if (node.acceptsChildren) node.children.forEach(visit);
  };
  visit(root);
  return result.sort();
}

function renderedIds(
  fixture: ComponentFixture<SortableTreeHost>,
): readonly string[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll<HTMLElement>(
      '.mlv-tiles__item-root[data-mlv-tile-id]',
    ),
  )
    .map((item) => item.dataset['mlvTileId'] ?? '')
    .sort();
}

function directRenderedIds(container: HTMLElement): readonly string[] {
  return Array.from(container.children)
    .filter(
      (candidate): candidate is HTMLElement =>
        candidate instanceof HTMLElement &&
        candidate.classList.contains('mlv-tiles__item-root'),
    )
    .map((item) => item.dataset['mlvTileId'] ?? '');
}

function containerNode(
  root: MlvTileNodeWithChildren<TestProps>,
  id: string,
): MlvTileNodeWithChildren<TestProps> {
  const pending: MlvTileTreeNode<TestProps>[] = [root];
  while (pending.length > 0) {
    const node = pending.shift();
    if (node?.id === id && node.acceptsChildren) return node;
    if (node?.acceptsChildren) pending.push(...node.children);
  }
  throw new Error(`Expected container ${id}`);
}

function renderedContainer(
  fixture: ComponentFixture<SortableTreeHost>,
  id: string,
): RenderedContainer {
  const debugElement = fixture.debugElement
    .queryAll(By.directive(MlvTiles))
    .find(
      (candidate) =>
        (candidate.componentInstance as MlvTiles<TestProps>).targetId() === id,
    );
  if (!debugElement) throw new Error(`Expected rendered container ${id}`);
  const element = debugElement.nativeElement as HTMLElement;
  const sortable = Sortable.get(element);
  if (!sortable) throw new Error(`Expected Sortable instance for ${id}`);
  return {
    component: debugElement.componentInstance as MlvTiles<TestProps>,
    element,
    sortable,
  };
}

function renderedItem(container: HTMLElement, id: string): HTMLElement {
  const item = Array.from(container.children).find(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement &&
      candidate.dataset['mlvTileId'] === id &&
      candidate.classList.contains('mlv-tiles__item-root'),
  );
  if (!item) throw new Error(`Expected rendered item ${id}`);
  return item;
}

function renderedHandle(container: HTMLElement, id: string): HTMLButtonElement {
  const handle = renderedItem(container, id).querySelector<HTMLButtonElement>(
    '.mlv-tile__drag-handle',
  );
  if (!handle) throw new Error(`Expected rendered handle ${id}`);
  return handle;
}

async function keyboardMove(
  fixture: ComponentFixture<SortableTreeHost>,
  containerId: string,
  tileId: string,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
): Promise<KeyboardEvent> {
  const handle = renderedHandle(
    renderedContainer(fixture, containerId).element,
    tileId,
  );
  handle.focus();
  const event = new KeyboardEvent('keydown', {
    altKey: true,
    bubbles: true,
    cancelable: true,
    key,
  });
  handle.dispatchEvent(event);
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  fixture.detectChanges();
  return event;
}

function sortableEvent(
  item: HTMLElement,
  from: HTMLElement,
  to: HTMLElement,
  oldIndex: number,
  newIndex: number,
): Sortable.SortableEvent {
  return {
    item,
    items: [],
    clone: item.cloneNode(true) as HTMLElement,
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

function insertAtDraggableIndex(
  target: HTMLElement,
  item: HTMLElement,
  index: number,
): void {
  const items = Array.from(target.children).filter(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement &&
      candidate !== item &&
      candidate.classList.contains('mlv-tiles__item-root'),
  );
  const reference =
    items[index] ??
    Array.from(target.children).find(
      (candidate) =>
        candidate !== item &&
        !candidate.classList.contains('mlv-tiles__item-root'),
    ) ??
    null;
  target.insertBefore(item, reference);
}

function startSortableDrop(
  fixture: ComponentFixture<SortableTreeHost>,
  options: DropOptions,
): {
  readonly source: RenderedContainer;
  readonly target: RenderedContainer;
  readonly item: HTMLElement;
  readonly event: Sortable.SortableEvent;
} {
  const source = renderedContainer(fixture, options.sourceId);
  const target = renderedContainer(fixture, options.targetId);
  const item = renderedItem(source.element, options.tileId);
  const event = sortableEvent(
    item,
    source.element,
    target.element,
    options.oldIndex,
    options.newIndex,
  );
  source.sortable.options.onStart?.(event);
  return { source, target, item, event };
}

async function finishSortableDrop(
  fixture: ComponentFixture<SortableTreeHost>,
  options: DropOptions,
): Promise<{
  readonly source: RenderedContainer;
  readonly target: RenderedContainer;
  readonly item: HTMLElement;
}> {
  const { source, target, item, event } = startSortableDrop(fixture, options);
  insertAtDraggableIndex(target.element, item, options.newIndex);
  source.sortable.options.onEnd?.(event);
  fixture.detectChanges();
  await fixture.whenStable();
  return { source, target, item };
}

function moveAllowed(
  source: RenderedContainer,
  target: RenderedContainer,
  item: HTMLElement,
  hit: HTMLElement,
): boolean | -1 | 1 | void {
  const event = {
    dragged: item,
    draggedRect: item.getBoundingClientRect(),
    from: source.element,
    related: hit,
    relatedRect: hit.getBoundingClientRect(),
    to: target.element,
    type: 'move',
  } as Sortable.MoveEvent;
  const originalEvent = {
    target: hit,
    composedPath: () => [hit, target.element, document.body, document],
  } as unknown as Event;
  return source.sortable.options.onMove?.(event, originalEvent);
}

describe('MlvTiles SortableJS engine', () => {
  async function createFixture(): Promise<ComponentFixture<SortableTreeHost>> {
    await TestBed.configureTestingModule({
      imports: [SortableTreeHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SortableTreeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('configures one Sortable per recursive Angular container with library-owned mechanics', async () => {
    const fixture = await createFixture();
    const page = renderedContainer(fixture, 'page');
    const header = renderedContainer(fixture, 'header');

    expect(page.sortable).toBeTruthy();
    expect(header.sortable).toBeTruthy();
    expect(page.sortable).not.toBe(header.sortable);
    expect(page.sortable.options.draggable).toBe('.mlv-tiles__item-root');
    expect(page.sortable.options.handle).toBe('.mlv-tile__drag-handle');
    expect(page.sortable.options.filter).toBe(
      '[data-mlv-tile-drag-disabled="true"]',
    );
    expect(page.sortable.options.preventOnFilter).toBe(false);
    expect(page.sortable.options.forceFallback).toBe(true);
    expect(page.sortable.options.fallbackOnBody).toBe(true);
    // Handle-gated dragging leaves no click-vs-drag ambiguity for a movement
    // tolerance to resolve, so the fallback engine starts the drag on the
    // very first pointer move rather than waiting out a dead few-pixel delay.
    expect(page.sortable.options.fallbackTolerance).toBe(0);
    expect(page.sortable.options.scroll).toBe(true);
    expect(page.sortable.options.dragoverBubble).toBe(false);
    expect(page.sortable.options.ghostClass).toBe('mlv-tiles__sortable-ghost');
    expect(page.sortable.options.fallbackClass).toBe(
      'mlv-tiles__sortable-fallback',
    );
    expect((page.sortable.options.group as Sortable.GroupOptions).name).toBe(
      (header.sortable.options.group as Sortable.GroupOptions).name,
    );
    const source = renderedItem(header.element, 'launch');
    source.id = 'source-wrapper';
    const sourceChild = source.querySelector('mlv-tile') as HTMLElement;
    sourceChild.id = 'source-tile';
    const clone = source.cloneNode(true) as HTMLElement;
    page.sortable.options.onClone?.({
      ...sortableEvent(source, header.element, header.element, 0, 0),
      clone,
    });
    expect(clone.getAttribute('aria-hidden')).toBe('true');
    expect(clone.hasAttribute('inert')).toBe(true);
    expect(clone.querySelector('[id]')).toBeNull();
  });

  it('offers discoverable keyboard reorder, outdent, indent, announcements, and focus restoration', async () => {
    const fixture = await createFixture();
    const page = renderedContainer(fixture, 'page');
    const launchHandle = renderedHandle(
      renderedContainer(fixture, 'header').element,
      'launch',
    );
    const describedBy = launchHandle.getAttribute('aria-describedby');

    expect(launchHandle.tagName).toBe('BUTTON');
    expect(launchHandle.getAttribute('aria-label')).toBe('Move Launch');
    expect(launchHandle.getAttribute('aria-keyshortcuts')).toBe(
      'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight',
    );
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')?.textContent).toContain(
      'Alt+ArrowUp and Alt+ArrowDown to reorder',
    );
    const status = page.element.querySelector(
      ':scope > .mlv-tiles__keyboard-status',
    ) as HTMLElement;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');

    const down = await keyboardMove(fixture, 'header', 'launch', 'ArrowDown');
    expect(down.defaultPrevented).toBe(true);
    expect(
      containerNode(fixture.componentInstance.tree(), 'header').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['introduction', 'launch']);
    expect(status.textContent).toContain('Moved Launch down');
    expect(document.activeElement).toBe(
      renderedHandle(renderedContainer(fixture, 'header').element, 'launch'),
    );

    await keyboardMove(fixture, 'header', 'launch', 'ArrowUp');
    expect(
      containerNode(fixture.componentInstance.tree(), 'header').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['launch', 'introduction']);
    expect(status.textContent).toContain('Moved Launch up');
    expect(document.activeElement).toBe(
      renderedHandle(renderedContainer(fixture, 'header').element, 'launch'),
    );

    await keyboardMove(fixture, 'header', 'launch', 'ArrowLeft');
    expect(
      fixture.componentInstance.tree().children.map(({ id }) => id),
    ).toEqual(['header', 'launch', 'content', 'empty']);
    expect(status.textContent).toContain('Moved Launch out one level');
    expect(document.activeElement).toBe(renderedHandle(page.element, 'launch'));

    await keyboardMove(fixture, 'page', 'launch', 'ArrowRight');
    expect(
      containerNode(fixture.componentInstance.tree(), 'header').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['introduction', 'launch']);
    expect(status.textContent).toContain(
      'Moved Launch into the nearest eligible container',
    );
    expect(document.activeElement).toBe(
      renderedHandle(renderedContainer(fixture, 'header').element, 'launch'),
    );
  });

  it('indents into the nearest following container when no preceding sibling qualifies', async () => {
    const fixture = await createFixture();
    const page = renderedContainer(fixture, 'page');
    const status = page.element.querySelector(
      ':scope > .mlv-tiles__keyboard-status',
    ) as HTMLElement;

    // `header` is the first child of `page`, so only a forward scan can find an
    // eligible sibling container.
    const indented = await keyboardMove(
      fixture,
      'page',
      'header',
      'ArrowRight',
    );

    expect(indented.defaultPrevented).toBe(true);
    expect(
      fixture.componentInstance.tree().children.map(({ id }) => id),
    ).toEqual(['content', 'empty']);
    expect(
      containerNode(fixture.componentInstance.tree(), 'content').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['media', 'header']);
    expect(status.textContent).toContain(
      'Moved Header into the nearest eligible container',
    );
    expect(document.activeElement).toBe(
      renderedHandle(renderedContainer(fixture, 'content').element, 'header'),
    );
  });

  it('skips a rejected preceding sibling and lands in the following eligible container', async () => {
    const fixture = await createFixture();
    await keyboardMove(fixture, 'header', 'launch', 'ArrowLeft');
    fixture.componentInstance.rejectedTargetId.set('header');
    fixture.detectChanges();

    await keyboardMove(fixture, 'page', 'launch', 'ArrowRight');

    expect(
      containerNode(fixture.componentInstance.tree(), 'header').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['introduction']);
    expect(
      containerNode(fixture.componentInstance.tree(), 'content').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['media', 'launch']);
  });

  it('announces cached policy and structural keyboard rejection without moving', async () => {
    const fixture = await createFixture();
    await keyboardMove(fixture, 'header', 'launch', 'ArrowLeft');
    fixture.componentInstance.rejectedTargetIds.set([
      'header',
      'content',
      'empty',
    ]);
    fixture.detectChanges();
    const before = fixture.componentInstance.tree();
    const rejected = await keyboardMove(
      fixture,
      'page',
      'launch',
      'ArrowRight',
    );
    const status = renderedContainer(fixture, 'page').element.querySelector(
      ':scope > .mlv-tiles__keyboard-status',
    ) as HTMLElement;

    expect(rejected.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.tree()).toBe(before);
    expect(status.textContent).toContain(
      'Launch cannot move in that direction',
    );
    expect(document.activeElement).toBe(
      renderedHandle(renderedContainer(fixture, 'page').element, 'launch'),
    );
  });

  it('lets filtered descendants keep ordinary pointer focus and activation', async () => {
    const fixture = await createFixture();
    fixture.componentInstance.disabledId.set('launch');
    fixture.detectChanges();
    await fixture.whenStable();
    const header = renderedContainer(fixture, 'header');
    const launch = renderedItem(header.element, 'launch');
    expect(renderedHandle(header.element, 'launch').disabled).toBe(true);
    const action = launch.querySelector<HTMLButtonElement>('.test-tile-action');
    if (!action) throw new Error('Expected descendant action');
    const activated = vi.fn();
    action.addEventListener('click', activated);
    action.focus();
    const eventName = header.sortable.options.supportPointer
      ? 'pointerdown'
      : 'mousedown';
    const down = new MouseEvent(eventName, {
      bubbles: true,
      cancelable: true,
    });

    action.dispatchEvent(down);
    action.click();

    expect(down.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(action);
    expect(activated).toHaveBeenCalledTimes(1);
    expect(header.component.coordinator.activeSession()).toBeNull();
  });

  it('auto-detects the active grid axis and owns the sibling FLIP transition', async () => {
    const fixture = await createFixture();
    const header = renderedContainer(fixture, 'header');
    const launch = renderedItem(header.element, 'launch');
    const introduction = renderedItem(header.element, 'introduction');
    const direction = header.sortable.options.direction;

    expect(direction).toEqual(expect.any(Function));
    header.element.style.display = 'grid';
    header.element.style.gridTemplateColumns = '320px';
    expect(
      (
        direction as Exclude<Sortable.Options['direction'], string | undefined>
      ).call(
        header.sortable,
        sortableEvent(launch, header.element, header.element, 0, 0),
        introduction,
        launch,
      ),
    ).toBe('vertical');
    header.element.style.gridTemplateColumns = '160px 160px';
    expect(
      (
        direction as Exclude<Sortable.Options['direction'], string | undefined>
      ).call(
        header.sortable,
        sortableEvent(launch, header.element, header.element, 0, 0),
        introduction,
        launch,
      ),
    ).toBe('horizontal');

    let introductionTop = 100;
    vi.spyOn(launch, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          right: 320,
          bottom: 80,
          width: 320,
          height: 80,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    vi.spyOn(introduction, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: introductionTop,
          right: 320,
          bottom: introductionTop + 80,
          width: 320,
          height: 80,
          x: 0,
          y: introductionTop,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    const inverseTransforms: string[] = [];
    Object.defineProperty(introduction, 'offsetWidth', {
      configurable: true,
      get: () => {
        inverseTransforms.push(introduction.style.transform);
        return 320;
      },
    });

    header.sortable.captureAnimationState();
    introductionTop = 0;
    header.sortable.animateAll();

    expect(inverseTransforms).toContain('translate3d(0px,100px,0)');
    expect(introduction.style.transition).toBe(
      'transform 200ms var(--mlv-ease-in-out-strong)',
    );
  });

  it('sanitizes the pointer-following fallback clone before interaction', async () => {
    const fixture = await createFixture();
    const header = renderedContainer(fixture, 'header');
    const launch = renderedItem(header.element, 'launch');
    const fallback = launch.cloneNode(true) as HTMLElement;
    fallback.id = 'fallback-wrapper';
    const nestedContent = fallback.querySelector('strong') as HTMLElement;
    nestedContent.id = 'fallback-content';
    const sortableWithWritableGhost = Sortable as unknown as {
      ghost: HTMLElement | null;
    };
    const originalGhost = sortableWithWritableGhost.ghost;

    try {
      sortableWithWritableGhost.ghost = fallback;
      header.sortable.options.onStart?.(
        sortableEvent(launch, header.element, header.element, 0, 0),
      );

      expect(fallback.getAttribute('aria-hidden')).toBe('true');
      expect(fallback.hasAttribute('inert')).toBe(true);
      expect(fallback.querySelector('[id]')).toBeNull();
    } finally {
      sortableWithWritableGhost.ghost = originalGhost;
    }
  });

  it('neutralizes consumer animations on the pointer-following fallback clone', async () => {
    // A consumer entrance animation that keeps `transform` (fill-mode both, or
    // simply still running on the fresh clone) outranks the inline transform the
    // engine writes each pointer move, because CSS animations beat inline styles
    // in the cascade. The engine then reads its own transform back as identity
    // and the clone never accumulates the drag offset.
    const fixture = await createFixture();
    const header = renderedContainer(fixture, 'header');
    const launch = renderedItem(header.element, 'launch');
    const fallback = launch.cloneNode(true) as HTMLElement;
    fallback.style.animation = 'consumer-enter 200ms ease both';
    const sortableWithWritableGhost = Sortable as unknown as {
      ghost: HTMLElement | null;
    };
    const originalGhost = sortableWithWritableGhost.ghost;

    try {
      sortableWithWritableGhost.ghost = fallback;
      header.sortable.options.onStart?.(
        sortableEvent(launch, header.element, header.element, 0, 0),
      );

      expect(fallback.style.animation).toBe('none');
    } finally {
      sortableWithWritableGhost.ghost = originalGhost;
    }
  });

  it('restores the exact Angular wrapper anchor before a same-parent forward model write', async () => {
    const fixture = await createFixture();
    const rootTiles = renderedContainer(fixture, 'page').component;
    const moved: MlvTileMovedEvent[] = [];
    rootTiles.moved.subscribe((event) => moved.push(event));
    const header = renderedContainer(fixture, 'header');
    const launchWrapper = renderedItem(header.element, 'launch');
    const introductionWrapper = renderedItem(header.element, 'introduction');
    const options = {
      sourceId: 'header',
      targetId: 'header',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 1,
    } as const;
    const { source, target, item, event } = startSortableDrop(fixture, options);
    item.classList.add(
      'mlv-tiles__sortable-chosen',
      'mlv-tiles__sortable-ghost',
    );
    item.style.transform = 'translate3d(0, 80px, 0)';
    insertAtDraggableIndex(target.element, item, options.newIndex);
    source.sortable.options.onEnd?.(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      containerNode(fixture.componentInstance.tree(), 'header').children,
    ).toEqual([
      expect.objectContaining({ id: 'introduction' }),
      expect.objectContaining({ id: 'launch' }),
    ]);
    expect(moved).toEqual([
      {
        tileId: 'launch',
        sourceContainerId: 'header',
        targetContainerId: 'header',
        previousIndex: 0,
        currentIndex: 1,
      },
    ]);
    const settled = renderedContainer(fixture, 'header').element;
    expect(
      Array.from(settled.children).filter((child) =>
        child.classList.contains('mlv-tiles__item-root'),
      ),
    ).toEqual([introductionWrapper, launchWrapper]);
    expect(launchWrapper.isConnected).toBe(true);
    expect(launchWrapper.classList).not.toContain('mlv-tiles__sortable-chosen');
    expect(launchWrapper.classList).not.toContain('mlv-tiles__sortable-ghost');
    expect(launchWrapper.style.transform).toBe('');
    expect(allIds(fixture.componentInstance.tree())).toEqual(allIds(testRoot));
  });

  it('normalizes reverse and three-item same-source indices without node loss', async () => {
    const fixture = await createFixture();

    await finishSortableDrop(fixture, {
      sourceId: 'header',
      targetId: 'header',
      tileId: 'introduction',
      oldIndex: 1,
      newIndex: 0,
    });
    await finishSortableDrop(fixture, {
      sourceId: 'page',
      targetId: 'page',
      tileId: 'header',
      oldIndex: 0,
      newIndex: 2,
    });

    expect(
      containerNode(fixture.componentInstance.tree(), 'header').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['introduction', 'launch']);
    expect(
      fixture.componentInstance.tree().children.map(({ id }) => id),
    ).toEqual(['content', 'empty', 'header']);
    expect(allIds(fixture.componentInstance.tree())).toEqual(allIds(testRoot));
  });

  it('moves across nested levels and into an empty target using stable IDs', async () => {
    const fixture = await createFixture();

    await finishSortableDrop(fixture, {
      sourceId: 'header',
      targetId: 'media',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 1,
    });
    await finishSortableDrop(fixture, {
      sourceId: 'media',
      targetId: 'empty',
      tileId: 'launch',
      oldIndex: 1,
      newIndex: 0,
    });

    expect(
      containerNode(fixture.componentInstance.tree(), 'header').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['introduction']);
    expect(
      containerNode(fixture.componentInstance.tree(), 'media').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['image', 'shop']);
    expect(
      containerNode(fixture.componentInstance.tree(), 'empty').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['launch']);
    expect(allIds(fixture.componentInstance.tree())).toEqual(allIds(testRoot));
  });

  it('keeps cached rejection authoritative for the deepest nested target', async () => {
    const fixture = await createFixture();
    fixture.componentInstance.rejectedTargetId.set('media');
    fixture.detectChanges();
    const initialTree = fixture.componentInstance.tree();
    const { source, item } = startSortableDrop(fixture, {
      sourceId: 'header',
      targetId: 'media',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 1,
    });
    const media = renderedContainer(fixture, 'media');
    const content = renderedContainer(fixture, 'content');
    fixture.componentInstance.rejectedTargetId.set(undefined);
    fixture.detectChanges();

    expect(moveAllowed(source, media, item, media.element)).toBe(false);
    expect(moveAllowed(source, content, item, media.element)).toBe(false);
    insertAtDraggableIndex(media.element, item, 1);
    source.sortable.options.onEnd?.(
      sortableEvent(item, source.element, media.element, 0, 1),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.tree()).toBe(initialTree);
    expect(
      renderedItem(renderedContainer(fixture, 'header').element, 'launch'),
    ).toBe(item);
    expect(allIds(fixture.componentInstance.tree())).toEqual(allIds(testRoot));
  });

  it('treats an away-and-back original index as a no-op and commits only once', async () => {
    const fixture = await createFixture();
    const initialTree = fixture.componentInstance.tree();
    const rootTiles = renderedContainer(fixture, 'page').component;
    const moved = vi.fn();
    rootTiles.moved.subscribe(moved);
    const { source, item } = startSortableDrop(fixture, {
      sourceId: 'header',
      targetId: 'header',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 0,
    });
    insertAtDraggableIndex(source.element, item, 1);
    insertAtDraggableIndex(source.element, item, 0);
    const end = sortableEvent(item, source.element, source.element, 0, 0);
    source.sortable.options.onEnd?.(end);
    source.sortable.options.onEnd?.(end);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.tree()).toBe(initialTree);
    expect(moved).not.toHaveBeenCalled();
    expect(
      containerNode(fixture.componentInstance.tree(), 'header').children.map(
        ({ id }) => id,
      ),
    ).toEqual(['launch', 'introduction']);
  });

  it('restores a connected cross-container wrapper before rejecting a props-stale model commit', async () => {
    const fixture = await createFixture();
    const page = renderedContainer(fixture, 'page');
    const moved = vi.fn();
    page.component.moved.subscribe(moved);
    const { source, target, item, event } = startSortableDrop(fixture, {
      sourceId: 'header',
      targetId: 'empty',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 0,
    });
    insertAtDraggableIndex(target.element, item, 0);
    const initial = fixture.componentInstance.tree();
    const propsUpdatedRoot: MlvTileNodeWithChildren<TestProps> = {
      ...initial,
      props: { ...initial.props, title: 'Updated page' },
    };
    fixture.componentInstance.tree.set(propsUpdatedRoot);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(item.isConnected).toBe(true);
    expect(item.parentElement).toBe(target.element);
    source.sortable.options.onEnd?.(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(item.isConnected).toBe(true);
    expect(item.parentElement).toBe(source.element);
    expect(directRenderedIds(source.element)).toEqual([
      'launch',
      'introduction',
    ]);
    expect(directRenderedIds(target.element)).toEqual([]);
    expect(fixture.componentInstance.tree()).toBe(propsUpdatedRoot);
    expect(fixture.componentInstance.tree().props.title).toBe('Updated page');
    expect(moved).not.toHaveBeenCalled();
    expect(source.component.coordinator.activeSession()).toBeNull();
  });

  it('does not reattach a wrapper removed externally during an active drag', async () => {
    const fixture = await createFixture();
    const { source, item, event } = startSortableDrop(fixture, {
      sourceId: 'header',
      targetId: 'header',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 1,
    });
    item.classList.add(
      'mlv-tiles__sortable-chosen',
      'mlv-tiles__sortable-drag',
      'mlv-tiles__sortable-ghost',
    );
    item.setAttribute('style', 'transform: translate3d(1px, 2px, 0)');
    item.setAttribute('draggable', 'false');
    const initial = fixture.componentInstance.tree();
    const header = containerNode(initial, 'header');
    const removedRoot: MlvTileNodeWithChildren<TestProps> = {
      ...initial,
      children: initial.children.map((child) =>
        child.id === 'header'
          ? {
              ...header,
              children: header.children.filter(({ id }) => id !== 'launch'),
            }
          : child,
      ),
    };
    fixture.componentInstance.tree.set(removedRoot);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(item.isConnected).toBe(false);
    source.sortable.options.onEnd?.(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(item.isConnected).toBe(false);
    expect(item.className).not.toContain('mlv-tiles__sortable');
    expect(item.hasAttribute('style')).toBe(false);
    expect(item.hasAttribute('draggable')).toBe(false);
    expect(fixture.componentInstance.tree()).toBe(removedRoot);
    expect(renderedIds(fixture)).toEqual(
      allIds(removedRoot).filter((id) => id !== removedRoot.id),
    );
    expect(source.component.coordinator.activeSession()).toBeNull();
  });

  it('does not reattach a stale wrapper after external relocation', async () => {
    const fixture = await createFixture();
    const { source, item, event } = startSortableDrop(fixture, {
      sourceId: 'header',
      targetId: 'header',
      tileId: 'launch',
      oldIndex: 0,
      newIndex: 1,
    });
    item.classList.add(
      'mlv-tiles__sortable-chosen',
      'mlv-tiles__sortable-fallback',
    );
    item.setAttribute('style', 'transform: translate3d(1px, 2px, 0)');
    item.setAttribute('draggable', 'false');
    const initial = fixture.componentInstance.tree();
    const header = containerNode(initial, 'header');
    const empty = containerNode(initial, 'empty');
    const launch = header.children.find(({ id }) => id === 'launch');
    if (!launch) throw new Error('Expected launch');
    const relocatedRoot: MlvTileNodeWithChildren<TestProps> = {
      ...initial,
      children: initial.children.map((child) => {
        if (child.id === 'header') {
          return {
            ...header,
            children: header.children.filter(({ id }) => id !== 'launch'),
          };
        }
        if (child.id === 'empty') {
          return { ...empty, children: [launch] };
        }
        return child;
      }),
    };
    fixture.componentInstance.tree.set(relocatedRoot);
    fixture.detectChanges();
    await fixture.whenStable();
    const relocatedWrapper = renderedItem(
      renderedContainer(fixture, 'empty').element,
      'launch',
    );

    expect(item.isConnected).toBe(false);
    expect(relocatedWrapper).not.toBe(item);
    source.sortable.options.onEnd?.(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(item.isConnected).toBe(false);
    expect(item.className).not.toContain('mlv-tiles__sortable');
    expect(item.hasAttribute('style')).toBe(false);
    expect(item.hasAttribute('draggable')).toBe(false);
    expect(relocatedWrapper.isConnected).toBe(true);
    expect(fixture.componentInstance.tree()).toBe(relocatedRoot);
    expect(renderedIds(fixture)).toEqual(
      allIds(relocatedRoot).filter((id) => id !== relocatedRoot.id),
    );
    expect(source.component.coordinator.activeSession()).toBeNull();
  });

  it('marks disabled wrappers, destroys Sortable instances, and clears an active session', async () => {
    const fixture = await createFixture();
    fixture.componentInstance.disabledId.set('launch');
    fixture.detectChanges();
    await fixture.whenStable();
    const header = renderedContainer(fixture, 'header');
    const launch = renderedItem(header.element, 'launch');
    const sortable = header.sortable;

    expect(launch.dataset['mlvTileDragDisabled']).toBe('true');
    fixture.componentInstance.disabledId.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(launch.hasAttribute('data-mlv-tile-drag-disabled')).toBe(false);

    sortable.options.onStart?.(
      sortableEvent(launch, header.element, header.element, 0, 0),
    );
    expect(header.component.coordinator.activeSession()?.draggedTile.id).toBe(
      'launch',
    );
    const host = header.element;
    fixture.destroy();

    expect(Sortable.get(host)).toBeNull();
    expect(header.component.coordinator.activeSession()).toBeNull();
  });
});
