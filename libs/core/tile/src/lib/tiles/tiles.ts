import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewEncapsulation,
  computed,
  contentChild,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  type AfterViewInit,
  type OnChanges,
  type OnInit,
  type Signal,
  type SimpleChanges,
  type WritableSignal,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import Sortable from 'sortablejs';
import { MLV_TILE_I18N, MlvI18nResolverService } from '@malva-ui/i18n';

import {
  MlvTileTreeCoordinator,
  type MlvTileContainerRegistration,
  type MlvTileItemRegistration,
  type MlvTileKeyboardMoveDirection,
} from '../tile-tree-coordinator';
import {
  MLV_TILE_ITEM_CONTEXT,
  type MlvTileItemContext,
} from '../tile-item-context';
import { MLV_TILE_LOCKED } from '../tile-locked-context';
import { MlvTilesEmpty } from '../tiles-empty';
import type {
  MlvTileMovedEvent,
  MlvTileNodeWithChildren,
  MlvTileTreeNode,
  MlvTilesAccepts,
  MlvTilesLayout,
} from '../tile-tree.types';

export type MlvTilesDropState = 'idle' | 'valid' | 'invalid';

const ITEM_ROOT_CLASS = 'mlv-tiles__item-root';
const ITEM_ID_ATTRIBUTE = 'data-mlv-tile-id';
const ITEM_DISABLED_ATTRIBUTE = 'data-mlv-tile-drag-disabled';
const SORTABLE_CHOSEN_CLASS = 'mlv-tiles__sortable-chosen';
const SORTABLE_DRAG_CLASS = 'mlv-tiles__sortable-drag';
const SORTABLE_FALLBACK_CLASS = 'mlv-tiles__sortable-fallback';
const SORTABLE_GHOST_CLASS = 'mlv-tiles__sortable-ghost';
const SORTABLE_ANIMATION_MS = 200;

let nextGroupId = 0;
const tilesByHost = new WeakMap<HTMLElement, MlvTiles<unknown>>();

interface MlvSortableDrag<TProps> {
  readonly tileId: string;
  readonly source: MlvTiles<TProps>;
  readonly sourceElement: HTMLElement;
  readonly item: HTMLElement;
  readonly nextSibling: ChildNode | null;
  readonly previousIndex: number;
  readonly originalStyle: string | null;
  readonly originalDraggable: string | null;
  readonly registration: MlvTileItemRegistration<TProps>;
  readonly sessionRoot: MlvTileNodeWithChildren<TProps>;
}

@Component({
  selector: 'mlv-tiles',
  imports: [NgTemplateOutlet],
  templateUrl: './tiles.html',
  styleUrl: './tiles.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_TILE_LOCKED,
      useFactory: (tiles: MlvTiles<unknown>): Signal<boolean> =>
        tiles.lockedState,
      deps: [forwardRef(() => MlvTiles)],
    },
  ],
  host: {
    class: 'mlv-tiles',
    '[class.mlv-tiles--layout-list]': 'layout() === "list"',
    '[class.mlv-tiles--grid]': 'layout() === "grid"',
    '[class.mlv-tiles--valid]': 'dropState() === "valid"',
    '[class.mlv-tiles--invalid]': 'dropState() === "invalid"',
    '[class.mlv-tiles--sorting]': 'dropState() !== "idle"',
    '[class.mlv-tiles--locked]': 'lockedState()',
    '[class.mlv-tiles--nested]': 'depth > 0',
    '[style.--mlv-tiles-depth]': 'depth',
    '[attr.data-mlv-tiles-id]': 'targetId()',
  },
})
export class MlvTiles<TProps> implements OnChanges, OnInit, AfterViewInit {
  /** Root-owned immutable tree. Nested containers inherit this binding. */
  readonly tree = model<MlvTileNodeWithChildren<TProps> | undefined>();

  /** Controls the projected tile layout. */
  readonly layout = input<MlvTilesLayout>('list');

  /** Optionally overrides the inherited acceptance policy for this subtree. */
  readonly accepts = input<MlvTilesAccepts<TProps> | undefined>();

  /**
   * Freezes this container and its entire subtree: no tile can be dropped in,
   * no descendant tile can be picked up, and built-in structural affordances
   * are withdrawn. Cascades to nested `mlv-tiles` and `mlv-tile`. Evaluated
   * before `accepts`, so an acceptance policy cannot re-open a locked target.
   */
  readonly locked = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Overrides the localized empty-target prompt with a plain string. A
   * projected `[mlvTilesEmpty]` template takes precedence over this input.
   */
  readonly emptyLabel = input<string | undefined>(undefined);

