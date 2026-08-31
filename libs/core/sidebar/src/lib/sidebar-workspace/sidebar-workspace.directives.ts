import { Directive, TemplateRef, inject } from '@angular/core';
import type { MlvSidebarWorkspaceTemplateContext } from './sidebar-workspace.types';

@Directive({
  selector: '[mlvSidebarWorkspaceLogo]',
})
export class MlvSidebarWorkspaceLogo {
  /** Template rendered in both the active trigger and every workspace option. */
  readonly templateRef = inject(
    TemplateRef<MlvSidebarWorkspaceTemplateContext>,
  );

  /** Enables strongly typed `let-workspace` and `let-selected="selected"`. */
  static ngTemplateContextGuard(
    _directive: MlvSidebarWorkspaceLogo,
    _context: unknown,
  ): _context is MlvSidebarWorkspaceTemplateContext {
    return true;
  }
}

@Directive({
  selector: '[mlvSidebarWorkspaceText]',
})
export class MlvSidebarWorkspaceText {
  /** Template rendered in both the active trigger and every workspace option. */
  readonly templateRef = inject(
    TemplateRef<MlvSidebarWorkspaceTemplateContext>,
  );

  /** Enables strongly typed `let-workspace` and `let-selected="selected"`. */
  static ngTemplateContextGuard(
    _directive: MlvSidebarWorkspaceText,
    _context: unknown,
  ): _context is MlvSidebarWorkspaceTemplateContext {
    return true;
  }
}
