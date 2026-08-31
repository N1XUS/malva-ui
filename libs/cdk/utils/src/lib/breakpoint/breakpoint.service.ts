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
   */
  isUp(bp: MlvBreakpoint): Signal<boolean> {
    return computed(() => {
      const current = BREAKPOINT_ORDER.indexOf(this.breakpoint());
      const target = BREAKPOINT_ORDER.indexOf(bp);
      return current >= target;
    });
  }

  /**
   * Returns a signal that is true when the viewport is below
   * the given breakpoint.
   */
  isDown(bp: MlvBreakpoint): Signal<boolean> {
    return computed(() => {
      const current = BREAKPOINT_ORDER.indexOf(this.breakpoint());
      const target = BREAKPOINT_ORDER.indexOf(bp);
      return current < target;
    });
  }
}
