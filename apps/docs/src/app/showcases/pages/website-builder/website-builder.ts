import type { ElementRef, WritableSignal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideContainer,
  LucideCopy,
  LucideDynamicIcon,
  LucideEllipsis,
  LucideEye,
  LucideGalleryHorizontal,
  LucideKeyboard,
  LucideLayoutGrid,
  LucideLayoutTemplate,
  LucideList,
  LucideLock,
  LucideMonitor,
  LucidePencil,
  LucidePlus,
  LucideSmartphone,
  LucideTablet,
  LucideUndo2,
} from '@lucide/angular';
import { MlvResizeObserverService, MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvAlert, MlvAlertTitle } from '@malva-ui/core/alert';
import { MlvBadge } from '@malva-ui/core/badge';
import type { MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvBreadcrumb } from '@malva-ui/core/breadcrumb';
import type { MlvBreadcrumbEntry } from '@malva-ui/core/breadcrumb';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvCheckbox, MlvCheckboxGroup } from '@malva-ui/core/checkbox';
import { MlvColorPicker } from '@malva-ui/core/color-picker';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogService,
  MlvDialogTemplate,
} from '@malva-ui/core/dialog';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { MlvFileUpload } from '@malva-ui/core/file-upload';
import type { MlvUploadedFile } from '@malva-ui/core/file-upload';
import { MlvFieldset, MlvFieldsetSpan, MlvForm } from '@malva-ui/core/form';
import { MlvDescription } from '@malva-ui/core/form-utils';
import type { MlvFormState } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MlvListItem } from '@malva-ui/core/list';
import {
  MlvMenu,
  MlvMenuItem,
  MlvMenuSeparator,
  MlvMenuTrigger,
} from '@malva-ui/core/menu';
import { MlvNumberInput } from '@malva-ui/core/number-input';
import {
  MlvPage,
  MlvPageBreadcrumb,
  MlvPageContent,
  MlvPageDock,
  MlvPageDockEnd,
  MlvPageDockStart,
  MlvPageHeader,
  MlvPageHeaderActions,
  MlvPageHeaderDescription,
  MlvPageHeaderStatus,
  MlvPageHeaderTabs,
  MlvPageHeaderTabsActions,
  MlvPageShell,
  MlvPageSummary,
  MlvPageSummaryItem,
  MlvPageTitle,
  MlvPageSnapController,
} from '@malva-ui/core/page';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvSelect } from '@malva-ui/core/select';
import { MlvSwitch } from '@malva-ui/core/switch';
import {
  MlvTab,
  MlvTabContentDef,
  MlvTabDef,
  MlvTabGroup,
} from '@malva-ui/core/tabs';
import { MlvTextarea } from '@malva-ui/core/textarea';
import {
  MlvTiles,
  MlvTilesEmpty,
  insertMlvTileNode,
  updateMlvTileNodeProps,
} from '@malva-ui/core/tile';
import type { MlvTileNodeWithChildren } from '@malva-ui/core/tile';
import { MlvToastService } from '@malva-ui/core/toast';
import { MlvTokenizer } from '@malva-ui/core/tokenizer';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvTooltip } from '@malva-ui/core/tooltip';

import { runShowcaseOperation } from '../../shared/showcase-async';
import {
  WB_ARTICLES,
  WB_ARTICLE_FILLS,
  WB_ARTICLE_MEDIA,
  WB_BANNER_TONES,
  WB_BLOCK_DEFAULTS,
  WB_BREADCRUMBS,
  WB_BREADCRUMB_SEPARATORS,
  WB_CATEGORIES,
  WB_CATEGORY_ROOTS,
  WB_CONTENT_SEED,
  WB_DEFAULT_COLUMNS,
  WB_FOOTER_SEED,
  WB_HEADER_SEED,
  WB_HERO_BACKGROUNDS,
  WB_HERO_HEIGHTS,
  WB_MENU_MOBILE,
  WB_MENU_SOURCES,
  WB_NEWSLETTER_LAYOUTS,
  WB_SEARCH_SCOPES,
  WB_SEARCH_TARGETS,
  WB_SECTION_ICONS,
  WB_SOCIAL_NETWORKS,
  WB_SOCIAL_SIZES,
  WB_SOCIAL_STYLES,
  WB_TABS,
  WB_TEXT_ALIGNMENTS,
  WB_WIDTH_MODES,
  wbArticleLabel,
  wbBlockLabel,
} from './website-builder.data';
import {
  WB_BREAKPOINTS,
  WB_BREAKPOINT_LABELS,
  WB_BREAKPOINT_RANGES,
  WB_MAX_COLUMNS,
  WB_MIN_COLUMNS,
  WB_ZERO_COUNTS,
  wbAccepts,
  wbAddCounts,
  wbChildren,
  wbClampSpan,
  wbCount,
  wbFindPath,
  wbGridSummary,
  wbParentColumns,
  wbRowsOverflowing,
} from './website-builder.types';
import type {
  WbArticlesSettings,
  WbArticleBodySettings,
  WbBannerSettings,
  WbBlockProps,
  WbBlockSettings,
  WbBreadcrumbsSettings,
  WbBreakpoint,
  WbCategoryTreeSettings,
  WbContainerNode,
  WbContainerProps,
  WbHeroSettings,
  WbNewsletterSettings,
  WbNode,
  WbPageType,
  WbProps,
  WbResponsive,
  WbRichTextSettings,
  WbRowProps,
  WbSearchSettings,
  WbSectionKind,
  WbSocialLinksSettings,
  WbTabValue,
  WbTopMenuSettings,
} from './website-builder.types';
import {
  WebsiteBuilderNodeComponent,
  wbAddButtonId,
  wbFocusById,
  wbSettingsButtonId,
} from './website-builder-node';
import type {
  WbAddRequest,
  WbNodeRef,
  WbToggleRequest,
} from './website-builder-node';

/* -------------------------------------------------------------------------- */
/* Local constants                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Single kill switch for the real N-track spanning grid preview (UX §4.2b).
 *
 * SortableJS reasons about item rectangles, so a two-dimensional grid whose
 * items span several tracks can mis-compute the drop index. If manual QA finds
 * wrong indices, set this to `false`: every row falls back to full width and
 * the always-present span meter (UX §4.2a) keeps reporting the span, with no
 * copy and no accessibility change.
 */
const WB_GRID_PREVIEW_ENABLED = true;

/** Measured canvas width below which the spanning grid preview is withdrawn. */
const WB_GRID_PREVIEW_MIN_WIDTH = 768;

/**
 * DOM id of the page `<h1>`.
 *
 * It is the fallback landing for Escape-to-top: the header's title row is the
 * one part of the sticky chrome the snap timeline never hides, so it is
 * focusable at any scroll position.
 */
const WB_PAGE_TITLE_ID = 'wb-page-title';

