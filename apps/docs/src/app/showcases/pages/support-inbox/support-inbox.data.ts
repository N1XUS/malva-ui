import type { MlvChatMessageData } from '@malva-ui/core/chat';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Anchor for every relative timestamp in the seeded inbox. */
const NOW = Date.now();

/** Channel a conversation arrived through. */
export type SupportChannel =
  | 'email'
  | 'chat'
  | 'phone'
  | 'social'
  | 'api'
  | 'form';

/** Workflow state of a conversation. */
export type SupportStatus =
  | 'open'
  | 'pending'
  | 'on-hold'
  | 'solved'
  | 'closed';

/** Triage priority assigned by the routing rules or an agent. */
export type SupportPriority = 'urgent' | 'high' | 'normal' | 'low';

/** Classification used for reporting and routing. */
export type SupportTicketType =
  | 'question'
  | 'incident'
  | 'problem'
  | 'bug'
  | 'task'
  | 'feature';

/** Commercial tier of the requester's account. */
export type SupportPlan =
  | 'Free'
  | 'Starter'
  | 'Growth'
  | 'Business'
  | 'Enterprise';

/** State of a single SLA clock. */
export type SupportSlaState = 'met' | 'due' | 'at-risk' | 'breached' | 'paused';

/** Rolled-up account health signal. */
export type SupportAccountHealth = 'healthy' | 'watch' | 'at-risk';

/** Who the conversation is currently waiting on. */
export type SupportWaitingOn = 'customer' | 'agent';

/** A teammate who can be assigned a conversation. */
export interface SupportAgentProfile {
  /** Stable id referenced by `SupportTicket.assigneeId`. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Work email. */
  readonly email: string;
  /** Job title shown in the assignee popover. */
  readonly role: string;
  /** Presence shown as a status dot. */
  readonly presence: 'online' | 'away' | 'offline';
  /** Conversations currently assigned, shown in the teammate list. */
  readonly load: number;
}

/** The person who opened the conversation. */
export interface SupportRequester {
  /** Stable id referenced by chat `authorId`. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Primary contact email. */
  readonly email: string;
  /** Optional phone, absent for chat-only requesters. */
  readonly phone: string | null;
  /** Job title inside the customer account. */
  readonly title: string;
  /** Whether the requester is currently in the messenger. */
  readonly online: boolean;
  /** Human-readable "last seen" for offline requesters. */
  readonly lastSeen: string;
  /** IANA-style location label. */
  readonly location: string;
  /** Local wall-clock time in the requester's timezone. */
  readonly localTime: string;
  /** Preferred reply language. */
  readonly language: string;
  /** Lifetime conversation count with support. */
  readonly conversations: number;
  /** Whether the email address completed verification. */
  readonly verified: boolean;
}

/** The company the requester belongs to. */
export interface SupportAccount {
  /** Legal/display company name. */
  readonly name: string;
  /** Primary domain, doubles as the account key. */
  readonly domain: string;
  /** Subscription tier. */
  readonly plan: SupportPlan;
  /** Purchased seats. */
  readonly seats: number;
  /** Monthly recurring revenue in USD. */
  readonly mrr: number;
  /** Next renewal date, ISO-8601. */
  readonly renewalIso: string;
  /** Composite health score, 0–100. */
  readonly healthScore: number;
  /** Bucketed health used for the tone of the score. */
  readonly health: SupportAccountHealth;
  /** Owning customer success manager, references a `SupportAgentProfile`. */
  readonly ownerId: string;
  /** Customer since, ISO-8601. */
  readonly customerSinceIso: string;
  /** Unpaid invoices at the time of writing. */
  readonly openInvoices: number;
}

/** Both SLA clocks for a conversation plus the policy they came from. */
export interface SupportSla {
  /** Name of the policy that produced the targets. */
  readonly policy: string;
  /** First-response clock state. */
  readonly firstResponseState: SupportSlaState;
  /** Human-readable first-response result, e.g. `'4m — met'`. */
  readonly firstResponseLabel: string;
  /** Resolution clock state. */
  readonly resolutionState: SupportSlaState;
  /** Human-readable time left or overdue, e.g. `'2h 40m left'`. */
  readonly resolutionLabel: string;
  /** Percent of the resolution window consumed, 0–100 (may exceed on breach). */
  readonly resolutionPercent: number;
}

/** Environment captured with the conversation. */
export interface SupportEnvironment {
  /** Product build the requester is running. */
  readonly appVersion: string;
  /** Browser name and version. */
  readonly browser: string;
  /** Operating system. */
  readonly os: string;
  /** Device form factor. */
  readonly device: string;
  /** BCP-47 locale. */
  readonly locale: string;
  /** IANA timezone. */
  readonly timezone: string;
  /** Coarse network region derived from the IP. */
  readonly ipRegion: string;
  /** Session replay identifier, copyable from the details panel. */
  readonly sessionId: string;
  /** Most recent client error, when one was captured. */
  readonly lastError: string | null;
}

/** A record in another system linked to this conversation. */
export interface SupportLinkedRecord {
  /** Which system the record lives in. */
  readonly kind: 'order' | 'invoice' | 'issue' | 'article' | 'subscription';
  /** Short human label. */
  readonly label: string;
  /** External reference id. */
  readonly reference: string;
  /** Secondary line, e.g. an amount or a status. */
  readonly meta: string;
}

