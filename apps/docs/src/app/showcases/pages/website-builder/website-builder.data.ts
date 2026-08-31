import type { LucideIconInput } from '@lucide/angular';
import {
  LucideBookOpenText,
  LucideChevronRight,
  LucideContainer,
  LucideFolderTree,
  LucideLayoutTemplate,
  LucideMail,
  LucideMegaphone,
  LucideMenu,
  LucideNewspaper,
  LucidePanelBottom,
  LucidePanelTop,
  LucideRectangleHorizontal,
  LucideRows3,
  LucideSearch,
  LucideShare2,
  LucideType,
} from '@lucide/angular';
import type { MlvSelectOption } from '@malva-ui/core/select';

import type {
  WbArticleBodySettings,
  WbArticlesSettings,
  WbBannerSettings,
  WbBlockSettings,
  WbBlockType,
  WbBreadcrumbsSettings,
  WbCategoryTreeSettings,
  WbContainerNode,
  WbHeroSettings,
  WbNewsletterSettings,
  WbNodeKind,
  WbPageType,
  WbResponsive,
  WbRichTextSettings,
  WbSearchSettings,
  WbSectionKind,
  WbSocialLinksSettings,
  WbTabValue,
  WbTopMenuSettings,
  WbWidthMode,
} from './website-builder.types';

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

/** One level-1 tab. */
export interface WbTab {
  readonly value: WbTabValue;
  readonly label: string;
  readonly description: string;
}

/** Level-1 tabs in render order. `all` edits the shared chrome. */
export const WB_TABS: readonly WbTab[] = [
  {
    value: 'all',
    label: 'All',
    description:
      'The header and footer every page type inherits. Changes here apply everywhere.',
  },
  {
    value: 'homepage',
    label: 'Homepage',
    description:
      'The homepage content section. The shared header and footer are shown for context and cannot be edited here.',
  },
  {
    value: 'article',
    label: 'Article',
    description:
      'The article content section. The shared header and footer are shown for context and cannot be edited here.',
  },
  {
    value: 'category',
    label: 'Category',
    description:
      'The category content section. The shared header and footer are shown for context and cannot be edited here.',
  },
  {
    value: 'page',
    label: 'Page',
    description:
      'The generic page content section. The shared header and footer are shown for context and cannot be edited here.',
  },
];

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

/** Icon for a section, chosen by the slot it fills. */
export const WB_SECTION_ICONS: Readonly<
  Record<WbSectionKind, LucideIconInput>
> = {
  header: LucidePanelTop,
  content: LucideLayoutTemplate,
  footer: LucidePanelBottom,
};

/** Icon for the two structural kinds that are not blocks. */
export const WB_KIND_ICONS: Readonly<
  Record<Exclude<WbNodeKind, 'section' | 'block'>, LucideIconInput>
> = {
  container: LucideContainer,
  row: LucideRows3,
};

/* -------------------------------------------------------------------------- */
/* Block catalog                                                               */
/* -------------------------------------------------------------------------- */

/** A grouping used by the Add menu and by nothing else. */
export type WbBlockGroupId = 'navigation' | 'content' | 'marketing' | 'social';

/** Catalog record for one block type. */
export interface WbBlockCatalogEntry {
  readonly type: WbBlockType;
  readonly label: string;
  readonly icon: LucideIconInput;
  readonly group: WbBlockGroupId;
}

