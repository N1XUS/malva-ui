import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvLoader } from './loader';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

describe('Loader', () => {
  let component: MlvLoader;
  let fixture: ComponentFixture<MlvLoader>;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvLoader],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvLoader);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Default input values
  // ---------------------------------------------------------------------------

  describe('default inputs', () => {
    it('should default variant to bar', () => {
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-loader--bar');
    });

    it('should default tone to default', () => {
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-loader--default');
    });

    it('should default value to 0', () => {
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-valuenow')).toBe('0');
    });

    it('should default max to 100', () => {
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-valuemax')).toBe('100');
    });

    it('should default indeterminate to false', () => {
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-loader--indeterminate');
    });

    it('should default ariaLabel to Loading', () => {
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-label')).toBe('Loading');
    });

    it('should always have role progressbar', () => {
      fixture.detectChanges();
      expect(hostEl.getAttribute('role')).toBe('progressbar');
    });
  });

  // ---------------------------------------------------------------------------
  // hostClasses()
  // ---------------------------------------------------------------------------

  describe('hostClasses()', () => {
    it('should include variant class', () => {
      fixture.componentRef.setInput('variant', 'circle');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-loader--circle');
    });

    it('should include tone class', () => {
      fixture.componentRef.setInput('tone', 'success');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-loader--success');
    });

    it('should include indeterminate class when indeterminate=true', () => {
      fixture.componentRef.setInput('indeterminate', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-loader--indeterminate');
    });

    it('should not include indeterminate class when indeterminate=false', () => {
      fixture.componentRef.setInput('indeterminate', false);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-loader--indeterminate');
    });

    it('should reflect variant + tone + indeterminate together', () => {
      fixture.componentRef.setInput('variant', 'circle');
      fixture.componentRef.setInput('tone', 'danger');
      fixture.componentRef.setInput('indeterminate', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-loader--circle');
      expect(hostEl.classList).toContain('mlv-loader--danger');
      expect(hostEl.classList).toContain('mlv-loader--indeterminate');
    });
  });

  // ---------------------------------------------------------------------------
  // percentage()
  // ---------------------------------------------------------------------------

  describe('percentage()', () => {
    it('should compute percentage from value and max', () => {
      fixture.componentRef.setInput('value', 50);
      fixture.componentRef.setInput('max', 100);
      fixture.detectChanges();
      // aria-valuenow reflects value directly
      expect(hostEl.getAttribute('aria-valuenow')).toBe('50');
    });

    it('should clamp value below 0 to 0%', () => {
      fixture.componentRef.setInput('value', -10);
      fixture.detectChanges();
      // percentage = 0, so --mlv-l-progress = 0
      const progress = (hostEl as HTMLElement).style.getPropertyValue(
        '--mlv-l-progress',
      );
      expect(progress).toBe('0');
    });

    it('should clamp value above max to 100%', () => {
      fixture.componentRef.setInput('value', 150);
      fixture.componentRef.setInput('max', 100);
      fixture.detectChanges();
      const progress = (hostEl as HTMLElement).style.getPropertyValue(
        '--mlv-l-progress',
      );
      expect(progress).toBe('1');
    });

    it('should compute 50% correctly', () => {
      fixture.componentRef.setInput('value', 50);
      fixture.componentRef.setInput('max', 100);
      fixture.detectChanges();
      const progress = (hostEl as HTMLElement).style.getPropertyValue(
        '--mlv-l-progress',
      );
      expect(progress).toBe('0.5');
    });

    it('should work with custom max', () => {
      fixture.componentRef.setInput('value', 25);
      fixture.componentRef.setInput('max', 200);
      fixture.detectChanges();
      const progress = (hostEl as HTMLElement).style.getPropertyValue(
        '--mlv-l-progress',
      );
      expect(progress).toBe('0.125');
    });
  });

  // ---------------------------------------------------------------------------
  // determinate() — ARIA attributes
  // ---------------------------------------------------------------------------

  describe('ARIA attributes', () => {
    it('should expose aria-valuenow in determinate mode', () => {
      fixture.componentRef.setInput('value', 40);
      fixture.componentRef.setInput('indeterminate', false);
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-valuenow')).toBe('40');
      expect(hostEl.getAttribute('aria-valuemin')).toBe('0');
      expect(hostEl.getAttribute('aria-valuemax')).toBe('100');
    });

    it('should omit aria-valuenow/min/max in indeterminate mode', () => {
      fixture.componentRef.setInput('indeterminate', true);
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-valuenow')).toBeNull();
      expect(hostEl.getAttribute('aria-valuemin')).toBeNull();
      expect(hostEl.getAttribute('aria-valuemax')).toBeNull();
    });

    it('should apply custom ariaLabel', () => {
      fixture.componentRef.setInput('ariaLabel', 'Uploading file');
      fixture.detectChanges();
      expect(hostEl.getAttribute('aria-label')).toBe('Uploading file');
    });
  });

  // ---------------------------------------------------------------------------
  // normalizedSize()
  // ---------------------------------------------------------------------------

  describe('normalizedSize()', () => {
    it('should default to 4px for bar variant', () => {
      fixture.componentRef.setInput('variant', 'bar');
      fixture.detectChanges();
      const diameter = hostEl.style.getPropertyValue('--mlv-l-diameter');
      expect(diameter).toBe('4px');
    });

    it('should default to 48px for circle variant', () => {
      fixture.componentRef.setInput('variant', 'circle');
      fixture.detectChanges();
      const diameter = hostEl.style.getPropertyValue('--mlv-l-diameter');
      expect(diameter).toBe('48px');
    });

    it('should use provided size input', () => {
      fixture.componentRef.setInput('size', 64);
      fixture.detectChanges();
      const diameter = hostEl.style.getPropertyValue('--mlv-l-diameter');
      expect(diameter).toBe('64px');
    });
  });

  // ---------------------------------------------------------------------------
  // color input
  // ---------------------------------------------------------------------------

  describe('color input', () => {
    it('should not set --mlv-l-color when color is undefined', () => {
      fixture.detectChanges();
      const colorVar = hostEl.style.getPropertyValue('--mlv-l-color');
      expect(colorVar).toBe('');
    });

    it('should set --mlv-l-color when a color is provided', () => {
      fixture.componentRef.setInput('color', '#ff0000');
      fixture.detectChanges();
      const colorVar = hostEl.style.getPropertyValue('--mlv-l-color');
      expect(colorVar).toBe('#ff0000');
    });

    it('should accept gradient string as color', () => {
      const gradient = 'linear-gradient(90deg, #f00, #00f)';
      fixture.componentRef.setInput('color', gradient);
      fixture.detectChanges();
      const colorVar = hostEl.style.getPropertyValue('--mlv-l-color');
      expect(colorVar).toBe(gradient);
    });
  });

  // ---------------------------------------------------------------------------
  // Circle variant — template
  // ---------------------------------------------------------------------------

  describe('circle variant template', () => {
    it('should render svg for circle variant', () => {
      fixture.componentRef.setInput('variant', 'circle');
      fixture.detectChanges();
      expect(hostEl.querySelector('svg')).toBeTruthy();
    });

    it('should not render svg for bar variant', () => {
      fixture.componentRef.setInput('variant', 'bar');
      fixture.detectChanges();
      expect(hostEl.querySelector('svg')).toBeNull();
    });

    it('should render track and fill circles inside svg', () => {
      fixture.componentRef.setInput('variant', 'circle');
      fixture.detectChanges();
      expect(hostEl.querySelector('.mlv-loader__circle-track')).toBeTruthy();
      expect(hostEl.querySelector('.mlv-loader__circle-fill')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Bar variant — template
  // ---------------------------------------------------------------------------

  describe('bar variant template', () => {
    it('should render __track and __bar elements', () => {
      fixture.componentRef.setInput('variant', 'bar');
      fixture.detectChanges();
      expect(hostEl.querySelector('.mlv-loader__track')).toBeTruthy();
      expect(hostEl.querySelector('.mlv-loader__bar')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // strokeWidth
  // ---------------------------------------------------------------------------

  describe('strokeWidth', () => {
    it('should set --mlv-l-stroke-width CSS variable', () => {
      fixture.componentRef.setInput('strokeWidth', 6);
      fixture.detectChanges();
      const sw = hostEl.style.getPropertyValue('--mlv-l-stroke-width');
      expect(sw).toBe('6px');
    });
  });
});
