import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="utils">
      <div class="reference-page">
        <section>
          <h2>Small, composable primitives</h2>
          <p>
            CDK utilities cover shared concerns that do not belong to a visual
            component family: element observation, focus, responsive state,
            animation presence, stable ids, ranges, tones, and structural slots.
          </p>
        </section>

        <section>
          <h2>Utility groups</h2>
          <div class="reference-page__grid">
            <article>
              <h3>DOM</h3>
              <p>
                Resize observation, autofocus, and spacer primitives for
                layout-aware components.
              </p>
            </article>
            <article>
              <h3>Responsive</h3>
              <p>
                Breakpoint signals and structural up/down directives for
                adaptive rendering.
              </p>
            </article>
            <article>
              <h3>Motion</h3>
              <p>
                Fade and animated-presence helpers with shared timing
                configuration.
              </p>
            </article>
            <article>
              <h3>Pure helpers</h3>
              <p>
                Stable ids, clamp and range functions, and the common semantic
                tone vocabulary.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Import narrowly</h2>
          <div class="reference-page__callout">
            Library implementation code should import from
            <code>&#64;malva-ui/cdk/utils</code>. The grouped
            <code>&#64;malva-ui/cdk</code> entry point is convenient for
            applications, while the leaf path keeps internal dependency graphs
            precise.
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
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
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
export class UtilsPageComponent {
  /** No numbered demos; dedicated component pages demonstrate visual utilities. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'CDK Utilities',
    description:
      'Reusable DOM, responsive, animation, identity, and value helpers shared across the Malva UI component families.',
  };
}
