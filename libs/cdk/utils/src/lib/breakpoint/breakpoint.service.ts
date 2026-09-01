// libs/cdk/utils/src/lib/breakpoint/breakpoint.service.ts
import { computed, inject, Injectable, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';
import {
  BREAKPOINT_ORDER,
  MLV_BREAKPOINT_CONFIG,
  type MlvBreakpoint,
} from './breakpoint.config';

/**
 * Signal-based viewport breakpoint service.
 * Wraps Angular CDK's `BreakpointObserver` and exposes the current
 * breakpoint tier as Angular signals. Observable cleanup is handled
 * automatically by `toSignal()` — no manual unsubscription required.
 *
 * @example
 * readonly bp = inject(MlvBreakpointService);
 * // In template: @if (bp.isSm()) { ... }
 */
@Injectable({ providedIn: 'root' })
export class MlvBreakpointService {
  /** @private CDK breakpoint observer instance. */
  private readonly _observer = inject(BreakpointObserver);
  /** @private Breakpoint configuration with pixel thresholds. */
  private readonly _config = inject(MLV_BREAKPOINT_CONFIG);

  /** Current active breakpoint: 'sm' | 'md' | 'lg'. */
  readonly breakpoint: Signal<MlvBreakpoint>;

  /** True when viewport is below md threshold. */
  readonly isSm: Signal<boolean>;
  /** True when viewport is between md and lg thresholds. */
  readonly isMd: Signal<boolean>;
  /** True when viewport is at or above lg threshold. */
  readonly isLg: Signal<boolean>;

  /**
   * @private Memoized {@link isUp} signals, keyed by the resolved
   * `BREAKPOINT_ORDER` index of the requested breakpoint (not its name), so
   * every out-of-union value collapses onto the single `-1` entry.
   *
   * Bounded by the size of the `MlvBreakpoint` union plus the single `-1`
   * entry — four entries as `BREAKPOINT_ORDER` stands today — so there is
   * nothing to evict and no eviction policy is needed. That bound assumes
   * `BREAKPOINT_ORDER` is not mutated at runtime; it is `readonly` to
   * TypeScript but is a plain, unfrozen exported array, so a caller that
   * pushes into it would grow these maps to match.
   *
   * The service is a root singleton and the cached signals close over nothing
   * but `breakpoint()` and the captured index, so sharing them across every
   * caller is safe.
   */
  private readonly _upCache = new Map<number, Signal<boolean>>();

  /** @private Memoized {@link isDown} signals. See {@link _upCache}. */
  private readonly _downCache = new Map<number, Signal<boolean>>();

  constructor() {
    const mdQuery = `(min-width: ${this._config.md}px)`;
    const lgQuery = `(min-width: ${this._config.lg}px)`;

    this.breakpoint = toSignal(
      this._observer.observe([mdQuery, lgQuery]).pipe(
        map((result) => {
          if (result.breakpoints[lgQuery]) return 'lg' as const;
          if (result.breakpoints[mdQuery]) return 'md' as const;
          return 'sm' as const;
        }),
      ),
      { initialValue: 'sm' as MlvBreakpoint },
    );

    this.isSm = computed(() => this.breakpoint() === 'sm');
    this.isMd = computed(() => this.breakpoint() === 'md');
    this.isLg = computed(() => this.breakpoint() === 'lg');
  }

  /**
   * Returns a signal that is true when the viewport is at or above
   * the given breakpoint.
   *
   * The signal is memoized per breakpoint, so repeated calls return the *same*
   * instance. Calling this from a template (`@if (bp.isUp('lg')()) { … }`) is
   * therefore safe — it reuses one reactive node instead of allocating a fresh
   * one on every change-detection pass.
   */
  isUp(bp: MlvBreakpoint): Signal<boolean> {
    // Resolved once per breakpoint, not on every read of the returned signal.
    const target = BREAKPOINT_ORDER.indexOf(bp);
    let cached = this._upCache.get(target);
    if (!cached) {
      cached = computed(
        () => BREAKPOINT_ORDER.indexOf(this.breakpoint()) >= target,
      );
      this._upCache.set(target, cached);
    }
    return cached;
  }

  /**
   * Returns a signal that is true when the viewport is below
   * the given breakpoint.
   *
   * The signal is memoized per breakpoint, so repeated calls return the *same*
   * instance. Calling this from a template (`@if (bp.isDown('md')()) { … }`) is
   * therefore safe — it reuses one reactive node instead of allocating a fresh
   * one on every change-detection pass.
   */
  isDown(bp: MlvBreakpoint): Signal<boolean> {
    // Resolved once per breakpoint, not on every read of the returned signal.
    const target = BREAKPOINT_ORDER.indexOf(bp);
    let cached = this._downCache.get(target);
    if (!cached) {
      cached = computed(
        () => BREAKPOINT_ORDER.indexOf(this.breakpoint()) < target,
      );
      this._downCache.set(target, cached);
    }
    return cached;
  }
}
