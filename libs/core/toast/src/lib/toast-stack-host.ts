import type { Type } from '@angular/core';
import {
  DestroyRef,
  EnvironmentInjector,
  Injectable,
  inject,
} from '@angular/core';
import type { GlobalPositionStrategy, OverlayRef } from '@angular/cdk/overlay';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import type {
  MlvAbstractToastContainerComponent,
  MlvIAbstractToastComponent,
} from './abstract-toast-container';
import type { MlvInternalBaseToast, MlvToastPosition } from './toast.types';

/**
 * How long an emptied stack keeps its pane, so the last item's leave animation
 * can finish before the overlay is disposed.
 */
const TOAST_LEAVE_DURATION_MS = 200;

/**
 * @internal Identifies one shared stack. Services whose items would render in
 * an identical pane — the same container component, created from the same
 * environment injector, at the same corner — share it.
 */
export interface MlvToastStackKey {
  /** Container component the pane renders. */
  readonly containerType: Type<
    MlvAbstractToastContainerComponent<MlvInternalBaseToast>
  >;
  /** Environment injector the container is created from. */
  readonly injector: EnvironmentInjector;
  /** Viewport corner the pane is anchored to. */
  readonly position: MlvToastPosition;
}

/** @internal One pane and the container it holds. */
interface MlvToastStack {
  /** What the pane was created for. */
  readonly key: MlvToastStackKey;
  /** The CDK overlay holding the container. */
  readonly overlayRef: OverlayRef;
  /** The container rendering every item in the stack, whichever service owns it. */
  readonly container: MlvAbstractToastContainerComponent<MlvInternalBaseToast>;
  /** Pending disposal after the stack emptied; cleared when an item joins. */
  disposeTimer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Owns the toast stacks of every `MlvAbstractToastService`: one CDK overlay
 * pane per corner, which `MlvToastService` and `MlvNotificationService` both
 * add their items to.
 *
 * Each service used to create its own pane per corner, so a toast and a
 * notification shown at the same corner rendered two panes with identical
 * global positioning, one on top of the other — the pointer reached only the
 * top pane's item (#362). A shared stack lays both out in one column.
 *
 * - **Ownership.** The first item at a corner, from either service, creates
 *   the pane; it is disposed `TOAST_LEAVE_DURATION_MS` after the stack's last
 *   item leaves, whichever service owned it. An item joining during that
 *   delay keeps the pane. A destroyed service disposes a stack it empties at
 *   once only when the stack is keyed on a non-root injector; a root stack
 *   keeps its delay. Services own their items and refs, not panes.
 * - **Order.** Insertion order across services, newest nearest the anchored
 *   edge — first in a top stack, last in a bottom one — as for one service.
 * - **Ids.** Issued here, so they are unique across services: the container
 *   tracks and removes items by id, and routes each item's close request to
 *   the service that showed it.
 * - **Key.** Services share a stack only when the pane would be identical
 *   (see {@link MlvToastStackKey}). A subclass with its own container
 *   component, or a service provided in another environment injector, keeps
 *   a pane of its own.
 *
 * Internal to `@malva-ui/core/toast`; not part of the public barrel.
 */
@Injectable({ providedIn: 'root' })
export class MlvToastStackHost {
  /** @private Creates each stack's pane. */
  private readonly _overlay = inject(Overlay);

  /**
   * @private Supplies the document direction to each pane so its portaled
   * content mirrors instead of inheriting `<body>`'s default.
   */
  private readonly _rtl = inject(MlvRtlService);

  /**
   * @private The root environment injector this host lives in. A stack keyed
   * on it outlives every service that shares it, so a destroyed service never
   * disposes it early — that would cut short the leave animation of another
   * service's item still fading out in the same pane.
   */
  private readonly _rootInjector = inject(EnvironmentInjector);

  /** @private Live stacks; a handful at most (one per corner and container). */
  private readonly _stacks: MlvToastStack[] = [];

  /** @private Each live item's close request, routed to the service that showed it. */
  private readonly _closeHandlers = new Map<string, (id: string) => void>();

