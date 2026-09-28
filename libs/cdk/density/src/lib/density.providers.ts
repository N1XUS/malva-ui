import type {
  EnvironmentProviders,
  Provider,
  Signal,
  Type,
} from '@angular/core';
import { inject, makeEnvironmentProviders } from '@angular/core';
import type { MlvDensity } from './density.types';
import { MLV_DEFAULT_DENSITY, MLV_DENSITY_CONTEXT } from './density.types';

/**
 * Configures the application-level default density for Malva UI components.
 *
 * Call this function in your application's `providers` array (typically in
 * `app.config.ts`) to set the initial density for all density-aware Malva UI
 * components. Individual components can still override it via the
 * `[mlvDensity]` input.
 *
 * @param density — The default density level to apply globally.
 *
 * @example
 * ```ts
 * // app.config.ts
 * import { provideMlvDensity } from '@malva-ui/cdk/density';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMlvDensity('compact'),
 *   ],
 * };
 * ```
 */
export function provideMlvDensity(density: MlvDensity): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: MLV_DEFAULT_DENSITY, useValue: density },
  ]);
}

/**
 * Anything exposing a resolved density signal — every density directive
 * (`MlvDensityDirective`, `MlvCompactComfortableDensity`, …) qualifies.
 */
export interface MlvDensityContextSource {
  readonly effectiveDensity: Signal<MlvDensity>;
}

/**
 * Makes a container project its **resolved** density to every density-aware
 * descendant. Add to the container's `providers` next to its density host
 * directive; the descendant directives resolve `MLV_DENSITY_CONTEXT` before
 * falling back to `MlvDensityService`.
 *
 * Every density directive is already a scope that hands on its explicit
 * `mlvDensity` (or the scope it inherited) and nothing else. This provider
 * replaces that on its host — a component provider beats a host directive's —
 * with the container's `effectiveDensity`, which is never `undefined`: the
 * container pins what it resolved, service included, so a component-scoped
 * `MlvDensityService` below it no longer applies.
 *
 * @param source — The density directive class hosted on the same element.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'form[mlvForm]',
 *   hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
 *   providers: [
 *     { provide: MLV_DENSITY_ELEMENT, useValue: 'form' },
 *     provideMlvDensityContext(MlvDensityDirective),
 *   ],
 * })
 * export class MlvForm {}
 * ```
 */
export function provideMlvDensityContext(
  source: Type<MlvDensityContextSource>,
): Provider {
  return {
    provide: MLV_DENSITY_CONTEXT,
    useFactory: () => inject(source).effectiveDensity,
  };
}
