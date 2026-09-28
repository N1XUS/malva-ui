import type { Signal } from '@angular/core';
import { Directive, computed, inject, input } from '@angular/core';
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

/**
 * The derived density state every density directive holds.
 *
 * @internal
 */
interface _MlvDensityState {
  /** The level resolved for the host, clamped to the supported set. */
  readonly effectiveDensity: Signal<MlvDensity>;
  /** The modifier the host `[class]` binding writes, or `''` for none. */
  readonly hostClass: Signal<string>;
  /**
   * The level this host hands to the density directives below it: its own
   * explicit input, else the scope it inherited, else `undefined` (no
   * opinion, so a nearer `MlvDensityService` below still applies).
   */
  readonly scope: Signal<MlvDensity | undefined>;
}

// ---------------------------------------------------------------------------
// Core factory — called inside an Angular injection context
// ---------------------------------------------------------------------------

/**
 * Derives the density state for a directive.
 *
 * Must be called inside a directive constructor (within an injection context).
 * Reads the explicit density from `mlvDensityFn`, falls back to the nearest
 * ancestor `MLV_DENSITY_CONTEXT` and then to the global service density, and
 * resolves it against `supportedDensities`. The host class is a pure
 * derivation, written by each directive's host `[class]` binding.
 *
 * @internal
 */
