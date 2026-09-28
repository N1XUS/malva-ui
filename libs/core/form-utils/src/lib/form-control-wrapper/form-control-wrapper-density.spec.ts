import { NgTemplateOutlet } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvDensityDirective, MlvDensityService } from '@malva-ui/cdk/density';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvLabel } from '../label/label';
import { MlvFormControlWrapper } from './form-control-wrapper';
import { MlvFormControlWrapperControl } from './form-control-wrapper-control';

// #364: the wrapper and the label carry no stylesheet-order density any more.
// Each stamps its own modifier from the nearest density scope (DI), so the
// SCSS mixins' `:not(<other levels>)` shuts out every ancestor class.

@Component({
  imports: [
    MlvDensityDirective,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvLabel,
  ],
  // A bare `[mlvDensity]` matches only a static value (its selectors are
  // `[mlvDensity="compact"]` and so on), hence one static scope per level.
  // The field is written out in each scope rather than stamped from one
  // `<ng-template>`: DI — and so density — follows where a template is
  // declared, not where it is rendered (pinned below).
  template: `
    <div mlvDensity="spacious">
      @switch (inner()) {
        @case ('compact') {
          <div mlvDensity="compact">
            <mlv-label>Name</mlv-label>
            <mlv-form-control-wrapper>
              <ng-template mlvFormControlWrapperControl>
                <input aria-label="Name" />
              </ng-template>
            </mlv-form-control-wrapper>
          </div>
        }
        @case ('tight') {
          <div mlvDensity="tight">
            <mlv-label>Name</mlv-label>
            <mlv-form-control-wrapper>
              <ng-template mlvFormControlWrapperControl>
                <input aria-label="Name" />
              </ng-template>
            </mlv-form-control-wrapper>
          </div>
        }
        @case ('comfortable') {
          <div mlvDensity="comfortable">
            <mlv-label>Name</mlv-label>
            <mlv-form-control-wrapper>
              <ng-template mlvFormControlWrapperControl>
                <input aria-label="Name" />
              </ng-template>
            </mlv-form-control-wrapper>
          </div>
        }
        @case ('airy') {
          <div mlvDensity="airy">
            <mlv-label>Name</mlv-label>
            <mlv-form-control-wrapper>
              <ng-template mlvFormControlWrapperControl>
                <input aria-label="Name" />
              </ng-template>
            </mlv-form-control-wrapper>
          </div>
        }
      }
    </div>
    <div class="mlv--compact outside">
      <mlv-form-control-wrapper>
        <ng-template mlvFormControlWrapperControl>
          <input aria-label="Outside" />
        </ng-template>
      </mlv-form-control-wrapper>
    </div>
  `,
})
class NestedScopeHost {
  readonly inner = signal<MlvDensity>('compact');
}

@Component({
  imports: [
    MlvDensityDirective,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    NgTemplateOutlet,
  ],
  template: `
    <ng-template #field>
      <mlv-form-control-wrapper>
        <ng-template mlvFormControlWrapperControl>
          <input aria-label="Declared outside" />
        </ng-template>
      </mlv-form-control-wrapper>
    </ng-template>
    <div mlvDensity="compact">
      <ng-container [ngTemplateOutlet]="field" />
    </div>
  `,
})
class OutletHost {}

const densityClasses = (el: Element, block: string) =>
  [...el.classList].filter(
    (c) =>
      /--(tight|compact|comfortable|spacious|airy)$/.test(c) &&
      c.startsWith(`mlv-${block}--`),
  );

describe('form-control wrapper and label density (#364)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it.each<[MlvDensity]>([['compact'], ['tight'], ['comfortable'], ['airy']])(
    'stamps the nearest scope (spacious > %s)',
    async (inner) => {
      const fixture = TestBed.createComponent(NestedScopeHost);
      fixture.componentInstance.inner.set(inner);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;

      expect(
        densityClasses(
          root.querySelector('mlv-form-control-wrapper') as HTMLElement,
          'form-control-wrapper',
        ),
      ).toEqual([`mlv-form-control-wrapper--${inner}`]);
      expect(
        densityClasses(root.querySelector('mlv-label') as HTMLElement, 'label'),
      ).toEqual([`mlv-label--${inner}`]);
    },
  );

  it('keeps its state modifier beside the density modifier across a flip', async () => {
    const fixture = TestBed.createComponent(OutletHost);
    const service = TestBed.inject(MlvDensityService);
    service.setDensity('compact');
    await fixture.whenStable();
    const wrapper = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-form-control-wrapper',
    ) as HTMLElement;
    expect(densityClasses(wrapper, 'form-control-wrapper')).toEqual([
      'mlv-form-control-wrapper--compact',
    ]);

    // Two host `[class]` bindings on one element — the wrapper's state and the
    // density directive's modifier — merge; each flip replaces only its own.
    service.setDensity('tight');
    await fixture.whenStable();
    expect(
      wrapper.classList.contains('mlv-form-control-wrapper--state-default'),
    ).toBe(true);
    expect(densityClasses(wrapper, 'form-control-wrapper')).toEqual([
      'mlv-form-control-wrapper--tight',
    ]);
  });

  it('is not sized by a hand-written ancestor class, only by a density scope', async () => {
    TestBed.inject(MlvDensityService).setDensity('comfortable');
    const fixture = TestBed.createComponent(NestedScopeHost);
    await fixture.whenStable();
    const outside = (fixture.nativeElement as HTMLElement).querySelector(
      '.outside mlv-form-control-wrapper',
    ) as HTMLElement;

    // `class="mlv--compact"` is no scope: the wrapper resolves the service and
    // its own `--comfortable` excludes the ancestor branch of every mixin.
    expect(densityClasses(outside, 'form-control-wrapper')).toEqual([
      'mlv-form-control-wrapper--comfortable',
    ]);
  });

  it('follows the scope a template is declared in, not the one it is rendered in', async () => {
    TestBed.inject(MlvDensityService).setDensity('spacious');
    const fixture = TestBed.createComponent(OutletHost);
    await fixture.whenStable();
    const wrapper = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-form-control-wrapper',
    ) as HTMLElement;

    // Rendered inside `mlvDensity="compact"`, declared outside every scope:
    // the wrapper resolves the service. The CSS cascade used to follow the DOM.
    expect(densityClasses(wrapper, 'form-control-wrapper')).toEqual([
      'mlv-form-control-wrapper--spacious',
    ]);
  });

  it('has no axe violations', async () => {
    const fixture = TestBed.createComponent(NestedScopeHost);
    await fixture.whenStable();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