/** Every placeable block, in catalog order. */
export const WB_BLOCK_CATALOG: readonly WbBlockCatalogEntry[] = [
  {
    type: 'top-menu',
    label: 'Top menu',
    icon: LucideMenu,
    group: 'navigation',
  },
  {
    type: 'breadcrumbs',
    label: 'Breadcrumbs',
    icon: LucideChevronRight,
    group: 'navigation',
  },
  { type: 'search', label: 'Search', icon: LucideSearch, group: 'navigation' },
  {
    type: 'category-tree',
    label: 'Category tree',
    icon: LucideFolderTree,
    group: 'navigation',
  },
  { type: 'rich-text', label: 'Rich text', icon: LucideType, group: 'content' },
  {
    type: 'article-body',
    label: 'Article body',
    icon: LucideBookOpenText,
    group: 'content',
  },
  {
    type: 'articles',
    label: 'Articles',
    icon: LucideNewspaper,
    group: 'content',
  },
  { type: 'hero', label: 'Hero', icon: LucideMegaphone, group: 'marketing' },
  {
    type: 'banner',
    label: 'Banner',
    icon: LucideRectangleHorizontal,
    group: 'marketing',
  },
  {
    type: 'newsletter',
    label: 'Newsletter',
    icon: LucideMail,
    group: 'marketing',
  },
  {
    type: 'social-links',
    label: 'Social links',
    icon: LucideShare2,
    group: 'social',
  },
];

/** One Add-menu group with its blocks already resolved. */
export interface WbBlockGroup {
  readonly id: WbBlockGroupId;
  readonly label: string;
  readonly blocks: readonly WbBlockCatalogEntry[];
}

/** Add-menu groups in menu order. */
export const WB_BLOCK_GROUPS: readonly WbBlockGroup[] = (
  [
    ['navigation', 'Navigation'],
    ['content', 'Content'],
    ['marketing', 'Marketing'],
    ['social', 'Social'],
  ] as const
).map(([id, label]) => ({
  id,
  label,
  blocks: WB_BLOCK_CATALOG.filter((entry) => entry.group === id),
}));

/** Author-facing label of one block type. */
export function wbBlockLabel(type: WbBlockType): string {
  return (
    WB_BLOCK_CATALOG.find((entry) => entry.type === type)?.label ?? 'Block'
  );
}

/** Icon of one block type. */
export function wbBlockIcon(type: WbBlockType): LucideIconInput {
  return (
    WB_BLOCK_CATALOG.find((entry) => entry.type === type)?.icon ??
    LucideRectangleHorizontal
  );
}

/* -------------------------------------------------------------------------- */
/* Select option sets                                                          */
/* -------------------------------------------------------------------------- */

/** A value list plus the projection `mlv-select` needs. */
export interface WbOptionSet<T extends string> {
  readonly values: readonly T[];
  readonly toOption: (value: T) => MlvSelectOption<T>;
}

/**
 * Builds a typed option set from `[value, label]` pairs.
 *
 * `MlvSelectOption` carries `label`, `value` and an optional `group` only —
 * there is no per-option description, and `mlv-dropdown-panel` renders none.
 * Guidance that the UX spec wrote as per-option help therefore lives in the
 * field-level `description` instead of an `[mlvSelectItemTemplate]` override.
 */
function optionSet<T extends string>(
  entries: readonly (readonly [T, string])[],
): WbOptionSet<T> {
  const byValue = new Map(entries.map((entry) => [entry[0], entry[1]]));
  return {
    values: entries.map((entry) => entry[0]),
    toOption: (value: T) => ({
      value,
      label: byValue.get(value) ?? String(value),
    }),
  };
}

/** Container width behaviour. */
export const WB_WIDTH_MODES = optionSet<WbWidthMode>([
  ['fluid', 'Fluid'],
  ['fixed', 'Fixed'],
  ['max-width-fluid', 'Fluid up to a maximum'],
]);

/** Navigation menu a `top-menu` block renders. */
export const WB_MENU_SOURCES = optionSet<WbTopMenuSettings['source']>([
  ['main', 'Main navigation'],
  ['utility', 'Utility navigation'],
  ['footer', 'Footer navigation'],
]);

/** How a `top-menu` collapses on small screens. */
export const WB_MENU_MOBILE = optionSet<WbTopMenuSettings['onMobile']>([
  ['burger', 'Collapse into a menu button'],
  ['scroll', 'Scroll horizontally'],
]);

