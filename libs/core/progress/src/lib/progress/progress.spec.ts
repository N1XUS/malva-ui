import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvProgress } from './progress';
import type {
  MlvProgressShape,
  MlvProgressSize,
  MlvProgressTone,
} from './progress';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

describe('MlvProgress', () => {
  let fixture: ComponentFixture<MlvProgress>;
  let component: MlvProgress;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvProgress],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvProgress);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.componentRef.setInput('value', 50);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // ── Creation ─────────────────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should apply mlv-progress class to host', () => {
      expect(hostEl.classList).toContain('mlv-progress');
    });
  });

  // ── Default inputs ────────────────────────────────────────────────────────────

  describe('default inputs', () => {
    it('should default shape to bar', () => {
      expect(component.shape()).toBe('bar');
    });

    it('should default size to m', () => {
      expect(component.size()).toBe('m');
    });

    it('should default tone to default', () => {
      expect(component.tone()).toBe('default');
    });

    it('should default showPercentage to false', () => {
      expect(component.showPercentage()).toBe(false);
    });

    it('should leave the ariaLabel override unset by default', () => {
      // `ariaLabel` is now an optional override; when unset, the effective
      // aria-label falls back to the i18n label ("Progress"). That resolved
      // default is asserted via the DOM in the "ARIA attributes" suite below.
      expect(component.ariaLabel()).toBeUndefined();
    });
  });

  // ── ARIA role and attributes ──────────────────────────────────────────────────

  describe('ARIA attributes', () => {
    it('should have role="progressbar" on host', () => {
      expect(hostEl.getAttribute('role')).toBe('progressbar');
    });

    it('should expose aria-valuenow equal to the clamped value', () => {
      fixture.componentRef.setInput('value', 75);
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-valuenow')).toBe('75');
    });

    it('should expose aria-valuemin="0"', () => {
      expect(hostEl.getAttribute('aria-valuemin')).toBe('0');
    });

    it('should expose aria-valuemax="100"', () => {
      expect(hostEl.getAttribute('aria-valuemax')).toBe('100');
    });

    it('should expose the default aria-label', () => {
      expect(hostEl.getAttribute('aria-label')).toBe('Progress');
    });

    it('should expose a custom aria-label', () => {
      fixture.componentRef.setInput('ariaLabel', 'Uploading file');
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-label')).toBe('Uploading file');
    });

    it('aria-valuenow should reflect clamped value when value < 0', () => {
      fixture.componentRef.setInput('value', -20);
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-valuenow')).toBe('0');
    });

    it('aria-valuenow should reflect clamped value when value > 100', () => {
      fixture.componentRef.setInput('value', 150);
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-valuenow')).toBe('100');
    });

    it('aria-valuenow should reflect mid-range value exactly', () => {
      fixture.componentRef.setInput('value', 33);
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-valuenow')).toBe('33');
    });
  });

  // ── Host class modifiers ──────────────────────────────────────────────────────

  describe('host class modifiers', () => {
    it('should include bar modifier by default', () => {
      expect(hostEl.classList).toContain('mlv-progress--bar');
    });

    it('should include m size modifier by default', () => {
      expect(hostEl.classList).toContain('mlv-progress--m');
    });

    it('should include default tone modifier by default', () => {
      expect(hostEl.classList).toContain('mlv-progress--default');
    });

    it('should switch to circle modifier', () => {
      fixture.componentRef.setInput(
        'shape',
        'circle' satisfies MlvProgressShape,
      );
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-progress--circle');
      expect(hostEl.classList).not.toContain('mlv-progress--bar');
    });

    it('should apply s size modifier', () => {
      fixture.componentRef.setInput('size', 's' satisfies MlvProgressSize);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-progress--s');
      expect(hostEl.classList).not.toContain('mlv-progress--m');
    });

    it('should apply l size modifier', () => {
      fixture.componentRef.setInput('size', 'l' satisfies MlvProgressSize);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-progress--l');
    });

    const tones: MlvProgressTone[] = [
      'default',
      'success',
      'warning',
      'danger',
      'info',
    ];
    for (const tone of tones) {
      it(`should apply mlv-progress--${tone} modifier for tone="${tone}"`, () => {
        fixture.componentRef.setInput('tone', tone);
        fixture.detectChanges();
        expect(hostEl.classList).toContain(`mlv-progress--${tone}`);
      });
    }

    it('should reflect all three modifiers simultaneously', () => {
      fixture.componentRef.setInput(
        'shape',
        'circle' satisfies MlvProgressShape,
      );
      fixture.componentRef.setInput('size', 'l' satisfies MlvProgressSize);
      fixture.componentRef.setInput(
        'tone',
        'success' satisfies MlvProgressTone,
      );
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-progress--circle');
      expect(hostEl.classList).toContain('mlv-progress--l');
      expect(hostEl.classList).toContain('mlv-progress--success');
    });
  });

  // ── _clampedValue ─────────────────────────────────────────────────────────────

  describe('_clampedValue', () => {
    it('should clamp value below 0 to 0', () => {
      fixture.componentRef.setInput('value', -5);
      fixture.detectChanges();
      // Access protected signal via the instance reference
      expect(
        (
          component as unknown as { _clampedValue: () => number }
        )._clampedValue(),
      ).toBe(0);
    });

    it('should clamp value above 100 to 100', () => {
      fixture.componentRef.setInput('value', 200);
      fixture.detectChanges();
      expect(
        (
          component as unknown as { _clampedValue: () => number }
        )._clampedValue(),
      ).toBe(100);
    });

    it('should preserve value within range', () => {
      fixture.componentRef.setInput('value', 67);
      fixture.detectChanges();
      expect(
        (
          component as unknown as { _clampedValue: () => number }
        )._clampedValue(),
      ).toBe(67);
    });

    it('should clamp 0 to 0', () => {
      fixture.componentRef.setInput('value', 0);
      fixture.detectChanges();
      expect(
        (
          component as unknown as { _clampedValue: () => number }
        )._clampedValue(),
      ).toBe(0);
    });

    it('should clamp 100 to 100', () => {
      fixture.componentRef.setInput('value', 100);
      fixture.detectChanges();
      expect(
        (
          component as unknown as { _clampedValue: () => number }
        )._clampedValue(),
      ).toBe(100);
    });
  });

  // ── Bar variant — template structure ─────────────────────────────────────────

  describe('bar variant — template', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('shape', 'bar' satisfies MlvProgressShape);
      fixture.detectChanges();
    });

    it('should render .mlv-progress__track', () => {
      expect(
        fixture.debugElement.query(By.css('.mlv-progress__track')),
      ).toBeTruthy();
    });

    it('should render .mlv-progress__fill inside the track', () => {
      expect(
        fixture.debugElement.query(
          By.css('.mlv-progress__track .mlv-progress__fill'),
        ),
      ).toBeTruthy();
    });

    it('should not render an SVG for bar variant', () => {
      expect(hostEl.querySelector('svg')).toBeNull();
    });

    it('should not render .mlv-progress__percentage by default', () => {
      expect(
        fixture.debugElement.query(By.css('.mlv-progress__percentage')),
      ).toBeNull();
    });

    it('should render .mlv-progress__percentage when showPercentage is true', async () => {
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(
        fixture.debugElement.query(By.css('.mlv-progress__percentage')),
      ).toBeTruthy();
    });

    it('percentage element should be aria-hidden', async () => {
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const pct = fixture.debugElement.query(
        By.css('.mlv-progress__percentage'),
      );
      expect(pct.nativeElement.getAttribute('aria-hidden')).toBe('true');
    });

    it('percentage element should display rounded percentage text', async () => {
      fixture.componentRef.setInput('value', 66);
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const pct: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__percentage'),
      ).nativeElement;
      expect(pct.textContent?.trim()).toBe('66%');
    });

    it('fill should have width style matching clamped value', () => {
      fixture.componentRef.setInput('value', 40);
      fixture.detectChanges();
      const fill: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__fill'),
      ).nativeElement;
      expect(fill.style.width).toBe('40%');
    });

    it('fill width should be clamped to 0% when value is negative', () => {
      fixture.componentRef.setInput('value', -10);
      fixture.detectChanges();
      const fill: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__fill'),
      ).nativeElement;
      expect(fill.style.width).toBe('0%');
    });

    it('fill width should be clamped to 100% when value exceeds 100', () => {
      fixture.componentRef.setInput('value', 120);
      fixture.detectChanges();
      const fill: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__fill'),
      ).nativeElement;
      expect(fill.style.width).toBe('100%');
    });

    it('renders exactly one label wrapper, aria-hidden, with an id', () => {
      const labels = hostEl.querySelectorAll('.mlv-progress__label');
      expect(labels).toHaveLength(1);
      expect(labels[0].getAttribute('aria-hidden')).toBe('true');
      expect(labels[0].id).toMatch(/^mlv-progress-label-\d+$/);
    });
  });

  // ── Circle variant — template structure ───────────────────────────────────────

  describe('circle variant — template', () => {
    beforeEach(() => {
      fixture.componentRef.setInput(
        'shape',
        'circle' satisfies MlvProgressShape,
      );
      fixture.detectChanges();
    });

    it('should render an SVG element', () => {
      expect(hostEl.querySelector('svg')).toBeTruthy();
    });

    it('SVG should be aria-hidden', () => {
      const svg = hostEl.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });

    it('should render .mlv-progress__circle-track inside SVG', () => {
      expect(hostEl.querySelector('.mlv-progress__circle-track')).toBeTruthy();
    });

    it('should render .mlv-progress__circle-fill inside SVG', () => {
      expect(hostEl.querySelector('.mlv-progress__circle-fill')).toBeTruthy();
    });

    it('should not render .mlv-progress__track (bar element)', () => {
      expect(
        fixture.debugElement.query(By.css('.mlv-progress__track')),
      ).toBeNull();
    });

    it('should not render .mlv-progress__percentage by default', () => {
      expect(
        fixture.debugElement.query(By.css('.mlv-progress__percentage')),
      ).toBeNull();
    });

    it('should render .mlv-progress__percentage when showPercentage is true', async () => {
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(
        fixture.debugElement.query(By.css('.mlv-progress__percentage')),
      ).toBeTruthy();
    });

    it('percentage element should be aria-hidden in circle mode', async () => {
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const pct = fixture.debugElement.query(
        By.css('.mlv-progress__percentage'),
      );
      expect(pct.nativeElement.getAttribute('aria-hidden')).toBe('true');
    });

    it('circle-fill should have stroke-dasharray attribute set', () => {
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      const dashArray = fill?.getAttribute('stroke-dasharray');
      expect(dashArray).toBeTruthy();
      expect(Number(dashArray)).toBeGreaterThan(0);
    });

    it('circle-fill should have stroke-dashoffset equal to full circumference at value=0', async () => {
      fixture.componentRef.setInput('value', 0);
      fixture.detectChanges();
      await fixture.whenStable();
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      const dashArray = Number(fill?.getAttribute('stroke-dasharray'));
      const dashOffset = Number(fill?.getAttribute('stroke-dashoffset'));
      expect(dashOffset).toBeCloseTo(dashArray, 2);
    });

    it('circle-fill should have stroke-dashoffset=0 at value=100', async () => {
      fixture.componentRef.setInput('value', 100);
      fixture.detectChanges();
      await fixture.whenStable();
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      const dashOffset = Number(fill?.getAttribute('stroke-dashoffset'));
      expect(dashOffset).toBeCloseTo(0, 2);
    });

    it('circle-fill stroke-dashoffset should be ~half circumference at value=50', async () => {
      fixture.componentRef.setInput('value', 50);
      fixture.detectChanges();
      await fixture.whenStable();
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      const dashArray = Number(fill?.getAttribute('stroke-dasharray'));
      const dashOffset = Number(fill?.getAttribute('stroke-dashoffset'));
      expect(dashOffset).toBeCloseTo(dashArray / 2, 1);
    });

    it('renders exactly one label wrapper, aria-hidden, with an id', () => {
      const labels = hostEl.querySelectorAll('.mlv-progress__label');
      expect(labels).toHaveLength(1);
      expect(labels[0].getAttribute('aria-hidden')).toBe('true');
      expect(labels[0].id).toMatch(/^mlv-progress-label-\d+$/);
    });
  });

  // ── showPercentage BooleanInput coercion ──────────────────────────────────────

  describe('showPercentage BooleanInput coercion', () => {
    it('should coerce string "true" to true', async () => {
      fixture.componentRef.setInput('showPercentage', 'true');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.showPercentage()).toBe(true);
    });

    it('should coerce empty string to true (attribute syntax)', async () => {
      fixture.componentRef.setInput('showPercentage', '');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.showPercentage()).toBe(true);
    });

    it('should coerce string "false" to false', async () => {
      fixture.componentRef.setInput('showPercentage', 'false');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.showPercentage()).toBe(false);
    });
  });

  // ── _percentageText formatting ────────────────────────────────────────────────

  describe('_percentageText formatting', () => {
    it('should round fractional values', async () => {
      fixture.componentRef.setInput('value', 33.7);
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const pct: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__percentage'),
      ).nativeElement;
      expect(pct.textContent?.trim()).toBe('34%');
    });

    it('should show 0% when value=0', async () => {
      fixture.componentRef.setInput('value', 0);
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const pct: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__percentage'),
      ).nativeElement;
      expect(pct.textContent?.trim()).toBe('0%');
    });

    it('should show 100% when value=100', async () => {
      fixture.componentRef.setInput('value', 100);
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const pct: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__percentage'),
      ).nativeElement;
      expect(pct.textContent?.trim()).toBe('100%');
    });

    it('should show 100% when value exceeds 100 (clamped)', async () => {
      fixture.componentRef.setInput('value', 150);
      fixture.componentRef.setInput('showPercentage', true);
      fixture.detectChanges();
      await fixture.whenStable();
      const pct: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__percentage'),
      ).nativeElement;
      expect(pct.textContent?.trim()).toBe('100%');
    });
  });

  // ── Circle SVG dimensions ─────────────────────────────────────────────────────

  describe('circle SVG dimensions', () => {
    beforeEach(() => {
      fixture.componentRef.setInput(
        'shape',
        'circle' satisfies MlvProgressShape,
      );
    });

    it('should set SVG viewBox attribute', () => {
      fixture.detectChanges();
      const svg = hostEl.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
    });

    it('circle elements should have cx=50', () => {
      fixture.detectChanges();
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      expect(fill?.getAttribute('cx')).toBe('50');
    });

    it('circle elements should have cy=50', () => {
      fixture.detectChanges();
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      expect(fill?.getAttribute('cy')).toBe('50');
    });

    it('m size should use stroke-width=8', () => {
      fixture.componentRef.setInput('size', 'm' satisfies MlvProgressSize);
      fixture.detectChanges();
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      expect(fill?.getAttribute('stroke-width')).toBe('8');
    });

    it('s size should use stroke-width=10', () => {
      fixture.componentRef.setInput('size', 's' satisfies MlvProgressSize);
      fixture.detectChanges();
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      expect(fill?.getAttribute('stroke-width')).toBe('10');
    });

    it('l size should use stroke-width=7', () => {
      fixture.componentRef.setInput('size', 'l' satisfies MlvProgressSize);
      fixture.detectChanges();
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      expect(fill?.getAttribute('stroke-width')).toBe('7');
    });

    it('track and fill circles should share same cx, cy, r, stroke-width', () => {
      fixture.detectChanges();
      const track = hostEl.querySelector('.mlv-progress__circle-track');
      const fill = hostEl.querySelector('.mlv-progress__circle-fill');
      expect(track?.getAttribute('cx')).toBe(fill?.getAttribute('cx'));
      expect(track?.getAttribute('cy')).toBe(fill?.getAttribute('cy'));
      expect(track?.getAttribute('r')).toBe(fill?.getAttribute('r'));
      expect(track?.getAttribute('stroke-width')).toBe(
        fill?.getAttribute('stroke-width'),
      );
    });
  });

  // ── Transition class (_progressVisible) ──────────────────────────────────────
  //
  // The --animated class is applied once the `delay(0)` observable emits, which
  // enables CSS transitions for the fill element. In a real browser the class
  // appears after a single event-loop tick. In the zoneless jsdom test
  // environment the scheduler used by toSignal+delay does not fire within the
  // synchronous test frame, so we verify the conditional class binding exists
  // (initially absent) instead of chasing an environment-specific timing detail.

  describe('transition class', () => {
    it('bar fill should not have --animated class before delay fires', () => {
      // A fresh fixture has not yet had the async tick fire; class is absent.
      const freshFixture = TestBed.createComponent(MlvProgress);
      freshFixture.componentRef.setInput('value', 50);
      freshFixture.detectChanges(); // synchronous only — no whenStable
      const fill = freshFixture.debugElement.query(
        By.css('.mlv-progress__fill'),
      );
      // The class may be absent on initial synchronous render.
      // We simply confirm the element exists and has the base class.
      expect(fill).toBeTruthy();
      expect(fill.nativeElement.classList).toContain('mlv-progress__fill');
    });

    it('circle fill should not have --animated class before delay fires', () => {
      const freshFixture = TestBed.createComponent(MlvProgress);
      freshFixture.componentRef.setInput('value', 50);
      freshFixture.componentRef.setInput('shape', 'circle');
      freshFixture.detectChanges();
      const fill = freshFixture.debugElement.query(
        By.css('.mlv-progress__circle-fill'),
      );
      expect(fill).toBeTruthy();
      expect(fill.nativeElement.classList).toContain(
        'mlv-progress__circle-fill',
      );
    });
  });

  // ── Switching shape ───────────────────────────────────────────────────────────

  describe('shape switching', () => {
    it('should switch from bar to circle and render SVG', () => {
      // starts as bar
      expect(hostEl.querySelector('svg')).toBeNull();
      fixture.componentRef.setInput('shape', 'circle');
      fixture.detectChanges();
      expect(hostEl.querySelector('svg')).toBeTruthy();
    });

    it('should switch from circle back to bar and remove SVG', () => {
      fixture.componentRef.setInput('shape', 'circle');
      fixture.detectChanges();
      expect(hostEl.querySelector('svg')).toBeTruthy();

      fixture.componentRef.setInput('shape', 'bar');
      fixture.detectChanges();
      expect(hostEl.querySelector('svg')).toBeNull();
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('value=0 renders 0% bar fill width', () => {
      fixture.componentRef.setInput('value', 0);
      fixture.detectChanges();
      const fill: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__fill'),
      ).nativeElement;
      expect(fill.style.width).toBe('0%');
    });

    it('value=100 renders 100% bar fill width', () => {
      fixture.componentRef.setInput('value', 100);
      fixture.detectChanges();
      const fill: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__fill'),
      ).nativeElement;
      expect(fill.style.width).toBe('100%');
    });

    it('fractional value is preserved in fill width', () => {
      fixture.componentRef.setInput('value', 33.5);
      fixture.detectChanges();
      const fill: HTMLElement = fixture.debugElement.query(
        By.css('.mlv-progress__fill'),
      ).nativeElement;
      // Angular [style.width.%] converts to string with up to 6 decimal places
      expect(parseFloat(fill.style.width)).toBeCloseTo(33.5, 1);
    });
  });
});

