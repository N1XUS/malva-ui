import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DatePipe } from '@angular/common';
import {
  LucideArchive,
  LucideArrowDownUp,
  LucideArrowLeft,
  LucideAtSign,
  LucideBell,
  LucideBuilding2,
  LucideCheck,
  LucideChevronDown,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideClock,
  LucideCode,
  LucideCommand,
  LucideCopy,
  LucideEllipsis,
  LucideFileText,
  LucideGauge,
  LucideGlobe,
  LucideInbox,
  LucideInfo,
  LucideLifeBuoy,
  LucideListFilter,
  LucideMail,
  LucideMapPin,
  LucideMenu,
  LucideMessageSquare,
  LucideMonitor,
  LucideMoon,
  LucidePanelRight,
  LucidePaperclip,
  LucidePhone,
  LucideSend,
  LucideSettings,
  LucideSparkles,
  LucideStar,
  LucideStickyNote,
  LucideTag,
  LucideThumbsUp,
  LucideTicket,
  LucideTimer,
  LucideTriangleAlert,
  LucideUserPlus,
  LucideUserRound,
  LucideUsers,
  LucideX,
  LucideZap,
} from '@lucide/angular';
import { MlvSpacer } from '@malva-ui/cdk';
import {
  MlvBreakpointDown,
  MlvBreakpointService,
  MlvBreakpointUp,
} from '@malva-ui/cdk/utils';
import { MlvDensityService } from '@malva-ui/cdk/density';
import { MlvActionBar } from '@malva-ui/core/action-bar';
import { MlvAvatar, MlvColorFromTextPipe } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import type { MlvChatMessageData, MlvChatUser } from '@malva-ui/core/chat';
import { MlvChat } from '@malva-ui/core/chat';
import { MlvChip } from '@malva-ui/core/chip';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';
import { MlvDivider } from '@malva-ui/core/divider';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { MlvFormControlAppend } from '@malva-ui/core/form-utils';
import { MlvIconToggle } from '@malva-ui/core/icon-toggle';
import { MlvLayout, MlvLayoutSide, MlvLayoutTop } from '@malva-ui/core/layout';
import {
  MlvList,
  MlvListItem,
  MlvListItemActions,
  MlvListItemByline,
  MlvListItemMedia,
  MlvListItemSelectable,
  MlvListItemTitle,
  MlvListSelectable,
} from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvMenuSeparator } from '@malva-ui/core/menu';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvSearchField } from '@malva-ui/core/search-field';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import {
  MlvPageEndPane,
  MlvPageEndPaneContent,
  MlvPageEndPaneTrigger,
} from '@malva-ui/core/page';
import type {
  MlvSidebarMode,
  MlvSidebarWorkspaceOption,
} from '@malva-ui/core/sidebar';
import {
  MlvSidebar,
  MlvSidebarContent,
  MlvSidebarFooter,
  MlvSidebarGroup,
  MlvSidebarHeader,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarWorkspace,
  MlvSidebarTrigger,
  MlvSidebarWorkspaceLogo,
  MlvSidebarWorkspaceText,
} from '@malva-ui/core/sidebar';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';
import { MlvTextarea } from '@malva-ui/core/textarea';
import { MlvTimeline, MlvTimelineItem } from '@malva-ui/core/timeline';
import { MlvTitle } from '@malva-ui/core/title';
import { MlvToastService } from '@malva-ui/core/toast';
import { MlvToolbar } from '@malva-ui/core/toolbar';
import { MlvTooltip } from '@malva-ui/core/tooltip';
import {
  AGENTS,
  AGENT_BY_ID,
  CURRENT_AGENT,
  TICKETS,
  type SupportAccountHealth,
  type SupportActivityEvent,
  type SupportAgentProfile,
  type SupportChannel,
  type SupportNote,
  type SupportPriority,
  type SupportSlaState,
  type SupportStatus,
  type SupportTicket,
} from './support-inbox.data';

/** Which pane of the composer the agent is typing into. */
type ComposerMode = 'reply' | 'note';

/** Which conversation surface is in the foreground of the single-column model. */
type InboxPane = 'list' | 'thread';

