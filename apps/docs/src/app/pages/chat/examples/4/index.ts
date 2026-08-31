import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvChat } from '@malva-ui/core/chat';
import type { MlvChatMessageData, MlvChatUser } from '@malva-ui/core/chat';

const MINUTE = 60_000;
const now = Date.now();
const PAGE_SIZE = 15;
const TOTAL_HISTORY = 45;

@Component({
  selector: 'docs-chat-pagination-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvChat],
  templateUrl: './index.html',
})
export default class ChatPaginationExampleComponent {
  readonly users: MlvChatUser[] = [
    { id: 'me', name: 'You' },
    { id: 'robin', name: 'Robin Alvarez' },
  ];

  readonly loading = signal(true);
  readonly loadingOlder = signal(false);
  readonly typingUsers = signal<string[]>([]);
  readonly messages = signal<MlvChatMessageData[]>([]);

  /** @private Count of history entries already handed out by the fake backend. */
  private _loadedHistory = 0;

  /** @private Counter behind the ids of newly sent messages. */
  private _liveCounter = 0;

  readonly hasOlder = signal(true);

  constructor() {
    // Simulates the first page arriving from a server.
    setTimeout(() => {
      this.messages.set(this._historyPage());
      this.loading.set(false);
    }, 900);
  }

  /** Simulates fetching one page of older messages and prepending it. */
  onLoadOlder(): void {
    if (this.loadingOlder()) return;
    this.loadingOlder.set(true);
    setTimeout(() => {
      const older = this._historyPage();
      this.messages.update((list) => [...older, ...list]);
      this.hasOlder.set(this._loadedHistory < TOTAL_HISTORY);
      this.loadingOlder.set(false);
    }, 800);
  }

  /** Shows the typing bubble, then appends an incoming message. */
  simulateIncoming(): void {
    this.typingUsers.set(['robin']);
    setTimeout(() => {
      this.typingUsers.set([]);
      this._liveCounter += 1;
      this.messages.update((list) => [
        ...list,
        {
          id: `live-${this._liveCounter}`,
          authorId: 'robin',
          text: `Live message #${this._liveCounter}`,
          timestamp: Date.now(),
        },
      ]);
    }, 12000);
  }

  /** @private Builds the next page of synthetic history, oldest → newest. */
  private _historyPage(): MlvChatMessageData[] {
    const start = this._loadedHistory;
    this._loadedHistory += PAGE_SIZE;
    return Array.from({ length: PAGE_SIZE }, (_, i) => {
      const index = TOTAL_HISTORY - start - PAGE_SIZE + i;
      return {
        id: `h-${index}`,
        authorId: index % 3 === 0 ? 'me' : 'robin',
        text: `History message #${index}`,
        timestamp: now - (TOTAL_HISTORY - index) * 4 * MINUTE,
        status: index % 3 === 0 ? ('read' as const) : undefined,
      };
    });
  }
}
