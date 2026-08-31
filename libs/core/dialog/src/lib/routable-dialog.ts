import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  INJECTOR,
  ViewEncapsulation,
} from '@angular/core';
import type { Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { delay, from, of, switchMap } from 'rxjs';

import type { MlvDialogRef } from './dialog-ref';
import { MlvDialogService } from './dialog.service';

/**
 * Invisible shell component that opens a routed component inside a Malva UI dialog.
 *
 * Do not use directly — use `mlvGenerateRoutableDialogRoute()` to create routes
 * that render their component inside a dialog overlay.
 *
 * @internal
 */
@Component({
  selector: 'mlv-routable-dialog',
  template: '',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class MlvRoutableDialog {
  /** @private The current activated route — provides access to route data and snapshot. */
  private readonly _route = inject(ActivatedRoute);

  /** @private The Angular router used for navigating back to the parent route on close. */
  private readonly _router = inject(Router);

  /** @private The shell component's injector, passed to the dialog for ActivatedRoute access. */
  private readonly _injector = inject(INJECTOR);

  /** @private Captures the URL at construction time to detect external navigation. */
  private readonly _initialUrl = this._router.url;

  /** @private The Malva UI dialog service used to open the routed component. */
  private readonly _dialog = inject(MlvDialogService);

  constructor() {
    const { dialogOptions } = this._route.snapshot.data;
    const componentOrLoader = this._route.snapshot.data['dialog'];
    let currentRef: MlvDialogRef | undefined;
    let closed = false;

    const component$ = isClass(componentOrLoader)
      ? of(componentOrLoader as Type<unknown>)
      : from(
          (
            componentOrLoader as () => Promise<
              Type<unknown> & { default?: Type<unknown> }
            >
          )().then((m) => m.default ?? m),
        );

    component$
      .pipe(
        delay(0),
        switchMap((component) => {
          currentRef = this._dialog.open(component, {
            ...dialogOptions,
            injector: this._injector,
          });
          return currentRef.afterClosed();
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: () => {
          closed = true;
        },
        complete: () => this._onDialogClosing(),
      });

    inject(DestroyRef).onDestroy(() => {
      if (!closed) {
        currentRef?.close();
      }
    });
  }

  /** @private Computes the relative back URL for lazy-loaded routes. */
  private get _lazyLoadedBackUrl(): string {
    return (this._route.parent?.snapshot.url ?? []).map(() => '..').join('/');
  }

  /** @private Navigates to parent when the dialog closes and URL hasn't changed externally. */
  private _onDialogClosing(): void {
    if (this._initialUrl === this._router.url) {
      this._navigateToParent();
    }
  }

  /** @private Navigates to the parent route using the computed back URL. */
  private _navigateToParent(): void {
    const backUrl = this._route.snapshot.data['isLazy']
      ? this._lazyLoadedBackUrl
      : this._route.snapshot.data['backUrl'];

    void this._router.navigate([backUrl], { relativeTo: this._route });
  }
}

/**
 * Checks if the given value is a class constructor (as opposed to an arrow function).
 * Classes have a non-writable `prototype` property.
 */
function isClass(fn: unknown): boolean {
  return (
    typeof fn === 'function' &&
    Object.getOwnPropertyDescriptor(fn, 'prototype')?.writable === false
  );
}
