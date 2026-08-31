/**
 * Workspace data understood by `mlv-sidebar-workspace`.
 * Consumers may structurally extend this interface with application-specific
 * fields; `label` remains the accessible name used by the switcher.
 */
export interface MlvSidebarWorkspaceOption {
  /** Stable identifier used to track and compare workspaces. */
  readonly id: string;
  /** Human-readable and accessible workspace name. */
  readonly label: string;
  /** Optional secondary line rendered by the default text template. */
  readonly description?: string;
}

/** Context supplied to workspace logo and text structural templates. */
export interface MlvSidebarWorkspaceTemplateContext {
  /** Workspace being rendered; available through `let-workspace`. */
  readonly $implicit: MlvSidebarWorkspaceOption;
  /** Whether this workspace is currently active. */
  readonly selected: boolean;
}
