import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import {
  LucideCalendarDays,
  LucideChartColumn,
  LucideChevronDown,
  LucideDynamicIcon,
  LucideFileText,
  LucideFolderKanban,
  LucideHouse,
  LucideInbox,
  LucideLayoutDashboard,
  LucideListChecks,
  LucideMenu,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucidePlus,
  LucideRocket,
  LucideSettings,
  LucideUsers,
  LucideWorkflow,
  LucideX,
  type LucideIconInput,
} from '@lucide/angular';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvBadge, type MlvBadgeTone } from '@malva-ui/core/badge';
import { MlvBreadcrumb } from '@malva-ui/core/breadcrumb';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvDataTable, MlvDataTableCell } from '@malva-ui/core/data-table';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MlvNotificationService } from '@malva-ui/core/notification';
import {
  MlvPage,
  MlvPageContext,
  MlvPageEndPane,
  MlvPageEndPaneContent,
  MlvPageEndPaneTrigger,
  MlvPageHeader,
  MlvPageActions,
  MlvPageStatus,
  MlvPageShell,
  MlvPageSidebar,
  MlvPageSummary,
  MlvPageSummaryItem,
  MlvPageTitle,
} from '@malva-ui/core/page';
import { MlvProgress } from '@malva-ui/core/progress';
import {
  MlvSidebar,
  MlvSidebarGroup,
  MlvSidebarItem,
  MlvSidebarItemIcon,
  MlvSidebarTrigger,
} from '@malva-ui/core/sidebar';
import {
  MlvTab,
  MlvTabContentDef,
  MlvTabDef,
  MlvTabGroup,
} from '@malva-ui/core/tabs';
import { MlvTimeline, MlvTimelineItem } from '@malva-ui/core/timeline';
import {
  PROJECT_ACTIVITY_ENTRIES,
  PROJECT_ASSIGNEES,
  PROJECT_BREADCRUMBS,
  PROJECT_COLLABORATORS,
  PROJECT_FILES,
  PROJECT_META,
  PROJECT_NAV_ITEMS,
  PROJECT_STATUS_META,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TAGS,
  PROJECT_TASK_COLUMNS,
  PROJECT_TASK_GROUPS,
  PROJECT_TIMELINE_EVENTS,
  PROJECT_WORKFLOW_NAV,
  RAIL_NAV_ITEMS,
  type ProjectGroupRow,
  type ProjectIconName,
  type ProjectTask,
  type ProjectTaskGroup,
  type ProjectTaskRow,
  type ProjectTaskStatus,
  type ProjectWorkspaceRow,
} from './project-workspace.data';

/** Maps fixture icon keys to the Lucide directive classes rendered by the sidebars. */
const WORKSPACE_ICONS: Readonly<Record<ProjectIconName, LucideIconInput>> = {
  'calendar-days': LucideCalendarDays,
  'chart-column': LucideChartColumn,
  'file-text': LucideFileText,
  'folder-kanban': LucideFolderKanban,
  house: LucideHouse,
  inbox: LucideInbox,
  'layout-dashboard': LucideLayoutDashboard,
  'list-checks': LucideListChecks,
  rocket: LucideRocket,
  settings: LucideSettings,
  users: LucideUsers,
  workflow: LucideWorkflow,
};

