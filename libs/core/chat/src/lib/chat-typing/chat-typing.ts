import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { MLV_CHAT_I18N, MlvTranslatePipe } from '@malva-ui/i18n';
import type { MlvChatUser } from '../chat.types';

/**
 * Internal three-dot typing bubble. Rendered by `mlv-chat` at the bottom of the
 * transcript while `typingUsers` is non-empty.
 */
@Component({
  selector: 'mlv-chat-typing',
  template: `
    <span class="mlv-chat-typing__dots" aria-hidden="true">
      <span class="mlv-chat-typing__dot"></span>
      <span class="mlv-chat-typing__dot"></span>
      <span class="mlv-chat-typing__dot"></span>
    </span>
    <span class="mlv-chat-typing__label">
      {{ _i18n().typing | mlvTranslate: { count: users().length } }}
    </span>
  `,
  styleUrl: './chat-typing.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTranslatePipe],
  host: {
    class: 'mlv-chat-typing',
    '[attr.aria-label]': '_ariaLabel()',
  },
})
export class MlvChatTyping {
  /** Users currently composing a message. */
  readonly users = input<MlvChatUser[]>([]);

  /** @internal Chat i18n strings. */
  protected readonly _i18n = inject(MLV_CHAT_I18N);

  /** @internal Accessible label naming the typing users when they are known. */
  protected readonly _ariaLabel = computed(() => {
    const names = this.users()
      .map((u) => u.name)
      .filter(Boolean);
    return names.length ? names.join(', ') : null;
  });
}
