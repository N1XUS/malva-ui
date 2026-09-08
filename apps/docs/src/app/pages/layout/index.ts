import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page [meta]="meta" [examples]="examples" header="layout">
      <div class="reference-page">
        <section>
          <h2>This entry point is a deprecation shim</h2>
          <div class="reference-page__callout">
            <code>mlv-layout</code>, <code>mlvLayoutTop</code> and
            <code>mlvLayoutSide</code> are gone.
            <code>&#64;malva-ui/core/layout</code> still resolves, but it now
            re-exports <code>&#64;malva-ui/cdk/theme</code> and nothing else, so
            existing theme imports keep compiling. It is removed in 1.0.
            <a routerLink="/page">Page</a> documents the shell that replaces it.
          </div>
        </section>

        <section>
          <h2>Where each region went</h2>
          <div class="reference-page__grid">
            <article>
              <h3>Top region</h3>
              <p>
                <code>mlvLayoutTop</code> becomes
                <code>[mlvPageTopbar]</code> on <code>mlv-page-shell</code> —
                the same slot for an action bar or product-level navigation
                spanning the shell.
              </p>
            </article>
            <article>
              <h3>Side region</h3>
              <p>
                <code>mlvLayoutSide</code> becomes
                <code>[mlvPageSidebar]</code>, which a shell accepts more than
                once, plus <code>[mlvPageEndSidebar]</code> for a trailing rail.
              </p>
            </article>
            <article>
              <h3>Main region</h3>
              <p>
                The default slot still takes route content, now usually as
                <code>main[mlvPage]</code> so the page owns its own scroll
                context, header, summary and dock.
              </p>
            </article>
          </div>
        </section>

        <section>
          <h2>Choosing a height</h2>
          <p>
            <code>mlv-layout</code> declared neither a block size nor an
            overflow, so it was content-sized and the document scrolled it.
            <code>mlv-page-shell</code> makes that an explicit
            <code>sizing</code> input: <code>parent</code> fills the box it is
            given, <code>viewport</code> bounds itself to the viewport minus its
            own measured top inset and scrolls internally, and
            <code>content</code> reproduces the old behaviour. A shell ported
            from <code>mlv-layout</code> wants <code>content</code> unless
            something inside it owns a scroller.
          </p>
        </section>

        <section>
          <h2>Theme ownership</h2>
          <div class="reference-page__callout">
            Unchanged. Register <code>provideDefaultTheme()</code> at bootstrap.
            The scoped <code>MlvThemeService</code> exposes the current theme,
            follows the system preference when appropriate, and persists an
            explicit choice — it moved to <code>&#64;malva-ui/cdk/theme</code>,
            which this entry point re-exports.
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
  /** No numbered demos; this page is a signpost to `mlv-page-shell`. */
  protected readonly examples: number[] = [];

  /** Heading and summary rendered by the shared documentation shell. */
  protected readonly meta: DocPageMeta = {
    title: 'Layout',
    description:
      'Deprecated. `mlv-layout` is deleted — `mlv-page-shell` is the application shell, and this entry point now only re-exports the theme service.',
  };
}