function _createDensityState(
  mlvDensityFn: () => MlvDensity | undefined,
  supportedDensities: readonly MlvDensity[],
): _MlvDensityState {
  const service = inject(MlvDensityService);
  // `self`: the modifier names the element that carries it. Without it a bare
  // `[mlvDensity]` inside a component resolved the component's own provider
  // and stamped `mlv-<component>--<density>` on an unrelated element (#239).
  const densityElement = inject(MLV_DENSITY_ELEMENT, {
    optional: true,
    self: true,
  });
  // `skipSelf`: every density directive provides the context for its
  // descendants, so it must not resolve it for its own host (circular).
  const context = inject(MLV_DENSITY_CONTEXT, {
    optional: true,
    skipSelf: true,
  });

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

  const hostClass = computed(() => {
    if (densityElement) return `mlv-${densityElement}--${effectiveDensity()}`;
    // A directive whose element names no block is a density region, the same
    // class `mlvDensityRoot` writes — but only while it has an opinion.
    return mlvDensityFn() === undefined ? '' : `mlv--${effectiveDensity()}`;
  });

  // Unclamped on purpose: a restricted host sizes itself to its nearest
  // supported level, but hands the requested one on.
  const scope = computed(() => mlvDensityFn() ?? context?.());

  return { effectiveDensity, hostClass, scope };
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
 * The host component provides the `MLV_DENSITY_ELEMENT` injection token with
 * its BEM block name so the directive can generate the correct modifier class
 * (e.g., `mlv-button--compact`). The token is read from the host element only:
 * a directive whose element provides no name writes the region class
 * `mlv--{density}` while it has an explicit `mlvDensity`, and nothing otherwise.
 *
 * If no `[mlvDensity]` input is supplied, the nearest ancestor
 * `MLV_DENSITY_CONTEXT` is used, then the global value from
 * `MlvDensityService`.
 *
 * Every instance is a density scope: it provides `MLV_DENSITY_CONTEXT` to its
 * descendants, carrying its explicit `mlvDensity`, else the scope it
 * inherited, else nothing — so an instance without an opinion is transparent.
 * A component provider of `MLV_DENSITY_CONTEXT` on the same host
 * ({@link provideMlvDensityContext}) takes precedence.
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
 * <div mlvDensity="spacious">…every density-aware control in here…</div>
 * ```
 */
@Directive({
  selector:
    '[mlvDensity="tight"], [mlvDensity="compact"], [mlvDensity="comfortable"], [mlvDensity="spacious"], [mlvDensity="airy"]',
  providers: [
    {
      provide: MLV_DENSITY_CONTEXT,
      useFactory: () => inject(MlvDensityDirective)._scopeDensity,
    },
  ],
  host: { '[class]': '_hostClass()' },
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

  /** @private Derived density state shared by the members below. */
  private readonly _state = _createDensityState(
    () => this.mlvDensity(),
    MlvDensityDirective._SUPPORTED,
  );

  /**
   * The resolved density that was actually applied to the host.
   * Useful for programmatic reads or derived state in the component.
   */
  readonly effectiveDensity: Signal<MlvDensity> = this._state.effectiveDensity;

  /**
   * @internal The level this host publishes as `MLV_DENSITY_CONTEXT`. Public
   * only so the directive's own provider factory can read it.
   */
  readonly _scopeDensity: Signal<MlvDensity | undefined> = this._state.scope;

  /** @protected The density modifier bound as a host class. */
  protected readonly _hostClass = this._state.hostClass;
}

// ---------------------------------------------------------------------------

/**
 * Density directive restricted to **tight**, **compact** and **comfortable**.
 *
 * Use as a `hostDirective` on components that support only these levels.
 * With no explicit input the directive falls back to the nearest ancestor
 * `MLV_DENSITY_CONTEXT`, then to the global `MlvDensityService`; when the
 * resolved density is `'spacious'`, it clamps to `'comfortable'` (the nearest
 * supported level). Like {@link MlvDensityDirective} it is a density scope;
 * it hands on the requested level, not its clamp.
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
  providers: [
    {
      provide: MLV_DENSITY_CONTEXT,
      useFactory: () => inject(MlvCompactComfortableDensity)._scopeDensity,
    },
  ],
  host: { '[class]': '_hostClass()' },
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

  /** @private Derived density state shared by the members below. */
  private readonly _state = _createDensityState(
    () => this.mlvDensity(),
    MlvCompactComfortableDensity._SUPPORTED,
  );

  /** The resolved density that was actually applied to the host. */
  readonly effectiveDensity: Signal<MlvDensity> = this._state.effectiveDensity;

  /**
   * @internal The level this host publishes as `MLV_DENSITY_CONTEXT`. Public
   * only so the directive's own provider factory can read it.
   */
  readonly _scopeDensity: Signal<MlvDensity | undefined> = this._state.scope;

  /** @protected The density modifier bound as a host class. */
  protected readonly _hostClass = this._state.hostClass;
}

// ---------------------------------------------------------------------------

/**
 * Density directive restricted to **comfortable**, **spacious** and **airy**.
 *
 * Use as a `hostDirective` on components that do not support compact density.
 * With no explicit input the directive falls back to the nearest ancestor
 * `MLV_DENSITY_CONTEXT`, then to the global `MlvDensityService`; when the
 * resolved density is `'compact'`, it clamps to `'comfortable'` (the nearest
 * supported level). Like {@link MlvDensityDirective} it is a density scope;
 * it hands on the requested level, not its clamp.
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
  providers: [
    {
      provide: MLV_DENSITY_CONTEXT,
      useFactory: () => inject(MlvComfortableSpaciousDensity)._scopeDensity,
    },
  ],
  host: { '[class]': '_hostClass()' },
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

  /** @private Derived density state shared by the members below. */
  private readonly _state = _createDensityState(
    () => this.mlvDensity(),
    MlvComfortableSpaciousDensity._SUPPORTED,
  );

  /** The resolved density that was actually applied to the host. */
  readonly effectiveDensity: Signal<MlvDensity> = this._state.effectiveDensity;

  /**
   * @internal The level this host publishes as `MLV_DENSITY_CONTEXT`. Public
   * only so the directive's own provider factory can read it.
   */
  readonly _scopeDensity: Signal<MlvDensity | undefined> = this._state.scope;

  /** @protected The density modifier bound as a host class. */
  protected readonly _hostClass = this._state.hostClass;
}

// ---------------------------------------------------------------------------

/**
 * Density directive restricted to **tight**, **compact**, **spacious** and
 * **airy** (skips comfortable).
 *
 * Use as a `hostDirective` on components that have no comfortable middle
 * level. With no explicit input the directive falls back to the nearest
 * ancestor `MLV_DENSITY_CONTEXT`, then to the global `MlvDensityService`; when
 * the resolved density is `'comfortable'`, it clamps to `'compact'` (the
 * nearest supported level). Like {@link MlvDensityDirective} it is a density
 * scope; it hands on the requested level, not its clamp.
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
  providers: [
    {
      provide: MLV_DENSITY_CONTEXT,
      useFactory: () => inject(MlvCompactSpaciousDensity)._scopeDensity,
    },
  ],
  host: { '[class]': '_hostClass()' },
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

  /** @private Derived density state shared by the members below. */
  private readonly _state = _createDensityState(
    () => this.mlvDensity(),
    MlvCompactSpaciousDensity._SUPPORTED,
  );

  /** The resolved density that was actually applied to the host. */
  readonly effectiveDensity: Signal<MlvDensity> = this._state.effectiveDensity;

  /**
   * @internal The level this host publishes as `MLV_DENSITY_CONTEXT`. Public
   * only so the directive's own provider factory can read it.
   */
  readonly _scopeDensity: Signal<MlvDensity | undefined> = this._state.scope;

  /** @protected The density modifier bound as a host class. */
  protected readonly _hostClass = this._state.hostClass;
}
