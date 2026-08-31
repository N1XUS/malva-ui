import type { Signal, Type } from '@angular/core';
import { Directive, signal } from '@angular/core';
import type { MlvInternalBaseToast, MlvToastPosition } from './toast.types';

export interface MlvIAbstractToastComponent<
  T extends MlvInternalBaseToast = MlvInternalBaseToast,
> {
  toast: Signal<T>;
}

/**
 * Abstract base for toast/notification container components.
 * Manages the ordered list of active items for a single overlay position.
 * Extend this class and add the @Component decorator to create a concrete container.
 */
@Directive()
export abstract class MlvAbstractToastContainerComponent<
  T extends MlvInternalBaseToast,
> {
  /** The overlay position this container is responsible for. Set by the service. */
  readonly position = signal<MlvToastPosition>('top-right');
  readonly toasts = signal<T[]>([]);

  abstract component: Type<MlvIAbstractToastComponent>;

  /** @private Service-owned callback used by every item close source. */
  private _closeHandler = (id: string): void => {
    this.remove(id);
  };

  add(item: T): void {
    const isTop = this.position().startsWith('top');
    this.toasts.update((ts) => (isTop ? [item, ...ts] : [...ts, item]));
  }

  remove(id: string): boolean {
    const exists = this.toasts().some((toast) => toast.id === id);
    if (!exists) {
      return false;
    }
    this.toasts.update((ts) => ts.filter((t) => t.id !== id));
    return true;
  }

  isEmpty(): boolean {
    return this.toasts().length === 0;
  }

  setComponent(component: Type<MlvIAbstractToastComponent>): void {
    this.component = component;
  }

  /** Registers the service-owned close callback for timer, action, and dismiss-button requests. */
  setCloseHandler(handler: (id: string) => void): void {
    this._closeHandler = handler;
  }

  /** @protected Routes an item close request through the owning service. */
  protected requestClose(id: string): void {
    this._closeHandler(id);
  }
}
