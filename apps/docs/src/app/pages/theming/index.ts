import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="theming">
      <div class="reference-page">
        <section>
          <h2>Theme foundation</h2>
          <p>
            Malva UI expresses color, typography, spacing, shape, elevation, and
            motion through semantic CSS custom properties. Components consume
            those tokens, so an application can change its visual language
            without rewriting component styles.
          </p>
          <div class="reference-page__callout">
            Add <code>&#64;malva-ui/core/styles/malva-ui.css</code> once in the
            application build, then set the active theme through
            <code>provideDefaultTheme()</code> or <code>MlvThemeService</code>.
          </div>
        </section>

        <section>
          <h2>Available modes</h2>
          <div class="reference-page__grid">
            <article>
              <h3>Light</h3>
              <p>
                The default neutral canvas, activated by
                <code>mlvTheme="light"</code>.
              </p>
            </article>
            <article>
              <h3>Dark</h3>
              <p>
                A complete dark surface hierarchy, activated by
                <code>mlvTheme="dark"</code>.
              </p>
            </article>
            <article>
              <h3>High contrast</h3>
              <p>
                Stronger borders and focus treatment through
                <code>data-theme="high-contrast"</code>.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Customization strategy</h2>
          <p>
            Override semantic tokens at the narrowest useful scope. Prefer
            <code>--mlv-text-*</code>, <code>--mlv-background-*</code>, and
            <code>--mlv-border-*</code> contracts over component selectors so
            themes remain coherent as the library evolves.
          </p>
        </section>

        <section>
          <h2>Token reference</h2>
          <p>
            Every public token — light, dark, and high-contrast values, the
            responsive overrides, and the animation override hooks — is listed
            in <code>libs/styles/tokens.md</code>, generated from the stylesheet
            sources. Check a name there before using it.
          </p>
          <div class="reference-page__callout">
            <code>var()</code> falls back silently: a token that does not exist
            never raises an error, it just renders the fallback and stops
            following the theme. If a color looks right but never changes with
            the theme, the name is probably wrong — start with the
            <strong>commonly mistaken names</strong> table in
            <code>tokens.md</code>.
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
    .reference-page article {
      border: var(--mlv-stroke-width) solid var(--mlv-border-normal);
      border-radius: var(--mlv-radius-xl);
      background: var(--mlv-background-subtle);
      padding: var(--mlv-spacing-5);
    }
    .reference-page__callout {
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
export class ThemingPageComponent {
  /** No runnable demos; this page is a conceptual theme reference. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Theming',
    description:
      'Build consistent light, dark, and high-contrast experiences with Malva UI semantic design tokens and theme services.',
  };
}
