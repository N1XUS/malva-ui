import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChat } from './chat';
import { MlvChatAuthorDef } from '../defs/chat-author-def';
import { MlvChatDateDef } from '../defs/chat-date-def';
import { MlvChatMessageDef } from '../defs/chat-message-def';
import type { MlvChatMessageData, MlvChatUser } from '../chat.types';

const USERS: MlvChatUser[] = [
  { id: 'me', name: 'Me' },
  { id: 'u1', name: 'Robin' },
  { id: 'u2', name: 'Sam' },
];

const msg = (
  id: string,
  authorId: string,
  iso: string,
  extra: Partial<MlvChatMessageData> = {},
): MlvChatMessageData => ({ id, authorId, text: id, timestamp: new Date(iso), ...extra });

@Component({
  imports: [MlvChat, MlvChatAuthorDef, MlvChatDateDef, MlvChatMessageDef],
  template: `
    <mlv-chat
      [messages]="messages()"
      [users]="users()"
      selfId="me"
      [loading]="loading()"
      [loadingOlder]="loadingOlder()"
      [hasOlder]="hasOlder()"
      [typingUsers]="typingUsers()"
      [showAuthors]="showAuthors()"
      [dateSeparators]="dateSeparators()"
      (retry)="retried.set($event)"
      (mediaClick)="mediaClicked.set($event)"
      (replyClick)="replyClicked.set($event)"
    >
      @if (withMessageDef()) {
        <ng-template mlvChatMessageDef mlvChatMessageDefType="poll" let-message>
          <span class="custom-poll">{{ message.id }}</span>
        </ng-template>
      }
      @if (withAuthorDef()) {
        <ng-template mlvChatAuthorDef let-user>
          <span class="custom-author">{{ user.name }}</span>
        </ng-template>
      }
      @if (withDateDef()) {
        <ng-template mlvChatDateDef let-date>
          <span class="custom-date">{{ date.getFullYear() }}</span>
        </ng-template>
      }
    </mlv-chat>
  `,
})
class ChatHost {
  readonly chat = viewChild.required(MlvChat);
  readonly messages = signal<MlvChatMessageData[]>([]);
  readonly users = signal<MlvChatUser[]>(USERS);
  readonly loading = signal(false);
  readonly loadingOlder = signal(false);
  readonly hasOlder = signal(false);
  readonly typingUsers = signal<string[]>([]);
  readonly showAuthors = signal<'auto' | boolean>('auto');
  readonly dateSeparators = signal(true);
  readonly retried = signal<MlvChatMessageData | null>(null);
  readonly mediaClicked = signal<unknown>(null);
  readonly replyClicked = signal<unknown>(null);
  readonly withMessageDef = signal(false);
  readonly withAuthorDef = signal(false);
  readonly withDateDef = signal(false);
}

