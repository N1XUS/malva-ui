import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChat } from './chat';
import type { MlvChatMessageData } from '../chat.types';

/** Exposes the protected scroll internals the specs drive directly. */
interface ChatScrollInternals {
  _evaluateScroll(scrollTop: number, scrollHeight: number, clientHeight: number): void;
  _renderCount: { (): number; set(value: number): void };
  _pinned: { (): boolean };
  _newCount: { (): number };
}

const msg = (id: string, authorId = 'u1'): MlvChatMessageData => ({
  id,
  authorId,
  text: id,
  timestamp: new Date('2026-07-27T10:00:00'),
});

const many = (count: number, prefix = 'm'): MlvChatMessageData[] =>
  Array.from({ length: count }, (_, i) => msg(`${prefix}${i}`));

@Component({
  imports: [MlvChat],
  template: `
    <mlv-chat
      [messages]="messages()"
      selfId="me"
      [hasOlder]="hasOlder()"
      [loadingOlder]="loadingOlder()"
      [windowSize]="windowSize()"
      (loadOlder)="loadOlderCount.set(loadOlderCount() + 1)"
    />
  `,
})
class ScrollHost {
  readonly chat = viewChild.required(MlvChat);
  readonly messages = signal<MlvChatMessageData[]>([]);
  readonly hasOlder = signal(false);
  readonly loadingOlder = signal(false);
  readonly windowSize = signal(150);
  readonly loadOlderCount = signal(0);
}

describe('MlvChat scroll engine', () => {
  let fixture: ComponentFixture<ScrollHost>;
  let host: ScrollHost;

  function internals(): ChatScrollInternals {
    return host.chat() as unknown as ChatScrollInternals;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    fixture = TestBed.createComponent(ScrollHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('tracks the pinned state from scroll metrics', () => {
    internals()._evaluateScroll(952, 1000, 40);
    expect(internals()._pinned()).toBe(true);

    internals()._evaluateScroll(0, 1000, 40);
    expect(internals()._pinned()).toBe(false);
  });

  it('grows the render window when scrolled near the top', () => {
    host.messages.set(many(300));
    fixture.detectChanges();
    expect(internals()._renderCount()).toBe(150);

    internals()._evaluateScroll(10, 5000, 400);
    expect(internals()._renderCount()).toBe(200);
  });

  it('caps window growth at the message count', () => {
    host.messages.set(many(170));
    fixture.detectChanges();
    internals()._evaluateScroll(10, 5000, 400);
    expect(internals()._renderCount()).toBe(170);
  });

  it('emits loadOlder once the window is exhausted and more history exists', () => {
    host.messages.set(many(100));
    host.hasOlder.set(true);
    fixture.detectChanges();

    internals()._evaluateScroll(10, 1000, 400);
    expect(host.loadOlderCount()).toBe(1);
  });

  it('does not emit loadOlder while the window still has messages left', () => {
    host.messages.set(many(300));
    host.hasOlder.set(true);
    fixture.detectChanges();

    internals()._evaluateScroll(10, 5000, 400);
    expect(host.loadOlderCount()).toBe(0);
  });

  it('does not emit loadOlder without more history', () => {
    host.messages.set(many(100));
    fixture.detectChanges();
    internals()._evaluateScroll(10, 1000, 400);
    expect(host.loadOlderCount()).toBe(0);
  });

  it('does not emit loadOlder while an older page is already loading', () => {
    host.messages.set(many(100));
    host.hasOlder.set(true);
    host.loadingOlder.set(true);
    fixture.detectChanges();

    internals()._evaluateScroll(10, 1000, 400);
    expect(host.loadOlderCount()).toBe(0);
  });

  it('counts messages appended while scrolled up and renders the pill', () => {
    host.messages.set([msg('a')]);
    fixture.detectChanges();
    internals()._evaluateScroll(0, 1000, 40);

    host.messages.set([msg('a'), msg('b')]);
    fixture.detectChanges();

    expect(internals()._newCount()).toBe(1);
    const pill = (fixture.nativeElement as HTMLElement).querySelector('.mlv-chat__pill');
    expect(pill?.textContent).toContain('1');
  });

  it('does not count appended messages while pinned', () => {
    host.messages.set([msg('a')]);
    fixture.detectChanges();
    internals()._evaluateScroll(960, 1000, 40);

    host.messages.set([msg('a'), msg('b')]);
    fixture.detectChanges();

    expect(internals()._newCount()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelector('.mlv-chat__pill')).toBeNull();
  });

  it('does not count prepended older messages', () => {
    host.messages.set([msg('b')]);
    fixture.detectChanges();
    internals()._evaluateScroll(0, 1000, 40);

    host.messages.set([msg('a'), msg('b')]);
    fixture.detectChanges();

    expect(internals()._newCount()).toBe(0);
  });

  it('clears the counter and re-pins when the pill is activated', () => {
    host.messages.set([msg('a')]);
    fixture.detectChanges();
    internals()._evaluateScroll(0, 1000, 40);
    host.messages.set([msg('a'), msg('b')]);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.mlv-chat__pill')
      ?.click();
    fixture.detectChanges();

    expect(internals()._newCount()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelector('.mlv-chat__pill')).toBeNull();
  });

  it('marks only live-appended messages for the enter animation', () => {
    host.messages.set([msg('a'), msg('b')]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.mlv-chat__item--enter')).toHaveLength(0);

    host.messages.set([msg('a'), msg('b'), msg('c')]);
    fixture.detectChanges();
    const entering = el.querySelectorAll('.mlv-chat__item--enter');
    expect(entering).toHaveLength(1);
    expect(entering[0].getAttribute('aria-label')).toBeTruthy();
    expect(el.querySelectorAll('.mlv-chat__item')[2].classList).toContain('mlv-chat__item--enter');
  });

  it('does not mark prepended older messages for the enter animation', () => {
    host.messages.set([msg('b')]);
    fixture.detectChanges();

    host.messages.set([msg('a'), msg('b')]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.mlv-chat__item--enter')).toHaveLength(
      0,
    );
  });

  it('trims the render window back once the user re-pins to the bottom', () => {
    host.messages.set(many(300));
    fixture.detectChanges();
    internals()._evaluateScroll(10, 5000, 400);
    expect(internals()._renderCount()).toBe(200);

    internals()._evaluateScroll(4960, 5000, 40);
    expect(internals()._renderCount()).toBe(150);
  });
});
