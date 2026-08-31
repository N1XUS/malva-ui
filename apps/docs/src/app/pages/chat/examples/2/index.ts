import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvChat } from '@malva-ui/core/chat';
import type { MlvChatAttachment, MlvChatMessageData, MlvChatUser } from '@malva-ui/core/chat';

const MINUTE = 60_000;
const now = Date.now();

/** Inline SVG placeholders so the example needs no network assets. */
function placeholder(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="hsl(${hue} 60% 60%)"/><text x="160" y="130" font-family="sans-serif" font-size="28" fill="white" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

@Component({
  selector: 'docs-chat-media-audio-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvChat],
  templateUrl: './index.html',
})
export default class ChatMediaAudioExampleComponent {
  readonly users: MlvChatUser[] = [
    { id: 'me', name: 'You' },
    { id: 'sam', name: 'Sam Okonkwo' },
  ];

  readonly lastClicked = signal<string>('—');

  readonly messages = signal<MlvChatMessageData[]>([
    {
      id: 'm1',
      authorId: 'sam',
      text: 'Shots from the venue walkthrough.',
      timestamp: now - 30 * MINUTE,
      attachments: [
        { id: 'a1', kind: 'image', src: placeholder('Stage', 210), alt: 'Main stage', width: 320, height: 240 },
        { id: 'a2', kind: 'image', src: placeholder('Foyer', 260), alt: 'Foyer' },
        { id: 'a3', kind: 'image', src: placeholder('Bar', 320), alt: 'Bar area' },
        { id: 'a4', kind: 'image', src: placeholder('Seats', 20), alt: 'Seating' },
        { id: 'a5', kind: 'image', src: placeholder('Rig', 60), alt: 'Lighting rig' },
        { id: 'a6', kind: 'image', src: placeholder('Doors', 120), alt: 'Doors' },
      ],
    },
    {
      id: 'm2',
      authorId: 'sam',
      timestamp: now - 28 * MINUTE,
      attachments: [
        {
          id: 'a7',
          kind: 'video',
          src: 'walkthrough.mp4',
          poster: placeholder('Walkthrough', 160),
          duration: 96,
          alt: 'Venue walkthrough clip',
        },
      ],
    },
    {
      id: 'm3',
      authorId: 'me',
      timestamp: now - 20 * MINUTE,
      status: 'read',
      attachments: [{ id: 'a8', kind: 'audio', src: 'voice-note.mp3', duration: 34 }],
    },
    {
      id: 'm4',
      authorId: 'me',
      text: 'One more photo on the way.',
      timestamp: now - MINUTE,
      status: 'sending',
      attachments: [
        {
          id: 'a9',
          kind: 'image',
          src: placeholder('Uploading', 280),
          alt: 'Uploading photo',
          uploadProgress: 62,
        },
      ],
    },
  ]);

  /** Records the attachment a viewer opened; a real app would open a lightbox. */
  onMediaClick(event: { message: MlvChatMessageData; attachment: MlvChatAttachment }): void {
    this.lastClicked.set(`${event.attachment.kind} · ${event.attachment.id}`);
  }
}
