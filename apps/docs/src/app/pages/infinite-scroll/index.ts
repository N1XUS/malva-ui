import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="infinite-scroll">
      <div class="reference-page">
        <section>
          <h2>Edge-aware loading</h2>
          <p>
            Add <code>mlvInfiniteScroll</code> to a scroll container and respond
            to <code>loadMore</code> when the remaining distance crosses the
            configured threshold. Vertical and horizontal axes share the same
            event contract.
          </p>
        </section>

        <section>
          <h2>State contract</h2>
          <div class="reference-page__grid">
            <article>
              <h3>Loading</h3>
              <p>
                Set <code>loading</code> while a request is active to suppress
                duplicate emissions.
              </p>
            </article>
            <article>
              <h3>Exhausted</h3>
              <p>
                Set <code>hasMore</code> to false when the data source reaches
                its final page.
              </p>
            </article>
            <article>
              <h3>External owner</h3>
              <p>
                Pass <code>scrollContainer</code> when the directive host is not
                the scrolling element.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>After appending content</h2>
          <div class="reference-page__callout">
            Call <code>check()</code> after adding a page when the content may
            still be shorter than the viewport. The directive can then request
            another page without requiring a synthetic scroll event.
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
export class InfiniteScrollPageComponent {
  /** No numbered demos; the page introduces the directive's integration contract. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Infinite Scroll',
    description:
      'A lightweight edge-distance directive for incremental vertical or horizontal data loading.',
  };
}
