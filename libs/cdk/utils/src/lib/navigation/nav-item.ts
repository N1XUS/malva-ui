/**
 * Shared data model for navigation items.
 * Consumed by `mlv-sidebar` (via item inputs) and `mlv-bottom-nav`
 * so that a single data source can drive both mobile and desktop navigation.
 */
export interface MlvNavItem {
  /** Lucide icon name (e.g., 'home', 'search', 'settings'). */
  icon: string;
  /** Visible label for the navigation item. */
  label: string;
  /** Router path (e.g., '/home', '/settings'). */
  route: string;
  /** Optional badge count displayed on the item. */
  badge?: number;
  /** When true the item is visually muted and non-interactive. */
  disabled?: boolean;
}