  /** Emits after the root tree has been replaced by a successful move. */
  readonly moved = output<MlvTileMovedEvent>();

  /** Current cached acceptance state for this rendered target. */
  readonly dropState = signal<MlvTilesDropState>('idle');

  /** @protected Consumer-owned empty state projected via `[mlvTilesEmpty]`. */
  protected readonly emptyRef = contentChild(MlvTilesEmpty);

  private readonly _parentTiles = inject(MlvTiles, {
    optional: true,
    skipSelf: true,
  }) as MlvTiles<TProps> | null;

  /** @private Closest enclosing lock, published by a tile or outer container. */
  private readonly _inheritedLocked = inject(MLV_TILE_LOCKED, {
    optional: true,
    skipSelf: true,
  });

  /**
   * @internal Resolved lock for this level, inherited state included. Published
   * through `MLV_TILE_LOCKED` so every descendant container and tile sees it.
   */
  readonly lockedState: Signal<boolean> = computed(
    () => this._inheritedLocked?.() === true || this.locked(),
  );

  private readonly _itemContext = inject(MLV_TILE_ITEM_CONTEXT, {
    optional: true,
  }) as MlvTileItemContext<TProps> | null;
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _elementRef = inject(ElementRef<HTMLElement>);
  private readonly _ngZone = inject(NgZone);
  private readonly _platformId = inject(PLATFORM_ID);
  /** @protected Localized keyboard instructions rendered by the root list. */
  protected readonly _i18n = inject(MLV_TILE_I18N);
  private readonly _i18nResolver = inject(MlvI18nResolverService);
  private readonly _rootTiles: MlvTiles<TProps> =
    this._parentTiles?._rootTiles ?? this;
  private readonly _groupName: string =
    this._parentTiles?._groupName ?? `mlv-tiles-${nextGroupId++}`;
  /** @protected Root-only assistive text is projected once per compound tree. */
  protected readonly _isRoot = this._parentTiles === null;
  /** @protected Polite keyboard movement feedback shared by nested lists. */
  protected readonly _keyboardAnnouncement: WritableSignal<string> =
    this._parentTiles?._keyboardAnnouncement ?? signal<string>('');
  private _announcementSequence = 0;
  private _sortable: Sortable | null = null;
  private _activeDrag: MlvSortableDrag<TProps> | null = null;

  /** @private Current container node represented by this rendered list. */
  private readonly _target = computed(() => {
    const target = this._parentTiles ? this._itemContext?.tile() : this.tree();
    return target?.acceptsChildren ? target : undefined;
  });

  /** @internal Shared root coordinator used by all nested containers. */
  readonly coordinator: MlvTileTreeCoordinator<TProps> =
    this._parentTiles?.coordinator ??
    new MlvTileTreeCoordinator<TProps>({
      isRoot: true,
      readRoot: () => this.tree(),
      setRoot: (root) => this.tree.set(root),
      moved: (event) => this.moved.emit(event),
    });

  /** @internal Compound nesting depth used for target registration order. */
  readonly depth: number = (this._parentTiles?.depth ?? -1) + 1;

  /** Stable target ID derived from the root or the enclosing item context. */
  readonly targetId = computed(() => this._target()?.id);

  /** Whether this target currently has no direct child tiles. */
  readonly isEmpty = computed(() => {
    const target = this._target();
    return target ? target.children.length === 0 : false;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (this._parentTiles && changes['tree']) {
      throw new Error('Nested mlv-tiles must inherit the root tree.');
    }
  }

  ngOnInit(): void {
    if (!this._parentTiles) this.coordinator.start();

    const id = this.targetId();
    if (id === undefined) {
      throw new Error(
        this._parentTiles
          ? 'Nested mlv-tiles requires an enclosing tile item.'
          : 'Root mlv-tiles requires [(tree)].',
      );
    }

    const readAccepts = (): MlvTilesAccepts<TProps> | undefined =>
      this.accepts();
    const registration: MlvTileContainerRegistration<TProps> = {
      id,
      depth: this.depth,
      get accepts() {
        return readAccepts();
      },
      locked: () => this.lockedState(),
      canEnter: (allowed) => {
        this.dropState.set(
          this.coordinator.activeSession()
            ? allowed
              ? 'valid'
              : 'invalid'
            : 'idle',
        );
      },
    };
    const unregister = this.coordinator.registerContainer(registration);
    this._destroyRef.onDestroy(unregister);
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this._platformId)) return;

