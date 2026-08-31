import type {
  MlvTileNodeWithChildren,
  MlvTileTreeNode,
  MlvTilesAccepts,
} from '@malva-ui/core/tile';

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

/** Viewport tier a per-breakpoint value is authored for. */
export type WbBreakpoint = 'desktop' | 'tablet' | 'mobile';

/** Page template whose content section the canvas is editing. */
export type WbPageType = 'homepage' | 'article' | 'category' | 'page';

/** Which of the three structural slots a section tree fills. */
export type WbSectionKind = 'header' | 'content' | 'footer';

/** Level-1 tab value. `all` edits the shared chrome, the rest edit one content section. */
export type WbTabValue = 'all' | WbPageType;

/** How wide a container renders on the published page. */
export type WbWidthMode = 'fixed' | 'fluid' | 'max-width-fluid';

/** Structural role a node plays. Mirrors, but does not replace, `acceptsChildren`. */
export type WbNodeKind = 'section' | 'container' | 'row' | 'block';

/** Every block the catalog can place. */
export type WbBlockType =
  | 'top-menu'
  | 'rich-text'
  | 'article-body'
  | 'articles'
  | 'hero'
  | 'banner'
  | 'newsletter'
  | 'search'
  | 'breadcrumbs'
  | 'category-tree'
  | 'social-links';

/**
 * A value authored once per breakpoint. Every breakpoint is always populated —
 * there is no inheritance chain to resolve at render time.
 */
export type WbResponsive<T> = Readonly<Record<WbBreakpoint, T>>;

/** Breakpoints in authoring order, widest first. */
export const WB_BREAKPOINTS: readonly WbBreakpoint[] = [
  'desktop',
  'tablet',
  'mobile',
];

/** Human label for one breakpoint, used in copy and validation messages. */
export const WB_BREAKPOINT_LABELS: WbResponsive<string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

/** Sentence explaining when a breakpoint's values apply. */
export const WB_BREAKPOINT_RANGES: WbResponsive<string> = {
  desktop: 'Applied from 1200 px and up.',
  tablet: 'Applied from 768 px to 1199 px.',
  mobile: 'Applied below 768 px.',
};

/** Lower-case noun used inside generated accessible names. */
export const WB_KIND_WORDS: Readonly<Record<WbNodeKind, string>> = {
  section: 'section',
  container: 'container',
  row: 'row',
  block: 'block',
};

/* -------------------------------------------------------------------------- */
/* Block settings                                                              */
/* -------------------------------------------------------------------------- */

/** Settings for the site navigation block. */
export interface WbTopMenuSettings {
  readonly blockType: 'top-menu';
  readonly source: 'main' | 'utility' | 'footer';
  readonly levels: number;
  readonly showIcons: boolean;
  readonly onMobile: 'burger' | 'scroll';
}

/** Settings for a free-form copy block. */
export interface WbRichTextSettings {
  readonly blockType: 'rich-text';
  readonly text: string;
  readonly alignment: 'start' | 'center' | 'end';
  readonly constrainWidth: boolean;
}

/** Settings for the article renderer. */
export interface WbArticleBodySettings {
  readonly blockType: 'article-body';
  readonly showLead: boolean;
  readonly showByline: boolean;
  readonly showReadingTime: boolean;
  readonly media: 'inline' | 'full-bleed' | 'gallery';
}

/** Settings for an article collection. */
export interface WbArticlesSettings {
  readonly blockType: 'articles';
  readonly fill: 'newest' | 'popular' | 'manual' | 'category';
  readonly categoryId: string | null;
  readonly includeSubcategories: boolean;
  readonly articleIds: readonly string[];
  readonly count: number;
  readonly display: 'grid' | 'list' | 'carousel';
  readonly columnsPerRow: number;
  readonly autoplay: boolean;
  readonly slideInterval: number;
  readonly showThumbnail: boolean;
  readonly showExcerpt: boolean;
}

