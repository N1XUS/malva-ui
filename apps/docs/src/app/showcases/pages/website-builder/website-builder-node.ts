import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import type { LucideIconInput } from '@lucide/angular';
import {
  LucideDynamicIcon,
  LucideEyeOff,
  LucidePlus,
  LucideRows3,
  LucideSettings2,
  LucideSquareDashed,
  LucideTrash2,
} from '@lucide/angular';
import { MlvBadge } from '@malva-ui/core/badge';
import type { MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';
import {
  MlvMenu,
  MlvMenuGroup,
  MlvMenuGroupLabel,
  MlvMenuItem,
  MlvMenuSeparator,
  MlvMenuTrigger,
} from '@malva-ui/core/menu';
import { MlvSwitch } from '@malva-ui/core/switch';
import {
  MlvTile,
  MlvTileActions,
  MlvTileHeader,
  MlvTileTrailingActions,
  MlvTiles,
  MlvTilesEmpty,
} from '@malva-ui/core/tile';
import { MlvTooltip } from '@malva-ui/core/tooltip';

import {
  WB_BLOCK_GROUPS,
  WB_KIND_ICONS,
  wbBlockIcon,
  wbBlockLabel,
} from './website-builder.data';
import type { WbBlockCatalogEntry } from './website-builder.data';
import {
  WB_BREAKPOINT_LABELS,
  WB_KIND_WORDS,
  WB_MAX_ROW_DEPTH,
  wbChildren,
  wbCount,
  wbOverflowingBreakpoints,
  wbParentColumns,
} from './website-builder.types';
import type {
  WbBlockType,
  WbBreakpoint,
  WbNode,
  WbProps,
  WbResponsive,
} from './website-builder.types';

/* -------------------------------------------------------------------------- */
/* Event payloads                                                              */
/* -------------------------------------------------------------------------- */

/** Identifies one node together with the compound Tile ref that owns it. */
export interface WbNodeRef {
  /** Compound ref used for every structural mutation on this node. */
  readonly tile: MlvTile<WbProps>;
  /** Immutable node the ref is currently bound to. */
  readonly node: WbNode;
}

/** A request to append a child to `parent`. */
export interface WbAddRequest extends WbNodeRef {
  /** `null` adds a row; otherwise the block type chosen from the menu. */
  readonly blockType: WbBlockType | null;
}

/** A request to flip one node's own enable switch. */
export interface WbToggleRequest extends WbNodeRef {
  /** Value the switch just moved to. */
  readonly enabled: boolean;
}

/* -------------------------------------------------------------------------- */
/* Focus addressing                                                            */
/* -------------------------------------------------------------------------- */

/** Deterministic DOM id of one node's Settings button. */
export function wbSettingsButtonId(nodeId: string): string {
  return `wb-settings-${nodeId}`;
}

/** Deterministic DOM id of one node's Add control. */
export function wbAddButtonId(nodeId: string): string {
  return `wb-add-${nodeId}`;
}

/** Focuses one element by id, tolerating a node that is no longer rendered. */
export function wbFocusById(id: string): boolean {
  if (typeof document === 'undefined') return false;
  const element = document.getElementById(id);
  if (!element) return false;
  element.focus();
  return true;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One container, row or block of a Website Builder tree, rendered recursively.
 *
 * Sections are deliberately **not** rendered by this component: each section is
 * its own `mlv-tiles` root and its chrome is owned by the showcase shell, so a
 * section is never a tree node and never grows a drag handle.
 *
 * The component owns no state. Every mutation is either delegated straight to
 * the compound Tile API (`setProps`) or raised to the showcase, which owns id
 * minting, confirmation, announcements and focus.
 */
@Component({
  selector: 'docs-wb-node',
  templateUrl: './website-builder-node.html',
  styleUrl: './website-builder-node.scss',
  imports: [
    LucideDynamicIcon,
    LucideEyeOff,
    LucidePlus,
    LucideRows3,
    LucideSettings2,
    LucideSquareDashed,
    LucideTrash2,
    MlvBadge,
    MlvButton,
    MlvButtonIcon,
    MlvEmptyState,
    MlvListItem,
    MlvListItemPrefix,
    MlvMenu,
    MlvMenuGroup,
    MlvMenuGroupLabel,
    MlvMenuItem,
    MlvMenuSeparator,
    MlvMenuTrigger,
    MlvSwitch,
    MlvTile,
    MlvTileActions,
    MlvTileHeader,
    MlvTileTrailingActions,
    MlvTiles,
    MlvTilesEmpty,
    MlvTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'wb-node',
    role: 'group',
    '[class.wb-node--container]': 'node().props.kind === "container"',
    '[class.wb-node--row]': 'node().props.kind === "row"',
    '[class.wb-node--block]': 'node().props.kind === "block"',
    '[class.wb-node--off]': '!node().props.enabled',
    '[class.wb-node--muted]': 'inheritedOff()',
    '[class.wb-node--invalid]': 'invalid()',
    '[class.wb-node--locked]': 'locked()',
    '[attr.aria-label]': 'groupLabel()',
    '[style.grid-column]': 'gridColumn()',
    '[style.--wb-cols]': 'ownColumns()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class WebsiteBuilderNodeComponent {
  /** Immutable node this component renders. */
  readonly node = input.required<WbNode>();

  /** 1-based nesting level below the section root, used by the group name. */
  readonly level = input.required<number>();

  /** 1-based position among siblings. */
  readonly position = input.required<number>();

  /** Number of siblings, including this node. */
  readonly siblingCount = input.required<number>();

  /** Whether every ancestor — section included — has its own switch on. */
  readonly ancestorEnabled = input(true);

  /** Columns the parent offers at each breakpoint; the ceiling for a row span. */
  readonly parentColumns = input.required<WbResponsive<number>>();

  /** Breakpoint the canvas is currently previewing. Read-only for the model. */
  readonly breakpoint = input.required<WbBreakpoint>();

  /** Whether the canvas is wide enough to render real spanning grid tracks. */
  readonly gridPreview = input(false);

  /** Whether this subtree is a read-only preview. Cascades from `mlv-tiles`. */
  readonly locked = input(false);

  /** Row-in-row nesting depth of this node; `0` for a row inside a container. */
  readonly rowDepth = input(0);

  /** Raised when the user asks for this node's settings dialog. */
  readonly configure = output<WbNodeRef>();

  /** Raised when the user appends a child through the Add control. */
  readonly addChild = output<WbAddRequest>();

  /** Raised when the user asks to remove this node. */
  readonly removeNode = output<WbNodeRef>();

  /** Raised when this node's own enable switch changes. */
  readonly toggleEnabled = output<WbToggleRequest>();

  /** Raised on `Escape` so the ancestor can take focus. */
  readonly escapeToParent = output<void>();

  /** Add-menu groups, exposed for the template. */
  protected readonly blockGroups = WB_BLOCK_GROUPS;

  /**
   * DOM id of this node's Settings button.
   *
   * Focus targets are addressed by id rather than by a view query because every
   * header control lives inside an `ng-template` slot that `mlv-tile` renders
   * through `ngTemplateOutlet` — the element is inserted into the tile's view,
   * not ours, so a `viewChild` is not a dependable handle on it.
   */
  protected readonly settingsId = computed(() =>
    wbSettingsButtonId(this.node().id),
  );

  /** DOM id of this node's Add control, when it renders one. */
  protected readonly addId = computed(() => wbAddButtonId(this.node().id));

  /** Direct children of this node, or an empty list for a block. */
  protected readonly children = computed(() => wbChildren(this.node()));

  /** Structural kind, read straight from our own props discriminant. */
  protected readonly kind = computed(() => this.node().props.kind);

  /** Whether an ancestor is off while this node's own switch is on. */
  protected readonly inheritedOff = computed(
    () => this.ancestorEnabled() === false && this.node().props.enabled,
  );

  /** Whether the projected body should read de-emphasised. */
  protected readonly inactive = computed(
    () => !this.node().props.enabled || !this.ancestorEnabled(),
  );

  /** Enabled state passed down to this node's own children. */
  protected readonly childAncestorEnabled = computed(
    () => this.ancestorEnabled() && this.node().props.enabled,
  );

  /** Icon for this node's kind or block type. */
  protected readonly icon = computed<LucideIconInput>(() => {
    const props = this.node().props;
    if (props.kind === 'block') return wbBlockIcon(props.blockType);
    if (props.kind === 'container') return WB_KIND_ICONS.container;
    return WB_KIND_ICONS.row;
  });

  /**
   * Tone of the kind badge. Structural metadata never takes a tone (AB-R5) —
   * `Container`, `Section` and `Row` are all structure, so every kind resolves
   * `'default'`. A plain constant, not a `computed()` — there is no per-kind
   * branching to read reactively; every `WbNodeKind` maps to the same value.
   */
  protected readonly kindTone: MlvBadgeTone = 'default';

  /** Text of the kind badge — the block label for a leaf. */
  protected readonly kindText = computed(() => {
    const props = this.node().props;
    if (props.kind === 'block') return wbBlockLabel(props.blockType);
    return props.kind === 'container' ? 'Container' : 'Row';
  });

  /** Columns this node itself offers to its children at the viewed breakpoint. */
  protected readonly ownColumns = computed(() => {
    const props = this.node().props;
    if (!this.gridPreview()) return 1;
    if (props.kind === 'container') return props.columns[this.breakpoint()];
    if (props.kind === 'row') return props.span[this.breakpoint()];
    return 1;
  });

  /** Full per-breakpoint column map this node offers to its children. */
  protected readonly childColumns = computed(() =>
    wbParentColumns(this.node()),
  );

  /** Columns this row occupies at the viewed breakpoint. */
  protected readonly span = computed(() => {
    const props = this.node().props;
    return props.kind === 'row' ? props.span[this.breakpoint()] : 1;
  });

  /** Columns the parent offers at the viewed breakpoint. */
  protected readonly parentSpanMax = computed(
    () => this.parentColumns()[this.breakpoint()],
  );

  /** `grid-column` value for the real N-track preview, or `null` when gated off. */
  protected readonly gridColumn = computed(() => {
    if (!this.gridPreview()) return null;
    if (this.kind() !== 'row') return null;
    return `span ${Math.min(this.span(), Math.max(1, this.parentSpanMax()))}`;
  });

  /**
   * Whether this node's nested `mlv-tiles` renders real N-track grid columns.
   *
   * Only rows carry a span, so a row whose children are blocks keeps the
   * library's auto-fit tracks. Gated by `gridPreview()` so the whole spanning
   * layout can be switched off in exactly one place — see UX risk R1.
   */
  protected readonly tracksEnabled = computed(
    () =>
      this.gridPreview() &&
      (this.kind() === 'container' || this.childKind() === 'row'),
  );

  /** Ticks the ruler and the span meter iterate over. */
  protected readonly rulerTicks = computed(() => {
    const props = this.node().props;
    const columns =
      props.kind === 'container' ? props.columns[this.breakpoint()] : 0;
    return Array.from({ length: columns }, (_, index) => index + 1);
  });

  /** Ticks of the span meter, counted in the parent's grid. */
  protected readonly spanTicks = computed(() =>
    Array.from({ length: Math.max(1, this.parentSpanMax()) }, (_, i) => i + 1),
  );

  /** Breakpoints at which this row overflows its parent. */
  protected readonly overflowing = computed(() => {
    const props = this.node().props;
    if (props.kind !== 'row') return [];
    return wbOverflowingBreakpoints(props.span, this.parentColumns());
  });

  /** Whether this node's configuration is invalid at any breakpoint. */
  protected readonly invalid = computed(() => this.overflowing().length > 0);

  /** Sentence explaining the first overflowing breakpoint. */
  protected readonly invalidMessage = computed(() => {
    const props = this.node().props;
    const first = this.overflowing()[0];
    if (props.kind !== 'row' || first === undefined) return '';
    return `${WB_BREAKPOINT_LABELS[first]} span ${props.span[first]} is wider than the parent’s ${this.parentColumns()[first]} columns.`;
  });

  /** Column count chip on a container, at the viewed breakpoint. */
  protected readonly columnBadge = computed(() => {
    const props = this.node().props;
    if (props.kind !== 'container') return '';
    return `${props.columns[this.breakpoint()]} cols`;
  });

  /** Tooltip listing every breakpoint when a container's counts differ. */
  protected readonly columnTooltip = computed(() => {
    const props = this.node().props;
    if (props.kind !== 'container') return '';
    const { desktop, tablet, mobile } = props.columns;
    if (desktop === tablet && tablet === mobile) return '';
    return `Desktop ${desktop} · Tablet ${tablet} · Mobile ${mobile}`;
  });

  /** Width-mode chip on a container. */
  protected readonly widthBadge = computed(() => {
    const props = this.node().props;
    if (props.kind !== 'container') return '';
    switch (props.width) {
      case 'fixed':
        return `Fixed ${props.widthPx ?? 0}px`;
      case 'max-width-fluid':
        return `Max ${props.widthPx ?? 0}px`;
      default:
        return 'Fluid';
    }
  });

  /** One-line settings recap rendered in a block's body (UX §5.5). */
  protected readonly blockSummary = computed(() => {
    const props = this.node().props;
    if (props.kind !== 'block') return '';
    const settings = props.settings;

    switch (settings.blockType) {
      case 'articles': {
        const source =
          settings.fill === 'newest'
            ? 'Newest first'
            : settings.fill === 'popular'
              ? 'Most popular'
              : settings.fill === 'manual'
                ? 'Chosen manually'
                : 'From a category';
        const volume =
          settings.fill === 'manual'
            ? `${settings.articleIds.length} chosen`
            : `${settings.count} articles`;
        const shape =
          settings.display === 'grid'
            ? `Grid, ${settings.columnsPerRow} per row`
            : settings.display === 'list'
              ? 'List'
              : 'Carousel';
        return `${source} · ${volume} · ${shape}`;
      }
      case 'top-menu': {
        const source =
          settings.source === 'main'
            ? 'Main navigation'
            : settings.source === 'utility'
              ? 'Utility navigation'
              : 'Footer navigation';
        const mobile =
          settings.onMobile === 'burger'
            ? 'Burger on mobile'
            : 'Scrolls on mobile';
        return `${source} · ${settings.levels} levels · ${mobile}`;
      }
      case 'hero': {
        const background =
          settings.background === 'image'
            ? 'Image background'
            : settings.background === 'solid'
              ? 'Solid background'
              : settings.background === 'gradient'
                ? 'Gradient background'
                : 'Video background';
        const height =
          settings.height === 'auto'
            ? 'Fits the content'
            : settings.height === 'half'
              ? 'Half viewport'
              : 'Full viewport';
        const label = settings.buttonLabel
          ? ` · “${settings.buttonLabel}”`
          : '';
        return `${background} · ${height}${label}`;
      }
      case 'rich-text': {
        const alignment =
          settings.alignment === 'start'
            ? 'Left aligned'
            : settings.alignment === 'center'
              ? 'Centred'
              : 'Right aligned';
        return `${alignment} · ${settings.text.length} characters`;
      }
      case 'search': {
        const scope =
          settings.scope === 'all'
            ? 'All content'
            : settings.scope === 'articles'
              ? 'Articles only'
              : 'Categories only';
        const target =
          settings.openResults === 'inline'
            ? 'Results in a dropdown'
            : 'Results on a page';
        return `${scope} · ${target}`;
      }
      case 'article-body': {
        const parts = [
          settings.showLead ? 'Lead' : null,
          settings.showByline ? 'Byline' : null,
          settings.showReadingTime ? 'Reading time' : null,
        ].filter((part): part is string => part !== null);
        const media =
          settings.media === 'inline'
            ? 'Inline media'
            : settings.media === 'full-bleed'
              ? 'Full-bleed media'
              : 'Gallery media';
        return `${parts.length > 0 ? parts.join(' · ') : 'Body only'} · ${media}`;
      }
      case 'banner':
        return `${settings.tone[0].toUpperCase()}${settings.tone.slice(1)} · ${
          settings.dismissible ? 'Dismissible' : 'Always shown'
        }${settings.message ? ` · “${settings.message}”` : ''}`;
      case 'newsletter':
        return `${settings.heading || 'No heading'} · ${
          settings.layout === 'inline' ? 'Inline layout' : 'Stacked layout'
        }`;
      case 'breadcrumbs':
        return `Root “${settings.rootLabel}” · ${settings.separator} separator · collapses after ${settings.collapseAfter}`;
      case 'category-tree':
        return `${settings.startFrom ? 'Sub-tree' : 'All categories'} · ${settings.levels} levels${
          settings.showCounts ? ' · counts shown' : ''
        }`;
      case 'social-links':
        return `${settings.networks.length} networks · ${settings.iconStyle} icons · size ${settings.iconSize}`;
      default:
        return '';
    }
  });

  /** Named `role="group"` label for this node's host. */
  protected readonly groupLabel = computed(() => {
    const props = this.node().props;
    return `Level ${this.level()}, ${WB_KIND_WORDS[props.kind]} ${this.position()} of ${this.siblingCount()}, ${props.label}`;
  });

  /** Visually-hidden sentence carrying everything the badges say graphically. */
  protected readonly stateSentence = computed(() => {
    const props = this.node().props;
    const parts: string[] = [
      `Level ${this.level()}`,
      `${WB_KIND_WORDS[props.kind]} ${this.position()} of ${this.siblingCount()}`,
    ];

    if (props.kind === 'row') {
      parts.push(`spans ${this.span()} of ${this.parentSpanMax()} columns`);
    }
    if (props.kind === 'container') {
      parts.push(`${props.columns[this.breakpoint()]} columns`);
    }

    const counts = wbCount(this.node());
    if (props.kind === 'container') {
      parts.push(
        `contains ${counts.rows} ${counts.rows === 1 ? 'row' : 'rows'}`,
      );
    } else if (props.kind === 'row') {
      const direct = this.children().length;
      const noun = this.children()[0]?.props.kind === 'row' ? 'row' : 'block';
      parts.push(`contains ${direct} ${direct === 1 ? noun : `${noun}s`}`);
    }

    let sentence = `${parts.join(', ')}.`;
    if (!props.enabled) sentence += ' Disabled.';
    else if (this.inheritedOff()) sentence += ' Hidden by a disabled parent.';
    if (this.invalid()) {
      sentence += ` Span exceeds the parent at ${this.overflowing()
        .map((bp) => WB_BREAKPOINT_LABELS[bp].toLowerCase())
        .join(' and ')}.`;
    }
    return sentence;
  });

  /* ---- Add affordance shape (UX §6.2) ---------------------------------- */

  /** Kind this node's children must all be, or `null` while it is empty. */
  protected readonly childKind = computed(
    () => this.children()[0]?.props.kind ?? null,
  );

  /** Whether the Add control may still offer a Row. */
  protected readonly canAddRow = computed(() => {
    if (this.kind() === 'container') return true;
    if (this.kind() !== 'row') return false;
    if (this.childKind() === 'block') return false;
    return this.rowDepth() < WB_MAX_ROW_DEPTH;
  });

  /** Whether the Add control may offer blocks. */
  protected readonly canAddBlock = computed(
    () => this.kind() === 'row' && this.childKind() !== 'row',
  );

  /** Whether the Add control is a menu rather than a single-purpose button. */
  protected readonly addIsMenu = computed(() => this.canAddBlock());

  /** Whether any Add affordance is rendered at all. */
  protected readonly hasAdd = computed(
    () => !this.locked() && (this.canAddRow() || this.canAddBlock()),
  );

  /** Accessible name of the Add control, whichever shape it takes. */
  protected readonly addLabel = computed(() => {
    const label = this.node().props.label;
    if (this.kind() === 'container') return `Add row to ${label}`;
    if (this.canAddRow() && this.canAddBlock()) return `Add to ${label}`;
    if (this.canAddBlock()) return `Add a block to ${label}`;
    return `Add row to ${label}`;
  });

  /** Tooltip mirroring {@link addLabel} without repeating the node name. */
  protected readonly addTooltip = computed(() => {
    if (this.kind() === 'container') return 'Add row';
    if (this.canAddRow() && this.canAddBlock()) return 'Add row or block';
    return this.canAddBlock() ? 'Add block' : 'Add row';
  });

  /* ---- Public focus surface -------------------------------------------- */

  /** Moves focus to this node's Settings button, if it renders one. */
  focusSettings(): void {
    wbFocusById(this.settingsId());
  }

  /* ---- Handlers --------------------------------------------------------- */

  /** Bubbles one Add request up with the compound ref already resolved. */
  protected requestAdd(
    tile: MlvTile<WbProps>,
    blockType: WbBlockType | null,
  ): void {
    this.addChild.emit({ tile, node: this.node(), blockType });
  }

  /** Bubbles the settings request up so the page can open the right dialog. */
  protected requestConfigure(tile: MlvTile<WbProps>): void {
    this.configure.emit({ tile, node: this.node() });
  }

  /** Bubbles the removal request up; the page owns confirmation and focus. */
  protected requestRemove(tile: MlvTile<WbProps>): void {
    this.removeNode.emit({ tile, node: this.node() });
  }

  /** Bubbles the switch change up so the page can mark the draft dirty. */
  protected requestToggle(tile: MlvTile<WbProps>, enabled: boolean): void {
    this.toggleEnabled.emit({ tile, node: this.node(), enabled });
  }

  /**
   * Moves focus one level out on `Escape`.
   *
   * The tile library binds `keydown` only on its drag handle (for the Alt+Arrow
   * model), so there is no collision. An open CDK overlay is portaled outside
   * this subtree, but its trigger is not — checking the overlay container keeps
   * a menu or dialog dismissal from also walking the tree.
   */
  protected onEscape(event: Event): void {
    if (typeof document !== 'undefined') {
      const overlay = document.querySelector(
        '.cdk-overlay-container .cdk-overlay-pane',
      );
      if (overlay) return;
    }
    event.stopPropagation();
    this.escapeToParent.emit();
  }

  /** Tracks catalog entries in the Add menu. */
  protected trackBlock(
    _index: number,
    entry: WbBlockCatalogEntry,
  ): WbBlockType {
    return entry.type;
  }
}