/** Ordering applied to the filtered inbox list. */
type InboxSort = 'newest' | 'oldest' | 'priority' | 'sla';

/** Status filter exposed by the segmented control above the list. */
type InboxStatusFilter = 'all' | 'open' | 'pending' | 'solved';

/** A navigable entry in the dark rail; `predicate` decides what the view contains. */
interface InboxView {
  /** Stable id, also the sidebar item's active key. */
  readonly id: string;
  /** Row label. */
  readonly label: string;
  /** Membership test for a ticket. */
  readonly predicate: (ticket: SupportTicket) => boolean;
}

/** Tone mapping for the status chip and the sidebar counters. */
const STATUS_TONE: Record<
  SupportStatus,
  'info' | 'warning' | 'success' | 'default'
> = {
  open: 'info',
  pending: 'warning',
  'on-hold': 'default',
  solved: 'success',
  closed: 'default',
};

/** Tone mapping for the priority chip. */
const PRIORITY_TONE: Record<
  SupportPriority,
  'danger' | 'warning' | 'info' | 'default'
> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'info',
  low: 'default',
};

/** Sort weight so `priority` ordering is deterministic. */
const PRIORITY_WEIGHT: Record<SupportPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/** Sort weight for the SLA ordering — worst clock first. */
const SLA_WEIGHT: Record<SupportSlaState, number> = {
  breached: 0,
  'at-risk': 1,
  due: 2,
  paused: 3,
  met: 4,
};

/** Human labels for the arrival channel. */
const CHANNEL_LABEL: Record<SupportChannel, string> = {
  email: 'Email',
  chat: 'Live chat',
  phone: 'Phone',
  social: 'Social',
  api: 'API',
  form: 'Web form',
};

