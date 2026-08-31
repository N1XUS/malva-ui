import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { LucidePlay } from '@lucide/angular';
import { MLV_CHAT_I18N, MlvTranslatePipe } from '@malva-ui/i18n';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvSkeleton } from '@malva-ui/core/skeleton';
import type { MlvChatAttachment } from '../chat.types';
import { formatChatDuration } from '../chat-format';

/**
 * Internal renderer for the image/gif/video attachments of a chat message.
 * Not exported from the package barrel — `mlv-chat-message` owns it.
 */
@Component({
  selector: 'mlv-chat-media-grid',
  templateUrl: './chat-media-grid.html',
  styleUrl: './chat-media-grid.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucidePlay, MlvProgress, MlvSkeleton, MlvTranslatePipe],
  host: {
    class: 'mlv-chat-media-grid',
    '[class.mlv-chat-media-grid--single]': '_visible().length === 1',
    '[class.mlv-chat-media-grid--quote]': 'quote()',
  },
})
export class MlvChatMediaGrid {
  /** Visual attachments to render; audio entries must be filtered out by the caller. */
  readonly attachments = input.required<MlvChatAttachment[]>();

  /** Condensed rendering inside a reply quote: a single small thumbnail. */
  readonly quote = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Emits the attachment whose cell was activated. */
  readonly mediaClick = output<MlvChatAttachment>();

  /** @internal Chat i18n strings. */
  protected readonly _i18n = inject(MLV_CHAT_I18N);

  /** @internal Ids of images whose load event fired, so their skeleton is removed. */
  protected readonly _loaded = signal<ReadonlySet<string>>(new Set());

  /** @internal Cells rendered to the DOM: one in quote mode, otherwise the first four. */
  protected readonly _visible = computed(() => this.attachments().slice(0, this.quote() ? 1 : 4));

  /** @internal Count of attachments hidden behind the +N overlay. */
  protected readonly _extra = computed(() =>
    this.quote() ? 0 : Math.max(0, this.attachments().length - 4),
  );

  /** @internal Formats a duration in seconds as `m:ss` for the video chip. */
  protected readonly _formatDuration = formatChatDuration;

  /** @internal True while an attachment carries upload progress, so the overlay shows. */
  protected _isUploading(attachment: MlvChatAttachment): boolean {
    return attachment.uploadProgress !== undefined && attachment.uploadProgress !== null;
  }

  /** @internal Marks an image as loaded so its skeleton placeholder is removed. */
  protected _onLoad(id: string): void {
    this._loaded.update((set) => new Set(set).add(id));
  }
}
