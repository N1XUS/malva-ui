import type { PipeTransform } from '@angular/core';
import { inject, Pipe } from '@angular/core';
import { DocPageComponent } from './doc-page';
import { kebabCase } from 'lodash-es';
import type { MdxEntry } from './toc';

/**
 * Dynamically imports an MDX file for the given example index.
 *
 * The esbuild MDX transform plugin processes .mdx files at build time,
 * converting Markdown to HTML and extracting frontmatter + ToC headings.
 * The import returns a module whose default export is an MdxEntry object.
 *
 * No runtime Markdown parsing is performed — `marked` is not shipped to the client.
 *
 * ToC headings are **not** pushed from here any more. Under the tabbed doc-page
 * structure the active panel owns the ToC: the Examples panel's headings are
 * collected from the rendered DOM by `DocsTocSourceDirective` (which also
 * de-duplicates slugs), so the sidebar stays correct when only one tab is
 * mounted. This pipe now only resolves the MDX HTML for `[innerHTML]`.
 */
@Pipe({
  name: 'docsDocumentation',
})
export class DocsDocumentationPipe implements PipeTransform {
  /** @private Reference to the parent DocPageComponent for header/type context. */
  private readonly _page = inject(DocPageComponent);

  public async transform(index: number): Promise<MdxEntry | null> {
    const type = this._page.type();
    const directory = `${type ? type + '/' : ''}${kebabCase(this._page.header())}/examples/${index}`;

    try {
      const mod = await import(`../pages/${directory}/index.mdx`);
      return mod.default ?? null;
    } catch {
      return null;
    }
  }
}
