import type { MlvBadgeTone } from '@malva-ui/core/badge';
import type { MlvBreadcrumbEntry } from '@malva-ui/core/breadcrumb';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import type { MlvTimelineItemTone } from '@malva-ui/core/timeline';

/** Lifecycle of a delivery task. */
export type ProjectTaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

/** Editorial priority label for a task. */
export type ProjectTaskPriority = 'High' | 'Medium' | 'Low';

/** Icon keys resolvable by the showcase component's Lucide map. */
export type ProjectIconName =
  | 'calendar-days'
  | 'chart-column'
  | 'file-text'
  | 'folder-kanban'
  | 'house'
  | 'inbox'
  | 'layout-dashboard'
  | 'list-checks'
  | 'rocket'
  | 'settings'
  | 'users'
  | 'workflow';

/** Person a task can be assigned to. */
export interface ProjectAssignee {
  readonly initials: string;
  readonly name: string;
}

/** One delivery task rendered in the grouped task table. */
export interface ProjectTask {
  readonly id: string;
  readonly title: string;
  readonly assignee: ProjectAssignee;
  readonly status: ProjectTaskStatus;
  readonly dueDate: string;
  readonly priority: ProjectTaskPriority;
  readonly progress: number;
}

/** Named phase grouping a slice of the task list. */
export interface ProjectTaskGroup {
  readonly id: string;
  readonly label: string;
  readonly tasks: readonly ProjectTask[];
}

/**
 * Group header row inside the task table. The task-column keys are declared
 * as always-`undefined` so `keyof ProjectWorkspaceRow` covers every
 * `mlvDataTableCell` key; the `kind` discriminant still narrows both shapes.
 */
export interface ProjectGroupRow {
  readonly kind: 'group';
  readonly id: string;
  readonly label: string;
  readonly taskCount: number;
  readonly title?: undefined;
  readonly assignee?: undefined;
  readonly status?: undefined;
  readonly dueDate?: undefined;
  readonly priority?: undefined;
  readonly progress?: undefined;
}

/** Task row inside the task table. */
export interface ProjectTaskRow extends ProjectTask {
  readonly kind: 'task';
}

/** Discriminated row union rendered by the grouped task table. */
export type ProjectWorkspaceRow = ProjectGroupRow | ProjectTaskRow;

/** Navigation entry for the rail and project sidebars. */
export interface ProjectNavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: ProjectIconName;
}

/** Collapsible navigation group in the project sidebar. */
export interface ProjectNavGroup {
  readonly label: string;
  readonly icon: ProjectIconName;
  readonly items: readonly ProjectNavItem[];
}

/** Milestone entry for the project timeline. */
export interface ProjectTimelineEvent {
  readonly id: string;
  readonly title: string;
  readonly timestamp: string;
  readonly tone: MlvTimelineItemTone;
  readonly description: string;
}

/** Recent activity feed entry. */
export interface ProjectActivityEntry {
  readonly id: string;
  readonly actor: string;
  readonly action: string;
  readonly time: string;
}

/** File listed in the Files tab. */
export interface ProjectFile {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly updated: string;
}

/** Collaborator listed in the inspector. */
export interface ProjectCollaborator {
  readonly name: string;
  readonly role: string;
}

/** The people delivering the project. */
export const PROJECT_ASSIGNEES = {
  am: { initials: 'AM', name: 'Alina Moraru' },
  ds: { initials: 'DS', name: 'Dan Stancu' },
  kl: { initials: 'KL', name: 'Katrin Larsen' },
} as const satisfies Record<string, ProjectAssignee>;

/** Label and badge tone for each task status. */
export const PROJECT_STATUS_META: Readonly<
  Record<
    ProjectTaskStatus,
    { readonly label: string; readonly tone: MlvBadgeTone }
  >
> = {
  todo: { label: 'To do', tone: 'default' },
  'in-progress': { label: 'In progress', tone: 'info' },
  review: { label: 'In review', tone: 'warning' },
  done: { label: 'Done', tone: 'success' },
};