/** One editable or locked section rendered on the canvas. */
interface WbSectionView {
  /** Slot the section fills, used for its icon and copy. */
  readonly slot: WbSectionKind;
  /** Which state signal this view reads and writes. */
  readonly key: WbTreeKey;
  /** Section root node. */
  readonly root: WbContainerNode;
  /** Whether this section renders as a read-only preview. */
  readonly locked: boolean;
  /** Heading shown in the section chrome. */
  readonly title: string;
  /** Landmark name for the surrounding `<section>`. */
  readonly regionLabel: string;
}

/** Identifies one of the six independent section trees. */
type WbTreeKey = 'header' | 'footer' | WbPageType;

/** Snapshot of every tree, used by Save and Discard. */
type WbDocument = Readonly<Record<WbTreeKey, WbContainerNode>>;

/**
 * Every tree key, in one place.
 *
 * `_updateTree`, the snapshot and the restore all walk this list, so adding a
 * page type cannot leave one of them behind.
 */
const WB_TREE_KEYS: readonly WbTreeKey[] = [
  'header',
  'footer',
  'homepage',
  'article',
  'category',
  'page',
];

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Website Builder showcase — composes CMS page layouts from nested,
 * drag-sortable sections, containers, rows and blocks with per-breakpoint grid
 * settings.
 *
 * Every section is its own `mlv-tiles` root tree. A section is therefore never
 * a tree node: it grows no drag handle, and a drag can never cross from the
 * shared header into a page's content. The section chrome — title, enable
 * switch, Add control and empty state — is showcase-owned markup wrapping the
 * `<mlv-tiles>` rather than a tile.
 */