/** Text alignment for a `rich-text` block. */
export const WB_TEXT_ALIGNMENTS = optionSet<WbRichTextSettings['alignment']>([
  ['start', 'Left'],
  ['center', 'Centred'],
  ['end', 'Right'],
]);

/** How the article renderer treats embedded media. */
export const WB_ARTICLE_MEDIA = optionSet<WbArticleBodySettings['media']>([
  ['inline', 'Inline with the text'],
  ['full-bleed', 'Full-bleed'],
  ['gallery', 'Collect into a gallery'],
]);

/** How an `articles` block decides what to show. */
export const WB_ARTICLE_FILLS = optionSet<WbArticlesSettings['fill']>([
  ['newest', 'Newest first'],
  ['popular', 'Most popular'],
  ['manual', 'Chosen manually'],
  ['category', 'From a category'],
]);

/** Hero background source. */
export const WB_HERO_BACKGROUNDS = optionSet<WbHeroSettings['background']>([
  ['image', 'Image'],
  ['solid', 'Solid colour'],
  ['gradient', 'Gradient'],
  ['video', 'Video'],
]);

/** Hero height. */
export const WB_HERO_HEIGHTS = optionSet<WbHeroSettings['height']>([
  ['auto', 'Fit the content'],
  ['half', 'Half the viewport'],
  ['full', 'Full viewport'],
]);

/** Banner tone. */
export const WB_BANNER_TONES = optionSet<WbBannerSettings['tone']>([
  ['info', 'Information'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['danger', 'Danger'],
]);

/** Newsletter layout. */
export const WB_NEWSLETTER_LAYOUTS = optionSet<WbNewsletterSettings['layout']>([
  ['inline', 'Field and button on one line'],
  ['stacked', 'Stacked'],
]);

/** What the search block searches. */
export const WB_SEARCH_SCOPES = optionSet<WbSearchSettings['scope']>([
  ['all', 'All content'],
  ['articles', 'Articles only'],
  ['categories', 'Categories only'],
]);

/** Where search results appear. */
export const WB_SEARCH_TARGETS = optionSet<WbSearchSettings['openResults']>([
  ['inline', 'In a dropdown'],
  ['page', 'On a results page'],
]);

/** Breadcrumb separator glyph. */
export const WB_BREADCRUMB_SEPARATORS = optionSet<
  WbBreadcrumbsSettings['separator']
>([
  ['chevron', 'Chevron'],
  ['slash', 'Slash'],
  ['dot', 'Dot'],
]);

/** Social icon style. */
export const WB_SOCIAL_STYLES = optionSet<WbSocialLinksSettings['iconStyle']>([
  ['solid', 'Solid'],
  ['outline', 'Outline'],
]);

/** Social icon size. */
export const WB_SOCIAL_SIZES = optionSet<WbSocialLinksSettings['iconSize']>([
  ['s', 'Small'],
  ['m', 'Medium'],
  ['l', 'Large'],
]);

/** Networks the social block can link to. */
export const WB_SOCIAL_NETWORKS: readonly { id: string; label: string }[] = [
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'mastodon', label: 'Mastodon' },
  { id: 'x', label: 'X' },
  { id: 'youtube', label: 'YouTube' },
];

/** Editorial categories the CMS exposes to the article and tree blocks. */
export const WB_CATEGORIES = optionSet<string>([
  ['cat-news', 'News'],
  ['cat-features', 'Features'],
  ['cat-reviews', 'Reviews'],
  ['cat-opinion', 'Opinion'],
  ['cat-guides', 'Guides'],
  ['cat-interviews', 'Interviews'],
  ['cat-events', 'Events'],
  ['cat-releases', 'Product releases'],
]);

/** Category options with the "All categories" escape hatch prepended. */
export const WB_CATEGORY_ROOTS: WbOptionSet<string> = {
  values: ['', ...WB_CATEGORIES.values],
  toOption: (value: string) =>
    value === ''
      ? { value: '', label: 'All categories' }
      : WB_CATEGORIES.toOption(value),
};

