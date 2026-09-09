/**
 * esbuild plugin that transforms .mdx files at build time.
 *
 * Intercepts imports of .mdx files and returns a JavaScript module that
 * exports { html, frontmatter, toc } instead of raw text.
 *
 * Registered via @nx/angular:application's `plugins` option in project.json.
 * Runs during both `build` and `serve` with full HMR support.
 */
import type { Plugin } from 'esbuild';
import { readFile } from 'fs/promises';
import matter = require('gray-matter');
import { marked, Renderer } from 'marked';

// ── Types (standalone — cannot import from Angular app code) ──

interface TocEntry {
  level: number;
  text: string;
  slug: string;
}

// ── Helpers ──

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Build-time heading list. Kept because the emitted module's shape is public to
 * the app (`MdxEntry.toc`); the rendered ToC is scanned from the DOM instead,
 * so that ids and permalinks survive two examples sharing a heading.
 */
function extractHeadings(markdown: string): TocEntry[] {
  const headingRe = /^(#{2,4})\s+(.+)$/gm;
  const entries: TocEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(markdown)) !== null) {
    entries.push({
      level: match[1].length,
      text: stripHtml(match[2].trim()),
      slug: slugify(match[2].trim()),
    });
  }
  return entries;
}

function parseMarkdown(markdown: string): string {
  const renderer = new Renderer();
  renderer.heading = function ({
    text,
    depth,
  }: {
    text: string;
    depth: number;
  }): string {
    const slug = slugify(stripHtml(text));
    // `docs-heading` is what opts this into the ToC scan — see
    // `collectTocEntries`, which selects by that class rather than by tag so a
    // heading a live preview renders is never mistaken for page structure.
    // The permalink is emitted empty: its glyph is a CSS mask (this HTML is
    // bound with `[innerHTML]`, and Angular's sanitizer drops an inline
    // `<svg>`), and the directive rewrites its `href` to a path-absolute one
    // and gives it an `aria-label` naming this heading.
    return [
      `<h${depth} id="${slug}" class="docs-heading">`,
      text,
      `<a class="docs-heading__anchor" href="#${slug}"></a>`,
      `</h${depth}>`,
    ].join('');
  };
  return marked.parse(markdown, { renderer }) as string;
}

// ── Plugin factory ──

export default function createMdxTransformPlugin(): Plugin {
  return {
    name: 'malva-ui-mdx-transform',
    setup(build) {
      // Intercept all .mdx file loads
      build.onLoad({ filter: /\.mdx$/ }, async (args) => {
        const raw = await readFile(args.path, 'utf-8');
        const { data: frontmatter, content: body } = matter(raw);
        const toc = extractHeadings(body);
        const html = parseMarkdown(body);

        // Return a JS module that exports the processed data
        const contents = [
          'export default ' + JSON.stringify({ html, frontmatter, toc }) + ';',
        ].join('\n');

        return { contents, loader: 'js' };
      });
    },
  };
}