/** Settings for the marketing hero. */
export interface WbHeroSettings {
  readonly blockType: 'hero';
  readonly headline: string;
  readonly supportingText: string;
  readonly background: 'image' | 'solid' | 'gradient' | 'video';
  readonly imageName: string;
  readonly colour: string;
  readonly videoUrl: string;
  readonly height: 'auto' | 'half' | 'full';
  readonly buttonLabel: string;
  readonly buttonUrl: string;
}

/** Settings for a promotional banner. */
export interface WbBannerSettings {
  readonly blockType: 'banner';
  readonly message: string;
  readonly tone: 'info' | 'success' | 'warning' | 'danger';
  readonly dismissible: boolean;
  readonly linkLabel: string;
  readonly linkUrl: string;
}

/** Settings for the mailing-list sign-up. */
export interface WbNewsletterSettings {
  readonly blockType: 'newsletter';
  readonly heading: string;
  readonly supportingText: string;
  readonly listId: string;
  readonly consentText: string;
  readonly layout: 'inline' | 'stacked';
}

/** Settings for the site search field. */
export interface WbSearchSettings {
  readonly blockType: 'search';
  readonly placeholder: string;
  readonly scope: 'all' | 'articles' | 'categories';
  readonly showRecent: boolean;
  readonly openResults: 'inline' | 'page';
  readonly resultsUrl: string;
}

/** Settings for the breadcrumb trail. */
export interface WbBreadcrumbsSettings {
  readonly blockType: 'breadcrumbs';
  readonly rootLabel: string;
  readonly separator: 'chevron' | 'slash' | 'dot';
  readonly showCurrent: boolean;
  readonly collapseAfter: number;
}

/** Settings for the category navigator. */
export interface WbCategoryTreeSettings {
  readonly blockType: 'category-tree';
  readonly startFrom: string | null;
  readonly levels: number;
  readonly showCounts: boolean;
  readonly expanded: boolean;
}

/** Settings for the social profile row. */
export interface WbSocialLinksSettings {
  readonly blockType: 'social-links';
  readonly networks: readonly string[];
  readonly iconStyle: 'solid' | 'outline';
  readonly iconSize: 's' | 'm' | 'l';
  readonly newTab: boolean;
}

/** Every block settings shape, discriminated on `blockType`. */
export type WbBlockSettings =
  | WbTopMenuSettings
  | WbRichTextSettings
  | WbArticleBodySettings
  | WbArticlesSettings
  | WbHeroSettings
  | WbBannerSettings
  | WbNewsletterSettings
  | WbSearchSettings
  | WbBreadcrumbsSettings
  | WbCategoryTreeSettings
  | WbSocialLinksSettings;

/* -------------------------------------------------------------------------- */
/* Node props                                                                  */
/* -------------------------------------------------------------------------- */

/** Fields carried by every node regardless of kind. */
interface WbCommonProps {
  /** Author-facing tile name. Doubles as the drag handle's accessible name. */
  readonly label: string;
  /** Switch state. A disabled node stays fully editable; the site would omit it. */
  readonly enabled: boolean;
}

/** Root of one section tree. Never rendered as a tile (binding decision D1). */
export interface WbSectionProps extends WbCommonProps {
  readonly kind: 'section';
  readonly section: WbSectionKind;
}

/** A page-width band that owns a per-breakpoint column count. */
export interface WbContainerProps extends WbCommonProps {
  readonly kind: 'container';
  readonly width: WbWidthMode;
  /** Pixel width. `null` exactly when `width === 'fluid'`. */
  readonly widthPx: number | null;
  readonly columns: WbResponsive<number>;
}

/** A horizontal band inside a container, spanning some of its columns. */
export interface WbRowProps extends WbCommonProps {
  readonly kind: 'row';
  readonly span: WbResponsive<number>;
}

