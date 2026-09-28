import type { Type } from '@angular/core';
import { DestroyRef, EnvironmentInjector, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import type {
  MlvAbstractToastContainerComponent,
  MlvIAbstractToastComponent,
} from './abstract-toast-container';
import type {
  MlvBaseToastConfig,
  MlvInternalBaseToast,
  MlvToastPoliteness,
  MlvToastPosition,
} from './toast.types';
import { MlvToastRef } from './toast-ref';
import { MlvToastAnnouncer } from './toast-announcer';
import type { MlvToastStackKey } from './toast-stack-host';
import { MlvToastStackHost } from './toast-stack-host';

/** Position used when a config omits one. Single source of truth for subclasses. */
export const MLV_TOAST_DEFAULT_POSITION: MlvToastPosition = 'top-right';

/**
 * Abstract base service for toast/notification services.
 * Owns its items and their refs; the panes they render in are shared with every
 * other toast-like service — one stack per position — so a toast and a
 * notification at the same corner never overlap (#362).
 * Extend this class and implement `containerType` and `buildItem()`.
 */
export abstract class MlvAbstractToastService<
  TConfig extends MlvBaseToastConfig,
  TItem extends MlvInternalBaseToast,
  TItemComponent extends MlvIAbstractToastComponent,
  TRef extends MlvToastRef = MlvToastRef,
> {
  /**
   * @protected Environment injector the stack's container is created from, and
   * the default parent for dynamic content. Part of what decides which services
   * share a stack.
   */
  protected readonly _environmentInjector = inject(EnvironmentInjector);
  /**
   * @protected The CDK service owning the single persistent ARIA live region.
   * Kept for the destroy-time `clear()` and for subclass access; `show()`
   * announces through `_announcer`, not through this field.
   *
   * A subclass calling `_liveAnnouncer.announce()` directly bypasses the batch:
   * its message replaces, or is replaced by, any item still waiting to be
   * written — the pre-#336 last-one-wins loss.
   */
  protected readonly _liveAnnouncer = inject(LiveAnnouncer);
  /**
   * @private Announces every item through `LiveAnnouncer`'s one live region —
   * rather than a `role` on each rendered item, so the region exists before any
   * message is inserted (screen readers miss content added together with its
   * live region), a stack of items is not a stack of live regions, and an
   * implicit `role="alert"` cannot override the caller's politeness — in one
   * application-wide batch, so items shown before it writes (in the same tick,
   * or within its 100 ms delay) are all announced instead of the last one
   * replacing the rest. Shared by every toast and notification service.
   */
  private readonly _announcer = inject(MlvToastAnnouncer);
  /**
   * @private Creates, shares and disposes the per-position panes, issues item
   * ids unique across services, and routes each item's close request back to
   * the service that showed it. Shared by every toast and notification service.
   */
  private readonly _stacks = inject(MlvToastStackHost);
  /** @private Removes this service's items and completes its refs with the service. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private This service's live items, keyed by id: the ref it returned and
   * the position the item was shown at. The only ids this service closes — a
   * shared stack also holds other services' items.
   */
  private readonly _items = new Map<
    string,
    { readonly ref: TRef; readonly position: MlvToastPosition }
  >();

  /** The concrete container component class to instantiate per position. */
  protected abstract readonly containerType: Type<
    MlvAbstractToastContainerComponent<TItem>
  >;

  /** The concrete toast item component class to instantiate per each toast. */
  protected abstract readonly toastItemType: Type<TItemComponent>;

  /** Build a fully-populated item from user config and the generated id. */
  protected abstract buildItem(id: string, config: TConfig, ref: TRef): TItem;

  /**
   * The text announced to assistive technology for this item, and the politeness
   * to announce it with. Return `null` to announce nothing — appropriate when
   * the item's content is a template or component the service cannot read.
   *
   * @param config - The caller's config for this item.
   */
  protected abstract resolveAnnouncement(
    config: TConfig,
  ): { message: string; politeness: MlvToastPoliteness } | null;

  constructor() {
    this._destroyRef.onDestroy(() => {
      for (const [id, { ref, position }] of this._items) {
        // Removed at once. A non-root stack this service leaves empty is
        // disposed with it, as its own panes were before stacks were shared;
        // a root stack keeps its leave delay, since another service's item may
        // still be fading out in it. Another service's items keep a shared
        // pane alive either way.
        this._stacks.remove(this._stackKey(position), id, true);
        ref._markClosed();
      }
      // Drop any text still sitting in the shared live region, so a destroyed
      // service cannot leave a stale announcement behind for the next one.
      this._liveAnnouncer.clear();
      this._items.clear();
    });
  }

  show(config: TConfig): TRef {
    const position = config.position ?? MLV_TOAST_DEFAULT_POSITION;
    const id = this._stacks.nextId();
    const ref = this._createRef(id, position, config);
    this._items.set(id, { ref, position });
    this._stacks.add(
      this._stackKey(position),
      this.buildItem(id, config, ref),
      this.toastItemType,
      (itemId) => this.close(itemId, position),
    );

    const announcement = this.resolveAnnouncement(config);
    if (announcement) {
      this._announcer.announce(
        announcement.message,
        config.politeness ?? announcement.politeness,
      );
    }

    return ref;
  }

  close(id: string, position?: MlvToastPosition): void {
    const item = this._items.get(id);
    // Not an item of this service — another service's in a shared stack, or
    // one already closed — or not at the position the caller named.
    if (!item || (position && position !== item.position)) {
      return;
    }
    this._stacks.remove(this._stackKey(item.position), id);
    this._completeRef(id);
  }

  /** @protected Creates the concrete reference returned for a new item. */
  protected _createRef(
    id: string,
    position: MlvToastPosition,
    config: TConfig,
  ): TRef {
    return new MlvToastRef(id, config.data, () =>
      this.close(id, position),
    ) as TRef;
  }

  /**
   * @private The stack this service's items at `position` join — shared with
   * every service rendering the same container from the same environment
   * injector.
   */
  private _stackKey(position: MlvToastPosition): MlvToastStackKey {
    return {
      containerType: this.containerType,
      injector: this._environmentInjector,
      position,
    };
  }

  /** @private Completes and releases the reference for a removed item. */
  private _completeRef(id: string): void {
    this._items.get(id)?.ref._markClosed();
    this._items.delete(id);
  }
}
