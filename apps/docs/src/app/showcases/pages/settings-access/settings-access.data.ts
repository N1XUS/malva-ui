import type { MlvSelectOption } from '@malva-ui/core/select';

/**
 * Fixture data for the **Settings & Access** ("Access Desk") showcase at
 * `/showcases/settings-access`.
 *
 * Every seeded record, option list, baseline value and deterministic failure
 * flag used by `SettingsAccessShowcaseComponent` lives here. The route
 * component owns **zero** fixture data — it reads this module and stages its
 * edits into a draft signal.
 *
 * Timestamps are anchored to {@link NOW} so the page always reads as "live"
 * without any nondeterminism. A handful of records additionally carry a pinned
 * display label (`joinedLabel`, `createdLabel`, `lastSignInLabel`) because the
 * summary strip renders those strings verbatim and a wall-clock formatter
 * cannot reproduce them from a moving anchor.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Anchor for every relative timestamp in the seeded workspace. */
const NOW = Date.now();

/* -------------------------------------------------------------------------- */
/* Unions                                                                     */
/* -------------------------------------------------------------------------- */

/** Settings section reachable from the sidebar. */
export type AccessSectionId =
  | 'profile'
  | 'preferences'
  | 'notifications'
  | 'general'
  | 'members'
  | 'security'
  | 'api'
  | 'danger';

/** Role a member holds inside the workspace. */
export type AccessRoleId = 'owner' | 'admin' | 'analyst' | 'member' | 'viewer';

/** Whether a member's role was set explicitly or inherited from the workspace default. */
export type AccessRoleSource = 'explicit' | 'default';

/** Team a member can belong to. */
export type AccessTeamId =
  | 'platform'
  | 'data'
  | 'design'
  | 'revenue'
  | 'support';

/** Project a member can be granted access to. */
export type AccessProjectId = 'atlas' | 'beacon' | 'corvus' | 'meridian';

/** Lifecycle state of a pending invitation. */
export type AccessInvitationState =
  | 'sending'
  | 'pending'
  | 'expiring'
  | 'bounced';

/** Scope an API key can be granted. */
export type AccessApiScope = 'read' | 'write' | 'delete' | 'admin';

/** Expiry window offered for an API key. */
export type AccessKeyExpiry = '30 days' | '90 days' | '1 year' | 'Never';

/** Event a webhook endpoint can subscribe to. */
export type AccessWebhookEventId =
  | 'member.joined'
  | 'member.removed'
  | 'role.changed'
  | 'key.rotated'
  | 'billing.receipt'
  | 'billing.failed';

/** Delivery channel for notifications. */
export type AccessChannelId = 'email' | 'inApp' | 'push';

/** Event type a member can subscribe to per channel. */
export type AccessNotificationEventId =
  | 'member-joined'
  | 'role-changed'
  | 'key-rotated'
  | 'failed-sign-in'
  | 'weekly-digest'
  | 'billing-receipt';

/** What a sign-in log entry records, used by the log's segmented filter. */
export type AccessSignInEventKind =
  | 'success'
  | 'failed'
  | 'new-device'
  | 'signed-out'
  | 'password-changed';

/**
 * Tone of a timeline entry. Mirrors `MlvTimelineItemTone` without importing it,
 * so the fixture module stays free of component coupling.
 */
export type AccessEventTone =
  | 'default'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

/** Who may send invitations. */
export type AccessInvitePolicy = 'anyone' | 'admins' | 'owners';

/** Password strength rule enforced at sign-in. */
export type AccessPasswordPolicy = 'standard' | 'strong' | 'passphrase';

/** Appearance preference for this browser. */
export type AccessThemePreference = 'light' | 'dark' | 'system';

/** Interface density preference. */
export type AccessDensityPreference = 'compact' | 'comfortable' | 'spacious';

/** How long a session stays signed in. */
export type AccessSessionLifetime =
  | '8 hours'
  | '24 hours'
  | '7 days'
  | '30 days'
  | '90 days';

/** First day of the week in calendars and digests. */
export type AccessWeekStart = 'monday' | 'sunday' | 'saturday';

/** Page opened straight after sign-in. */
export type AccessLandingPage =
  | 'overview'
  | 'my-work'
  | 'reports'
  | 'last-visited';

/** Any value a staged draft field can hold. */
export type AccessDraftValue = string | boolean | readonly string[];

/* -------------------------------------------------------------------------- */
/* Record shapes                                                              */
/* -------------------------------------------------------------------------- */

/** The signed-in administrator driving the showcase. */
export interface AccessUserProfile {
  /** Stable id, also present in {@link MEMBERS}. */
  readonly id: string;
  /** Full legal name shown on comments and audit entries. */
  readonly name: string;
  /** Work email; account mail goes here. */
  readonly email: string;
  /** Short name used in chat and mentions. */
  readonly displayName: string;
  /** Job title shown next to the name. */
  readonly title: string;
  /** Preferred pronouns, an option value from {@link PRONOUNS}. */
  readonly pronouns: string;
  /** Personal address used only for account recovery. */
  readonly recoveryEmail: string;
  /** Free-text bio, at most 280 characters. */
  readonly bio: string;
  /** When the account joined the workspace. */
  readonly joinedAt: number;
  /** Pinned "Member since" label rendered verbatim by the summary strip. */
  readonly joinedLabel: string;
  /** Most recent successful sign-in. */
  readonly lastSignInAt: number;
  /** Pinned "Last sign-in" label rendered verbatim by the summary strip. */
  readonly lastSignInLabel: string;
  /** City and country of the most recent sign-in. */
  readonly lastSignInLocation: string;
  /** How the account authenticates, shown in the summary strip. */
  readonly signInMethod: string;
  /** Scheduled digests re-timed when the account time zone changes. */
  readonly scheduledDigestCount: number;
}

/** The workspace every member shares. */
export interface AccessWorkspace {
  /** Display name shown in the switcher and on invitations. */
  readonly name: string;
  /** URL slug; the public address is `{slug}.malva.app`. */
  readonly slug: string;
  /** One-line statement of what the workspace is for. */
  readonly description: string;
  /** Subscription tier. */
  readonly plan: string;
  /** Seats purchased on the current plan. */
  readonly seats: number;
  /** When the workspace was created. */
  readonly createdAt: number;
  /** Pinned "Created" label rendered verbatim by the summary strip. */
  readonly createdLabel: string;
  /** Where invoices and payment failures are sent. */
  readonly billingEmail: string;
  /** Public help address shown to members. */
  readonly supportUrl: string;
  /** Bookmarks and shared links that break when the slug changes. */
  readonly savedLinkCount: number;
  /** API calls served in the last seven days. */
  readonly apiCalls7d: number;
  /** API calls that failed in the last seven days. */
  readonly apiFailures7d: number;
  /** Days deleted data stays recoverable through support. */
  readonly dataRetentionDays: number;
}