/** One entry of the conversation audit trail. */
export interface SupportActivityEvent {
  /** Stable id. */
  readonly id: string;
  /** Epoch millis. */
  readonly at: number;
  /** Who performed the action. */
  readonly actor: string;
  /** What happened. */
  readonly action: string;
  /** Optional supporting detail. */
  readonly detail: string | null;
  /** Tone used for the timeline marker. */
  readonly tone: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

/** Customer satisfaction attached to the conversation. */
export interface SupportSatisfaction {
  /** 1–5 rating, or `null` while the survey is unanswered. */
  readonly rating: number | null;
  /** Free-text survey comment. */
  readonly comment: string | null;
  /** Rolling average across the requester's history. */
  readonly average: number;
  /** How many surveys the requester has answered. */
  readonly responses: number;
}

/** An agent-only note pinned to the conversation. */
export interface SupportNote {
  /** Stable id. */
  readonly id: string;
  /** Author, references a `SupportAgentProfile`. */
  readonly authorId: string;
  /** Epoch millis. */
  readonly at: number;
  /** Note body. */
  readonly text: string;
}

/** A full conversation row in the inbox. */
export interface SupportTicket {
  /** Public ticket reference, e.g. `'CS-4821'`. */
  readonly id: string;
  /** Conversation subject line. */
  readonly subject: string;
  /** Person who wrote in. */
  readonly requester: SupportRequester;
  /** Company the requester belongs to. */
  readonly account: SupportAccount;
  /** Arrival channel. */
  readonly channel: SupportChannel;
  /** Workflow state. */
  readonly status: SupportStatus;
  /** Triage priority. */
  readonly priority: SupportPriority;
  /** Reporting classification. */
  readonly type: SupportTicketType;
  /** Assigned teammate id, or `null` when unassigned. */
  readonly assigneeId: string | null;
  /** Owning team. */
  readonly team: string;
  /** Free-form labels. */
  readonly tags: readonly string[];
  /** Opened at, epoch millis. */
  readonly createdAt: number;
  /** Last activity, epoch millis. */
  readonly updatedAt: number;
  /** Unread inbound messages. */
  readonly unread: number;
  /** Whether the agent starred the conversation. */
  readonly starred: boolean;
  /** Which side owes the next reply. */
  readonly waitingOn: SupportWaitingOn;
  /** SLA clocks. */
  readonly sla: SupportSla;
  /** Captured environment. */
  readonly environment: SupportEnvironment;
  /** Linked records in other systems. */
  readonly linked: readonly SupportLinkedRecord[];
  /** Survey result. */
  readonly satisfaction: SupportSatisfaction;
  /** Audit trail, newest last. */
  readonly activity: readonly SupportActivityEvent[];
  /** Internal notes. */
  readonly notes: readonly SupportNote[];
  /** Message thread, oldest first. */
  readonly conversation: readonly MlvChatMessageData[];
}

/** The signed-in agent driving the showcase. */
export const CURRENT_AGENT: SupportAgentProfile = {
  id: 'agent-rivera',
  name: 'Dana Rivera',
  email: 'dana.rivera@acme.co',
  role: 'Senior Support Engineer',
  presence: 'online',
  load: 14,
};

/** Teammates available for assignment and mentions. */
export const AGENTS: readonly SupportAgentProfile[] = [
  CURRENT_AGENT,
  {
    id: 'agent-okafor',
    name: 'Tobi Okafor',
    email: 'tobi.okafor@acme.co',
    role: 'Support Engineer',
    presence: 'online',
    load: 9,
  },
  {
    id: 'agent-lindqvist',
    name: 'Maja Lindqvist',
    email: 'maja.lindqvist@acme.co',
    role: 'Billing Specialist',
    presence: 'away',
    load: 6,
  },
  {
    id: 'agent-navarro',
    name: 'Luis Navarro',
    email: 'luis.navarro@acme.co',
    role: 'Escalation Lead',
    presence: 'online',
    load: 4,
  },
  {
    id: 'agent-chen',
    name: 'Wei Chen',
    email: 'wei.chen@acme.co',
    role: 'Customer Success Manager',
    presence: 'offline',
    load: 2,
  },
];

/** Fast lookup from agent id to profile. */
export const AGENT_BY_ID: ReadonlyMap<string, SupportAgentProfile> = new Map(
  AGENTS.map((agent) => [agent.id, agent]),
);

const ACCOUNT_HELIOS: SupportAccount = {
  name: 'Helios Freight',
  domain: 'heliosfreight.com',
  plan: 'Enterprise',
  seats: 480,
  mrr: 18_400,
  renewalIso: '2026-11-30',
  healthScore: 62,
  health: 'watch',
  ownerId: 'agent-chen',
  customerSinceIso: '2021-03-08',
  openInvoices: 0,
};

const ACCOUNT_NORTHWIND: SupportAccount = {
  name: 'Northwind Labs',
  domain: 'northwind.dev',
  plan: 'Business',
  seats: 120,
  mrr: 4_950,
  renewalIso: '2026-09-14',
  healthScore: 88,
  health: 'healthy',
  ownerId: 'agent-chen',
  customerSinceIso: '2023-01-22',
  openInvoices: 0,
};

const ACCOUNT_MERIDIAN: SupportAccount = {
  name: 'Meridian Health',
  domain: 'meridianhealth.org',
  plan: 'Enterprise',
  seats: 1_250,
  mrr: 31_200,
  renewalIso: '2027-02-01',
  healthScore: 41,
  health: 'at-risk',
  ownerId: 'agent-navarro',
  customerSinceIso: '2019-06-17',
  openInvoices: 2,
};

const ACCOUNT_PAPERTRAIL: SupportAccount = {
  name: 'Papertrail Studio',
  domain: 'papertrail.studio',
  plan: 'Growth',
  seats: 24,
  mrr: 720,
  renewalIso: '2026-08-29',
  healthScore: 74,
  health: 'healthy',
  ownerId: 'agent-lindqvist',
  customerSinceIso: '2024-05-02',
  openInvoices: 1,
};

const ACCOUNT_BLUEFIN: SupportAccount = {
  name: 'Bluefin Capital',
  domain: 'bluefincap.com',
  plan: 'Business',
  seats: 90,
  mrr: 3_600,
  renewalIso: '2026-10-05',
  healthScore: 79,
  health: 'healthy',
  ownerId: 'agent-chen',
  customerSinceIso: '2022-09-19',
  openInvoices: 0,
};

const ACCOUNT_KESTREL: SupportAccount = {
  name: 'Kestrel Robotics',
  domain: 'kestrelrobotics.io',
  plan: 'Starter',
  seats: 8,
  mrr: 152,
  renewalIso: '2026-09-01',
  healthScore: 55,
  health: 'watch',
  ownerId: 'agent-lindqvist',
  customerSinceIso: '2025-11-11',
  openInvoices: 0,
};

const ACCOUNT_SOLSTICE: SupportAccount = {
  name: 'Solstice Retail',
  domain: 'solsticeretail.com',
  plan: 'Growth',
  seats: 36,
  mrr: 1_080,
  renewalIso: '2026-12-12',
  healthScore: 83,
  health: 'healthy',
  ownerId: 'agent-chen',
  customerSinceIso: '2024-02-14',
  openInvoices: 0,
};

const ACCOUNT_VANTAGE: SupportAccount = {
  name: 'Vantage Media',
  domain: 'vantagemedia.tv',
  plan: 'Free',
  seats: 3,
  mrr: 0,
  renewalIso: '—',
  healthScore: 34,
  health: 'at-risk',
  ownerId: 'agent-lindqvist',
  customerSinceIso: '2026-07-30',
  openInvoices: 0,
};

/**
 * The seeded inbox. Fixture order only — the list column sorts at render
 * time, so nothing here depends on this array's ordering.
 */
export const TICKETS: readonly SupportTicket[] = [
  {
    id: 'CS-4821',
    subject: 'SAML login loops after the 4.12 rollout',
    requester: {
      id: 'req-amara',
      name: 'Amara Osei',
      email: 'amara.osei@heliosfreight.com',
      phone: '+1 (312) 555-0148',
      title: 'Director of IT Operations',
      online: true,
      lastSeen: 'Active now',
      location: 'Chicago, US',
      localTime: '09:14',
      language: 'English (US)',
      conversations: 27,
      verified: true,
    },
    account: ACCOUNT_HELIOS,
    channel: 'email',
    status: 'open',
    priority: 'urgent',
    type: 'incident',
    assigneeId: 'agent-rivera',
    team: 'Platform',
    tags: ['sso', 'saml', 'okta', 'regression', 'p1'],
    createdAt: NOW - 5 * HOUR - 5 * MINUTE,
    updatedAt: NOW - 4 * MINUTE,
    unread: 3,
    starred: true,
    waitingOn: 'agent',
    sla: {
      policy: 'Enterprise — 24/5, 15m first response',
      firstResponseState: 'met',
      firstResponseLabel: '6m — met',
      resolutionState: 'breached',
      resolutionLabel: 'Overdue by 1h 05m',
      resolutionPercent: 100,
    },
    environment: {
      appVersion: '4.12.3',
      browser: 'Chrome 141',
      os: 'Windows 11',
      device: 'Desktop',
      locale: 'en-US',
      timezone: 'America/Chicago',
      ipRegion: 'US — Illinois',
      sessionId: 'ses_9fb1c4a7e230',
      lastError: 'SAMLResponse: InvalidNameIDPolicy (code 3021)',
    },
    linked: [
      {
        kind: 'issue',
        label: 'Engineering issue',
        reference: 'ENG-7734',
        meta: 'In progress · Identity squad',
      },
      {
        kind: 'subscription',
        label: 'Subscription',
        reference: 'sub_helios_ent',
        meta: 'Enterprise · 480 seats',
      },
      {
        kind: 'article',
        label: 'Help centre',
        reference: 'Configuring SAML NameID',
        meta: 'Suggested to requester',
      },
    ],
    satisfaction: {
      rating: null,
      comment: null,
      average: 4.6,
      responses: 19,
    },
    activity: [
      {
        id: 'a1',
        at: NOW - 5 * HOUR - 5 * MINUTE,
        actor: 'Amara Osei',
        action: 'Opened the conversation by email',
        detail: 'Routed to Platform by the "SSO keywords" rule',
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 4 * HOUR - 59 * MINUTE,
        actor: 'Dana Rivera',
        action: 'Sent the first reply',
        detail: 'First response SLA met with 9m to spare',
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 2 * HOUR - 40 * MINUTE,
        actor: 'Dana Rivera',
        action: 'Raised priority to Urgent',
        detail: 'Confirmed multi-user impact',
        tone: 'warning',
      },
      {
        id: 'a4',
        at: NOW - 2 * HOUR - 12 * MINUTE,
        actor: 'Luis Navarro',
        action: 'Linked ENG-7734',
        detail: 'NameID policy regression in 4.12',
        tone: 'info',
      },
      {
        id: 'a5',
        at: NOW - 65 * MINUTE,
        actor: 'System',
        action: 'Resolution SLA breached',
        detail: 'Target was 4h from creation',
        tone: 'danger',
      },
    ],
    notes: [
      {
        id: 'CS-4821-n1',
        authorId: 'agent-navarro',
        at: NOW - 2 * HOUR - 10 * MINUTE,
        text: 'Identity squad confirmed the regression — 4.12 started sending persistent NameID where Helios expects emailAddress. Hotfix 4.12.4 is cut, waiting on the release train at 11:00 CT.',
      },
      {
        id: 'CS-4821-n2',
        authorId: 'agent-rivera',
        at: NOW - 38 * MINUTE,
        text: 'Do NOT suggest the "clear cookies" macro here — it logs the remaining working sessions out too.',
      },
    ],
    conversation: [
      {
        id: 'CS-4821-m1',
        authorId: 'req-amara',
        text: 'We upgraded to 4.12 last night and now every SSO login bounces back to the Okta tile. Roughly 300 dispatchers cannot get in and the night shift starts in two hours.',
        timestamp: NOW - 5 * HOUR - 5 * MINUTE,
      },
      {
        id: 'CS-4821-m2',
        authorId: 'agent-rivera',
        text: 'Thanks Amara — I have this as a P1 and I am on it now. Can you confirm the exact error on the Okta side?',
        timestamp: NOW - 4 * HOUR - 59 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4821-m3',
        authorId: 'req-amara',
        text: 'Okta system log says "InvalidNameIDPolicy". Screenshot attached.',
        timestamp: NOW - 4 * HOUR - 47 * MINUTE,
        attachments: [
          {
            id: 'CS-4821-att1',
            kind: 'image',
            src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=960&q=70',
            alt: 'Okta system log showing InvalidNameIDPolicy',
            width: 960,
            height: 600,
          },
        ],
      },
      {
        id: 'CS-4821-m4',
        authorId: 'agent-rivera',
        text: 'That confirms it. 4.12 changed the default NameID format to persistent; your app integration still expects emailAddress. Engineering has a hotfix cut as 4.12.4.',
        timestamp: NOW - 2 * HOUR - 30 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4821-m5',
        authorId: 'agent-rivera',
        text: 'In the meantime you can unblock everyone by setting the Okta app Name ID format to "Unspecified". That takes effect immediately and stays compatible after the hotfix.',
        timestamp: NOW - 2 * HOUR - 29 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4821-m6',
        authorId: 'req-amara',
        text: 'Tried it on a test group — those users are in. Rolling it out to the rest now.',
        timestamp: NOW - 95 * MINUTE,
      },
      {
        id: 'CS-4821-m7',
        authorId: 'req-amara',
        text: 'Update: dispatchers are back in. Still bouncing for the mobile app though, about a dozen drivers.',
        timestamp: NOW - 12 * MINUTE,
        replyTo: {
          id: 'CS-4821-m5',
          authorId: 'agent-rivera',
          text: 'In the meantime you can unblock everyone by setting the Okta app Name ID format to "Unspecified".',
          timestamp: NOW - 2 * HOUR - 29 * MINUTE,
        },
      },
      {
        id: 'CS-4821-m8',
        authorId: 'req-amara',
        text: 'Do we need a separate change for the mobile client, or does it pick up the same setting?',
        timestamp: NOW - 4 * MINUTE,
      },
    ],
  },
  {
    id: 'CS-4818',
    subject: 'Invoice 2026-0774 charged 1,250 seats instead of 1,150',
    requester: {
      id: 'req-priya',
      name: 'Priya Raman',
      email: 'p.raman@meridianhealth.org',
      phone: '+1 (617) 555-0192',
      title: 'Procurement Manager',
      online: false,
      lastSeen: '22 minutes ago',
      location: 'Boston, US',
      localTime: '10:14',
      language: 'English (US)',
      conversations: 41,
      verified: true,
    },
    account: ACCOUNT_MERIDIAN,
    channel: 'email',
    status: 'pending',
    priority: 'high',
    type: 'question',
    assigneeId: 'agent-lindqvist',
    team: 'Billing',
    tags: ['billing', 'invoice', 'seats', 'renewal-risk'],
    createdAt: NOW - 1 * DAY - 2 * HOUR,
    updatedAt: NOW - 52 * MINUTE,
    unread: 1,
    starred: false,
    waitingOn: 'agent',
    sla: {
      policy: 'Enterprise — 24/5, 15m first response',
      firstResponseState: 'met',
      firstResponseLabel: '11m — met',
      resolutionState: 'at-risk',
      resolutionLabel: '2h 10m left',
      resolutionPercent: 82,
    },
    environment: {
      appVersion: '4.11.9',
      browser: 'Safari 19',
      os: 'macOS 15.4',
      device: 'Desktop',
      locale: 'en-US',
      timezone: 'America/New_York',
      ipRegion: 'US — Massachusetts',
      sessionId: 'ses_2c07de55b184',
      lastError: null,
    },
    linked: [
      {
        kind: 'invoice',
        label: 'Invoice',
        reference: '2026-0774',
        meta: '$31,200.00 · Overdue 6 days',
      },
      {
        kind: 'subscription',
        label: 'Subscription',
        reference: 'sub_meridian_ent',
        meta: 'Enterprise · renews 01 Feb 2027',
      },
    ],
    satisfaction: {
      rating: null,
      comment: null,
      average: 3.4,
      responses: 12,
    },
    activity: [
      {
        id: 'a1',
        at: NOW - 1 * DAY - 2 * HOUR,
        actor: 'Priya Raman',
        action: 'Opened the conversation by email',
        detail: null,
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 1 * DAY - 1 * HOUR - 49 * MINUTE,
        actor: 'Maja Lindqvist',
        action: 'Sent the first reply',
        detail: null,
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 20 * HOUR,
        actor: 'Maja Lindqvist',
        action: 'Set status to Pending',
        detail: 'Waiting on the billing team to re-issue',
        tone: 'info',
      },
      {
        id: 'a4',
        at: NOW - 52 * MINUTE,
        actor: 'Priya Raman',
        action: 'Replied',
        detail: 'Escalation risk flagged by the health score rule',
        tone: 'warning',
      },
    ],
    notes: [
      {
        id: 'CS-4818-n1',
        authorId: 'agent-chen',
        at: NOW - 19 * HOUR,
        text: 'Renewal conversation is already tense — Meridian health score dropped to 41 after the March outage. Keep the tone precise and give exact dates, no "shortly".',
      },
    ],
    conversation: [
      {
        id: 'CS-4818-m1',
        authorId: 'req-priya',
        text: 'Invoice 2026-0774 bills 1,250 seats. Our contract amendment from January reduced us to 1,150. Finance will not release payment against the current document.',
        timestamp: NOW - 1 * DAY - 2 * HOUR,
      },
      {
        id: 'CS-4818-m2',
        authorId: 'agent-lindqvist',
        text: 'You are right — the amendment landed after the billing run cut off, so the old seat count was invoiced. I have requested a credit note plus a corrected invoice.',
        timestamp: NOW - 1 * DAY - 1 * HOUR - 49 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4818-m3',
        authorId: 'agent-lindqvist',
        text: 'The credit note is CN-2026-0181 for $2,496.00. The corrected invoice will be issued on the next billing run.',
        timestamp: NOW - 20 * HOUR,
        status: 'read',
      },
      {
        id: 'CS-4818-m4',
        authorId: 'req-priya',
        text: 'Thanks. "Next billing run" is the part finance is stuck on — they need a date to enter in the payment schedule. Can you give me the exact day?',
        timestamp: NOW - 52 * MINUTE,
      },
    ],
  },
  {
    id: 'CS-4815',
    subject: 'Hitting 429s on the events API well under our quota',
    requester: {
      id: 'req-jonas',
      name: 'Jonas Vidal',
      email: 'jonas@northwind.dev',
      phone: null,
      title: 'Staff Engineer',
      online: true,
      lastSeen: 'Active now',
      location: 'Lisbon, PT',
      localTime: '15:14',
      language: 'English (UK)',
      conversations: 9,
      verified: true,
    },
    account: ACCOUNT_NORTHWIND,
    channel: 'chat',
    status: 'open',
    priority: 'normal',
    type: 'question',
    assigneeId: 'agent-rivera',
    team: 'Platform',
    tags: ['api', 'rate-limit', 'integration'],
    createdAt: NOW - 5 * HOUR,
    updatedAt: NOW - 26 * MINUTE,
    unread: 0,
    starred: false,
    waitingOn: 'customer',
    sla: {
      policy: 'Business — 8/5, 1h first response',
      firstResponseState: 'met',
      firstResponseLabel: '3m — met',
      resolutionState: 'due',
      resolutionLabel: '5h 30m left',
      resolutionPercent: 31,
    },
    environment: {
      appVersion: 'API v3',
      browser: 'node-fetch 3.3',
      os: 'Debian 12',
      device: 'Server',
      locale: 'en-GB',
      timezone: 'Europe/Lisbon',
      ipRegion: 'PT — Lisbon',
      sessionId: 'ses_71ad0e9c4c26',
      lastError: 'HTTP 429 — burst_limit_exceeded',
    },
    linked: [
      {
        kind: 'article',
        label: 'Help centre',
        reference: 'Events API rate limits',
        meta: 'Sent to requester',
      },
    ],
    satisfaction: {
      rating: null,
      comment: null,
      average: 4.75,
      responses: 4,
    },
    activity: [
      {
        id: 'a1',
        at: NOW - 5 * HOUR,
        actor: 'Jonas Vidal',
        action: 'Started a chat',
        detail: 'From the in-app messenger',
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 4 * HOUR - 57 * MINUTE,
        actor: 'Dana Rivera',
        action: 'Sent the first reply',
        detail: null,
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 26 * MINUTE,
        actor: 'Jonas Vidal',
        action: 'Replied',
        detail: null,
        tone: 'default',
      },
    ],
    notes: [],
    conversation: [
      {
        id: 'CS-4815-m1',
        authorId: 'req-jonas',
        text: 'We are getting 429s from /v3/events at around 40k requests an hour. Our plan quota says 250k/hour, so something else is throttling us.',
        timestamp: NOW - 5 * HOUR,
      },
      {
        id: 'CS-4815-m2',
        authorId: 'agent-rivera',
        text: 'The hourly quota is not what you are hitting — there is a separate burst limit of 50 requests per second per token. A batch job firing all at once trips it even when the hourly number looks fine.',
        timestamp: NOW - 4 * HOUR - 57 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4815-m3',
        authorId: 'agent-rivera',
        text: 'The response includes a Retry-After header — honouring it with exponential backoff is the supported pattern. Here is the reference: Events API rate limits.',
        timestamp: NOW - 4 * HOUR - 55 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4815-m4',
        authorId: 'req-jonas',
        text: 'That is it. Our nightly sync fans out 500 concurrent writes. Adding a token bucket in front of it now.',
        timestamp: NOW - 3 * HOUR,
      },
      {
        id: 'CS-4815-m5',
        authorId: 'req-jonas',
        text: 'Burst limit is per-second, not per-minute — that explains it, thanks!',
        timestamp: NOW - 26 * MINUTE,
      },
    ],
  },
  {
    id: 'CS-4812',
    subject: 'Refund for the duplicate August charge',
    requester: {
      id: 'req-elena',
      name: 'Elena Fischer',
      email: 'elena@papertrail.studio',
      phone: '+49 30 555 0173',
      title: 'Studio Owner',
      online: false,
      lastSeen: '3 hours ago',
      location: 'Berlin, DE',
      localTime: '16:14',
      language: 'German',
      conversations: 6,
      verified: true,
    },
    account: ACCOUNT_PAPERTRAIL,
    channel: 'email',
    status: 'solved',
    priority: 'normal',
    type: 'task',
    assigneeId: 'agent-lindqvist',
    team: 'Billing',
    tags: ['billing', 'refund', 'duplicate-charge'],
    createdAt: NOW - 2 * DAY - 4 * HOUR,
    updatedAt: NOW - 1 * DAY - 1 * HOUR,
    unread: 0,
    starred: false,
    waitingOn: 'customer',
    sla: {
      policy: 'Growth — 8/5, 4h first response',
      firstResponseState: 'met',
      firstResponseLabel: '48m — met',
      resolutionState: 'met',
      resolutionLabel: 'Resolved in 1d 1h',
      resolutionPercent: 100,
    },
    environment: {
      appVersion: '4.11.9',
      browser: 'Firefox 140',
      os: 'macOS 15.3',
      device: 'Desktop',
      locale: 'de-DE',
      timezone: 'Europe/Berlin',
      ipRegion: 'DE — Berlin',
      sessionId: 'ses_4d92b7f10aa3',
      lastError: null,
    },
    linked: [
      {
        kind: 'invoice',
        label: 'Invoice',
        reference: '2026-0731',
        meta: '$720.00 · Refunded',
      },
      {
        kind: 'order',
        label: 'Payment',
        reference: 'pay_3QK18xR2',
        meta: 'Visa ending 4417',
      },
    ],
    satisfaction: {
      rating: 5,
      comment: 'Sorted in under a day and the explanation was clear. Perfect.',
      average: 4.8,
      responses: 5,
    },
    activity: [
      {
        id: 'a1',
        at: NOW - 2 * DAY - 4 * HOUR,
        actor: 'Elena Fischer',
        action: 'Opened the conversation by email',
        detail: null,
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 2 * DAY - 3 * HOUR - 12 * MINUTE,
        actor: 'Maja Lindqvist',
        action: 'Sent the first reply',
        detail: null,
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 1 * DAY - 3 * HOUR,
        actor: 'Maja Lindqvist',
        action: 'Issued a refund and solved the conversation',
        detail: '$720.00 to pay_3QK18xR2',
        tone: 'success',
      },
      {
        id: 'a4',
        at: NOW - 1 * DAY - 1 * HOUR,
        actor: 'Elena Fischer',
        action: 'Rated the conversation 5 / 5',
        detail: null,
        tone: 'success',
      },
    ],
    notes: [],
    conversation: [
      {
        id: 'CS-4812-m1',
        authorId: 'req-elena',
        text: 'We were charged twice for August — once on the 1st and again on the 3rd. Same amount, same card.',
        timestamp: NOW - 2 * DAY - 4 * HOUR,
      },
      {
        id: 'CS-4812-m2',
        authorId: 'agent-lindqvist',
        text: 'Confirmed — a retry on a webhook timeout created a second successful charge. That is on us. I have queued the refund for the duplicate.',
        timestamp: NOW - 2 * DAY - 3 * HOUR - 12 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4812-m3',
        authorId: 'agent-lindqvist',
        text: 'Refund confirmed, $720.00 back on the card ending 4417. Sorry for the detour!',
        timestamp: NOW - 1 * DAY - 3 * HOUR,
        status: 'read',
      },
      {
        id: 'CS-4812-m4',
        authorId: 'req-elena',
        text: 'Landed this morning. Thank you for the quick turnaround.',
        timestamp: NOW - 1 * DAY - 1 * HOUR - 30 * MINUTE,
      },
    ],
  },
  {
    id: 'CS-4809',
    subject:
      'Gantt view drops dependencies when you drag across a sprint boundary',
    requester: {
      id: 'req-sam',
      name: 'Sam Whitaker',
      email: 'sam.w@kestrelrobotics.io',
      phone: null,
      title: 'Project Lead',
      online: false,
      lastSeen: '1 hour ago',
      location: 'Bristol, UK',
      localTime: '15:14',
      language: 'English (UK)',
      conversations: 3,
      verified: true,
    },
    account: ACCOUNT_KESTREL,
    channel: 'form',
    status: 'open',
    priority: 'normal',
    type: 'bug',
    assigneeId: null,
    team: 'Unassigned',
    tags: ['gantt', 'dependencies', 'repro-attached'],
    createdAt: NOW - 7 * HOUR,
    updatedAt: NOW - 1 * HOUR - 10 * MINUTE,
    unread: 2,
    starred: false,
    waitingOn: 'agent',
    sla: {
      policy: 'Starter — 8/5, 8h first response',
      firstResponseState: 'at-risk',
      firstResponseLabel: '58m left',
      resolutionState: 'due',
      resolutionLabel: '2d 1h left',
      resolutionPercent: 18,
    },
    environment: {
      appVersion: '4.12.3',
      browser: 'Chrome 141',
      os: 'Ubuntu 24.04',
      device: 'Desktop',
      locale: 'en-GB',
      timezone: 'Europe/London',
      ipRegion: 'UK — Bristol',
      sessionId: 'ses_b83f5610c9d2',
      lastError: 'TypeError: Cannot read properties of null (reading "laneId")',
    },
    linked: [
      {
        kind: 'issue',
        label: 'Engineering issue',
        reference: 'ENG-7702',
        meta: 'Triage · Planning squad',
      },
    ],
    satisfaction: { rating: null, comment: null, average: 4.2, responses: 2 },
    activity: [
      {
        id: 'a1',
        at: NOW - 7 * HOUR,
        actor: 'Sam Whitaker',
        action: 'Submitted the support form',
        detail: 'Console log attached automatically',
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 1 * HOUR - 10 * MINUTE,
        actor: 'Sam Whitaker',
        action: 'Added a screen recording',
        detail: null,
        tone: 'default',
      },
    ],
    notes: [],
    conversation: [
      {
        id: 'CS-4809-m1',
        authorId: 'req-sam',
        text: 'If I drag a task from sprint 12 into sprint 13 on the Gantt, its dependency arrows disappear. Reloading brings them back, so the data is fine — it is the view.',
        timestamp: NOW - 7 * HOUR,
      },
      {
        id: 'CS-4809-m2',
        authorId: 'req-sam',
        text: 'Screen recording attached — it happens every time on the second drag.',
        timestamp: NOW - 1 * HOUR - 10 * MINUTE,
        attachments: [
          {
            id: 'CS-4809-att1',
            kind: 'video',
            src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            alt: 'Screen recording of the Gantt dependency bug',
            width: 960,
            height: 540,
            duration: 34,
          },
        ],
      },
    ],
  },
  {
    id: 'CS-4805',
    subject: 'Can we pin all workspace data to the EU region?',
    requester: {
      id: 'req-henrik',
      name: 'Henrik Sørensen',
      email: 'h.sorensen@bluefincap.com',
      phone: '+45 33 55 01 26',
      title: 'Head of Compliance',
      online: false,
      lastSeen: 'Yesterday',
      location: 'Copenhagen, DK',
      localTime: '16:14',
      language: 'English (UK)',
      conversations: 14,
      verified: true,
    },
    account: ACCOUNT_BLUEFIN,
    channel: 'email',
    status: 'on-hold',
    priority: 'high',
    type: 'task',
    assigneeId: 'agent-navarro',
    team: 'Compliance',
    tags: ['data-residency', 'gdpr', 'migration'],
    createdAt: NOW - 4 * DAY,
    updatedAt: NOW - 2 * DAY - 6 * HOUR,
    unread: 0,
    starred: true,
    waitingOn: 'agent',
    sla: {
      policy: 'Business — 8/5, 1h first response',
      firstResponseState: 'met',
      firstResponseLabel: '22m — met',
      resolutionState: 'paused',
      resolutionLabel: 'Paused — awaiting migration window',
      resolutionPercent: 55,
    },
    environment: {
      appVersion: '4.12.1',
      browser: 'Edge 141',
      os: 'Windows 11',
      device: 'Desktop',
      locale: 'en-GB',
      timezone: 'Europe/Copenhagen',
      ipRegion: 'DK — Capital Region',
      sessionId: 'ses_e410c7a92bb5',
      lastError: null,
    },
    linked: [
      {
        kind: 'issue',
        label: 'Migration ticket',
        reference: 'OPS-1188',
        meta: 'Scheduled · window pending',
      },
      {
        kind: 'article',
        label: 'Help centre',
        reference: 'Regional data residency',
        meta: 'Sent to requester',
      },
    ],
    satisfaction: { rating: null, comment: null, average: 4.5, responses: 8 },
    activity: [
      {
        id: 'a1',
        at: NOW - 4 * DAY,
        actor: 'Henrik Sørensen',
        action: 'Opened the conversation by email',
        detail: null,
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 4 * DAY + 22 * MINUTE,
        actor: 'Luis Navarro',
        action: 'Sent the first reply',
        detail: null,
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 2 * DAY - 6 * HOUR,
        actor: 'Luis Navarro',
        action: 'Placed the conversation on hold',
        detail: 'SLA paused until infrastructure confirms the window',
        tone: 'info',
      },
    ],
    notes: [
      {
        id: 'CS-4805-n1',
        authorId: 'agent-navarro',
        at: NOW - 2 * DAY - 6 * HOUR,
        text: 'Infra can only do the region move during a maintenance window; next two are the 4th and the 18th. Do not promise a date before OPS-1188 is scheduled.',
      },
    ],
    conversation: [
      {
        id: 'CS-4805-m1',
        authorId: 'req-henrik',
        text: 'Our regulator now requires all client data to stay inside the EU. Can our workspace be pinned to the EU region, and what is involved?',
        timestamp: NOW - 4 * DAY,
      },
      {
        id: 'CS-4805-m2',
        authorId: 'agent-navarro',
        text: 'Yes — EU residency is available on Business and above. It is a one-way migration of the workspace, typically 2–4 hours of read-only time, and it needs a signed DPA addendum.',
        timestamp: NOW - 4 * DAY + 22 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4805-m3',
        authorId: 'req-henrik',
        text: 'Legal signed off on the DPA — waiting on the migration window from your side.',
        timestamp: NOW - 2 * DAY - 7 * HOUR,
      },
      {
        id: 'CS-4805-m4',
        authorId: 'agent-navarro',
        text: 'Received, thank you. I am holding this open with infrastructure and will come back with the exact window as soon as it is booked.',
        timestamp: NOW - 2 * DAY - 6 * HOUR,
        status: 'read',
      },
    ],
  },
  {
    id: 'CS-4802',
    subject: 'Bulk CSV import stops at row 5,000',
    requester: {
      id: 'req-noor',
      name: 'Noor Haddad',
      email: 'noor@solsticeretail.com',
      phone: '+971 4 555 0110',
      title: 'Operations Analyst',
      online: true,
      lastSeen: 'Active now',
      location: 'Dubai, AE',
      localTime: '18:14',
      language: 'English (UK)',
      conversations: 11,
      verified: true,
    },
    account: ACCOUNT_SOLSTICE,
    channel: 'chat',
    status: 'open',
    priority: 'normal',
    type: 'problem',
    assigneeId: 'agent-okafor',
    team: 'Platform',
    tags: ['import', 'csv', 'limits'],
    createdAt: NOW - 26 * HOUR,
    updatedAt: NOW - 2 * HOUR - 5 * MINUTE,
    unread: 1,
    starred: false,
    waitingOn: 'agent',
    sla: {
      policy: 'Growth — 8/5, 4h first response',
      firstResponseState: 'met',
      firstResponseLabel: '31m — met',
      resolutionState: 'due',
      resolutionLabel: '1d 6h left',
      resolutionPercent: 44,
    },
    environment: {
      appVersion: '4.12.3',
      browser: 'Chrome 141',
      os: 'Windows 11',
      device: 'Desktop',
      locale: 'en-GB',
      timezone: 'Asia/Dubai',
      ipRegion: 'AE — Dubai',
      sessionId: 'ses_55c1e0d7f81a',
      lastError: 'ImportJob aborted: row_limit_exceeded',
    },
    linked: [
      {
        kind: 'article',
        label: 'Help centre',
        reference: 'Import limits and chunking',
        meta: 'Suggested',
      },
    ],
    satisfaction: { rating: null, comment: null, average: 4.4, responses: 7 },
    activity: [
      {
        id: 'a1',
        at: NOW - 26 * HOUR,
        actor: 'Noor Haddad',
        action: 'Started a chat',
        detail: null,
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 25 * HOUR - 29 * MINUTE,
        actor: 'Tobi Okafor',
        action: 'Sent the first reply',
        detail: null,
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 2 * HOUR - 5 * MINUTE,
        actor: 'Noor Haddad',
        action: 'Replied',
        detail: null,
        tone: 'default',
      },
    ],
    notes: [],
    conversation: [
      {
        id: 'CS-4802-m1',
        authorId: 'req-noor',
        text: 'Our supplier catalogue is 8,400 rows. Every import stops at exactly 5,000 with "row_limit_exceeded" and the rest is silently dropped.',
        timestamp: NOW - 26 * HOUR,
      },
      {
        id: 'CS-4802-m2',
        authorId: 'agent-okafor',
        text: 'The synchronous importer caps at 5,000 rows per job. Anything larger needs the chunked importer, which we enable per workspace — I have turned it on for you.',
        timestamp: NOW - 25 * HOUR - 29 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4802-m3',
        authorId: 'req-noor',
        text: 'Split the file into two and both halves went through — is 5k a hard cap?',
        timestamp: NOW - 2 * HOUR - 5 * MINUTE,
      },
      {
        id: 'CS-4802-m4',
        authorId: 'agent-okafor',
        text: 'It is a hard cap on the synchronous importer only — the chunked one I enabled has no row limit, so the full 8,400 rows will go through in one job now.',
        timestamp: NOW - 118 * MINUTE,
        status: 'failed',
      },
    ],
  },
  {
    id: 'CS-4799',
    subject: 'Webhook signatures failing after key rotation',
    requester: {
      id: 'req-jonas',
      name: 'Jonas Vidal',
      email: 'jonas@northwind.dev',
      phone: null,
      title: 'Staff Engineer',
      online: true,
      lastSeen: 'Active now',
      location: 'Lisbon, PT',
      localTime: '15:14',
      language: 'English (UK)',
      conversations: 9,
      verified: true,
    },
    account: ACCOUNT_NORTHWIND,
    channel: 'api',
    status: 'solved',
    priority: 'high',
    type: 'incident',
    assigneeId: 'agent-okafor',
    team: 'Platform',
    tags: ['webhooks', 'security', 'signatures'],
    createdAt: NOW - 3 * DAY - 5 * HOUR,
    updatedAt: NOW - 3 * DAY - 1 * HOUR,
    unread: 0,
    starred: false,
    waitingOn: 'customer',
    sla: {
      policy: 'Business — 8/5, 1h first response',
      firstResponseState: 'met',
      firstResponseLabel: '8m — met',
      resolutionState: 'met',
      resolutionLabel: 'Resolved in 4h',
      resolutionPercent: 100,
    },
    environment: {
      appVersion: 'API v3',
      browser: 'axios 1.9',
      os: 'Debian 12',
      device: 'Server',
      locale: 'en-GB',
      timezone: 'Europe/Lisbon',
      ipRegion: 'PT — Lisbon',
      sessionId: 'ses_1a7d33b0ee94',
      lastError: 'HTTP 401 — signature_mismatch',
    },
    linked: [
      {
        kind: 'article',
        label: 'Help centre',
        reference: 'Verifying webhook signatures',
        meta: 'Sent to requester',
      },
    ],
    satisfaction: {
      rating: 4,
      comment:
        'Fast and correct, though the docs could call out the raw-body requirement louder.',
      average: 4.75,
      responses: 4,
    },
    activity: [
      {
        id: 'a1',
        at: NOW - 3 * DAY - 5 * HOUR,
        actor: 'Jonas Vidal',
        action: 'Opened the conversation from the API dashboard',
        detail: null,
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 3 * DAY - 4 * HOUR - 52 * MINUTE,
        actor: 'Tobi Okafor',
        action: 'Sent the first reply',
        detail: null,
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 3 * DAY - 1 * HOUR,
        actor: 'Tobi Okafor',
        action: 'Solved the conversation',
        detail: null,
        tone: 'success',
      },
    ],
    notes: [],
    conversation: [
      {
        id: 'CS-4799-m1',
        authorId: 'req-jonas',
        text: 'We rotated our signing secret this morning and now every webhook fails signature verification with a 401.',
        timestamp: NOW - 3 * DAY - 5 * HOUR,
      },
      {
        id: 'CS-4799-m2',
        authorId: 'agent-okafor',
        text: 'Rotation keeps both secrets valid for 24 hours, so this is almost certainly a verification detail rather than the rotation itself. Are you hashing the raw request body, before any JSON parsing?',
        timestamp: NOW - 3 * DAY - 4 * HOUR - 52 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4799-m3',
        authorId: 'req-jonas',
        text: 'All good now — we were still hashing the raw body after JSON.parse.',
        timestamp: NOW - 3 * DAY - 1 * HOUR - 10 * MINUTE,
      },
      {
        id: 'CS-4799-m4',
        authorId: 'agent-okafor',
        text: 'That will do it — the re-serialised body loses key ordering. Marking this solved; shout if it comes back.',
        timestamp: NOW - 3 * DAY - 1 * HOUR,
        status: 'read',
      },
    ],
  },
  {
    id: 'CS-4796',
    subject: 'Signed BAA needed before the clinical pilot goes live',
    requester: {
      id: 'req-marcus',
      name: 'Marcus Bell',
      email: 'm.bell@meridianhealth.org',
      phone: '+1 (617) 555-0177',
      title: 'Clinical Systems Director',
      online: false,
      lastSeen: '40 minutes ago',
      location: 'Boston, US',
      localTime: '10:14',
      language: 'English (US)',
      conversations: 18,
      verified: true,
    },
    account: ACCOUNT_MERIDIAN,
    channel: 'email',
    status: 'open',
    priority: 'urgent',
    type: 'task',
    assigneeId: 'agent-navarro',
    team: 'Compliance',
    tags: ['hipaa', 'baa', 'legal', 'go-live'],
    createdAt: NOW - 6 * HOUR - 40 * MINUTE,
    updatedAt: NOW - 40 * MINUTE,
    unread: 1,
    starred: true,
    waitingOn: 'agent',
    sla: {
      policy: 'Enterprise — 24/5, 15m first response',
      firstResponseState: 'met',
      firstResponseLabel: '9m — met',
      resolutionState: 'at-risk',
      resolutionLabel: '48m left',
      resolutionPercent: 91,
    },
    environment: {
      appVersion: '4.11.9',
      browser: 'Chrome 141',
      os: 'Windows 11',
      device: 'Desktop',
      locale: 'en-US',
      timezone: 'America/New_York',
      ipRegion: 'US — Massachusetts',
      sessionId: 'ses_c9b204e7710f',
      lastError: null,
    },
    linked: [
      {
        kind: 'issue',
        label: 'Legal request',
        reference: 'LEG-0442',
        meta: 'With counsel · countersignature pending',
      },
      {
        kind: 'subscription',
        label: 'Subscription',
        reference: 'sub_meridian_ent',
        meta: 'Enterprise · 1,250 seats',
      },
    ],
    satisfaction: { rating: null, comment: null, average: 4.1, responses: 9 },
    activity: [
      {
        id: 'a1',
        at: NOW - 6 * HOUR - 40 * MINUTE,
        actor: 'Marcus Bell',
        action: 'Opened the conversation by email',
        detail: null,
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 6 * HOUR - 31 * MINUTE,
        actor: 'Luis Navarro',
        action: 'Sent the first reply',
        detail: null,
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 4 * HOUR,
        actor: 'Luis Navarro',
        action: 'Escalated to legal',
        detail: 'LEG-0442 created',
        tone: 'warning',
      },
      {
        id: 'a4',
        at: NOW - 40 * MINUTE,
        actor: 'Marcus Bell',
        action: 'Replied',
        detail: null,
        tone: 'default',
      },
    ],
    notes: [
      {
        id: 'CS-4796-n1',
        authorId: 'agent-chen',
        at: NOW - 3 * HOUR - 30 * MINUTE,
        text: 'This pilot is the anchor for the Q4 expansion. If legal cannot countersign today, call Marcus rather than emailing — he has asked for phone updates on anything time-boxed.',
      },
    ],
    conversation: [
      {
        id: 'CS-4796-m1',
        authorId: 'req-marcus',
        text: 'We need the countersigned BAA on file before the clinical pilot can go live. I sent our signed copy through the portal on Tuesday.',
        timestamp: NOW - 6 * HOUR - 40 * MINUTE,
      },
      {
        id: 'CS-4796-m2',
        authorId: 'agent-navarro',
        text: 'I can see your signed copy — thank you. It is with our counsel for countersignature now and I have flagged it as time-critical.',
        timestamp: NOW - 6 * HOUR - 31 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4796-m3',
        authorId: 'req-marcus',
        text: 'Our go-live is Monday — is there any way to get this countersigned today?',
        timestamp: NOW - 40 * MINUTE,
      },
    ],
  },
  {
    id: 'CS-4793',
    subject: 'What do we lose if we stay on the free plan?',
    requester: {
      id: 'req-tia',
      name: 'Tia Moreau',
      email: 'tia@vantagemedia.tv',
      phone: null,
      title: 'Producer',
      online: false,
      lastSeen: '2 days ago',
      location: 'Montreal, CA',
      localTime: '10:14',
      language: 'French',
      conversations: 2,
      verified: false,
    },
    account: ACCOUNT_VANTAGE,
    channel: 'social',
    status: 'pending',
    priority: 'low',
    type: 'question',
    assigneeId: 'agent-okafor',
    team: 'Growth',
    tags: ['plans', 'pre-sales', 'free-tier'],
    createdAt: NOW - 2 * DAY - 9 * HOUR,
    updatedAt: NOW - 2 * DAY - 8 * HOUR,
    unread: 0,
    starred: false,
    waitingOn: 'customer',
    sla: {
      policy: 'Free — best effort',
      firstResponseState: 'met',
      firstResponseLabel: '1h — met',
      resolutionState: 'paused',
      resolutionLabel: 'No target on the free plan',
      resolutionPercent: 0,
    },
    environment: {
      appVersion: '4.12.0',
      browser: 'Safari 19',
      os: 'iOS 26',
      device: 'iPhone 17',
      locale: 'fr-CA',
      timezone: 'America/Toronto',
      ipRegion: 'CA — Quebec',
      sessionId: 'ses_08e6a3c15dd7',
      lastError: null,
    },
    linked: [
      {
        kind: 'article',
        label: 'Help centre',
        reference: 'Plan comparison',
        meta: 'Sent to requester',
      },
    ],
    satisfaction: { rating: null, comment: null, average: 0, responses: 0 },
    activity: [
      {
        id: 'a1',
        at: NOW - 2 * DAY - 9 * HOUR,
        actor: 'Tia Moreau',
        action: 'Mentioned the brand on social',
        detail: 'Pulled in by the social listening rule',
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 2 * DAY - 8 * HOUR,
        actor: 'Tobi Okafor',
        action: 'Replied and set status to Pending',
        detail: null,
        tone: 'info',
      },
    ],
    notes: [],
    conversation: [
      {
        id: 'CS-4793-m1',
        authorId: 'req-tia',
        text: 'We are three people and the free plan covers what we do today. Before we grow the team — what do we actually lose by staying on it?',
        timestamp: NOW - 2 * DAY - 9 * HOUR,
      },
      {
        id: 'CS-4793-m2',
        authorId: 'agent-okafor',
        text: 'Mostly the audit log and SSO — happy to walk you through it. Free keeps every core feature and 3 seats; Growth adds SSO, the audit log, unlimited history and priority support.',
        timestamp: NOW - 2 * DAY - 8 * HOUR,
        status: 'delivered',
      },
    ],
  },
  {
    id: 'CS-4788',
    subject: 'Onboarding session for the new dispatch team',
    requester: {
      id: 'req-amara',
      name: 'Amara Osei',
      email: 'amara.osei@heliosfreight.com',
      phone: '+1 (312) 555-0148',
      title: 'Director of IT Operations',
      online: true,
      lastSeen: 'Active now',
      location: 'Chicago, US',
      localTime: '09:14',
      language: 'English (US)',
      conversations: 27,
      verified: true,
    },
    account: ACCOUNT_HELIOS,
    channel: 'phone',
    status: 'solved',
    priority: 'low',
    type: 'task',
    assigneeId: 'agent-chen',
    team: 'Customer Success',
    tags: ['onboarding', 'training', 'enablement'],
    createdAt: NOW - 5 * DAY,
    updatedAt: NOW - 4 * DAY - 20 * HOUR,
    unread: 0,
    starred: false,
    waitingOn: 'customer',
    sla: {
      policy: 'Enterprise — 24/5, 15m first response',
      firstResponseState: 'met',
      firstResponseLabel: 'Same call — met',
      resolutionState: 'met',
      resolutionLabel: 'Resolved in 4h',
      resolutionPercent: 100,
    },
    environment: {
      appVersion: '4.11.9',
      browser: '—',
      os: '—',
      device: 'Phone',
      locale: 'en-US',
      timezone: 'America/Chicago',
      ipRegion: '—',
      sessionId: 'ses_7bd42f9a01ce',
      lastError: null,
    },
    linked: [
      {
        kind: 'article',
        label: 'Help centre',
        reference: 'Dispatch quick-start',
        meta: 'Shared before the session',
      },
    ],
    satisfaction: {
      rating: 5,
      comment: 'Wei tailored the whole session to our workflow. Excellent.',
      average: 4.6,
      responses: 19,
    },
    activity: [
      {
        id: 'a1',
        at: NOW - 5 * DAY,
        actor: 'Amara Osei',
        action: 'Called the support line',
        detail: 'Logged by Wei Chen',
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 4 * DAY - 20 * HOUR,
        actor: 'Wei Chen',
        action: 'Booked the session and solved the conversation',
        detail: 'Thursday 14:00 CT, 12 attendees',
        tone: 'success',
      },
    ],
    notes: [],
    conversation: [
      {
        id: 'CS-4788-m1',
        authorId: 'req-amara',
        text: 'We are adding twelve dispatchers next month and would like a live onboarding session rather than sending them the docs.',
        timestamp: NOW - 5 * DAY,
      },
      {
        id: 'CS-4788-m2',
        authorId: 'agent-chen',
        text: 'Booked for Thursday 14:00 CT — calendar invite is on its way. I will tailor the second half to your dispatch board specifically.',
        timestamp: NOW - 4 * DAY - 20 * HOUR,
        status: 'read',
      },
    ],
  },
  {
    id: 'CS-4784',
    subject: 'iOS app crashes on launch after the 4.12 update',
    requester: {
      id: 'req-noor',
      name: 'Noor Haddad',
      email: 'noor@solsticeretail.com',
      phone: '+971 4 555 0110',
      title: 'Operations Analyst',
      online: true,
      lastSeen: 'Active now',
      location: 'Dubai, AE',
      localTime: '18:14',
      language: 'English (UK)',
      conversations: 11,
      verified: true,
    },
    account: ACCOUNT_SOLSTICE,
    channel: 'form',
    status: 'closed',
    priority: 'high',
    type: 'bug',
    assigneeId: 'agent-rivera',
    team: 'Mobile',
    tags: ['ios', 'crash', 'offline-cache', 'fixed-in-4.12.4'],
    createdAt: NOW - 8 * DAY,
    updatedAt: NOW - 6 * DAY,
    unread: 0,
    starred: false,
    waitingOn: 'customer',
    sla: {
      policy: 'Growth — 8/5, 4h first response',
      firstResponseState: 'met',
      firstResponseLabel: '52m — met',
      resolutionState: 'met',
      resolutionLabel: 'Resolved in 2d',
      resolutionPercent: 100,
    },
    environment: {
      appVersion: '4.12.0 (mobile)',
      browser: '—',
      os: 'iOS 26.1',
      device: 'iPhone 16 Pro',
      locale: 'en-GB',
      timezone: 'Asia/Dubai',
      ipRegion: 'AE — Dubai',
      sessionId: 'ses_9e0c1b7a4432',
      lastError: 'SIGABRT — CacheMigration.v3 unexpected nil',
    },
    linked: [
      {
        kind: 'issue',
        label: 'Engineering issue',
        reference: 'ENG-7690',
        meta: 'Released in 4.12.4',
      },
    ],
    satisfaction: {
      rating: 4,
      comment: 'Good communication, though two days of no mobile access hurt.',
      average: 4.4,
      responses: 7,
    },
    activity: [
      {
        id: 'a1',
        at: NOW - 8 * DAY,
        actor: 'Noor Haddad',
        action: 'Submitted the support form',
        detail: 'Crash log attached automatically',
        tone: 'default',
      },
      {
        id: 'a2',
        at: NOW - 8 * DAY + 52 * MINUTE,
        actor: 'Dana Rivera',
        action: 'Sent the first reply',
        detail: null,
        tone: 'success',
      },
      {
        id: 'a3',
        at: NOW - 6 * DAY,
        actor: 'Dana Rivera',
        action: 'Closed the conversation',
        detail: 'Fix shipped in 4.12.4',
        tone: 'success',
      },
    ],
    notes: [],
    conversation: [
      {
        id: 'CS-4784-m1',
        authorId: 'req-noor',
        text: 'Nobody on the floor team can open the iOS app since the 4.12 update — it closes immediately on the splash screen.',
        timestamp: NOW - 8 * DAY,
      },
      {
        id: 'CS-4784-m2',
        authorId: 'agent-rivera',
        text: 'Crash log points at the offline cache migration — fix ships in 4.12.4. As a workaround, reinstalling clears the old cache and the app opens normally.',
        timestamp: NOW - 8 * DAY + 52 * MINUTE,
        status: 'read',
      },
      {
        id: 'CS-4784-m3',
        authorId: 'req-noor',
        text: 'Reinstall worked for the whole team. We will take the update when it lands.',
        timestamp: NOW - 7 * DAY,
      },
    ],
  },
];
