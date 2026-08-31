import type { MlvAvatarGroupMember } from '@malva-ui/core/avatar-group';
import type { MlvBadgeTone } from '@malva-ui/core/badge';

/** Workflow states an article moves through before it reaches readers. */
export type ArticleStatus = 'draft' | 'in-review' | 'published';

/** One document in the workspace's navigation sidebar. */
export interface WorkspaceDocument {
  readonly id: string;
  readonly title: string;
  readonly group: 'drafts' | 'published';
  readonly status: ArticleStatus;
  readonly updated: string;
  readonly contentHtml: string;
}

/** One historical version of the active article, inspectable side by side. */
export interface ArticleVersion {
  readonly id: string;
  readonly label: string;
  readonly timestamp: string;
  readonly contentHtml: string;
}

/** One review comment shown in the inspector pane. */
export interface ReviewComment {
  readonly id: string;
  readonly author: string;
  readonly timestamp: string;
  readonly text: string;
}

/** Badge label and semantic tone per workflow status. */
export const ARTICLE_STATUS_META: Record<
  ArticleStatus,
  { readonly label: string; readonly tone: MlvBadgeTone }
> = {
  draft: { label: 'Draft', tone: 'default' },
  'in-review': { label: 'In review', tone: 'warning' },
  published: { label: 'Published', tone: 'success' },
};

/** The active release-notes article. The intro paragraph is the AI target. */
export const ARTICLE_HTML = `<p>Malva Cloud 3.4 brings the publishing workflow together: focused drafting, tracked AI suggestions, and a calmer review loop before anything ships.</p><h2>Highlights</h2><p>The editor keeps a steady reading measure, the review bar collects tracked suggestions, and publishing is one confirmed step.</p><ul><li>Streaming AI transforms land as reviewable suggestions instead of silent rewrites.</li><li>Cover images and attachments upload with visible progress and a retry path.</li><li>Version comparisons open side by side without leaving the workspace.</li></ul><h2>Fixes</h2><p>Keyboard focus returns to the publish action after the confirmation dialog closes, and drafts keep their edits while you switch documents.</p>`;

/** Stable document fixtures keep sidebar order and editor content reproducible. */
export const WORKSPACE_DOCUMENTS: readonly WorkspaceDocument[] = [
  {
    id: 'malva-cloud-3-4',
    title: 'Malva Cloud 3.4 release notes',
    group: 'drafts',
    status: 'draft',
    updated: 'Edited today',
    contentHtml: ARTICLE_HTML,
  },
  {
    id: 'editor-deep-dive',
    title: 'Editor deep dive',
    group: 'drafts',
    status: 'draft',
    updated: 'Edited yesterday',
    contentHtml:
      '<p>A long-form look at the block editor: reading measure, drag reordering, and the toolbar model.</p><h2>Outline</h2><ul><li>Why a fixed measure calms long drafts</li><li>Reordering blocks without losing undo history</li></ul>',
  },
  {
    id: 'ai-review-guide',
    title: 'AI review guide',
    group: 'drafts',
    status: 'in-review',
    updated: 'Edited 2 days ago',
    contentHtml:
      '<p>How tracked AI suggestions keep editors in control: every transform is reviewable before it becomes part of the draft.</p><h2>Principles</h2><p>Suggestions are proposals, not silent rewrites.</p>',
  },
  {
    id: 'publishing-checklist',
    title: 'Publishing checklist',
    group: 'published',
    status: 'published',
    updated: 'Published last week',
    contentHtml:
      '<p>The five checks every article passes before it goes live.</p><ul><li>Copy reviewed</li><li>Media attached</li><li>Status confirmed</li></ul>',
  },
  {
    id: 'summer-roadmap-recap',
    title: 'Summer roadmap recap',
    group: 'published',
    status: 'published',
    updated: 'Published in July',
    contentHtml:
      '<p>What shipped over the summer and what moved to autumn.</p><h2>Shipped</h2><p>Dialog composition, sidebar theming, and the data-source primitives.</p>',
  },
];