/** One project a member has been granted. */
export interface AccessProjectGrant {
  /** Project the grant points at. */
  readonly id: AccessProjectId;
  /** When true the grant comes from a team and cannot be revoked directly. */
  readonly locked: boolean;
}

/** A person with access to the workspace. */
export interface AccessMember {
  /** Stable id referenced by sessions, drafts and drawer state. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Work email. */
  readonly email: string;
  /** Current role. */
  readonly role: AccessRoleId;
  /** Whether the role was chosen for this person or inherited from the default. */
  readonly roleSource: AccessRoleSource;
  /** Whether a second factor is enrolled. */
  readonly twoFactor: boolean;
  /** Whether the person signs in through single sign-on. */
  readonly ssoEnabled: boolean;
  /** Whether the current password fails the strong policy. */
  readonly weakPassword: boolean;
  /** Teams the person belongs to. */
  readonly teams: readonly AccessTeamId[];
  /** Projects the person can open. */
  readonly projects: readonly AccessProjectGrant[];
  /** Whether the person may download the full project archive. */
  readonly canExport: boolean;
  /** Most recent activity, used for the roster's relative "last active" cell. */
  readonly lastActiveAt: number;
  /** When the person joined the workspace. */
  readonly joinedAt: number;
  /** Pinned "Joined" label shown in the member access drawer byline. */
  readonly joinedLabel: string;
}

/** A role definition shown on the read-only Roles tab. */
export interface AccessRoleDefinition {
  /** Stable id used as the select value. */
  readonly id: AccessRoleId;
  /** Human-readable role name. */
  readonly name: string;
  /** One-line description of what the role is for. */
  readonly summary: string;
  /** Exactly four permission sentences listed on the role card. */
  readonly permissions: readonly [string, string, string, string];
}

/** A named team that can be attached to a member. */
export interface AccessTeam {
  /** Stable id used as the select value. */
  readonly id: AccessTeamId;
  /** Display label. */
  readonly label: string;
}

/** A project that member access can be granted against. */
export interface AccessProject {
  /** Stable id used as the checkbox key. */
  readonly id: AccessProjectId;
  /** Display label. */
  readonly label: string;
}

/** An invitation that has been sent but not yet accepted. */
export interface AccessInvitation {
  /** Stable id. */
  readonly id: string;
  /** Address the invitation was sent to. */
  readonly email: string;
  /** Role the invitee will hold once they accept. */
  readonly role: AccessRoleId;
  /** Delivery state driving the row badge. */
  readonly state: AccessInvitationState;
  /** When the invitation was sent. */
  readonly sentAt: number;
  /** When the invitation stops working. */
  readonly expiresAt: number;
  /** Name of the member who sent it. */
  readonly invitedBy: string;
  /** Why the mail server rejected it, or `null` when it was accepted for delivery. */
  readonly bounceReason: string | null;
}

/** A live sign-in session. */
export interface AccessSession {
  /** Stable id. */
  readonly id: string;
  /** Member the session belongs to. */
  readonly memberId: string;
  /** Device or operating system. */
  readonly device: string;
  /** Browser and major version. */
  readonly browser: string;
  /** City and country resolved from the IP. */
  readonly location: string;
  /** Source IP address. */
  readonly ip: string;
  /** When the session was created. */
  readonly startedAt: number;
  /** Most recent request on this session. */
  readonly lastActiveAt: number;
  /** True for the session rendering the page; it can never be revoked. */
  readonly isCurrent: boolean;
  /** Seeded flag: revoking this session always fails, deterministically. */
  readonly revokeFails: boolean;
}

/** An API key issued to another system. */
export interface AccessApiKey {
  /** Stable id. */
  readonly id: string;
  /** Human-readable key name. */
  readonly name: string;
  /** Visible prefix of the secret; the rest is never shown again. */
  readonly prefix: string;
  /** Scopes currently granted. */
  readonly scopes: readonly AccessApiScope[];
  /** Expiry window. */
  readonly expiresIn: AccessKeyExpiry;
  /** Whether the key currently authenticates; a disabled key returns 401. */
  readonly enabled: boolean;
  /** When the key was issued. */
  readonly createdAt: number;
  /** Most recent request authenticated with this key. */
  readonly lastUsedAt: number;
  /** Calls served with this key in the last seven days. */
  readonly calls7d: number;
  /** Integrations that would break if the key changed. */
  readonly integrationCount: number;
  /** When rotation became (or becomes) due; a past value means overdue. */
  readonly rotationDueAt: number;
  /** Seeded flag: the first rotation attempt fails, the second succeeds. */
  readonly rotateFailsFirstAttempt: boolean;
  /** Whether a rotation has already been attempted in this session. */
  readonly rotateAttempted: boolean;
}

/** A webhook endpoint the workspace posts to. */
export interface AccessWebhook {
  /** Stable id. */
  readonly id: string;
  /** Human-readable endpoint name. */
  readonly name: string;
  /** HTTPS endpoint receiving the payloads. */
  readonly url: string;
  /** Events the endpoint listens to. */
  readonly events: readonly AccessWebhookEventId[];
  /** Whether deliveries are running; `false` renders the paused row. */
  readonly active: boolean;
  /** Deliveries attempted in the last seven days. */
  readonly deliveries7d: number;
  /** Deliveries that failed in the last seven days. */
  readonly failures7d: number;
}

/** Per-channel subscription state for one notification event. */
export interface AccessNotificationChannelState {
  /** Whether the event is emailed. */
  readonly email: boolean;
  /** Whether the event appears in the bell menu. */
  readonly inApp: boolean;
  /** Whether the event is pushed to a mobile device. */
  readonly push: boolean;
}

/** A notification event type with its per-channel defaults. */
export interface AccessNotificationEvent {
  /** Stable id used to build `notif.sub.{event}.{channel}` field ids. */
  readonly id: AccessNotificationEventId;
  /** Fieldset legend on the Subscriptions tab. */
  readonly label: string;
  /** Fieldset description explaining when the event fires. */
  readonly description: string;
  /** Baseline subscription state per channel. */
  readonly channels: AccessNotificationChannelState;
}

/** A delivery channel shown on the Delivery tab. */
export interface AccessNotificationChannel {
  /** Stable id used to build `notif.channel.{id}` field ids. */
  readonly id: AccessChannelId;
  /** Switch label. */
  readonly label: string;
  /** Sentence under the switch explaining where the channel lands. */
  readonly detail: string;
  /** Whether the channel can be turned on at all; `push` is unavailable. */
  readonly available: boolean;
}

