import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvTextarea } from './textarea';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

describe('MlvTextarea', () => {
  let component: MlvTextarea;
  let fixture: ComponentFixture<MlvTextarea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTextarea],
      providers: [provideMlvI18nTesting(), provideAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvTextarea);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update value on input', () => {
    component.onInput({ target: { value: 'hello' } } as unknown as Event);
    expect(component.value()).toBe('hello');
  });

  it('should compute charCount correctly', () => {
    component.value.set('test');
    expect(component.charCount()).toBe(4);
  });

  it('should detect warning state when >90% of maxLength', async () => {
    fixture.componentRef.setInput('maxLength', 10);
    component.value.set('123456789'); // 9/10 = 90%
    await fixture.whenStable();
    expect(component.isCountWarning()).toBe(true);
    expect(component.isCountError()).toBe(false);
  });

  it('should detect error state when at maxLength', async () => {
    fixture.componentRef.setInput('maxLength', 5);
    component.value.set('12345');
    await fixture.whenStable();
    expect(component.isCountError()).toBe(true);
  });

  it('should reflect a value written through the model', () => {
    component.value.set('written');
    expect(component.value()).toBe('written');
    expect(component.hasValue()).toBe(true);
  });

  it('should emit touch on blur', () => {
    let touched = false;
    component.touch.subscribe(() => (touched = true));
    component.onBlur();
    expect(touched).toBe(true);
  });

  it('should clear the value and mark touched via clearValue', () => {
    let touched = false;
    component.value.set('draft');
    component.touch.subscribe(() => (touched = true));
    component.clearValue();
    expect(component.value()).toBe('');
    expect(touched).toBe(true);
  });

  it('should set focused state on focus/blur', () => {
    component.setFocused(true);
    expect(component.focused()).toBe(true);
    component.onBlur();
    expect(component.focused()).toBe(false);
  });

  describe('below-control chrome', () => {
    function textarea(): HTMLTextAreaElement {
      return fixture.nativeElement.querySelector(
        'textarea',
      ) as HTMLTextAreaElement;
    }

    it('renders the character counter in the DOM and describes the textarea with it', async () => {
      fixture.componentRef.setInput('maxLength', 10);
      component.value.set('abc');
      await fixture.whenStable();

      const counter = fixture.nativeElement.querySelector(
        '.mlv-textarea__count',
      ) as HTMLElement;
      expect(counter).not.toBeNull();
      expect(counter.textContent?.trim()).toBe('3/10');
      expect(counter.id).toBe(component.countId());
      expect(textarea().getAttribute('aria-describedby')).toBe(
        component.countId(),
      );
    });

    it('renders no counter and no aria-describedby without maxLength', () => {
      expect(
        fixture.nativeElement.querySelector('.mlv-textarea__count'),
      ).toBeNull();
      expect(textarea().getAttribute('aria-describedby')).toBeNull();
    });

    it('renders the description and message with the ids aria-describedby points at', async () => {
      fixture.componentRef.setInput('description', 'Markdown is supported.');
      fixture.componentRef.setInput('message', 'Too short');
      await fixture.whenStable();

      const description = fixture.nativeElement.querySelector(
        'mlv-description',
      ) as HTMLElement;
      const message = fixture.nativeElement.querySelector(
        'mlv-message',
      ) as HTMLElement;
      expect(description.textContent?.trim()).toBe('Markdown is supported.');

      const describedBy = textarea().getAttribute('aria-describedby') ?? '';
      expect(describedBy.split(' ')).toEqual([description.id, message.id]);
      // Every referenced id must resolve to a real element.
      for (const id of describedBy.split(' ')) {
        expect(fixture.nativeElement.querySelector(`#${id}`)).not.toBeNull();
      }
    });

    it('forwards ariaLabel and required onto the native textarea', async () => {
      fixture.componentRef.setInput('ariaLabel', 'Release notes');
      fixture.componentRef.setInput('required', true);
      await fixture.whenStable();

      expect(textarea().getAttribute('aria-label')).toBe('Release notes');
      expect(textarea().getAttribute('aria-required')).toBe('true');
    });
  });
});