@Component({
  selector: 'docs-website-builder-showcase',
  templateUrl: './website-builder.html',
  styleUrl: './website-builder.scss',
  imports: [
    LucideContainer,
    LucideCopy,
    LucideDynamicIcon,
    LucideEllipsis,
    LucideEye,
    LucideGalleryHorizontal,
    LucideKeyboard,
    LucideLayoutGrid,
    LucideLayoutTemplate,
    LucideList,
    LucideLock,
    LucideMonitor,
    LucidePencil,
    LucidePlus,
    LucideSmartphone,
    LucideTablet,
    LucideUndo2,
    MlvAlert,
    MlvAlertTitle,
    MlvBadge,
    MlvBreadcrumb,
    MlvButton,
    MlvButtonIcon,
    MlvCheckbox,
    MlvCheckboxGroup,
    MlvColorPicker,
    MlvDescription,
    MlvDialog,
    MlvDialogBody,
    MlvDialogClose,
    MlvDialogFooter,
    MlvDialogHeader,
    MlvDialogTemplate,
    MlvEmptyState,
    MlvFieldset,
    MlvFieldsetSpan,
    MlvFileUpload,
    MlvForm,
    MlvInput,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuSeparator,
    MlvMenuTrigger,
    MlvNumberInput,
    MlvPage,
    MlvPageBreadcrumb,
    MlvPageContent,
    MlvPageDock,
    MlvPageDockEnd,
    MlvPageDockStart,
    MlvPageHeader,
    MlvPageHeaderActions,
    MlvPageHeaderDescription,
    MlvPageHeaderStatus,
    MlvPageHeaderTabs,
    MlvPageHeaderTabsActions,
    MlvPageShell,
    MlvPageSummary,
    MlvPageSummaryItem,
    MlvPageTitle,
    MlvSegmented,
    MlvSegmentedItem,
    MlvSelect,
    MlvSpacer,
    MlvSwitch,
    MlvTab,
    MlvTabContentDef,
    MlvTabDef,
    MlvTabGroup,
    MlvTextarea,
    MlvTiles,
    MlvTilesEmpty,
    MlvTokenizer,
    MlvTooltip,
    WebsiteBuilderNodeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebsiteBuilderShowcaseComponent {
  /* ---- Services --------------------------------------------------------- */

  /** @private Confirmation dialogs for destructive removals. */
  private readonly _dialogs = inject(MlvDialogService);

  /** @private Feedback for actions the showcase deliberately does not implement. */
  private readonly _toasts = inject(MlvToastService);

  /** @private Container-width measurement behind the grid preview gate. */
  private readonly _resize = inject(MlvResizeObserverService);

  /** @private Injector for the deferred focus moves after add and remove. */
  private readonly _injector = inject(Injector);

  /** @private Teardown for the media-query listeners. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private Snap state of this page's own `main[mlvPage]`, read off that
   * element's injector. Escape-to-top uses it to expand chrome the scroll
   * collapsed before moving focus into it.
   */
  private readonly _pageSnap = viewChild(MlvPage, {
    read: MlvPageSnapController,
  });

  /* ---- Template constants ----------------------------------------------- */

  /** Level-1 tabs. */
  protected readonly tabs = WB_TABS;

  /** Breakpoints in authoring order. */
  protected readonly breakpoints = WB_BREAKPOINTS;

  /** Human labels for the three breakpoints. */
  protected readonly breakpointLabels = WB_BREAKPOINT_LABELS;

  /** Sentences explaining when each breakpoint applies. */
  protected readonly breakpointRanges = WB_BREAKPOINT_RANGES;

  /** Section icons keyed by slot. */
  protected readonly sectionIcons = WB_SECTION_ICONS;

  /** Breadcrumb trail for the page header. */
  protected readonly breadcrumbs: MlvBreadcrumbEntry[] = [...WB_BREADCRUMBS];

  /** Option sets consumed by the dialogs. */
  protected readonly widthModes = WB_WIDTH_MODES;
  /** Option sets consumed by the dialogs. */
  protected readonly menuSources = WB_MENU_SOURCES;
  /** Option sets consumed by the dialogs. */
  protected readonly menuMobile = WB_MENU_MOBILE;
  /** Option sets consumed by the dialogs. */
  protected readonly textAlignments = WB_TEXT_ALIGNMENTS;
  /** Option sets consumed by the dialogs. */
  protected readonly articleMedia = WB_ARTICLE_MEDIA;
  /** Option sets consumed by the dialogs. */
  protected readonly articleFills = WB_ARTICLE_FILLS;
  /** Option sets consumed by the dialogs. */
  protected readonly heroBackgrounds = WB_HERO_BACKGROUNDS;
  /** Option sets consumed by the dialogs. */
  protected readonly heroHeights = WB_HERO_HEIGHTS;
  /** Option sets consumed by the dialogs. */
  protected readonly bannerTones = WB_BANNER_TONES;
  /** Option sets consumed by the dialogs. */
  protected readonly newsletterLayouts = WB_NEWSLETTER_LAYOUTS;
  /** Option sets consumed by the dialogs. */
  protected readonly searchScopes = WB_SEARCH_SCOPES;
  /** Option sets consumed by the dialogs. */
  protected readonly searchTargets = WB_SEARCH_TARGETS;
  /** Option sets consumed by the dialogs. */
  protected readonly breadcrumbSeparators = WB_BREADCRUMB_SEPARATORS;
  /** Option sets consumed by the dialogs. */
  protected readonly socialStyles = WB_SOCIAL_STYLES;
  /** Option sets consumed by the dialogs. */
  protected readonly socialSizes = WB_SOCIAL_SIZES;
  /** Option sets consumed by the dialogs. */
  protected readonly categories = WB_CATEGORIES;
  /** Option sets consumed by the dialogs. */
  protected readonly categoryRoots = WB_CATEGORY_ROOTS;
  /** Networks the social block can link to. */
  protected readonly socialNetworks = WB_SOCIAL_NETWORKS;

  /** Shared structural drop policy for every depth of every tree. */
  protected readonly accepts = wbAccepts;

  /**
   * Column ceiling handed to a container sitting directly in a section.
   *
   * A section owns no grid of its own — a container placed in one is always
   * full width — and only rows read this value, so a single shared constant is
   * correct rather than a per-section computation.
   */
  protected readonly sectionColumns: WbResponsive<number> = {
    desktop: 1,
    tablet: 1,
    mobile: 1,
  };

  /* ---- Trees ------------------------------------------------------------ */

  /** @private Shared header section. */
  private readonly _header = signal<WbContainerNode>(WB_HEADER_SEED);
  /** @private Shared footer section. */
  private readonly _footer = signal<WbContainerNode>(WB_FOOTER_SEED);
  /** @private Content section of each page type. */
  private readonly _content: Readonly<
    Record<WbPageType, WritableSignal<WbContainerNode>>
  > = {
    homepage: signal(WB_CONTENT_SEED.homepage),
    article: signal(WB_CONTENT_SEED.article),
    category: signal(WB_CONTENT_SEED.category),
    page: signal(WB_CONTENT_SEED.page),
  };

  /** @private Last saved snapshot, restored by Discard. */
  private readonly _saved = signal<WbDocument>({
    header: WB_HEADER_SEED,
    footer: WB_FOOTER_SEED,
    homepage: WB_CONTENT_SEED.homepage,
    article: WB_CONTENT_SEED.article,
    category: WB_CONTENT_SEED.category,
    page: WB_CONTENT_SEED.page,
  });

  /** @private Monotonic id counter. Never `Math.random()` or `Date.now()`. */
  private _idSeed = 0;

  /** Shared header tree. */
  protected readonly header = this._header.asReadonly();

  /** Shared footer tree. */
  protected readonly footer = this._footer.asReadonly();

  /* ---- Navigation and viewing state ------------------------------------- */

  /** Level-1 tab currently shown. */
  protected readonly activeTab = signal<WbTabValue>('all');

  /** Breakpoint the canvas renders. Read-only: it never writes to the model. */
  protected readonly viewBreakpoint = signal<WbBreakpoint>('desktop');

  /** Whether the viewport is narrow enough to make dialogs fullscreen. */
  protected readonly isNarrow = signal(false);

  /** @private Measured canvas width, in CSS pixels. */
  private readonly _canvasWidth = signal(0);

  /** @protected The canvas region, measured for the grid preview gate. */
  protected readonly canvasRef =
    viewChild<ElementRef<HTMLElement>>('canvasRegion');

  /**
   * Whether the canvas renders real spanning grid tracks.
   *
   * Measured on the canvas rather than the viewport, because the canvas is what
   * actually has to fit the tracks. Forced off below
   * {@link WB_GRID_PREVIEW_MIN_WIDTH}, and switchable off entirely through
   * {@link WB_GRID_PREVIEW_ENABLED}.
   */
  protected readonly gridPreview = computed(
    () =>
      WB_GRID_PREVIEW_ENABLED &&
      this._canvasWidth() >= WB_GRID_PREVIEW_MIN_WIDTH,
  );

  /** Page type the canvas is editing, or `null` on the All tab. */
  protected readonly activePageType = computed<WbPageType | null>(() => {
    const tab = this.activeTab();
    return tab === 'all' ? null : tab;
  });

  /** Sentence under the page title, per tab. */
  protected readonly tabDescription = computed(
    () =>
      WB_TABS.find((tab) => tab.value === this.activeTab())?.description ?? '',
  );

  /** Sections rendered on the canvas, in visual order. */
  protected readonly sections = computed<readonly WbSectionView[]>(() => {
    const pageType = this.activePageType();

    if (pageType === null) {
      return [
        {
          slot: 'header' as const,
          key: 'header' as const,
          root: this._header(),
          locked: false,
          title: 'Header',
          regionLabel: 'Header section',
        },
        {
          slot: 'footer' as const,
          key: 'footer' as const,
          root: this._footer(),
          locked: false,
          title: 'Footer',
          regionLabel: 'Footer section',
        },
      ];
    }

    return [
      {
        slot: 'header' as const,
        key: 'header' as const,
        root: this._header(),
        locked: true,
        title: 'Shared header',
        regionLabel: 'Shared header, read only',
      },
      {
        slot: 'content' as const,
        key: pageType,
        root: this._content[pageType](),
        locked: false,
        title: 'Content',
        regionLabel: 'Content section',
      },
      {
        slot: 'footer' as const,
        key: 'footer' as const,
        root: this._footer(),
        locked: true,
        title: 'Shared footer',
        regionLabel: 'Shared footer, read only',
      },
    ];
  });

  /** Editable section roots on the active tab. */
  protected readonly editableRoots = computed(() =>
    this.sections()
      .filter((section) => !section.locked)
      .map((section) => section.root),
  );

  /* ---- Summary ---------------------------------------------------------- */

  /** Tile counts across every editable section of the active tab. */
  protected readonly counts = computed(() =>
    this.editableRoots().reduce(
      (total, root) => wbAddCounts(total, wbCount(root)),
      WB_ZERO_COUNTS,
    ),
  );

  /** Column count reported by the summary strip, or `Mixed`. */
  protected readonly gridSummary = computed(() => {
    const value = wbGridSummary(this.editableRoots(), this.viewBreakpoint());
    if (value === null) return 'No containers';
    if (value === 'mixed') return 'Mixed';
    return `${value} ${value === 1 ? 'column' : 'columns'}`;
  });

  /** Count badge shown on one level-1 tab. */
  protected tileCount(tab: WbTabValue): number {
    if (tab === 'all') {
      return wbCount(this._header()).total + wbCount(this._footer()).total;
    }
    return wbCount(this._content[tab]()).total;
  }

  /* ---- Draft state ------------------------------------------------------ */

  /** @private Number of edits since the last save or discard. */
  private readonly _changeCount = signal(0);

  /** Whether the draft differs from the last saved snapshot. */
  protected readonly dirty = computed(() => this._changeCount() > 0);

  /** How many edits are waiting to be saved. */
  protected readonly dirtyCount = this._changeCount.asReadonly();

  /** Whether a simulated save is in flight. */
  protected readonly saving = signal(false);

  /** Badge tone in the page header status slot. */
  protected readonly statusTone = computed<MlvBadgeTone>(() =>
    this.dirty() ? 'warning' : 'success',
  );

  /** Badge text in the page header status slot. */
  protected readonly statusLabel = computed(() =>
    this.dirty() ? 'Draft' : 'Published',
  );

  /** Sentence shown in the dock's start slot. */
  protected readonly dockMessage = computed(() => {
    if (this.saving()) return 'Saving…';
    const count = this._changeCount();
    if (count === 0) return 'All changes saved';
    return `${count} unsaved ${count === 1 ? 'change' : 'changes'}`;
  });

  /** Polite announcement owned by this page (UX §8.4). */
  protected readonly announcement = signal('');

  /* ---- Dialog state ----------------------------------------------------- */

  /** @private Node whose settings dialog is open, with its compound ref. */
  private readonly _editing = signal<WbNodeRef | null>(null);

  /** Whether the container dialog is open. */
  protected readonly containerOpen = signal(false);
  /** Whether the row dialog is open. */
  protected readonly rowOpen = signal(false);
  /** Whether the block dialog is open. */
  protected readonly blockOpen = signal(false);

  /** Breakpoint tab selected inside the open dialog. */
  protected readonly dialogBreakpoint = signal<WbBreakpoint>('desktop');

  /** Local, uncommitted container draft. Cancel discards it. */
  protected readonly containerDraft = signal<WbContainerProps>({
    kind: 'container',
    label: '',
    enabled: true,
    width: 'fluid',
    widthPx: 1200,
    columns: WB_DEFAULT_COLUMNS,
  });

  /** Local, uncommitted row draft. */
  protected readonly rowDraft = signal<WbRowProps>({
    kind: 'row',
    label: '',
    enabled: true,
    span: WB_DEFAULT_COLUMNS,
  });

  /** Local, uncommitted block draft. */
  protected readonly blockDraft = signal<WbBlockProps>({
    kind: 'block',
    label: '',
    enabled: true,
    blockType: 'rich-text',
    settings: WB_BLOCK_DEFAULTS['rich-text'],
  });

  /** Uploaded hero image, held locally so Cancel discards it. */
  protected readonly heroFiles = signal<MlvUploadedFile[]>([]);

  /** Columns the row being edited may span, per breakpoint. */
  protected readonly rowParentColumns =
    signal<WbResponsive<number>>(WB_DEFAULT_COLUMNS);

  /** Name of the parent the row being edited belongs to. */
  protected readonly rowParentLabel = signal('');

  /* ---- Constructor ------------------------------------------------------ */

  constructor() {
    this._watchMedia('(max-width: 639px)', this.isNarrow);

    afterNextRender(
      () => {
        const host = this.canvasRef()?.nativeElement;
        if (!host) return;
        this._canvasWidth.set(host.getBoundingClientRect().width);
        this._resize
          .observe(host)
          .pipe(takeUntilDestroyed(this._destroyRef))
          .subscribe(([entry]) => {
            this._canvasWidth.set(entry.contentRect.width);
          });
      },
      { injector: this._injector },
    );
  }

  /* ---- Navigation ------------------------------------------------------- */

  /** Switches the level-1 tab and announces the layout that just appeared. */
  protected setActiveTab(tab: string): void {
    const next = WB_TABS.find((entry) => entry.value === tab)?.value;
    if (!next || next === this.activeTab()) return;
    this.activeTab.set(next);

    const counts = this.editableRoots().reduce(
      (total, root) => wbAddCounts(total, wbCount(root)),
      WB_ZERO_COUNTS,
    );
    const label = WB_TABS.find((entry) => entry.value === next)?.label ?? '';
    this._announce(
      `${label} layout. ${this._plural(counts.containers, 'container')}, ${this._plural(
        counts.rows,
        'row',
      )}, ${this._plural(counts.blocks, 'block')}.`,
    );
  }

  /** Applies a breakpoint from the read-only viewer. */
  protected setViewBreakpoint(value: unknown): void {
    const next = WB_BREAKPOINTS.find((bp) => bp === value);
    if (next) this.viewBreakpoint.set(next);
  }

  /** Applies a breakpoint from a dialog's nested tab strip. */
  protected setDialogBreakpoint(value: string): void {
    const next = WB_BREAKPOINTS.find((bp) => bp === value);
    if (next) this.dialogBreakpoint.set(next);
  }

  /** Jumps to the All tab and focuses the section chrome the preview mirrors. */
  protected editInAll(slot: WbSectionKind): void {
    this.setActiveTab('all');
    afterNextRender(() => wbFocusById(`wb-section-add-${slot}`), {
      injector: this._injector,
    });
  }

  /** Explains that Preview is out of scope for this showcase. */
  protected openPreview(): void {
    this._toasts.info('Preview is not part of this showcase.');
  }

  /* ---- Tree plumbing ---------------------------------------------------- */

  /** Writable signal backing one section tree. */
  private _treeSignal(key: WbTreeKey): WritableSignal<WbContainerNode> {
    if (key === 'header') return this._header;
    if (key === 'footer') return this._footer;
    return this._content[key];
  }

  /** Applies a `treeChange` emitted by one root `mlv-tiles`. */
  protected onTreeChange(
    key: WbTreeKey,
    next: MlvTileNodeWithChildren<WbProps> | undefined,
  ): void {
    if (!next) return;
    const target = this._treeSignal(key);
    if (target() === next) return;
    target.set(next);
    this._markDirty();
  }

  /** Marks a drag-and-drop reorder as an edit. */
  protected onMoved(): void {
    this._markDirty();
  }

  /**
   * Rewrites the tree that contains `nodeId` through the immutable helpers.
   *
   * Returns `false` when no rendered tree owns the node, which is the same
   * outcome the library's own helpers produce for an unknown target: the root
   * reference is preserved and nothing is written.
   */
  private _updateTree(
    nodeId: string,
    rewrite: (root: WbContainerNode) => WbContainerNode,
  ): boolean {
    for (const key of WB_TREE_KEYS) {
      const target = this._treeSignal(key);
      const root = target();
      if (!wbFindPath(root, nodeId)) continue;
      const next = rewrite(root);
      if (next === root) return false;
      target.set(next);
      this._markDirty();
      return true;
    }
    return false;
  }

  /** Ancestry of one node inside whichever rendered tree owns it. */
  private _pathOf(nodeId: string): readonly WbNode[] | null {
    for (const section of this.sections()) {
      const path = wbFindPath(section.root, nodeId);
      if (path) return path;
    }
    return null;
  }

  /** Parent of one node, or `null` when it is a section root. */
  private _parentOf(nodeId: string): WbNode | null {
    const path = this._pathOf(nodeId);
    if (!path || path.length < 2) return null;
    return path[path.length - 2];
  }

  /** Mints the next globally unique node id. */
  private _nextId(prefix: string): string {
    this._idSeed += 1;
    return `${prefix}-n${this._idSeed}`;
  }

  /** Bumps the unsaved-change counter. */
  private _markDirty(): void {
    this._changeCount.update((count) => count + 1);
  }

  /** Writes one polite announcement to the page-owned live region. */
  private _announce(message: string): void {
    this.announcement.set(message);
  }

  /** `3 rows` / `1 row`. */
  private _plural(count: number, noun: string): string {
    return `${count} ${count === 1 ? noun : `${noun}s`}`;
  }

  /* ---- Section chrome --------------------------------------------------- */

  /** Toggles a whole section on or off. */
  protected toggleSection(key: WbTreeKey, enabled: boolean): void {
    const target = this._treeSignal(key);
    const root = target();
    target.set({ ...root, props: { ...root.props, enabled } });
    this._markDirty();
  }

  /** Appends a container to one section and focuses its Settings button. */
  protected addContainerToSection(section: WbSectionView): void {
    const root = this._treeSignal(section.key)();
    const position = wbChildren(root).filter(
      (child) => child.props.kind === 'container',
    ).length;
    const id = this._nextId('container');

    const next = insertMlvTileNode(root, {
      targetContainerId: root.id,
      tile: {
        id,
        acceptsChildren: true,
        props: {
          kind: 'container',
          label: `Container ${position + 1}`,
          enabled: true,
          width: 'fluid',
          widthPx: null,
          columns: WB_DEFAULT_COLUMNS,
        },
        children: [],
      },
    });

    if (next === root) return;
    this._treeSignal(section.key).set(next);
    this._markDirty();
    this._announce(
      `Container added to ${section.title}. ${this._plural(position + 1, 'container')}.`,
    );
    this._focusAfterRender(wbSettingsButtonId(id));
  }

  /* ---- Node actions ----------------------------------------------------- */

  /** Appends a row or a block to one node and focuses the new tile. */
  protected onAddChild(request: WbAddRequest): void {
    const parent = request.node;
    const siblings = wbChildren(parent);

    if (request.blockType === null) {
      const position =
        siblings.filter((child) => child.props.kind === 'row').length + 1;
      const id = this._nextId('row');
      const span = wbParentColumns(parent);
      const added = request.tile.insertChild({
        id,
        acceptsChildren: true,
        props: {
          kind: 'row',
          label: `Row ${position}`,
          enabled: true,
          span,
        },
        children: [],
      });
      // `insertChild` writes the root-owned model, so `treeChange` has already
      // fired and `onTreeChange` has counted the edit. Counting again here
      // would report two unsaved changes for one add.
      if (!added) return;
      this._announce(
        `Row added to ${parent.props.label}. ${this._plural(position, 'row')}.`,
      );
      this._focusAfterRender(wbSettingsButtonId(id));
      return;
    }

    const blockType = request.blockType;
    const position =
      siblings.filter((child) => child.props.kind === 'block').length + 1;
    const id = this._nextId('block');
    const added = request.tile.insertChild({
      id,
      acceptsChildren: false,
      props: {
        kind: 'block',
        label: wbBlockLabel(blockType),
        enabled: true,
        blockType,
        settings: WB_BLOCK_DEFAULTS[blockType],
      },
    });
    if (!added) return;
    this._announce(
      `${wbBlockLabel(blockType)} added to ${parent.props.label}. ${this._plural(
        position,
        'block',
      )}.`,
    );
    this._focusAfterRender(wbSettingsButtonId(id));
  }

  /** Flips one node's own enable switch. */
  protected onToggleEnabled(request: WbToggleRequest): void {
    this._updateTree(request.node.id, (root) =>
      updateMlvTileNodeProps(root, request.node.id, (props) => ({
        ...props,
        enabled: request.enabled,
      })),
    );
  }

  /**
   * Removes one node, confirming first when it would take a subtree with it.
   *
   * A single leaf removes immediately — an undo-able block does not deserve a
   * modal. Focus lands on the next sibling's Settings button, the previous
   * sibling's when it was last, or the parent's Add button when it was the last
   * child.
   */
  protected onRemoveNode(request: WbNodeRef): void {
    const counts = wbCount(request.node);
    const label = request.node.props.label;

    if (counts.total === 0) {
      this._performRemove(request, 0);
      return;
    }

    this._dialogs
      .confirm({
        title: `Remove ${label}?`,
        message: `This also removes ${this._plural(counts.total, 'nested tile')}. You can undo it from the dock until you save.`,
        confirmLabel: 'Remove',
        cancelLabel: 'Keep',
        tone: 'danger',
      })
      .subscribe((confirmed) => {
        if (confirmed) this._performRemove(request, counts.total);
      });
  }

  /** @private Executes a removal and re-homes focus. */
  private _performRemove(request: WbNodeRef, nested: number): void {
    const label = request.node.props.label;
    const parent = this._parentOf(request.node.id);
    const siblings = parent ? wbChildren(parent) : [];
    const index = siblings.findIndex((child) => child.id === request.node.id);
    const neighbour =
      index >= 0 ? (siblings[index + 1] ?? siblings[index - 1] ?? null) : null;

    // `MlvTile.remove()` returns `void`; it is a no-op only on a locked tile,
    // and a locked subtree renders no Remove control at all. The write lands on
    // the root-owned model, so `onTreeChange` counts the edit.
    request.tile.remove();

    this._announce(
      nested === 0
        ? `Removed ${label}.`
        : `Removed ${label} and ${this._plural(nested, 'nested tile')}.`,
    );

    if (neighbour) {
      this._focusAfterRender(wbSettingsButtonId(neighbour.id));
    } else if (parent && parent.props.kind !== 'section') {
      this._focusAfterRender(wbAddButtonId(parent.id));
    } else if (parent) {
      const slot =
        parent.props.kind === 'section' ? parent.props.section : 'content';
      this._focusAfterRender(`wb-section-add-${slot}`);
    }
  }

  /** Focuses one element id once the next render has settled. */
  private _focusAfterRender(id: string): void {
    afterNextRender(() => wbFocusById(id), { injector: this._injector });
  }

  /**
   * Moves focus to the level-1 tab strip when Escape reaches the top level.
   *
   * The strip is projected into `mlv-page-header`'s tabs row, which the page's
   * snap timeline scrubs to `visibility: hidden` once the header has collapsed
   * — and `focus()` on a hidden element is silently refused, so this used to
   * be a no-op for anyone more than ~100px down the canvas. Expanding the
   * chrome first reveals every snap region synchronously, so the tab is
   * focusable in this same task.
   *
   * If there is no page chrome to expand, or the strip is not rendered at all,
   * focus falls back to the page title: it lives in the header's title row,
   * which never snaps away, and it is this route's own focus target. Both
   * landings are visible — focus is never parked somewhere the user cannot
   * see, and never left on `<body>`.
   */
  protected onEscapeToTop(): void {
    if (typeof document === 'undefined') return;

    this._pageSnap()?.expand();

    const tab = document.querySelector<HTMLElement>(
      '.website-builder__tabs .mlv-tab-item[aria-selected="true"]',
    );
    tab?.focus();
    if (tab && document.activeElement === tab) return;

    wbFocusById(WB_PAGE_TITLE_ID);
  }

  /* ---- Dialog opening --------------------------------------------------- */

  /** Seeds the right dialog's local draft and opens it. */
  protected onConfigure(request: WbNodeRef): void {
    this._editing.set(request);
    this.dialogBreakpoint.set(this.viewBreakpoint());
    const props = request.node.props;

    switch (props.kind) {
      case 'container':
        this.containerDraft.set({
          ...props,
          widthPx: props.widthPx ?? 1200,
        });
        this.containerOpen.set(true);
        return;
      case 'row': {
        const parent = this._parentOf(request.node.id);
        this.rowParentColumns.set(
          parent ? wbParentColumns(parent) : WB_DEFAULT_COLUMNS,
        );
        this.rowParentLabel.set(parent?.props.label ?? 'the section');
        this.rowDraft.set({ ...props });
        this.rowOpen.set(true);
        return;
      }
      case 'block':
        this.blockDraft.set({ ...props });
        this.heroFiles.set([]);
        this.blockOpen.set(true);
        return;
      default:
        return;
    }
  }

  /** Clears the shared editing handle once a dialog has finished closing. */
  protected clearEditing(): void {
    this._editing.set(null);
  }

  /* ---- Container dialog ------------------------------------------------- */

  /** Title of the container dialog. */
  protected readonly containerTitle = computed(
    () => `Container settings — ${this.containerDraft().label}`,
  );

  /** Whether the width field is meaningful for the current width mode. */
  protected readonly containerNeedsWidth = computed(
    () => this.containerDraft().width !== 'fluid',
  );

  /** Label of the width field, which changes with the width mode. */
  protected readonly containerWidthLabel = computed(() =>
    this.containerDraft().width === 'fixed' ? 'Width (px)' : 'Max width (px)',
  );

  /** Validation message for the container name. */
  protected readonly containerNameMessage = computed(() => {
    const label = this.containerDraft().label.trim();
    if (label.length === 0) return 'Enter a name.';
    if (label.length > 60) return 'Keep the name under 60 characters.';
    return '';
  });

  /** Validation message for the container width. */
  protected readonly containerWidthMessage = computed(() => {
    if (!this.containerNeedsWidth()) return '';
    const value = this.containerDraft().widthPx;
    if (value === null || value < 320 || value > 2560) {
      return 'Enter a width between 320 and 2560 px.';
    }
    return '';
  });

  /**
   * Validation message for one breakpoint's column count.
   *
   * Keyed by breakpoint rather than by the active dialog tab: the tab group
   * decides which panel is in the DOM, and a field must never validate a value
   * other than the one it is bound to.
   */
  protected containerColumnsMessage(breakpoint: WbBreakpoint): string {
    const value = this.containerDraft().columns[breakpoint];
    if (value < WB_MIN_COLUMNS || value > WB_MAX_COLUMNS) {
      return `Enter between ${WB_MIN_COLUMNS} and ${WB_MAX_COLUMNS} columns.`;
    }
    return '';
  }

  /** Whether the container draft may be saved. */
  protected readonly containerValid = computed(() => {
    if (this.containerNameMessage()) return false;
    if (this.containerWidthMessage()) return false;
    return WB_BREAKPOINTS.every((bp) => {
      const value = this.containerDraft().columns[bp];
      return value >= WB_MIN_COLUMNS && value <= WB_MAX_COLUMNS;
    });
  });

  /** Rows that would overflow if the drafted column counts were applied. */
  protected readonly containerClampWarning = computed(() => {
    const node = this._editing()?.node;
    if (!node) return null;
    const columns = this.containerDraft().columns;
    const overflowing = wbRowsOverflowing(node, columns);
    const affected = new Set<string>();
    const breakpoints: WbBreakpoint[] = [];

    for (const bp of WB_BREAKPOINTS) {
      const atBp = overflowing.filter(
        (row) => row.props.span[bp] > columns[bp],
      );
      if (atBp.length === 0) continue;
      breakpoints.push(bp);
      for (const row of atBp) affected.add(row.id);
    }

    if (affected.size === 0) return null;
    return {
      count: affected.size,
      breakpoints: breakpoints
        .map((bp) => WB_BREAKPOINT_LABELS[bp].toLowerCase())
        .join(', '),
    };
  });

  /** Updates the container draft's name. */
  protected setContainerLabel(label: string): void {
    this.containerDraft.update((draft) => ({ ...draft, label }));
  }

  /** Updates the container draft's width mode. */
  protected setContainerWidthMode(value: unknown): void {
    const width = this.widthModes.values.find((mode) => mode === value);
    if (!width) return;
    this.containerDraft.update((draft) => ({ ...draft, width }));
  }

  /** Updates the container draft's pixel width. */
  protected setContainerWidthPx(value: number | null): void {
    this.containerDraft.update((draft) => ({ ...draft, widthPx: value }));
  }

  /** Updates the container draft's column count at one breakpoint. */
  protected setContainerColumns(
    breakpoint: WbBreakpoint,
    value: number | null,
  ): void {
    this.containerDraft.update((draft) => ({
      ...draft,
      columns: { ...draft.columns, [breakpoint]: value ?? 0 },
    }));
  }

  /**
   * Commits the container draft, clamping any child row that the new column
   * counts would leave overflowing. Clamping never blocks the save.
   */
  protected saveContainer(): void {
    const editing = this._editing();
    if (!editing || !this.containerValid()) return;

    const draft = this.containerDraft();
    const next: WbContainerProps = {
      ...draft,
      label: draft.label.trim(),
      widthPx: draft.width === 'fluid' ? null : draft.widthPx,
    };
    const nodeId = editing.node.id;
    const children = wbChildren(editing.node);

    this._updateTree(nodeId, (root) => {
      let updated = updateMlvTileNodeProps(root, nodeId, () => next);
      for (const child of children) {
        if (child.props.kind !== 'row') continue;
        const clamped = wbClampSpan(child.props.span, next.columns);
        if (clamped === child.props.span) continue;
        updated = updateMlvTileNodeProps(updated, child.id, (props) => ({
          ...(props as WbRowProps),
          span: clamped,
        }));
      }
      return updated;
    });

    this.containerOpen.set(false);
  }

  /* ---- Row dialog ------------------------------------------------------- */

  /** Title of the row dialog. */
  protected readonly rowTitle = computed(
    () => `Row settings — ${this.rowDraft().label}`,
  );

  /** Columns the parent offers at one breakpoint. */
  protected rowParentMax(breakpoint: WbBreakpoint): number {
    return this.rowParentColumns()[breakpoint];
  }

  /** Span drafted for one breakpoint. */
  protected rowSpan(breakpoint: WbBreakpoint): number {
    return this.rowDraft().span[breakpoint];
  }

  /** Ticks the dialog's live span meter iterates over, at one breakpoint. */
  protected rowSpanTicks(breakpoint: WbBreakpoint): readonly number[] {
    return Array.from(
      { length: Math.max(1, this.rowParentMax(breakpoint)) },
      (_, index) => index + 1,
    );
  }

  /** Validation message for the row name. */
  protected readonly rowNameMessage = computed(() => {
    const label = this.rowDraft().label.trim();
    if (label.length === 0) return 'Enter a name.';
    if (label.length > 60) return 'Keep the name under 60 characters.';
    return '';
  });

  /** Validation message for the span at one breakpoint. */
  protected rowSpanMessage(breakpoint: WbBreakpoint): string {
    const span = this.rowSpan(breakpoint);
    const max = this.rowParentMax(breakpoint);
    if (span < 1 || span > max) {
      return `This row can span at most ${max} columns at ${this.breakpointLabels[
        breakpoint
      ].toLowerCase()}.`;
    }
    return '';
  }

  /** Proportion sentence under the span field, at one breakpoint. */
  protected rowSpanDescription(breakpoint: WbBreakpoint): string {
    const span = this.rowSpan(breakpoint);
    const max = this.rowParentMax(breakpoint);
    if (span >= max) return 'Full width';
    return `About ${Math.round((span / max) * 100)}% of the parent width.`;
  }

  /** Read-only context line above the span field, at one breakpoint. */
  protected rowParentSentence(breakpoint: WbBreakpoint): string {
    return `Parent: ${this.rowParentLabel()} — ${this._plural(
      this.rowParentMax(breakpoint),
      'column',
    )} on ${this.breakpointLabels[breakpoint].toLowerCase()}.`;
  }

  /** Whether the row draft may be saved. */
  protected readonly rowValid = computed(() => {
    if (this.rowNameMessage()) return false;
    const max = this.rowParentColumns();
    return WB_BREAKPOINTS.every((bp) => {
      const span = this.rowDraft().span[bp];
      return span >= 1 && span <= max[bp];
    });
  });

  /** Updates the row draft's name. */
  protected setRowLabel(label: string): void {
    this.rowDraft.update((draft) => ({ ...draft, label }));
  }

  /** Updates the row draft's span at one breakpoint. */
  protected setRowSpan(breakpoint: WbBreakpoint, value: number | null): void {
    this.rowDraft.update((draft) => ({
      ...draft,
      span: { ...draft.span, [breakpoint]: value ?? 0 },
    }));
  }

  /** Commits the row draft. */
  protected saveRow(): void {
    const editing = this._editing();
    if (!editing || !this.rowValid()) return;

    const draft = this.rowDraft();
    const next: WbRowProps = { ...draft, label: draft.label.trim() };

    this._updateTree(editing.node.id, (root) =>
      updateMlvTileNodeProps(root, editing.node.id, () => next),
    );
    this.rowOpen.set(false);
  }

  /* ---- Block dialog ----------------------------------------------------- */

  /** Title of the block dialog. */
  protected readonly blockTitle = computed(
    () =>
      `${wbBlockLabel(this.blockDraft().blockType)} settings — ${this.blockDraft().label}`,
  );

  /** Dialog size: the two richest block forms get the wide preset. */
  protected readonly blockSize = computed<'m' | 'l' | 'fullscreen'>(() => {
    if (this.isNarrow()) return 'fullscreen';
    const type = this.blockDraft().blockType;
    return type === 'articles' || type === 'hero' ? 'l' : 'm';
  });

  /** Validation message for the block name. */
  protected readonly blockNameMessage = computed(() => {
    const label = this.blockDraft().label.trim();
    if (label.length === 0) return 'Enter a name.';
    if (label.length > 60) return 'Keep the name under 60 characters.';
    return '';
  });

  /** Narrowed settings accessors, one per block type the template switches on. */
  protected readonly topMenuSettings = computed(
    () => this.blockDraft().settings as WbTopMenuSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly richTextSettings = computed(
    () => this.blockDraft().settings as WbRichTextSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly articleBodySettings = computed(
    () => this.blockDraft().settings as WbArticleBodySettings,
  );
  /** Narrowed settings accessor. */
  protected readonly articlesSettings = computed(
    () => this.blockDraft().settings as WbArticlesSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly heroSettings = computed(
    () => this.blockDraft().settings as WbHeroSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly bannerSettings = computed(
    () => this.blockDraft().settings as WbBannerSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly newsletterSettings = computed(
    () => this.blockDraft().settings as WbNewsletterSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly searchSettings = computed(
    () => this.blockDraft().settings as WbSearchSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly breadcrumbsSettings = computed(
    () => this.blockDraft().settings as WbBreadcrumbsSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly categoryTreeSettings = computed(
    () => this.blockDraft().settings as WbCategoryTreeSettings,
  );
  /** Narrowed settings accessor. */
  protected readonly socialLinksSettings = computed(
    () => this.blockDraft().settings as WbSocialLinksSettings,
  );

  /** Tokens shown by the manual-article tokenizer. */
  protected readonly articleTokens = computed<MlvSelectOption<string>[]>(() =>
    this.articlesSettings().articleIds.map((id) => ({
      value: id,
      label: wbArticleLabel(id),
    })),
  );

  /** Resolves a typed article title back to its catalog id where one matches. */
  protected readonly createArticleToken = (
    value: string,
  ): MlvSelectOption<string> => {
    const trimmed = value.trim();
    const match = WB_ARTICLES.find(
      (article) => article.label.toLowerCase() === trimmed.toLowerCase(),
    );
    return match
      ? { value: match.id, label: match.label }
      : { value: trimmed, label: trimmed };
  };

  /** Whether the block draft may be saved. */
  protected readonly blockValid = computed(() => {
    if (this.blockNameMessage()) return false;
    const settings = this.blockDraft().settings;

    switch (settings.blockType) {
      case 'rich-text':
        return settings.text.trim().length > 0;
      case 'articles':
        if (settings.fill === 'category' && !settings.categoryId) return false;
        if (settings.fill === 'manual') return settings.articleIds.length > 0;
        return settings.count >= 1 && settings.count <= 24;
      case 'hero':
        if (settings.headline.trim().length === 0) return false;
        if (settings.background === 'image' && !settings.imageName)
          return false;
        if (
          settings.background === 'video' &&
          !this._isUrl(settings.videoUrl)
        ) {
          return false;
        }
        return (
          settings.buttonLabel.trim().length === 0 ||
          this._isUrl(settings.buttonUrl)
        );
      case 'banner':
        if (settings.message.trim().length === 0) return false;
        return (
          settings.linkLabel.trim().length === 0 ||
          this._isUrl(settings.linkUrl)
        );
      case 'newsletter':
        return (
          settings.listId.trim().length > 0 &&
          settings.consentText.trim().length > 0
        );
      case 'search':
        return (
          settings.openResults !== 'page' || this._isUrl(settings.resultsUrl)
        );
      case 'breadcrumbs':
        return (
          settings.rootLabel.trim().length > 0 &&
          settings.collapseAfter >= 2 &&
          settings.collapseAfter <= 10
        );
      case 'category-tree':
        return settings.levels >= 1 && settings.levels <= 5;
      case 'social-links':
        return settings.networks.length > 0;
      case 'top-menu':
        return settings.levels >= 1 && settings.levels <= 3;
      default:
        return true;
    }
  });

  /** Updates the block draft's name. */
  protected setBlockLabel(label: string): void {
    this.blockDraft.update((draft) => ({ ...draft, label }));
  }

  /**
   * Applies a partial patch to the block draft's settings.
   *
   * The settings union is discriminated on `blockType`, which the patch never
   * touches, so widening the merge result back to `WbBlockSettings` is sound:
   * every caller is inside a `@switch` arm that already fixed the variant.
   */
  protected patchSettings(patch: Record<string, unknown>): void {
    this.blockDraft.update((draft) => ({
      ...draft,
      settings: { ...draft.settings, ...patch } as WbBlockSettings,
    }));
  }

  /** Narrows a select's emitted value to a plain string. */
  protected str(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  /** Narrows a number input's emitted value, treating `null` as `0`. */
  protected num(value: number | null): number {
    return value ?? 0;
  }

  /** Whether one social network is currently selected. */
  protected hasNetwork(id: string): boolean {
    return this.socialLinksSettings().networks.includes(id);
  }

  /** Adds or removes one social network from the draft. */
  protected toggleNetwork(id: string, checked: boolean): void {
    const current = this.socialLinksSettings().networks;
    const next = checked
      ? [...current, id]
      : current.filter((network) => network !== id);
    this.patchSettings({ networks: next });
  }

  /** Stores the uploaded hero image by name; the file itself stays local. */
  protected setHeroImage(files: MlvUploadedFile[]): void {
    this.heroFiles.set(files);
    this.patchSettings({ imageName: files[0]?.name ?? '' });
  }

  /** Replaces the manual article list from the tokenizer. */
  protected setArticleTokens(tokens: MlvSelectOption<string>[]): void {
    this.patchSettings({ articleIds: tokens.map((token) => token.value) });
  }

  /** Commits the block draft. */
  protected saveBlock(): void {
    const editing = this._editing();
    if (!editing || !this.blockValid()) return;

    const draft = this.blockDraft();
    const next: WbBlockProps = { ...draft, label: draft.label.trim() };

    this._updateTree(editing.node.id, (root) =>
      updateMlvTileNodeProps(root, editing.node.id, () => next),
    );
    this.blockOpen.set(false);
  }

  /** @private Loose URL check good enough for a showcase form. */
  private _isUrl(value: string): boolean {
    return /^https?:\/\/\S+$/.test(value.trim());
  }

  /* ---- Dock ------------------------------------------------------------- */

  /** Persists the draft into the saved snapshot. */
  protected async saveLayout(): Promise<void> {
    if (!this.dirty() || this.saving()) return;
    this.saving.set(true);

    const result = await runShowcaseOperation(() => this._snapshot(), {
      delay: 320,
    });

    this.saving.set(false);
    if (!result.ok) return;
    this._saved.set(result.value);
    this._changeCount.set(0);
    this._announce('Layout saved.');
  }

  /**
   * Confirms, then restores every tree from the last saved snapshot.
   *
   * Discard is the most destructive control on the page — one click drops
   * every unsaved edit across all six trees, with no undo — so it asks the
   * same way removing a subtree does: the shared `MlvDialogService.confirm()`
   * with `tone: 'danger'`, which opens an `alertdialog`, colours the
   * confirming action, and puts initial focus on the safe choice. The title
   * carries the count so the user sees what is at stake.
   */
  protected discardChanges(): void {
    if (!this.dirty() || this.saving()) return;
    const count = this._changeCount();

    this._dialogs
      .confirm({
        title: `Discard ${this._plural(count, 'unsaved change')}?`,
        message:
          'This restores the last layout you saved, across every page type. It cannot be undone.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      })
      .subscribe((confirmed) => {
        if (confirmed) this._performDiscard();
      });
  }

  /** @private Restores every tree from the last saved snapshot. */
  private _performDiscard(): void {
    if (!this.dirty() || this.saving()) return;
    const saved = this._saved();
    for (const key of WB_TREE_KEYS) this._treeSignal(key).set(saved[key]);
    this._changeCount.set(0);
    this._announce('Changes discarded.');
  }

  /**
   * Restores the seeded layout, as the header overflow menu offers.
   *
   * Counts an edit only when a tree reference actually moved, so resetting an
   * already-pristine layout does not invent an unsaved change.
   */
  protected resetLayout(): void {
    const seeds: WbDocument = {
      header: WB_HEADER_SEED,
      footer: WB_FOOTER_SEED,
      homepage: WB_CONTENT_SEED.homepage,
      article: WB_CONTENT_SEED.article,
      category: WB_CONTENT_SEED.category,
      page: WB_CONTENT_SEED.page,
    };

    let changed = false;
    for (const key of WB_TREE_KEYS) {
      const target = this._treeSignal(key);
      if (target() === seeds[key]) continue;
      target.set(seeds[key]);
      changed = true;
    }

    if (!changed) return;
    this._markDirty();
    this._announce('Layout reset to the shipped starting point.');
  }

  /** @private Current state of every tree. */
  private _snapshot(): WbDocument {
    return {
      header: this._header(),
      footer: this._footer(),
      homepage: this._content.homepage(),
      article: this._content.article(),
      category: this._content.category(),
      page: this._content.page(),
    };
  }

  /* ---- Utilities -------------------------------------------------------- */

  /** Maps a validation message to the control state that renders it. */
  protected stateFor(message: string): MlvFormState {
    return message.length > 0 ? 'error' : 'default';
  }

  /** Structural summary of one locked preview, shown in its chrome. */
  protected sectionSummary(root: WbContainerNode): string {
    const counts = wbCount(root);
    const labels: string[] = [];
    const walk = (node: WbNode): void => {
      for (const child of wbChildren(node)) {
        if (child.props.kind === 'block') labels.push(child.props.label);
        walk(child);
      }
    };
    walk(root);

    const shown = labels.slice(0, 3).join(', ');
    const more = labels.length > 3 ? `, +${labels.length - 3} more` : '';
    return `${this._plural(counts.containers, 'container')} · ${this._plural(
      counts.rows,
      'row',
    )} · ${this._plural(counts.blocks, 'block')}${shown ? ` — ${shown}${more}` : ''}`;
  }

  /** Title of the empty state for one section slot. */
  protected sectionEmptyTitle(slot: WbSectionKind): string {
    return slot === 'content' ? 'This layout is empty' : 'No containers yet';
  }

  /** Description of the empty state for one section slot. */
  protected sectionEmptyDescription(slot: WbSectionKind): string {
    return slot === 'content'
      ? 'Start with a container. The shared header and footer are already in place.'
      : 'A section holds containers. A container sets the page width and how many grid columns its rows can use.';
  }

  /**
   * @private Mirrors one media query into a boolean signal.
   *
   * Guarded for environments without `matchMedia` so the route still renders
   * under a server or a bare test harness.
   */
  private _watchMedia(query: string, target: WritableSignal<boolean>): void {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const list = window.matchMedia(query);
    target.set(list.matches);
    const onChange = (event: MediaQueryListEvent): void =>
      target.set(event.matches);
    list.addEventListener?.('change', onChange);
    this._destroyRef.onDestroy(() =>
      list.removeEventListener?.('change', onChange),
    );
  }
}
