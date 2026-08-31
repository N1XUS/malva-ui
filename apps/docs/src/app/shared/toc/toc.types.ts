/**
 * A single entry in the Table of Contents, representing a heading in the MDX content.
 */
export interface TocEntry {
  /** The heading level (2 for h2, 3 for h3, etc.). h1 is excluded — page title is separate. */
  level: number;
  /** The plain-text heading content (HTML tags stripped). */
  text: string;
  /** The slug used as the anchor id (e.g., "variants", "sizes-and-spacing"). */
  slug: string;
}

/**
 * Frontmatter fields extracted from the YAML header of an MDX file.
 */
export interface MdxFrontmatter {
  /** Example title override. Falls back to "Example" if not provided. */
  title?: string;
  /** Short description shown below the title. */
  description?: string;
}

/**
 * A single parsed MDX entry, the shape returned by the esbuild plugin's default export.
 */
export interface MdxEntry {
  /** Pre-rendered HTML string (Markdown already parsed at build time). */
  html: string;
  /** Frontmatter metadata extracted from YAML header. */
  frontmatter: MdxFrontmatter;
  /** Headings extracted for Table of Contents. */
  toc: TocEntry[];
}
