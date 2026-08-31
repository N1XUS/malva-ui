import { NgTemplateOutlet } from '@angular/common';
import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  LucideActivity,
  LucideArrowRight,
  LucideArrowRightLeft,
  LucideBell,
  LucideBuilding2,
  LucideCheck,
  LucideClipboardCheck,
  LucideCommand,
  LucideDownload,
  LucideEllipsis,
  LucideInfo,
  LucideKeyRound,
  LucideKeyboard,
  LucideLogOut,
  LucideMailPlus,
  LucideMonitorCheck,
  LucidePackage,
  LucideRotateCw,
  LucideScrollText,
  LucideSearchX,
  LucideShieldAlert,
  LucideSlidersHorizontal,
  LucideTrash2,
  LucideTriangleAlert,
  LucideUndo2,
  LucideUserPlus,
  LucideUserRound,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvAlert, MlvAlertTitle } from '@malva-ui/core/alert';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import type { MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvBreadcrumb } from '@malva-ui/core/breadcrumb';
import type { MlvBreadcrumbEntry } from '@malva-ui/core/breadcrumb';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvCard } from '@malva-ui/core/card';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvChip } from '@malva-ui/core/chip';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';
import {
  MlvDataTable,
  MlvDataTableCell,
  MlvDataTableNoData,
} from '@malva-ui/core/data-table';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogService,
  MlvDialogTemplate,
} from '@malva-ui/core/dialog';
import { MlvDivider } from '@malva-ui/core/divider';
import {
  MlvDrawer,
  MlvDrawerBody,
  MlvDrawerContent,
  MlvDrawerFooter,
  MlvDrawerHeader,
  MlvDrawerSection,
  MlvDrawerSections,
} from '@malva-ui/core/drawer';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { MlvExpand, MlvExpandContent } from '@malva-ui/core/expand';
import { MlvFieldset, MlvFieldsetSpan, MlvForm } from '@malva-ui/core/form';
import { MlvDescription } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MlvList, MlvListItem } from '@malva-ui/core/list';
import { MlvLoader } from '@malva-ui/core/loader';
import {
  MlvMenu,
  MlvMenuItem,
  MlvMenuSeparator,
  MlvMenuTrigger,
} from '@malva-ui/core/menu';
import {
  MlvPage,
  MlvPageAside,
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
  MlvPageSidebar,
  MlvPageSummary,
  MlvPageSummaryItem,
  MlvPageTitle,
} from '@malva-ui/core/page';
import { MlvPinInput } from '@malva-ui/core/pin-input';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';
import { MlvSearchField } from '@malva-ui/core/search-field';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvSelect } from '@malva-ui/core/select';
import type { MlvSelectOption } from '@malva-ui/core/select';
import {
  MlvSidebar,
  MlvSidebarContent,
  MlvSidebarFooter,
  MlvSidebarGroup,
  MlvSidebarHeader,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarTrigger,
  MlvSidebarWorkspace,
  MlvSidebarWorkspaceLogo,
  MlvSidebarWorkspaceText,
} from '@malva-ui/core/sidebar';
import type { MlvSidebarWorkspaceOption } from '@malva-ui/core/sidebar';
import { MlvSkeleton } from '@malva-ui/core/skeleton';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';
import { MlvSwitch } from '@malva-ui/core/switch';
import {
  MlvTab,
  MlvTabContentDef,
  MlvTabDef,
  MlvTabGroup,
} from '@malva-ui/core/tabs';
import { MlvTextarea } from '@malva-ui/core/textarea';
import { MlvTimePicker } from '@malva-ui/core/time-picker';
import { MlvTimeline, MlvTimelineItem } from '@malva-ui/core/timeline';
import { MlvTitle } from '@malva-ui/core/title';
import { MlvToastService } from '@malva-ui/core/toast';
import { MlvTokenizer } from '@malva-ui/core/tokenizer';
import { MlvTooltip } from '@malva-ui/core/tooltip';

import { runShowcaseOperation } from '../../shared/showcase-async';
import {
  ACTIVITY_SEED,
  API_KEYS,
  ASSIGNABLE_ROLE_OPTIONS,
  BOUNCED_INVITE_EMAILS,
  CURRENT_USER,
  DATE_FORMATS,
  DEFAULTS,
  DELETE_CONFIRM_PHRASE,
  DENSITIES,
  INVITATIONS,
  INVITE_POLICIES,
  KEY_EXPIRIES,
  KEY_SCOPES,
  LANDING_PAGES,
  LANGUAGES,
  LOCKED_PROJECT_ID,
  LOCKED_PROJECT_MEMBER_ID,
  MEMBERS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  PASSWORD_POLICIES,
  PRONOUNS,
  PROJECTS,
  RESERVED_SLUGS,
  ROLES,
  ROLE_OPTIONS,
  SESSIONS,
  SESSION_LIFETIMES,
  SIGN_IN_EVENTS,
  SOLE_OWNER_MEMBER_ID,
  STEP_UP_CODE,
  STEP_UP_LOCKOUT_MS,
  STEP_UP_MAX_ATTEMPTS,
  TAKEN_SLUGS,
  TEAMS,
  TEAM_OPTIONS,
  THEMES,
  TIME_ZONES,
  TRANSFER_CONFIRM_PHRASE,
  TRANSFER_TARGET_MEMBER_ID,
  WEBHOOKS,
  WEBHOOK_EVENTS,
  WEEKDAYS,
  WEEK_STARTS,
  WORKSPACE,
  type AccessActivityEvent,
  type AccessApiKey,
  type AccessApiScope,
  type AccessChannelId,
  type AccessDraftValue,
  type AccessInvitation,
  type AccessMember,
  type AccessProjectId,
  type AccessRoleId,
  type AccessSectionId,
  type AccessSession,
  type AccessSignInEventKind,
  type AccessTeamId,
  type AccessWebhook,
  type AccessWebhookEventId,
} from './settings-access.data';

/* -------------------------------------------------------------------------- */
/* Local types                                                                */
/* -------------------------------------------------------------------------- */

/** How a staged record is coloured and how hard it blocks the save. */
type AccessSeverity = 'neutral' | 'caution' | 'blocking';

/** Storage shape of one staged field, which decides comparison and display. */
type AccessFieldKind = 'text' | 'bool' | 'set' | 'option';

/** State machine driving the dock's start slot and its two buttons. */
type AccessDockState =
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'just-saved'
  | 'partially-failed';

/**
 * One roster row as the data table sees it. It is a projection of
 * {@link AccessMember} rather than the record itself, because the table sorts,
 * searches and filters on the row's own fields: `role` therefore carries the
 * **staged** role so a pending change moves the row under the Role filter
 * exactly as the hand-rolled filter used to, and `twoFactorState` gives the
 * boolean a filterable, sortable string form.
 */
interface AccessRosterRow extends Omit<AccessMember, 'role'> {
  /** Role currently staged for this member — not the saved `member.role`. */
  readonly role: AccessRoleId;
  /** Two-factor enrolment as the value the table's Two-factor filter matches. */
  readonly twoFactorState: 'on' | 'off';
  /**
   * Placeholder for the trailing row-action column. `mlvDataTableCell` types
   * its key as `keyof T`, so the column the row menu is projected into has to
   * exist on the row; the value itself is never read or rendered.
   */
  readonly actions: null;
}

/** Filter offered above the read-only sign-in log. */
type AccessSignInFilter = 'all' | 'failed' | 'new-device';

/** What a verified step-up code is allowed to do once it succeeds. */
type AccessStepUpKind = 'rotate-key' | 'delete-key' | 'save-section';

/** Every field the page can stage, with the metadata the engine needs. */
interface AccessFieldMeta {
  /** Draft key, e.g. `sec.require2fa` or `member.m-dana.role`. */
  readonly id: string;
  /** Section whose dock saves this field. */
  readonly sectionId: AccessSectionId;
  /** Tab the field lives on, or `null` when the section has no tabs. */
  readonly tabId: string | null;
  /** Human label used by the aside record and the revert button's name. */
  readonly label: string;
  /** Storage shape, driving `normalize()` and the display formatter. */
  readonly kind: AccessFieldKind;
  /** Resolves a stored id to its display label, for `option` and `set`. */
  readonly labelOf?: (value: string) => string;
}

/** One row of the "Change review" aside. */
interface AccessStagedChange {
  /** Draft key of the field this record describes. */
  readonly id: string;
  /** Section the record belongs to. */
  readonly sectionId: AccessSectionId;
  /** Tab the record belongs to, or `null`. */
  readonly tabId: string | null;
  /** Field label. */
  readonly label: string;
  /** Saved value, already formatted for display. */
  readonly oldValue: string;
  /** Draft value, already formatted for display. */
  readonly newValue: string;
  /** Resolved consequence sentence, or `null` when the field has none. */
  readonly consequence: string | null;
  /** Rail colour and aside emphasis. */
  readonly severity: AccessSeverity;
  /** Whether saving this record needs a confirmation code first. */
  readonly needsStepUp: boolean;
}

/** A group of staged records rendered under one aside subhead. */
interface AccessChangeGroup {
  /** Section the group covers. */
  readonly sectionId: AccessSectionId;
  /** Section name shown in the subhead. */
  readonly label: string;
  /** Records inside the group, in registry order. */
  readonly changes: readonly AccessStagedChange[];
}

/** One navigable settings row in the sidebar. */
interface AccessNavItem {
  /** Section the row opens. */
  readonly id: AccessSectionId;
  /** Row label. */
  readonly label: string;
  /** Resting badge shown when the section has no staged changes. */
  readonly restingBadge: string | null;
  /** Tone of the resting badge. */
  readonly restingTone: MlvBadgeTone;
  /** Sentence explaining the resting badge, shown as the row tooltip. */
  readonly tooltip: string | null;
}

/** A labelled group of sidebar rows. */
interface AccessNavGroup {
  /** Stable id. */
  readonly id: string;
  /** Group heading. */
  readonly label: string;
  /** Rows inside the group. */
  readonly items: readonly AccessNavItem[];
}

/** One tab inside a section's tab strip. */
interface AccessTabDef {
  /** Tab value, also the `tabId` on every field it owns. */
  readonly value: string;
  /** Tab label. */
  readonly label: string;
}

/** The inline alert shown above the sessions list after a revoke. */
interface AccessSessionAlert {
  /** `info` for a revoke that worked, `danger` for one that failed. */
  readonly tone: 'info' | 'danger';
  /** Sentence rendered inside the alert. */
  readonly text: string;
  /** Session that can be restored, or `null` when the revoke failed. */
  readonly sessionId: string | null;
}

/**
 * A value list plus the transforms `mlv-select` and the consequence engine
 * need. Values stay plain strings so every control binds to the draft without
 * a cast, and the fixture's label and group survive through `toOption`.
 */
interface AccessOptionSet {
  /** Values in render order, bound to `mlv-select`'s `options`. */
  readonly values: readonly string[];
  /** `toOption` transform preserving the fixture label and group. */
  readonly toOption: (value: string) => MlvSelectOption<string>;
  /** Resolves a value to its display label. */
  readonly labelOf: (value: string) => string;
}

/* -------------------------------------------------------------------------- */
/* Static maps                                                                */
/* -------------------------------------------------------------------------- */

/** Section name used in headings, breadcrumbs, docks and aside subheads. */
const SECTION_LABEL: Record<AccessSectionId, string> = {
  profile: 'Profile',
  preferences: 'Preferences',
  notifications: 'Notifications',
  general: 'General',
  members: 'Members & roles',
  security: 'Security',
  api: 'API access',
  danger: 'Danger zone',
};

/** Sentence under the h1 of each section. */
const SECTION_DESCRIPTION: Record<AccessSectionId, string> = {
  profile: 'How you appear to the 12 people in Northwind Labs.',
  preferences:
    'Language, time and appearance for your account on this device and every other.',
  notifications:
    'Choose what reaches you, where it arrives and when it stays quiet.',
  general: 'The name, address and billing contact the whole workspace shares.',
  members:
    'Who is in Northwind Labs, what they can do and who is still waiting to join.',
  security: 'Sign-in rules, live sessions and the record of who got in.',
  api: 'Keys and webhooks that let other systems act on this workspace.',
  danger:
    'Three actions that cannot be undone. Read each one before you start.',
};

/** Breadcrumb middle segment, naming the group the section sits in. */
const SECTION_GROUP_LABEL: Record<AccessSectionId, string> = {
  profile: 'Personal',
  preferences: 'Personal',
  notifications: 'Personal',
  general: 'Workspace',
  members: 'Workspace',
  security: 'Workspace',
  api: 'Workspace',
  danger: 'Workspace',
};

/** Label of the summary strip for each section. */
const SECTION_SUMMARY_LABEL: Record<AccessSectionId, string> = {
  profile: 'Account facts',
  preferences: 'Current settings',
  notifications: 'Delivery at a glance',
  general: 'Workspace facts',
  members: 'Access at a glance',
  security: 'Security posture',
  api: 'Integration facts',
  danger: 'Before you act',
};

/** Tabs rendered by each section; an empty list means the section has none. */
const SECTION_TABS: Record<AccessSectionId, readonly AccessTabDef[]> = {
  profile: [],
  preferences: [],
  notifications: [
    { value: 'delivery', label: 'Delivery' },
    { value: 'subscriptions', label: 'Subscriptions' },
  ],
  general: [],
  members: [
    { value: 'roster', label: 'Members' },
    { value: 'invitations', label: 'Invitations' },
    { value: 'roles', label: 'Roles' },
  ],
  security: [
    { value: 'policies', label: 'Policies' },
    { value: 'sessions', label: 'Sessions' },
    { value: 'signin-log', label: 'Sign-in log' },
  ],
  api: [
    { value: 'keys', label: 'Keys' },
    { value: 'webhooks', label: 'Webhooks' },
  ],
  danger: [],
};

/** Sidebar rows, in render order. */
const NAV_GROUPS: readonly AccessNavGroup[] = [
  {
    id: 'personal',
    label: 'Personal',
    items: [
      {
        id: 'profile',
        label: 'Profile',
        restingBadge: null,
        restingTone: 'default',
        tooltip: null,
      },
      {
        id: 'preferences',
        label: 'Preferences',
        restingBadge: null,
        restingTone: 'default',
        tooltip: null,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        restingBadge: null,
        restingTone: 'default',
        tooltip: null,
      },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        id: 'general',
        label: 'General',
        restingBadge: null,
        restingTone: 'default',
        tooltip: null,
      },
      {
        id: 'members',
        label: 'Members & roles',
        restingBadge: String(INVITATIONS.length),
        restingTone: 'info',
        tooltip: `${INVITATIONS.length} invitations waiting`,
      },
      {
        id: 'security',
        label: 'Security',
        restingBadge: '!',
        restingTone: 'danger',
        tooltip: 'Two-factor authentication is not enforced',
      },
      {
        id: 'api',
        label: 'API access',
        restingBadge: '1',
        restingTone: 'warning',
        tooltip: '1 key is overdue for rotation',
      },
      {
        id: 'danger',
        label: 'Danger zone',
        restingBadge: null,
        restingTone: 'default',
        tooltip: null,
      },
    ],
  },
];

/** Notification channel labels, keyed by channel id. */
const CHANNEL_LABEL: Record<AccessChannelId, string> = {
  email: 'Email',
  inApp: 'In-app',
  push: 'Mobile push',
};

/** Order the invite policies widen in; a higher index is narrower. */
const INVITE_POLICY_ORDER: readonly string[] = ['anyone', 'admins', 'owners'];

/** Order the password policies strengthen in; a higher index is stronger. */
const PASSWORD_POLICY_ORDER: readonly string[] = [
  'standard',
  'strong',
  'passphrase',
];

/** Session lifetime in hours, used to count the sessions a save signs out. */
const LIFETIME_HOURS: Record<string, number> = {
  '8 hours': 8,
  '24 hours': 24,
  '7 days': 168,
  '30 days': 720,
  '90 days': 2160,
};

/** Badge tone for each invitation state. */
const INVITATION_TONE: Record<string, MlvBadgeTone> = {
  sending: 'default',
  pending: 'info',
  expiring: 'warning',
  bounced: 'danger',
};

/** Badge label for each invitation state. */
const INVITATION_LABEL: Record<string, string> = {
  sending: 'Sending',
  pending: 'Pending',
  expiring: 'Expiring',
  bounced: 'Bounced',
};

/** Accepts an address that looks like an email without being pedantic. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Accepts a bare domain such as `northwind.com`. */
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/;

/** Accepts a workspace address of 3 to 40 lower-case characters. */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** How long the dock keeps showing the just-saved row. */
const JUST_SAVED_MS = 6000;

/** How long the session undo alert stays before it clears itself. */
const SESSION_UNDO_MS = 8000;

/** Delay used by every visible async step so its loading state can be read. */
const SLOW_DELAY = 420;

/** Delay used when a tab's collection is loaded for the first time. */
const COLLECTION_DELAY = 260;

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `stackBelow` value that never stacks: `mlv-page-content` stacks only while
 * its measured container width is greater than zero and below this number.
 */
const NEVER_STACK_WIDTH = 0;

/** `stackBelow` value no container on this page can reach, so it always stacks. */
const ALWAYS_STACK_WIDTH = 100_000;

