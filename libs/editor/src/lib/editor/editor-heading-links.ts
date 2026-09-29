import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken, type Provider } from '@angular/core';
import type { MlvEditorHeadingLink } from '../extensions/heading-anchors/editor-heading-anchors';

/**
 * Builds the URL a heading copy-link puts on the clipboard.
 */
export interface MlvEditorHeadingLinks {
  /**
   * Returns the absolute or relative URL for one heading. Called at click
   * time only, never during render, so it may read browser globals.
   *
   * @param link The heading's anchor and its rendered `id` (with `idPrefix`).
   */
  href(link: MlvEditorHeadingLink): string;
}

/**
 * @private Default URL: the current page (`origin + pathname + search`, so no
 * old fragment and no credentials) plus `#` and the percent-encoded element
 * `id` — a custom `slugify` may return characters a fragment cannot carry
 * raw, and browsers decode the fragment before matching it to an `id`. Reads
 * the injected `DOCUMENT` at click time, so it is inert under server
 * rendering.
 */
const locationHeadingLinks = (document: Document): MlvEditorHeadingLinks => ({
  href: ({ id }) => {
    const location = document.location;
    const base = location
      ? `${location.origin}${location.pathname}${location.search}`
      : '';
    return `${base}#${encodeURIComponent(id)}`;
  },
});

/**
 * How `mlv-editor` builds heading links for the copy-link button and the
 * heading menu's "Copy link to heading" item. The root default links to the
 * current page; provide {@link provideMlvEditorHeadingLinks} (application or
 * component level) for another scheme, such as a canonical document URL.
 */
export const MLV_EDITOR_HEADING_LINKS =
  new InjectionToken<MlvEditorHeadingLinks>('MLV_EDITOR_HEADING_LINKS', {
    providedIn: 'root',
    factory: () => locationHeadingLinks(inject(DOCUMENT)),
  });

/**
 * Provides the heading-link builder `mlv-editor` uses.
 *
 * @param links The builder, e.g. `{ href: ({ id }) => \`${docUrl}#${id}\` }`.
 * @returns A provider for an application's or a component's `providers`.
 */
export function provideMlvEditorHeadingLinks(
  links: MlvEditorHeadingLinks,
): Provider {
  return { provide: MLV_EDITOR_HEADING_LINKS, useValue: links };
}