  /** @private Monotonic counter behind {@link nextId}. */
  private _idCounter = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const stack of this._stacks) {
        clearTimeout(stack.disposeTimer);
        stack.overlayRef.dispose();
      }
      this._stacks.length = 0;
      this._closeHandlers.clear();
    });
  }

  /** Issues an item id unique across every service sharing these stacks. */
  nextId(): string {
    return `toast-${++this._idCounter}`;
  }

  /**
   * Adds an item to the stack for `key`, creating the pane on first use and
   * cancelling a pending disposal.
   *
   * @param key - The stack to join.
   * @param item - The resolved item; its `id` must come from {@link nextId}.
   * @param component - Item component that renders it.
   * @param close - Runs when the item asks to close (timer, dismiss button,
   *   action); the owning service's `close()`.
   */
  add(
    key: MlvToastStackKey,
    item: MlvInternalBaseToast,
    component: Type<MlvIAbstractToastComponent>,
    close: (id: string) => void,
  ): void {
    const stack = this._find(key) ?? this._create(key, component);
    clearTimeout(stack.disposeTimer);
    stack.disposeTimer = undefined;
    this._closeHandlers.set(item.id, close);
    stack.container._addItem(item, component);
  }

  /**
   * Removes an item from the stack for `key`. A stack left empty is disposed
   * after the leave delay, or at once with `disposeNow` when the stack is keyed
   * on an environment injector other than the root one.
   *
   * @param key - The stack holding the item.
   * @param id - The item's id.
   * @param disposeNow - Dispose an emptied non-root stack without waiting for
   *   the leave animation, for a service being destroyed: that pane was
   *   created from the service's injector and must not outlive it. A root
   *   stack still waits, because another service's item may be fading out in
   *   it — a root notification dismissed just before a component-scoped
   *   toast service is destroyed.
   * @returns Whether the item was in the stack.
   */
  remove(key: MlvToastStackKey, id: string, disposeNow = false): boolean {
    const stack = this._find(key);
    if (!stack?.container.remove(id)) {
      return false;
    }
    this._closeHandlers.delete(id);
    if (stack.container.isEmpty()) {
      if (disposeNow && stack.key.injector !== this._rootInjector) {
        this._dispose(stack);
      } else {
        this._scheduleDispose(stack);
      }
    }
    return true;
  }

  /** @private The live stack matching `key`, if any. */
  private _find(key: MlvToastStackKey): MlvToastStack | undefined {
    return this._stacks.find(
      (stack) =>
        stack.key.containerType === key.containerType &&
        stack.key.injector === key.injector &&
        stack.key.position === key.position,
    );
  }

  /**
   * @private Creates the pane and container for `key`.
   *
   * @param component - The creating service's item component, the container's
   *   fallback `component`; every item added here carries its own anyway.
   */
  private _create(
    key: MlvToastStackKey,
    component: Type<MlvIAbstractToastComponent>,
  ): MlvToastStack {
    const overlayRef = this._overlay.create({
      positionStrategy: this._getPositionStrategy(key.position),
      // Toast stacks are document-level, so the global direction applies. CDK's
      // `GlobalPositionStrategy` compensates for the mirrored flex axis, so
      // `top-left`/`top-right` stay physical while the content mirrors.
      direction: this._rtl.direction(),
      panelClass: ['mlv-toast-panel', `mlv-toast-panel--${key.position}`],
      scrollStrategy: this._overlay.scrollStrategies.noop(),
      maxHeight: 'calc(100vh - 32px)',
    });

    const container = overlayRef.attach(
      new ComponentPortal(key.containerType, null, key.injector),
    ).instance;
    container.position.set(key.position);
    container.setComponent(component);
    container.setCloseHandler((id) => this._closeHandlers.get(id)?.(id));

    const stack: MlvToastStack = {
      key,
      overlayRef,
      container,
      disposeTimer: undefined,
    };
    this._stacks.push(stack);
    return stack;
  }

  /** @private Defers disposal of an emptied stack so the leave animation can finish. */
  private _scheduleDispose(stack: MlvToastStack): void {
    clearTimeout(stack.disposeTimer);
    stack.disposeTimer = setTimeout(() => {
      stack.disposeTimer = undefined;
      if (stack.container.isEmpty()) {
        this._dispose(stack);
      }
    }, TOAST_LEAVE_DURATION_MS);
  }

  /** @private Disposes a stack's pane and forgets the stack. */
  private _dispose(stack: MlvToastStack): void {
    clearTimeout(stack.disposeTimer);
    const index = this._stacks.indexOf(stack);
    if (index === -1) {
      return;
    }
    this._stacks.splice(index, 1);
    stack.overlayRef.dispose();
  }

  /** @private Builds the global position strategy for a corner. */
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