/** One entry in the read-only sign-in log. */
export interface AccessSignInEvent {
  /** Stable id. */
  readonly id: string;
  /** When the event happened. */
  readonly at: number;
  /** Name of the person the event concerns. */
  readonly actorName: string;
  /** What happened, written as a short sentence. */
  readonly action: string;
  /** Source IP address. */
  readonly ip: string;
  /** Timeline tone for the entry. */
  readonly tone: AccessEventTone;
  /** Classification driving the log's segmented filter. */
  readonly kind: AccessSignInEventKind;
}

/** One entry in the aside's "Recent activity" timeline. */
export interface AccessActivityEvent {
  /** Stable id. */
  readonly id: string;
  /** When the activity happened. */
  readonly at: number;
  /** Name of the member who acted. */
  readonly actorName: string;
  /** What they did, written as a short sentence. */
  readonly action: string;
  /** Timeline tone for the entry. */
  readonly tone: AccessEventTone;
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

/** The signed-in owner of Northwind Labs. */
export const CURRENT_USER: AccessUserProfile = {
  id: 'm-dana',
  name: 'Dana Whitfield',
  email: 'dana.whitfield@northwind.com',
  displayName: 'Dana',
  title: 'Head of Platform',
  pronouns: 'she/her',
  recoveryEmail: 'dana@fastmail.com',
  bio: 'I look after the platform team and the data plumbing behind Northwind.',
  joinedAt: NOW - 890 * DAY,
  joinedLabel: 'March 2023',
  lastSignInAt: NOW - 4 * HOUR,
  lastSignInLabel: 'Today, 08:14 · Berlin',
  lastSignInLocation: 'Berlin, Germany',
  signInMethod: 'Password + authenticator',
  scheduledDigestCount: 4,
};

/** The workspace under administration. */
export const WORKSPACE: AccessWorkspace = {
  name: 'Northwind Labs',
  slug: 'northwind-labs',
  description:
    'Data platform and billing infrastructure for the Northwind group.',
  plan: 'Growth',
  seats: 25,
  createdAt: NOW - 890 * DAY,
  createdLabel: '12 March 2023',
  billingEmail: 'finance@northwind.com',
  supportUrl: 'https://help.northwind.com',
  savedLinkCount: 47,
  apiCalls7d: 41208,
  apiFailures7d: 12,
  dataRetentionDays: 90,
};

/* -------------------------------------------------------------------------- */
/* Roles, teams, projects                                                     */
/* -------------------------------------------------------------------------- */

/** The five role definitions rendered on the read-only Roles tab. */
export const ROLES: readonly AccessRoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner',
    summary: 'Full control, including billing, ownership and deletion.',
    permissions: [
      'Transfer ownership and delete the workspace',
      'Manage billing, the plan and the seat count',
      'Manage members, roles and security policies',
      'Read and write every project',
    ],
  },
  {
    id: 'admin',
    name: 'Admin',
    summary: 'Runs the workspace day to day, short of ownership and billing.',
    permissions: [
      'Invite, remove and re-role members',
      'Manage API keys and webhooks',
      'Change security policies',
      'Read and write every project',
    ],
  },
  {
    id: 'analyst',
    name: 'Analyst',
    summary: 'Builds and publishes analysis across assigned projects.',
    permissions: [
      'Read and write assigned projects',
      'Create and publish reports',
      'Export project data when it is allowed',
      'Read the member directory',
    ],
  },
  {
    id: 'member',
    name: 'Member',
    summary: 'Does the everyday work inside assigned projects.',
    permissions: [
      'Read and write assigned projects',
      'Comment and mention teammates',
      'Create personal views and saved filters',
      'Read the member directory',
    ],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    summary: 'Reads assigned projects without changing anything.',
    permissions: [
      'Read assigned projects',
      'Read published reports',
      'Comment where comments are open',
      'Read the member directory',
    ],
  },
];

/** Fast lookup from role id to definition. */
export const ROLE_BY_ID: ReadonlyMap<AccessRoleId, AccessRoleDefinition> =
  new Map(ROLES.map((role) => [role.id, role]));

/** The five teams a member can belong to. */
export const TEAMS: readonly AccessTeam[] = [
  { id: 'platform', label: 'Platform' },
  { id: 'data', label: 'Data' },
  { id: 'design', label: 'Design' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'support', label: 'Support' },
];

/** Fast lookup from team id to team. */
export const TEAM_BY_ID: ReadonlyMap<AccessTeamId, AccessTeam> = new Map(
  TEAMS.map((team) => [team.id, team]),
);

/** The four projects member access is granted against. */
export const PROJECTS: readonly AccessProject[] = [
  { id: 'atlas', label: 'Atlas ingest' },
  { id: 'beacon', label: 'Beacon dashboards' },
  { id: 'corvus', label: 'Corvus billing' },
  { id: 'meridian', label: 'Meridian ETL' },
];

/** Fast lookup from project id to project. */
export const PROJECT_BY_ID: ReadonlyMap<AccessProjectId, AccessProject> =
  new Map(PROJECTS.map((project) => [project.id, project]));

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The twelve people in Northwind Labs.
 *
 * Seeded so the derived counts in the summary strip come out exactly:
 * 1 owner, 2 admins, 3 without a second factor, 2 password-only (no SSO),
 * 9 with a weak password, 6 with no explicit role, 1 outside `northwind.com`.
 */
