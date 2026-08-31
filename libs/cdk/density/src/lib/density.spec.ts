import { Component, provideZonelessChangeDetection } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  MlvCompactComfortableDensity,
  MlvCompactSpaciousDensity,
  MlvComfortableSpaciousDensity,
  MlvDensityDirective,
} from './density';
import { MlvDensityService } from './density.service';
import { MLV_DENSITY_ELEMENT } from './density.types';
import { provideMlvDensityContext } from './density.providers';

// ---------------------------------------------------------------------------
// Test host components
// ---------------------------------------------------------------------------

/** Host that supports all five densities */
@Component({
  selector: 'test-all-density',
  template: '<div class="test-all">content</div>',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'test-item' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class AllDensityHost {}

/** Host that supports compact + comfortable only */
@Component({
  selector: 'test-cc-density',
  template: '<div>content</div>',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'cc-item' }],
  hostDirectives: [
    {
      directive: MlvCompactComfortableDensity,
      inputs: ['mlvDensity'],
    },
  ],
})
class CompactComfortableHost {}

/** Host that supports comfortable + spacious only */
@Component({
  selector: 'test-cs-density',
  template: '<div>content</div>',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'cs-item' }],
  hostDirectives: [
    {
      directive: MlvComfortableSpaciousDensity,
      inputs: ['mlvDensity'],
    },
  ],
})
class ComfortableSpacious {}

/** Host that supports compact + spacious only */
@Component({
  selector: 'test-ksp-density',
  template: '<div>content</div>',
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'ksp-item' }],
  hostDirectives: [
    { directive: MlvCompactSpaciousDensity, inputs: ['mlvDensity'] },
  ],
})
class CompactSpacious {}

/** Container that projects its own resolved density to descendants. */
@Component({
  selector: 'test-context-host',
  template: '<test-all-density /><test-cc-density />',
  imports: [AllDensityHost, CompactComfortableHost],
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'ctx' },
    provideMlvDensityContext(MlvDensityDirective),
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class ContextHost {}

/** Container whose child pins its own explicit density. */
@Component({
  selector: 'test-context-explicit-child',
  template: '<test-all-density mlvDensity="airy" />',
  imports: [AllDensityHost],
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'ctx' },
    provideMlvDensityContext(MlvDensityDirective),
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class ContextExplicitChildHost {}

/** Outer container wrapping an inner container. */
@Component({
  selector: 'test-nested-context',
  template: '<test-context-host />',
  imports: [ContextHost],
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'outer' },
    provideMlvDensityContext(MlvDensityDirective),
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
})
class NestedContextHost {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFixture<T>(component: new () => T): ComponentFixture<T> {
  return TestBed.createComponent(component);
}

function hostEl(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

describe('MlvDensityDirective (all densities)', () => {
  let service: MlvDensityService;
  let fixture: ComponentFixture<AllDensityHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(MlvDensityService);
    fixture = createFixture(AllDensityHost);
    fixture.detectChanges();
  });

  it('applies mlv-test-item--comfortable by default (service default)', () => {
    expect(hostEl(fixture).classList).toContain('mlv-test-item--comfortable');
  });

  it('applies mlv-test-item--compact when mlvDensity="compact"', () => {
    fixture.componentRef.setInput('mlvDensity', 'compact');
    fixture.detectChanges();
    const classList = hostEl(fixture).classList;
    expect(classList).toContain('mlv-test-item--compact');
    expect(classList).not.toContain('mlv-test-item--comfortable');
    expect(classList).not.toContain('mlv-test-item--spacious');
  });

  it('applies mlv-test-item--spacious when mlvDensity="spacious"', () => {
    fixture.componentRef.setInput('mlvDensity', 'spacious');
    fixture.detectChanges();
    const classList = hostEl(fixture).classList;
    expect(classList).toContain('mlv-test-item--spacious');
    expect(classList).not.toContain('mlv-test-item--compact');
  });

  it('reflects global service density when no explicit input is set', () => {
    service.setDensity('compact');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-test-item--compact');
  });

  it('switches density when service changes', () => {
    service.setDensity('spacious');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-test-item--spacious');
    service.setDensity('compact');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-test-item--compact');
  });

  it('explicit input takes precedence over service density', () => {
    service.setDensity('spacious');
    fixture.componentRef.setInput('mlvDensity', 'compact');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-test-item--compact');
  });
});

// ---------------------------------------------------------------------------

describe('MlvCompactComfortableDensity', () => {
  let service: MlvDensityService;
  let fixture: ComponentFixture<CompactComfortableHost>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(MlvDensityService);
    fixture = createFixture(CompactComfortableHost);
    fixture.detectChanges();
  });

  it('defaults to comfortable', () => {
    expect(hostEl(fixture).classList).toContain('mlv-cc-item--comfortable');
  });

  it('applies compact when explicitly set', () => {
    fixture.componentRef.setInput('mlvDensity', 'compact');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-cc-item--compact');
  });

  it('falls back to comfortable when global service is spacious', () => {
    service.setDensity('spacious');
    fixture.detectChanges();
    // spacious is not supported → nearest is comfortable
    expect(hostEl(fixture).classList).toContain('mlv-cc-item--comfortable');
    expect(hostEl(fixture).classList).not.toContain('mlv-cc-item--spacious');
  });
});

