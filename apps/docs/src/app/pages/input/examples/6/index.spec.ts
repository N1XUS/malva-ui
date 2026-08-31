import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import PasswordStrengthExampleComponent from './index';

describe('PasswordStrengthExampleComponent', () => {
  it('updates the inset meter and toggles password visibility from the appended action', async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordStrengthExampleComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(PasswordStrengthExampleComponent);
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    input.value = 'Malva123!';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector(
      '.mlv-form-control-wrapper__control-container',
    ) as HTMLElement;
    const meter = container.querySelector(
      '.docs-password-strength',
    ) as HTMLElement;
    const activeSegments = meter.querySelectorAll(
      '.docs-password-strength__segment--active',
    );

    expect(activeSegments).toHaveLength(4);
    expect(meter.getAttribute('aria-valuenow')).toBe('4');

    const toggle = fixture.nativeElement.querySelector(
      'button[aria-label="Show password"]',
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
  });
});
