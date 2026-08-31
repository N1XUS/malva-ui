import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChat } from './chat';
import type { MlvChatMessageData, MlvChatUser } from '../chat.types';

const USERS: MlvChatUser[] = [
  { id: 'me', name: 'Me' },
  { id: 'u1', name: 'Robin' },
  { id: 'u2', name: 'Sam' },
];

const original: MlvChatMessageData = {
  id: 'orig',
  authorId: 'u1',
  text: 'the original message',
  timestamp: new Date('2026-07-27T09:00:00'),
};

const MESSAGES: MlvChatMessageData[] = [
  { id: 'm1', authorId: 'u1', text: 'plain text', timestamp: new Date('2026-07-27T10:00:00') },
  {
    id: 'm2',
    authorId: 'u2',
    text: 'with media',
    timestamp: new Date('2026-07-27T10:01:00'),
    attachments: [
      { id: 'img1', kind: 'image', src: 'a.png', alt: 'A labelled image' },
      { id: 'img2', kind: 'image', src: 'b.png' },
      { id: 'vid', kind: 'video', src: 'c.mp4', poster: 'c.jpg', duration: 30 },
      { id: 'gif', kind: 'gif', src: 'd.mp4' },
      { id: 'img3', kind: 'image', src: 'e.png' },
    ],
  },
  {
    id: 'm3',
    authorId: 'me',
    text: 'a reply',
    timestamp: new Date('2026-07-27T10:02:00'),
    status: 'read',
    replyTo: original,
  },
  {
    id: 'm4',
    authorId: 'me',
    text: 'failed one',
    timestamp: new Date('2026-07-27T10:03:00'),
    status: 'failed',
  },
  {
    id: 'm5',
    authorId: 'u1',
    timestamp: new Date('2026-07-27T10:04:00'),
    attachments: [{ id: 'aud', kind: 'audio', src: 'voice.mp3', duration: 12 }],
  },
];

@Component({
  imports: [MlvChat],
  template: `
    <mlv-chat [messages]="messages()" [users]="users()" selfId="me" [typingUsers]="['u2']" />
  `,
})
class A11yHost {
  readonly messages = signal(MESSAGES);
  readonly users = signal(USERS);
}

describe('MlvChat accessibility', () => {
  let fixture: ComponentFixture<A11yHost>;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });
    fixture = TestBed.createComponent(A11yHost);
    fixture.detectChanges();
  });

  it('exposes the transcript as a labelled, focusable log region', () => {
    const viewport = el().querySelector('.mlv-chat__viewport');
    expect(viewport?.getAttribute('role')).toBe('log');
    expect(viewport?.getAttribute('aria-label')).toBe('Chat messages');
    expect(viewport?.getAttribute('tabindex')).toBe('0');
  });

  it('gives every interactive control an accessible name', () => {
    const buttons = Array.from(el().querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const name = button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '';
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('gives every image an alt attribute, falling back to the i18n text', () => {
    const images = Array.from(el().querySelectorAll('img'));
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.getAttribute('alt')).not.toBeNull();
    }
    const labels = Array.from(el().querySelectorAll('.mlv-chat-media-grid__cell')).map((cell) =>
      cell.getAttribute('aria-label'),
    );
    expect(labels).toContain('A labelled image');
    expect(labels).toContain('Image attachment');
  });

  it('hides status ticks from assistive technology and states them in the article label', () => {
    for (const status of Array.from(el().querySelectorAll('.mlv-chat-message__status'))) {
      expect(status.getAttribute('aria-hidden')).toBe('true');
    }
    const labels = Array.from(el().querySelectorAll('.mlv-chat__item')).map((item) =>
      item.getAttribute('aria-label'),
    );
    expect(labels.some((label) => label?.includes('Read'))).toBe(true);
    expect(labels.some((label) => label?.includes('Failed to send'))).toBe(true);
  });

  it('renders the retry affordance as a real button', () => {
    const retry = el().querySelector('.mlv-chat-message__retry');
    expect(retry?.tagName).toBe('BUTTON');
    expect(retry?.getAttribute('type')).toBe('button');
  });

  it('has no axe violations for the rules the chat markup can break', async () => {
    const results = await axe.run(el(), {
      runOnly: {
        type: 'rule',
        values: [
          'aria-prohibited-attr',
          'aria-valid-attr-value',
          'aria-required-attr',
          'aria-allowed-role',
          'button-name',
          'image-alt',
          'nested-interactive',
          'duplicate-id-aria',
        ],
      },
    });
    expect(results.violations).toEqual([]);
  }, 20_000);
});
