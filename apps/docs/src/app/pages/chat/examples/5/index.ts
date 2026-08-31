import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvChat } from '@malva-ui/core/chat';
import type { MlvChatMessageData, MlvChatUser } from '@malva-ui/core/chat';

const MINUTE = 60_000;
const now = Date.now();

/** Inline SVG placeholder so the example needs no network assets. */
function placeholder(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="hsl(${hue} 60% 60%)"/><text x="160" y="130" font-family="sans-serif" font-size="28" fill="white" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SPEC_SHEET: MlvChatMessageData = {
  id: 'm2',
  authorId: 'nadia',
  text: 'Latest floor plan — the welcome desk moved to the north wall.',
  timestamp: now - 34 * MINUTE,
  attachments: [
    {
      id: 'a1',
      kind: 'image',
      src: placeholder('Floor plan', 200),
      alt: 'Floor plan',
      width: 320,
      height: 240,
    },
  ],
};

@Component({
  selector: 'docs-chat-reply-citation-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvChat],
  templateUrl: './index.html',
})
export default class ChatReplyCitationExampleComponent {
  readonly users: MlvChatUser[] = [
    { id: 'me', name: 'You' },
    { id: 'nadia', name: 'Nadia Petrova' },
  ];

  /** Last citation the reader activated, echoed below the chat. */
  readonly lastJump = signal<string>('—');

  readonly messages = signal<MlvChatMessageData[]>([
    {
      id: 'm1',
      authorId: 'nadia',
      text: 'Can we still fit the welcome desk near the entrance?',
      timestamp: now - 36 * MINUTE,
    },
    SPEC_SHEET,
    {
      id: 'm3',
      authorId: 'me',
      text: 'That works — the queue will not block the doors any more.',
      timestamp: now - 30 * MINUTE,
      status: 'read',
      // A citation on an own bubble: the accent palette is handed down, so the
      // quote reads on the accent surface instead of against the page.
      replyTo: SPEC_SHEET,
    },
    {
      id: 'm4',
      authorId: 'nadia',
      text: 'Agreed. I will send the revised print to the venue tonight.',
      timestamp: now - 26 * MINUTE,
      // A citation on an incoming bubble, quoting an own message.
      replyTo: {
        id: 'm3',
        authorId: 'me',
        text: 'That works — the queue will not block the doors any more.',
        timestamp: now - 30 * MINUTE,
      },
    },
    {
      id: 'm5',
      authorId: 'me',
      text: 'One more thing before you send it.',
      timestamp: now - 4 * MINUTE,
      status: 'delivered',
      // The quoted message was itself a reply. Only one level ever renders —
      // the nested citation collapses into a corner marker.
      replyTo: {
        id: 'm4',
        authorId: 'nadia',
        text: 'Agreed. I will send the revised print to the venue tonight.',
        timestamp: now - 26 * MINUTE,
        replyTo: {
          id: 'm3',
          authorId: 'me',
          text: 'That works — the queue will not block the doors any more.',
          timestamp: now - 30 * MINUTE,
        },
      },
    },
  ]);

  /** Citations are buttons; the host decides what activating one does. */
  onReplyClick(event: {
    message: MlvChatMessageData;
    replyTo: MlvChatMessageData;
  }): void {
    const author =
      this.users.find((user) => user.id === event.replyTo.authorId)?.name ??
      'Unknown';
    this.lastJump.set(`${author}: ${event.replyTo.text ?? 'attachment'}`);
  }
}
