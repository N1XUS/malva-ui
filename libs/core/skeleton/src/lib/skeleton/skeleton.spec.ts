import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvSkeleton } from './skeleton';

describe('MlvSkeleton', () => {
  let component: MlvSkeleton;
  let fixture: ComponentFixture<MlvSkeleton>;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvSkeleton],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvSkeleton);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Default input values
  // ---------------------------------------------------------------------------

  describe('default inputs', () => {
    it('should apply the block class mlv-skeleton', () => {
      expect(hostEl.classList).toContain('mlv-skeleton');
    });

    it('should default variant to rectangle', () => {
      expect(hostEl.classList).toContain('mlv-skeleton--rectangle');
    });

    it('should default animated to true and apply animated class', () => {
      expect(hostEl.classList).toContain('mlv-skeleton--animated');
    });

    it('should default width to 100%', () => {
      expect(hostEl.style.width).toBe('100%');
    });

    it('should default height to 1rem', () => {
      expect(hostEl.style.height).toBe('1rem');
    });

    it('should always be aria-hidden', () => {
      expect(hostEl.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // ---------------------------------------------------------------------------
  // variant input
  // ---------------------------------------------------------------------------

  describe('variant input', () => {
    it('should apply mlv-skeleton--text class for text variant', () => {
      fixture.componentRef.setInput('variant', 'text');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-skeleton--text');
      expect(hostEl.classList).not.toContain('mlv-skeleton--rectangle');
    });

    it('should apply mlv-skeleton--circle class for circle variant', () => {
      fixture.componentRef.setInput('variant', 'circle');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-skeleton--circle');
      expect(hostEl.classList).not.toContain('mlv-skeleton--rectangle');
    });

    it('should apply mlv-skeleton--rectangle class for rectangle variant', () => {
      fixture.componentRef.setInput('variant', 'rectangle');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-skeleton--rectangle');
    });
  });

  // ---------------------------------------------------------------------------
  // width and height inputs
  // ---------------------------------------------------------------------------

  describe('width and height inputs', () => {
    it('should apply custom width via host style', () => {
      fixture.componentRef.setInput('width', '200px');
      fixture.detectChanges();
      expect(hostEl.style.width).toBe('200px');
    });

    it('should apply custom height via host style', () => {
      fixture.componentRef.setInput('height', '3rem');
      fixture.detectChanges();
      expect(hostEl.style.height).toBe('3rem');
    });

    it('should apply percentage width', () => {
      fixture.componentRef.setInput('width', '75%');
      fixture.detectChanges();
      expect(hostEl.style.width).toBe('75%');
    });
  });

  // ---------------------------------------------------------------------------
  // animated input
  // ---------------------------------------------------------------------------

  describe('animated input', () => {
    it('should add animated class when animated is true', () => {
      fixture.componentRef.setInput('animated', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-skeleton--animated');
    });

    it('should remove animated class when animated is false', () => {
      fixture.componentRef.setInput('animated', false);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-skeleton--animated');
    });

    it('should coerce string "true" to animated', () => {
      fixture.componentRef.setInput('animated', 'true');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-skeleton--animated');
    });

    it('should coerce string "false" to not animated', () => {
      fixture.componentRef.setInput('animated', 'false');
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-skeleton--animated');
    });

    it('should coerce empty string (attribute presence) to true', () => {
      fixture.componentRef.setInput('animated', '');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-skeleton--animated');
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------

  describe('accessibility', () => {
    it('should always have aria-hidden="true"', () => {
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-hidden')).toBe('true');
    });

    it('should not have a role attribute', () => {
      fixture.detectChanges();
      expect(hostEl.getAttribute('role')).toBeNull();
    });
  });
});

/**
 * Accessibility sweep.
 *
 * The skeleton's whole a11y contract is `aria-hidden="true"` on an element that
 * renders no content of its own, so what the sweep is really checking is that
 * the placeholder stays invisible to assistive tech in every variant while the
 * real content around it does not — the `aria-hidden-focus` shape. It is swept
 * inside a loading card next to a live region, which is how a placeholder is
 * actually used.
 */
describe('MlvSkeleton accessibility', () => {
  @Component({
    imports: [MlvSkeleton],
    template: `
      <section aria-busy="true">
        <p role="status">Loading profile…</p>
        <mlv-skeleton variant="circle" width="2.5rem" height="2.5rem" />
        <mlv-skeleton variant="text" width="12rem" />
        <mlv-skeleton variant="text" width="8rem" [animated]="false" />
        <mlv-skeleton
          variant="rectangle"
          height="6rem"
          animationDuration="3s"
        />
      </section>
    `,
  })
  class SkeletonA11yHost {}

  it('has no axe violations for every variant inside a loading region', async () => {
    await TestBed.configureTestingModule({
      imports: [SkeletonA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(SkeletonA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: four placeholders, all three variants, every one hidden and empty
    // — so nothing focusable is buried under `aria-hidden`.
    const skeletons = [...host.querySelectorAll('mlv-skeleton')];
    expect(skeletons).toHaveLength(4);
    expect(
      skeletons.every(
        (el) =>
          el.getAttribute('aria-hidden') === 'true' &&
          el.childElementCount === 0,
      ),
    ).toBe(true);

    await expectNoAxeViolations(host);
  });
});
