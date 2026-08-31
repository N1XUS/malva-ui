import type { Signal } from '@angular/core';
import {
  Directive,
  ElementRef,
  Renderer2,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import type { MlvDensity } from './density.types';
import { MLV_DENSITY_CONTEXT, MLV_DENSITY_ELEMENT } from './density.types';
import { MlvDensityService } from './density.service';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const ALL_DENSITIES: readonly MlvDensity[] = [
  'tight',
  'compact',
  'comfortable',
  'spacious',
  'airy',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Find the density in `supported` that is closest to `requested` on the
 * compact → comfortable → spacious scale.
 *
 * @internal
 */
function _findNearest(
  supported: readonly MlvDensity[],
  requested: MlvDensity,
): MlvDensity {
  const requestedIdx = ALL_DENSITIES.indexOf(requested);
  let best = supported[0];
  let bestDiff = Math.abs(ALL_DENSITIES.indexOf(best) - requestedIdx);

  for (const d of supported) {
    const diff = Math.abs(ALL_DENSITIES.indexOf(d) - requestedIdx);
    if (diff < bestDiff) {
      best = d;
      bestDiff = diff;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Core factory — called inside an Angular injection context
// ---------------------------------------------------------------------------

/**
 * Sets up the density effect for a directive.
 *
 * Must be called inside a directive constructor (within an injection context).
 * Reads the explicit density from `mlvDensityFn`, falls back to the nearest
 * ancestor `MLV_DENSITY_CONTEXT` and then to the global service density,
 * resolves it against `supportedDensities`, then applies the appropriate BEM
 * modifier class (`mlv-{element}--{density}`) to the host.
 *
 * @internal
 */
function _createDensityEffect(
  mlvDensityFn: () => MlvDensity | undefined,
  supportedDensities: readonly MlvDensity[],
): Signal<MlvDensity> {
  const service = inject(MlvDensityService);
  const densityElement = inject(MLV_DENSITY_ELEMENT, { optional: true });
  // `skipSelf`: a container that provides the context for its descendants must
  // not resolve it for its own host directive (that would be circular).
  const context = inject(MLV_DENSITY_CONTEXT, {
    optional: true,
    skipSelf: true,
  });
  const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  const renderer = inject(Renderer2);

  const clamp = (requested: MlvDensity): MlvDensity =>
    supportedDensities.includes(requested)
      ? requested
      : _findNearest(supportedDensities, requested);

  const effectiveDensity = computed<MlvDensity>(() => {
    const explicit = mlvDensityFn();

    if (explicit !== undefined) {
      if (supportedDensities.includes(explicit)) return explicit;

      if (typeof ngDevMode !== 'undefined' && ngDevMode) {
        console.warn(
          `[MlvDensity] Density "${explicit}" is not supported by this component. ` +
            `Supported densities: [${supportedDensities.join(', ')}]. ` +
            `Falling back to nearest: "${_findNearest(supportedDensities, explicit)}".`,
        );
      }
      return _findNearest(supportedDensities, explicit);
    }

    // No explicit input — nearest ancestor context wins over the global service.
    const inherited = context?.();
    if (inherited !== undefined) return clamp(inherited);

    return clamp(service.density());
  });

  if (densityElement) {
    effect(() => {
      const density = effectiveDensity();
      // Remove all density modifier classes, then add the active one
      ALL_DENSITIES.forEach((d) =>
        renderer.removeClass(el, `mlv-${densityElement}--${d}`),
      );
      renderer.addClass(el, `mlv-${densityElement}--${density}`);
    });
  }

  return effectiveDensity;
}

// ---------------------------------------------------------------------------
// Public directives
// ---------------------------------------------------------------------------

/**
 * Density directive that supports all five density levels:
 * `tight`, `compact`, `comfortable`, `spacious`, and `airy`.
 *
 * Apply as a `hostDirective` on components that support the full density
 * range, or use directly in templates on density-aware containers.
 *
 * The host component **must** provide the `MLV_DENSITY_ELEMENT` injection
 * token with its BEM block name so the directive can generate the correct
 * modifier class (e.g., `mlv-button--compact`).
 *
 * If no `[mlvDensity]` input is supplied, the nearest ancestor
 * `MLV_DENSITY_CONTEXT` is used, then the global value from
 * `MlvDensityService`.
 *
 * @example As a hostDirective on a component
 * ```ts
 * @Component({
 *   selector: 'mlv-button',
 *   providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'button' }],
 *   hostDirectives: [{
 *     directive: MlvDensityDirective,
 *     inputs: ['mlvDensity'],
 *   }],
 * })
 * export class MlvButton {}
 * ```
 *
 * @example In a template
 * ```html
 * <mlv-button mlvDensity="compact">Save</mlv-button>
 * <mlv-button mlvDensity="spacious">Save</mlv-button>
 * ```
 */
@Directive({
  selector:
    '[mlvDensity="tight"], [mlvDensity="compact"], [mlvDensity="comfortable"], [mlvDensity="spacious"], [mlvDensity="airy"]',
})
export class MlvDensityDirective {
  /** @private Densities this directive supports (all five levels). */
  private static readonly _SUPPORTED: readonly MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];

  /**
   * The density level to apply to this host element.
   * Falls back to the nearest ancestor `MLV_DENSITY_CONTEXT`, then to the
   * global `MlvDensityService`, when not set.
   */
  readonly mlvDensity = input<MlvDensity | undefined>(undefined);

  /**
   * The resolved density that was actually applied to the host.
   * Useful for programmatic reads or derived state in the component.
   */
  readonly effectiveDensity: Signal<MlvDensity>;

  constructor() {
    this.effectiveDensity = _createDensityEffect(
      () => this.mlvDensity(),
      MlvDensityDirective._SUPPORTED,
    );
  }
}

// ---------------------------------------------------------------------------

/**
 * Density directive restricted to **compact** and **comfortable** only.
 *
 * Use as a `hostDirective` on components that support only these two levels.
 * With no explicit input the directive falls back to the nearest ancestor
 * `MLV_DENSITY_CONTEXT`, then to the global `MlvDensityService`; when the
 * resolved density is `'spacious'`, it clamps to `'comfortable'` (the nearest
 * supported level).
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'mlv-input',
 *   providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'input' }],
 *   hostDirectives: [{
 *     directive: MlvCompactComfortableDensity,
 *     inputs: ['mlvDensity'],
 *   }],
 * })
 * export class MlvInput {}
 * ```
 */
@Directive({
  selector:
    '[mlvDensity="tight"], [mlvDensity="compact"], [mlvDensity="comfortable"]',
})
export class MlvCompactComfortableDensity {
  /** @private Densities this directive supports (tight/compact/comfortable). */
  private static readonly _SUPPORTED: readonly MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
  ];

  /** The density level — `'tight'`, `'compact'`, or `'comfortable'`. */
  readonly mlvDensity = input<'tight' | 'compact' | 'comfortable' | undefined>(
    undefined,
  );

  /** The resolved density that was actually applied to the host. */
  readonly effectiveDensity: Signal<MlvDensity>;

  constructor() {
    this.effectiveDensity = _createDensityEffect(
      () => this.mlvDensity(),
      MlvCompactComfortableDensity._SUPPORTED,
    );
  }
}

// ---------------------------------------------------------------------------

/**
 * Density directive restricted to **comfortable** and **spacious** only.
 *
 * Use as a `hostDirective` on components that do not support compact density.
 * With no explicit input the directive falls back to the nearest ancestor
 * `MLV_DENSITY_CONTEXT`, then to the global `MlvDensityService`; when the
 * resolved density is `'compact'`, it clamps to `'comfortable'` (the nearest
 * supported level).
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'mlv-data-table',
 *   providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'data-table' }],
 *   hostDirectives: [{
 *     directive: MlvComfortableSpaciousDensity,
 *     inputs: ['mlvDensity'],
 *   }],
 * })
 * export class MlvDataTable {}
 * ```
 */
@Directive({
  selector:
    '[mlvDensity="comfortable"], [mlvDensity="spacious"], [mlvDensity="airy"]',
})
export class MlvComfortableSpaciousDensity {
  /** @private Densities this directive supports (comfortable/spacious/airy). */
  private static readonly _SUPPORTED: readonly MlvDensity[] = [
    'comfortable',
    'spacious',
    'airy',
  ];

  /** The density level — `'comfortable'`, `'spacious'`, or `'airy'`. */
  readonly mlvDensity = input<'comfortable' | 'spacious' | 'airy' | undefined>(
    undefined,
  );

  /** The resolved density that was actually applied to the host. */
  readonly effectiveDensity: Signal<MlvDensity>;

  constructor() {
    this.effectiveDensity = _createDensityEffect(
      () => this.mlvDensity(),
      MlvComfortableSpaciousDensity._SUPPORTED,
    );
  }
}

// ---------------------------------------------------------------------------

/**
 * Density directive restricted to **compact** and **spacious** only
 * (skips comfortable).
 *
 * Use as a `hostDirective` on components that have only two density
 * variants without a comfortable middle level. With no explicit input the
 * directive falls back to the nearest ancestor `MLV_DENSITY_CONTEXT`, then to
 * the global `MlvDensityService`; when the resolved density is
 * `'comfortable'`, it clamps to `'compact'` (the nearest supported level).
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'mlv-chip',
 *   providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'chip' }],
 *   hostDirectives: [{
 *     directive: MlvCompactSpaciousDensity,
 *     inputs: ['mlvDensity'],
 *   }],
 * })
 * export class MlvChip {}
 * ```
 */
@Directive({
  selector:
    '[mlvDensity="tight"], [mlvDensity="compact"], [mlvDensity="spacious"], [mlvDensity="airy"]',
})
export class MlvCompactSpaciousDensity {
  /** @private Densities this directive supports (tight/compact/spacious/airy, skipping comfortable). */
  private static readonly _SUPPORTED: readonly MlvDensity[] = [
    'tight',
    'compact',
    'spacious',
    'airy',
  ];

  /** The density level — `'tight'`, `'compact'`, `'spacious'`, or `'airy'`. */
  readonly mlvDensity = input<
    'tight' | 'compact' | 'spacious' | 'airy' | undefined
  >(undefined);

  /** The resolved density that was actually applied to the host. */
  readonly effectiveDensity: Signal<MlvDensity>;

  constructor() {
    this.effectiveDensity = _createDensityEffect(
      () => this.mlvDensity(),
      MlvCompactSpaciousDensity._SUPPORTED,
    );
  }
}
