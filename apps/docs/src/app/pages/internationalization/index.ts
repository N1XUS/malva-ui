import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      [meta]="meta"
      [examples]="examples"
      header="internationalization"
    >
      <div class="reference-page">
        <section>
          <h2>One provider, component-level tokens</h2>
          <p>
            Configure a language once with <code>provideMlvI18n()</code>. Each
            component reads a focused signal-backed token, keeping translations
            tree-shakable and allowing a subtree to override only the copy it
            owns.
          </p>
          <div class="reference-page__callout">
            Start with the English pack from <code>&#64;malva-ui/i18n/en</code>,
            or provide a language object that satisfies the exported
            <code>MlvLanguage</code> contract.
          </div>
        </section>

        <section>
          <h2>Message behavior</h2>
          <div class="reference-page__grid">
            <article>
              <h3>Reactive</h3>
              <p>
                Language changes propagate through signals without recreating
                components.
              </p>
            </article>
            <article>
              <h3>ICU-aware</h3>
              <p>
                Parameterized labels support plurals and values through Intl
                MessageFormat.
              </p>
            </article>
            <article>
              <h3>Scoped</h3>
              <p>
                Feature-level providers can replace one token without forking a
                full language pack.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Translation workflow</h2>
          <p>
            Keep application copy in the application and component chrome in
            Malva language packs. Use the exported token interfaces as the
            source of truth so missing keys fail during development rather than
            at runtime.
          </p>
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
    .reference-page article {
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
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--mlv-spacing-4);
    }
    .reference-page article {
      display: grid;
      gap: var(--mlv-spacing-2);
      background: var(--mlv-background-raised);
    }
    .reference-page code {
      color: var(--mlv-text-action);
      font-size: var(--mlv-typography-code-size);
    }
  `,
})
export class InternationalizationPageComponent {
  /** No numbered demos; the projected content introduces the package contract. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Internationalization',
    description:
      'Signal-backed language packs, focused component tokens, and ICU message formatting for every user-facing Malva UI string.',
  };
}