@Component({
  selector: 'docs-project-workspace-showcase',
  imports: [
    DatePipe,
    NgOptimizedImage,
    MlvAvatar,
    MlvBadge,
    MlvBreadcrumb,
    MlvButton,
    MlvButtonIcon,
    MlvDataTable,
    MlvDataTableCell,
    MlvListItem,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvPage,
    MlvPageContext,
    MlvPageEndPane,
    MlvPageEndPaneContent,
    MlvPageEndPaneTrigger,
    MlvPageHeader,
    MlvPageActions,
    MlvPageStatus,
    MlvPageShell,
    MlvPageSidebar,
    MlvPageSummary,
    MlvPageSummaryItem,
    MlvPageTitle,
    MlvProgress,
    MlvSidebar,
    MlvSidebarGroup,
    MlvSidebarItem,
    MlvSidebarItemIcon,
    MlvSidebarTrigger,
    MlvTab,
    MlvTabContentDef,
    MlvTabDef,
    MlvTabGroup,
    MlvTimeline,
    MlvTimelineItem,
    LucideChevronDown,
    LucideDynamicIcon,
    LucideFileText,
    LucideMenu,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucidePlus,
    LucideX,
  ],
  templateUrl: './project-workspace.html',
  styleUrl: './project-workspace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectWorkspaceShowcaseComponent {
  private readonly _notifications = inject(MlvNotificationService);
  private readonly _breakpoints = inject(MlvBreakpointService);

  readonly breadcrumbs = PROJECT_BREADCRUMBS;
  readonly railNavItems = RAIL_NAV_ITEMS;
  readonly projectNavItems = PROJECT_NAV_ITEMS;
  readonly workflowNav = PROJECT_WORKFLOW_NAV;
  readonly columns = PROJECT_TASK_COLUMNS;
  readonly statusOptions = PROJECT_STATUS_OPTIONS;
  readonly timelineEvents = PROJECT_TIMELINE_EVENTS;
  readonly activityEntries = PROJECT_ACTIVITY_ENTRIES;
  readonly inspectorActivity = PROJECT_ACTIVITY_ENTRIES.slice(0, 3);
  readonly files = PROJECT_FILES;
  readonly collaborators = PROJECT_COLLABORATORS;
  readonly tags = PROJECT_TAGS;
  readonly projectMeta = PROJECT_META;

  /** Grouped task model; every mutation replaces group and task objects immutably. */
  readonly groups = signal<readonly ProjectTaskGroup[]>(PROJECT_TASK_GROUPS);
  /** Active destination in the compact application rail. */
  readonly activeRailId = signal('projects');
  /** Active destination in the project navigation sidebar. */
  readonly activeNavId = signal('overview');
  /** Selected tab: 'summary' | 'activity' | 'files'. */
  readonly activeTab = signal('summary');
  /** Collapsed state of the project navigation sidebar. */
  readonly projectNavCollapsed = signal(false);
  /** Inspector pane state — starts open on desktop, closed below the lg breakpoint. */
  readonly inspectorOpened = signal(this._breakpoints.isUp('lg')());

  /** @private Ids of task groups whose rows are currently hidden. */
  private readonly _collapsedGroupIds = signal<ReadonlySet<string>>(new Set());

  /** Flat list of every task across all groups. */
  readonly tasks = computed(() =>
    this.groups().flatMap((group) => group.tasks),
  );

  /** Overall completion — the rounded mean of per-task progress. */
  readonly progress = computed(() => {
    const tasks = this.tasks();
    if (tasks.length === 0) return 0;
    const total = tasks.reduce((sum, task) => sum + task.progress, 0);
    return Math.round(total / tasks.length);
  });

  /** Number of tasks not yet done. */
  readonly openTaskCount = computed(
    () => this.tasks().filter((task) => task.status !== 'done').length,
  );

  /** Rows for the task table: each group header followed by its visible tasks. */
  readonly tableRows = computed<ProjectWorkspaceRow[]>(() => {
    const collapsed = this._collapsedGroupIds();
    return this.groups().flatMap((group) => {
      const header: ProjectWorkspaceRow = {
        kind: 'group',
        id: group.id,
        label: group.label,
        taskCount: group.tasks.length,
      };
      if (collapsed.has(group.id)) return [header];
      return [
        header,
        ...group.tasks.map(
          (task): ProjectWorkspaceRow => ({ kind: 'task', ...task }),
        ),
      ];
    });
  });

  /** Resolves a fixture icon key to its Lucide directive class. */
  protected icon(name: ProjectIconName): LucideIconInput {
    return WORKSPACE_ICONS[name];
  }

  /** Narrows a table row to its group-header shape. */
  protected groupRow(row: ProjectWorkspaceRow): ProjectGroupRow | null {
    return row.kind === 'group' ? row : null;
  }

  /** Narrows a table row to its task shape. */
  protected taskRow(row: ProjectWorkspaceRow): ProjectTaskRow | null {
    return row.kind === 'task' ? row : null;
  }

  /** Badge tone for a task status. */
  protected statusTone(status: ProjectTaskStatus): MlvBadgeTone {
    return PROJECT_STATUS_META[status].tone;
  }

  /** Human label for a task status. */
  protected statusLabel(status: ProjectTaskStatus): string {
    return PROJECT_STATUS_META[status].label;
  }

  /** Marks a rail destination active. */
  selectRailItem(id: string): void {
    this.activeRailId.set(id);
  }

  /** Marks a project navigation destination active. */
  selectNav(id: string): void {
    this.activeNavId.set(id);
  }

  /** Whether a task group's rows are visible. */
  isGroupExpanded(groupId: string): boolean {
    return !this._collapsedGroupIds().has(groupId);
  }

  /** Shows or hides a task group's rows. */
  toggleGroup(groupId: string): void {
    this._collapsedGroupIds.update((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  /**
   * Moves a task to a new status. Done pins progress to 100 and To do resets
   * it to 0; the summary progress recomputes and a polite notification is
   * issued through `MlvNotificationService`.
   */
  setTaskStatus(taskId: string, status: ProjectTaskStatus): void {
    const task = this.tasks().find((candidate) => candidate.id === taskId);
    if (!task || task.status === status) return;
    const progress =
      status === 'done' ? 100 : status === 'todo' ? 0 : task.progress;
    this.groups.update((groups) =>
      groups.map((group) =>
        group.tasks.some((candidate) => candidate.id === taskId)
          ? {
              ...group,
              tasks: group.tasks.map((candidate) =>
                candidate.id === taskId
                  ? { ...candidate, status, progress }
                  : candidate,
              ),
            }
          : group,
      ),
    );
    this._notifications.show({
      title: 'Task updated',
      description: `“${task.title}” is now ${this.statusLabel(status)}.`,
      tone: status === 'done' ? 'success' : 'default',
    });
  }

  /** Appends a deterministic new task to the Development group. */
  addTask(): void {
    const ordinal = this.tasks().length + 1;
    const task: ProjectTask = {
      id: `new-task-${ordinal}`,
      title: `New task ${ordinal}`,
      assignee: PROJECT_ASSIGNEES.am,
      status: 'todo',
      dueDate: PROJECT_META.dueDate,
      priority: 'Medium',
      progress: 0,
    };
    this.groups.update((groups) =>
      groups.map((group) =>
        group.id === 'development'
          ? { ...group, tasks: [...group.tasks, task] }
          : group,
      ),
    );
    this._notifications.show({
      title: 'Task created',
      description: `“${task.title}” added to Development.`,
      tone: 'default',
    });
  }
}
