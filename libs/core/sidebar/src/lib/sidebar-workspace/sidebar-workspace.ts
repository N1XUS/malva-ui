import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  contentChild,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import { MLV_SIDEBAR_I18N, MlvI18nResolverService } from '@malva-ui/i18n';
import { LucideCheck, LucideChevronsUpDown } from '@lucide/angular';
import { SIDEBAR_CONTEXT } from '../sidebar-context';
import {
  MlvSidebarWorkspaceLogo,
  MlvSidebarWorkspaceText,
} from './sidebar-workspace.directives';
import type {
  MlvSidebarWorkspaceOption,
  MlvSidebarWorkspaceTemplateContext,
} from './sidebar-workspace.types';

@Component({
  selector: 'mlv-sidebar-workspace',
  imports: [
    NgTemplateOutlet,
    MlvButton,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvListItem,
    LucideCheck,
    LucideChevronsUpDown,
  ],
  templateUrl: './sidebar-workspace.html',
  styleUrl: './sidebar-workspace.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-sidebar-workspace',
    '[class.mlv-sidebar-workspace--collapsed]': '_isCollapsed()',
    '[class.mlv-sidebar-workspace--multiple]': '_hasMultiple()',
    '[class.mlv-sidebar-workspace--open]': '_opened()',
  },
})
export class MlvSidebarWorkspace {
  /** @private Parent sidebar context supplying the effective collapsed state. */
  private readonly _sidebarContext = inject(SIDEBAR_CONTEXT, {
    optional: true,
  });

  /** @protected Localized strings for the workspace switcher. */
  protected readonly _i18n = inject(MLV_SIDEBAR_I18N);

  /** @private ICU message resolver used by the trigger's accessible name. */
  private readonly _i18nResolver = inject(MlvI18nResolverService);

  /**
   * Workspaces available to the user. A switcher menu is rendered only when
   * the collection contains more than one workspace.
   */
  readonly workspaces = input.required<readonly MlvSidebarWorkspaceOption[]>();

  /**
   * Currently active workspace. Two-way bind with `[(workspace)]` to receive
   * user selections made in the workspace menu.
   */
  readonly workspace = model.required<MlvSidebarWorkspaceOption>();

  /** @protected Optional structural template for workspace logos. */
  protected readonly _logoTemplate = contentChild(MlvSidebarWorkspaceLogo);

  /** @protected Optional structural template for workspace text. */
  protected readonly _textTemplate = contentChild(MlvSidebarWorkspaceText);

  /** @protected Whether the switcher menu is currently open. */
  protected readonly _opened = signal(false);

  /** @protected True when choosing between multiple workspaces is possible. */
  protected readonly _hasMultiple = computed(
    () => this.workspaces().length > 1,
  );

  /**
   * @protected Whether the parent sidebar is collapsed. Workspace switchers
   * outside a sidebar remain expanded.
   */
  protected readonly _isCollapsed = computed(
    () => this._sidebarContext?.collapsed() ?? false,
  );

  /**
   * @protected Accessible trigger name including the current workspace.
   */
  protected readonly _triggerAriaLabel = computed(() =>
    this._i18nResolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'switchWorkspace',
      { workspace: this.workspace().label },
    ),
  );

  /**
   * @protected Selects a workspace from the menu. The menu item directive
   * closes the overlay and restores focus to the trigger after this handler.
   */
  protected _selectWorkspace(workspace: MlvSidebarWorkspaceOption): void {
    this.workspace.set(workspace);
  }

  /** @protected Tracks whether an option represents the active workspace. */
  protected _isSelected(workspace: MlvSidebarWorkspaceOption): boolean {
    return workspace.id === this.workspace().id;
  }

  /**
   * @protected Builds the strongly typed context supplied to the logo and text
   * structural templates.
   */
  protected _templateContext(
    workspace: MlvSidebarWorkspaceOption,
  ): MlvSidebarWorkspaceTemplateContext {
    return {
      $implicit: workspace,
      selected: this._isSelected(workspace),
    };
  }

  /** @protected Produces a compact fallback monogram when no logo is supplied. */
  protected _initials(label: string): string {
    return label
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase();
  }
}