/** Articles selectable by hand in the `articles` dialog. */
export const WB_ARTICLES: readonly { id: string; label: string }[] = [
  { id: 'a-01', label: 'The quiet rebuild of the city grid' },
  { id: 'a-02', label: 'Field notes from a slow harvest' },
  { id: 'a-03', label: 'Why the archive matters again' },
  { id: 'a-04', label: 'A short history of the ferry line' },
  { id: 'a-05', label: 'Six makers changing the coastline' },
  { id: 'a-06', label: 'The maps we stopped drawing' },
  { id: 'a-07', label: 'Inside the winter print run' },
  { id: 'a-08', label: 'What the river carried back' },
];

/** Label for one article id, falling back to the id itself. */
export function wbArticleLabel(id: string): string {
  return WB_ARTICLES.find((article) => article.id === id)?.label ?? id;
}

/* -------------------------------------------------------------------------- */
/* Block settings defaults (UX §5.4)                                           */
/* -------------------------------------------------------------------------- */

const TOP_MENU_DEFAULTS: WbTopMenuSettings = {
  blockType: 'top-menu',
  source: 'main',
  levels: 2,
  showIcons: false,
  onMobile: 'burger',
};

const RICH_TEXT_DEFAULTS: WbRichTextSettings = {
  blockType: 'rich-text',
  text: '',
  alignment: 'start',
  constrainWidth: true,
};

const ARTICLE_BODY_DEFAULTS: WbArticleBodySettings = {
  blockType: 'article-body',
  showLead: true,
  showByline: true,
  showReadingTime: false,
  media: 'inline',
};

const ARTICLES_DEFAULTS: WbArticlesSettings = {
  blockType: 'articles',
  fill: 'newest',
  categoryId: null,
  includeSubcategories: true,
  articleIds: [],
  count: 6,
  display: 'grid',
  columnsPerRow: 3,
  autoplay: false,
  slideInterval: 5,
  showThumbnail: true,
  showExcerpt: true,
};

const HERO_DEFAULTS: WbHeroSettings = {
  blockType: 'hero',
  headline: '',
  supportingText: '',
  background: 'image',
  imageName: '',
  colour: '#1e1e1e',
  videoUrl: '',
  height: 'half',
  buttonLabel: '',
  buttonUrl: '',
};

const BANNER_DEFAULTS: WbBannerSettings = {
  blockType: 'banner',
  message: '',
  tone: 'info',
  dismissible: true,
  linkLabel: '',
  linkUrl: '',
};

const NEWSLETTER_DEFAULTS: WbNewsletterSettings = {
  blockType: 'newsletter',
  heading: 'Stay in the loop',
  supportingText: '',
  listId: '',
  consentText: 'I agree to receive email updates.',
  layout: 'inline',
};

const SEARCH_DEFAULTS: WbSearchSettings = {
  blockType: 'search',
  placeholder: 'Search the site',
  scope: 'all',
  showRecent: true,
  openResults: 'inline',
  resultsUrl: '',
};

const BREADCRUMBS_DEFAULTS: WbBreadcrumbsSettings = {
  blockType: 'breadcrumbs',
  rootLabel: 'Home',
  separator: 'chevron',
  showCurrent: true,
  collapseAfter: 4,
};

const CATEGORY_TREE_DEFAULTS: WbCategoryTreeSettings = {
  blockType: 'category-tree',
  startFrom: null,
  levels: 2,
  showCounts: true,
  expanded: false,
};

const SOCIAL_LINKS_DEFAULTS: WbSocialLinksSettings = {
  blockType: 'social-links',
  networks: ['linkedin', 'youtube'],
  iconStyle: 'outline',
  iconSize: 'm',
  newTab: true,
};

