import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';

/**
 * The five supported density levels, ordered from smallest to largest.
 *
 * - `tight`       — The most condensed level; maximises information density.
 *                   Interactive elements must still meet WCAG 2.2 SC 2.5.8 (24×24 CSS px target size, level AA).
 * - `compact`     — Reduced spacing; more content fits on screen. Interactive
 *                   elements still meet WCAG 2.2 SC 2.5.8 (24×24 CSS px target size, level AA).
 * - `comfortable` — The default density; balanced spacing for most UIs.
 * - `spacious`    — Increased spacing; improves scannability and touch ease.
 * - `airy`        — The most open level; maximises whitespace and legibility.
 */
export type MlvDensity =
  | 'tight'
  | 'compact'
  | 'comfortable'
  | 'spacious'
  | 'airy';

/**
 * Injection token that a component or directive must provide so that the
 * density directive can build the correct BEM modifier class name.
 *
 * The value must be the BEM block name **without** the `mlv-` prefix.
 *
 * @example
 * ```ts
 * // Generates: mlv-button--compact
 * providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'button' }]
 * ```
 *
 * @example
 * ```ts
 * // Generates: mlv-data-table--spacious
 * providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'data-table' }]
 * ```
 */
export const MLV_DENSITY_ELEMENT = new InjectionToken<string>(
  'MLV_DENSITY_ELEMENT',
);

/**
 * Injection token for providing the application-level default density.
 * Consumed by `MlvDensityService` to initialise its `density` signal.
 *
 * Use `provideMlvDensity()` instead of setting this token directly.
 */
export const MLV_DEFAULT_DENSITY = new InjectionToken<MlvDensity>(
  'MLV_DEFAULT_DENSITY',
);

/**
 * Optional density projected by the nearest density scope above. Every
 * density directive resolves its level in this order:
 *
 * 1. its own explicit `mlvDensity` input,
 * 2. the nearest ancestor `MLV_DENSITY_CONTEXT`, when it holds a value,
 * 3. the global `MlvDensityService`.
 *
 * Every density directive provides it for its descendants, carrying its
 * explicit `mlvDensity`, else the value it inherited, else `undefined` — a
 * scope with no opinion, which readers treat as absent. A container can
 * replace that with {@link provideMlvDensityContext}, which publishes the
 * container's resolved density instead. Directives read it with
 * `{ optional: true, skipSelf: true }` so a host never consumes the context
 * it provides itself.
 */
export const MLV_DENSITY_CONTEXT = new InjectionToken<
  Signal<MlvDensity | undefined>
>('MLV_DENSITY_CONTEXT');
