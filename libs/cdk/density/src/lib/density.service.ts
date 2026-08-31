import { Injectable, inject, signal } from '@angular/core';
import type { MlvDensity } from './density.types';
import { MLV_DEFAULT_DENSITY } from './density.types';

/**
 * Global density service for Malva UI.
 *
 * Stores the application-level density as an Angular signal and allows
 * programmatic density changes at runtime. All density directives without an
 * explicit `[mlvDensity]` input fall back to this service's current value.
 *
 * The initial density is `'comfortable'` unless overridden at bootstrap via
 * `provideMlvDensity()`.
 *
 * @example
 * ```ts
 * // Inject the service
 * private readonly densityService = inject(MlvDensityService);
 *
 * // Read current density
 * currentDensity = this.densityService.density; // Signal<MlvDensity>
 *
 * // Switch globally to compact
 * this.densityService.setDensity('compact');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class MlvDensityService {
  /** @private The injected default density, if provided at bootstrap. */
  private readonly _defaultDensity = inject(MLV_DEFAULT_DENSITY, {
    optional: true,
  });

  /**
   * The current application-level density.
   *
   * Components with a density directive and no explicit `[mlvDensity]` input
   * will reflect this value. Use `setDensity()` to change it programmatically.
   */
  readonly density = signal<MlvDensity>(this._defaultDensity ?? 'comfortable');

  /**
   * Set the global density for all density-aware Malva UI components that have
   * not explicitly set their own `[mlvDensity]` input.
   *
   * @param density — The new global density level.
   */
  setDensity(density: MlvDensity): void {
    this.density.set(density);
  }
}