export const MEMBERS: readonly AccessMember[] = [
  {
    id: 'm-dana',
    name: 'Dana Whitfield',
    email: 'dana.whitfield@northwind.com',
    role: 'owner',
    roleSource: 'explicit',
    twoFactor: true,
    ssoEnabled: true,
    weakPassword: false,
    teams: ['platform'],
    projects: [
      { id: 'atlas', locked: false },
      { id: 'beacon', locked: false },
      { id: 'corvus', locked: false },
      { id: 'meridian', locked: false },
    ],
    canExport: true,
    lastActiveAt: NOW - 3 * MINUTE,
    joinedAt: NOW - 890 * DAY,
    joinedLabel: 'March 2023',
  },
  {
    id: 'm-priya',
    name: 'Priya Raghunathan',
    email: 'priya.raghunathan@northwind.com',
    role: 'admin',
    roleSource: 'explicit',
    twoFactor: true,
    ssoEnabled: true,
    weakPassword: false,
    teams: ['platform', 'data'],
    projects: [
      { id: 'atlas', locked: false },
      { id: 'beacon', locked: false },
      { id: 'meridian', locked: false },
    ],
    canExport: true,
    lastActiveAt: NOW - 25 * MINUTE,
    joinedAt: NOW - 610 * DAY,
    joinedLabel: 'December 2024',
  },
  {
    id: 'm-marcus',
    name: 'Marcus Feld',
    email: 'marcus.feld@northwind.com',
    role: 'admin',
    roleSource: 'explicit',
    twoFactor: false,
    ssoEnabled: true,
    weakPassword: true,
    teams: ['platform', 'support'],
    projects: [
      { id: 'atlas', locked: false },
      { id: 'beacon', locked: false },
      { id: 'corvus', locked: false },
      { id: 'meridian', locked: false },
    ],
    canExport: true,
    lastActiveAt: NOW - 3 * DAY,
    joinedAt: NOW - 520 * DAY,
    joinedLabel: 'March 2025',
  },
  {
    id: 'm-salome',
    name: 'Salome Kestrel',
    email: 'salome.kestrel@northwind.com',
    role: 'analyst',
    roleSource: 'explicit',
    twoFactor: true,
    ssoEnabled: false,
    weakPassword: true,
    teams: ['revenue'],
    projects: [
      { id: 'beacon', locked: false },
      { id: 'corvus', locked: true },
    ],
    canExport: false,
    lastActiveAt: NOW - 2 * HOUR,
    joinedAt: NOW - 430 * DAY,
    joinedLabel: 'June 2025',
  },
  {
    id: 'm-ade',
    name: 'Ade Balogun',
    email: 'ade.balogun@northwind.com',
    role: 'analyst',
    roleSource: 'explicit',
    twoFactor: true,
    ssoEnabled: false,
    weakPassword: true,
    teams: ['data'],
    projects: [
      { id: 'beacon', locked: false },
      { id: 'meridian', locked: false },
    ],
    canExport: false,
    lastActiveAt: NOW - 6 * HOUR,
    joinedAt: NOW - 300 * DAY,
    joinedLabel: 'October 2025',
  },
  {
    id: 'm-ines',
    name: 'Ines Duarte',
    email: 'ines.duarte@northwind.com',
    role: 'analyst',
    roleSource: 'default',
    twoFactor: true,
    ssoEnabled: true,
    weakPassword: true,
    teams: ['data', 'design'],
    projects: [{ id: 'beacon', locked: false }],
    canExport: false,
    lastActiveAt: NOW - 31 * HOUR,
    joinedAt: NOW - 240 * DAY,
    joinedLabel: 'December 2025',
  },
  {
    id: 'm-tomas',
    name: 'Tomás Iglesias',
    email: 'tomas.iglesias@northwind.com',
    role: 'member',
    roleSource: 'default',
    twoFactor: false,
    ssoEnabled: true,
    weakPassword: true,
    teams: ['platform'],
    projects: [
      { id: 'atlas', locked: false },
      { id: 'meridian', locked: false },
    ],
    canExport: false,
    lastActiveAt: NOW - 27 * HOUR,
    joinedAt: NOW - 180 * DAY,
    joinedLabel: 'February 2026',
  },
  {
    id: 'm-wren',
    name: 'Wren Okafor',
    email: 'wren.okafor@northwind.com',
    role: 'member',
    roleSource: 'default',
    twoFactor: false,
    ssoEnabled: true,
    weakPassword: true,
    teams: ['design'],
    projects: [{ id: 'beacon', locked: false }],
    canExport: false,
    lastActiveAt: NOW - 9 * HOUR,
    joinedAt: NOW - 150 * DAY,
    joinedLabel: 'March 2026',
  },
  {
    id: 'm-meilin',
    name: 'Mei Lin Zhou',
    email: 'meilin.zhou@northwind.com',
    role: 'member',
    roleSource: 'default',
    twoFactor: true,
    ssoEnabled: true,
    weakPassword: false,
    teams: ['support'],
    projects: [{ id: 'atlas', locked: false }],
    canExport: false,
    lastActiveAt: NOW - 4 * DAY,
    joinedAt: NOW - 110 * DAY,
    joinedLabel: 'May 2026',
  },
  {
    id: 'm-jonah',
    name: 'Jonah Pryce',
    email: 'jonah@pryce.studio',
    role: 'viewer',
    roleSource: 'explicit',
    twoFactor: true,
    ssoEnabled: true,
    weakPassword: true,
    teams: ['revenue'],
    projects: [{ id: 'beacon', locked: false }],
    canExport: false,
    lastActiveAt: NOW - 11 * DAY,
    joinedAt: NOW - 75 * DAY,
    joinedLabel: 'June 2026',
  },
  {
    id: 'm-karel',
    name: 'Karel Novak',
    email: 'karel.novak@northwind.com',
    role: 'viewer',
    roleSource: 'default',
    twoFactor: true,
    ssoEnabled: true,
    weakPassword: true,
    teams: ['support'],
    projects: [{ id: 'meridian', locked: false }],
    canExport: false,
    lastActiveAt: NOW - 2 * DAY,
    joinedAt: NOW - 40 * DAY,
    joinedLabel: 'July 2026',
  },
  {
    id: 'm-rafael',
    name: 'Rafael Costa',
    email: 'rafael.costa@northwind.com',
    role: 'viewer',
    roleSource: 'default',
    twoFactor: true,
    ssoEnabled: true,
    weakPassword: true,
    teams: ['design'],
    projects: [{ id: 'beacon', locked: false }],
    canExport: false,
    lastActiveAt: NOW - 45 * MINUTE,
    joinedAt: NOW - 18 * DAY,
    joinedLabel: 'August 2026',
  },
];

/** Fast lookup from member id to member. */
export const MEMBER_BY_ID: ReadonlyMap<string, AccessMember> = new Map(
  MEMBERS.map((member) => [member.id, member]),
);

/**
 * The only Owner. Her role select and `Remove from workspace` item are blocked
 * everywhere so the workspace can never end up without an owner.
 */
export const SOLE_OWNER_MEMBER_ID = 'm-dana';

/** Suggested target of the Danger zone's transfer-ownership flow. */
export const TRANSFER_TARGET_MEMBER_ID = 'm-priya';

/** The three members with no second factor, listed by the 2FA blast-radius dialog. */
export const MEMBERS_WITHOUT_TWO_FACTOR_IDS: readonly string[] = MEMBERS.filter(
  (member) => !member.twoFactor,
).map((member) => member.id);

/** Member whose project grant is locked by their team membership. */
export const LOCKED_PROJECT_MEMBER_ID = 'm-salome';

/** Project that cannot be unchecked for {@link LOCKED_PROJECT_MEMBER_ID}. */
export const LOCKED_PROJECT_ID: AccessProjectId = 'corvus';

/* -------------------------------------------------------------------------- */
/* Invitations                                                                */
/* -------------------------------------------------------------------------- */