@Component({
  selector: 'docs-support-inbox-showcase',
  templateUrl: './support-inbox.html',
  styleUrl: './support-inbox.scss',
  imports: [
    DatePipe,
    MlvActionBar,
    MlvAvatar,
    MlvBadge,
    MlvButton,
    MlvButtonIcon,
    MlvChat,
    MlvChip,
    MlvColorFromTextPipe,
    MlvCopyToClipboard,
    MlvDivider,
    MlvEmptyState,
    MlvFormControlAppend,
    MlvIconToggle,
    MlvLayout,
    MlvLayoutSide,
    MlvLayoutTop,
    MlvList,
    MlvListItem,
    MlvListItemActions,
    MlvListItemByline,
    MlvListItemMedia,
    MlvListItemSelectable,
    MlvListItemTitle,
    MlvListSelectable,
    MlvMenu,
    MlvMenuItem,
    MlvMenuSeparator,
    MlvMenuTrigger,
    MlvProgress,
    MlvScrollbar,
    MlvSearchField,
    MlvSegmented,
    MlvSegmentedItem,
    MlvSidebar,
    MlvSidebarContent,
    MlvSidebarFooter,
    MlvSidebarGroup,
    MlvSidebarHeader,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarWorkspace,
    MlvSidebarWorkspaceLogo,
    MlvSidebarWorkspaceText,
    MlvPageEndPane,
    MlvPageEndPaneContent,
    MlvPageEndPaneTrigger,
    MlvSidebarTrigger,
    MlvBreakpointUp,
    MlvBreakpointDown,
    MlvSpacer,
    MlvStatusIndicator,
    MlvTextarea,
    MlvTimeline,
    MlvTimelineItem,
    MlvTitle,
    MlvToolbar,
    MlvTooltip,
    LucideArchive,
    LucideArrowDownUp,
    LucideArrowLeft,
    LucideAtSign,
    LucideBell,
    LucideBuilding2,
    LucideCheck,
    LucideChevronDown,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideClock,
    LucideCode,
    LucideCommand,
    LucideCopy,
    LucideEllipsis,
    LucideFileText,
    LucideGauge,
    LucideGlobe,
    LucideInbox,
    LucideInfo,
    LucideLifeBuoy,
    LucideListFilter,
    LucideMail,
    LucideMapPin,
    LucideMenu,
    LucideMessageSquare,
    LucideMonitor,
    LucideMoon,
    LucidePanelRight,
    LucidePaperclip,
    LucidePhone,
    LucideSend,
    LucideSettings,
    LucideSparkles,
    LucideStar,
    LucideStickyNote,
    LucideTag,
    LucideThumbsUp,
    LucideTicket,
    LucideTimer,
    LucideTriangleAlert,
    LucideUserPlus,
    LucideUserRound,
    LucideUsers,
    LucideX,
    LucideZap,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Component-scoped so the tier effect below can raise every projected
  // control to a 44px touch target below lg without touching global density.
  providers: [MlvDensityService],
})
export class SupportInboxShowcaseComponent {
  /** @private Toast surface used to confirm every mutating action. */
  private readonly _toast = inject(MlvToastService);

  /** @private Viewport tier — the same sm/md/lg tiers as breakpoints.scss. */
  private readonly _bp = inject(MlvBreakpointService);

  /** @private Announces the single-column pane swap, which has no focus cue of its own. */
  private readonly _announcer = inject(LiveAnnouncer);

  /** @private Component-scoped density, driven by {@link isWide}. */
  private readonly _density = inject(MlvDensityService);

  /** @private Host element, used to re-home focus after a pane swap. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private Injector for the `afterNextRender` inside `_showPane`. */
  private readonly _injector = inject(Injector);

  /**
   * @protected The rail, resolved by view query rather than a template
   * reference: `*mlvLayoutTop` and `*mlvLayoutSide` are sibling embedded
   * views, so a `#rail` reference cannot cross from the sidebar to the app bar.
   */
  protected readonly rail = viewChild(MlvSidebar);

  /** True only on the single-column tier, where "back" is meaningful. */
  readonly isCompact = computed(() => this._bp.isSm());

  /** True only where the rail is fixed and the details pane renders in flow. */
  readonly isWide = computed(() => this._bp.isLg());

  /** Rail mode — `fixed` at lg so its trigger self-hides, `icon` below. */
  readonly railMode = computed<MlvSidebarMode>(() =>
    this.isWide() ? 'fixed' : 'icon',
  );

  /** Rail width — a wider drawer on a phone, the design column above it. */
  readonly railWidth = computed(() =>
    this.isCompact() ? 'min(19rem, 86vw)' : '16.5rem',
  );

  /** Composer height — 8 rows plus a soft keyboard leaves no thread visible. */
  readonly composerRows = computed(() => (this.isCompact() ? 1 : 2));

  /** Upper bound of the auto-resizing composer. */
  readonly composerMaxRows = computed(() => (this.isCompact() ? 4 : 8));

  /** Segmented label — the warning tint already carries "internal". */
  readonly noteLabel = computed(() =>
    this.isCompact() ? 'Note' : 'Internal note',
  );

  /** Foreground pane. Maintained at every tier; only consumed by CSS below md. */
  readonly pane = signal<InboxPane>('list');

  /**
   * Rail collapsed state, derived from the tier.
   *
   * `mode="fixed"` at lg expands the sidebar *box* but the projected content
   * still follows `collapsed`, so seeding it `true` renders an icon-only rail
   * inside a 16.5rem column. Deriving it removes that mismatch and the
   * two-writer race with the library's own responsive effect in one move.
   */
  readonly railCollapsed = computed(() => !this.isWide());

  /**
   * @private Rail groups. `MlvSidebarGroup.expanded` is a plain writable
   * signal rather than an input, so the initial open state is applied once the
   * groups exist instead of through a template binding.
   */
  private readonly _railGroups = viewChildren(MlvSidebarGroup);

  /** @private Cleanup hook for the transient typing timer. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Pending handle of the typing simulation, cleared on reselect. */
  private _typingHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this._destroyRef.onDestroy(() => this._stopTyping());

    // One open group on a phone: two puts 15 rows above "Channels".
    afterNextRender(() => {
      const open = this._bp.isSm() ? 1 : 2;
      for (const group of this._railGroups().slice(0, open)) {
        group.expanded.set(true);
      }
    });

    // A compact tier must never boot with the details drawer already open,
    // and must restore what the agent had once the pane is in flow again.
    effect(() => {
      const wide = this.isWide();
      untracked(() => {
        if (!wide) {
          if (this._detailsBeforeCompact === null) {
            this._detailsBeforeCompact = this.showDetails();
            this.showDetails.set(false);
          }
          return;
        }
        if (this._detailsBeforeCompact !== null) {
          this.showDetails.set(this._detailsBeforeCompact);
          this._detailsBeforeCompact = null;
        }
      });
    });

    // `tight` is 32px and `compact` 40px — both under the 44px touch floor.
    effect(() => {
      const wide = this.isWide();
      untracked(() =>
        this._density.setDensity(wide ? 'compact' : 'comfortable'),
      );
    });
  }

  /** Workspaces offered by the rail's switcher. */
  readonly workspaces: readonly MlvSidebarWorkspaceOption[] = [
    {
      id: 'acme',
      label: 'Acme Support',
      description: 'Production · 12 agents',
    },
    {
      id: 'acme-eu',
      label: 'Acme Support EU',
      description: 'Frankfurt region',
    },
    { id: 'northstar', label: 'Northstar Desk', description: 'Partner inbox' },
  ];

  /** Currently selected workspace in the rail's switcher. */
  readonly workspace = signal<MlvSidebarWorkspaceOption>(this.workspaces[0]);

  /** The signed-in agent. */
  readonly currentAgent = CURRENT_AGENT;

  /** Every teammate available for assignment. */
  readonly agents = AGENTS;

  /** Channel rows rendered under the Channels group. */
  readonly channels: readonly SupportChannel[] = [
    'email',
    'chat',
    'phone',
    'form',
    'api',
    'social',
  ];

  /** Human labels for the arrival channel, exposed to the template. */
  readonly channelLabel = CHANNEL_LABEL;

  /** The live inbox. Mutating actions replace entries immutably. */
  readonly tickets = signal<readonly SupportTicket[]>(TICKETS);

  /** Id of the conversation open in the reading pane. */
  readonly activeTicketId = signal<string | null>(TICKETS[0].id);

  /** Whether the right-hand details panel is visible. */
  readonly showDetails = signal(true);

  /** Logical open state handed to `mlv-page-end-pane`, at every tier. */
  readonly detailsOpen = computed(
    () => this.showDetails() && this.activeTicket() !== null,
  );

  /** @private `showDetails` captured before a compact tier forced it closed. */
  private _detailsBeforeCompact: boolean | null = null;

  /** Active rail view id. */
  readonly activeViewId = signal('all');

  /** Free-text query applied to the list. */
  readonly query = signal('');

  /** Status filter from the segmented control. */
  readonly statusFilter = signal<InboxStatusFilter>('all');

  /** Current list ordering. */
  readonly sort = signal<InboxSort>('newest');

  /** Which composer pane is active. */
  readonly composerMode = signal<ComposerMode>('reply');

  /** Draft body of the outgoing reply. */
  readonly draft = signal('');

  /** Draft body of the internal note. */
  readonly noteDraft = signal('');

  /** Rail views, in render order. Counts are derived from {@link tickets}. */
  readonly views: readonly InboxView[] = [
    { id: 'all', label: 'All conversations', predicate: () => true },
    {
      id: 'mine',
      label: 'Assigned to me',
      predicate: (ticket) => ticket.assigneeId === CURRENT_AGENT.id,
    },
    {
      id: 'unassigned',
      label: 'Unassigned',
      predicate: (ticket) => ticket.assigneeId === null,
    },
    {
      id: 'mentions',
      label: 'Mentions',
      predicate: (ticket) => ticket.notes.length > 0,
    },
  ];

  /** Saved views surfaced under the second rail group. */
  readonly savedViews: readonly InboxView[] = [
    {
      id: 'urgent',
      label: 'Urgent',
      predicate: (ticket) => ticket.priority === 'urgent',
    },
    {
      id: 'breached',
      label: 'SLA breached',
      predicate: (ticket) =>
        ticket.sla.resolutionState === 'breached' ||
        ticket.sla.firstResponseState === 'breached',
    },
    {
      id: 'waiting',
      label: 'Waiting on us',
      predicate: (ticket) => ticket.waitingOn === 'agent',
    },
    {
      id: 'snoozed',
      label: 'On hold',
      predicate: (ticket) => ticket.status === 'on-hold',
    },
    {
      id: 'solved',
      label: 'Recently solved',
      predicate: (ticket) =>
        ticket.status === 'solved' || ticket.status === 'closed',
    },
  ];

  /** Every rail view keyed by id, including the generated channel views. */
  private readonly _viewById = computed(() => {
    const map = new Map<string, InboxView>();
    for (const view of [...this.views, ...this.savedViews]) {
      map.set(view.id, view);
    }
    for (const channel of this.channels) {
      map.set(`channel:${channel}`, {
        id: `channel:${channel}`,
        label: CHANNEL_LABEL[channel],
        predicate: (ticket) => ticket.channel === channel,
      });
    }
    for (const agent of AGENTS) {
      map.set(`agent:${agent.id}`, {
        id: `agent:${agent.id}`,
        label: agent.name,
        predicate: (ticket) => ticket.assigneeId === agent.id,
      });
    }
    return map;
  });

  /** Tickets belonging to the active rail view, before search and status filters. */
  private readonly _viewTickets = computed(() => {
    const view = this._viewById().get(this.activeViewId());
    const all = this.tickets();
    return view ? all.filter((ticket) => view.predicate(ticket)) : all;
  });

  /** Label of the active rail view, used as the list heading. */
  readonly activeViewLabel = computed(
    () =>
      this._viewById().get(this.activeViewId())?.label ?? 'All conversations',
  );

  /** The filtered, sorted list rendered in the middle column. */
  readonly visibleTickets = computed<readonly SupportTicket[]>(() => {
    const needle = this.query().trim().toLowerCase();
    const status = this.statusFilter();

    const filtered = this._viewTickets().filter((ticket) => {
      if (status === 'open' && ticket.status !== 'open') return false;
      if (
        status === 'pending' &&
        ticket.status !== 'pending' &&
        ticket.status !== 'on-hold'
      ) {
        return false;
      }
      if (
        status === 'solved' &&
        ticket.status !== 'solved' &&
        ticket.status !== 'closed'
      ) {
        return false;
      }
      if (!needle) return true;

      return (
        ticket.subject.toLowerCase().includes(needle) ||
        this.snippetFor(ticket).toLowerCase().includes(needle) ||
        ticket.id.toLowerCase().includes(needle) ||
        ticket.requester.name.toLowerCase().includes(needle) ||
        ticket.account.name.toLowerCase().includes(needle) ||
        ticket.tags.some((tag) => tag.includes(needle))
      );
    });

    const sort = this.sort();
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.updatedAt - b.updatedAt;
        case 'priority':
          return (
            PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] ||
            b.updatedAt - a.updatedAt
          );
        case 'sla':
          return (
            SLA_WEIGHT[a.sla.resolutionState] -
              SLA_WEIGHT[b.sla.resolutionState] || b.updatedAt - a.updatedAt
          );
        default:
          return b.updatedAt - a.updatedAt;
      }
    });
  });

  /** The conversation open in the reading pane. */
  readonly activeTicket = computed<SupportTicket | null>(() => {
    const id = this.activeTicketId();
    return this.tickets().find((ticket) => ticket.id === id) ?? null;
  });

  /** Chat participants for the open conversation. */
  readonly chatUsers = computed<MlvChatUser[]>(() => {
    const ticket = this.activeTicket();
    if (!ticket) return [];

    return [
      { id: ticket.requester.id, name: ticket.requester.name },
      ...AGENTS.map((agent) => ({ id: agent.id, name: agent.name })),
    ];
  });

  /**
   * Chat `selfId` — the agent side of the open conversation.
   *
   * Pinned to the last teammate who actually wrote in the thread rather than to
   * the current assignee: reassigning a conversation must not re-side the
   * replies that are already in it.
   */
  readonly chatSelfId = computed(() => {
    const ticket = this.activeTicket();
    if (!ticket) return CURRENT_AGENT.id;

    const lastAgentMessage = [...ticket.conversation]
      .reverse()
      .find((message) => AGENT_BY_ID.has(message.authorId));

    return lastAgentMessage?.authorId ?? ticket.assigneeId ?? CURRENT_AGENT.id;
  });

  /** Ids selected in the conversation listbox — at most one. */
  readonly selectedIds = computed<string[]>(() => {
    const id = this.activeTicketId();
    return id ? [id] : [];
  });

  /** Latest message of a conversation, used as the list row's preview line. */
  snippetFor(ticket: SupportTicket): string {
    const messages = ticket.conversation;
    return messages[messages.length - 1]?.text ?? '';
  }

  /** Messages of the open conversation. */
  readonly chatMessages = computed<MlvChatMessageData[]>(() => [
    ...(this.activeTicket()?.conversation ?? []),
  ]);

  /**
   * @private Conversation whose requester is being shown as typing. Set when a
   * conversation with an online, waiting requester is opened and cleared a few
   * seconds later, so the indicator reads as live rather than painted on.
   */
  private readonly _typingTicketId = signal<string | null>(null);

  /** Requester ids currently typing, feeding the chat typing indicator. */
  readonly typingUsers = computed<string[]>(() => {
    const ticket = this.activeTicket();
    return ticket && this._typingTicketId() === ticket.id
      ? [ticket.requester.id]
      : [];
  });

  /** Assignee profile of the open conversation. */
  readonly activeAssignee = computed<SupportAgentProfile | null>(() => {
    const id = this.activeTicket()?.assigneeId;
    return id ? (AGENT_BY_ID.get(id) ?? null) : null;
  });

  /** Customer success owner of the open conversation's account. */
  readonly activeAccountOwner = computed<SupportAgentProfile | null>(() => {
    const ticket = this.activeTicket();
    return ticket ? (AGENT_BY_ID.get(ticket.account.ownerId) ?? null) : null;
  });

  /** Reverse-chronological activity of the open conversation. */
  readonly activeActivity = computed(() =>
    [...(this.activeTicket()?.activity ?? [])].reverse(),
  );

  /**
   * @private One pass over the inbox per change instead of one pass per rail
   * row — the template asks for a badge on every view, group and channel.
   */
  private readonly _counts = computed(() => {
    const counts = new Map<string, number>();
    const views = this._viewById();
    for (const ticket of this.tickets()) {
      for (const [id, view] of views) {
        if (view.predicate(ticket)) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  });

  /** Rail badge for a view, or `null` when the view is empty. */
  badgeFor(viewId: string): number | null {
    const count = this._counts().get(viewId) ?? 0;
    return count > 0 ? count : null;
  }

  /** Badge tone for a workflow status. */
  statusTone(
    status: SupportStatus,
  ): 'info' | 'warning' | 'success' | 'default' {
    return STATUS_TONE[status];
  }

  /** Badge tone for a triage priority. */
  priorityTone(
    priority: SupportPriority,
  ): 'danger' | 'warning' | 'info' | 'default' {
    return PRIORITY_TONE[priority];
  }

  /** Tone for an SLA clock, used by the details panel meters. */
  slaTone(
    state: SupportSlaState,
  ): 'danger' | 'warning' | 'success' | 'default' {
    if (state === 'breached') return 'danger';
    if (state === 'at-risk') return 'warning';
    if (state === 'met') return 'success';
    return 'default';
  }

  /** Tone for a rolled-up account health bucket. */
  healthTone(health: SupportAccountHealth): 'danger' | 'warning' | 'success' {
    if (health === 'at-risk') return 'danger';
    if (health === 'watch') return 'warning';
    return 'success';
  }

  /** Resolves a teammate id to a profile for template rendering. */
  agentById(id: string | null): SupportAgentProfile | null {
    return id ? (AGENT_BY_ID.get(id) ?? null) : null;
  }

  /** Opens a conversation and clears its unread counter. */
  selectTicket(ticket: SupportTicket): void {
    this.activeTicketId.set(ticket.id);
    this.draft.set('');
    this.noteDraft.set('');
    this.composerMode.set('reply');
    if (ticket.unread > 0) {
      this._patchActive({ unread: 0 }, ticket.id);
    }
    this._startTyping(ticket);
  }

  /**
   * @private Shows the requester as typing for a few seconds after a
   * conversation they are waiting on is opened.
   */
  private _startTyping(ticket: SupportTicket): void {
    this._stopTyping();
    if (!ticket.requester.online || ticket.waitingOn !== 'agent') return;
    this._typingTicketId.set(ticket.id);
    this._typingHandle = setTimeout(() => {
      this._typingTicketId.set(null);
      this._typingHandle = null;
    }, 3200);
  }

  /** @private Cancels any pending typing timer and hides the indicator. */
  private _stopTyping(): void {
    if (this._typingHandle !== null) {
      clearTimeout(this._typingHandle);
      this._typingHandle = null;
    }
    this._typingTicketId.set(null);
  }

  /** Shows or hides the details panel. */
  toggleDetails(): void {
    this.showDetails.update((value) => !value);
  }

  /**
   * Selects a rail view and keeps the reading pane in sync with it.
   *
   * When the open conversation leaves the view the pane moves through
   * {@link selectTicket} rather than by writing `activeTicketId` directly, so
   * the draft, the note draft, the composer mode, the unread badge and the
   * typing indicator are all reset exactly as they are on a normal row click.
   */
  selectView(viewId: string): void {
    this.activeViewId.set(viewId);

    // `closeOnActivation` is deliberately not used: it closes on ANY button in
    // the rail, which would dismiss it when a group header or the workspace
    // switcher is pressed. Close only when a view is actually chosen.
    const nav = this.rail();
    if (nav?.effectiveMode() === 'offcanvas') nav.collapsed.set(true);

    const visible = this.visibleTickets();
    if (visible.some((ticket) => ticket.id === this.activeTicketId())) return;

    const [first] = visible;
    if (first) {
      this.selectTicket(first);
      return;
    }

    this.activeTicketId.set(null);
    this.draft.set('');
    this.noteDraft.set('');
    this.composerMode.set('reply');
    this._stopTyping();
    this.pane.set('list');
  }

  /** Opens the conversation the listbox reports as selected. */
  selectTicketId(id: string | undefined): void {
    const ticket = this.tickets().find((item) => item.id === id);
    if (!ticket) return;
    this.selectTicket(ticket);
    this._showPane('thread');
  }

  /** Returns to the conversation list on a single-column viewport. */
  backToList(): void {
    this._showPane('list');
  }

  /** Keeps the end pane's own dismissals (Escape, backdrop, close) in sync. */
  onDetailsOpenedChange(opened: boolean): void {
    if (!opened) this.showDetails.set(false);
  }

  /** Clears the search box and the status filter from the empty state. */
  clearFilters(): void {
    this.query.set('');
    this.statusFilter.set('all');
  }

  /** Accessible name for a conversation option, unread count included. */
  rowLabel(ticket: SupportTicket): string {
    const base = `${ticket.requester.name} — ${ticket.subject}`;
    return ticket.unread ? `${base}, ${ticket.unread} unread` : base;
  }

  /**
   * @private Swaps the foreground pane. Announces and re-homes focus on the
   * single-column tier only — where both panes are visible, stealing focus
   * would be wrong.
   */
  private _showPane(next: InboxPane): void {
    if (this.pane() === next) return;
    this.pane.set(next);
    if (!this.isCompact()) return;

    this._announcer.announce(
      next === 'thread'
        ? `${this.activeTicket()?.subject ?? 'Conversation'} opened`
        : `${this.activeViewLabel()}, ${this.visibleTickets().length} conversations`,
      'polite',
    );
    afterNextRender(() => this._focusPane(next), { injector: this._injector });
  }

  /**
   * @private The outgoing pane is `display: none`, so focus would otherwise
   * fall to `<body>` and the next Tab would restart from the page top.
   */
  private _focusPane(pane: InboxPane): void {
    const root = this._host.nativeElement;
    const target =
      pane === 'thread'
        ? (root.querySelector<HTMLElement>('.support-inbox__thread-back') ??
          root.querySelector<HTMLElement>('#support-inbox-thread-title'))
        : root.querySelector<HTMLElement>(
            '.support-inbox__row[aria-selected="true"]',
          );
    target?.focus();
  }

  /** Toggles the star flag on the open conversation. */
  toggleStar(): void {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this._patchActive({ starred: !ticket.starred });
    this._logActivity(
      ticket.starred ? 'Removed the star' : 'Starred the conversation',
      null,
      'default',
    );
  }

  /**
   * @private Appends an audit entry to the open conversation so the details
   * panel's timeline reflects what the agent just did.
   */
  private _logActivity(
    action: string,
    detail: string | null,
    tone: SupportActivityEvent['tone'],
  ): void {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this._patchActive({
      activity: [
        ...ticket.activity,
        {
          id: `${ticket.id}-a${ticket.activity.length + 1}`,
          at: Date.now(),
          actor: CURRENT_AGENT.name,
          action,
          detail,
          tone,
        },
      ],
      updatedAt: Date.now(),
    });
  }

  /** Applies a new workflow status and confirms it with a toast. */
  setStatus(status: SupportStatus): void {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this._patchActive({ status, updatedAt: Date.now() });
    this._logActivity(
      `Set status to ${status.replace('-', ' ')}`,
      null,
      status === 'solved' || status === 'closed' ? 'success' : 'info',
    );
    this._toast.success(`${ticket.id} moved to ${status.replace('-', ' ')}`, {
      description: ticket.subject,
      icon: true,
    });
  }

  /** Applies a new triage priority and confirms it with a toast. */
  setPriority(priority: SupportPriority): void {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this._patchActive({ priority, updatedAt: Date.now() });
    this._logActivity(
      `Set priority to ${priority}`,
      null,
      priority === 'urgent' ? 'warning' : 'default',
    );
    this._toast.info(`Priority set to ${priority}`, {
      description: ticket.id,
      icon: true,
    });
  }

  /** Reassigns the open conversation. */
  assignTo(agent: SupportAgentProfile): void {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this._patchActive({ assigneeId: agent.id, updatedAt: Date.now() });
    this._logActivity(`Assigned to ${agent.name}`, agent.role, 'info');
    this._toast.success(`Assigned to ${agent.name}`, {
      description: `${ticket.id} · ${ticket.subject}`,
      icon: true,
    });
  }

  /** Appends the drafted reply to the open conversation. */
  sendReply(): void {
    const ticket = this.activeTicket();
    const text = this.draft().trim();
    if (!ticket || !text) return;

    const message: MlvChatMessageData = {
      id: `${ticket.id}-m${ticket.conversation.length + 1}`,
      authorId: this.chatSelfId(),
      text,
      timestamp: Date.now(),
      status: 'sent',
    };

    this._patchActive({
      conversation: [...ticket.conversation, message],
      updatedAt: Date.now(),
      waitingOn: 'customer',
    });
    this.draft.set('');
    this._stopTyping();
    this._logActivity('Replied to the requester', null, 'default');
  }

  /** Appends the drafted internal note to the open conversation. */
  addNote(): void {
    const ticket = this.activeTicket();
    const text = this.noteDraft().trim();
    if (!ticket || !text) return;

    const note: SupportNote = {
      id: `${ticket.id}-n${ticket.notes.length + 1}`,
      authorId: CURRENT_AGENT.id,
      at: Date.now(),
      text,
    };

    this._patchActive({ notes: [...ticket.notes, note] });
    this.noteDraft.set('');
    this.showDetails.set(true);
    this._logActivity('Added an internal note', null, 'info');
    this._toast.info('Internal note added', {
      description: 'Visible to teammates only.',
      icon: true,
    });
  }

  /** Marks a failed message as sending again. */
  onRetry(message: MlvChatMessageData): void {
    const ticket = this.activeTicket();
    if (!ticket) return;
    this._patchActive({
      conversation: ticket.conversation.map((item) =>
        item.id === message.id ? { ...item, status: 'sending' as const } : item,
      ),
    });
  }

  /**
   * @private Replaces the targeted ticket with a patched copy.
   * Defaults to the open conversation when no id is given.
   */
  private _patchActive(patch: Partial<SupportTicket>, id?: string): void {
    const targetId = id ?? this.activeTicketId();
    if (!targetId) return;
    this.tickets.update((list) =>
      list.map((ticket) =>
        ticket.id === targetId ? { ...ticket, ...patch } : ticket,
      ),
    );
  }
}