/** A leaf that renders one piece of published content. */
export interface WbBlockProps extends WbCommonProps {
  readonly kind: 'block';
  readonly blockType: WbBlockType;
  readonly settings: WbBlockSettings;
}

/** Discriminated union of every node's props. */
export type WbProps =
  | WbSectionProps
  | WbContainerProps
  | WbRowProps
  | WbBlockProps;

/** One node of a Website Builder tree. */
export type WbNode = MlvTileTreeNode<WbProps>;

/** A node that accepts children — section, container or row. */
export type WbContainerNode = MlvTileNodeWithChildren<WbProps>;

/* -------------------------------------------------------------------------- */
/* Type guards                                                                 */
/* -------------------------------------------------------------------------- */

/** Narrows a node to a container. */
export function isWbContainer(
  node: WbNode,
): node is MlvTileNodeWithChildren<WbContainerProps> {
  return node.props.kind === 'container';
}

/** Narrows a node to a row. */
export function isWbRow(
  node: WbNode,
): node is MlvTileNodeWithChildren<WbRowProps> {
  return node.props.kind === 'row';
}

/** Children of a node, or an empty list for a leaf. */
export function wbChildren(node: WbNode): readonly WbNode[] {
  return node.acceptsChildren ? node.children : [];
}

/* -------------------------------------------------------------------------- */
/* Acceptance policy (UX §1.3)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Single structural drop policy for every depth of every tree.
 *
 * Cycle prevention, root protection and self/descendant exclusion belong to the
 * tile library and are deliberately not re-implemented here.
 *
 * | target      | current children | accepts          |
 * | ----------- | ---------------- | ---------------- |
 * | `section`   | any              | `container` only |
 * | `container` | any              | `row` only       |
 * | `row`       | empty            | `row` or `block` |
 * | `row`       | rows             | `row` only       |
 * | `row`       | blocks           | `block` only     |
 * | `block`     | —                | never a target   |
 */
export const wbAccepts: MlvTilesAccepts<WbProps> = (dragged, target, inner) => {
  const from = dragged.props.kind;

  switch (target.props.kind) {
    case 'section':
      return from === 'container';
    case 'container':
      return from === 'row';
    case 'row': {
      const settled = inner.filter((child) => child.id !== dragged.id);
      if (settled.length === 0) return from === 'row' || from === 'block';
      return settled[0].props.kind === from;
    }
    default:
      return false;
  }
};

/* -------------------------------------------------------------------------- */
/* Structural maths                                                            */
/* -------------------------------------------------------------------------- */

/** Deepest row-in-row nesting the Add menu will still offer a Row at. */
export const WB_MAX_ROW_DEPTH = 3;

/** Column counts a container may be configured with. */
export const WB_MIN_COLUMNS = 1;
/** Column counts a container may be configured with. */
export const WB_MAX_COLUMNS = 24;

/**
 * Columns a child row may occupy, counted in the nearest ancestor container's
 * grid. A row parented by a row inherits that row's own span as its ceiling.
 */
export function wbParentColumns(parent: WbNode): WbResponsive<number> {
  if (parent.props.kind === 'container') return parent.props.columns;
  if (parent.props.kind === 'row') return parent.props.span;
  // A section has no grid of its own; a container placed in it is full width.
  return { desktop: 1, tablet: 1, mobile: 1 };
}

/** Clamps one span map into `1..max` per breakpoint, preserving the reference when unchanged. */
export function wbClampSpan(
  span: WbResponsive<number>,
  max: WbResponsive<number>,
): WbResponsive<number> {
  const next: Record<WbBreakpoint, number> = {
    desktop: Math.min(Math.max(1, span.desktop), Math.max(1, max.desktop)),
    tablet: Math.min(Math.max(1, span.tablet), Math.max(1, max.tablet)),
    mobile: Math.min(Math.max(1, span.mobile), Math.max(1, max.mobile)),
  };

  const unchanged = WB_BREAKPOINTS.every((bp) => next[bp] === span[bp]);
  return unchanged ? span : next;
}

