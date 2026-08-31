import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="layout">
      <div class="reference-page">
        <section>
          <h2>Application shell</h2>
          <p>
            <code>mlv-layout</code> establishes the root page geometry and theme
            boundary. Project optional top and side regions with
            <code>mlvLayoutTop</code> and <code>mlvLayoutSide</code>, then place
            the primary application content in the default slot.
          </p>
        </section>

        <section>
          <h2>Composition model</h2>
          <div class="reference-page__grid">
            <article>
              <h3>Top region</h3>
              <p>
                Use for an action bar or product-level navigation that spans the
                shell.
              </p>
            </article>
            <article>
              <h3>Side region</h3>
              <p>
                Use for persistent navigation, tools, or contextual workspace
                controls.
              </p>
            </article>
            <article>
              <h3>Main region</h3>
              <p>
                Project route content directly; the shell keeps its layout and
                theme stable.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Theme ownership</h2>
          <div class="reference-page__callout">
            Register <code>provideDefaultTheme()</code> at bootstrap. The scoped
            <code>MlvThemeService</code> exposes the current theme, follows the
            system preference when appropriate, and persists an explicit choice.
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
export class LayoutPageComponent {
  /** No numbered demos; this page documents the shell's composition contract. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Layout',
    description:
      'A responsive application shell with projected navigation regions and built-in light and dark theme coordination.',
  };
}
