import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvStatusIndicator } from './status-indicator';

describe('MlvStatusIndicator', () => {
  let component: MlvStatusIndicator;
  let fixture: ComponentFixture<MlvStatusIndicator>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvStatusIndicator],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvStatusIndicator);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('applies the block class and defaults to the "default" tone', () => {
    expect(host.classList.contains('mlv-status-indicator')).toBe(true);
    expect(host.classList.contains('mlv-status-indicator--tone-default')).toBe(
      true,
    );
  });

  it('reflects the tone input into a modifier class', () => {
    fixture.componentRef.setInput('tone', 'success');
    fixture.detectChanges();
    expect(host.classList.contains('mlv-status-indicator--tone-success')).toBe(
      true,
    );
    expect(host.classList.contains('mlv-status-indicator--tone-default')).toBe(
      false,
    );
  });

  it('supports every semantic tone as a modifier class', () => {
    const tones = [
      'default',
      'primary',
      'secondary',
      'accent',
      'success',
      'info',
      'warning',
      'danger',
    ] as const;
    for (const tone of tones) {
      fixture.componentRef.setInput('tone', tone);
      fixture.detectChanges();
      expect(
        host.classList.contains(`mlv-status-indicator--tone-${tone}`),
      ).toBe(true);
    }
  });

  it('does not add the pulse class by default', () => {
    expect(host.classList.contains('mlv-status-indicator--pulse')).toBe(false);
  });

  it('adds the pulse class when pulse is enabled', () => {
    fixture.componentRef.setInput('pulse', true);
    fixture.detectChanges();
    expect(host.classList.contains('mlv-status-indicator--pulse')).toBe(true);
  });

  it('coerces the pulse attribute (bare attribute usage) to true', () => {
    fixture.componentRef.setInput('pulse', '');
    fixture.detectChanges();
    expect(host.classList.contains('mlv-status-indicator--pulse')).toBe(true);
  });

  it('is decorative (aria-hidden, no role/name) when unlabeled', () => {
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('role')).toBeNull();
    expect(host.getAttribute('aria-label')).toBeNull();
  });

  it('exposes role="img" and an accessible name when labeled', () => {
    fixture.componentRef.setInput('ariaLabel', 'Online');
    fixture.detectChanges();
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('Online');
    expect(host.getAttribute('aria-hidden')).toBeNull();
  });

  it('defaults the dot size to 0.5rem and converts the size input to rem', () => {
    expect(host.style.getPropertyValue('--mlv-status-indicator-size')).toBe(
      '0.5rem',
    );
    fixture.componentRef.setInput('size', 16);
    fixture.detectChanges();
    expect(host.style.getPropertyValue('--mlv-status-indicator-size')).toBe(
      '1rem',
    );
  });
});