/** The three invitations waiting on the Invitations tab; exactly one bounced. */
export const INVITATIONS: readonly AccessInvitation[] = [
  {
    id: 'inv-harriet',
    email: 'harriet.vance@northwind.com',
    role: 'analyst',
    state: 'pending',
    sentAt: NOW - 2 * DAY,
    expiresAt: NOW + 5 * DAY,
    invitedBy: 'Dana Whitfield',
    bounceReason: null,
  },
  {
    id: 'inv-oskar',
    email: 'oskar.lindqvist@northwind.com',
    role: 'viewer',
    state: 'pending',
    sentAt: NOW - 6 * DAY - 12 * HOUR,
    expiresAt: NOW + 12 * HOUR,
    invitedBy: 'Priya Raghunathan',
    bounceReason: null,
  },
  {
    id: 'inv-casey',
    email: 'casey.lund@northwind.com',
    role: 'member',
    state: 'bounced',
    sentAt: NOW - 9 * HOUR,
    expiresAt: NOW + 6 * DAY + 15 * HOUR,
    invitedBy: 'Dana Whitfield',
    bounceReason: 'The mail server said the mailbox does not exist.',
  },
];

/** Addresses the invite flow always fails on, so the bounce path is deterministic. */
export const BOUNCED_INVITE_EMAILS: readonly string[] = [
  'casey.lund@northwind.com',
];

/* -------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The six live sessions. Exactly five started more than eight hours ago, so
 * shortening the session lifetime reads "Signs out 5 sessions older than
 * 8 hours on save."
 */
export const SESSIONS: readonly AccessSession[] = [
  {
    id: 's-01',
    memberId: 'm-dana',
    device: 'MacBook Pro',
    browser: 'Chrome 141',
    location: 'Berlin, Germany',
    ip: '88.132.44.7',
    startedAt: NOW - 4 * HOUR,
    lastActiveAt: NOW - 2 * MINUTE,
    isCurrent: true,
    revokeFails: false,
  },
  {
    id: 's-02',
    memberId: 'm-dana',
    device: 'iPhone 15',
    browser: 'Safari 18',
    location: 'Berlin, Germany',
    ip: '88.132.44.7',
    startedAt: NOW - 6 * DAY,
    lastActiveAt: NOW - 11 * HOUR,
    isCurrent: false,
    revokeFails: false,
  },
  {
    id: 's-03',
    memberId: 'm-marcus',
    device: 'Windows 11',
    browser: 'Chrome 140',
    location: 'Hamburg, Germany',
    ip: '91.44.208.17',
    startedAt: NOW - 12 * DAY,
    lastActiveAt: NOW - 3 * DAY,
    isCurrent: false,
    revokeFails: false,
  },
  {
    id: 's-04',
    memberId: 'm-priya',
    device: 'MacBook Air',
    browser: 'Firefox 132',
    location: 'Bengaluru, India',
    ip: '103.21.58.94',
    startedAt: NOW - 3 * DAY,
    lastActiveAt: NOW - 5 * HOUR,
    isCurrent: false,
    revokeFails: false,
  },
  {
    id: 's-05',
    memberId: 'm-tomas',
    device: 'Ubuntu 24.04',
    browser: 'Firefox 132',
    location: 'Kraków, Poland',
    ip: '195.117.22.140',
    startedAt: NOW - 9 * DAY,
    lastActiveAt: NOW - 27 * HOUR,
    isCurrent: false,
    revokeFails: true,
  },
  {
    id: 's-06',
    memberId: 'm-wren',
    device: 'iPad',
    browser: 'Safari 18',
    location: 'Lagos, Nigeria',
    ip: '41.58.176.9',
    startedAt: NOW - 16 * HOUR,
    lastActiveAt: NOW - 9 * HOUR,
    isCurrent: false,
    revokeFails: false,
  },
];

/** Fast lookup from session id to session. */
export const SESSION_BY_ID: ReadonlyMap<string, AccessSession> = new Map(
  SESSIONS.map((session) => [session.id, session]),
);

/** Sessions grouped by member, for the drawer's Sessions section. */
export const SESSIONS_BY_MEMBER_ID: ReadonlyMap<
  string,
  readonly AccessSession[]
> = new Map(
  MEMBERS.map((member) => [
    member.id,
    SESSIONS.filter((session) => session.memberId === member.id),
  ]),
);

/** The session rendering the page; its Revoke button is permanently disabled. */
export const CURRENT_SESSION_ID = 's-01';

/** The session whose revoke always fails, so the error path is deterministic. */
export const REVOKE_FAILS_SESSION_ID = 's-05';

/* -------------------------------------------------------------------------- */
/* API keys and webhooks                                                      */
/* -------------------------------------------------------------------------- */

/** The two live API keys; the first is overdue for rotation. */
export const API_KEYS: readonly AccessApiKey[] = [
  {
    id: 'key-billing-sync',
    name: 'Billing sync',
    prefix: 'ndw_live_a41f',
    scopes: ['read', 'write'],
    expiresIn: '90 days',
    enabled: true,
    createdAt: NOW - 420 * DAY,
    lastUsedAt: NOW - 18 * MINUTE,
    calls7d: 31904,
    integrationCount: 2,
    rotationDueAt: NOW - 60 * DAY,
    rotateFailsFirstAttempt: true,
    rotateAttempted: false,
  },
  {
    id: 'key-analytics-export',
    name: 'Analytics export',
    prefix: 'ndw_live_7c02',
    scopes: ['read'],
    expiresIn: '1 year',
    enabled: true,
    createdAt: NOW - 92 * DAY,
    lastUsedAt: NOW - 5 * HOUR,
    calls7d: 9304,
    integrationCount: 1,
    rotationDueAt: NOW + 273 * DAY,
    rotateFailsFirstAttempt: false,
    rotateAttempted: false,
  },
];

/** Fast lookup from key id to key. */
export const API_KEY_BY_ID: ReadonlyMap<string, AccessApiKey> = new Map(
  API_KEYS.map((key) => [key.id, key]),
);

/** The key whose first rotation attempt fails and whose second succeeds. */
export const ROTATION_FAILS_KEY_ID = 'key-billing-sync';

/** The key the Delete demo targets. */
export const DELETE_DEMO_KEY_ID = 'key-analytics-export';

/** The three webhook endpoints; exactly one is paused and one is failing. */
export const WEBHOOKS: readonly AccessWebhook[] = [
  {
    id: 'hook-billing',
    name: 'Billing hook',
    url: 'https://hooks.northwind.com/billing',
    events: ['billing.receipt', 'billing.failed'],
    active: true,
    deliveries7d: 214,
    failures7d: 0,
  },
  {
    id: 'hook-audit',
    name: 'Audit hook',
    url: 'https://hooks.northwind.com/audit',
    events: ['role.changed', 'key.rotated'],
    active: false,
    deliveries7d: 96,
    failures7d: 0,
  },
  {
    id: 'hook-pager',
    name: 'Pager hook',
    url: 'https://ops.northwind.com/pager',
    events: ['member.joined', 'key.rotated', 'billing.failed'],
    active: true,
    deliveries7d: 488,
    failures7d: 12,
  },
];

