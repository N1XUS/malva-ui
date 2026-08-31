import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="overlay">
      <div class="reference-page">
        <section>
          <h2>Shared modal lifecycle</h2>
          <p>
            The overlay CDK centralizes the lifecycle used by dialog and drawer:
            creation, backdrop and Escape handling, enter and leave state, focus
            placement, focus restoration, result delivery, and disposal.
          </p>
        </section>

        <section>
          <h2>Choose the base for the owner</h2>
          <div class="reference-page__grid">
            <article>
              <h3>Host base</h3>
              <p>
                Extend <code>MlvOverlayHostBase</code> for a declarative
                component controlled by an <code>opened</code> model.
              </p>
            </article>
            <article>
              <h3>Service base</h3>
              <p>
                Extend <code>MlvOverlayServiceBase</code> for imperative
                <code>open()</code> APIs with typed config and results.
              </p>
            </article>
            <article>
              <h3>Reference base</h3>
              <p>
                Extend <code>MlvOverlayRef</code> to expose close, result, and
                after-closed behavior.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Build on policy, not CDK plumbing</h2>
          <div class="reference-page__callout">
            Product components should define their content, size, and motion
            policy. Let the shared base own cleanup and focus invariants so
            every modal surface closes predictably.
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
export class OverlayPageComponent {
  /** No numbered demos; concrete dialog and drawer pages demonstrate the bases. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Overlay',
    description:
      'Headless lifecycle, focus, animation-state, and result primitives shared by modal Malva UI components.',
  };
}
