// libs/cdk/utils/src/lib/breakpoint/breakpoint.config.ts
import { InjectionToken, type Provider } from '@angular/core';

/** Breakpoint tier name. */
export type MlvBreakpoint = 'sm' | 'md' | 'lg';

/** Configurable pixel thresholds for responsive breakpoints. */
export interface MlvBreakpointConfig {
  /** Min-width for the md (tablet) tier. Default: 768. */
  md: number;
  /** Min-width for the lg (desktop) tier. Default: 1200. */
  lg: number;
}

/** @internal Ordered list of breakpoint names for comparison. */
export const BREAKPOINT_ORDER: readonly MlvBreakpoint[] = ['sm', 'md', 'lg'];

/**
 * Injection token for responsive breakpoint configuration.
 * Override via `provideMlvBreakpoints()` to sync with SCSS overrides.
 */
export const MLV_BREAKPOINT_CONFIG = new InjectionToken<MlvBreakpointConfig>(
  'MLV_BREAKPOINT_CONFIG',
  { providedIn: 'root', factory: () => ({ md: 768, lg: 1200 }) },
);

/**
 * Provides custom breakpoint thresholds to match SCSS overrides.
 *
 * @example
 * providers: [provideMlvBreakpoints({ md: 900, lg: 1440 })]
 */
export function provideMlvBreakpoints(
  config?: Partial<MlvBreakpointConfig>,
): Provider {
  return {
    provide: MLV_BREAKPOINT_CONFIG,
    useValue: { md: 768, lg: 1200, ...config },
  };
}
