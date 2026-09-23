import { Component, LOCALE_ID, signal, type Provider } from '@angular/core';
import {
  DATE_PIPE_DEFAULT_OPTIONS,
  DATE_PIPE_DEFAULT_TIMEZONE,
  formatDate,
  registerLocaleData,
} from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MlvI18nService, provideMlvI18n } from '@malva-ui/i18n';
import { deLanguage } from '@malva-ui/i18n/de';
import { enLanguage } from '@malva-ui/i18n/en';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvChat } from './chat';
import type { MlvChatMessageData, MlvChatUser } from '../chat.types';

/**
 * #306 — a message's accessible name carries the same time string as its
 * visible `<time>`, and both — plus the date separator — format in the active
 * language pack's locale (`MLV_LOCALE`, falling back to `LOCALE_ID`).
 */

const USERS: MlvChatUser[] = [
  { id: 'me', name: 'Me' },
  { id: 'u1', name: 'Robin' },
];

/** 15:35 local time, so the assertion holds in any time zone. */
const AFTERNOON = new Date(2026, 5, 5, 15, 35);
/** Far enough back that the separator never reads Today / Yesterday. */
const LONG_AGO = new Date(2024, 5, 5, 9, 0);

const MESSAGES: MlvChatMessageData[] = [
  { id: 'old', authorId: 'u1', text: 'old', timestamp: LONG_AGO },
  {
    id: 'a',
    authorId: 'me',
    text: 'hi',
    timestamp: AFTERNOON,
    status: 'read',
  },
];

@Component({
  imports: [MlvChat],
  template: `
    <mlv-chat
      [messages]="messages"
      [users]="users"
      selfId="me"
      [typingUsers]="typingUsers()"
    />
  `,
})
class ChatHost {
  readonly messages = MESSAGES;
  readonly users = USERS;
  readonly typingUsers = signal<string[]>([]);
}

describe('MlvChat locale', () => {
  let fixture: ComponentFixture<ChatHost>;

  async function render(providers: Provider[]): Promise<void> {
    TestBed.configureTestingModule({ providers });
    fixture = TestBed.createComponent(ChatHost);
    await fixture.whenStable();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * ICU versions disagree on the space before "PM" — CLDR 42+ data emits
   * U+202F (Angular's bundled locale data does), Node 24's ICU a plain space —
   * so the comparison folds both to a plain space rather than pinning the
   * runtime's ICU build.
   */
  function text(value: string | null | undefined): string {
    return (value ?? '').replace(/[\u202f\u00a0]/g, ' ').trim();
  }

  /** Visible time of the own message, and the accessible name of its article. */
  function ownMessage(): { time: string; label: string } {
    const articles = el().querySelectorAll('.mlv-chat__item');
    const article = articles[articles.length - 1];
    return {
      time: text(article.querySelector('.mlv-chat-message__time')?.textContent),
      label: text(article.getAttribute('aria-label')),
    };
  }

  function separator(): string {
    return text(el().querySelector('.mlv-chat__date')?.textContent);
  }

  it('names the message with the visible time under a de LOCALE_ID', async () => {
    registerLocaleData(localeDe);
    await render([
      provideMlvI18nTesting(),
      { provide: LOCALE_ID, useValue: 'de' },
    ]);

    const { time, label } = ownMessage();
    expect(time).toBe('15:35');
    expect(label).toBe('Me, 15:35, Read');
  });

  it("formats time and date separators in the active pack's locale and follows a switch", async () => {
    await render([provideMlvI18n(async () => ({ default: deLanguage }))]);
    const service = TestBed.inject(MlvI18nService);
    service.setLanguage(deLanguage);
    await fixture.whenStable();

    expect([ownMessage(), separator()]).toEqual([
      { time: '15:35', label: 'Me, 15:35, Gelesen' },
      '05.06.2024',
    ]);

    await service.switchLanguage(async () => ({ default: enLanguage }));
    await fixture.whenStable();

    expect([ownMessage(), separator()]).toEqual([
      { time: '3:35 PM', label: 'Me, 3:35 PM, Read' },
      'Jun 5, 2024',
    ]);
  });

  // Review #306 F2: `DatePipe` honoured the time zone an app configures for it,
  // so the `Intl` path has to as well. The expected strings come from Angular's
  // own `formatDate` with the same zone — what `DatePipe` rendered before. The
  // accessible name is new here: it used to format in local time whatever the
  // bubble showed.
  it.each([
    [
      'DATE_PIPE_DEFAULT_OPTIONS',
      { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: '+0530' } },
      '+0530',
    ],
    [
      'DATE_PIPE_DEFAULT_TIMEZONE',
      { provide: DATE_PIPE_DEFAULT_TIMEZONE, useValue: 'UTC' },
      'UTC',
    ],
  ])(
    'formats in the time zone %s sets for DatePipe',
    async (_token, provider, zone) => {
      await render([provideMlvI18nTesting(), provider]);

      const time = text(formatDate(AFTERNOON, 'shortTime', 'en-US', zone));
      expect([ownMessage(), separator()]).toEqual([
        { time, label: `Me, ${time}, Read` },
        text(formatDate(LONG_AGO, 'mediumDate', 'en-US', zone)),
      ]);
    },
  );

  it('prefers DATE_PIPE_DEFAULT_OPTIONS over DATE_PIPE_DEFAULT_TIMEZONE, as DatePipe does', async () => {
    await render([
      provideMlvI18nTesting(),
      { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: '+0530' } },
      { provide: DATE_PIPE_DEFAULT_TIMEZONE, useValue: '-0800' },
    ]);

    expect(ownMessage().time).toBe(
      text(formatDate(AFTERNOON, 'shortTime', 'en-US', '+0530')),
    );
  });

  // Guard, green before F2 too: Angular's `timezoneToOffset` falls back to the
  // runtime zone for a string `Date.parse` cannot read, so the port must not
  // turn that into `NaN`.
  it('formats in local time when the configured zone does not parse', async () => {
    await render([
      provideMlvI18nTesting(),
      { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: 'nope' } },
    ]);

    expect(ownMessage().time).toBe('3:35 PM');
  });

  // Guard, not a red-first reproduction: before #306 the label was a template
  // method formatting through Angular's `formatDate`, which never touches
  // `Intl.DateTimeFormat`, so this spy could not see that cost. It pins the
  // replacement — labels are a `computed` over the messages and the locale —
  // against sliding back into a per-refresh template call.
  it('does not re-format message labels on an unrelated refresh', async () => {
    await render([provideMlvI18nTesting()]);
    // `format` is an accessor on `Intl.DateTimeFormat.prototype`; every call
    // reads it once.
    const format = vi.spyOn(Intl.DateTimeFormat.prototype, 'format', 'get');

    fixture.componentInstance.typingUsers.set(['u1']);
    await fixture.whenStable();
    fixture.componentInstance.typingUsers.set([]);
    await fixture.whenStable();

    expect(format).not.toHaveBeenCalled();
    format.mockRestore();
  });
});