/** Fast lookup from webhook id to webhook. */
export const WEBHOOK_BY_ID: ReadonlyMap<string, AccessWebhook> = new Map(
  WEBHOOKS.map((hook) => [hook.id, hook]),
);

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

/** The three delivery channels; mobile push has no registered device. */
export const NOTIFICATION_CHANNELS: readonly AccessNotificationChannel[] = [
  {
    id: 'email',
    label: 'Email',
    detail: 'dana.whitfield@northwind.com',
    available: true,
  },
  {
    id: 'inApp',
    label: 'In-app',
    detail: 'Appears in the bell menu while you are signed in.',
    available: true,
  },
  {
    id: 'push',
    label: 'Mobile push',
    detail: 'No device is registered yet.',
    available: false,
  },
];

/** Fast lookup from channel id to channel. */
export const NOTIFICATION_CHANNEL_BY_ID: ReadonlyMap<
  AccessChannelId,
  AccessNotificationChannel
> = new Map(NOTIFICATION_CHANNELS.map((channel) => [channel.id, channel]));

/**
 * The six subscribable event types. Exactly four are emailed, so turning the
 * Email channel off reads "Turns off Email for 4 subscribed event types."
 */
export const NOTIFICATION_EVENTS: readonly AccessNotificationEvent[] = [
  {
    id: 'member-joined',
    label: 'Member joined',
    description: 'Someone accepts an invitation.',
    channels: { email: true, inApp: true, push: false },
  },
  {
    id: 'role-changed',
    label: 'Role changed',
    description: "A member's role is changed by anyone.",
    channels: { email: true, inApp: true, push: false },
  },
  {
    id: 'key-rotated',
    label: 'API key rotated',
    description: 'A key is rotated, created or deleted.',
    channels: { email: false, inApp: true, push: false },
  },
  {
    id: 'failed-sign-in',
    label: 'Failed sign-in',
    description: 'Three failed attempts on one account.',
    channels: { email: true, inApp: true, push: false },
  },
  {
    id: 'weekly-digest',
    label: 'Weekly digest',
    description: 'Your Monday summary.',
    channels: { email: true, inApp: false, push: false },
  },
  {
    id: 'billing-receipt',
    label: 'Billing receipt',
    description: 'Invoices and payment failures.',
    channels: { email: false, inApp: true, push: false },
  },
];

/** Fast lookup from notification event id to event. */
export const NOTIFICATION_EVENT_BY_ID: ReadonlyMap<
  AccessNotificationEventId,
  AccessNotificationEvent
> = new Map(NOTIFICATION_EVENTS.map((event) => [event.id, event]));

/* -------------------------------------------------------------------------- */
/* Logs and activity                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Twenty sign-in log entries, newest first. Exactly four are failures inside
 * the last seven days and exactly two are new-device sign-ins.
 */
export const SIGN_IN_EVENTS: readonly AccessSignInEvent[] = [
  {
    id: 'sl-01',
    at: NOW - 2 * MINUTE,
    actorName: 'Dana Whitfield',
    action: 'Signed in',
    ip: '88.132.44.7',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-02',
    at: NOW - 38 * MINUTE,
    actorName: 'Priya Raghunathan',
    action: 'Signed in',
    ip: '103.21.58.94',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-03',
    at: NOW - 2 * HOUR,
    actorName: 'Rafael Costa',
    action: 'Signed in',
    ip: '84.19.62.220',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-04',
    at: NOW - 4 * HOUR,
    actorName: 'Dana Whitfield',
    action: 'Signed in',
    ip: '88.132.44.7',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-05',
    at: NOW - 5 * HOUR,
    actorName: 'Ade Balogun',
    action: 'Failed sign-in',
    ip: '41.58.176.9',
    tone: 'danger',
    kind: 'failed',
  },
  {
    id: 'sl-06',
    at: NOW - 6 * HOUR,
    actorName: 'Ade Balogun',
    action: 'Signed in',
    ip: '41.58.176.9',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-07',
    at: NOW - 9 * HOUR,
    actorName: 'Wren Okafor',
    action: 'Signed in',
    ip: '41.58.176.9',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-08',
    at: NOW - 11 * HOUR,
    actorName: 'Dana Whitfield',
    action: 'Signed in',
    ip: '88.132.44.7',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-09',
    at: NOW - 16 * HOUR,
    actorName: 'Wren Okafor',
    action: 'Signed in from a new device',
    ip: '41.58.176.9',
    tone: 'warning',
    kind: 'new-device',
  },
  {
    id: 'sl-10',
    at: NOW - 21 * HOUR,
    actorName: 'Marcus Feld',
    action: 'Failed sign-in',
    ip: '91.44.208.17',
    tone: 'danger',
    kind: 'failed',
  },
  {
    id: 'sl-11',
    at: NOW - 27 * HOUR,
    actorName: 'Tomás Iglesias',
    action: 'Signed in',
    ip: '195.117.22.140',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-12',
    at: NOW - 31 * HOUR,
    actorName: 'Ines Duarte',
    action: 'Signed in',
    ip: '62.210.14.88',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-13',
    at: NOW - 2 * DAY,
    actorName: 'Karel Novak',
    action: 'Signed out',
    ip: '213.180.72.11',
    tone: 'default',
    kind: 'signed-out',
  },
  {
    id: 'sl-14',
    at: NOW - 2 * DAY - 7 * HOUR,
    actorName: 'Marcus Feld',
    action: 'Failed sign-in',
    ip: '91.44.208.17',
    tone: 'danger',
    kind: 'failed',
  },
  {
    id: 'sl-15',
    at: NOW - 3 * DAY,
    actorName: 'Marcus Feld',
    action: 'Signed in',
    ip: '91.44.208.17',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-16',
    at: NOW - 3 * DAY - 5 * HOUR,
    actorName: 'Salome Kestrel',
    action: 'Changed their password',
    ip: '77.246.30.5',
    tone: 'info',
    kind: 'password-changed',
  },
  {
    id: 'sl-17',
    at: NOW - 4 * DAY,
    actorName: 'Mei Lin Zhou',
    action: 'Signed in',
    ip: '116.66.201.34',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-18',
    at: NOW - 5 * DAY,
    actorName: 'Priya Raghunathan',
    action: 'Signed in from a new device',
    ip: '103.21.58.94',
    tone: 'warning',
    kind: 'new-device',
  },
  {
    id: 'sl-19',
    at: NOW - 6 * DAY,
    actorName: 'Dana Whitfield',
    action: 'Signed in',
    ip: '88.132.44.7',
    tone: 'success',
    kind: 'success',
  },
  {
    id: 'sl-20',
    at: NOW - 6 * DAY - 9 * HOUR,
    actorName: 'Jonah Pryce',
    action: 'Failed sign-in',
    ip: '92.40.118.203',
    tone: 'danger',
    kind: 'failed',
  },
];