describe('MlvChat', () => {
  let fixture: ComponentFixture<ChatHost>;
  let host: ChatHost;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    fixture = TestBed.createComponent(ChatHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders one group per author run with avatars on other groups only', () => {
    host.messages.set([
      msg('a', 'u1', '2026-07-27T10:00:00'),
      msg('b', 'me', '2026-07-27T10:01:00'),
    ]);
    fixture.detectChanges();
    const groups = el().querySelectorAll('.mlv-chat__group');
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector('mlv-avatar')).toBeTruthy();
    expect(groups[1].querySelector('mlv-avatar')).toBeNull();
    expect(groups[1].classList).toContain('mlv-chat__group--own');
  });

  it('renders date separators between calendar days', () => {
    host.messages.set([
      msg('a', 'u1', '2026-07-26T10:00:00'),
      msg('b', 'u1', '2026-07-27T10:00:00'),
    ]);
    fixture.detectChanges();
    expect(el().querySelectorAll('.mlv-chat__date')).toHaveLength(2);
  });

  it('omits date separators when disabled', () => {
    host.dateSeparators.set(false);
    host.messages.set([msg('a', 'u1', '2026-07-27T10:00:00')]);
    fixture.detectChanges();
    expect(el().querySelectorAll('.mlv-chat__date')).toHaveLength(0);
  });

  it('shows author names above other groups when showAuthors is true', () => {
    host.showAuthors.set(true);
    host.users.set(USERS.slice(0, 2));
    host.messages.set([msg('a', 'u1', '2026-07-27T10:00:00')]);
    fixture.detectChanges();
    expect(el().querySelector('.mlv-chat__author')?.textContent).toContain('Robin');
  });

  it('auto mode shows authors only when more than two users are known', () => {
    host.users.set(USERS.slice(0, 2));
    host.messages.set([msg('a', 'u1', '2026-07-27T10:00:00')]);
    fixture.detectChanges();
    expect(el().querySelector('.mlv-chat__author')).toBeNull();

    host.users.set(USERS);
    fixture.detectChanges();
    expect(el().querySelector('.mlv-chat__author')).toBeTruthy();
  });

  it('never shows the author slot on own groups', () => {
    host.showAuthors.set(true);
    host.messages.set([msg('a', 'me', '2026-07-27T10:00:00')]);
    fixture.detectChanges();
    expect(el().querySelector('.mlv-chat__author')).toBeNull();
  });

  it('renders the [mlvChatAuthorDef] template instead of the default name', () => {
    host.showAuthors.set(true);
    host.withAuthorDef.set(true);
    host.messages.set([msg('a', 'u1', '2026-07-27T10:00:00')]);
    fixture.detectChanges();
    expect(el().querySelector('.custom-author')?.textContent).toContain('Robin');
  });

  it('renders the [mlvChatDateDef] template instead of the default pill', () => {
    host.withDateDef.set(true);
    host.messages.set([msg('a', 'u1', '2026-07-27T10:00:00')]);
    fixture.detectChanges();
    expect(el().querySelector('.custom-date')?.textContent).toBe('2026');
    expect(el().querySelector('mlv-chat-date')).toBeNull();
  });

  it('renders the [mlvChatMessageDef] template for matching message types', () => {
    host.withMessageDef.set(true);
    host.messages.set([
      msg('poll1', 'u1', '2026-07-27T10:00:00', { type: 'poll' }),
      msg('plain', 'u1', '2026-07-27T10:00:30'),
    ]);
    fixture.detectChanges();
    expect(el().querySelector('.custom-poll')?.textContent).toBe('poll1');
    expect(el().querySelectorAll('.mlv-chat-message__text')).toHaveLength(1);
  });

  it('renders skeleton rows while loading and no groups', () => {
    host.loading.set(true);
    host.messages.set([msg('a', 'u1', '2026-07-27T10:00:00')]);
    fixture.detectChanges();
    expect(el().querySelectorAll('.mlv-chat__skeleton').length).toBeGreaterThan(0);
    expect(el().querySelector('.mlv-chat__group')).toBeNull();
  });

  it('renders the older-page loader while loadingOlder', () => {
    host.loadingOlder.set(true);
    fixture.detectChanges();
    expect(el().querySelector('.mlv-chat__older-loader')).toBeTruthy();
  });

  it('renders the typing indicator for known typing users', () => {
    host.typingUsers.set(['u1']);
    fixture.detectChanges();
    expect(el().querySelector('mlv-chat-typing')).toBeTruthy();
  });

  it('re-emits retry with the message', () => {
    host.messages.set([msg('a', 'me', '2026-07-27T10:00:00', { status: 'failed' })]);
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.mlv-chat-message__retry')?.click();
    expect(host.retried()?.id).toBe('a');
  });

  it('re-emits replyClick with both messages', () => {
    const original = msg('r', 'u1', '2026-07-27T09:00:00');
    host.messages.set([msg('a', 'u1', '2026-07-27T10:00:00', { replyTo: original })]);
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.mlv-chat-message__reply')?.click();
    expect(host.replyClicked()).toEqual({ message: expect.objectContaining({ id: 'a' }), replyTo: original });
  });

  it('re-emits mediaClick with the message and attachment', () => {
    const attachment = { id: 'img', kind: 'image' as const, src: 'a.png' };
    host.messages.set([
      msg('a', 'u1', '2026-07-27T10:00:00', { attachments: [attachment] }),
    ]);
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.mlv-chat-media-grid__cell')?.click();
    expect(host.mediaClicked()).toEqual({
      message: expect.objectContaining({ id: 'a' }),
      attachment,
    });
  });

  it('labels each message article with author, time, and status', () => {
    host.messages.set([msg('a', 'me', '2026-07-27T10:00:00', { status: 'read' })]);
    fixture.detectChanges();
    const label = el().querySelector('.mlv-chat__item')?.getAttribute('aria-label');
    expect(label).toContain('Me');
    expect(label).toContain('Read');
  });

  it('marks the viewport as a labelled log region', () => {
    const viewport = el().querySelector('.mlv-chat__viewport');
    expect(viewport?.getAttribute('role')).toBe('log');
    expect(viewport?.getAttribute('aria-label')).toBe('Chat messages');
    expect(viewport?.getAttribute('tabindex')).toBe('0');
  });
});
