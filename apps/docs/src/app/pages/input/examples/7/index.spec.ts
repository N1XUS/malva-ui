import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import PasswordStrengthEmojiExampleComponent from './index';

describe('PasswordStrengthEmojiExampleComponent', () => {
  it('renders a consumer-defined emoji in the append slot from the directive score', async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordStrengthEmojiExampleComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      PasswordStrengthEmojiExampleComponent,
    );
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    input.value = 'Malva123!';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const emoji = fixture.nativeElement.querySelector(
      '.docs-password-emoji',
    ) as HTMLElement;

    expect(emoji.textContent).toContain('💪');
    expect(emoji.getAttribute('aria-label')).toBe('Strong password strength');
    expect(
      emoji.closest('.mlv-form-control-wrapper__side-content'),
    ).toBeTruthy();
  });
});
