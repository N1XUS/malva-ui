import { Component, computed, inject, input, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvComfortableSpaciousDensity, MlvDensityDirective } from './density';
import { MlvDensityService } from './density.service';
import type { MlvDensity } from './density.types';
import {
  MLV_DEFAULT_DENSITY,
  MLV_DENSITY_CONTEXT,
  MLV_DENSITY_ELEMENT,
} from './density.types';
import { provideMlvDensityContext } from './density.providers';

// The contract pinned here (#364, #239):
//
// 1. The modifier class names the element that carries it. `MLV_DENSITY_ELEMENT`
//    is read from the host element alone, so a density directive with no name
//    of its own never borrows an ancestor component's block.
// 2. Every density directive is a density scope: its explicit `mlvDensity`, or
//    the scope it inherited, reaches every density directive below it. A scope
//    with neither is transparent.
// 3. The modifier is a host `[class]` binding, which Angular merges with every
//    other class source on the element.

// ---------------------------------------------------------------------------
// Hosts
// ---------------------------------------------------------------------------

/** A leaf supporting all five levels. */
@Component({
  selector: 'test-leaf',
  template: '',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'leaf' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class Leaf {}

/**
 * A container carrying the density directive and projecting its content, with
 * **no** `provideMlvDensityContext` of its own.
 */
@Component({
  selector: 'test-container',
  template: '<ng-content />',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'container' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class Container {}

/** A restricted (comfortable / spacious / airy) container. */
@Component({
  selector: 'test-restricted',
  template: '<ng-content />',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'restricted' }],
  hostDirectives: [
    { directive: MlvComfortableSpaciousDensity, inputs: ['mlvDensity'] },
  ],
})
class RestrictedContainer {}

/** A component that owns a component-scoped density service set to `tight`. */
@Component({
  selector: 'test-scoped-service',
  template: '<test-leaf />',
  imports: [Leaf],
  providers: [
    { provide: MLV_DEFAULT_DENSITY, useValue: 'tight' },
    MlvDensityService,
  ],
})
class ScopedServiceHost {}

/** A container that publishes its resolved density through the public provider. */
@Component({
  selector: 'test-pinning-container',
  template: '<ng-content />',
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'pinning' },
    provideMlvDensityContext(MlvDensityDirective),
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class PinningContainer {}

/** A container whose own provider pins a constant density for its content. */
@Component({
  selector: 'test-custom-provider',
  template: '<ng-content />',
  providers: [
    {
      provide: MLV_DENSITY_CONTEXT,
      useFactory: () => {
        const density = inject(MlvDensityDirective);
        return computed(() => density.mlvDensity() ?? 'compact');
      },
    },
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class CustomProviderContainer {}

/** A leaf with its own host `[class]` binding beside the density directive's. */
@Component({
  selector: 'test-variant-leaf',
  template: '',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'variant-leaf' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: {
    class: 'mlv-variant-leaf',
    '[class]': '"mlv-variant-leaf--variant-" + variant()',
  },
})
class VariantLeaf {
  readonly variant = input('primary');
}

const classesOf = (el: Element, prefix: string) =>
  [...el.classList].filter((c) => c.startsWith(prefix)).sort();

const q = (fixture: ComponentFixture<unknown>, selector: string) =>
  (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement;

// ---------------------------------------------------------------------------
// 1. The element name is per element (#239)
// ---------------------------------------------------------------------------

@Component({
  imports: [Container, MlvDensityDirective],
  template: `
    <test-container>
      <div class="bare" mlvDensity="compact"></div>
    </test-container>
    <div class="orphan" mlvDensity="spacious"></div>
  `,
})
class BareDirectiveHost {}

describe('MLV_DENSITY_ELEMENT is read from the host element alone (#239)', () => {
  it('a bare [mlvDensity] inside a named component does not borrow its block', async () => {
    const fixture = TestBed.createComponent(BareDirectiveHost);
    await fixture.whenStable();

    const bare = q(fixture, '.bare');
    expect(bare.className).not.toContain('mlv-container--');
    expect(classesOf(bare, 'mlv--')).toEqual(['mlv--compact']);
    // The component itself keeps its own modifier.
    expect(classesOf(q(fixture, 'test-container'), 'mlv-container--')).toEqual([
      'mlv-container--comfortable',
    ]);
  });

  it('a bare [mlvDensity] with no named ancestor stamps the region class', async () => {
    const fixture = TestBed.createComponent(BareDirectiveHost);
    await fixture.whenStable();

    expect(q(fixture, '.orphan').className.trim()).toBe('orphan mlv--spacious');
  });
});

// ---------------------------------------------------------------------------
// 2. Every density directive is a scope
// ---------------------------------------------------------------------------

@Component({
  imports: [Container, Leaf, MlvDensityDirective],
  template: `
    <div class="outer" mlvDensity="spacious">
      <test-container class="middle" [mlvDensity]="inner()">
        <test-leaf class="deep" />
      </test-container>
      <test-leaf class="shallow" />
    </div>
  `,
})
class NestedScopesHost {
  readonly inner = signal<MlvDensity | undefined>('compact');
}

describe('every density directive is a density scope (#364)', () => {
  it('a container explicit density reaches the directives inside it', async () => {
    const fixture = TestBed.createComponent(NestedScopesHost);
    await fixture.whenStable();

    expect(classesOf(q(fixture, '.deep'), 'mlv-leaf--')).toEqual([
      'mlv-leaf--compact',
    ]);
    expect(classesOf(q(fixture, '.shallow'), 'mlv-leaf--')).toEqual([
      'mlv-leaf--spacious',
    ]);
  });

  it.each<[MlvDensity, MlvDensity]>([
    ['compact', 'compact'],
    ['tight', 'tight'],
    ['comfortable', 'comfortable'],
    ['airy', 'airy'],
  ])(
    'the nearest scope wins: spacious > %s resolves %s',
    async (inner, expected) => {
      const fixture = TestBed.createComponent(NestedScopesHost);
      fixture.componentInstance.inner.set(inner);
      await fixture.whenStable();

      expect(classesOf(q(fixture, '.deep'), 'mlv-leaf--')).toEqual([
        `mlv-leaf--${expected}`,
      ]);
    },
  );

  it('a container with no opinion is transparent to the outer scope', async () => {
    const fixture = TestBed.createComponent(NestedScopesHost);
    fixture.componentInstance.inner.set(undefined);
    await fixture.whenStable();

    expect(classesOf(q(fixture, '.middle'), 'mlv-container--')).toEqual([
      'mlv-container--spacious',
    ]);
    expect(classesOf(q(fixture, '.deep'), 'mlv-leaf--')).toEqual([
      'mlv-leaf--spacious',
    ]);
  });

  it('follows the scope when it changes', async () => {
    const fixture = TestBed.createComponent(NestedScopesHost);
    await fixture.whenStable();
    fixture.componentInstance.inner.set('tight');
    await fixture.whenStable();

    expect(classesOf(q(fixture, '.deep'), 'mlv-leaf--')).toEqual([
      'mlv-leaf--tight',
    ]);
  });
});

@Component({
  imports: [Container, ScopedServiceHost],
  template: `
    <test-container>
      <test-scoped-service />
    </test-container>
  `,
})
class TransparentOverScopedServiceHost {}

describe('a scope without an opinion never shadows a nearer density service', () => {
  it('lets a component-scoped MlvDensityService below it apply', async () => {
    TestBed.inject(MlvDensityService).setDensity('spacious');
    const fixture = TestBed.createComponent(TransparentOverScopedServiceHost);
    await fixture.whenStable();

    // The container resolves the root service (spacious) for itself…
    expect(classesOf(q(fixture, 'test-container'), 'mlv-container--')).toEqual([
      'mlv-container--spacious',
    ]);
    // …but publishes nothing, so the leaf reads its own scoped service.
    expect(classesOf(q(fixture, 'test-leaf'), 'mlv-leaf--')).toEqual([
      'mlv-leaf--tight',
    ]);
  });
});

@Component({
  imports: [RestrictedContainer, Leaf],
  template: `
    <test-restricted [mlvDensity]="density()">
      <test-leaf />
    </test-restricted>
  `,
})
class RestrictedScopeHost {
  // `compact` is outside the container's supported set on purpose.
  readonly density = signal<MlvDensity>('compact');
}

describe('a restricted scope publishes the requested density, not its clamp', () => {
  it('clamps itself and hands the requested level on', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(RestrictedScopeHost);
    await fixture.whenStable();

    expect(
      classesOf(q(fixture, 'test-restricted'), 'mlv-restricted--'),
    ).toEqual(['mlv-restricted--comfortable']);
    expect(classesOf(q(fixture, 'test-leaf'), 'mlv-leaf--')).toEqual([
      'mlv-leaf--compact',
    ]);
    warn.mockRestore();
  });
});

@Component({
  imports: [PinningContainer, CustomProviderContainer, ScopedServiceHost, Leaf],
  template: `
    <test-pinning-container>
      <test-scoped-service />
    </test-pinning-container>
    <test-custom-provider>
      <test-leaf class="custom" />
    </test-custom-provider>
  `,
})
class ComponentProvidersHost {}

describe('a component provider beats the density directive own publication', () => {
  it('keeps provideMlvDensityContext publishing the resolved density', async () => {
    TestBed.inject(MlvDensityService).setDensity('spacious');
    const fixture = TestBed.createComponent(ComponentProvidersHost);
    await fixture.whenStable();

    // `provideMlvDensityContext` publishes `effectiveDensity`, which the
    // container resolved from the root service — so it reaches past the
    // nearer scoped service, exactly as before #364.
    expect(
      classesOf(q(fixture, 'test-pinning-container test-leaf'), 'mlv-leaf--'),
    ).toEqual(['mlv-leaf--spacious']);
  });

  it('keeps a hand-written MLV_DENSITY_CONTEXT provider (drawer header shape)', async () => {
    TestBed.inject(MlvDensityService).setDensity('spacious');
    const fixture = TestBed.createComponent(ComponentProvidersHost);
    await fixture.whenStable();

    expect(classesOf(q(fixture, '.custom'), 'mlv-leaf--')).toEqual([
      'mlv-leaf--compact',
    ]);
    // No element name and no explicit density: nothing to say on the host.
    expect(q(fixture, 'test-custom-provider').className).not.toContain('--');
  });
});

// ---------------------------------------------------------------------------
// 3. The modifier is a merged host class binding
// ---------------------------------------------------------------------------

@Component({
  imports: [Leaf, VariantLeaf],
  template: `
    <test-leaf
      class="consumer-static"
      [class.consumer-toggle]="toggle()"
      [class]="consumerMap()"
      [mlvDensity]="density()"
    />
    <test-variant-leaf
      class="consumer-static"
      [variant]="variant()"
      [mlvDensity]="density()"
    />
  `,
})
class ClassMergeHost {
  readonly density = signal<MlvDensity>('compact');
  readonly variant = signal('primary');
  readonly toggle = signal(true);
  readonly consumerMap = signal('consumer-map');
}

describe('the density modifier is a host [class] binding', () => {
  it('replaces the previous modifier and keeps every consumer class', async () => {
    const fixture = TestBed.createComponent(ClassMergeHost);
    await fixture.whenStable();
    const leaf = q(fixture, 'test-leaf');
    expect(classesOf(leaf, 'mlv-leaf--')).toEqual(['mlv-leaf--compact']);

    fixture.componentInstance.density.set('airy');
    await fixture.whenStable();

    expect(classesOf(leaf, 'mlv-leaf--')).toEqual(['mlv-leaf--airy']);
    expect(leaf.classList.contains('consumer-static')).toBe(true);
    expect(leaf.classList.contains('consumer-toggle')).toBe(true);
    expect(leaf.classList.contains('consumer-map')).toBe(true);
  });

  it('merges with the component own host [class] binding in both directions', async () => {
    const fixture = TestBed.createComponent(ClassMergeHost);
    await fixture.whenStable();
    const leaf = q(fixture, 'test-variant-leaf');

    fixture.componentInstance.variant.set('secondary');
    await fixture.whenStable();
    expect(classesOf(leaf, 'mlv-variant-leaf--')).toEqual([
      'mlv-variant-leaf--compact',
      'mlv-variant-leaf--variant-secondary',
    ]);

    fixture.componentInstance.density.set('spacious');
    await fixture.whenStable();
    expect(classesOf(leaf, 'mlv-variant-leaf--')).toEqual([
      'mlv-variant-leaf--spacious',
      'mlv-variant-leaf--variant-secondary',
    ]);
    expect(leaf.classList.contains('mlv-variant-leaf')).toBe(true);
    expect(leaf.classList.contains('consumer-static')).toBe(true);
  });
});
