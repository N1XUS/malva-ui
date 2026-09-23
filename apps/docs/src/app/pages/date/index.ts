import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="date">
      <div class="reference-page">
        <section>
          <h2>One date model for every date-aware component</h2>
          <p>
            <code>&#64;malva-ui/core/date</code> ships no component. It owns the
            abstract contract that <code>mlv-calendar</code>,
            <code>mlv-day-picker</code>, <code>mlv-date-range-picker</code> and
            <code>mlv-scheduler</code> use for date arithmetic, comparison,
            parsing, time-of-day maths and localized labels. Implement it once
            and every one of them speaks your date model — native
            <code>Date</code>, Luxon, Moment, date-fns value objects or your
            own.
          </p>
          <div class="reference-page__callout">
            Until 2026-09 these symbols lived in
            <code>&#64;malva-ui/core/calendar</code>. The move is a hard move
            with no alias: only the import specifier changes, every name is
            unchanged, and the <code>&#64;malva-ui/core</code> root barrel still
            re-exports everything.
          </div>
        </section>

        <section>
          <h2>What the entry point exports</h2>
          <div class="reference-page__grid">
            <article>
              <h3><code>MlvDateAdapter&lt;D&gt;</code></h3>
              <p>
                The abstract contract. Concrete members cover calendar fields,
                calendar arithmetic, formatting and time-of-day; the base class
                derives comparison and label helpers from them.
              </p>
            </article>
            <article>
              <h3><code>MlvNativeDateAdapter</code></h3>
              <p>
                The default implementation, built on native
                <code>Date</code> and <code>Intl.DateTimeFormat</code>. Provided
                in root, so a component falls back to it when no adapter is
                registered.
              </p>
            </article>
            <article>
              <h3><code>MLV_DATE_ADAPTER</code></h3>
              <p>
                The token components inject. It has no root default on purpose —
                registering it is what swaps the date model application-wide.
              </p>
            </article>
            <article>
              <h3><code>MLV_DATE_LOCALE</code></h3>
              <p>
                The application locale read by every formatting method. Defaults
                to <code>MLV_LOCALE</code> from <code>@malva-ui/i18n</code> — the
                active language pack's locale, then Angular's
                <code>LOCALE_ID</code> — and never to the browser language, so
                server and client render the same dates. Left unprovided, the
                native adapter follows every runtime language switch. Providing
                this token pins dates to its value — even one equal to the
                pack's locale today — across every switch, so provide it only
                when dates should not follow the language pack.
              </p>
            </article>
            <article>
              <h3><code>provideMlvDateAdapter()</code></h3>
              <p>
                Registers an adapter class and, optionally, a locale. Passing no
                locale leaves an application-provided
                <code>MLV_DATE_LOCALE</code> untouched.
              </p>
            </article>
            <article>
              <h3><code>MlvDateFormatOptions</code></h3>
              <p>
                The options shape accepted by <code>format()</code> — an alias
                for <code>Intl.DateTimeFormatOptions</code>.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Registering an adapter</h2>
          <pre><code>import &lbrace; bootstrapApplication &rbrace; from '&#64;angular/platform-browser';
import &lbrace;
  MlvNativeDateAdapter,
  provideMlvDateAdapter,
&rbrace; from '&#64;malva-ui/core/date';

bootstrapApplication(AppComponent, &lbrace;
  providers: [...provideMlvDateAdapter(MlvNativeDateAdapter, 'ro-RO')],
&rbrace;);</code></pre>
          <p>
            A custom adapter extends <code>MlvDateAdapter&lt;D&gt;</code> and
            implements every abstract member, then registers the same way:
            <code>provideMlvDateAdapter(MyLuxonAdapter)</code>. The full member
            list, with signatures, is on the API tab.
          </p>
        </section>

        <section>
          <h2>Time of day</h2>
          <p>
            <code>&#64;malva-ui/scheduler</code> needs more than calendar days,
            so the contract also declares <code>getHours</code>,
            <code>getMinutes</code>, <code>createDateTime</code>,
            <code>addMinutes</code>, <code>differenceInMinutes</code> and
            <code>now()</code>. A custom adapter written before 2026-09 must add
            all six.
          </p>
          <div class="reference-page__callout">
            <code>addMinutes</code> and <code>differenceInMinutes</code> work in
            <strong>elapsed</strong> time, so a daylight-saving transition keeps
            its true length, while <code>withTime</code>,
            <code>startOfDay</code> and <code>minutesOfDay</code> work on the
            <strong>wall clock</strong>. <code>now()</code> is the library's
            single clock seam — no component constructs a date itself, so tests
            can pin the current time by overriding one method.
          </div>
        </section>
      </div>
    </docs-page>
  `,
  styles: `
    .reference-page {
      display: grid;
      gap: var(--mlv-spacing-8);
      max-width: 62rem;
    }
    .reference-page section {
      display: grid;
      gap: var(--mlv-spacing-3);
    }
    .reference-page h2,
    .reference-page h3,
    .reference-page p {
      margin: 0;
    }
    .reference-page p {
      color: var(--mlv-text-secondary);
      line-height: 1.7;
    }
    .reference-page__callout,
    .reference-page article,
    .reference-page pre {
      border: var(--mlv-stroke-width) solid var(--mlv-border-normal);
      border-radius: var(--mlv-radius-xl);
      padding: var(--mlv-spacing-5);
    }
    .reference-page__callout {
      background: var(--mlv-background-subtle);
      color: var(--mlv-text-primary);
      line-height: 1.6;
    }
    .reference-page__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      gap: var(--mlv-spacing-4);
    }
    .reference-page article {
      display: grid;
      gap: var(--mlv-spacing-2);
      background: var(--mlv-background-raised);
    }
    .reference-page pre {
      margin: 0;
      overflow-x: auto;
      background: var(--mlv-background-raised);
    }
    .reference-page code {
      color: var(--mlv-text-action);
      font-size: var(--mlv-typography-code-size);
    }
    .reference-page pre code {
      color: var(--mlv-text-primary);
    }
  `,
})
export class DatePageComponent {
  /** No numbered demos; the adapter is a contract, not a rendered component. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Date Adapter',
    description:
      'The shared date-adapter contract behind the calendar, day picker, date range picker and scheduler — swap the date model once, application-wide.',
  };
}