/**
 * The five entries the aside's "Recent activity" timeline starts with. Saves,
 * invites, revokes, rotations and deletions prepend to a copy of this list.
 */
export const ACTIVITY_SEED: readonly AccessActivityEvent[] = [
  {
    id: 'act-01',
    at: NOW - 2 * HOUR,
    actorName: 'Priya Raghunathan',
    action: 'Rotated the Analytics export key',
    tone: 'success',
  },
  {
    id: 'act-02',
    at: NOW - 2 * DAY,
    actorName: 'Dana Whitfield',
    action: 'Invited harriet.vance@northwind.com',
    tone: 'info',
  },
  {
    id: 'act-03',
    at: NOW - 3 * DAY,
    actorName: 'Marcus Feld',
    action: 'Changed Wren Okafor from Viewer to Member',
    tone: 'info',
  },
  {
    id: 'act-04',
    at: NOW - 6 * DAY,
    actorName: 'Dana Whitfield',
    action: 'Set session lifetime to 30 days',
    tone: 'success',
  },
  {
    id: 'act-05',
    at: NOW - 9 * DAY,
    actorName: 'Priya Raghunathan',
    action: 'Added the Pager hook webhook',
    tone: 'info',
  },
];

/* -------------------------------------------------------------------------- */
/* Option lists                                                               */
/* -------------------------------------------------------------------------- */

/** Pronoun options for `profile.pronouns`. */
export const PRONOUNS: readonly MlvSelectOption<string>[] = [
  { label: 'she/her', value: 'she/her' },
  { label: 'he/him', value: 'he/him' },
  { label: 'they/them', value: 'they/them' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

/** The eight interface languages offered by `prefs.language`. */
export const LANGUAGES: readonly MlvSelectOption<string>[] = [
  { label: 'English (UK)', value: 'en-GB' },
  { label: 'English (US)', value: 'en-US' },
  { label: 'Deutsch', value: 'de-DE' },
  { label: 'Français', value: 'fr-FR' },
  { label: 'Español', value: 'es-ES' },
  { label: 'Português (BR)', value: 'pt-BR' },
  { label: '日本語', value: 'ja-JP' },
  { label: 'Nederlands', value: 'nl-NL' },
];

/**
 * The twelve time zones offered by `prefs.timezone`, grouped by continent.
 * Labels carry the UTC offset because the summary strip renders them verbatim.
 */
export const TIME_ZONES: readonly MlvSelectOption<string>[] = [
  { label: 'Europe/Lisbon · UTC+1', value: 'Europe/Lisbon', group: 'Europe' },
  { label: 'Europe/London · UTC+1', value: 'Europe/London', group: 'Europe' },
  { label: 'Europe/Berlin · UTC+2', value: 'Europe/Berlin', group: 'Europe' },
  { label: 'Europe/Warsaw · UTC+2', value: 'Europe/Warsaw', group: 'Europe' },
  {
    label: 'America/New_York · UTC−4',
    value: 'America/New_York',
    group: 'Americas',
  },
  {
    label: 'America/Chicago · UTC−5',
    value: 'America/Chicago',
    group: 'Americas',
  },
  {
    label: 'America/Denver · UTC−6',
    value: 'America/Denver',
    group: 'Americas',
  },
  {
    label: 'America/Los_Angeles · UTC−7',
    value: 'America/Los_Angeles',
    group: 'Americas',
  },
  {
    label: 'Asia/Kolkata · UTC+5:30',
    value: 'Asia/Kolkata',
    group: 'Asia-Pacific',
  },
  {
    label: 'Asia/Singapore · UTC+8',
    value: 'Asia/Singapore',
    group: 'Asia-Pacific',
  },
  { label: 'Asia/Tokyo · UTC+9', value: 'Asia/Tokyo', group: 'Asia-Pacific' },
  {
    label: 'Australia/Sydney · UTC+10',
    value: 'Australia/Sydney',
    group: 'Asia-Pacific',
  },
];

/** The four date formats offered by `prefs.dateFormat`. */
export const DATE_FORMATS: readonly MlvSelectOption<string>[] = [
  { label: '31/12/2026', value: 'dd/MM/yyyy' },
  { label: '12/31/2026', value: 'MM/dd/yyyy' },
  { label: '2026-12-31', value: 'yyyy-MM-dd' },
  { label: '31 Dec 2026', value: 'd MMM yyyy' },
];

/** The three first-day-of-week options offered by `prefs.weekStart`. */
export const WEEK_STARTS: readonly MlvSelectOption<AccessWeekStart>[] = [
  { label: 'Monday', value: 'monday' },
  { label: 'Sunday', value: 'sunday' },
  { label: 'Saturday', value: 'saturday' },
];

/** The three appearance options offered by `prefs.theme`. */
export const THEMES: readonly MlvSelectOption<AccessThemePreference>[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Match system', value: 'system' },
];

/** The three interface densities offered by `prefs.density`. */
export const DENSITIES: readonly MlvSelectOption<AccessDensityPreference>[] = [
  { label: 'Compact', value: 'compact' },
  { label: 'Comfortable', value: 'comfortable' },
  { label: 'Spacious', value: 'spacious' },
];

/** The four start-up destinations offered by `prefs.landingPage`. */
export const LANDING_PAGES: readonly MlvSelectOption<AccessLandingPage>[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'My work', value: 'my-work' },
  { label: 'Reports', value: 'reports' },
  { label: 'Last visited', value: 'last-visited' },
];

/** The seven weekday options offered by `notif.digestDay`. */
export const WEEKDAYS: readonly MlvSelectOption<string>[] = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
];

/** The three invite policies offered by `ws.invitePolicy`, widest first. */
export const INVITE_POLICIES: readonly MlvSelectOption<AccessInvitePolicy>[] = [
  { label: 'Anyone in the workspace', value: 'anyone' },
  { label: 'Admins and owners', value: 'admins' },
  { label: 'Owners only', value: 'owners' },
];

/** The three password policies offered by `sec.passwordPolicy`, weakest first. */
export const PASSWORD_POLICIES: readonly MlvSelectOption<AccessPasswordPolicy>[] =
  [
    { label: 'Standard — 8 characters', value: 'standard' },
    { label: 'Strong — 12 characters, mixed case', value: 'strong' },
    { label: 'Passphrase — 4 words', value: 'passphrase' },
  ];

/** The five session lifetimes offered by `sec.sessionLifetime`, shortest first. */
export const SESSION_LIFETIMES: readonly MlvSelectOption<AccessSessionLifetime>[] =
  [
    { label: '8 hours', value: '8 hours' },
    { label: '24 hours', value: '24 hours' },
    { label: '7 days', value: '7 days' },
    { label: '30 days', value: '30 days' },
    { label: '90 days', value: '90 days' },
  ];

