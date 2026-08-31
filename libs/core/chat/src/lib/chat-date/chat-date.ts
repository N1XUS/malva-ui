import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MLV_CHAT_I18N } from '@malva-ui/i18n';
import { isSameChatDay } from '../chat-render-list';

/**
 * Internal default renderer of a date separator. Shows Today/Yesterday for the
 * two most recent days and a formatted date otherwise. Consumers override the
 * whole slot with `[mlvChatDateDef]`.
 */
@Component({
  selector: 'mlv-chat-date',
  template: `
    @if (_label(); as label) {
      {{ label }}
    } @else {
      {{ date() | date: 'mediumDate' }}
    }
  `,
  styleUrl: './chat-date.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  host: { class: 'mlv-chat-date' },
})
export class MlvChatDate {
  /** Start of the calendar day this separator introduces. */
  readonly date = input.required<Date>();

  /** @internal Chat i18n strings. */
  protected readonly _i18n = inject(MLV_CHAT_I18N);

  /** @internal Relative label, or null when the template should format the date. */
  protected readonly _label = computed(() => {
    const date = this.date();
    const now = new Date();
    if (isSameChatDay(date, now)) return this._i18n().today;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return isSameChatDay(date, yesterday) ? this._i18n().yesterday : null;
  });
}