/** Picks the singular or plural noun and prefixes the count. */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Groups thousands with a comma without relying on the host locale. */
function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Renders a past timestamp as a short relative phrase. */
function relativeTime(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${plural(minutes, 'minute', 'minutes')} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour', 'hours')} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${plural(days, 'day', 'days')} ago`;
  const months = Math.round(days / 30);
  return `${plural(months, 'month', 'months')} ago`;
}

/** Joins a list into `a, b and c`, or returns `None` when it is empty. */
function joinList(items: readonly string[]): string {
  if (items.length === 0) return 'None';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Builds the value list and transforms a `mlv-select` needs from a fixture. */
function optionSet(
  options: readonly MlvSelectOption<string>[],
): AccessOptionSet {
  const byValue = new Map<string, MlvSelectOption<string>>(
    options.map((option) => [option.value, option]),
  );
  return {
    values: options.map((option) => option.value),
    toOption: (value: string) => byValue.get(value) ?? { label: value, value },
    labelOf: (value: string) => byValue.get(value)?.label ?? value,
  };
}

/** Reads a draft entry as a string. */
function asText(value: AccessDraftValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** Reads a draft entry as a boolean. */
function asBool(value: AccessDraftValue | undefined): boolean {
  return value === true;
}

/** Reads a draft entry as a string set. */
function asSet(value: AccessDraftValue | undefined): readonly string[] {
  return Array.isArray(value) ? value : [];
}

/** Comparable form of a draft value, per the normalisation table. */
function normalize(kind: AccessFieldKind, value: AccessDraftValue): string {
  switch (kind) {
    case 'bool':
      return value === true ? '1' : '0';
    case 'set':
      return [...asSet(value)]
        .map((entry) => entry.trim().toLowerCase())
        .sort()
        .join(',');
    case 'option':
      return asText(value);
    default:
      return asText(value).trim();
  }
}

/** Whole hours between two `HH:mm` values, wrapping across midnight. */
function hoursBetween(start: string, end: string): number {
  const toMinutes = (value: string): number => {
    const [hours, minutes] = value.split(':').map((part) => Number(part) || 0);
    return hours * 60 + minutes;
  };
  const span = (toMinutes(end) - toMinutes(start) + 1440) % 1440;
  return Math.round(span / 60);
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * "Access Desk" — the Settings & Access showcase at `/showcases/settings-access`.
 *
 * The page never autosaves. Every edit is staged into one root draft signal,
 * narrated as a human consequence in the sticky "Change review" aside, and
 * applied only when the dock's save button runs. Staged changes survive both
 * section and tab switching because there is exactly one draft for the whole
 * page and no per-section form state.
 */
@Component({
  selector: 'docs-settings-access-showcase',
  templateUrl: './settings-access.html',
  styleUrl: './settings-access.scss',
  imports: [
    NgTemplateOutlet,
    MlvAlert,
    MlvAlertTitle,
    MlvAvatar,
    MlvBadge,
    MlvBreadcrumb,
    MlvButton,
    MlvButtonIcon,
    MlvCard,
    MlvCheckbox,
    MlvChip,
    MlvCopyToClipboard,
    MlvDataTable,
    MlvDataTableCell,
    MlvDataTableNoData,
    MlvDescription,
    MlvDialog,
    MlvDialogBody,
    MlvDialogClose,
    MlvDialogFooter,
    MlvDialogHeader,
    MlvDialogTemplate,
    MlvDivider,
    MlvDrawer,
    MlvDrawerBody,
    MlvDrawerContent,
    MlvDrawerFooter,
    MlvDrawerHeader,
    MlvDrawerSection,
    MlvDrawerSections,
    MlvEmptyState,
    MlvExpand,
    MlvExpandContent,
    MlvFieldset,
    MlvFieldsetSpan,
    MlvForm,
    MlvInput,
    MlvList,
    MlvListItem,
    MlvLoader,
    MlvMenu,
    MlvMenuItem,
    MlvMenuSeparator,
    MlvMenuTrigger,
    MlvPage,
    MlvPageAside,
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
    MlvPageSidebar,
    MlvPageSummary,
    MlvPageSummaryItem,
    MlvPageTitle,
    MlvPinInput,
    MlvRadio,
    MlvRadioGroup,
    MlvSearchField,
    MlvSegmented,
    MlvSegmentedItem,
    MlvSelect,
    MlvSidebar,
    MlvSidebarContent,
    MlvSidebarFooter,
    MlvSidebarGroup,
    MlvSidebarHeader,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarTrigger,
    MlvSidebarWorkspace,
    MlvSidebarWorkspaceLogo,
    MlvSidebarWorkspaceText,
    MlvSkeleton,
    MlvSpacer,
    MlvStatusIndicator,
    MlvSwitch,
    MlvTab,
    MlvTabContentDef,
    MlvTabDef,
    MlvTabGroup,
    MlvTextarea,
    MlvTimePicker,
    MlvTimeline,
    MlvTimelineItem,
    MlvTitle,
    MlvTokenizer,
    MlvTooltip,
    LucideActivity,
    LucideArrowRight,
    LucideArrowRightLeft,
    LucideBell,
    LucideBuilding2,
    LucideCheck,
    LucideClipboardCheck,
    LucideCommand,
    LucideDownload,
    LucideEllipsis,
    LucideInfo,
    LucideKeyRound,
    LucideKeyboard,
    LucideLogOut,
    LucideMailPlus,
    LucideMonitorCheck,
    LucidePackage,
    LucideRotateCw,
    LucideScrollText,
    LucideSearchX,
    LucideShieldAlert,
    LucideSlidersHorizontal,
    LucideTrash2,
    LucideTriangleAlert,
    LucideUndo2,
    LucideUserPlus,
    LucideUserRound,
    LucideUsers,
    LucideX,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.control.s)': 'onSaveShortcut($event)',
    '(keydown.meta.s)': 'onSaveShortcut($event)',
  },
})
export class SettingsAccessShowcaseComponent {
  /** @private Toast surface confirming every mutating action. */
  private readonly _toast = inject(MlvToastService);

  /** @private Guard and revert confirmations. */
  private readonly _dialog = inject(MlvDialogService);

  /** @private Cleanup hook for the just-saved, undo and lockout timers. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private Injection context for the `afterNextRender` call that re-asserts
   * an intercepted control outside the constructor
   * (see {@link _reassertRequire2fa}).
   */
  private readonly _injector = inject(Injector);

  /**
   * @private Sidebar groups. `MlvSidebarGroup.expanded` is a plain writable
   * signal rather than an input, so both groups are opened once they exist
   * instead of through a template binding.
   */
  private readonly _navGroups = viewChildren(MlvSidebarGroup);

  /** @private The section heading, focused after a successful save. */
  private readonly _headingRef =
    viewChild<ElementRef<HTMLElement>>('sectionHeading');

  /** @private Handle of the just-saved countdown. */
  private _savedHandle: ReturnType<typeof setTimeout> | null = null;

  /** @private Handle of the session undo alert's self-clear. */
  private _undoHandle: ReturnType<typeof setTimeout> | null = null;

  /** @private Handle of the step-up lockout countdown. */
  private _lockoutHandle: ReturnType<typeof setInterval> | null = null;

  /** @private Tracks the media state already pushed into `railCollapsed`. */
  private _appliedNarrow: boolean | null = null;

  /* ---------------------------------------------------------------------- */
  /* Fixtures exposed to the template                                       */
  /* ---------------------------------------------------------------------- */

  /** The signed-in administrator. */
  readonly currentUser = CURRENT_USER;

  /** The workspace under administration. */
  readonly workspace = WORKSPACE;

  /** Every role definition, rendered on the Roles tab. */
  readonly roles = ROLES;

  /** Every team a member can belong to. */
  readonly teams = TEAMS;

  /** Every project member access is granted against. */
  readonly projects = PROJECTS;

  /** Notification delivery channels. */
  readonly channels = NOTIFICATION_CHANNELS;

  /** Subscribable notification event types. */
  readonly notificationEvents = NOTIFICATION_EVENTS;

  /** Member whose Corvus grant is locked by their team. */
  readonly lockedProjectMemberId = LOCKED_PROJECT_MEMBER_ID;

  /** Phrase the transfer-ownership dialog requires. */
  readonly transferPhrase = TRANSFER_CONFIRM_PHRASE;

  /** Phrase the delete-workspace dialog requires. */
  readonly deletePhrase = DELETE_CONFIRM_PHRASE;

  /** Sidebar rows, in render order. */
  readonly navGroups = NAV_GROUPS;

  /* ---------------------------------------------------------------------- */
  /* Option sets                                                            */
  /* ---------------------------------------------------------------------- */

  /** Pronoun options. */
  readonly pronounSet = optionSet(PRONOUNS);

  /** Interface language options. */
  readonly languageSet = optionSet(LANGUAGES);

  /** Time zone options, grouped by continent. */
  readonly timeZoneSet = optionSet(TIME_ZONES);

  /** Date format options. */
  readonly dateFormatSet = optionSet(DATE_FORMATS);

  /** First-day-of-week options. */
  readonly weekStartSet = optionSet(WEEK_STARTS);

  /** Appearance options. */
  readonly themeSet = optionSet(THEMES);

  /** Interface density options. */
  readonly densitySet = optionSet(DENSITIES);

  /** Start-up destination options. */
  readonly landingPageSet = optionSet(LANDING_PAGES);

  /** Weekday options for the digest. */
  readonly weekdaySet = optionSet(WEEKDAYS);

  /** Invite policy options, widest first. */
  readonly invitePolicySet = optionSet(INVITE_POLICIES);

  /** Password policy options, weakest first. */
  readonly passwordPolicySet = optionSet(PASSWORD_POLICIES);

  /** Session lifetime options, shortest first. */
  readonly sessionLifetimeSet = optionSet(SESSION_LIFETIMES);

  /** API key expiry options. */
  readonly keyExpirySet = optionSet(KEY_EXPIRIES);

  /** API key scopes, in widening order. */
  readonly keyScopeSet = optionSet(KEY_SCOPES);

  /** Webhook event options. */
  readonly webhookEventSet = optionSet(WEBHOOK_EVENTS);

  /** Every role, for the roster and drawer role selects. */
  readonly roleSet = optionSet(ROLE_OPTIONS);

  /** The four assignable roles; Owner is excluded. */
  readonly assignableRoleSet = optionSet(ASSIGNABLE_ROLE_OPTIONS);

  /** Team options for the drawer's multi-select. */
  readonly teamSet = optionSet(TEAM_OPTIONS);

  /* ---------------------------------------------------------------------- */
  /* Live records                                                           */
  /* ---------------------------------------------------------------------- */

  /** The roster. Ownership transfer replaces entries immutably. */
  readonly members = signal<readonly AccessMember[]>(MEMBERS);

  /** Pending invitations, mutated by the invite and revoke flows. */
  readonly invitations = signal<readonly AccessInvitation[]>(INVITATIONS);

  /** Live sessions, mutated by the revoke flow. */
  readonly sessions = signal<readonly AccessSession[]>(SESSIONS);

  /** API keys, mutated by the rotate and delete flows. */
  readonly apiKeys = signal<readonly AccessApiKey[]>(API_KEYS);

  /** Webhook endpoints. */
  readonly webhooks = signal<readonly AccessWebhook[]>(WEBHOOKS);

  /** The aside's activity feed; every flow prepends to it. */
  readonly activity = signal<readonly AccessActivityEvent[]>(ACTIVITY_SEED);

  /** Anchor used by every relative timestamp, so renders stay stable. */
  readonly now = Date.now();

  /* ---------------------------------------------------------------------- */
  /* Navigation and view state                                              */
  /* ---------------------------------------------------------------------- */

  /** Section currently open. */
  readonly activeSection = signal<AccessSectionId>('profile');

  /** @private Last tab opened per section, so returning restores the tab. */
  private readonly _tabBySection = signal<Record<string, string>>({
    notifications: 'delivery',
    members: 'roster',
    security: 'policies',
    api: 'keys',
  });

  /** Tab open in the current section, or `''` when it has no tabs. */
  readonly activeTab = computed(
    () => this._tabBySection()[this.activeSection()] ?? '',
  );

  /** Whether the sidebar is collapsed to its icon rail. */
  readonly railCollapsed = signal(false);

  /** Workspaces offered by the sidebar switcher. */
  readonly workspaceOptions: readonly MlvSidebarWorkspaceOption[] = [
    {
      id: 'northwind',
      label: WORKSPACE.name,
      description: `${WORKSPACE.plan} plan · ${MEMBERS.length} members`,
    },
    {
      id: 'northwind-eu',
      label: 'Northwind Labs EU',
      description: 'Frankfurt region',
    },
    { id: 'northwind-sandbox', label: 'Sandbox', description: 'Free plan' },
  ];

  /** Workspace selected in the sidebar switcher. */
  readonly selectedWorkspace = signal<MlvSidebarWorkspaceOption>(
    this.workspaceOptions[0],
  );

  /** Demo affordance that previews the page without owner rights. */
  readonly viewAsAdmin = signal(false);

  /** Role the page renders for; `admin` makes the Danger zone read-only. */
  readonly viewerRole = computed<AccessRoleId>(() => {
    if (this.viewAsAdmin()) return 'admin';
    return this._ownerId() === CURRENT_USER.id ? 'owner' : 'admin';
  });

  /** Whether the viewer may run the Danger zone actions. */
  readonly isOwner = computed(() => this.viewerRole() === 'owner');

  /** @private True below the desktop breakpoint. */
  private readonly _tabletOrBelow = signal(false);

  /**
   * @private True below the 1024px tier, where the change-review aside stops
   * being a side column and stacks under the form (§7).
   */
  private readonly _belowAsideColumn = signal(false);

  /**
   * Container width `mlv-page-content` stacks its aside below, resolved from
   * the viewport rather than from a fixed number.
   *
   * `mlv-page-content` measures its own container, but this page's container
   * width is not monotonic in viewport width: the settings rail is in flow
   * above the `lg` breakpoint and off-canvas below it, so the container is
   * 970px at a 1280px viewport but 1005px at a 1023px one. No single container
   * threshold can therefore express "side column at 1024 and up, stacked below
   * it" — every value that keeps the column at 1280 also keeps it at 1023.
   * Watching the tier on the viewport and mapping it onto a threshold the
   * container can never (or always) cross resolves it correctly at every width.
   */
  readonly asideStackBelow = computed(() =>
    this._belowAsideColumn() ? ALWAYS_STACK_WIDTH : NEVER_STACK_WIDTH,
  );

  /** True below the mobile breakpoint; drives fullscreen dialog sizing. */
  readonly isNarrow = signal(false);

  /** Free-text roster query. */
  readonly rosterQuery = signal('');

  /** Filter above the sign-in log. */
  readonly signInFilter = signal<AccessSignInFilter>('all');

  /** @private Collections whose first-load skeleton has already played. */
  private readonly _loadedCollections = signal<readonly string[]>([]);

  /** @private Collection currently showing its first-load skeleton. */
  private readonly _loadingCollection = signal<string | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Draft model                                                            */
  /* ---------------------------------------------------------------------- */

  /** @private Every field the page can stage, built once. */
  private readonly _fields: readonly AccessFieldMeta[] = this._buildFields();

  /** @private Fast lookup from field id to metadata. */
  private readonly _fieldById = new Map(
    this._fields.map((field) => [field.id, field]),
  );

  /** @private Saved value of every field; a save replaces the entries. */
  private readonly _baseline = signal<Record<string, AccessDraftValue>>(
    this._buildBaseline(),
  );

  /**
   * @private The one root draft for the whole page. Sections and tabs read
   * slices of it and never reset it, so staged edits survive navigation.
   */
  private readonly _draft = signal<Record<string, AccessDraftValue>>(
    this._buildBaseline(),
  );

  /** Current draft, read by every control on the page. */
  readonly draft = this._draft.asReadonly();

  /** Values of every `set` field, copied so select bindings stay stable. */
  readonly setValues = computed<Record<string, string[]>>(() => {
    const draft = this._draft();
    const out: Record<string, string[]> = {};
    for (const field of this._fields) {
      if (field.kind === 'set') out[field.id] = [...asSet(draft[field.id])];
    }
    return out;
  });

  /** Values of every tokenizer field, as the option shape it binds to. */
  readonly tokenValues = computed<Record<string, MlvSelectOption<string>[]>>(
    () => {
      const draft = this._draft();
      const out: Record<string, MlvSelectOption<string>[]> = {};
      for (const id of [
        'ws.autoJoinDomains',
        'sec.allowedDomains',
        'sec.alertRecipients',
      ]) {
        out[id] = asSet(draft[id]).map((value) => ({ label: value, value }));
      }
      return out;
    },
  );

  /* ---------------------------------------------------------------------- */
  /* Derived fixture counts used by every consequence                       */
  /* ---------------------------------------------------------------------- */

  /** Total members in the workspace. */
  readonly memberCount = computed(() => this.members().length);

  /** Members whose role was inherited from the workspace default. */
  readonly defaultRoleCount = computed(
    () =>
      this.members().filter((member) => member.roleSource === 'default').length,
  );

  /** Members with no second factor enrolled. */
  readonly without2faCount = computed(
    () => this.members().filter((member) => !member.twoFactor).length,
  );

  /** Members with a second factor enrolled. */
  readonly with2faCount = computed(
    () => this.members().filter((member) => member.twoFactor).length,
  );

  /** Members who sign in with a password only. */
  readonly passwordOnlyCount = computed(
    () => this.members().filter((member) => !member.ssoEnabled).length,
  );

  /** Members whose password fails the strong policy. */
  readonly weakPasswordCount = computed(
    () => this.members().filter((member) => member.weakPassword).length,
  );

  /** Members who could move between Member, Analyst and Viewer unaided. */
  readonly selfServiceEligible = computed(
    () =>
      this.members().filter(
        (member) =>
          member.role === 'member' ||
          member.role === 'analyst' ||
          member.role === 'viewer',
      ).length,
  );

  /** Owners in the workspace. */
  readonly ownerCount = computed(
    () => this.members().filter((member) => member.role === 'owner').length,
  );

  /** Admins in the workspace. */
  readonly adminCount = computed(
    () => this.members().filter((member) => member.role === 'admin').length,
  );

  /** Failed sign-ins recorded in the last seven days. */
  readonly failedSignInCount = computed(
    () => SIGN_IN_EVENTS.filter((event) => event.kind === 'failed').length,
  );

  /** Keys that are overdue for rotation. */
  readonly overdueKeyCount = computed(
    () => this.apiKeys().filter((key) => key.rotationDueAt < this.now).length,
  );

  /** Webhook endpoints that are paused. */
  readonly pausedWebhookCount = computed(
    () => this.webhooks().filter((hook) => !hook.active).length,
  );

  /** Invitations that bounced. */
  readonly bouncedInvitationCount = computed(
    () =>
      this.invitations().filter((entry) => entry.state === 'bounced').length,
  );

  /** @private Id of the member who currently owns the workspace. */
  private readonly _ownerId = computed(
    () =>
      this.members().find((member) => member.role === 'owner')?.id ??
      SOLE_OWNER_MEMBER_ID,
  );

  /* ---------------------------------------------------------------------- */
  /* Staged changes                                                         */
  /* ---------------------------------------------------------------------- */

  /**
   * Every field whose draft value differs from its baseline, in registry
   * order. This is a pure projection of `_draft` over the field registry —
   * there is no second store of staged records anywhere on the page.
   */
  readonly staged = computed<readonly AccessStagedChange[]>(() => {
    const draft = this._draft();
    const baseline = this._baseline();
    const out: AccessStagedChange[] = [];

    for (const field of this._fields) {
      const next = draft[field.id];
      const previous = baseline[field.id];
      if (next === undefined || previous === undefined) continue;
      if (normalize(field.kind, next) === normalize(field.kind, previous)) {
        continue;
      }

      const severity = this._severityFor(field.id, previous, next);
      out.push({
        id: field.id,
        sectionId: field.sectionId,
        tabId: field.tabId,
        label: field.label,
        oldValue: this._display(field, previous),
        newValue: this._display(field, next),
        consequence: this.consequenceFor(field.id, previous, next),
        severity,
        needsStepUp: this._needsStepUpFor(field.id, previous, next),
      });
    }

    return out;
  });

  /** Total number of staged fields across the whole page. */
  readonly stagedCount = computed(() => this.staged().length);

  /** Staged fields grouped by section, in sidebar order. */
  readonly stagedGroups = computed<readonly AccessChangeGroup[]>(() => {
    const changes = this.staged();
    const order = this.navGroups.flatMap((group) =>
      group.items.map((item) => item.id),
    );
    return order
      .map((sectionId) => ({
        sectionId,
        label: SECTION_LABEL[sectionId],
        changes: changes.filter((change) => change.sectionId === sectionId),
      }))
      .filter((group) => group.changes.length > 0);
  });

  /** Number of sections holding at least one staged change. */
  readonly stagedSectionCount = computed(() => this.stagedGroups().length);

  /** Staged fields inside the section currently open. */
  readonly sectionStaged = computed(() =>
    this.staged().filter((change) => change.sectionId === this.activeSection()),
  );

  /** Staged fields outside the section currently open. */
  readonly otherStagedCount = computed(
    () => this.stagedCount() - this.sectionStaged().length,
  );

  /** The first blocking record, used by the aside's danger alert. */
  readonly blockingChange = computed(
    () =>
      this.staged().find((change) => change.severity === 'blocking') ?? null,
  );

  /** Records in the current section that still need a confirmation code. */
  readonly sectionStepUpChanges = computed(() =>
    this.sectionStaged().filter((change) => change.needsStepUp),
  );

  /* ---------------------------------------------------------------------- */
  /* Save state                                                             */
  /* ---------------------------------------------------------------------- */

  /** @private Dock state machine. */
  private readonly _dockState = signal<AccessDockState>('clean');

  /** @private Number of fields the last save applied. */
  private readonly _savedCount = signal(0);

  /** @private Number of fields the last save could not apply. */
  private readonly _failedCount = signal(0);

  /** @private Section the last save targeted. */
  private readonly _savedSection = signal<AccessSectionId | null>(null);

  /** @private Field the server rejected, kept so the alert can name it. */
  private readonly _rejectedFieldId = signal<string | null>(null);

  /** @private Message the server returned for the rejected field. */
  private readonly _rejectedMessage = signal('');

  /** @private Fields the pre-flight check refused to save. */
  private readonly _preflightBlocked = signal(false);

  /** Current dock state, resolved against the section the user is on. */
  readonly dockState = computed<AccessDockState>(() => {
    const state = this._dockState();
    if (state === 'clean' || state === 'dirty') {
      return this.sectionStaged().length > 0 ? 'dirty' : 'clean';
    }
    if (this._savedSection() !== this.activeSection()) {
      return this.sectionStaged().length > 0 ? 'dirty' : 'clean';
    }
    return state;
  });

  /** Number of fields the last save applied, for the dock and the toast. */
  readonly savedCount = this._savedCount.asReadonly();

  /** Number of fields the last save could not apply. */
  readonly failedCount = this._failedCount.asReadonly();

  /** Server message for the rejected field, shown by the General alert. */
  readonly rejectedMessage = this._rejectedMessage.asReadonly();

  /** Field id the server rejected, or `null`. */
  readonly rejectedFieldId = this._rejectedFieldId.asReadonly();

  /** Whether the pre-flight check refused the last save attempt. */
  readonly preflightBlocked = this._preflightBlocked.asReadonly();

  /** @private Set to true after the user acknowledges the unsaved guard. */
  private readonly _guardAcknowledged = signal(false);

  /* ---------------------------------------------------------------------- */
  /* Overlay state                                                          */
  /* ---------------------------------------------------------------------- */

  /** Whether the invite dialog is open. */
  readonly inviteOpen = signal(false);

  /** Whether the step-up dialog is open. */
  readonly stepUpOpen = signal(false);

  /** Whether the two-factor blast-radius dialog is open. */
  readonly twoFactorOpen = signal(false);

  /** Whether the transfer-ownership dialog is open. */
  readonly transferOpen = signal(false);

  /** Whether the delete-workspace dialog is open. */
  readonly deleteOpen = signal(false);

  /** Whether the member access drawer is open. */
  readonly memberDrawerOpen = signal(false);

  /** Member whose access the drawer edits, or `null`. */
  readonly activeMemberId = signal<string | null>(null);

  /** The member the drawer is showing. */
  readonly activeMember = computed(
    () =>
      this.members().find((member) => member.id === this.activeMemberId()) ??
      null,
  );

  /** @private Local drawer buffer so Cancel is a real cancel. */
  private readonly _drawerDraft = signal<Record<string, AccessDraftValue>>({});

  /** Teams currently selected in the drawer, as a stable array. */
  readonly drawerTeams = computed(() => {
    const id = this.activeMemberId();
    if (!id) return [] as string[];
    return [...asSet(this._drawerDraft()[`member.${id}.teams`])];
  });

  /** Number of drawer edits that differ from the page draft. */
  readonly drawerStagedCount = computed(() => {
    const id = this.activeMemberId();
    if (!id) return 0;
    const local = this._drawerDraft();
    const draft = this._draft();
    return this._memberFieldIds(id).filter((fieldId) => {
      const field = this._fieldById.get(fieldId);
      if (!field) return false;
      const next = local[fieldId];
      const current = draft[fieldId];
      if (next === undefined || current === undefined) return false;
      return normalize(field.kind, next) !== normalize(field.kind, current);
    }).length;
  });

  /** Whether every project is granted in the drawer buffer. */
  readonly drawerAllProjects = computed(() => {
    const id = this.activeMemberId();
    if (!id) return false;
    const local = this._drawerDraft();
    return PROJECTS.every((project) =>
      asBool(local[`member.${id}.project.${project.id}`]),
    );
  });

  /** Whether the drawer's project grants are a partial selection. */
  readonly drawerSomeProjects = computed(() => {
    const id = this.activeMemberId();
    if (!id) return false;
    const local = this._drawerDraft();
    const granted = PROJECTS.filter((project) =>
      asBool(local[`member.${id}.project.${project.id}`]),
    ).length;
    return granted > 0 && granted < PROJECTS.length;
  });

  /* ---------------------------------------------------------------------- */
  /* Invite flow state                                                      */
  /* ---------------------------------------------------------------------- */

  /** Addresses typed into the invite dialog's tokenizer. */
  readonly inviteEmails = signal<MlvSelectOption<string>[]>([]);

  /** Role the invitees will hold. */
  readonly inviteRole = signal<AccessRoleId>('viewer');

  /** Teams the invitees join. */
  readonly inviteTeams = signal<AccessTeamId[]>([]);

  /** Whether a welcome message is sent with the invitation. */
  readonly inviteSendWelcome = signal(true);

  /** Body of the welcome message. */
  readonly inviteMessage = signal('');

  /** Whether the invite request is running. */
  readonly inviting = signal(false);

  /** Addresses the mail server rejected on the last attempt. */
  readonly inviteBounced = signal<readonly string[]>([]);

  /** Typed addresses split into the four classes the footer reacts to. */
  readonly inviteClassification = computed(() => {
    const memberEmails = new Set(
      this.members().map((member) => member.email.toLowerCase()),
    );
    // A bounced invitation is exactly what a user retries (§4b steps 7 and 9),
    // so it must not count as "already invited". The seeded bounce address is
    // both a `BOUNCED_INVITE_EMAILS` entry and a seeded `bounced` row, so
    // without this exemption it is filtered out of `valid` on a clean page and
    // the whole bounce path is unreachable.
    const invitedEmails = new Set(
      this.invitations()
        .filter((entry) => entry.state !== 'bounced')
        .map((entry) => entry.email.toLowerCase()),
    );
    const valid: string[] = [];
    const invalid: string[] = [];
    const alreadyMember: string[] = [];
    const alreadyInvited: string[] = [];

    for (const token of this.inviteEmails()) {
      const address = token.value.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(address)) {
        invalid.push(address);
        continue;
      }
      if (memberEmails.has(address)) {
        alreadyMember.push(address);
        continue;
      }
      if (invitedEmails.has(address)) {
        alreadyInvited.push(address);
        continue;
      }
      valid.push(address);
    }

    return { valid, invalid, alreadyMember, alreadyInvited };
  });

  /** State of the invite tokenizer, driven by the classification. */
  readonly inviteTokenState = computed(() => {
    if (this.inviteClassification().invalid.length > 0) return 'error' as const;
    if (this.inviteBounced().length > 0) return 'warning' as const;
    const { alreadyMember, alreadyInvited } = this.inviteClassification();
    if (alreadyMember.length + alreadyInvited.length > 0) {
      return 'warning' as const;
    }
    return 'default' as const;
  });

  /** Message under the invite tokenizer, driven by the classification. */
  readonly inviteTokenMessage = computed(() => {
    const { invalid, alreadyMember, alreadyInvited } =
      this.inviteClassification();
    if (invalid.length > 0) {
      return `${invalid.length} of these are not email addresses: ${invalid.join(', ')}.`;
    }
    const skipped = [...alreadyMember, ...alreadyInvited];
    if (skipped.length === 0) return '';
    const first = this.members().find(
      (member) => member.email.toLowerCase() === skipped[0],
    );
    return `${first?.name ?? skipped[0]} is already in the workspace and will be skipped.`;
  });

  /** Whether the invite dialog may submit. */
  readonly canInvite = computed(
    () =>
      !this.inviting() &&
      this.inviteClassification().invalid.length === 0 &&
      this.inviteClassification().valid.length > 0,
  );

  /** Label of the invite dialog's submit button. */
  readonly inviteSubmitLabel = computed(() => {
    const bounced = this.inviteBounced().length;
    if (bounced > 0)
      return `Retry ${plural(bounced, 'invitation', 'invitations')}`;
    const count = this.inviteClassification().valid.length;
    if (count <= 1) return 'Send invitation';
    return `Send ${count} invitations`;
  });

  /* ---------------------------------------------------------------------- */
  /* Step-up state                                                          */
  /* ---------------------------------------------------------------------- */

  /** @private What a verified code is allowed to do. */
  private readonly _stepUpKind = signal<AccessStepUpKind | null>(null);

  /** @private Key the pending step-up targets. */
  private readonly _stepUpKeyId = signal<string | null>(null);

  /** Heading of the step-up dialog. */
  readonly stepUpTitle = signal('Confirm it is you');

  /** Blast-radius sentence rendered above the pin field. */
  readonly stepUpMessage = signal('');

  /** Code typed into the step-up pin field. */
  readonly stepUpValue = signal('');

  /** Validation state of the step-up pin field. */
  readonly stepUpState = signal<'default' | 'error' | 'info'>('default');

  /** Message under the step-up pin field. */
  readonly stepUpHint = signal('');

  /** Wrong codes still allowed before the step-up locks out. */
  readonly stepUpAttempts = signal(STEP_UP_MAX_ATTEMPTS);

  /**
   * Hint that surfaces the accepted code on every step-up field. A showcase
   * visitor has no authenticator, so without this the confirmation flows are a
   * dead end. Reads the fixture constant so the two can never drift.
   */
  readonly stepUpDemoHint = `Demo code: ${STEP_UP_CODE}`;

  /** Whether the step-up is locked after too many wrong codes. */
  readonly lockedOut = signal(false);

  /** Seconds left on the lockout countdown. */
  readonly lockoutSeconds = signal(0);

  /** Whether a verified code is being applied. */
  readonly verifying = signal(false);

  /** Code typed into the two-factor blast-radius dialog. */
  readonly twoFactorValue = signal('');

  /** Whether the two-factor dialog's code has verified. */
  readonly twoFactorVerified = signal(false);

  /** Validation state of the two-factor dialog's pin field. */
  readonly twoFactorState = signal<'default' | 'error' | 'success'>('default');

  /** Message under the two-factor dialog's pin field. */
  readonly twoFactorMessage = signal('');

  /** Members with no second factor, listed by the blast-radius dialog. */
  readonly membersWithoutTwoFactor = computed(() =>
    this.members().filter((member) => !member.twoFactor),
  );

  /**
   * @private Value the two-factor switch shows for exactly one change-detection
   * pass after an intercepted flip, or `null` when the draft value is
   * authoritative. See {@link _reassertRequire2fa} for why this exists.
   */
  private readonly _require2faEcho = signal<boolean | null>(null);

  /**
   * Checked state the two-factor switch binds to (§4g step 2).
   *
   * Not `bool('sec.require2fa')` directly: a refused flip leaves the draft
   * value unchanged, and Angular skips a property binding whose value has not
   * changed — so the control would keep the state the browser's own click put
   * on it. The echo makes the bound value move `true → false → true`, which
   * re-asserts both the native `checked` property and `aria-checked`.
   */
  readonly require2faChecked = computed(
    () => this._require2faEcho() ?? this.bool('sec.require2fa'),
  );

  /* ---------------------------------------------------------------------- */
  /* Danger zone state                                                      */
  /* ---------------------------------------------------------------------- */

  /** Member chosen to receive ownership. */
  readonly transferTo = signal<string | null>(TRANSFER_TARGET_MEMBER_ID);

  /** Phrase typed into the transfer dialog. */
  readonly transferConfirm = signal('');

  /** Whether the transfer request is running. */
  readonly transferring = signal(false);

  /** Members ownership can be transferred to. */
  readonly transferCandidates = computed(() =>
    this.members().filter((member) => member.id !== this._ownerId()),
  );

  /** Ids of the members ownership can be transferred to. */
  readonly transferCandidateIds = computed(() =>
    this.transferCandidates().map((member) => member.id),
  );

  /** First acknowledgement in the delete dialog. */
  readonly deleteAck1 = signal(false);

  /** Second acknowledgement in the delete dialog. */
  readonly deleteAck2 = signal(false);

  /** Phrase typed into the delete dialog. */
  readonly deleteConfirm = signal('');

  /** Code typed into the delete dialog's step-up. */
  readonly deleteCode = signal('');

  /** Whether the delete dialog's step-up has verified. */
  readonly deleteVerified = signal(false);

  /** Validation state of the delete dialog's pin field. */
  readonly deleteCodeState = signal<'default' | 'error'>('default');

  /** Message under the delete dialog's pin field. */
  readonly deleteCodeMessage = signal('');

  /** Whether the workspace has been deleted; the terminal state. */
  readonly workspaceDeleted = signal(false);

  /** Whether the delete dialog's gates are all satisfied. */
  readonly deleteGatesPassed = computed(
    () =>
      this.deleteAck1() &&
      this.deleteAck2() &&
      this.deleteConfirm() === DELETE_CONFIRM_PHRASE,
  );

  /** Whether the transfer dialog may submit. */
  readonly canTransfer = computed(
    () =>
      !this.transferring() &&
      this.transferTo() !== null &&
      this.transferConfirm() === TRANSFER_CONFIRM_PHRASE,
  );

  /* ---------------------------------------------------------------------- */
  /* Sessions and keys                                                      */
  /* ---------------------------------------------------------------------- */

  /** Inline alert shown above the sessions list after a revoke. */
  readonly sessionAlert = signal<AccessSessionAlert | null>(null);

  /** @private Index each revoked session occupied, so Undo restores it. */
  private _revokedIndex = new Map<string, number>();

  /** @private Sessions removed optimistically, kept for Undo. */
  private _revokedSessions = new Map<string, AccessSession>();

  /** Secrets revealed exactly once after a rotation, keyed by key id. */
  readonly revealedSecrets = signal<Record<string, string>>({});

  /** Rotation errors, keyed by key id. */
  readonly keyErrors = signal<Record<string, string>>({});

  /* ---------------------------------------------------------------------- */
  /* Constructor                                                            */
  /* ---------------------------------------------------------------------- */

  constructor() {
    this._destroyRef.onDestroy(() => {
      if (this._savedHandle) clearTimeout(this._savedHandle);
      if (this._undoHandle) clearTimeout(this._undoHandle);
      if (this._lockoutHandle) clearInterval(this._lockoutHandle);
    });

    this._watchMedia('(max-width: 1279px)', this._tabletOrBelow);
    this._watchMedia('(max-width: 1023px)', this._belowAsideColumn);
    this._watchMedia('(max-width: 767px)', this.isNarrow);

    effect(() => {
      const narrow = this._tabletOrBelow();
      if (this._appliedNarrow === narrow) return;
      this._appliedNarrow = narrow;
      this.railCollapsed.set(narrow);
    });

    effect(() => {
      // `MlvSidebarGroup.expanded` is a plain writable signal, and the sidebar
      // holds it at `false` for as long as the rail is collapsed. The rail
      // starts collapsed until the media query resolves, so a one-shot
      // `afterNextRender` write lands too early, is discarded, and the nav
      // renders with zero rows — the group bodies are lazy, so the items never
      // enter the DOM at all. Open the groups the first time the rail is
      // genuinely expanded, and only once, so a manual collapse still sticks.
      const groups = this._navGroups();
      if (this._navGroupsOpened || this.railCollapsed() || !groups.length) {
        return;
      }
      this._navGroupsOpened = true;
      for (const group of groups) group.expanded.set(true);
    });
  }

  /** @private Whether the one-time nav-group expansion has been applied. */
  private _navGroupsOpened = false;

  /* ---------------------------------------------------------------------- */
  /* Section / tab navigation                                               */
  /* ---------------------------------------------------------------------- */

  /** Tabs of the section currently open. */
  readonly tabs = computed<readonly AccessTabDef[]>(
    () => SECTION_TABS[this.activeSection()],
  );

  /** Whether the current section renders a tab strip. */
  readonly hasTabs = computed(() => this.tabs().length > 0);

  /**
   * Breadcrumb trail for the section currently open.
   *
   * "Settings" and the group label are grouping ancestors, not disabled
   * destinations — this showcase has no route for either, so they carry no
   * `routerLink`/`href` and render as plain non-interactive crumbs. The last
   * entry is marked current by `MlvBreadcrumb` itself.
   */
  readonly breadcrumbs = computed<MlvBreadcrumbEntry[]>(() => {
    const section = this.activeSection();
    return [
      { label: 'Settings' },
      { label: SECTION_GROUP_LABEL[section] },
      { label: SECTION_LABEL[section] },
    ];
  });

  /** Heading of the section currently open. */
  readonly sectionTitle = computed(() => SECTION_LABEL[this.activeSection()]);

  /** Sentence under the heading of the section currently open. */
  readonly sectionDescription = computed(
    () => SECTION_DESCRIPTION[this.activeSection()],
  );

  /** Label of the summary strip for the section currently open. */
  readonly summaryLabel = computed(
    () => SECTION_SUMMARY_LABEL[this.activeSection()],
  );

  /**
   * Opens a settings section.
   *
   * Staged changes always survive the move; the guard is a heads-up shown at
   * most once per dirty streak, never a blocker and never a discard.
   */
  selectSection(sectionId: AccessSectionId): void {
    if (sectionId === this.activeSection()) return;

    const dirty = this.sectionStaged().length;
    if (dirty > 0 && !this._guardAcknowledged()) {
      const from = SECTION_LABEL[this.activeSection()];
      this._dialog
        .confirm({
          title: 'You have unsaved changes',
          message:
            dirty === 1
              ? `1 change in ${from} stays staged while you are away, but it is not live until you save it.`
              : `${dirty} changes in ${from} stay staged while you are away, but they are not live until you save them.`,
          confirmLabel: 'Continue',
          cancelLabel: 'Stay here',
          tone: 'warning',
          destructive: false,
          size: 's',
        })
        .subscribe((confirmed) => {
          if (!confirmed) return;
          this._guardAcknowledged.set(true);
          this._openSection(sectionId);
        });
      return;
    }

    this._openSection(sectionId);
  }

  /**
   * Opens a section from inside the aside's change list.
   *
   * The user is already acting on the change list, so the guard never fires.
   */
  goToSection(sectionId: AccessSectionId): void {
    this._guardAcknowledged.set(true);
    this._openSection(sectionId);
  }

  /** Opens a tab inside the current section and remembers the choice. */
  setActiveTab(value: string): void {
    const section = this.activeSection();
    this._tabBySection.update((map) => ({ ...map, [section]: value }));
    this._maybeLoadCollection(section, value);
  }

  /** Number of staged fields in a section, for the sidebar badge. */
  stagedCountFor(sectionId: AccessSectionId): number {
    return this.staged().filter((change) => change.sectionId === sectionId)
      .length;
  }

  /** Number of staged fields on a tab, for the tab strip badge. */
  stagedCountForTab(tabId: string): number {
    return this.sectionStaged().filter((change) => change.tabId === tabId)
      .length;
  }

  /** Badge shown on a sidebar row; staged counts win over resting badges. */
  badgeFor(item: AccessNavItem): string | null {
    const staged = this.stagedCountFor(item.id);
    if (staged > 0) return String(staged);
    return item.restingBadge;
  }

  /** Tone of a sidebar row's badge. */
  badgeToneFor(item: AccessNavItem): MlvBadgeTone {
    return this.stagedCountFor(item.id) > 0 ? 'warning' : item.restingTone;
  }

  /** Whether a sidebar row's badge pulses. */
  badgePulseFor(item: AccessNavItem): boolean {
    return this.stagedCountFor(item.id) > 0;
  }

  /* ---------------------------------------------------------------------- */
  /* Header status                                                          */
  /* ---------------------------------------------------------------------- */

  /** Label of the header status pill, first match wins. */
  readonly statusLabel = computed(() => {
    const state = this.dockState();
    if (state === 'saving') return 'Saving';
    const staged = this.sectionStaged().length;
    if (staged > 0) return `${staged} unsaved`;
    if (state === 'just-saved') return 'Saved';
    if (!this.isOwner() && this.activeSection() === 'danger')
      return 'Read only';
    return 'Up to date';
  });

  /** Tone of the header status pill. */
  readonly statusTone = computed<MlvBadgeTone>(() => {
    const state = this.dockState();
    if (state === 'saving') return 'info';
    if (this.sectionStaged().length > 0) return 'warning';
    if (state === 'just-saved') return 'success';
    if (!this.isOwner() && this.activeSection() === 'danger') return 'default';
    return 'success';
  });

  /* ---------------------------------------------------------------------- */
  /* Staging                                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Writes one field into the root draft.
   *
   * Values arrive from the controls as `unknown` because every control is
   * bound one-way plus a change handler — the page owns a single root draft
   * signal, so no control can two-way bind straight into it.
   */
  stage(id: string, raw: unknown): void {
    const field = this._fieldById.get(id);
    if (!field) return;
    const value = this._coerce(field.kind, raw);
    this._draft.update((draft) => ({ ...draft, [id]: value }));
    this._onEdit();
  }

  /** Writes a tokenizer's option list into the root draft as a value set. */
  stageTokens(id: string, tokens: readonly MlvSelectOption<string>[]): void {
    this.stage(
      id,
      tokens.map((token) => token.value),
    );
  }

  /** Turns a typed domain into a token, lower-cased and stripped of `@`. */
  readonly createDomainToken = (value: string): MlvSelectOption<string> => {
    const domain = value.trim().toLowerCase().replace(/^@/, '');
    return { label: domain, value: domain };
  };

  /** Turns a typed address into a token, lower-cased and trimmed. */
  readonly createEmailToken = (value: string): MlvSelectOption<string> => {
    const email = value.trim().toLowerCase();
    return { label: email, value: email };
  };

  /** Splits a pasted list on commas, semicolons and whitespace. */
  readonly splitTokens = (value: string): string[] =>
    value
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

  /** Reads one draft field as text, for `mlv-input`-style bindings. */
  text(id: string): string {
    return asText(this._draft()[id]);
  }

  /** Reads one draft field as a boolean, for switch and checkbox bindings. */
  bool(id: string): boolean {
    return asBool(this._draft()[id]);
  }

  /** Reads one drawer-buffer field as text. */
  drawerText(id: string): string {
    return asText(this._drawerDraft()[id]);
  }

  /** Reads one drawer-buffer field as a boolean. */
  drawerBool(id: string): boolean {
    return asBool(this._drawerDraft()[id]);
  }

  /** Applies the sign-in log filter from the segmented value. */
  setSignInFilter(value: unknown): void {
    if (value === 'failed' || value === 'new-device' || value === 'all') {
      this.signInFilter.set(value);
    }
  }

  /** Applies the invite dialog's role from the select's raw value. */
  setInviteRole(value: unknown): void {
    if (typeof value === 'string') this.inviteRole.set(value as AccessRoleId);
  }

  /** Applies the invite dialog's teams from the multi-select's raw value. */
  setInviteTeams(value: unknown): void {
    this.inviteTeams.set(Array.isArray(value) ? (value as AccessTeamId[]) : []);
  }

  /** Applies the transfer dialog's target from the select's raw value. */
  setTransferTo(value: unknown): void {
    this.transferTo.set(typeof value === 'string' && value ? value : null);
  }

  /** Whether one field currently differs from its saved value. */
  isDirty(id: string): boolean {
    return this.staged().some((change) => change.id === id);
  }

  /** Reverts one field to its saved value. */
  revertField(id: string): void {
    const baseline = this._baseline()[id];
    if (baseline === undefined) return;
    this._draft.update((draft) => ({ ...draft, [id]: baseline }));
    if (id === this._rejectedFieldId()) this._clearRejection();
    this._afterRevert();
  }

  /** Reverts every field in the current section, confirming beyond one. */
  revertSection(): void {
    const section = this.activeSection();
    const changes = this.sectionStaged();
    if (changes.length === 0) return;

    if (changes.length === 1) {
      this._applyRevert(
        changes.map((change) => change.id),
        section,
      );
      return;
    }

    this._dialog
      .confirm({
        title: `Revert ${plural(changes.length, 'change', 'changes')}?`,
        message: `Every unsaved change in ${SECTION_LABEL[section]} goes back to its saved value. Changes in other sections stay staged.`,
        confirmLabel: `Revert ${SECTION_LABEL[section]}`,
        cancelLabel: 'Keep editing',
        destructive: true,
        size: 's',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._applyRevert(
          changes.map((change) => change.id),
          section,
        );
      });
  }

  /** Reverts every field on the page, always confirming first. */
  revertAll(): void {
    const changes = this.staged();
    if (changes.length === 0) return;
    const sections = this.stagedSectionCount();

    this._dialog
      .confirm({
        title: 'Revert everything?',
        message: `${plural(changes.length, 'change', 'changes')} across ${plural(sections, 'section', 'sections')} go back to their saved values.`,
        confirmLabel: 'Revert everything',
        cancelLabel: 'Keep editing',
        destructive: true,
        size: 's',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._applyRevert(
          changes.map((change) => change.id),
          this.activeSection(),
        );
      });
  }

  /* ---------------------------------------------------------------------- */
  /* Validation                                                             */
  /* ---------------------------------------------------------------------- */

  /** Validation state of one field, driving `[state]` on its control. */
  fieldState(id: string): 'default' | 'error' | 'warning' | 'success' {
    const message = this.fieldMessage(id);
    if (!message) return 'default';
    return this._isWarningField(id) ? 'warning' : 'error';
  }

  /** Message under one field, driving `[message]` on its control. */
  fieldMessage(id: string): string {
    const draft = this._draft();

    switch (id) {
      case 'profile.fullName': {
        const value = asText(draft[id]).trim();
        if (value.length < 2) return 'Enter your name.';
        if (value.length > 60) return 'Keep this under 60 characters.';
        return '';
      }
      case 'profile.displayName':
        return asText(draft[id]).trim().length > 24
          ? 'Keep this under 24 characters.'
          : '';
      case 'profile.title':
        return asText(draft[id]).trim().length > 60
          ? 'Keep this under 60 characters.'
          : '';
      case 'profile.email': {
        const value = asText(draft[id]).trim();
        if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address.';
        if (!value.endsWith('@northwind.com')) {
          return 'Use an address on northwind.com.';
        }
        return '';
      }
      case 'profile.recoveryEmail': {
        const value = asText(draft[id]).trim();
        if (!value) return '';
        if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address.';
        if (
          value.toLowerCase() === asText(draft['profile.email']).toLowerCase()
        ) {
          return 'Use an address that is not your work email.';
        }
        return '';
      }
      case 'ws.name':
        return asText(draft[id]).trim().length < 2
          ? 'Enter a workspace name.'
          : '';
      case 'ws.slug': {
        if (this._rejectedFieldId() === id) return this._rejectedMessage();
        const value = asText(draft[id]).trim();
        if (!SLUG_PATTERN.test(value)) {
          return 'Use lower-case letters, numbers and hyphens.';
        }
        if (RESERVED_SLUGS.includes(value)) return 'That address is reserved.';
        return '';
      }
      case 'ws.billingEmail':
        return EMAIL_PATTERN.test(asText(draft[id]).trim())
          ? ''
          : 'Enter a valid email address.';
      case 'ws.supportUrl': {
        const value = asText(draft[id]).trim();
        if (!value) return '';
        return value.startsWith('https://') ? '' : 'Use an https:// address.';
      }
      case 'ws.autoJoinDomains':
        return asSet(draft[id]).every((entry) => DOMAIN_PATTERN.test(entry))
          ? ''
          : 'Enter a domain such as northwind.com.';
      case 'sec.allowedDomains': {
        const domains = asSet(draft[id]);
        if (domains.length === 0) {
          return 'With no domains listed, anyone invited can sign in.';
        }
        return domains.every((entry) => DOMAIN_PATTERN.test(entry))
          ? ''
          : 'Enter a domain such as northwind.com.';
      }
      case 'sec.alertRecipients': {
        const recipients = asSet(draft[id]);
        if (recipients.length === 0) return 'Name at least one recipient.';
        return recipients.every((entry) => EMAIL_PATTERN.test(entry))
          ? ''
          : 'Enter an email address.';
      }
      case 'notif.quietStart':
      case 'notif.quietEnd': {
        if (!asBool(draft['notif.quietHours'])) return '';
        return asText(draft['notif.quietStart']) ===
          asText(draft['notif.quietEnd'])
          ? 'Start and end cannot be the same time.'
          : '';
      }
      default:
        break;
    }

    if (id.startsWith('key.') && id.endsWith('.name')) {
      const value = asText(draft[id]).trim();
      if (value.length < 2 || value.length > 40) return 'Enter a key name.';
      return '';
    }

    if (id.startsWith('hook.') && id.endsWith('.url')) {
      const value = asText(draft[id]).trim();
      return value.startsWith('https://') ? '' : 'Use an https:// address.';
    }

    if (id.startsWith('hook.') && id.endsWith('.events')) {
      return asSet(draft[id]).length > 0 ? '' : 'Choose at least one event.';
    }

    return '';
  }

  /** Message shown against a key's scope group when it has none. */
  keyScopeMessage(keyId: string): string {
    const draft = this._draft();
    const granted = KEY_SCOPES.some((scope) =>
      asBool(draft[`key.${keyId}.scope.${scope.value}`]),
    );
    return granted ? '' : 'Give the key at least one scope.';
  }

  /** Field ids in the current section whose value is invalid. */
  readonly sectionErrors = computed(() => {
    const section = this.activeSection();
    const ids = this._fields
      .filter((field) => field.sectionId === section)
      .map((field) => field.id)
      .filter((id) => this.fieldState(id) === 'error');

    if (section === 'api') {
      for (const key of this.apiKeys()) {
        if (this.keyScopeMessage(key.id)) ids.push(`key.${key.id}.scope`);
      }
    }

    return ids;
  });

  /** Reason the dock's save button is disabled, or `''` when it is not. */
  readonly saveBlockedReason = computed(() => {
    const errors = this.sectionErrors();
    if (errors.length > 0) {
      const label = this._fieldById.get(errors[0])?.label ?? 'this field';
      return `Fix ${label} before saving.`;
    }
    const blocking = this.sectionStaged().find(
      (change) =>
        change.severity === 'blocking' && change.id.startsWith('member.'),
    );
    return blocking ? 'Northwind Labs would have no owner.' : '';
  });

  /* ---------------------------------------------------------------------- */
  /* Save                                                                   */
  /* ---------------------------------------------------------------------- */

  /** Saves the current section from `Cmd/Ctrl+S`. */
  onSaveShortcut(event: Event): void {
    event.preventDefault();
    void this.saveSection();
  }

  /** Applies every staged change in the current section. */
  async saveSection(): Promise<void> {
    const section = this.activeSection();
    const changes = this.sectionStaged();
    if (changes.length === 0 || this._dockState() === 'saving') return;

    if (this.sectionErrors().length > 0) {
      this._preflightBlocked.set(true);
      this._focusFirstError();
      return;
    }
    this._preflightBlocked.set(false);

    if (this.saveBlockedReason()) return;

    const pending = this.sectionStepUpChanges();
    if (pending.length > 0) {
      this._openStepUp(
        'save-section',
        null,
        `Confirm ${SECTION_LABEL[section]}`,
        pending[0].consequence ??
          'This change needs a confirmation code before it can be saved.',
      );
      return;
    }

    await this._applySection(section, changes);
  }

  /** Re-runs the save for whatever the last attempt could not apply. */
  async retrySave(): Promise<void> {
    await this.saveSection();
  }

  /** Reverts the field the server rejected and clears the failure state. */
  discardRejected(): void {
    const id = this._rejectedFieldId();
    if (!id) return;
    const label = this._fieldById.get(id)?.label ?? 'The field';
    this.revertField(id);
    this._clearRejection();
    this._dockState.set('clean');
    this._toast.info(`${label} discarded`, {
      description: `It is back to ${this._display(
        this._fieldById.get(id) as AccessFieldMeta,
        this._baseline()[id],
      )}.`,
      icon: true,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Roster                                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * Roster columns. The table owns search (driven by the sticky header's
   * `mlv-search-field` through `[(searchQuery)]`), sorting, the Role and
   * Two-factor filters, column visibility and paging — the roster keeps no
   * second copy of any of them.
   */
  readonly rosterColumns: MlvDataTableColumn<AccessRosterRow>[] = [
    {
      key: 'name',
      title: 'Member',
      sortable: true,
      searchable: true,
      resizable: true,
      width: '13rem',
      minWidth: '9rem',
    },
    {
      key: 'email',
      title: 'Email',
      sortable: true,
      searchable: true,
      hideable: true,
      resizable: true,
      width: '13rem',
      minWidth: '8rem',
      // Measured: with the change-review aside in flow the roster table is
      // 754px at a 1440px viewport and 1234px at 1920px, and the five columns
      // this one completes need ~889px because an address is one unbreakable
      // token. Below 900 the address would therefore cost the table a
      // horizontal scrollbar rather than a column, so it drops instead — it is
      // still one tap away in the member drawer, and because `searchable` is
      // read from the *declared* columns, search keeps matching it either way.
      responsive: { 0: 'hidden', 900: 'visible' },
    },
    {
      key: 'role',
      title: 'Role',
      sortable: true,
      searchable: true,
      filterable: true,
      filterConfig: {
        options: [...ROLE_OPTIONS],
        operators: ['equals', 'not-equals'],
      },
      width: '11rem',
      minWidth: '9.5rem',
    },
    {
      key: 'twoFactorState',
      title: 'Two-factor',
      sortable: true,
      filterable: true,
      filterConfig: {
        options: [
          { label: 'On', value: 'on' },
          { label: 'Off', value: 'off' },
        ],
        operators: ['equals'],
      },
      width: '7.5rem',
    },
    {
      key: 'lastActiveAt',
      title: 'Last active',
      sortable: true,
      hideable: true,
      align: 'right',
      width: '8.5rem',
      responsive: { 0: 'hidden', 1000: 'visible' },
    },
    {
      key: 'actions',
      title: 'Actions',
      align: 'right',
      width: '5rem',
      // Pinned so a user-resized column, or any width between two responsive
      // steps, can never push the row menu out of the table's scroll port.
      pinned: true,
      pinSide: 'right',
    },
  ];

  /**
   * Roster rows for the data table. Search, sort, filtering and paging all
   * belong to `mlv-data-table`; this only projects each member into the shape
   * those features read, with the staged role in place of the saved one.
   */
  readonly rosterRows = computed<AccessRosterRow[]>(() =>
    this.members().map((member) => ({
      ...member,
      role: this.roleOf(member.id),
      twoFactorState: member.twoFactor ? ('on' as const) : ('off' as const),
      actions: null,
    })),
  );

  /** Role currently staged for a member. */
  roleOf(memberId: string): AccessRoleId {
    return asText(this._draft()[`member.${memberId}.role`]) as AccessRoleId;
  }

  /** Whether a member's role is locked because they are the only owner. */
  isSoleOwner(memberId: string): boolean {
    return this.roleOf(memberId) === 'owner' && this.ownerCount() <= 1;
  }

  /** Stages a member's role unless it would leave the workspace ownerless. */
  stageMemberRole(memberId: string, raw: unknown): void {
    const next = typeof raw === 'string' ? raw : '';
    if (!next) return;
    if (this.isSoleOwner(memberId) && next !== 'owner') {
      this._toast.warning('Northwind Labs must always have one owner', {
        description: 'Transfer ownership from the Danger zone first.',
        icon: true,
      });
      return;
    }
    this.stage(`member.${memberId}.role`, next);
  }

  /** Relative "last active" text for a roster row. */
  lastActiveLabel(member: AccessMember): string {
    return relativeTime(member.lastActiveAt, this.now);
  }

  /** Clears the roster search box. */
  clearRosterSearch(): void {
    this.rosterQuery.set('');
  }

  /** Tone of an invitation's state badge. */
  invitationTone(state: string): MlvBadgeTone {
    return INVITATION_TONE[state] ?? 'default';
  }

  /** Label of an invitation's state badge. */
  invitationLabel(state: string): string {
    return INVITATION_LABEL[state] ?? state;
  }

  /** Relative "sent" text for an invitation row. */
  sentLabel(invitation: AccessInvitation): string {
    return relativeTime(invitation.sentAt, this.now);
  }

  /** Re-sends an invitation and confirms it with a toast. */
  resendInvitation(invitation: AccessInvitation): void {
    this._toast.info('Invitation re-sent', {
      description: `${invitation.email} has another 7 days to accept.`,
      icon: true,
    });
    this._logActivity(`Re-sent the invitation to ${invitation.email}`, 'info');
  }

  /** Revokes an invitation. */
  revokeInvitation(invitation: AccessInvitation): void {
    this.invitations.update((list) =>
      list.filter((entry) => entry.id !== invitation.id),
    );
    this._toast.info('Invitation revoked', {
      description: `${invitation.email} can no longer join.`,
      icon: true,
    });
    this._logActivity(
      `Revoked the invitation to ${invitation.email}`,
      'warning',
    );
  }

  /** Re-sends the welcome email for a member. */
  resendWelcome(member: AccessMember): void {
    this._toast.info('Welcome email sent', {
      description: `${member.name} will get it at ${member.email}.`,
      icon: true,
    });
  }

  /** Removes a member unless they are the only owner. */
  removeMember(member: AccessMember): void {
    if (this.isSoleOwner(member.id)) return;
    this._dialog
      .confirm({
        title: `Remove ${member.name}?`,
        message: `${member.name} loses access to Northwind Labs immediately. Their comments and history stay.`,
        confirmLabel: 'Remove',
        cancelLabel: 'Keep them',
        destructive: true,
        size: 's',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.members.update((list) =>
          list.filter((entry) => entry.id !== member.id),
        );
        this._toast.success(`${member.name} removed`, {
          description: 'They were signed out of every session.',
          icon: true,
        });
        this._logActivity(
          `Removed ${member.name} from the workspace`,
          'warning',
        );
      });
  }

  /* ---------------------------------------------------------------------- */
  /* Invite flow                                                            */
  /* ---------------------------------------------------------------------- */

  /** Opens the invite dialog with the workspace default role pre-picked. */
  openInvite(): void {
    this.inviteEmails.set([]);
    this.inviteRole.set(
      asText(this._draft()['ws.defaultRole']) as AccessRoleId,
    );
    this.inviteTeams.set([]);
    this.inviteSendWelcome.set(true);
    this.inviteMessage.set('');
    this.inviteBounced.set([]);
    this.inviteOpen.set(true);
  }

  /** Clears the invite draft once the dialog has closed. */
  onInviteClosed(): void {
    if (this.inviting()) return;
    this.inviteEmails.set([]);
    this.inviteBounced.set([]);
  }

  /** Sends every valid address, optimistically and one at a time. */
  async sendInvitations(): Promise<void> {
    if (!this.canInvite()) return;
    const addresses = this.inviteClassification().valid;
    const role = this.inviteRole();

    this.inviting.set(true);
    const created = addresses.map((email, index) => ({
      id: `inv-new-${Date.now()}-${index}`,
      email,
      role,
      state: 'sending' as const,
      sentAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      invitedBy: CURRENT_USER.name,
      bounceReason: null,
    }));
    this.invitations.update((list) => [...created, ...list]);

    const bounced: string[] = [];
    for (const entry of created) {
      const willBounce = BOUNCED_INVITE_EMAILS.includes(entry.email);
      const result = await runShowcaseOperation(() => entry.email, {
        fail: willBounce,
        delay: SLOW_DELAY,
      });
      const state = result.ok ? 'pending' : 'bounced';
      if (!result.ok) bounced.push(entry.email);
      this.invitations.update((list) =>
        list.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                state,
                bounceReason: result.ok
                  ? null
                  : 'The mail server said the mailbox does not exist.',
              }
            : item,
        ),
      );
    }

    this.inviting.set(false);
    const sent = addresses.length - bounced.length;

    if (bounced.length === 0) {
      this.inviteOpen.set(false);
      this.inviteEmails.set([]);
      this._toast.success(`${plural(sent, 'invitation', 'invitations')} sent`, {
        description: 'They expire in 7 days.',
        icon: true,
      });
      this._logActivity(`Invited ${plural(sent, 'person', 'people')}`, 'info');
      return;
    }

    this.inviteBounced.set(bounced);
    this.inviteEmails.set(
      bounced.map((email) => ({ label: email, value: email })),
    );
    this._toast.warning(`${sent} of ${addresses.length} invitations sent`, {
      description: `${plural(bounced.length, 'address', 'addresses')} bounced.`,
      icon: true,
    });
    this._logActivity(
      `Invited ${plural(sent, 'person', 'people')}, ${bounced.length} bounced`,
      'warning',
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Member access drawer                                                   */
  /* ---------------------------------------------------------------------- */

  /** Opens the member access drawer over a local copy of the draft. */
  openMemberDrawer(memberId: string): void {
    const draft = this._draft();
    const local: Record<string, AccessDraftValue> = {};
    for (const fieldId of this._memberFieldIds(memberId)) {
      const value = draft[fieldId];
      if (value !== undefined) local[fieldId] = value;
    }
    this._drawerDraft.set(local);
    this.activeMemberId.set(memberId);
    this.memberDrawerOpen.set(true);
  }

  /** Writes one field into the drawer's local buffer. */
  stageDrawer(id: string, raw: unknown): void {
    const field = this._fieldById.get(id);
    if (!field) return;
    this._drawerDraft.update((local) => ({
      ...local,
      [id]: this._coerce(field.kind, raw),
    }));
  }

  /** Stages the drawer's role unless it would leave no owner behind. */
  stageDrawerRole(memberId: string, raw: unknown): void {
    if (this.isSoleOwner(memberId)) return;
    this.stageDrawer(`member.${memberId}.role`, raw);
  }

  /** Grants or revokes every project in the drawer at once. */
  toggleAllProjects(granted: boolean): void {
    const id = this.activeMemberId();
    if (!id) return;
    this._drawerDraft.update((local) => {
      const next = { ...local };
      for (const project of PROJECTS) {
        if (this._isProjectLocked(id, project.id)) continue;
        next[`member.${id}.project.${project.id}`] = granted;
      }
      return next;
    });
  }

  /** Whether a project grant cannot be revoked because a team supplies it. */
  isProjectLocked(projectId: AccessProjectId): boolean {
    const memberId = this.activeMemberId();
    return memberId ? this._isProjectLocked(memberId, projectId) : false;
  }

  /** Sessions belonging to the member the drawer is showing. */
  readonly drawerSessions = computed(() => {
    const id = this.activeMemberId();
    if (!id) return [] as readonly AccessSession[];
    return this.sessions().filter((session) => session.memberId === id);
  });

  /** Moves the drawer's local edits into the page draft and closes it. */
  commitDrawer(): void {
    const id = this.activeMemberId();
    const count = this.drawerStagedCount();
    if (!id || count === 0) return;

    const local = this._drawerDraft();
    this._draft.update((draft) => ({ ...draft, ...local }));
    this._onEdit();
    this.memberDrawerOpen.set(false);

    const name = this.activeMember()?.name ?? 'this member';
    this._toast.info(
      `${plural(count, 'change', 'changes')} staged for ${name}`,
      {
        description: 'Save them from the Members & roles dock.',
        icon: true,
      },
    );
  }

  /** Discards the drawer's local edits, confirming when there are any. */
  cancelDrawer(): void {
    const count = this.drawerStagedCount();
    if (count === 0) {
      this.memberDrawerOpen.set(false);
      return;
    }

    const name = this.activeMember()?.name ?? 'this member';
    this._dialog
      .confirm({
        title: 'Discard these edits?',
        message: `${plural(count, 'edit', 'edits')} to ${name} have not been staged yet.`,
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        destructive: true,
        size: 's',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._drawerDraft.set({});
        this.memberDrawerOpen.set(false);
      });
  }

  /* ---------------------------------------------------------------------- */
  /* Sessions                                                               */
  /* ---------------------------------------------------------------------- */

  /** Sessions that are not the one rendering the page. */
  readonly otherSessions = computed(() =>
    this.sessions().filter((session) => !session.isCurrent),
  );

  /** Human name of a session, used by the revoke button's label. */
  sessionName(session: AccessSession): string {
    return `${session.browser} on ${session.device} · ${session.location}`;
  }

  /** Relative "started" text for a session row. */
  startedLabel(session: AccessSession): string {
    return relativeTime(session.startedAt, this.now);
  }

  /** Relative "last active" text for a session row. */
  sessionActiveLabel(session: AccessSession): string {
    return relativeTime(session.lastActiveAt, this.now);
  }

  /** Signs out one session, optimistically, with an inline undo. */
  async revokeSession(session: AccessSession): Promise<void> {
    if (session.isCurrent) return;

    const index = this.sessions().findIndex((item) => item.id === session.id);
    this._revokedIndex.set(session.id, index);
    this._revokedSessions.set(session.id, session);
    this.sessions.update((list) =>
      list.filter((item) => item.id !== session.id),
    );

    this._showSessionAlert({
      tone: 'info',
      text: `Signed out ${session.browser} on ${session.device} · ${session.location}.`,
      sessionId: session.id,
    });
    this._toast.info('Session signed out', {
      description: `${session.browser} on ${session.device} · ${session.location} · last active ${this.sessionActiveLabel(session)}.`,
      icon: true,
    });

    const result = await runShowcaseOperation(() => session.id, {
      fail: session.revokeFails,
      delay: SLOW_DELAY,
    });

    if (result.ok) {
      this._logActivity(`Signed out ${this.sessionName(session)}`, 'default');
      return;
    }

    this._restoreSession(session.id);
    this._showSessionAlert({
      tone: 'danger',
      text: 'That session could not be signed out. It may already have expired.',
      sessionId: null,
    });
    this._toast.error('Could not sign out that session', {
      description: 'Try again in a moment.',
      icon: true,
    });
  }

  /** Puts a revoked session back where it was. */
  undoRevoke(): void {
    const alert = this.sessionAlert();
    if (!alert?.sessionId) return;
    this._restoreSession(alert.sessionId);
    this.dismissSessionAlert();
    this._toast.success('Session restored', { icon: true });
  }

  /** Clears the sessions alert and its self-clear timer. */
  dismissSessionAlert(): void {
    if (this._undoHandle) {
      clearTimeout(this._undoHandle);
      this._undoHandle = null;
    }
    this.sessionAlert.set(null);
  }

  /** Signs out every session except the one rendering the page. */
  signOutEverywhere(): void {
    const others = this.otherSessions();
    if (others.length === 0) return;

    this._dialog
      .confirm({
        title: 'Sign out every other session?',
        message: `${plural(others.length, 'session', 'sessions')} end immediately. Your current session on this device is kept.`,
        confirmLabel: 'Sign them out',
        cancelLabel: 'Cancel',
        destructive: true,
        size: 's',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.sessions.update((list) => list.filter((item) => item.isCurrent));
        this._toast.success(
          `${plural(others.length, 'session', 'sessions')} signed out`,
          {
            description: 'Your current session on this device was kept.',
            icon: true,
          },
        );
        this._logActivity(
          `Signed out ${plural(others.length, 'session', 'sessions')}`,
          'warning',
        );
      });
  }

  /* ---------------------------------------------------------------------- */
  /* Sign-in log                                                            */
  /* ---------------------------------------------------------------------- */

  /** Sign-in log entries after the segmented filter. */
  readonly visibleSignInEvents = computed(() => {
    const filter = this.signInFilter();
    if (filter === 'all') return SIGN_IN_EVENTS;
    const kind: AccessSignInEventKind =
      filter === 'failed' ? 'failed' : 'new-device';
    return SIGN_IN_EVENTS.filter((event) => event.kind === kind);
  });

  /** Relative timestamp for a log entry. */
  eventTime(at: number): string {
    return relativeTime(at, this.now);
  }

  /* ---------------------------------------------------------------------- */
  /* API keys and webhooks                                                  */
  /* ---------------------------------------------------------------------- */

  /** Whether a key is past its rotation date. */
  isKeyOverdue(key: AccessApiKey): boolean {
    return key.rotationDueAt < this.now;
  }

  /** Relative "last used" text for a key card. */
  keyUsedLabel(key: AccessApiKey): string {
    return relativeTime(key.lastUsedAt, this.now);
  }

  /** Calls served by a key in the last seven days, grouped. */
  keyCalls(key: AccessApiKey): string {
    return formatNumber(key.calls7d);
  }

  /** Opens the step-up that guards a key rotation. */
  requestRotate(key: AccessApiKey): void {
    this._openStepUp(
      'rotate-key',
      key.id,
      `Rotate ${key.name}`,
      `Rotating ${key.name} invalidates the current secret. ${plural(key.integrationCount, 'integration uses', 'integrations use')} it and will fail until they are updated.`,
    );
  }

  /** Opens the step-up that guards a key deletion. */
  requestDeleteKey(key: AccessApiKey): void {
    this._openStepUp(
      'delete-key',
      key.id,
      `Delete ${key.name}`,
      'Requests using this key start failing straight away. This cannot be undone.',
    );
  }

  /** Meta line under a webhook row. */
  webhookMeta(hook: AccessWebhook): string {
    return `${hook.deliveries7d} deliveries · ${hook.failures7d} failures · last 7 days`;
  }

  /* ---------------------------------------------------------------------- */
  /* Step-up                                                                */
  /* ---------------------------------------------------------------------- */

  /** Verifies a step-up code and runs the pending action when it matches. */
  async verifyStepUp(code: string): Promise<void> {
    if (this.lockedOut() || this.verifying()) return;

    if (code !== STEP_UP_CODE) {
      const left = this.stepUpAttempts() - 1;
      this.stepUpAttempts.set(left);
      this.stepUpValue.set('');
      this.stepUpState.set('error');
      if (left <= 0) {
        this.stepUpHint.set('Too many wrong codes.');
        this._startLockout();
        return;
      }
      this.stepUpHint.set(
        `That code is not right. ${plural(left, 'attempt', 'attempts')} left.`,
      );
      return;
    }

    this.verifying.set(true);
    const kind = this._stepUpKind();
    const keyId = this._stepUpKeyId();
    this.stepUpOpen.set(false);
    this.verifying.set(false);
    this._resetStepUp();

    if (kind === 'rotate-key' && keyId) {
      await this._rotateKey(keyId);
      return;
    }
    if (kind === 'delete-key' && keyId) {
      this._deleteKey(keyId);
      return;
    }
    if (kind === 'save-section') {
      const section = this.activeSection();
      await this._applySection(section, this.sectionStaged());
    }
  }

  /** Explains that recovery codes are not part of the demo. */
  useRecoveryCode(): void {
    this.stepUpState.set('info');
    this.stepUpHint.set('Recovery codes are not available in this demo.');
  }

  /** Cancels a step-up, leaving anything it guarded untouched. */
  cancelStepUp(): void {
    this.stepUpOpen.set(false);
    this._resetStepUp();
  }

  /* ---------------------------------------------------------------------- */
  /* Two-factor blast radius                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Intercepts the two-factor switch.
   *
   * `mlv-switch` is `[(checked)]` two-way, which would write the draft the
   * moment the thumb moves — so this one field is bound one-way through
   * {@link require2faChecked} with a change handler, and only lowering it opens
   * the blast-radius dialog.
   */
  onRequire2faChange(next: boolean): void {
    if (next) {
      this.stage('sec.require2fa', true);
      return;
    }
    this.twoFactorValue.set('');
    this.twoFactorVerified.set(false);
    this.twoFactorState.set('default');
    this.twoFactorMessage.set('');
    this.twoFactorOpen.set(true);
    this._reassertRequire2fa(next);
  }

  /**
   * @private Puts the two-factor switch back to the draft value after a
   * refused flip (§4g step 2).
   *
   * The switch has already moved its own `checked` model and the browser has
   * already moved the native input, while the draft value is unchanged — so
   * Angular's dirty check would skip the `[checked]` binding and the control
   * would keep reading "off" for the whole life of the dialog, and after a
   * cancel. Echoing the switch's own value for one pass and clearing it on the
   * next render forces the binding through two distinct values, so both the
   * native property and `aria-checked` are written back.
   */
  private _reassertRequire2fa(shown: boolean): void {
    this._require2faEcho.set(shown);
    afterNextRender(() => this._require2faEcho.set(null), {
      injector: this._injector,
    });
  }

  /** Checks the blast-radius dialog's code without applying anything yet. */
  verifyTwoFactorCode(code: string): void {
    if (code === STEP_UP_CODE) {
      this.twoFactorVerified.set(true);
      this.twoFactorState.set('success');
      this.twoFactorMessage.set('Code confirmed.');
      return;
    }
    this.twoFactorVerified.set(false);
    this.twoFactorValue.set('');
    this.twoFactorState.set('error');
    this.twoFactorMessage.set('That code is not right.');
  }

  /** Stages the two-factor requirement for removal; it is not saved yet. */
  confirmTwoFactorOff(): void {
    if (!this.twoFactorVerified()) return;
    this.twoFactorOpen.set(false);
    this.stage('sec.require2fa', false);
    this._toast.warning('Two-factor requirement staged for removal', {
      description: 'It is not live until you save Security.',
      icon: true,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Danger zone                                                            */
  /* ---------------------------------------------------------------------- */

  /** Opens the transfer-ownership dialog with its gates reset. */
  openTransfer(): void {
    if (!this.isOwner()) return;
    this.transferTo.set(TRANSFER_TARGET_MEMBER_ID);
    this.transferConfirm.set('');
    this.transferOpen.set(true);
  }

  /** Resolves a member id to their display name, for select labels. */
  readonly memberToOption = (id: string): MlvSelectOption<string> => {
    const member = MEMBERS.find((entry) => entry.id === id);
    return { label: member?.name ?? id, value: id };
  };

  /** Moves ownership to the chosen member and demotes the current owner. */
  async transferOwnership(): Promise<void> {
    if (!this.canTransfer()) return;
    const targetId = this.transferTo();
    if (!targetId) return;

    this.transferring.set(true);
    const result = await runShowcaseOperation(() => targetId, {
      delay: SLOW_DELAY,
    });
    this.transferring.set(false);
    if (!result.ok) return;

    const previousOwnerId = this._ownerId();
    this.members.update((list) =>
      list.map((member) => {
        if (member.id === targetId)
          return { ...member, role: 'owner' as const };
        if (member.id === previousOwnerId) {
          return { ...member, role: 'admin' as const };
        }
        return member;
      }),
    );
    this._draft.update((draft) => ({
      ...draft,
      [`member.${targetId}.role`]: 'owner',
      [`member.${previousOwnerId}.role`]: 'admin',
    }));
    this._baseline.update((baseline) => ({
      ...baseline,
      [`member.${targetId}.role`]: 'owner',
      [`member.${previousOwnerId}.role`]: 'admin',
    }));

    const name = this.members().find((member) => member.id === targetId)?.name;
    this.transferOpen.set(false);
    this.viewAsAdmin.set(true);
    this._toast.success(`${name} is now the owner`, {
      description: 'You are an admin of Northwind Labs.',
      icon: true,
    });
    this._logActivity(`Transferred ownership to ${name}`, 'warning');
  }

  /** Opens the delete-workspace dialog with every gate reset. */
  openDelete(): void {
    if (!this.isOwner()) return;
    this._resetDeleteGates();
    this.deleteOpen.set(true);
  }

  /** Clears every gate once the delete dialog closes. */
  onDeleteClosed(): void {
    this._resetDeleteGates();
  }

  /** Checks the delete dialog's confirmation code. */
  verifyDeleteCode(code: string): void {
    if (code === STEP_UP_CODE) {
      this.deleteVerified.set(true);
      this.deleteCodeState.set('default');
      this.deleteCodeMessage.set('');
      return;
    }
    this.deleteVerified.set(false);
    this.deleteCode.set('');
    this.deleteCodeState.set('error');
    this.deleteCodeMessage.set('That code is not right.');
  }

  /** Deletes the workspace and swaps the page to its terminal state. */
  async deleteWorkspace(): Promise<void> {
    if (!this.deleteGatesPassed() || !this.deleteVerified()) return;
    const result = await runShowcaseOperation(() => true, {
      delay: SLOW_DELAY,
    });
    if (!result.ok) return;

    this.deleteOpen.set(false);
    this.workspaceDeleted.set(true);
    this._toast.error('Northwind Labs deleted', {
      description: `${plural(this.memberCount(), 'member was', 'members were')} signed out.`,
      icon: true,
      displayTime: 8000,
    });
  }

  /** Exports the archive and leaves the workspace. */
  exportAndLeave(): void {
    if (!this.isOwner()) return;
    this._dialog
      .confirm({
        title: 'Export and leave?',
        message:
          'We build the archive and email you a download link, then remove your access. Ownership must be transferred first.',
        confirmLabel: 'Start the export',
        cancelLabel: 'Cancel',
        destructive: true,
        size: 's',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this._toast.info('Export started', {
          description: 'We will email a download link when it is ready.',
          icon: true,
        });
      });
  }

  /** Puts every fixture back and returns to the Profile section. */
  resetShowcase(): void {
    this.members.set(MEMBERS);
    this.invitations.set(INVITATIONS);
    this.sessions.set(SESSIONS);
    this.apiKeys.set(API_KEYS);
    this.webhooks.set(WEBHOOKS);
    this.activity.set(ACTIVITY_SEED);
    this._baseline.set(this._buildBaseline());
    this._draft.set(this._buildBaseline());
    this.workspaceDeleted.set(false);
    this.viewAsAdmin.set(false);
    this.activeSection.set('profile');
    this._dockState.set('clean');
    this._clearRejection();
  }

  /* ---------------------------------------------------------------------- */
  /* Collections                                                            */
  /* ---------------------------------------------------------------------- */

  /** Whether a tab's collection is still showing its first-load skeleton. */
  isCollectionLoading(key: string): boolean {
    return this._loadingCollection() === key;
  }

  /* ---------------------------------------------------------------------- */
  /* Summary strip                                                          */
  /* ---------------------------------------------------------------------- */

  /** Channels currently switched on, out of three. */
  readonly channelsOnLabel = computed(() => {
    const draft = this._draft();
    const on = NOTIFICATION_CHANNELS.filter((channel) =>
      asBool(draft[`notif.channel.${channel.id}`]),
    ).length;
    return `${on} of ${NOTIFICATION_CHANNELS.length}`;
  });

  /** Event types that are emailed, out of six. */
  readonly subscribedEventsLabel = computed(() => {
    const draft = this._draft();
    const on = NOTIFICATION_EVENTS.filter((event) =>
      asBool(draft[`notif.sub.${event.id}.email`]),
    ).length;
    return `${on} of ${NOTIFICATION_EVENTS.length}`;
  });

  /** Quiet-hours window, as a range. */
  readonly quietHoursLabel = computed(() => {
    const draft = this._draft();
    if (!asBool(draft['notif.quietHours'])) return 'Off';
    return `${asText(draft['notif.quietStart'])} – ${asText(draft['notif.quietEnd'])}`;
  });

  /** Weekly digest schedule. */
  readonly digestLabel = computed(() => {
    const draft = this._draft();
    if (!asBool(draft['notif.digest'])) return 'Off';
    const day = this.weekdaySet.labelOf(asText(draft['notif.digestDay']));
    return `${day}, ${asText(draft['notif.digestTime'])}`;
  });

  /** Public address of the workspace, from the staged slug. */
  readonly addressLabel = computed(
    () => `${asText(this._draft()['ws.slug'])}.malva.app`,
  );

  /** Seat use, as `12 of 25 seats`. */
  readonly seatsLabel = computed(
    () => `${this.memberCount()} of ${WORKSPACE.seats} seats`,
  );

  /** Invitation counts, as `3 waiting, 1 bounced`. */
  readonly invitationsLabel = computed(() => {
    const waiting = this.invitations().filter(
      (entry) => entry.state !== 'bounced',
    ).length;
    return `${waiting} waiting, ${this.bouncedInvitationCount()} bounced`;
  });

  /** Two-factor posture, from the staged policy. */
  readonly twoFactorLabel = computed(() => {
    if (asBool(this._draft()['sec.require2fa'])) return 'Enforced';
    return `Not enforced · ${plural(this.without2faCount(), 'member', 'members')} without`;
  });

  /** Webhook counts, as `3 · 1 paused`. */
  readonly webhookLabel = computed(
    () => `${this.webhooks().length} · ${this.pausedWebhookCount()} paused`,
  );

  /** API calls served in the last seven days, grouped. */
  readonly apiCallsLabel = computed(() => formatNumber(WORKSPACE.apiCalls7d));

  /** Name of the member who currently owns the workspace. */
  readonly ownerName = computed(
    () =>
      this.members().find((member) => member.id === this._ownerId())?.name ??
      CURRENT_USER.name,
  );

  /* ---------------------------------------------------------------------- */
  /* Consequences                                                           */
  /* ---------------------------------------------------------------------- */

  /**
   * Resolves the human consequence of one staged field.
   *
   * Pure: every count is read from the live fixtures rather than written into
   * the template, and fields with no consequence return `null`.
   */
  consequenceFor(
    id: string,
    oldValue: AccessDraftValue,
    newValue: AccessDraftValue,
  ): string | null {
    const draft = this._draft();

    switch (id) {
      case 'profile.email':
        return `Sends a confirmation link to ${asText(newValue)} before it takes effect.`;
      case 'profile.showLocalTime':
        return newValue === true
          ? `Shows your local time to ${plural(this.memberCount() - 1, 'teammate', 'teammates')}.`
          : null;
      case 'prefs.timezone':
        return `Re-times ${plural(CURRENT_USER.scheduledDigestCount, 'scheduled digest', 'scheduled digests')} and your quiet hours.`;
      case 'notif.quietStart':
      case 'notif.quietEnd':
        return `Holds notifications for ${plural(
          hoursBetween(
            asText(draft['notif.quietStart']),
            asText(draft['notif.quietEnd']),
          ),
          'hour',
          'hours',
        )} each night.`;
      case 'notif.digestDay':
      case 'notif.digestTime':
        return `Moves the weekly digest to ${this.weekdaySet.labelOf(
          asText(draft['notif.digestDay']),
        )}, ${asText(draft['notif.digestTime'])} ${asText(draft['prefs.timezone'])}.`;
      case 'ws.name':
        return `Renames the workspace for all ${plural(this.memberCount(), 'member', 'members')}.`;
      case 'ws.slug':
        return `Breaks ${plural(WORKSPACE.savedLinkCount, 'saved link', 'saved links')} to ${asText(oldValue)}.malva.app.`;
      case 'ws.billingEmail':
        return `Moves invoices to ${asText(newValue)} from the next billing cycle.`;
      case 'ws.autoJoinDomains': {
        const added = this._added(oldValue, newValue);
        if (added.length > 0) {
          return `Lets anyone with a ${joinList(added)} address join without an invitation.`;
        }
        const removed = this._added(newValue, oldValue);
        return removed.length > 0
          ? `Stops self-service joining for ${joinList(removed)}.`
          : null;
      }
      case 'ws.invitePolicy': {
        const before = INVITE_POLICY_ORDER.indexOf(asText(oldValue));
        const after = INVITE_POLICY_ORDER.indexOf(asText(newValue));
        const oldAllowed = this._invitersUnder(asText(oldValue));
        const newAllowed = this._invitersUnder(asText(newValue));
        if (after > before) {
          return `Removes invite rights from ${plural(oldAllowed - newAllowed, 'member', 'members')}.`;
        }
        return `Gives invite rights to ${plural(newAllowed - oldAllowed, 'more member', 'more members')}.`;
      }
      case 'ws.defaultRole':
        return `Affects ${plural(this.defaultRoleCount(), 'member', 'members')} with no explicit role.`;
      case 'ws.requireApproval':
        return newValue === false
          ? 'Join requests are accepted without review.'
          : null;
      case 'roles.selfService':
        return newValue === true
          ? `Lets ${plural(this.selfServiceEligible(), 'member', 'members')} change their own role.`
          : null;
      case 'sec.require2fa':
        return newValue === false
          ? `Removes the two-factor requirement for all ${plural(this.memberCount(), 'member', 'members')}.`
          : `${plural(this.without2faCount(), 'member', 'members')} would be locked out until they enrol.`;
      case 'sec.enforceSso':
        return newValue === true
          ? `${plural(this.passwordOnlyCount(), 'member signs', 'members sign')} in with a password only and would lose access.`
          : null;
      case 'sec.passwordPolicy': {
        const before = PASSWORD_POLICY_ORDER.indexOf(asText(oldValue));
        const after = PASSWORD_POLICY_ORDER.indexOf(asText(newValue));
        return after > before
          ? `Forces a password reset for ${plural(this.weakPasswordCount(), 'member', 'members')} at their next sign-in.`
          : null;
      }
      case 'sec.sessionLifetime': {
        const before = LIFETIME_HOURS[asText(oldValue)] ?? 0;
        const after = LIFETIME_HOURS[asText(newValue)] ?? 0;
        if (after < before) {
          return `Signs out ${plural(this._staleSessions(after), 'session', 'sessions')} older than ${asText(newValue)} on save.`;
        }
        return `Sessions stay signed in for ${asText(newValue)} instead of ${asText(oldValue)}.`;
      }
      case 'sec.allowedDomains': {
        const domains = asSet(newValue);
        if (domains.length === 0) return 'Any invited address can sign in.';
        const outside = this.members().filter(
          (member) =>
            !domains.some((domain) => member.email.endsWith(`@${domain}`)),
        ).length;
        return `Blocks sign-in for ${plural(outside, 'member', 'members')} outside ${joinList([...domains])}.`;
      }
      case 'sec.alertRecipients':
        return `Security alerts go to ${plural(asSet(newValue).length, 'address', 'addresses')}.`;
      case 'sec.signOutOnPasswordChange':
        return newValue === false
          ? 'A password change no longer ends other sessions.'
          : null;
      default:
        break;
    }

    if (id.startsWith('key.')) return this._keyConsequence(id, newValue);
    if (id.startsWith('hook.'))
      return this._hookConsequence(id, oldValue, newValue);
    if (id.startsWith('member.')) {
      return this._memberConsequence(id, oldValue, newValue);
    }
    if (id.startsWith('notif.channel.')) {
      if (newValue !== false) return null;
      const channel = id.slice('notif.channel.'.length) as AccessChannelId;
      const count = NOTIFICATION_EVENTS.filter((event) =>
        asBool(draft[`notif.sub.${event.id}.${channel}`]),
      ).length;
      return `Turns off ${CHANNEL_LABEL[channel]} for ${plural(count, 'subscribed event type', 'subscribed event types')}.`;
    }

    return null;
  }

  /* ---------------------------------------------------------------------- */
  /* Subscription helpers                                                   */
  /* ---------------------------------------------------------------------- */

  /** Whether every channel of one notification event is subscribed. */
  allChannelsOn(eventId: string): boolean {
    const draft = this._draft();
    return NOTIFICATION_CHANNELS.every(
      (channel) =>
        !channel.available ||
        asBool(draft[`notif.sub.${eventId}.${channel.id}`]),
    );
  }

  /** Whether one notification event has a partial channel selection. */
  someChannelsOn(eventId: string): boolean {
    const draft = this._draft();
    const available = NOTIFICATION_CHANNELS.filter(
      (channel) => channel.available,
    );
    const on = available.filter((channel) =>
      asBool(draft[`notif.sub.${eventId}.${channel.id}`]),
    ).length;
    return on > 0 && on < available.length;
  }

  /** Turns every available channel of one event on or off at once. */
  toggleAllChannels(eventId: string, next: boolean): void {
    this._draft.update((draft) => {
      const updated = { ...draft };
      for (const channel of NOTIFICATION_CHANNELS) {
        if (!channel.available) continue;
        updated[`notif.sub.${eventId}.${channel.id}`] = next;
      }
      return updated;
    });
    this._onEdit();
  }

  /* ---------------------------------------------------------------------- */
  /* Internals                                                              */
  /* ---------------------------------------------------------------------- */

  /** @private Builds the field registry once, in sidebar order. */
  private _buildFields(): readonly AccessFieldMeta[] {
    const pronoun = optionSet(PRONOUNS);
    const language = optionSet(LANGUAGES);
    const timeZone = optionSet(TIME_ZONES);
    const dateFormat = optionSet(DATE_FORMATS);
    const weekStart = optionSet(WEEK_STARTS);
    const theme = optionSet(THEMES);
    const density = optionSet(DENSITIES);
    const landing = optionSet(LANDING_PAGES);
    const weekday = optionSet(WEEKDAYS);
    const invitePolicy = optionSet(INVITE_POLICIES);
    const passwordPolicy = optionSet(PASSWORD_POLICIES);
    const lifetime = optionSet(SESSION_LIFETIMES);
    const expiry = optionSet(KEY_EXPIRIES);
    const events = optionSet(WEBHOOK_EVENTS);
    const role = optionSet(ROLE_OPTIONS);
    const team = optionSet(TEAM_OPTIONS);

    const fields: AccessFieldMeta[] = [
      f('profile.fullName', 'profile', null, 'Full name', 'text'),
      f('profile.displayName', 'profile', null, 'Display name', 'text'),
      f('profile.title', 'profile', null, 'Job title', 'text'),
      f(
        'profile.pronouns',
        'profile',
        null,
        'Pronouns',
        'option',
        pronoun.labelOf,
      ),
      f('profile.email', 'profile', null, 'Work email', 'text'),
      f('profile.recoveryEmail', 'profile', null, 'Recovery email', 'text'),
      f(
        'profile.showLocalTime',
        'profile',
        null,
        'Show my local time to teammates',
        'bool',
      ),
      f('profile.bio', 'profile', null, 'Bio', 'text'),

      f(
        'prefs.language',
        'preferences',
        null,
        'Language',
        'option',
        language.labelOf,
      ),
      f(
        'prefs.timezone',
        'preferences',
        null,
        'Time zone',
        'option',
        timeZone.labelOf,
      ),
      f(
        'prefs.dateFormat',
        'preferences',
        null,
        'Date format',
        'option',
        dateFormat.labelOf,
      ),
      f(
        'prefs.weekStart',
        'preferences',
        null,
        'Week starts on',
        'option',
        weekStart.labelOf,
      ),
      f(
        'prefs.theme',
        'preferences',
        null,
        'Appearance',
        'option',
        theme.labelOf,
      ),
      f(
        'prefs.density',
        'preferences',
        null,
        'Interface density',
        'option',
        density.labelOf,
      ),
      f('prefs.reduceMotion', 'preferences', null, 'Reduce motion', 'bool'),
      f(
        'prefs.landingPage',
        'preferences',
        null,
        'Landing page',
        'option',
        landing.labelOf,
      ),
      f('prefs.shortcuts', 'preferences', null, 'Keyboard shortcuts', 'bool'),

      f('notif.quietHours', 'notifications', 'delivery', 'Quiet hours', 'bool'),
      f(
        'notif.quietStart',
        'notifications',
        'delivery',
        'Quiet hours start',
        'text',
      ),
      f(
        'notif.quietEnd',
        'notifications',
        'delivery',
        'Quiet hours end',
        'text',
      ),
      f('notif.digest', 'notifications', 'delivery', 'Weekly digest', 'bool'),
      f(
        'notif.digestDay',
        'notifications',
        'delivery',
        'Digest day',
        'option',
        weekday.labelOf,
      ),
      f('notif.digestTime', 'notifications', 'delivery', 'Digest time', 'text'),

      f('ws.name', 'general', null, 'Workspace name', 'text'),
      f('ws.slug', 'general', null, 'Workspace address', 'text'),
      f('ws.description', 'general', null, 'Description', 'text'),
      f('ws.billingEmail', 'general', null, 'Billing email', 'text'),
      f('ws.supportUrl', 'general', null, 'Support URL', 'text'),
      f('ws.autoJoinDomains', 'general', null, 'Auto-join domains', 'set'),
      f(
        'ws.invitePolicy',
        'general',
        null,
        'Who can invite',
        'option',
        invitePolicy.labelOf,
      ),
      f(
        'ws.defaultRole',
        'general',
        null,
        'Default role for new members',
        'option',
        role.labelOf,
      ),
      f(
        'ws.requireApproval',
        'general',
        null,
        'Require approval for join requests',
        'bool',
      ),

      f(
        'roles.selfService',
        'members',
        'roles',
        'Allow members to change their own role',
        'bool',
      ),

      f(
        'sec.require2fa',
        'security',
        'policies',
        'Require two-factor authentication',
        'bool',
      ),
      f(
        'sec.enforceSso',
        'security',
        'policies',
        'Enforce single sign-on',
        'bool',
      ),
      f(
        'sec.passwordPolicy',
        'security',
        'policies',
        'Password policy',
        'option',
        passwordPolicy.labelOf,
      ),
      f(
        'sec.sessionLifetime',
        'security',
        'policies',
        'Session lifetime',
        'option',
        lifetime.labelOf,
      ),
      f(
        'sec.signOutOnPasswordChange',
        'security',
        'policies',
        'Sign out every session on password change',
        'bool',
      ),
      f(
        'sec.allowedDomains',
        'security',
        'policies',
        'Allowed sign-in domains',
        'set',
      ),
      f(
        'sec.alertRecipients',
        'security',
        'policies',
        'Alert recipients',
        'set',
      ),
      f(
        'sec.alertFailedSignIn',
        'security',
        'policies',
        'Alert on failed sign-ins',
        'bool',
      ),
      f(
        'sec.alertNewDevice',
        'security',
        'policies',
        'Alert on new device',
        'bool',
      ),
      f(
        'sec.alertKeyChange',
        'security',
        'policies',
        'Alert on key change',
        'bool',
      ),
    ];

    for (const channel of NOTIFICATION_CHANNELS) {
      fields.push(
        f(
          `notif.channel.${channel.id}`,
          'notifications',
          'delivery',
          channel.label,
          'bool',
        ),
      );
    }

    for (const event of NOTIFICATION_EVENTS) {
      for (const channel of NOTIFICATION_CHANNELS) {
        fields.push(
          f(
            `notif.sub.${event.id}.${channel.id}`,
            'notifications',
            'subscriptions',
            `${event.label} — ${channel.label}`,
            'bool',
          ),
        );
      }
    }

    for (const key of API_KEYS) {
      fields.push(
        f(`key.${key.id}.name`, 'api', 'keys', `${key.name} name`, 'text'),
        f(
          `key.${key.id}.expiresIn`,
          'api',
          'keys',
          `${key.name} expiry`,
          'option',
          expiry.labelOf,
        ),
        f(
          `key.${key.id}.enabled`,
          'api',
          'keys',
          `${key.name} enabled`,
          'bool',
        ),
      );
      for (const scope of KEY_SCOPES) {
        fields.push(
          f(
            `key.${key.id}.scope.${scope.value}`,
            'api',
            'keys',
            `${key.name} · ${scope.label} scope`,
            'bool',
          ),
        );
      }
    }

    for (const hook of WEBHOOKS) {
      fields.push(
        f(
          `hook.${hook.id}.url`,
          'api',
          'webhooks',
          `${hook.name} endpoint`,
          'text',
        ),
        f(
          `hook.${hook.id}.events`,
          'api',
          'webhooks',
          `${hook.name} events`,
          'set',
          events.labelOf,
        ),
        f(
          `hook.${hook.id}.active`,
          'api',
          'webhooks',
          `${hook.name} active`,
          'bool',
        ),
      );
    }

    for (const member of MEMBERS) {
      fields.push(
        f(
          `member.${member.id}.role`,
          'members',
          'roster',
          `${member.name} role`,
          'option',
          role.labelOf,
        ),
        f(
          `member.${member.id}.teams`,
          'members',
          'roster',
          `${member.name} teams`,
          'set',
          team.labelOf,
        ),
        f(
          `member.${member.id}.canExport`,
          'members',
          'roster',
          `${member.name} data export`,
          'bool',
        ),
      );
      for (const project of PROJECTS) {
        fields.push(
          f(
            `member.${member.id}.project.${project.id}`,
            'members',
            'roster',
            `${member.name} · ${project.label}`,
            'bool',
          ),
        );
      }
    }

    return fields;

    function f(
      id: string,
      sectionId: AccessSectionId,
      tabId: string | null,
      label: string,
      kind: AccessFieldKind,
      labelOf?: (value: string) => string,
    ): AccessFieldMeta {
      return { id, sectionId, tabId, label, kind, labelOf };
    }
  }

  /** @private Builds the saved value of every field from the fixtures. */
  private _buildBaseline(): Record<string, AccessDraftValue> {
    const baseline: Record<string, AccessDraftValue> = { ...DEFAULTS };

    for (const key of API_KEYS) {
      baseline[`key.${key.id}.name`] = key.name;
      baseline[`key.${key.id}.expiresIn`] = key.expiresIn;
      baseline[`key.${key.id}.enabled`] = key.enabled;
      for (const scope of KEY_SCOPES) {
        baseline[`key.${key.id}.scope.${scope.value}`] = key.scopes.includes(
          scope.value,
        );
      }
    }

    for (const hook of WEBHOOKS) {
      baseline[`hook.${hook.id}.url`] = hook.url;
      baseline[`hook.${hook.id}.events`] = [...hook.events];
      baseline[`hook.${hook.id}.active`] = hook.active;
    }

    for (const member of MEMBERS) {
      baseline[`member.${member.id}.role`] = member.role;
      baseline[`member.${member.id}.teams`] = [...member.teams];
      baseline[`member.${member.id}.canExport`] = member.canExport;
      for (const project of PROJECTS) {
        baseline[`member.${member.id}.project.${project.id}`] =
          member.projects.some((grant) => grant.id === project.id);
      }
    }

    return baseline;
  }

  /** @private Field ids owned by one member. */
  private _memberFieldIds(memberId: string): readonly string[] {
    return [
      `member.${memberId}.role`,
      `member.${memberId}.teams`,
      `member.${memberId}.canExport`,
      ...PROJECTS.map((project) => `member.${memberId}.project.${project.id}`),
    ];
  }

  /** @private Coerces a control's raw value into the field's storage shape. */
  private _coerce(kind: AccessFieldKind, raw: unknown): AccessDraftValue {
    if (kind === 'bool') return raw === true;
    if (kind === 'set') {
      if (Array.isArray(raw)) return raw.map((entry) => String(entry));
      return raw == null || raw === '' ? [] : [String(raw)];
    }
    return raw == null ? '' : String(raw);
  }

  /** @private Formats a stored value the way its control displays it. */
  private _display(field: AccessFieldMeta, value: AccessDraftValue): string {
    switch (field.kind) {
      case 'bool':
        return value === true ? 'On' : 'Off';
      case 'set': {
        const entries = asSet(value).map((entry) =>
          field.labelOf ? field.labelOf(entry) : entry,
        );
        return entries.length > 0 ? entries.join(', ') : 'None';
      }
      case 'option': {
        const raw = asText(value);
        return field.labelOf ? field.labelOf(raw) : raw;
      }
      default: {
        const text = asText(value).trim();
        return text.length > 0 ? text : 'Empty';
      }
    }
  }

  /** @private Rail colour of one staged record. */
  private _severityFor(
    id: string,
    oldValue: AccessDraftValue,
    newValue: AccessDraftValue,
  ): AccessSeverity {
    if (id === 'sec.require2fa' && newValue === false) return 'blocking';
    if (id.endsWith('.scope.admin') && newValue === true) return 'blocking';
    if (id.startsWith('member.') && id.endsWith('.role')) {
      const memberId = id.slice('member.'.length, -'.role'.length);
      const wasOwner = asText(oldValue) === 'owner';
      if (
        wasOwner &&
        asText(newValue) !== 'owner' &&
        this._wouldOrphan(memberId)
      ) {
        return 'blocking';
      }
      return 'caution';
    }

    const neutral = new Set([
      'profile.showLocalTime',
      'prefs.timezone',
      'notif.quietStart',
      'notif.quietEnd',
      'notif.digestDay',
      'notif.digestTime',
      'ws.billingEmail',
      'sec.alertRecipients',
    ]);
    if (neutral.has(id)) return 'neutral';
    if (id.startsWith('member.') && id.endsWith('.teams')) return 'neutral';
    if (id.startsWith('hook.') && id.endsWith('.events')) return 'neutral';

    const caution = new Set([
      'profile.email',
      'ws.name',
      'ws.slug',
      'ws.autoJoinDomains',
      'ws.invitePolicy',
      'ws.defaultRole',
      'ws.requireApproval',
      'roles.selfService',
      'sec.enforceSso',
      'sec.passwordPolicy',
      'sec.sessionLifetime',
      'sec.allowedDomains',
      'sec.signOutOnPasswordChange',
    ]);
    if (caution.has(id)) return 'caution';
    if (id.startsWith('notif.channel.') && newValue === false) return 'caution';
    if (id.startsWith('key.') || id.startsWith('hook.')) return 'caution';
    if (id.startsWith('member.')) return 'caution';
    if (id === 'sec.require2fa') return 'caution';

    return 'neutral';
  }

  /** @private Whether saving one record needs a confirmation code first. */
  private _needsStepUpFor(
    id: string,
    _oldValue: AccessDraftValue,
    newValue: AccessDraftValue,
  ): boolean {
    return id.endsWith('.scope.admin') && newValue === true;
  }

  /** @private Whether a field's message is advisory rather than an error. */
  private _isWarningField(id: string): boolean {
    return id === 'sec.allowedDomains' && asSet(this._draft()[id]).length === 0;
  }

  /** @private Values present in `next` but not in `previous`. */
  private _added(
    previous: AccessDraftValue,
    next: AccessDraftValue,
  ): readonly string[] {
    const before = new Set(asSet(previous));
    return asSet(next).filter((entry) => !before.has(entry));
  }

  /** @private How many members may invite under one policy. */
  private _invitersUnder(policy: string): number {
    if (policy === 'owners') return this.ownerCount();
    if (policy === 'admins') return this.ownerCount() + this.adminCount();
    return this.memberCount();
  }

  /** @private Sessions older than a lifetime, in hours. */
  private _staleSessions(hours: number): number {
    const cutoff = this.now - hours * 60 * 60 * 1000;
    return this.sessions().filter((session) => session.startedAt < cutoff)
      .length;
  }

  /** @private Whether re-roling a member would leave the workspace ownerless. */
  private _wouldOrphan(memberId: string): boolean {
    const draft = this._draft();
    return !this.members().some(
      (member) =>
        member.id !== memberId &&
        asText(draft[`member.${member.id}.role`]) === 'owner',
    );
  }

  /** @private Consequence of an API key field. */
  private _keyConsequence(
    id: string,
    newValue: AccessDraftValue,
  ): string | null {
    const key = this.apiKeys().find((entry) => id.includes(entry.id));
    if (!key) return null;

    if (id.endsWith('.enabled')) {
      return newValue === false
        ? `${formatNumber(key.calls7d)} calls in the last 7 days would start failing.`
        : null;
    }
    if (id.endsWith('.expiresIn')) {
      return asText(newValue) === 'Never'
        ? `${key.name} stops expiring and will never prompt for rotation.`
        : null;
    }
    if (id.includes('.scope.')) {
      const scope = id.slice(id.lastIndexOf('.') + 1) as AccessApiScope;
      const label = this.keyScopeSet.labelOf(scope);
      if (newValue === true) {
        return scope === 'admin'
          ? `Gives ${key.name} full admin access to this workspace.`
          : `Widens ${key.name} to ${label}.`;
      }
      return `Removes ${label} from ${key.name}; ${plural(key.integrationCount, 'integration uses', 'integrations use')} it.`;
    }
    return null;
  }

  /** @private Consequence of a webhook field. */
  private _hookConsequence(
    id: string,
    oldValue: AccessDraftValue,
    newValue: AccessDraftValue,
  ): string | null {
    const hook = this.webhooks().find((entry) => id.includes(entry.id));
    if (!hook) return null;

    if (id.endsWith('.url')) {
      return `Re-points ${hook.name} with ${plural(hook.deliveries7d, 'delivery', 'deliveries')} in the last 7 days.`;
    }
    if (id.endsWith('.active')) {
      return newValue === false
        ? `Stops about ${plural(hook.deliveries7d, 'delivery', 'deliveries')} a week.`
        : null;
    }
    if (id.endsWith('.events')) {
      return `${hook.name} listens to ${asSet(newValue).length} events instead of ${asSet(oldValue).length}.`;
    }
    return null;
  }

  /** @private Consequence of a member field. */
  private _memberConsequence(
    id: string,
    oldValue: AccessDraftValue,
    newValue: AccessDraftValue,
  ): string | null {
    const memberId = id.split('.')[1];
    const member = this.members().find((entry) => entry.id === memberId);
    if (!member) return null;

    if (id.endsWith('.role')) {
      if (asText(oldValue) === 'owner' && this._wouldOrphan(memberId)) {
        return 'Northwind Labs would have no owner.';
      }
      const granted = PROJECTS.filter((project) =>
        asBool(this._draft()[`member.${memberId}.project.${project.id}`]),
      ).length;
      return `${member.name} moves from ${this.roleSet.labelOf(asText(oldValue))} to ${this.roleSet.labelOf(asText(newValue))} across ${plural(granted, 'project', 'projects')}.`;
    }

    if (id.endsWith('.teams')) {
      const added = this._added(oldValue, newValue).map(this.teamSet.labelOf);
      const removed = this._added(newValue, oldValue).map(this.teamSet.labelOf);
      if (added.length > 0 && removed.length > 0) {
        return `${member.name} joins ${joinList(added)} and leaves ${joinList(removed)}.`;
      }
      if (added.length > 0) return `${member.name} joins ${joinList(added)}.`;
      if (removed.length > 0)
        return `${member.name} leaves ${joinList(removed)}.`;
      return null;
    }

    if (id.includes('.project.')) {
      return newValue === true
        ? `${member.name} gains access to ${plural(1, 'project', 'projects')}.`
        : `${member.name} loses access to ${plural(1, 'project', 'projects')}.`;
    }

    if (id.endsWith('.canExport')) {
      return newValue === true
        ? `${member.name} can download the full project archive.`
        : null;
    }

    return null;
  }

  /** @private Opens a section and loads its collection when it has one. */
  private _openSection(sectionId: AccessSectionId): void {
    this.activeSection.set(sectionId);
    this._preflightBlocked.set(false);
    this._maybeLoadCollection(sectionId, this._tabBySection()[sectionId] ?? '');
  }

  /** @private Plays the first-load skeleton for a tab's collection once. */
  private _maybeLoadCollection(
    sectionId: AccessSectionId,
    tabId: string,
  ): void {
    const key = `${sectionId}/${tabId}`;
    const tracked = [
      'members/roster',
      'security/sessions',
      'security/signin-log',
      'api/keys',
    ];
    if (!tracked.includes(key)) return;
    if (this._loadedCollections().includes(key)) return;

    this._loadingCollection.set(key);
    void runShowcaseOperation(() => key, { delay: COLLECTION_DELAY }).then(
      () => {
        this._loadedCollections.update((list) => [...list, key]);
        if (this._loadingCollection() === key)
          this._loadingCollection.set(null);
      },
    );
  }

  /** @private Applies every staged change of one section. */
  private async _applySection(
    sectionId: AccessSectionId,
    changes: readonly AccessStagedChange[],
  ): Promise<void> {
    if (changes.length === 0) return;

    this._clearSavedTimer();
    this._dockState.set('saving');
    this._savedSection.set(sectionId);
    this._clearRejection();

    const draft = this._draft();
    const rejected = changes.filter(
      (change) =>
        change.id === 'ws.slug' &&
        TAKEN_SLUGS.includes(asText(draft['ws.slug'])),
    );
    const applied = changes.filter((change) => !rejected.includes(change));

    const result = await runShowcaseOperation(
      () => applied.map((change) => change.id),
      { delay: SLOW_DELAY },
    );
    if (result.ok) this._adoptBaseline(result.value);

    if (rejected.length > 0) {
      await runShowcaseOperation(() => null, { fail: true, delay: 12 });
      const slug = asText(draft['ws.slug']);
      this._rejectedFieldId.set('ws.slug');
      this._rejectedMessage.set(
        `${slug} is already taken by another workspace. Try northwind-labs-eu.`,
      );
      this._savedCount.set(applied.length);
      this._failedCount.set(rejected.length);
      this._dockState.set('partially-failed');
      this._toast.warning(
        `Saved with ${plural(rejected.length, 'problem', 'problems')}`,
        {
          description: `Workspace address was rejected. The other ${plural(applied.length, 'change is', 'changes are')} live.`,
          icon: true,
        },
      );
      this._focusField('ws.slug');
      return;
    }

    this._savedCount.set(applied.length);
    this._failedCount.set(0);
    this._dockState.set('just-saved');
    this._savedHandle = setTimeout(() => {
      this._dockState.set('clean');
      this._savedHandle = null;
    }, JUST_SAVED_MS);

    const label = SECTION_LABEL[sectionId];
    this._toast.success(`${label} saved`, {
      description: this._saveDescription(sectionId, applied.length),
      icon: true,
    });
    this._logActivity(
      `Saved ${plural(applied.length, 'change', 'changes')} in ${label}`,
      'success',
    );
    this._headingRef()?.nativeElement.focus();
  }

  /** @private Adopts the draft values of the fields a save applied. */
  private _adoptBaseline(ids: readonly string[]): void {
    const draft = this._draft();
    this._baseline.update((baseline) => {
      const next = { ...baseline };
      for (const id of ids) {
        const value = draft[id];
        if (value !== undefined) next[id] = value;
      }
      return next;
    });
    this._syncRecords(ids);
  }

  /** @private Pushes saved per-record fields back into the live records. */
  private _syncRecords(ids: readonly string[]): void {
    const draft = this._draft();

    if (ids.some((id) => id.startsWith('key.'))) {
      this.apiKeys.update((list) =>
        list.map((key) => ({
          ...key,
          name: asText(draft[`key.${key.id}.name`]),
          expiresIn: asText(
            draft[`key.${key.id}.expiresIn`],
          ) as typeof key.expiresIn,
          enabled: asBool(draft[`key.${key.id}.enabled`]),
          scopes: KEY_SCOPES.filter((scope) =>
            asBool(draft[`key.${key.id}.scope.${scope.value}`]),
          ).map((scope) => scope.value),
        })),
      );
    }

    if (ids.some((id) => id.startsWith('hook.'))) {
      this.webhooks.update((list) =>
        list.map((hook) => ({
          ...hook,
          url: asText(draft[`hook.${hook.id}.url`]),
          active: asBool(draft[`hook.${hook.id}.active`]),
          events: asSet(
            draft[`hook.${hook.id}.events`],
          ) as readonly AccessWebhookEventId[],
        })),
      );
    }

    if (ids.some((id) => id.startsWith('member.'))) {
      this.members.update((list) =>
        list.map((member) => ({
          ...member,
          role: asText(draft[`member.${member.id}.role`]) as AccessRoleId,
          teams: asSet(
            draft[`member.${member.id}.teams`],
          ) as readonly AccessTeamId[],
          canExport: asBool(draft[`member.${member.id}.canExport`]),
          projects: PROJECTS.filter((project) =>
            asBool(draft[`member.${member.id}.project.${project.id}`]),
          ).map((project) => ({
            id: project.id,
            locked: this._isProjectLocked(member.id, project.id),
          })),
        })),
      );
    }
  }

  /** @private Description of a successful save, tuned per section. */
  private _saveDescription(sectionId: AccessSectionId, count: number): string {
    const changes = plural(count, 'change', 'changes');
    if (sectionId === 'security') {
      return `${changes} applied. ${plural(this.without2faCount(), 'member was', 'members were')} emailed about the new requirement.`;
    }
    return `${changes} applied.`;
  }

  /** @private Reverts a list of fields and confirms it with one toast. */
  private _applyRevert(ids: readonly string[], section: AccessSectionId): void {
    const baseline = this._baseline();
    this._draft.update((draft) => {
      const next = { ...draft };
      for (const id of ids) {
        const value = baseline[id];
        if (value !== undefined) next[id] = value;
      }
      return next;
    });
    this._clearRejection();
    this._afterRevert();
    this._toast.info('Changes reverted', {
      description: `${plural(ids.length, 'field', 'fields')} in ${SECTION_LABEL[section]} are back to their saved values.`,
      icon: true,
    });
  }

  /** @private Resets the guard once nothing is staged anywhere. */
  private _afterRevert(): void {
    if (this.stagedCount() === 0) {
      this._guardAcknowledged.set(false);
      this._dockState.set('clean');
    }
  }

  /** @private Clears the just-saved timer whenever a new edit lands. */
  private _onEdit(): void {
    this._clearSavedTimer();
    if (this._dockState() === 'just-saved') this._dockState.set('dirty');
    if (this.stagedCount() === 0) this._guardAcknowledged.set(false);
  }

  /** @private Cancels the just-saved countdown. */
  private _clearSavedTimer(): void {
    if (!this._savedHandle) return;
    clearTimeout(this._savedHandle);
    this._savedHandle = null;
  }

  /** @private Clears the server rejection surfaces. */
  private _clearRejection(): void {
    this._rejectedFieldId.set(null);
    this._rejectedMessage.set('');
  }

  /** @private Moves focus to the first field the pre-flight check refused. */
  private _focusFirstError(): void {
    const [first] = this.sectionErrors();
    if (first) this._focusField(first);
  }

  /** @private Focuses one control by its stable element id. */
  private _focusField(id: string): void {
    if (typeof document === 'undefined') return;
    const host = document.getElementById(`field-${id}`);
    const control = host?.querySelector<HTMLElement>(
      'input, textarea, [tabindex], button',
    );
    control?.focus();
  }

  /** @private Whether a project grant comes from a team and cannot be lost. */
  private _isProjectLocked(
    memberId: string,
    projectId: AccessProjectId,
  ): boolean {
    return (
      memberId === LOCKED_PROJECT_MEMBER_ID && projectId === LOCKED_PROJECT_ID
    );
  }

  /** @private Shows the sessions alert and arms its self-clear timer. */
  private _showSessionAlert(alert: AccessSessionAlert): void {
    if (this._undoHandle) clearTimeout(this._undoHandle);
    this.sessionAlert.set(alert);
    this._undoHandle = setTimeout(() => {
      this.sessionAlert.set(null);
      this._undoHandle = null;
    }, SESSION_UNDO_MS);
  }

  /** @private Puts a revoked session back at the index it occupied. */
  private _restoreSession(sessionId: string): void {
    const session = this._revokedSessions.get(sessionId);
    if (!session) return;
    const index = this._revokedIndex.get(sessionId) ?? this.sessions().length;
    this.sessions.update((list) => {
      const next = [...list];
      next.splice(Math.min(index, next.length), 0, session);
      return next;
    });
    this._revokedSessions.delete(sessionId);
    this._revokedIndex.delete(sessionId);
  }

  /** @private Opens the step-up dialog for one pending action. */
  private _openStepUp(
    kind: AccessStepUpKind,
    keyId: string | null,
    title: string,
    message: string,
  ): void {
    this._stepUpKind.set(kind);
    this._stepUpKeyId.set(keyId);
    this.stepUpTitle.set(title);
    this.stepUpMessage.set(message);
    this._resetStepUp();
    this.stepUpOpen.set(true);
  }

  /** @private Clears the step-up field, counter and lockout. */
  private _resetStepUp(): void {
    this.stepUpValue.set('');
    this.stepUpState.set('default');
    this.stepUpHint.set('');
    this.stepUpAttempts.set(STEP_UP_MAX_ATTEMPTS);
    this.lockedOut.set(false);
    this.lockoutSeconds.set(0);
    if (this._lockoutHandle) {
      clearInterval(this._lockoutHandle);
      this._lockoutHandle = null;
    }
  }

  /** @private Locks the step-up and counts the seconds back down. */
  private _startLockout(): void {
    this.lockedOut.set(true);
    this.lockoutSeconds.set(Math.round(STEP_UP_LOCKOUT_MS / 1000));
    if (this._lockoutHandle) clearInterval(this._lockoutHandle);
    this._lockoutHandle = setInterval(() => {
      const left = this.lockoutSeconds() - 1;
      this.lockoutSeconds.set(Math.max(0, left));
      if (left > 0) return;
      if (this._lockoutHandle) clearInterval(this._lockoutHandle);
      this._lockoutHandle = null;
      this.lockedOut.set(false);
      this.stepUpAttempts.set(STEP_UP_MAX_ATTEMPTS);
      this.stepUpState.set('default');
      this.stepUpHint.set('');
    }, 1000);
  }

  /** @private Rotates a key, honouring the seeded first-attempt failure. */
  private async _rotateKey(keyId: string): Promise<void> {
    const key = this.apiKeys().find((entry) => entry.id === keyId);
    if (!key) return;

    const willFail = key.rotateFailsFirstAttempt && !key.rotateAttempted;
    this.apiKeys.update((list) =>
      list.map((entry) =>
        entry.id === keyId ? { ...entry, rotateAttempted: true } : entry,
      ),
    );

    const result = await runShowcaseOperation(() => keyId, {
      fail: willFail,
      delay: SLOW_DELAY,
    });

    if (!result.ok) {
      this.keyErrors.update((errors) => ({
        ...errors,
        [keyId]: 'Rotation failed. The old secret is still live.',
      }));
      this._toast.error(`Could not rotate ${key.name}`, {
        description: 'Nothing changed. Try again.',
        icon: true,
      });
      return;
    }

    const prefix = `ndw_live_${Math.abs(
      keyId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0),
    )
      .toString(16)
      .slice(0, 4)}`;
    this.keyErrors.update((errors) => {
      const next = { ...errors };
      delete next[keyId];
      return next;
    });
    this.apiKeys.update((list) =>
      list.map((entry) => (entry.id === keyId ? { ...entry, prefix } : entry)),
    );
    this.revealedSecrets.update((secrets) => ({
      ...secrets,
      [keyId]: `${prefix}_${keyId.replace(/[^a-z0-9]/g, '')}9f2c41`,
    }));
    this._toast.success(`${key.name} rotated`, {
      description: 'The old secret stopped working immediately.',
      icon: true,
    });
    this._logActivity(`Rotated the ${key.name} key`, 'success');
  }

  /** @private Removes a key after its step-up verified. */
  private _deleteKey(keyId: string): void {
    const key = this.apiKeys().find((entry) => entry.id === keyId);
    if (!key) return;
    this.apiKeys.update((list) => list.filter((entry) => entry.id !== keyId));
    this._toast.success(`${key.name} deleted`, {
      description: 'Requests using it now return 401.',
      icon: true,
    });
    this._logActivity(`Deleted the ${key.name} key`, 'warning');
  }

  /** @private Prepends one entry to the aside's activity feed. */
  private _logActivity(
    action: string,
    tone: AccessActivityEvent['tone'],
  ): void {
    this.activity.update((list) => [
      {
        id: `act-${list.length + 1}-${Date.now()}`,
        at: Date.now(),
        actorName: CURRENT_USER.name,
        action,
        tone,
      },
      ...list,
    ]);
  }

  /** @private Mirrors a media query into a signal, cleaning up on destroy. */
  private _watchMedia(
    query: string,
    target: { set: (value: boolean) => void },
  ): void {
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

  /** @private Clears every gate in the delete dialog. */
  private _resetDeleteGates(): void {
    this.deleteAck1.set(false);
    this.deleteAck2.set(false);
    this.deleteConfirm.set('');
    this.deleteCode.set('');
    this.deleteVerified.set(false);
    this.deleteCodeState.set('default');
    this.deleteCodeMessage.set('');
  }
}
