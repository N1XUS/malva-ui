import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChatTyping } from './chat-typing';
import type { MlvChatUser } from '../chat.types';

function setup(users: MlvChatUser[]): HTMLElement {
  const fixture = TestBed.createComponent(MlvChatTyping);
  fixture.componentRef.setInput('users', users);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MlvChatTyping', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it('renders three animated dots hidden from assistive technology', () => {
    const el = setup([{ id: 'u1', name: 'Robin' }]);
    expect(el.querySelectorAll('.mlv-chat-typing__dot')).toHaveLength(3);
    expect(el.querySelector('.mlv-chat-typing__dots')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the singular label for one user', () => {
    const el = setup([{ id: 'u1', name: 'Robin' }]);
    expect(el.querySelector('.mlv-chat-typing__label')?.textContent?.trim()).toBe('typing…');
  });

  it('renders the plural label with the count for several users', () => {
    const el = setup([
      { id: 'u1', name: 'Robin' },
      { id: 'u2', name: 'Sam' },
    ]);
    expect(el.querySelector('.mlv-chat-typing__label')?.textContent).toContain('2');
  });

  it('names the typing users in the accessible label', () => {
    const el = setup([
      { id: 'u1', name: 'Robin' },
      { id: 'u2', name: 'Sam' },
    ]);
    expect(el.getAttribute('aria-label')).toBe('Robin, Sam');
  });
});