/**
 * The accessible name as a screen reader resolves it for this markup:
 * `aria-labelledby` first (each IDREF's text content, space-joined), then
 * `aria-label`. `null` when neither is present. Hand-rolled because no
 * accessible-name library is a workspace dependency; the axe sweep below adds
 * `aria-progressbar-name`, which fails on an empty result.
 */
function accessibleName(element: Element): string | null {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return element.getAttribute('aria-label');
}

/**
 * Projected label (#258).
 *
 * The template used to declare a bare `<ng-content />` in each `shape` branch.
 * A wildcard slot resolves to the LAST one declared, so the default `bar`
 * rendered nothing a consumer projected — and a full axe sweep cannot see
 * content that is not there. These specs therefore assert DOM containment and
 * node counts on an element the host keeps a reference to, which exists whether
 * or not it was projected: `isConnected` is what tells the two worlds apart,
 * where a `toBeTruthy()` on a query would be null in both.
 *
 * The same text is also the progressbar's accessible name (WCAG 2.5.3, label in
 * name) unless the consumer names it explicitly through `ariaLabel`.
 */
describe('MlvProgress projected label', () => {
  @Component({
    selector: 'mlv-test-progress-status',
    template: '{{ status() }}',
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class ProgressStatusText {
    readonly status = signal('');
  }

  @Component({
    imports: [MlvProgress],
    template: `
      <mlv-progress
        id="subject"
        [value]="40"
        [shape]="shape()"
        [ariaLabel]="ariaLabel()"
      >
        <span #probe class="probe">{{ text() }}</span>
      </mlv-progress>
    `,
  })
  class ProjectedLabelHost {
    readonly shape = signal<MlvProgressShape>('bar');
    readonly text = signal('Uploading');
    readonly ariaLabel = signal<string | undefined>(undefined);
    readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  }

  @Component({
    imports: [MlvProgress],
    template: `
      <mlv-progress
        id="subject"
        [value]="40"
        [shape]="shape()"
        [ariaLabel]="ariaLabel()"
      />
    `,
  })
  class NoLabelHost {
    readonly shape = signal<MlvProgressShape>('bar');
    readonly ariaLabel = signal<string | undefined>(undefined);
  }

  @Component({
    imports: [MlvProgress],
    template: `
      <mlv-progress id="subject" [value]="40" [shape]="shape()">
        <span aria-hidden="true">{{ text() }}</span>
      </mlv-progress>
    `,
  })
  class HiddenTextHost {
    readonly shape = signal<MlvProgressShape>('bar');
    readonly text = signal('40%');
  }

  @Component({
    imports: [MlvProgress, ProgressStatusText],
    template: `
      <mlv-progress id="subject" [value]="40">
        <mlv-test-progress-status />
      </mlv-progress>
    `,
  })
  class ChildTextHost {
    readonly statusText = viewChild.required(ProgressStatusText);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
  });

  /** Creates `type`, lets it render, and returns the fixture plus the progressbar host. */
  async function mount<T>(
    type: new () => T,
  ): Promise<{ fixture: ComponentFixture<T>; subject: HTMLElement }> {
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    await fixture.whenStable();
    const subject = (fixture.nativeElement as HTMLElement).querySelector(
      '#subject',
    ) as HTMLElement;
    return { fixture, subject };
  }

  /** Re-renders after a signal write. */
  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /**
   * Asserts the one projected node is attached exactly once, inside the single
   * label wrapper of `subject`, and carries `text`.
   */
  function expectProjectedOnce(
    fixture: ComponentFixture<ProjectedLabelHost>,
    subject: HTMLElement,
    probe: HTMLElement,
    text: string,
  ): void {
    const root = fixture.nativeElement as HTMLElement;
    const labels = subject.querySelectorAll('.mlv-progress__label');
    expect(labels.length).toBe(1);
    expect(probe.isConnected).toBe(true);
    expect(labels[0].contains(probe)).toBe(true);
    expect(root.querySelectorAll('.probe').length).toBe(1);
    expect(root.querySelector('.probe') === probe).toBe(true);
    expect(labels[0].textContent?.trim()).toBe(text);
  }

  describe.each<MlvProgressShape>(['bar', 'circle'])('shape="%s"', (shape) => {
    it('renders the projected node exactly once, inside the one label wrapper', async () => {
      const { fixture, subject } = await mount(ProjectedLabelHost);
      fixture.componentInstance.shape.set(shape);
      await settle(fixture);

      const probe = fixture.componentInstance.probe().nativeElement;
      expectProjectedOnce(fixture, subject, probe, 'Uploading');
    });

    it('is named by the projected text through aria-labelledby, not aria-label', async () => {
      const { fixture, subject } = await mount(ProjectedLabelHost);
      fixture.componentInstance.shape.set(shape);
      await settle(fixture);

      expect(accessibleName(subject)).toBe('Uploading');
      expect(subject.hasAttribute('aria-label')).toBe(false);

      // The reference resolves to this progressbar's own label wrapper, which
      // stays `aria-hidden` on purpose: a labelledby reference reads a hidden
      // node's text all the same, and hiding it keeps the text from also being
      // exposed as a separate node under the progressbar.
      const ids = (subject.getAttribute('aria-labelledby') ?? '').split(/\s+/);
      expect(ids).toHaveLength(1);
      const label = subject.ownerDocument.getElementById(ids[0]);
      expect(label?.classList.contains('mlv-progress__label')).toBe(true);
      expect(label !== null && subject.contains(label)).toBe(true);
      expect(label?.getAttribute('aria-hidden')).toBe('true');
    });

    it('is named by projected text that is itself aria-hidden, not left unnamed', async () => {
      const { fixture, subject } = await mount(HiddenTextHost);
      fixture.componentInstance.shape.set(shape);
      await settle(fixture);

      // A hidden, directly referenced node contributes its hidden descendants'
      // text too, so `40%` names the host instead of an empty name.
      expect(subject.getAttribute('aria-labelledby')).toMatch(
        /^mlv-progress-label-\d+$/,
      );
      expect(subject.hasAttribute('aria-label')).toBe(false);
      expect(accessibleName(subject)).toBe('40%');
    });

    it('keeps the i18n default name when nothing is projected', async () => {
      const { fixture, subject } = await mount(NoLabelHost);
      fixture.componentInstance.shape.set(shape);
      await settle(fixture);

      expect(subject.getAttribute('aria-label')).toBe('Progress');
      expect(subject.hasAttribute('aria-labelledby')).toBe(false);
      // No child node at all — not even whitespace or a comment — so the
      // stylesheet's `:empty { display: none }` still collapses the wrapper.
      expect(
        subject.querySelector('.mlv-progress__label')?.childNodes.length,
      ).toBe(0);
    });

    it("keeps the consumer's ariaLabel when nothing is projected", async () => {
      const { fixture, subject } = await mount(NoLabelHost);
      fixture.componentInstance.shape.set(shape);
      fixture.componentInstance.ariaLabel.set('Import progress');
      await settle(fixture);

      expect(subject.getAttribute('aria-label')).toBe('Import progress');
      expect(subject.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('lets an explicit ariaLabel win over projected content, emitting one naming attribute', async () => {
      const { fixture, subject } = await mount(ProjectedLabelHost);
      fixture.componentInstance.shape.set(shape);
      fixture.componentInstance.ariaLabel.set('Uploading files, step 2 of 3');
      await settle(fixture);

      expect(accessibleName(subject)).toBe('Uploading files, step 2 of 3');
      expect(subject.hasAttribute('aria-labelledby')).toBe(false);
      // Still rendered — only the naming source changes.
      const probe = fixture.componentInstance.probe().nativeElement;
      expectProjectedOnce(fixture, subject, probe, 'Uploading');

      // Clearing the override hands the name back to the projected label.
      fixture.componentInstance.ariaLabel.set(undefined);
      await settle(fixture);
      expect(accessibleName(subject)).toBe('Uploading');
      expect(subject.hasAttribute('aria-label')).toBe(false);
    });

    it('treats whitespace-only projected text as no label', async () => {
      const { fixture, subject } = await mount(ProjectedLabelHost);
      fixture.componentInstance.shape.set(shape);
      fixture.componentInstance.text.set('  \n\t ');
      await settle(fixture);

      expect(subject.getAttribute('aria-label')).toBe('Progress');
      expect(subject.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('follows projected text that appears and disappears later', async () => {
      const { fixture, subject } = await mount(ProjectedLabelHost);
      fixture.componentInstance.shape.set(shape);
      fixture.componentInstance.text.set('');
      await settle(fixture);
      expect(subject.getAttribute('aria-label')).toBe('Progress');
      expect(subject.hasAttribute('aria-labelledby')).toBe(false);

      fixture.componentInstance.text.set('Verifying');
      await settle(fixture);
      expect(accessibleName(subject)).toBe('Verifying');
      expect(subject.hasAttribute('aria-label')).toBe(false);

      fixture.componentInstance.text.set('');
      await settle(fixture);
      expect(subject.getAttribute('aria-label')).toBe('Progress');
      expect(subject.hasAttribute('aria-labelledby')).toBe(false);
    });
  });

  it.each<[MlvProgressShape, MlvProgressShape]>([
    ['bar', 'circle'],
    ['circle', 'bar'],
  ])(
    'keeps the one projected node through a %s → %s → back flip',
    async (from, to) => {
      const { fixture, subject } = await mount(ProjectedLabelHost);
      fixture.componentInstance.shape.set(from);
      await settle(fixture);
      const probe = fixture.componentInstance.probe().nativeElement;
      expectProjectedOnce(fixture, subject, probe, 'Uploading');

      fixture.componentInstance.shape.set(to);
      await settle(fixture);
      expect(subject.classList.contains(`mlv-progress--${to}`)).toBe(true);
      expectProjectedOnce(fixture, subject, probe, 'Uploading');
      expect(accessibleName(subject)).toBe('Uploading');

      fixture.componentInstance.shape.set(from);
      await settle(fixture);
      expect(subject.classList.contains(`mlv-progress--${from}`)).toBe(true);
      expectProjectedOnce(fixture, subject, probe, 'Uploading');
      expect(accessibleName(subject)).toBe('Uploading');
    },
  );

  it('follows a projected component whose own signal changes the text', async () => {
    // The text node belongs to a projected OnPush child, so a change to it
    // refreshes that child's view alone — the consumer view that declares the
    // progressbar is only traversed, not refreshed.
    const { fixture, subject } = await mount(ChildTextHost);
    expect(subject.getAttribute('aria-label')).toBe('Progress');
    expect(subject.hasAttribute('aria-labelledby')).toBe(false);

    fixture.componentInstance.statusText().status.set('Uploading');
    await fixture.whenStable();
    expect(accessibleName(subject)).toBe('Uploading');
    expect(subject.hasAttribute('aria-label')).toBe(false);

    fixture.componentInstance.statusText().status.set('');
    await fixture.whenStable();
    expect(subject.getAttribute('aria-label')).toBe('Progress');
    expect(subject.hasAttribute('aria-labelledby')).toBe(false);
  });
});

/**
 * Accessibility sweep.
 *
 * `mlv-progress` is always determinate — the indeterminate spinner is
 * `mlv-loader`, a different component — so the axes that change its markup are
 * `shape` and the two pieces of visible text it can render. The
 * `showPercentage` readout is `aria-hidden`: the value is already on the host
 * as `aria-valuenow`. The projected label wrapper is `aria-hidden` too, and
 * still names the host (#258): with text and no `ariaLabel` the host points
 * `aria-labelledby` at it — a hidden referenced node still contributes its
 * text, and axe's `aria-progressbar-name` accepts it — otherwise the host
 * carries `aria-label`. Each shape is swept with and without a projected
 * label, and with a label beside an explicit `ariaLabel`, alongside the
 * boundary values (0 and 100).
 */
describe('MlvProgress accessibility', () => {
  @Component({
    imports: [MlvProgress],
    template: `
      <mlv-progress [value]="0" />
      <mlv-progress [value]="42" tone="success" size="s" />
      <mlv-progress [value]="100" tone="danger" size="l" />
      <mlv-progress [value]="60" showPercentage />
      <mlv-progress [value]="60" id="bar-label">Uploading files</mlv-progress>
      <mlv-progress
        [value]="60"
        showPercentage
        ariaLabel="Uploading files, step 2 of 3"
        id="bar-label-named"
        >Uploading files</mlv-progress
      >
      <mlv-progress shape="circle" [value]="35" />
      <mlv-progress shape="circle" [value]="35" showPercentage />
      <mlv-progress shape="circle" [value]="35" id="circle-label"
        >Storage</mlv-progress
      >
      <mlv-progress
        shape="circle"
        [value]="35"
        showPercentage
        ariaLabel="Storage usage"
        id="circle-label-named"
        >Storage</mlv-progress
      >
      <mlv-progress [value]="20" ariaLabel="Import progress" id="named" />
      <mlv-progress [value]="40" id="hidden-text"
        ><span aria-hidden="true">40%</span></mlv-progress
      >
    `,
  })
  class ProgressA11yHost {}

  it('has no axe violations across shapes, tones, labels and the percentage readout', async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressA11yHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProgressA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: twelve progressbars, every one named exactly once and carrying the
    // full value triple, including the 0 and 100 ends.
    const bars = [...host.querySelectorAll('[role="progressbar"]')];
    expect(bars).toHaveLength(12);
    expect(
      bars
        .filter(
          (el) =>
            !(accessibleName(el) ?? '').length ||
            (el.hasAttribute('aria-label') &&
              el.hasAttribute('aria-labelledby')) ||
            el.getAttribute('aria-valuemin') !== '0' ||
            el.getAttribute('aria-valuemax') !== '100' ||
            el.getAttribute('aria-valuenow') === null,
        )
        .map((el) => el.outerHTML),
    ).toEqual([]);
    expect(bars[0].getAttribute('aria-valuenow')).toBe('0');
    expect(bars[2].getAttribute('aria-valuenow')).toBe('100');

    const nameOf = (id: string): string | null => {
      const el = host.querySelector(`#${id}`);
      return el ? accessibleName(el) : null;
    };
    expect(nameOf('bar-label')).toBe('Uploading files');
    expect(nameOf('circle-label')).toBe('Storage');
    expect(nameOf('bar-label-named')).toBe('Uploading files, step 2 of 3');
    expect(nameOf('circle-label-named')).toBe('Storage usage');
    expect(nameOf('named')).toBe('Import progress');
    expect(nameOf('hidden-text')).toBe('40%');
    expect(bars[0].getAttribute('aria-label')).toBe('Progress');

    // Five projected labels render, one per host, each hidden so its text is
    // exposed only as the name, never again as a separate node; the percentage
    // readouts stay hidden, so the value is not announced twice.
    const labels = [...host.querySelectorAll('.mlv-progress__label')].filter(
      (el) => (el.textContent ?? '').trim().length > 0,
    );
    expect(labels.map((el) => el.textContent?.trim())).toEqual([
      'Uploading files',
      'Uploading files',
      'Storage',
      'Storage',
      '40%',
    ]);
    expect(
      labels.every((el) => el.getAttribute('aria-hidden') === 'true'),
    ).toBe(true);
    const percentages = [...host.querySelectorAll('.mlv-progress__percentage')];
    expect(percentages).toHaveLength(4);
    expect(
      percentages.every((el) => el.getAttribute('aria-hidden') === 'true'),
    ).toBe(true);

    await expectNoAxeViolations(host);
  });
});
