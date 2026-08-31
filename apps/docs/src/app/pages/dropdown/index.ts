import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="dropdown">
      <div class="reference-page">
        <section>
          <h2>Headless selection panel</h2>
          <p>
            <code>mlv-dropdown-panel</code> is the reusable listbox surface
            behind select, combobox, and autocomplete. It owns option rendering
            and selection presentation while the parent control owns its
            trigger, value contract, and overlay lifecycle.
          </p>
        </section>

        <section>
          <h2>Choose the focus model</h2>
          <div class="reference-page__grid">
            <article>
              <h3>Roving focus</h3>
              <p>
                Moves DOM focus through options. Use it for select-style
                triggers.
              </p>
            </article>
            <article>
              <h3>Active descendant</h3>
              <p>
                Keeps focus in the text field while highlighting a matching
                option.
              </p>
            </article>
            <article>
              <h3>Grouped options</h3>
              <p>
                Consecutive groups receive labelled, sticky headers without
                disrupting option indices.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Shared option utilities</h2>
          <div class="reference-page__callout">
            Use <code>resolveOptions()</code>, <code>filterOptions()</code>, and
            <code>MlvActiveDescendant</code> when building a higher-level
            control. They keep matching, ids, ranking, and keyboard state
            consistent with the built-in select family.
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
export class DropdownPageComponent {
  /** Live demos of the panel on its own and composed inside `mlv-popup`. */
  protected readonly examples = new Array(6).fill(0).map((_, i) => i + 1);

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Dropdown',
    description:
      'A generic listbox panel and shared option utilities for select, combobox, and autocomplete experiences.',
  };
}