/** Default settings record for every block type, keyed by type. */
export const WB_BLOCK_DEFAULTS: Readonly<Record<WbBlockType, WbBlockSettings>> =
  {
    'top-menu': TOP_MENU_DEFAULTS,
    'rich-text': RICH_TEXT_DEFAULTS,
    'article-body': ARTICLE_BODY_DEFAULTS,
    articles: ARTICLES_DEFAULTS,
    hero: HERO_DEFAULTS,
    banner: BANNER_DEFAULTS,
    newsletter: NEWSLETTER_DEFAULTS,
    search: SEARCH_DEFAULTS,
    breadcrumbs: BREADCRUMBS_DEFAULTS,
    'category-tree': CATEGORY_TREE_DEFAULTS,
    'social-links': SOCIAL_LINKS_DEFAULTS,
  };

/** Grid a freshly added container starts with. */
export const WB_DEFAULT_COLUMNS: WbResponsive<number> = {
  desktop: 12,
  tablet: 8,
  mobile: 4,
};

/* -------------------------------------------------------------------------- */
/* Seed fixtures — every id is a literal, never generated                      */
/* -------------------------------------------------------------------------- */

/** Shorthand for a block leaf in the seed data. */
function block(
  id: string,
  label: string,
  type: WbBlockType,
  settings: Partial<WbBlockSettings> = {},
  enabled = true,
): WbContainerNode['children'][number] {
  return {
    id,
    acceptsChildren: false,
    props: {
      kind: 'block',
      label,
      enabled,
      blockType: type,
      settings: {
        ...WB_BLOCK_DEFAULTS[type],
        ...settings,
      } as WbBlockSettings,
    },
  };
}

/** Shorthand for a row in the seed data. */
function row(
  id: string,
  label: string,
  span: WbResponsive<number>,
  children: WbContainerNode['children'],
  enabled = true,
): WbContainerNode {
  return {
    id,
    acceptsChildren: true,
    props: { kind: 'row', label, enabled, span },
    children,
  };
}

/** Shorthand for a container in the seed data. */
function container(
  id: string,
  label: string,
  width: WbWidthMode,
  widthPx: number | null,
  columns: WbResponsive<number>,
  children: WbContainerNode['children'],
  enabled = true,
): WbContainerNode {
  return {
    id,
    acceptsChildren: true,
    props: { kind: 'container', label, enabled, width, widthPx, columns },
    children,
  };
}

/** Shorthand for a section root in the seed data. */
function section(
  id: string,
  label: string,
  kind: WbSectionKind,
  children: WbContainerNode['children'],
): WbContainerNode {
  return {
    id,
    acceptsChildren: true,
    props: { kind: 'section', label, enabled: true, section: kind },
    children,
  };
}

const FULL: WbResponsive<number> = { desktop: 12, tablet: 8, mobile: 4 };

/** Shared header section, inherited by every page type. */
export const WB_HEADER_SEED: WbContainerNode = section(
  'hdr-root',
  'Header section',
  'header',
  [
    container(
      'hdr-utility',
      'Utility container',
      'fluid',
      null,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row(
          'hdr-utility-row',
          'Utility row',
          { desktop: 12, tablet: 8, mobile: 4 },
          [
            block('hdr-utility-search', 'Site search block', 'search', {
              placeholder: 'Search the archive',
              scope: 'all',
              openResults: 'inline',
            }),
            block('hdr-utility-social', 'Social links block', 'social-links', {
              networks: ['bluesky', 'mastodon', 'linkedin'],
              iconSize: 's',
            }),
          ],
        ),
      ],
    ),
    container(
      'hdr-masthead',
      'Masthead container',
      'max-width-fluid',
      1280,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row(
          'hdr-masthead-row',
          'Masthead row',
          { desktop: 12, tablet: 8, mobile: 4 },
          [
            row(
              'hdr-brand-row',
              'Brand row',
              { desktop: 4, tablet: 3, mobile: 4 },
              [
                block('hdr-brand-text', 'Wordmark block', 'rich-text', {
                  text: 'The Harbour Review',
                  alignment: 'start',
                  constrainWidth: false,
                }),
              ],
            ),
            row(
              'hdr-nav-row',
              'Navigation row',
              { desktop: 8, tablet: 5, mobile: 4 },
              [
                block('hdr-nav-menu', 'Primary menu block', 'top-menu', {
                  source: 'main',
                  levels: 2,
                  onMobile: 'burger',
                }),
              ],
            ),
          ],
        ),
      ],
    ),
    container(
      'hdr-trail',
      'Breadcrumb container',
      'max-width-fluid',
      1280,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row('hdr-trail-row', 'Breadcrumb row', FULL, [
          block('hdr-trail-crumbs', 'Breadcrumbs block', 'breadcrumbs', {
            rootLabel: 'Home',
            separator: 'chevron',
            collapseAfter: 4,
          }),
        ]),
      ],
    ),
  ],
);