/** Status choices offered by the per-task row menu. */
export const PROJECT_STATUS_OPTIONS: readonly {
  readonly value: ProjectTaskStatus;
  readonly label: string;
}[] = (['todo', 'in-progress', 'review', 'done'] as const).map((value) => ({
  value,
  label: PROJECT_STATUS_META[value].label,
}));

/** Stable grouped task fixture — three phases, seven tasks. */
export const PROJECT_TASK_GROUPS: readonly ProjectTaskGroup[] = [
  {
    id: 'planning',
    label: 'Planning',
    tasks: [
      {
        id: 'project-brief',
        title: 'Project brief sign-off',
        assignee: PROJECT_ASSIGNEES.am,
        status: 'done',
        dueDate: '2026-07-10',
        priority: 'High',
        progress: 100,
      },
      {
        id: 'design-tokens-audit',
        title: 'Design tokens audit',
        assignee: PROJECT_ASSIGNEES.ds,
        status: 'done',
        dueDate: '2026-07-24',
        priority: 'Medium',
        progress: 100,
      },
    ],
  },
  {
    id: 'design',
    label: 'Design',
    tasks: [
      {
        id: 'component-inventory',
        title: 'Component inventory',
        assignee: PROJECT_ASSIGNEES.kl,
        status: 'review',
        dueDate: '2026-08-07',
        priority: 'Medium',
        progress: 80,
      },
      {
        id: 'visual-language-refresh',
        title: 'Visual language refresh',
        assignee: PROJECT_ASSIGNEES.am,
        status: 'in-progress',
        dueDate: '2026-08-21',
        priority: 'High',
        progress: 60,
      },
    ],
  },
  {
    id: 'development',
    label: 'Development',
    tasks: [
      {
        id: 'responsive-shell',
        title: 'Responsive shell',
        assignee: PROJECT_ASSIGNEES.ds,
        status: 'in-progress',
        dueDate: '2026-08-28',
        priority: 'High',
        progress: 45,
      },
      {
        id: 'data-layer-integration',
        title: 'Data layer integration',
        assignee: PROJECT_ASSIGNEES.kl,
        status: 'in-progress',
        dueDate: '2026-09-04',
        priority: 'Medium',
        progress: 30,
      },
      {
        id: 'accessibility-hardening',
        title: 'Accessibility hardening',
        assignee: PROJECT_ASSIGNEES.am,
        status: 'todo',
        dueDate: '2026-09-18',
        priority: 'Low',
        progress: 0,
      },
    ],
  },
];

/** Column layout for the grouped task table. */
export const PROJECT_TASK_COLUMNS: MlvDataTableColumn<ProjectWorkspaceRow>[] = [
  { key: 'title', title: 'Task', width: '18rem' },
  { key: 'assignee', title: 'Assignee', width: '12rem' },
  { key: 'status', title: 'Status', width: '10rem' },
  { key: 'dueDate', title: 'Due', width: '7rem' },
  { key: 'priority', title: 'Priority', width: '6rem' },
  { key: 'progress', title: 'Progress', width: '11rem' },
];

/** Icon-only workspace destinations for the compact application rail. */
export const RAIL_NAV_ITEMS: readonly ProjectNavItem[] = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'projects', label: 'Projects', icon: 'folder-kanban' },
  { id: 'teams', label: 'Teams', icon: 'users' },
  { id: 'workspace-reports', label: 'Reports', icon: 'chart-column' },
  { id: 'workspace-settings', label: 'Settings', icon: 'settings' },
];

/** Plain destinations in the expanded project navigation sidebar. */
export const PROJECT_NAV_ITEMS: readonly ProjectNavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'layout-dashboard' },
  { id: 'tasks', label: 'Tasks', icon: 'list-checks' },
  { id: 'docs', label: 'Docs', icon: 'file-text' },
  { id: 'reports', label: 'Reports', icon: 'chart-column' },
];

