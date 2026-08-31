import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="accessibility">
      <div class="reference-page">
        <section>
          <h2>Accessible interaction primitives</h2>
          <p>
            The CDK accessibility entry point contains small utilities used
            across Malva UI to preserve keyboard reachability and predictable
            focus movement without duplicating low-level DOM logic.
          </p>
        </section>

        <section>
          <h2>Included utilities</h2>
          <div class="reference-page__grid">
            <article>
              <h3><code>mlvClick</code></h3>
              <p>
                Adds Enter and Space activation plus managed tabindex to a
                non-native interactive host.
              </p>
            </article>
            <article>
              <h3>Tabbable element service</h3>
              <p>
                Finds the first or last truly tabbable descendant for overlay
                focus placement.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Prefer native semantics</h2>
          <div class="reference-page__callout">
            Start with <code>button</code>, <code>a</code>, and native form
            controls. Reach for <code>mlvClick</code> only when the host cannot
            use a native interactive element, and always provide an appropriate
            role and name.
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
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
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
export class AccessibilityPageComponent {
  /** No numbered demos; the page summarizes the low-level CDK contract. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Accessibility',
    description:
      'Keyboard activation and focus-discovery utilities for building accessible composite components and overlays.',
  };
}