/** Shared footer section, inherited by every page type. */
export const WB_FOOTER_SEED: WbContainerNode = section(
  'ftr-root',
  'Footer section',
  'footer',
  [
    container(
      'ftr-body',
      'Footer container',
      'max-width-fluid',
      1280,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row('ftr-body-row', 'Footer columns row', FULL, [
          row(
            'ftr-signup-row',
            'Sign-up row',
            { desktop: 6, tablet: 8, mobile: 4 },
            [
              block('ftr-signup', 'Newsletter block', 'newsletter', {
                heading: 'The weekly dispatch',
                supportingText: 'One letter every Friday. Nothing else, ever.',
                listId: 'list-weekly-dispatch',
                layout: 'stacked',
              }),
            ],
          ),
          row(
            'ftr-explore-row',
            'Explore row',
            { desktop: 3, tablet: 4, mobile: 4 },
            [
              block('ftr-explore', 'Category tree block', 'category-tree', {
                startFrom: null,
                levels: 1,
                showCounts: false,
                expanded: true,
              }),
            ],
          ),
          row(
            'ftr-follow-row',
            'Follow row',
            { desktop: 3, tablet: 4, mobile: 4 },
            [
              block('ftr-follow', 'Social links block', 'social-links', {
                networks: ['bluesky', 'instagram', 'linkedin', 'youtube'],
                iconStyle: 'solid',
              }),
            ],
          ),
        ]),
      ],
    ),
    container(
      'ftr-legal',
      'Legal container',
      'fluid',
      null,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row('ftr-legal-row', 'Legal row', FULL, [
          block('ftr-legal-text', 'Copyright block', 'rich-text', {
            text: '© The Harbour Review. Published in Bristol. Registered charity 1094882.',
            alignment: 'center',
            constrainWidth: false,
          }),
          block('ftr-legal-menu', 'Legal menu block', 'top-menu', {
            source: 'footer',
            levels: 1,
            onMobile: 'scroll',
          }),
        ]),
      ],
    ),
  ],
);