/** Collapsible workflow group in the project navigation sidebar. */
export const PROJECT_WORKFLOW_NAV: ProjectNavGroup = {
  label: 'Workflow',
  icon: 'workflow',
  items: [
    { id: 'backlog', label: 'Backlog', icon: 'inbox' },
    { id: 'sprints', label: 'Sprints', icon: 'calendar-days' },
    { id: 'releases', label: 'Releases', icon: 'rocket' },
  ],
};

/** Breadcrumb trail above the page title. */
export const PROJECT_BREADCRUMBS: MlvBreadcrumbEntry[] = [
  { label: 'Acme Workspace' },
  { label: 'Projects' },
  { label: 'Website relaunch' },
];

/** Milestone events rendered by the bottom timeline. */
export const PROJECT_TIMELINE_EVENTS: readonly ProjectTimelineEvent[] = [
  {
    id: 'kickoff',
    title: 'Project kickoff',
    timestamp: 'Jun 30, 2026',
    tone: 'success',
    description:
      'Scope, staffing, and delivery plan confirmed with stakeholders.',
  },
  {
    id: 'design-approval',
    title: 'Design approval',
    timestamp: 'Jul 28, 2026',
    tone: 'success',
    description: 'Visual direction and component specs approved by product.',
  },
  {
    id: 'design-handoff',
    title: 'Design handoff milestone',
    timestamp: 'Aug 14, 2026',
    tone: 'info',
    description: 'Final layouts and tokens handed to engineering.',
  },
  {
    id: 'development-sprint',
    title: 'Development sprint',
    timestamp: 'Aug 17 – Sep 18, 2026',
    tone: 'warning',
    description: 'Shell, data layer, and accessibility work in active build.',
  },
  {
    id: 'launch',
    title: 'Launch',
    timestamp: 'Oct 2, 2026',
    tone: 'default',
    description: 'Public release window for the relaunched site.',
  },
];

/** Deterministic recent-activity feed entries. */
export const PROJECT_ACTIVITY_ENTRIES: readonly ProjectActivityEntry[] = [
  {
    id: 'activity-shell',
    actor: 'Dan Stancu',
    action: 'moved “Responsive shell” to In progress.',
    time: 'Today, 09:24',
  },
  {
    id: 'activity-inventory',
    actor: 'Katrin Larsen',
    action: 'requested review on “Component inventory”.',
    time: 'Yesterday, 16:02',
  },
  {
    id: 'activity-checklist',
    actor: 'Alina Moraru',
    action: 'updated the launch checklist.',
    time: 'Yesterday, 11:40',
  },
  {
    id: 'activity-data-layer',
    actor: 'Dan Stancu',
    action: 'linked the data layer integration ticket.',
    time: 'Aug 20, 15:12',
  },
];

/** Files listed in the Files tab. */
export const PROJECT_FILES: readonly ProjectFile[] = [
  {
    id: 'design-spec',
    name: 'design-spec.pdf',
    size: '4.2 MB',
    updated: 'Aug 14',
  },
  { id: 'brand-kit', name: 'brand-kit.zip', size: '18 MB', updated: 'Jul 28' },
  {
    id: 'content-outline',
    name: 'content-outline.docx',
    size: '260 KB',
    updated: 'Aug 3',
  },
  {
    id: 'launch-checklist',
    name: 'launch-checklist.xlsx',
    size: '96 KB',
    updated: 'Aug 21',
  },
];

/** Collaborators shown in the inspector. */
export const PROJECT_COLLABORATORS: readonly ProjectCollaborator[] = [
  { name: 'Alina Moraru', role: 'Product design' },
  { name: 'Dan Stancu', role: 'Frontend engineering' },
  { name: 'Katrin Larsen', role: 'Delivery lead' },
];

/** Tags shown in the inspector. */
export const PROJECT_TAGS: readonly string[] = [
  'design-system',
  'frontend',
  'q3-roadmap',
];

/** Header-level facts about the project. */
export const PROJECT_META = {
  name: 'Website relaunch',
  owner: 'Alina Moraru',
  statusLabel: 'On track',
  dueDate: '2026-10-02',
} as const;
