import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvSidebarMode } from './sidebar-mode';

export interface MlvSidebarContextValue {
  /** Whether the sidebar is collapsed. */
  readonly collapsed: Signal<boolean>;
  /** Whether the current rendering context is inside a flyout popup. */
  readonly inFlyout?: Signal<boolean>;
  /** The layout mode requested by the author. */
  readonly mode: Signal<MlvSidebarMode>;
  /**
   * The layout mode actually in effect. Equals {@link mode} unless a
   * responsive override (`MlvSidebar.collapseBelow`) is active, in which case
   * it reports `'offcanvas'`. Optional so externally implemented contexts stay
   * valid — read it as `effectiveMode?.() ?? mode()`.
   */
  readonly effectiveMode?: Signal<MlvSidebarMode>;
  /** Toggle between collapsed and expanded. */
  toggle(): void;
  /** Set the sidebar width in pixels (used by the rail during drag). */
  setWidth(px: number): void;
}

export const SIDEBAR_CONTEXT = new InjectionToken<MlvSidebarContextValue>(
  'SIDEBAR_CONTEXT',
);