/** Breakpoints at which a row's span exceeds what its parent offers. */
export function wbOverflowingBreakpoints(
  span: WbResponsive<number>,
  max: WbResponsive<number>,
): readonly WbBreakpoint[] {
  return WB_BREAKPOINTS.filter((bp) => span[bp] > max[bp]);
}

/** Direct child rows whose span would overflow the supplied column counts. */
export function wbRowsOverflowing(
  parent: WbNode,
  max: WbResponsive<number>,
): readonly MlvTileNodeWithChildren<WbRowProps>[] {
  return wbChildren(parent)
    .filter(isWbRow)
    .filter((row) => wbOverflowingBreakpoints(row.props.span, max).length > 0);
}

/** Counts of every structural kind inside a subtree, excluding the node itself. */
export interface WbCounts {
  readonly containers: number;
  readonly rows: number;
  readonly blocks: number;
  /** Nodes whose own switch is off, at any depth. */
  readonly disabled: number;
  /** Total node count, used by the destructive-remove confirmation. */
  readonly total: number;
}

/** Walks a subtree once and tallies every kind. The root node is not counted. */
export function wbCount(node: WbNode): WbCounts {
  let containers = 0;
  let rows = 0;
  let blocks = 0;
  let disabled = 0;
  let total = 0;

  const walk = (current: WbNode): void => {
    for (const child of wbChildren(current)) {
      total += 1;
      if (!child.props.enabled) disabled += 1;
      switch (child.props.kind) {
        case 'container':
          containers += 1;
          break;
        case 'row':
          rows += 1;
          break;
        case 'block':
          blocks += 1;
          break;
        default:
          break;
      }
      walk(child);
    }
  };

  walk(node);
  return { containers, rows, blocks, disabled, total };
}

/** Adds two count records, for summarising several section trees at once. */
export function wbAddCounts(a: WbCounts, b: WbCounts): WbCounts {
  return {
    containers: a.containers + b.containers,
    rows: a.rows + b.rows,
    blocks: a.blocks + b.blocks,
    disabled: a.disabled + b.disabled,
    total: a.total + b.total,
  };
}

/** Zero counts, the identity for {@link wbAddCounts}. */
export const WB_ZERO_COUNTS: WbCounts = {
  containers: 0,
  rows: 0,
  blocks: 0,
  disabled: 0,
  total: 0,
};

/**
 * Grid column count reported by the layout summary: the first container's count
 * at the viewed breakpoint, or `null` when containers disagree or none exist.
 */
export function wbGridSummary(
  roots: readonly WbNode[],
  breakpoint: WbBreakpoint,
): number | 'mixed' | null {
  const counts: number[] = [];

  const walk = (node: WbNode): void => {
    for (const child of wbChildren(node)) {
      if (isWbContainer(child)) counts.push(child.props.columns[breakpoint]);
      walk(child);
    }
  };

  for (const root of roots) walk(root);
  if (counts.length === 0) return null;
  return counts.every((value) => value === counts[0]) ? counts[0] : 'mixed';
}

/** Locates a node plus its ancestry inside a tree, or `null` when absent. */
export function wbFindPath(
  root: WbContainerNode,
  id: string,
): readonly WbNode[] | null {
  const walk = (
    node: WbNode,
    trail: readonly WbNode[],
  ): readonly WbNode[] | null => {
    if (node.id === id) return [...trail, node];
    for (const child of wbChildren(node)) {
      const found = walk(child, [...trail, node]);
      if (found) return found;
    }
    return null;
  };

  return walk(root, []);
}

/** Row nesting depth of a node: `0` for a row parented by a container. */
export function wbRowDepth(path: readonly WbNode[]): number {
  // The last entry is the node itself; count only the row ancestors above it.
  return path.slice(0, -1).filter((node) => node.props.kind === 'row').length;
}
