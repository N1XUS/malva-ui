import type { Type } from '@angular/core';
import { DestroyRef, EnvironmentInjector, inject } from '@angular/core';
import type { OverlayRef } from '@angular/cdk/overlay';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import type { GlobalPositionStrategy } from '@angular/cdk/overlay';
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
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvToastRef } from './toast-ref';

const TOAST_LEAVE_DURATION_MS = 200;

/** Position used when a config omits one. Single source of truth for subclasses. */
export const MLV_TOAST_DEFAULT_POSITION: MlvToastPosition = 'top-right';

/**
 * Abstract base service for toast/notification services.
 * Manages CDK overlay refs (one per position) and container lifecycle.
 * Extend this class and implement `containerType` and `buildItem()`.
 */
export abstract class MlvAbstractToastService<
  TConfig extends MlvBaseToastConfig,
  TItem extends MlvInternalBaseToast,
  TItemComponent extends MlvIAbstractToastComponent,
  TRef extends MlvToastRef = MlvToastRef,
> {
  /** @protected CDK overlay service used to create per-position toast panels. */
  protected readonly _overlay = inject(Overlay);

  /**
   * @protected Supplies the document direction to each toast stack overlay so
   * its portaled pane mirrors instead of inheriting `<body>`'s default.
   */
  protected readonly _rtl = inject(MlvRtlService);
  /** @protected Environment injector used when attaching container portals. */
  protected readonly _environmentInjector = inject(EnvironmentInjector);
  /**
   * @protected Owns the single persistent ARIA live region used to announce
   * items. Announcing from here rather than from a `role` on each rendered item
   * means the region exists in the DOM before any message is inserted (screen
   * readers miss content added together with its live region), one stacked item
   * does not add one live region, and an assertive tone cannot silently
   * override the caller's politeness choice.
   */
  protected readonly _liveAnnouncer = inject(LiveAnnouncer);
  /** @private Cleans up overlays, refs, and deferred disposal timers with the service. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Active overlay refs keyed by position. */
  private readonly _overlayRefs = new Map<MlvToastPosition, OverlayRef>();
  /** @private Active container instances keyed by position. */
  private readonly _containers = new Map<
    MlvToastPosition,
    MlvAbstractToastContainerComponent<TItem>
  >();
  /** @private Active item references keyed by generated ID. */
  private readonly _refs = new Map<string, TRef>();
  /** @private Deferred final-item overlay disposal timers keyed by position. */
  private readonly _disposeTimers = new Map<
    MlvToastPosition,
    ReturnType<typeof setTimeout>
  >();
  /** @private Monotonic counter used to generate unique toast ids. */
  private _idCounter = 0;

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
      for (const timer of this._disposeTimers.values()) {
        clearTimeout(timer);
      }
      for (const overlayRef of this._overlayRefs.values()) {
        overlayRef.dispose();
      }
      for (const ref of this._refs.values()) {
        ref._markClosed();
      }
      // Drop any text still sitting in the shared live region, so a destroyed
      // service cannot leave a stale announcement behind for the next one.
      this._liveAnnouncer.clear();
      this._disposeTimers.clear();
      this._overlayRefs.clear();
      this._containers.clear();
      this._refs.clear();
    });
  }

  show(config: TConfig): TRef {
    const position = config.position ?? MLV_TOAST_DEFAULT_POSITION;
    const container = this._ensureContainer(position);
    const id = `toast-${++this._idCounter}`;
    const ref = this._createRef(id, position, config);
    this._refs.set(id, ref);
    container.add(this.buildItem(id, config, ref));

    const announcement = this.resolveAnnouncement(config);
    if (announcement) {
      this._liveAnnouncer.announce(
        announcement.message,
        config.politeness ?? announcement.politeness,
      );
    }

    return ref;
  }

  close(id: string, position?: MlvToastPosition): void {
    if (position) {
      const container = this._containers.get(position);
      if (container?.remove(id)) {
        this._completeRef(id);
        if (container.isEmpty()) {
          this._scheduleDisposePosition(position);
        }
      }
    } else {
      for (const [pos, container] of this._containers) {
        if (container.remove(id)) {
          this._completeRef(id);
          if (container.isEmpty()) {
            this._scheduleDisposePosition(pos);
          }
          break;
        }
      }
    }
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

  /** @private Returns the container for a position, creating the overlay on first use. */
  private _ensureContainer(
    position: MlvToastPosition,
  ): MlvAbstractToastContainerComponent<TItem> {
    const existing = this._containers.get(position);
    if (existing) {
      this._cancelDisposePosition(position);
      return existing;
    }

    const overlayRef = this._overlay.create({
      positionStrategy: this._getPositionStrategy(position),
      // Toast stacks are document-level, so the global direction applies. CDK's
      // `GlobalPositionStrategy` compensates for the mirrored flex axis, so
      // `top-left`/`top-right` stay physical while the content mirrors.
      direction: this._rtl.direction(),
      panelClass: ['mlv-toast-panel', `mlv-toast-panel--${position}`],
      scrollStrategy: this._overlay.scrollStrategies.noop(),
      maxHeight: 'calc(100vh - 32px)',
    });

    const portal = new ComponentPortal(
      this.containerType,
      null,
      this._environmentInjector,
    );
    const componentRef = overlayRef.attach(portal);
    componentRef.instance.position.set(position);

    this._overlayRefs.set(position, overlayRef);
    this._containers.set(position, componentRef.instance);
    componentRef.instance.setComponent(this.toastItemType);
    componentRef.instance.setCloseHandler((id) => this.close(id, position));

    return componentRef.instance;
  }

  /** @private Disposes the overlay for a position once its container is empty. */
  private _disposePosition(position: MlvToastPosition): void {
    this._cancelDisposePosition(position);
    const overlayRef = this._overlayRefs.get(position);
    if (overlayRef) {
      overlayRef.dispose();
      this._overlayRefs.delete(position);
      this._containers.delete(position);
    }
  }

  /** @private Defers final-item disposal so Angular's leave animation can finish. */
  private _scheduleDisposePosition(position: MlvToastPosition): void {
    this._cancelDisposePosition(position);
    this._disposeTimers.set(
      position,
      setTimeout(() => {
        this._disposeTimers.delete(position);
        if (this._containers.get(position)?.isEmpty()) {
          this._disposePosition(position);
        }
      }, TOAST_LEAVE_DURATION_MS),
    );
  }

  /** @private Cancels pending disposal when a new item reuses the same position. */
  private _cancelDisposePosition(position: MlvToastPosition): void {
    const timer = this._disposeTimers.get(position);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._disposeTimers.delete(position);
    }
  }

  /** @private Completes and releases the reference for a removed item. */
  private _completeRef(id: string): void {
    this._refs.get(id)?._markClosed();
    this._refs.delete(id);
  }

  /** @private Builds the global position strategy for a toast position. */
  private _getPositionStrategy(
    position: MlvToastPosition,
  ): GlobalPositionStrategy {
    const strategy = this._overlay.position().global();
    const margin = '16px';

    if (position.startsWith('top')) {
      strategy.top(margin);
    } else {
      strategy.bottom(margin);
    }

    if (position.endsWith('left')) {
      strategy.left(margin);
    } else if (position.endsWith('right')) {
      strategy.right(margin);
    } else {
      strategy.centerHorizontally();
    }

    return strategy;
  }
}
