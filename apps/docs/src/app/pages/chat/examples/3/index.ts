import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvChat, MlvChatAuthorDef, MlvChatDateDef, MlvChatMessageDef } from '@malva-ui/core/chat';
import type { MlvChatMessageData, MlvChatUser } from '@malva-ui/core/chat';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const now = Date.now();

/** Payload of the custom `poll` message type. */
interface PollData {
  question: string;
  options: { label: string; votes: number }[];
}

@Component({
  selector: 'docs-chat-custom-defs-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MlvAvatar,
    MlvBadge,
    MlvChat,
    MlvChatAuthorDef,
    MlvChatDateDef,
    MlvChatMessageDef,
  ],
  templateUrl: './index.html',
})
export default class ChatCustomDefsExampleComponent {
  readonly users: MlvChatUser[] = [
    { id: 'me', name: 'You' },
    { id: 'robin', name: 'Robin Alvarez' },
    { id: 'sam', name: 'Sam Okonkwo' },
  ];

  readonly messages = signal<MlvChatMessageData<PollData>[]>([
    {
      id: 'm1',
      authorId: 'robin',
      text: 'Kicking off planning for the offsite.',
      timestamp: now - DAY - 30 * MINUTE,
    },
    {
      id: 'm2',
      authorId: 'sam',
      type: 'poll',
      timestamp: now - 45 * MINUTE,
      data: {
        question: 'Which week works best?',
        options: [
          { label: 'Week of the 12th', votes: 4 },
          { label: 'Week of the 19th', votes: 7 },
          { label: 'Week of the 26th', votes: 2 },
        ],
      },
    },
    {
      id: 'm3',
      authorId: 'me',
      text: 'Voted — the 19th works for the whole team.',
      timestamp: now - 20 * MINUTE,
      status: 'read',
    },
  ]);

  /**
   * Narrows the untyped `data` payload of a custom message back to `PollData`.
   * The def template context is type-agnostic, so the consumer owns the cast.
   */
  asPoll(message: MlvChatMessageData): PollData {
    return message.data as PollData;
  }

  /** Total votes of a poll, used to size the result bars. */
  totalVotes(poll: PollData): number {
    return poll.options.reduce((sum, option) => sum + option.votes, 0);
  }

  /** Percentage width of one poll option's result bar. */
  votePercentage(poll: PollData, votes: number): number {
    const total = this.totalVotes(poll);
    return total === 0 ? 0 : Math.round((votes / total) * 100);
  }
}