/** Homepage content section. */
const WB_HOMEPAGE_SEED: WbContainerNode = section(
  'home-root',
  'Homepage content section',
  'content',
  [
    container(
      'home-hero',
      'Hero container',
      'fluid',
      null,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row('home-hero-row', 'Hero row', FULL, [
          block('home-hero-block', 'Season launch hero', 'hero', {
            headline: 'The winter issue is here',
            supportingText:
              'Sixty pages on the harbour, the people rebuilding it, and the tide that keeps changing the plan.',
            background: 'image',
            imageName: 'winter-issue-cover.jpg',
            height: 'half',
            buttonLabel: 'Read the issue',
            buttonUrl: 'https://harbourreview.example/winter',
          }),
        ]),
      ],
    ),
    container(
      'home-editorial',
      'Editorial container',
      'max-width-fluid',
      1200,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row(
          'home-lead-row',
          'Lead story row',
          { desktop: 8, tablet: 8, mobile: 4 },
          [
            block('home-lead', 'Lead stories block', 'articles', {
              fill: 'newest',
              count: 4,
              display: 'grid',
              columnsPerRow: 2,
              showThumbnail: true,
              showExcerpt: true,
            }),
          ],
        ),
        row(
          'home-popular-row',
          'Most read row',
          { desktop: 4, tablet: 4, mobile: 4 },
          [
            block('home-popular', 'Most read block', 'articles', {
              fill: 'popular',
              count: 6,
              display: 'list',
              showThumbnail: false,
              showExcerpt: false,
            }),
          ],
        ),
        row('home-promo-row', 'Promotion row', FULL, [
          row(
            'home-campaign-row',
            'Campaign row',
            { desktop: 8, tablet: 5, mobile: 4 },
            [
              block('home-campaign', 'Membership banner', 'banner', {
                message: 'Members read every issue a week early.',
                tone: 'info',
                dismissible: true,
                linkLabel: 'Join',
                linkUrl: 'https://harbourreview.example/members',
              }),
            ],
          ),
          row(
            'home-signup-row',
            'Sign-up row',
            { desktop: 4, tablet: 3, mobile: 4 },
            [
              block('home-signup', 'Newsletter block', 'newsletter', {
                heading: 'Friday dispatch',
                listId: 'list-weekly-dispatch',
                layout: 'inline',
              }),
            ],
          ),
        ]),
      ],
    ),
    container(
      'home-browse',
      'Browse container',
      'fluid',
      null,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row('home-browse-row', 'Browse row', FULL, [
          block('home-browse-tree', 'Category tree block', 'category-tree', {
            startFrom: null,
            levels: 2,
            showCounts: true,
          }),
        ]),
      ],
      false,
    ),
  ],
);

/** Article content section — the deepest seeded layout. */
const WB_ARTICLE_SEED: WbContainerNode = section(
  'art-root',
  'Article content section',
  'content',
  [
    container(
      'art-shell',
      'Article container',
      'max-width-fluid',
      1120,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row('art-head-row', 'Article header row', FULL, [
          block('art-head-crumbs', 'Breadcrumbs block', 'breadcrumbs', {
            rootLabel: 'Home',
            separator: 'slash',
            collapseAfter: 3,
          }),
          block('art-head-kicker', 'Kicker block', 'rich-text', {
            text: 'Reporting from the waterfront',
            alignment: 'start',
            constrainWidth: true,
          }),
        ]),
        row('art-main-row', 'Body and rail row', FULL, [
          row(
            'art-body-row',
            'Body row',
            { desktop: 8, tablet: 8, mobile: 4 },
            [
              block('art-body', 'Article body block', 'article-body', {
                showLead: true,
                showByline: true,
                showReadingTime: true,
                media: 'inline',
              }),
            ],
          ),
          row(
            'art-rail-row',
            'Sidebar row',
            { desktop: 4, tablet: 8, mobile: 4 },
            [
              row(
                'art-related-row',
                'Related row',
                { desktop: 4, tablet: 4, mobile: 4 },
                [
                  block('art-related', 'Related articles block', 'articles', {
                    fill: 'category',
                    categoryId: 'cat-features',
                    includeSubcategories: true,
                    count: 3,
                    display: 'list',
                    showThumbnail: true,
                    showExcerpt: false,
                  }),
                ],
              ),
              row(
                'art-rail-signup-row',
                'Rail sign-up row',
                {
                  desktop: 4,
                  tablet: 4,
                  mobile: 4,
                },
                [
                  block('art-rail-signup', 'Newsletter block', 'newsletter', {
                    heading: 'Follow this story',
                    listId: 'list-features',
                    layout: 'stacked',
                  }),
                ],
              ),
            ],
          ),
        ]),
        row('art-more-row', 'More from this section row', FULL, [
          block('art-more', 'More articles block', 'articles', {
            fill: 'manual',
            articleIds: ['a-03', 'a-06', 'a-08'],
            display: 'carousel',
            autoplay: true,
            slideInterval: 6,
            showThumbnail: true,
            showExcerpt: true,
          }),
        ]),
      ],
    ),
  ],
);

/**
 * Category content section. `cat-results-row` is deliberately seeded with a
 * mobile span of 6 against a 4-column mobile grid so the invalid-span treatment
 * (UX §3.6) is visible without the reader having to break something first.
 */