// ---------------------------------------------------------------------------

describe('MlvComfortableSpaciousDensity', () => {
  let service: MlvDensityService;
  let fixture: ComponentFixture<ComfortableSpacious>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(MlvDensityService);
    fixture = createFixture(ComfortableSpacious);
    fixture.detectChanges();
  });

  it('defaults to comfortable', () => {
    expect(hostEl(fixture).classList).toContain('mlv-cs-item--comfortable');
  });

  it('applies spacious when explicitly set', () => {
    fixture.componentRef.setInput('mlvDensity', 'spacious');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-cs-item--spacious');
  });

  it('falls back to comfortable when global service is compact', () => {
    service.setDensity('compact');
    fixture.detectChanges();
    // compact is not supported → nearest is comfortable
    expect(hostEl(fixture).classList).toContain('mlv-cs-item--comfortable');
    expect(hostEl(fixture).classList).not.toContain('mlv-cs-item--compact');
  });
});

// ---------------------------------------------------------------------------

describe('MlvCompactSpaciousDensity', () => {
  let service: MlvDensityService;
  let fixture: ComponentFixture<CompactSpacious>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(MlvDensityService);
    fixture = createFixture(CompactSpacious);
    fixture.detectChanges();
  });

  it('defaults to compact when global is comfortable (nearest supported)', () => {
    // comfortable is not supported by this directive — compact is nearest
    expect(hostEl(fixture).classList).toContain('mlv-ksp-item--compact');
  });

  it('applies spacious when explicitly set', () => {
    fixture.componentRef.setInput('mlvDensity', 'spacious');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-ksp-item--spacious');
  });

  it('applies compact when explicitly set', () => {
    fixture.componentRef.setInput('mlvDensity', 'compact');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-ksp-item--compact');
  });

  it('falls back to compact when global service is comfortable', () => {
    service.setDensity('comfortable');
    fixture.detectChanges();
    expect(hostEl(fixture).classList).toContain('mlv-ksp-item--compact');
  });
});

// ---------------------------------------------------------------------------

describe('MLV_DENSITY_CONTEXT (ancestor projection)', () => {
  let service: MlvDensityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(MlvDensityService);
  });

  function leaf(
    fixture: ComponentFixture<unknown>,
    selector: string,
  ): HTMLElement {
    return hostEl(fixture).querySelector(selector) as HTMLElement;
  }

  it('descendants follow the container explicit density', () => {
    const fixture = createFixture(ContextHost);
    fixture.componentRef.setInput('mlvDensity', 'compact');
    fixture.detectChanges();
    const child = leaf(fixture, 'test-all-density');
    expect(child.classList).toContain('mlv-test-item--compact');
    expect(child.classList).not.toContain('mlv-test-item--comfortable');
  });

  it('descendants follow the service when the container has no explicit density', () => {
    const fixture = createFixture(ContextHost);
    service.setDensity('spacious');
    fixture.detectChanges();
    expect(leaf(fixture, 'test-all-density').classList).toContain(
      'mlv-test-item--spacious',
    );
  });

  it('a descendant explicit input beats the context', () => {
    const fixture = createFixture(ContextExplicitChildHost);
    fixture.componentRef.setInput('mlvDensity', 'compact');
    fixture.detectChanges();
    expect(leaf(fixture, 'test-all-density').classList).toContain(
      'mlv-test-item--airy',
    );
  });

  it('restricted descendants clamp the context to their supported set', () => {
    const fixture = createFixture(ContextHost);
    fixture.componentRef.setInput('mlvDensity', 'airy');
    fixture.detectChanges();
    expect(leaf(fixture, 'test-cc-density').classList).toContain(
      'mlv-cc-item--comfortable',
    );
  });

  it('nested containers inherit the outer context and re-project it', () => {
    const fixture = createFixture(NestedContextHost);
    fixture.componentRef.setInput('mlvDensity', 'tight');
    fixture.detectChanges();
    expect(leaf(fixture, 'test-context-host').classList).toContain(
      'mlv-ctx--tight',
    );
    expect(leaf(fixture, 'test-all-density').classList).toContain(
      'mlv-test-item--tight',
    );
  });

  it('a container never reads its own context (skipSelf) and keeps the service default', () => {
    // Without skipSelf the factory would inject the directive being constructed
    // → circular DI error thrown by createComponent itself.
    let fixture!: ComponentFixture<ContextHost>;
    expect(() => {
      fixture = createFixture(ContextHost);
      fixture.detectChanges();
    }).not.toThrow();
    expect(hostEl(fixture).classList).toContain('mlv-ctx--comfortable');
  });
});