/** The four expiry windows offered by `key.{id}.expiresIn`. */
export const KEY_EXPIRIES: readonly MlvSelectOption<AccessKeyExpiry>[] = [
  { label: '30 days', value: '30 days' },
  { label: '90 days', value: '90 days' },
  { label: '1 year', value: '1 year' },
  { label: 'Never', value: 'Never' },
];

/** The four scopes an API key can hold, in widening order. */
export const KEY_SCOPES: readonly MlvSelectOption<AccessApiScope>[] = [
  { label: 'Read', value: 'read' },
  { label: 'Write', value: 'write' },
  { label: 'Delete', value: 'delete' },
  { label: 'Admin', value: 'admin' },
];

/** The six events offered by `hook.{id}.events`. */
export const WEBHOOK_EVENTS: readonly MlvSelectOption<AccessWebhookEventId>[] =
  [
    { label: 'Member joined', value: 'member.joined' },
    { label: 'Member removed', value: 'member.removed' },
    { label: 'Role changed', value: 'role.changed' },
    { label: 'API key rotated', value: 'key.rotated' },
    { label: 'Billing receipt', value: 'billing.receipt' },
    { label: 'Payment failed', value: 'billing.failed' },
  ];

/** All five roles, for the roster and drawer role selects. */
export const ROLE_OPTIONS: readonly MlvSelectOption<AccessRoleId>[] = ROLES.map(
  (role) => ({ label: role.name, value: role.id }),
);

/** The four assignable roles; Owner is excluded from defaults and invitations. */
export const ASSIGNABLE_ROLE_OPTIONS: readonly MlvSelectOption<AccessRoleId>[] =
  ROLE_OPTIONS.filter((option) => option.value !== 'owner');

/** Team options for the drawer's Teams multi-select. */
export const TEAM_OPTIONS: readonly MlvSelectOption<AccessTeamId>[] = TEAMS.map(
  (team) => ({ label: team.label, value: team.id }),
);

/* -------------------------------------------------------------------------- */
/* Guards, phrases and codes                                                  */
/* -------------------------------------------------------------------------- */

/** Slugs the client rejects outright with "That address is reserved." */
export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'api',
  'app',
  'billing',
  'settings',
  'support',
  'www',
];

/**
 * Slugs that pass client validation and are rejected by the server, driving the
 * partial-apply path. Saving `ws.slug` with any of these always fails.
 */
export const TAKEN_SLUGS: readonly string[] = ['northwind', 'labs', 'nwl'];

/** The only code any step-up dialog accepts. */
export const STEP_UP_CODE = '481902';

/** Wrong codes allowed before the step-up locks out. */
export const STEP_UP_MAX_ATTEMPTS = 3;

/** How long a step-up stays locked after too many wrong codes. */
export const STEP_UP_LOCKOUT_MS = 30_000;

/** Phrase the transfer-ownership dialog requires, typed exactly. */
export const TRANSFER_CONFIRM_PHRASE = 'northwind-labs';

/** Phrase the delete-workspace dialog requires, typed exactly. */
export const DELETE_CONFIRM_PHRASE = 'delete northwind-labs';

/* -------------------------------------------------------------------------- */
/* Baseline draft                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The saved value of every staged field, keyed by field id. The page copies
 * this into its draft signal on first render; a field is dirty exactly while
 * its draft value differs from the value here.
 *
 * Per-record fields (`member.*`, `key.*`, `hook.*`) are derived from
 * {@link MEMBERS}, {@link API_KEYS} and {@link WEBHOOKS} instead, so they stay
 * in step with the seeded records.
 */
export const DEFAULTS: Readonly<Record<string, AccessDraftValue>> = {
  'profile.fullName': 'Dana Whitfield',
  'profile.displayName': 'Dana',
  'profile.title': 'Head of Platform',
  'profile.pronouns': 'she/her',
  'profile.email': 'dana.whitfield@northwind.com',
  'profile.recoveryEmail': 'dana@fastmail.com',
  'profile.showLocalTime': false,
  'profile.bio':
    'I look after the platform team and the data plumbing behind Northwind.',

  'prefs.language': 'en-GB',
  'prefs.timezone': 'Europe/Berlin',
  'prefs.dateFormat': 'dd/MM/yyyy',
  'prefs.weekStart': 'monday',
  'prefs.theme': 'system',
  'prefs.density': 'comfortable',
  'prefs.reduceMotion': false,
  'prefs.landingPage': 'overview',
  'prefs.shortcuts': true,

  'notif.channel.email': true,
  'notif.channel.inApp': true,
  'notif.channel.push': false,
  'notif.quietHours': true,
  'notif.quietStart': '22:00',
  'notif.quietEnd': '07:00',
  'notif.digest': true,
  'notif.digestDay': 'monday',
  'notif.digestTime': '08:00',

  'notif.sub.member-joined.email': true,
  'notif.sub.member-joined.inApp': true,
  'notif.sub.member-joined.push': false,
  'notif.sub.role-changed.email': true,
  'notif.sub.role-changed.inApp': true,
  'notif.sub.role-changed.push': false,
  'notif.sub.key-rotated.email': false,
  'notif.sub.key-rotated.inApp': true,
  'notif.sub.key-rotated.push': false,
  'notif.sub.failed-sign-in.email': true,
  'notif.sub.failed-sign-in.inApp': true,
  'notif.sub.failed-sign-in.push': false,
  'notif.sub.weekly-digest.email': true,
  'notif.sub.weekly-digest.inApp': false,
  'notif.sub.weekly-digest.push': false,
  'notif.sub.billing-receipt.email': false,
  'notif.sub.billing-receipt.inApp': true,
  'notif.sub.billing-receipt.push': false,

  'ws.name': 'Northwind Labs',
  'ws.slug': 'northwind-labs',
  'ws.description':
    'Data platform and billing infrastructure for the Northwind group.',
  'ws.billingEmail': 'finance@northwind.com',
  'ws.supportUrl': 'https://help.northwind.com',
  'ws.autoJoinDomains': ['nwl.dev'],
  'ws.invitePolicy': 'anyone',
  'ws.defaultRole': 'viewer',
  'ws.requireApproval': true,

  'roles.selfService': false,

  'sec.require2fa': false,
  'sec.enforceSso': false,
  'sec.passwordPolicy': 'standard',
  'sec.sessionLifetime': '30 days',
  'sec.signOutOnPasswordChange': true,
  'sec.allowedDomains': ['northwind.com'],
  'sec.alertRecipients': [
    'security@northwind.com',
    'dana.whitfield@northwind.com',
  ],
  'sec.alertFailedSignIn': true,
  'sec.alertNewDevice': true,
  'sec.alertKeyChange': false,
};
