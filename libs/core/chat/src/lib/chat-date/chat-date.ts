import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
} from '@angular/core';
import { MLV_CHAT_I18N, MLV_LOCALE } from '@malva-ui/i18n';
import { isSameChatDay } from '../chat-render-list';
import {
  formatChatDate,
  injectChatTimezoneOffset,
} from '../chat-locale-format';

/**
 * Internal default renderer of a date separator. Shows Today/Yesterday for the
 * two most recent days and a formatted date otherwise, in `MLV_LOCALE`.
 * Consumers override the whole slot with `[mlvChatDateDef]`.
 */
@Component({
  selector: 'mlv-chat-date',
  template: `
    @if (_label(); as label) {
      {{ label }}
    } @else {
      {{ _formatted() }}
    }
  `,
  styleUrl: './chat-date.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mlv-chat-date' },
})
export class MlvChatDate {
  /** Start of the calendar day this separator introduces. */
  readonly date = input.required<Date>();

  /** @internal Chat i18n strings. */
  protected readonly _i18n = inject(MLV_CHAT_I18N);

  /** @private Locale the date is formatted in; see `MLV_LOCALE`. */
  private readonly _locale = inject(MLV_LOCALE);

  /**
   * @private UTC offset the date is formatted in — the zone the app configured for
   * `DatePipe`, or `null` for the runtime's; see `injectChatTimezoneOffset`.
   */
  private readonly _timezoneOffset = injectChatTimezoneOffset();

  /** @internal Relative label, or null when the template should format the date. */
  protected readonly _label = computed(() => {
    const date = this.date();
    const now = new Date();
    if (isSameChatDay(date, now)) return this._i18n().today;
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );
    return isSameChatDay(date, yesterday) ? this._i18n().yesterday : null;
  });

  /** @internal Medium calendar date, in `MLV_LOCALE`; shown when `_label()` is null. */
  protected readonly _formatted = computed(() =>
    formatChatDate(this.date(), this._locale(), this._timezoneOffset),
  );
}
