import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Renderer2,
  ViewEncapsulation,
  computed,
  contentChild,
  effect,
  forwardRef,
  inject,
  input,
  output,
  type Signal,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { NgTemplateOutlet } from '@angular/common';
import { LucideGripVertical } from '@lucide/angular';
import { MlvButtonClose, MlvButtonIcon } from '@malva-ui/core/button';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
  provideMlvDensityContext,
} from '@malva-ui/cdk/density';
import { MlvTileActions } from '../tile-actions';
import { MlvTileHeader } from '../tile-header';
import { MlvTileTrailingActions } from '../tile-trailing-actions';
import { MLV_TILE_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import {
  MlvRtlService,
  type MlvTone,
} from '@malva-ui/cdk/utils';
import { MLV_TILE_ITEM_CONTEXT } from '../tile-item-context';
import { MLV_TILE_LOCKED } from '../tile-locked-context';
import type { MlvTileTreeNode } from '../tile-tree.types';
import type { MlvTileKeyboardMoveDirection } from '../tile-tree-coordinator';
import { MlvTiles } from '../tiles/tiles';

export type MlvTileTone = MlvTone | 'default';

const MLV_TILE_ITEM_ROOT_CLASS = 'mlv-tiles__item-root';

@Component({
  selector: 'mlv-tile',
  imports: [
    NgTemplateOutlet,
    LucideGripVertical,
    MlvButtonClose,
    MlvTileActions,
    MlvTileTrailingActions,
    MlvButtonIcon,
  ],
  templateUrl: './tile.html',
  styleUrl: './tile.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'tile' },
    provideMlvDensityContext(MlvDensityDirective),
    {
      provide: MLV_TILE_ITEM_CONTEXT,
      useExisting: forwardRef(() => MlvTile),
    },
    {
      provide: MLV_TILE_LOCKED,
      useFactory: (tile: MlvTile<unknown>): Signal<boolean> => tile.lockedState,
      deps: [forwardRef(() => MlvTile)],
    },
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: {
    class: 'mlv-tile',
    '[class.mlv-tile--tone-info]': 'tone() === "info"',
    '[class.mlv-tile--tone-success]': 'tone() === "success"',
    '[class.mlv-tile--tone-warning]': 'tone() === "warning"',
    '[class.mlv-tile--tone-danger]': 'tone() === "danger"',
    '[class.mlv-tile--draggable]': '_hasDragHandle()',
    '[class.mlv-tile--drag-disabled]': 'dragDisabled()',
    '[class.mlv-tile--locked]': 'lockedState()',
    '[class.mlv-tile--inactive]': 'inactive()',
  },
})
export class MlvTile<TProps = unknown> {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_TILE_I18N);
  /** @private Resolves parameterized accessible names. */
  private readonly _i18nResolver = inject(MlvI18nResolverService);
  private readonly _rtlService = inject(MlvRtlService);

  /** Human-readable tile name used by the drag handle and move announcements. */
  readonly ariaLabel = input<string | undefined>(undefined);

  /** Colors the tile outline with an optional semantic tone. */
  readonly tone = input<MlvTileTone>('default');

  /** Typed immutable tree item represented by this tile when nested in `mlv-tiles`. */
  readonly tile = input<MlvTileTreeNode<TProps> | undefined>();

  /** Adds the standard close action to the tile header. */
  readonly closable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Adds the built-in drag handle to the tile header. */
  readonly draggable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Disables the built-in drag handle without dimming the tile content. */
  readonly dragDisabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Freezes this tile: withdraws the drag handle and the standard close action,
   * makes `remove()` a no-op, and locks any nested `mlv-tiles`. Inherited from
   * an enclosing locked container; an explicit `false` does not unlock a locked
   * ancestor. `setProps` and `updateProps` keep working — `locked` is
   * structural, not data-read-only.
   */
  readonly locked = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * De-emphasises the projected body while leaving the header controls at full
   * contrast. Presentational only: it does not cascade to nested tiles and adds
   * no ARIA state, because the tile region stays fully interactive.
   */
  readonly inactive = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emits when the user activates the tile's close action. */
  readonly closed = output<void>();

  /** @protected Header slot template projected via `[mlvTileHeader]`. */
  protected readonly headerRef = contentChild(MlvTileHeader);

  /** @protected Consumer-owned actions projected via `[mlvTileActions]`. */
  protected readonly actionsRef = contentChild(MlvTileActions);

  /** @protected Consumer-owned trailing actions projected via `[mlvTileTrailingActions]`. */
  protected readonly trailingActionsRef = contentChild(MlvTileTrailingActions);

  /** @private Closest enclosing lock, published by a container or outer tile. */
  private readonly _inheritedLocked = inject(MLV_TILE_LOCKED, {
    optional: true,
    skipSelf: true,
  });

  /**
   * @internal Resolved lock for this tile, inherited state included. Published
   * through `MLV_TILE_LOCKED` so nested containers and tiles inherit it.
   */
  readonly lockedState: Signal<boolean> = computed(
    () => this._inheritedLocked?.() === true || this.locked(),
  );

  /** @protected Whether this tile renders the standard close action. */
  protected readonly _hasCloseAction = computed(
    () => this.closable() && !this.lockedState(),
  );

  /** @protected Whether this tile renders its built-in drag handle. */
  protected readonly _hasDragHandle = computed(
    () =>
      !this.lockedState() && (this.draggable() || this.tile() !== undefined),
  );

  /** @protected Only registered compound handles expose keyboard operations. */
  protected readonly _hasInteractiveDragHandle = computed(
    () => this.tile() !== undefined && this._container !== null,
  );

  /** @private Consumer name or localized generic fallback for assistive text. */
  private readonly _accessibleLabel = computed(
    () => this.ariaLabel()?.trim() || this._i18n().tileLabel,
  );

  /** @protected Localized accessible drag handle label. */
  protected readonly _dragHandleLabel = computed(() =>
    this._i18nResolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'moveTile',
      { label: this._accessibleLabel() },
    ),
  );

  /** @protected Root-owned keyboard instructions associated with tree handles. */
  protected readonly _keyboardInstructionsId = computed(() =>
    this._tileId() === undefined
      ? null
      : (this._container?.keyboardInstructionsId() ?? null),
  );

  /** @private Closest compound container, absent for standalone tiles. */
  private readonly _container = inject(MlvTiles, {
    optional: true,
  }) as MlvTiles<TProps> | null;

  /** @private Component-scoped cleanup for the marked Sortable wrapper. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Rendered tile host used to resolve the direct list child. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Renderer used to mark and clean a consumer-owned wrapper root. */
  private readonly _renderer = inject(Renderer2);

  /** @private Stable item ID so immutable prop replacement does not re-register it. */
  private readonly _tileId = computed(() => this.tile()?.id);

  /** @private Direct list child exposed to Sortable without public markup. */
  private _itemRoot: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const tile = this.tile();
      const disabled = this.dragDisabled() || this.lockedState();
      if (!this._container || tile === undefined) {
        this._releaseItemRoot();
      } else {
        this._configureItemRoot(tile.id, disabled);
      }
    });

    effect((onCleanup) => {
      const tileId = this._tileId();
      if (!this._container || tileId === undefined) return;

      const registration = {
        id: tileId,
        tile: (): MlvTileTreeNode<TProps> => {
          const tile = this.tile();
          if (!tile) {
            throw new Error('Registered mlv-tile requires [tile].');
          }
          return tile;
        },
      };
      onCleanup(this._container.coordinator.registerItem(registration));
    });

    this._destroyRef.onDestroy(() => this._releaseItemRoot());
  }

  /**
   * Removes this item through the root-owned immutable tree. A locked tile is
   * structurally frozen, so the call is a no-op that warns in development.
   */
  remove(): void {
    if (this.lockedState()) {
      this._warnDev('MlvTile.remove() is disabled while the tile is locked.');
      return;
    }

    const tileId = this._registeredTileId('remove');
    if (tileId !== undefined) this._container?.remove(tileId);
  }

  /**
   * Inserts a node into this tile's container node through the root-owned
   * immutable tree. Valid only on a tree-bound tile whose node accepts
   * children.
   *
   * @param tile - Node to insert. Neither it nor any node in its subtree may
   *   reuse an ID that already exists in the tree.
   * @param index - Position among this node's direct children. Omitted appends;
   *   a non-integer, negative, or out-of-range index is rejected rather than
   *   clamped.
   * @returns `true` when the root tree was replaced, `false` on any rejection.
   *   Always `false` while the tile is locked.
   */
  insertChild(tile: MlvTileTreeNode<TProps>, index?: number): boolean {
    if (this.lockedState()) {
      this._warnDev(
        'MlvTile.insertChild() is disabled while the tile is locked.',
      );
      return false;
    }

    const targetContainerId = this._registeredTileId('insertChild');
    if (targetContainerId === undefined) return false;

    if (this.tile()?.acceptsChildren !== true) {
      this._warnDev('MlvTile.insertChild() requires a container [tile] node.');
      return false;
    }

    return (
      this._container?.coordinator.insert({
        targetContainerId,
        tile,
        index,
      }) ?? false
    );
  }

  /** Replaces this item's props through the root-owned immutable tree. */
  setProps(props: TProps): void {
    const tileId = this._registeredTileId('setProps');
    if (tileId !== undefined) {
      this._container?.updateProps(tileId, () => props);
    }
  }

  /** Updates this item's props through the root-owned immutable tree. */
  updateProps(update: (props: TProps) => TProps): void {
    const tileId = this._registeredTileId('updateProps');
    if (tileId !== undefined) this._container?.updateProps(tileId, update);
  }

  /** @protected Delegates the documented Alt+Arrow commands to the root tree. */
  protected _onDragHandleKeydown(event: KeyboardEvent): void {
    if (
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      this.dragDisabled()
    ) {
      return;
    }

    let direction: MlvTileKeyboardMoveDirection | undefined;
    switch (this._rtlService.normalizeArrowKey(event)) {
      case UP_ARROW:
        direction = 'up';
        break;
      case DOWN_ARROW:
        direction = 'down';
        break;
      case LEFT_ARROW:
        direction = 'left';
        break;
      case RIGHT_ARROW:
        direction = 'right';
        break;
    }
    const tileId = this._tileId();
    if (!direction || tileId === undefined || !this._container) return;

    event.preventDefault();
    this._container.moveByKeyboard(tileId, direction, this._accessibleLabel());
  }

  /** @private Marks the direct list child Sortable owns during interaction. */
  private _configureItemRoot(tileId: string, disabled: boolean): HTMLElement {
    const tileHost = this._elementRef.nativeElement;
    const root = this._container?.resolveItemRoot(tileHost) ?? tileHost;

    if (this._itemRoot !== root) {
      this._releaseItemRoot();
      this._renderer.addClass(root, MLV_TILE_ITEM_ROOT_CLASS);
      this._itemRoot = root;
    }

    this._renderer.setAttribute(root, 'data-mlv-tile-id', tileId);
    if (disabled) {
      this._renderer.setAttribute(root, 'data-mlv-tile-drag-disabled', 'true');
    } else {
      this._renderer.removeAttribute(root, 'data-mlv-tile-drag-disabled');
    }

    return root;
  }

  /** @private Removes the internal class from a prior direct-child wrapper. */
  private _releaseItemRoot(): void {
    const root = this._itemRoot;
    if (!root) return;
    this._renderer.removeClass(root, MLV_TILE_ITEM_ROOT_CLASS);
    this._renderer.removeAttribute(root, 'data-mlv-tile-id');
    this._renderer.removeAttribute(root, 'data-mlv-tile-drag-disabled');
    this._itemRoot = null;
  }

  /** @private Returns a live registered ID or warns only for requested tree work. */
  private _registeredTileId(operation: string): string | undefined {
    const tileId = this._tileId();
    if (
      tileId !== undefined &&
      this._container?.coordinator.item(tileId) !== undefined
    ) {
      return tileId;
    }

    this._warnDev(`MlvTile.${operation}() requires [tile] inside mlv-tiles.`);
    return undefined;
  }

  /** @private Single development-only channel for rejected tree operations. */
  private _warnDev(message: string): void {
    if (typeof ngDevMode === 'undefined' || ngDevMode) console.warn(message);
  }
}
