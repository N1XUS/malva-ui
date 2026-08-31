import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChatMessage } from './chat-message';
import type { MlvChatMessageData } from '../chat.types';
import { MLV_CHAT_USERS } from '../chat-tokens';

const base: MlvChatMessageData = {
  id: 'm1',
  authorId: 'u1',
  text: 'hello world',
  timestamp: new Date('2026-07-27T14:32:00'),
};

function setup(
  message: MlvChatMessageData,
  inputs: Record<string, unknown> = {},
): ComponentFixture<MlvChatMessage> {
  const fixture = TestBed.createComponent(MlvChatMessage);
  fixture.componentRef.setInput('message', message);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
}

describe('MlvChatMessage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
  });

  it('renders text content', () => {
    const el = setup(base).nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-message__text')?.textContent).toContain('hello world');
  });

  it('applies own/other and position modifiers', () => {
    const el = setup(base, { own: true, groupPosition: 'first' }).nativeElement as HTMLElement;
    expect(el.classList).toContain('mlv-chat-message--own');
    expect(el.classList).toContain('mlv-chat-message--pos-first');
  });

  it('applies the other modifier by default', () => {
    const el = setup(base).nativeElement as HTMLElement;
    expect(el.classList).toContain('mlv-chat-message--other');
    expect(el.classList).toContain('mlv-chat-message--pos-single');
  });

  it('renders the time in the meta row', () => {
    const el = setup(base).nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-message__time')?.textContent?.trim()).toBeTruthy();
  });

  it.each([
    ['sending', 'mlv-chat-message__status--sending'],
    ['sent', 'mlv-chat-message__status--sent'],
    ['delivered', 'mlv-chat-message__status--delivered'],
    ['read', 'mlv-chat-message__status--read'],
  ] as const)('renders %s status icon on own messages', (status, cls) => {
    const el = setup({ ...base, status }, { own: true }).nativeElement as HTMLElement;
    expect(el.querySelector(`.${cls}`)).toBeTruthy();
  });

  it('hides status on other messages', () => {
    const el = setup({ ...base, status: 'read' }).nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-message__status')).toBeNull();
  });

  it('renders a retry button and emits retry on failed own messages', () => {
    const fixture = setup({ ...base, status: 'failed' }, { own: true });
    const spy = vi.fn();
    fixture.componentInstance.retry.subscribe(spy);
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.mlv-chat-message__retry',
    );
    expect(btn).toBeTruthy();
    btn?.click();
    expect(spy).toHaveBeenCalled();
  });

  it('applies the failed modifier', () => {
    const el = setup({ ...base, status: 'failed' }, { own: true }).nativeElement as HTMLElement;
    expect(el.classList).toContain('mlv-chat-message--failed');
  });

  it('marks status icons aria-hidden', () => {
    const el = setup({ ...base, status: 'read' }, { own: true }).nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-message__status')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('resolves author names through MLV_CHAT_USERS in quote mode', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        {
          provide: MLV_CHAT_USERS,
          useValue: signal(new Map([['u1', { id: 'u1', name: 'Robin' }]])),
        },
      ],
    });
    const el = setup(base, { quote: true }).nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-message__quote-author')?.textContent).toContain('Robin');
  });

  it('does not render meta in quote mode', () => {
    const el = setup(base, { quote: true }).nativeElement as HTMLElement;
    expect(el.querySelector('.mlv-chat-message__meta')).toBeNull();
  });

  describe('reply quote', () => {
    const reply: MlvChatMessageData = {
      id: 'r1',
      authorId: 'u2',
      text: 'original',
      timestamp: new Date('2026-07-27T10:00:00'),
    };

    it('renders replyTo as a condensed quote and emits replyClick', () => {
      const fixture = setup({ ...base, replyTo: reply });
      const spy = vi.fn();
      fixture.componentInstance.replyClick.subscribe(spy);
      const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '.mlv-chat-message__reply',
      );
      expect(btn).toBeTruthy();
      expect(btn?.querySelector('.mlv-chat-message--quote')).toBeTruthy();
      expect(btn?.textContent).toContain('original');
      btn?.click();
      expect(spy).toHaveBeenCalledWith(reply);
    });

    it('renders only one level: a quote whose message has its own replyTo shows a marker', () => {
      const el = setup({
        ...base,
        replyTo: { ...reply, replyTo: { ...base, id: 'deep' } },
      }).nativeElement as HTMLElement;
      const quote = el.querySelector('.mlv-chat-message--quote');
      expect(quote).toBeTruthy();
      expect(quote?.querySelector('.mlv-chat-message__reply')).toBeNull();
      expect(quote?.querySelector('.mlv-chat-message__reply-marker')).toBeTruthy();
    });

    it('shows the reply author name from MLV_CHAT_USERS', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideMlvI18nTesting(),
          {
            provide: MLV_CHAT_USERS,
            useValue: signal(new Map([['u2', { id: 'u2', name: 'Robin' }]])),
          },
        ],
      });
      const el = setup({ ...base, replyTo: reply }).nativeElement as HTMLElement;
      expect(el.querySelector('.mlv-chat-message__quote-author')?.textContent).toContain('Robin');
    });

    it('does not render a reply block in quote mode', () => {
      const el = setup({ ...base, replyTo: reply }, { quote: true }).nativeElement as HTMLElement;
      expect(el.querySelector('.mlv-chat-message__reply')).toBeNull();
    });
  });
});