const WB_CATEGORY_SEED: WbContainerNode = section(
  'cat-root',
  'Category content section',
  'content',
  [
    container(
      'cat-head',
      'Category header container',
      'fluid',
      null,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row('cat-head-row', 'Category header row', FULL, [
          block('cat-head-crumbs', 'Breadcrumbs block', 'breadcrumbs', {
            rootLabel: 'Home',
            collapseAfter: 4,
          }),
          block('cat-head-intro', 'Category intro block', 'rich-text', {
            text: 'Everything filed under this section, newest first.',
            alignment: 'start',
          }),
        ]),
      ],
    ),
    container(
      'cat-listing',
      'Listing container',
      'max-width-fluid',
      1200,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row(
          'cat-filters-row',
          'Filters row',
          { desktop: 3, tablet: 8, mobile: 4 },
          [
            block('cat-filters', 'Category tree block', 'category-tree', {
              startFrom: 'cat-features',
              levels: 3,
              showCounts: true,
              expanded: true,
            }),
          ],
        ),
        row(
          'cat-results-row',
          'Results row',
          { desktop: 9, tablet: 8, mobile: 6 },
          [
            block('cat-results', 'Results block', 'articles', {
              fill: 'category',
              categoryId: 'cat-reviews',
              includeSubcategories: false,
              count: 12,
              display: 'grid',
              columnsPerRow: 3,
            }),
          ],
        ),
        row('cat-promo-row', 'Promotion row', FULL, [
          block('cat-promo', 'Section banner', 'banner', {
            message: 'Reviews are open to non-members for the rest of March.',
            tone: 'success',
            dismissible: false,
          }),
        ]),
      ],
    ),
  ],
);

/**
 * Generic page content section. Seeds one empty container and one empty row so
 * both empty states (UX §7) are reachable on first paint.
 */
const WB_PAGE_SEED: WbContainerNode = section(
  'pg-root',
  'Page content section',
  'content',
  [
    container(
      'pg-shell',
      'Page container',
      'fixed',
      960,
      { desktop: 12, tablet: 8, mobile: 4 },
      [
        row('pg-intro-row', 'Intro row', FULL, [
          block('pg-intro-crumbs', 'Breadcrumbs block', 'breadcrumbs', {
            rootLabel: 'Home',
            showCurrent: true,
          }),
          block('pg-intro-text', 'Intro block', 'rich-text', {
            text: 'About the review, how it is funded, and who makes it.',
            alignment: 'start',
          }),
        ]),
        row('pg-body-row', 'Body row', FULL, [
          block('pg-body-text', 'Body block', 'rich-text', {
            text: 'The Harbour Review has been published from the same room above the ferry office since 1998. It is funded entirely by members and by the annual print auction, and it has never carried programmatic advertising.',
            alignment: 'start',
            constrainWidth: true,
          }),
        ]),
        row(
          'pg-contact-row',
          'Contact row',
          FULL,
          [
            block('pg-contact', 'Contact newsletter block', 'newsletter', {
              heading: 'Write to the editors',
              listId: 'list-editors',
              layout: 'stacked',
            }),
          ],
          false,
        ),
        row('pg-reserved-row', 'Reserved row', FULL, []),
      ],
    ),
    container(
      'pg-appendix',
      'Appendix container',
      'fluid',
      null,
      { desktop: 12, tablet: 8, mobile: 4 },
      [],
    ),
  ],
);

/** Content section for every page type, keyed by type. */
export const WB_CONTENT_SEED: Readonly<Record<WbPageType, WbContainerNode>> = {
  homepage: WB_HOMEPAGE_SEED,
  article: WB_ARTICLE_SEED,
  category: WB_CATEGORY_SEED,
  page: WB_PAGE_SEED,
};

/** Breadcrumb trail shown in the page header. */
export const WB_BREADCRUMBS = [
  { label: 'Site' },
  { label: 'Layouts' },
] as const;