    const host = this._elementRef.nativeElement;
    tilesByHost.set(host, this as MlvTiles<unknown>);
    this._ngZone.runOutsideAngular(() => {
      this._sortable = Sortable.create(host, this._sortableOptions());
    });
    this._destroyRef.onDestroy(() => {
      this._rootTiles._cancelActiveDrag();
      this._sortable?.destroy();
      this._sortable = null;
      tilesByHost.delete(host);
    });
  }

  /** @internal Resolves the direct consumer wrapper Sortable may animate. */
  resolveItemRoot(tileHost: HTMLElement): HTMLElement {
    const listHost = this._elementRef.nativeElement;
    let itemRoot = tileHost;
    while (itemRoot.parentElement && itemRoot.parentElement !== listHost) {
      itemRoot = itemRoot.parentElement;
    }

    return itemRoot.parentElement === listHost ? itemRoot : tileHost;
  }

  /**
   * Inserts a node into this container through the root-owned immutable tree.
   *
   * @param tile - Node to insert. Neither it nor any node in its subtree may
   *   reuse an ID that already exists in the tree.
   * @param index - Position among this container's direct children. Omitted
   *   appends; a non-integer, negative, or out-of-range index is rejected
   *   rather than clamped.
   * @returns `true` when the root tree was replaced, `false` on any rejection.
   *   Always `false` while this container is locked.
   */
  insert(tile: MlvTileTreeNode<TProps>, index?: number): boolean {
    const targetContainerId = this.targetId();
    if (targetContainerId === undefined) return false;

    if (this.lockedState()) {
      this._warnDev(
        'MlvTiles.insert() is disabled while the container is locked.',
      );
      return false;
    }

    return this.coordinator.insert({ targetContainerId, tile, index });
  }

  /**
   * Removes a registered item from this compound tree through the root-owned
   * immutable tree.
   *
   * @param tileId - Stable ID of the node to remove.
   * @returns `true` when the root tree was replaced, `false` on any rejection.
   *   Always `false` when the node — or the container holding it — is locked,
   *   so an unlocked container cannot reach into a locked subtree by ID.
   */
  remove(tileId: string): boolean {
    if (this.coordinator.isLocked(tileId)) {
      this._warnDev(
        'MlvTiles.remove() is disabled while the target subtree is locked.',
      );
      return false;
    }

    return this.coordinator.remove(tileId);
  }

  /** @internal Updates a registered item's props through the root immutable tree. */
  updateProps(tileId: string, update: (props: TProps) => TProps): void {
    this.coordinator.updateProps(tileId, update);
  }

  /** @internal Associates every tree handle with one discoverable instruction. */
  keyboardInstructionsId(): string {
    return `${this._groupName}-keyboard-instructions`;
  }

  /** @internal Executes and announces a stable-ID keyboard tree operation. */
  moveByKeyboard(
    tileId: string,
    direction: MlvTileKeyboardMoveDirection,
    label: string,
  ): void {
    const request = this.coordinator.moveByKeyboard(tileId, direction);
    const announcementKey = request
      ? direction === 'up'
        ? 'movedUp'
        : direction === 'down'
          ? 'movedDown'
          : direction === 'left'
            ? 'movedOut'
            : 'movedInto'
      : 'moveRejected';
    const announcement = this._i18nResolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      announcementKey,
      { label },
    );

    this._rootTiles._announceKeyboardMove(announcement);
    this._rootTiles._restoreKeyboardFocus(tileId);
  }

  private _sortableOptions(): Sortable.Options {
    return {
      animation: this._prefersReducedMotion() ? 0 : SORTABLE_ANIMATION_MS,
      chosenClass: SORTABLE_CHOSEN_CLASS,
      dragClass: SORTABLE_DRAG_CLASS,
      draggable: `.${ITEM_ROOT_CLASS}`,
      dragoverBubble: false,
      easing: 'var(--mlv-ease-in-out-strong)',
      fallbackClass: SORTABLE_FALLBACK_CLASS,
      fallbackOnBody: true,
      // Dragging is already gated to the dedicated `.mlv-tile__drag-handle`
      // grip (see `handle` below), which has no competing click action of its
      // own (grab-only; keyboard users move tiles with Alt+Arrow instead), so
      // there is no click-vs-drag ambiguity left for a movement tolerance to
      // resolve. `touch-action: none` on the handle (tile.scss) already stops
      // the browser treating a handle touch as a page scroll. A non-zero
      // tolerance here only added a dead-feeling few-pixel delay before every
      // drag start, so it drops to 0 — SortableJS's own library default.
      fallbackTolerance: 0,
      filter: `[${ITEM_DISABLED_ATTRIBUTE}="true"]`,
      preventOnFilter: false,
      forceFallback: true,
      ghostClass: SORTABLE_GHOST_CLASS,
      group: {
        name: this._groupName,
        pull: true,
        put: (_to, _from, item) => this._canReceive(item),
      },
      handle: '.mlv-tile__drag-handle',
      scroll: true,
      onClone: (event) => this._sanitizeClone(event.clone),
      onStart: (event) => this._startSortableDrag(event),
      onMove: (event, originalEvent) => this._canMove(event, originalEvent),
      onEnd: (event) => this._rootTiles._endSortableDrag(event),
    };
  }

  private _sanitizeClone(clone: HTMLElement): void {
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((element) => {
      element.removeAttribute('id');
    });
    // A CSS animation outranks an inline declaration, so any consumer entrance
    // animation on the item root would own `transform` on this clone and defeat
    // the inline transform the engine writes on every pointer move — the clone
    // would read its own offset back as identity and never follow the pointer.
    // The clone is a transient engine artifact; it never replays consumer
    // motion. Set inline so it also wins over a stylesheet `animation`.
    clone.style.animation = 'none';
  }

  private _startSortableDrag(event: Sortable.SortableEvent): void {
    const item = event.item;
    const tileId = item.getAttribute(ITEM_ID_ATTRIBUTE);
    if (
      tileId === null ||
      item.getAttribute(ITEM_DISABLED_ATTRIBUTE) === 'true'
    ) {
      return;
    }

    const fallbackClone = Sortable.ghost;
    if (fallbackClone && fallbackClone !== item) {
      this._sanitizeClone(fallbackClone);
    }

    this._rootTiles._cancelActiveDrag();
    const session = this._ngZone.run(() => this.coordinator.startDrag(tileId));
    const registration = this.coordinator.item(tileId);
    const sourceContainerId = session?.parentById.get(tileId);
    const previousIndex =
      event.oldDraggableIndex ?? this._draggableIndex(item, event.from);
    if (
      !session ||
      !registration ||
      sourceContainerId !== this.targetId() ||
      previousIndex < 0
    ) {
      this._ngZone.run(() => this.coordinator.endDrag());
      return;
    }

    this._rootTiles._activeDrag = {
      tileId,
      source: this,
      sourceElement: event.from,
      item,
      nextSibling: item.nextSibling,
      previousIndex,
      originalStyle: item.getAttribute('style'),
      originalDraggable: item.getAttribute('draggable'),
      registration,
      sessionRoot: session.root,
    };
  }

  private _endSortableDrag(event: Sortable.SortableEvent): void {
    const active = this._activeDrag;
    if (!active) return;
    if (active.item !== event.item) {
      this._cancelActiveDrag();
      return;
    }

    this._activeDrag = null;
    const canRestoreItem = this._canRestoreSortableItem(active);
    const isFresh = canRestoreItem && this._isActiveDragFresh(active);
    const target = tilesByHost.get(event.to) as MlvTiles<TProps> | undefined;
    const targetContainerId = target?.targetId();
    const currentIndex =
      event.newDraggableIndex ?? this._draggableIndex(event.item, event.to);
    const session = this.coordinator.activeSession();
    const sourceContainerId = active.source.targetId();
    const request: MlvTileMovedEvent | null =
      isFresh &&
      target &&
      target.coordinator === this.coordinator &&
      sourceContainerId !== undefined &&
      targetContainerId !== undefined &&
      currentIndex >= 0 &&
      session?.draggedTile.id === active.tileId &&
      session.allowedTargetIds.has(targetContainerId)
        ? {
            tileId: active.tileId,
            sourceContainerId,
            targetContainerId,
            previousIndex: active.previousIndex,
            currentIndex,
          }
        : null;

    if (canRestoreItem) {
      this._restoreSortableItem(active);
    } else {
      this._cleanupSortableItem(active);
    }
    this._ngZone.run(() => {
      try {
        if (request) this.coordinator.move(request);
      } finally {
        this.coordinator.endDrag();
      }
    });
  }

  private _cancelActiveDrag(): void {
    const active = this._activeDrag;
    if (!active) return;

    this._activeDrag = null;
    if (this._canRestoreSortableItem(active)) {
      this._restoreSortableItem(active);
    } else {
      this._cleanupSortableItem(active);
    }
    active.source._ngZone.run(() => this.coordinator.endDrag());
  }

  private _restoreSortableItem(active: MlvSortableDrag<TProps>): void {
    const { item, sourceElement, nextSibling } = active;
    if (nextSibling?.parentNode === sourceElement) {
      sourceElement.insertBefore(item, nextSibling);
    } else {
      sourceElement.appendChild(item);
    }

    this._cleanupSortableItem(active);
  }

  private _cleanupSortableItem(active: MlvSortableDrag<TProps>): void {
    const { item } = active;
    item.classList.remove(
      SORTABLE_CHOSEN_CLASS,
      SORTABLE_DRAG_CLASS,
      SORTABLE_FALLBACK_CLASS,
      SORTABLE_GHOST_CLASS,
    );
    this._restoreAttribute(item, 'style', active.originalStyle);
    this._restoreAttribute(item, 'draggable', active.originalDraggable);
  }

  private _canRestoreSortableItem(active: MlvSortableDrag<TProps>): boolean {
    return (
      active.item.isConnected &&
      active.sourceElement.isConnected &&
      this.coordinator.item(active.tileId) === active.registration
    );
  }

  private _isActiveDragFresh(active: MlvSortableDrag<TProps>): boolean {
    const session = this.coordinator.activeSession();
    let currentRoot: MlvTileNodeWithChildren<TProps>;
    try {
      currentRoot = this.coordinator.start();
    } catch {
      return false;
    }

    return (
      session?.root === active.sessionRoot &&
      currentRoot === active.sessionRoot &&
      session.draggedTile.id === active.tileId
    );
  }

  private _announceKeyboardMove(message: string): void {
    const sequence = ++this._announcementSequence;
    this._keyboardAnnouncement.set('');
    queueMicrotask(() => {
      if (
        this._destroyRef.destroyed ||
        sequence !== this._announcementSequence
      ) {
        return;
      }
      this._keyboardAnnouncement.set(message);
    });
  }

  private _restoreKeyboardFocus(tileId: string): void {
    queueMicrotask(() => {
      if (this._destroyRef.destroyed) return;

      const rootElement = this._elementRef.nativeElement as HTMLElement;
      const item = Array.from(
        rootElement.querySelectorAll<HTMLElement>(
          `.${ITEM_ROOT_CLASS}[${ITEM_ID_ATTRIBUTE}]`,
        ),
      ).find(
        (candidate) => candidate.getAttribute(ITEM_ID_ATTRIBUTE) === tileId,
      );
      item?.querySelector<HTMLButtonElement>('.mlv-tile__drag-handle')?.focus();
    });
  }

  private _restoreAttribute(
    element: HTMLElement,
    name: string,
    value: string | null,
  ): void {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  private _canReceive(item: HTMLElement): boolean {
    const session = this.coordinator.activeSession();
    const targetId = this.targetId();
    return (
      session !== null &&
      session.draggedTile.id === item.getAttribute(ITEM_ID_ATTRIBUTE) &&
      targetId !== undefined &&
      session.allowedTargetIds.has(targetId)
    );
  }

  private _canMove(event: Sortable.MoveEvent, originalEvent: Event): boolean {
    const target = tilesByHost.get(event.to) as MlvTiles<TProps> | undefined;
    if (!target || target.coordinator !== this.coordinator) return false;

    const deepestTarget = this._eventTargetTiles(originalEvent);
    if (deepestTarget && deepestTarget !== target) return false;

    return target._canReceive(event.dragged);
  }

  private _eventTargetTiles(event: Event): MlvTiles<TProps> | null {
    const path = event.composedPath?.() ?? [];
    const firstElement = path.find(
      (entry): entry is HTMLElement => entry instanceof HTMLElement,
    );
    let element =
      firstElement ??
      (event.target instanceof HTMLElement ? event.target : null);
    while (element) {
      const tiles = tilesByHost.get(element) as MlvTiles<TProps> | undefined;
      if (tiles?.coordinator === this.coordinator) return tiles;
      element = element.parentElement;
    }
    return null;
  }

  private _draggableIndex(item: HTMLElement, container: HTMLElement): number {
    return Array.from(container.children)
      .filter(
        (candidate): candidate is HTMLElement =>
          candidate instanceof HTMLElement &&
          candidate.classList.contains(ITEM_ROOT_CLASS),
      )
      .indexOf(item);
  }

  /** @private Single development-only channel for rejected tree operations. */
  private _warnDev(message: string): void {
    if (typeof ngDevMode === 'undefined' || ngDevMode) console.warn(message);
  }

  private _prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