/** Three historical versions of the active article, newest first. */
export const ARTICLE_VERSIONS: readonly ArticleVersion[] = [
  {
    id: 'v3',
    label: 'Review candidate',
    timestamp: 'Aug 21, 2026 · 11:05',
    contentHtml:
      '<p>Malva Cloud 3.4 brings the publishing workflow together with focused drafting and tracked AI suggestions.</p><h2>Highlights</h2><p>The editor keeps a steady reading measure and the review bar collects tracked suggestions.</p><ul><li>Streaming AI transforms land as reviewable suggestions.</li><li>Cover images upload with visible progress.</li></ul>',
  },
  {
    id: 'v2',
    label: 'Structure pass',
    timestamp: 'Aug 19, 2026 · 16:40',
    contentHtml:
      '<p>Malva Cloud 3.4 focuses the publishing workflow.</p><h2>Highlights</h2><ul><li>Tracked AI suggestions</li><li>Simulated uploads with retry</li></ul><h2>Fixes</h2><p>Focus management around the publish dialog.</p>',
  },
  {
    id: 'v1',
    label: 'First draft',
    timestamp: 'Aug 18, 2026 · 09:12',
    contentHtml:
      '<p>Rough notes for the 3.4 announcement: editor workflow, AI review, publishing.</p><p>Needs structure, media, and a fixes section.</p>',
  },
];

/** Collaborators rendered as initials-only avatars — no external images. */
export const COLLABORATORS: readonly MlvAvatarGroupMember[] = [
  { name: 'Alina Pop' },
  { name: 'Mihai Ionescu' },
  { name: 'Sofia Marin' },
  { name: 'Andrei Neagu' },
];

/** Review comments listed in the inspector pane. */
export const REVIEW_COMMENTS: readonly ReviewComment[] = [
  {
    id: 'comment-1',
    author: 'Sofia Marin',
    timestamp: 'Aug 21 · 11:20',
    text: 'The highlights list reads well — consider leading with the AI review item.',
  },
  {
    id: 'comment-2',
    author: 'Mihai Ionescu',
    timestamp: 'Aug 20 · 15:47',
    text: 'Add a screenshot of the version comparison before this goes out.',
  },
  {
    id: 'comment-3',
    author: 'Andrei Neagu',
    timestamp: 'Aug 19 · 10:02',
    text: 'Fixes section confirmed against the QA notes. Good to publish from my side.',
  },
];

/**
 * Canned Markdown per built-in transform kind. A real host would call its own
 * backend here; this provider never leaves the page and needs no API key.
 */
export const CANNED_AI_MARKDOWN: Record<string, string> = {
  improve:
    'This update now reads clearly and confidently, with every sentence pulling toward the release.',
  'fix-grammar':
    'The corrected paragraph keeps one tense and ends each sentence with exactly one period.',
  shorten:
    'A clearer product update: Malva Cloud 3.4 ships focused drafting, tracked AI suggestions, and a calmer review loop.',
  extend:
    'The original thought continues with a fuller paragraph.\n\nIt adds one supporting example and a closing remark, so the section feels finished rather than cut off.',
  summarize:
    '- Focused drafting with a steady measure\n- Tracked AI suggestions with accept/reject review\n- One confirmed publishing step',
  tone: 'We are delighted to share this update and welcome your feedback at your convenience.',
  translate:
    'Voici la même annonce, traduite en français pour la démonstration.',
  custom:
    'Here is the canned answer the mock provider returns for a custom prompt.',
};

/**
 * Answer for kinds this provider does not recognize. `request.kind` is an open
 * string type, so a provider must always keep a graceful fallback branch.
 */
export const AI_FALLBACK_MARKDOWN =
  'This mock provider has no answer for that transform kind, so it says so instead of failing.';

/** Delay between streamed AI chunks — visible typing without slowing tests. */
export const AI_CHUNK_DELAY_MS = 45;

/** Simulated upload timing: one tick advances progress by a fixed step. */
export const UPLOAD_TICK_MS = 90;
export const UPLOAD_TICK_PERCENT = 20;
/** The deterministic first-attempt failure stops at this progress value. */
export const UPLOAD_FAILURE_AT_PERCENT = 60;
