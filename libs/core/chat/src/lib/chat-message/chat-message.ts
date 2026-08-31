import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  LucideCheck,
  LucideCheckCheck,
  LucideCircleAlert,
  LucideClock,
  LucideCornerUpLeft,
  LucideMusic,
} from '@lucide/angular';
import { MLV_CHAT_I18N } from '@malva-ui/i18n';
import type {
  MlvChatAttachment,
  MlvChatGroupPosition,
  MlvChatMessageData,
} from '../chat.types';
import { toChatDate } from '../chat-render-list';
import { formatChatDuration } from '../chat-format';
import { MLV_CHAT_MESSAGE_DEFS, MLV_CHAT_USERS } from '../chat-tokens';
import { MlvChatMediaGrid } from '../chat-media-grid/chat-media-grid';
import { MlvChatAudio } from '../chat-audio/chat-audio';

/**
 * A single chat bubble. Normally rendered internally by `mlv-chat`, but usable
 * standalone. Renders text, reply quotes, delivery status ticks, and the meta
 * row; media/audio attachments are rendered by internal sub-components.
 */
@Component({
  selector: 'mlv-chat-message',
  templateUrl: './chat-message.html',
  styleUrl: './chat-message.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    LucideCheck,
    LucideCheckCheck,
    LucideCircleAlert,
    LucideClock,
    LucideCornerUpLeft,
    LucideMusic,
    MlvChatMediaGrid,
    MlvChatAudio,
  ],
  host: {
    class: 'mlv-chat-message',
    '[class.mlv-chat-message--own]': 'own()',
    '[class.mlv-chat-message--other]': '!own()',
    '[class]': '"mlv-chat-message--pos-" + groupPosition()',
    '[class.mlv-chat-message--failed]': 'message().status === "failed"',
    '[class.mlv-chat-message--quote]': 'quote()',
  },
})
export class MlvChatMessage {
  /** The message to render. */
  readonly message = input.required<MlvChatMessageData>();

  /** True when authored by the current user (right-aligned, accent bubble, status ticks). */
  readonly own = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Position inside the consecutive-author group; drives corner-tail radii. */
  readonly groupPosition = input<MlvChatGroupPosition>('single');

  /** Condensed quote rendering (inside a reply block): clamped text, no meta row. */
  readonly quote = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emits when the retry button of a failed own message is activated. */
  readonly retry = output<void>();

  /** Emits the clicked media attachment (image/video cell). */
  readonly mediaClick = output<MlvChatAttachment>();

  /** Emits the embedded replied-to message when the quote block is activated. */
  readonly replyClick = output<MlvChatMessageData>();

  /** @internal Chat i18n strings. */
  protected readonly _i18n = inject(MLV_CHAT_I18N);

  /** @private Users map provided by the surrounding `mlv-chat`; null when standalone. */
  private readonly _users = inject(MLV_CHAT_USERS, { optional: true });

  /** @internal Custom message-type templates provided by the surrounding `mlv-chat`. */
  protected readonly _defs = inject(MLV_CHAT_MESSAGE_DEFS, { optional: true });

  /** @internal Normalized timestamp for the DatePipe. */
  protected readonly _date = computed(() =>
    toChatDate(this.message().timestamp),
  );

  /** @internal Image/gif/video attachments, rendered by the media grid. */
  protected readonly _mediaAttachments = computed(() =>
    (this.message().attachments ?? []).filter((a) => a.kind !== 'audio'),
  );

  /** @internal Audio attachments, each rendered by its own player. */
  protected readonly _audioAttachments = computed(() =>
    (this.message().attachments ?? []).filter((a) => a.kind === 'audio'),
  );

  /** @internal Formats seconds as `m:ss` for the condensed audio chip in quote mode. */
  protected readonly _formatDuration = formatChatDuration;

  /** @internal Template for this message's custom type, if registered. */
  protected readonly _typeTemplate = computed(() => {
    const type = this.message().type;
    return type ? (this._defs?.().get(type)?.templateRef ?? null) : null;
  });

  /** @internal Resolves an author display name from the container-provided users map. */
  protected _userName(id: string): string {
    return this._users?.().get(id)?.name ?? '';
  }
}
