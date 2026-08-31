import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvChat } from '@malva-ui/core/chat';
import type { MlvChatMessageData, MlvChatUser } from '@malva-ui/core/chat';

const MINUTE = 60_000;
const now = Date.now();

@Component({
  selector: 'docs-chat-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvChat],
  templateUrl: './index.html',
})
export default class ChatBasicExampleComponent {
  readonly users: MlvChatUser[] = [
    { id: 'me', name: 'You' },
    { id: 'robin', name: 'Robin Alvarez' },
  ];

  readonly messages = signal<MlvChatMessageData[]>([
    {
      id: 'm1',
      authorId: 'robin',
      text: 'Morning! Did the deploy finish overnight?',
      timestamp: now - 42 * MINUTE,
    },
    {
      id: 'm2',
      authorId: 'robin',
      text: 'Dashboard still shows the old build number.',
      timestamp: now - 41 * MINUTE,
    },
    {
      id: 'm3',
      authorId: 'me',
      text: 'It did — the CDN cache just needed a purge.',
      timestamp: now - 38 * MINUTE,
      status: 'read',
    },
    {
      id: 'm4',
      authorId: 'me',
      text: 'Give it another minute and hard-refresh.',
      timestamp: now - 38 * MINUTE,
      status: 'delivered',
    },
    {
      id: 'm5',
      authorId: 'robin',
      text: 'Confirmed, new build is live.',
      timestamp: now - 12 * MINUTE,
    },
    {
      id: 'm6',
      authorId: 'me',
      text: 'Sending the release notes now.',
      timestamp: now - 2 * MINUTE,
      status: 'sending',
    },
    {
      id: 'm7',
      authorId: 'me',
      text: 'This one never made it out.',
      timestamp: now - MINUTE,
      status: 'failed',
    },
  ]);

  /** Marks a failed message as sending again. */
  onRetry(message: MlvChatMessageData): void {
    this.messages.update((list) =>
      list.map((item) => (item.id === message.id ? { ...item, status: 'sending' as const } : item)),
    );
  }
}
